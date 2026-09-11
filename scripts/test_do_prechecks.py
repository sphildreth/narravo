#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Unit tests for scripts/do-prechecks.py.

Run directly (this is what the precheck gate invokes):

    python3 -B scripts/test_do_prechecks.py
"""

from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def load_prechecks():
    """Import do-prechecks.py despite the dash in its filename."""
    script = REPO_ROOT / "scripts" / "do-prechecks.py"
    spec = importlib.util.spec_from_file_location("do_prechecks", script)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["do_prechecks"] = module
    spec.loader.exec_module(module)
    return module


prechecks = load_prechecks()


class WarningDetectionTests(unittest.TestCase):
    def test_detects_build_warning_markers(self) -> None:
        output = [
            "  ▲ Next.js 16.3.3",
            "⚠ Compiled with warnings",
            "npm warn deprecated foo@1.0.0",
            "Attention: deprecated config option",
        ]
        markers = prechecks.warning_markers(output)
        self.assertEqual(len(markers), 3)

    def test_deduplicates_repeated_markers(self) -> None:
        markers = prechecks.warning_markers(["warn: a", "warn: a", "  warn: a  "])
        self.assertEqual(markers, ("warn: a",))

    def test_clean_output_produces_no_markers(self) -> None:
        output = [
            "✓ Compiled successfully",
            "Route (app)                    Size  First Load JS",
            "├ ○ /                            5kB         100kB",
        ]
        self.assertEqual(prechecks.warning_markers(output), ())

    def test_terminal_codes_are_ignored_when_matching(self) -> None:
        self.assertEqual(prechecks.strip_terminal_codes("\x1b[33mwarn\x1b[0m"), "warn")

    def test_plain_text_fallback_keeps_text_between_markup(self) -> None:
        self.assertEqual(
            prechecks.strip_markup("[bold green]All 11 prechecks passed[/bold green] in 6s."),
            "All 11 prechecks passed in 6s.",
        )
        self.assertEqual(prechecks.strip_markup("[yellow]SKIP[/yellow] reason"), "SKIP reason")

    def test_plain_text_fallback_keeps_bracketed_paths(self) -> None:
        self.assertEqual(
            prechecks.strip_markup("src/app/uploads/[...path]/route.ts"),
            "src/app/uploads/[...path]/route.ts",
        )


class ResultSemanticsTests(unittest.TestCase):
    def make_check(self, **kwargs) -> prechecks.Check:  # type: ignore[valid-type]
        defaults = dict(name="Gate", detail="detail", tier=prechecks.TIER_STATIC)
        defaults.update(kwargs)
        return prechecks.Check(**defaults)

    def test_warnings_only_failure_still_counts_as_failure(self) -> None:
        result = prechecks.CheckResult(
            check=self.make_check(), elapsed_seconds=1.0, warning_lines=("warn: x",)
        )
        self.assertFalse(result.passed)

    def test_nonzero_exit_counts_as_failure(self) -> None:
        result = prechecks.CheckResult(check=self.make_check(), elapsed_seconds=1.0, returncode=2)
        self.assertFalse(result.passed)

    def test_skipped_gate_has_no_failure_signal(self) -> None:
        result = prechecks.CheckResult(
            check=self.make_check(skip_reason="no lint script"), elapsed_seconds=0.0
        )
        self.assertTrue(result.skipped)
        self.assertTrue(result.passed)


class PackageMetadataTests(unittest.TestCase):
    def test_flags_top_level_key_shadowing_a_dependency(self) -> None:
        package = {
            "name": "narravo-next",
            "version": "1.0.3",
            "tiptap-markdown": "0.9.0",
            "dependencies": {"tiptap-markdown": "^0.9.0", "next": "16.3.3"},
        }
        self.assertEqual(
            prechecks.find_stray_package_json_keys(package), ["tiptap-markdown"]
        )

    def test_accepts_a_clean_manifest(self) -> None:
        package = {
            "name": "narravo-next",
            "version": "1.0.3",
            "engines": {"node": ">=22.13"},
            "dependencies": {"next": "16.3.3"},
            "devDependencies": {"vitest": "4.1.11"},
        }
        self.assertEqual(prechecks.find_stray_package_json_keys(package), [])

    def test_changelog_entry_matching(self) -> None:
        changelog = "# Changelog\n\n## [1.0.3] - 2026-08-30\n\n### Security\n"
        self.assertTrue(prechecks.has_changelog_entry(changelog, "1.0.3"))
        self.assertFalse(prechecks.has_changelog_entry(changelog, "1.0.4"))
        self.assertFalse(
            prechecks.has_changelog_entry("## 1.0.3 - not a bracketed heading", "1.0.3")
        )

    def test_engine_version_comparison(self) -> None:
        self.assertLess(prechecks.version_tuple("22.13.0"), prechecks.version_tuple("22.14.1"))
        self.assertEqual(prechecks.engine_minimum(">=11.5.2"), (11, 5, 2))
        self.assertIsNone(prechecks.engine_minimum(None))


class SpdxInventoryTests(unittest.TestCase):
    def test_flags_only_first_party_source_files(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            original = prechecks.REPO_ROOT
            prechecks.REPO_ROOT = root
            try:
                (root / "src" / "lib").mkdir(parents=True)
                (root / "docs").mkdir()
                (root / "src" / "lib" / "bare.ts").write_text("export const a = 1;\n")
                (root / "src" / "lib" / "tagged.ts").write_text(
                    "// SPDX-License-Identifier: Apache-2.0\nexport const b = 2;\n"
                )
                (root / "src" / "version.ts").write_text("// Auto-generated\n")
                (root / "docs" / "bare.ts").write_text("export const c = 3;\n")

                missing = prechecks.missing_spdx_files(
                    [
                        "src/lib/bare.ts",
                        "src/lib/tagged.ts",
                        "src/version.ts",
                        "docs/bare.ts",
                        "README.md",
                    ],
                    prechecks.SPDX_DIRS,
                )
                self.assertEqual(missing, ["src/lib/bare.ts"])
            finally:
                prechecks.REPO_ROOT = original

    def test_generated_files_and_unknown_directories_are_ignored(self) -> None:
        missing = prechecks.missing_spdx_files(
            ["src/version.ts", "drizzle/migrations/0000_x.ts", "public/uploads/thing.ts"],
            prechecks.SPDX_DIRS,
        )
        self.assertEqual(missing, [])

    def test_catches_new_files_that_are_not_git_added_yet(self) -> None:
        if prechecks.pending_files() is None:
            self.skipTest("git is unavailable")
        probe = REPO_ROOT / "src" / "lib" / "precheck-spdx-probe.ts"
        self.assertFalse(probe.exists(), "probe path is occupied")
        try:
            probe.write_text("export const probe = 1;\n", encoding="utf-8")
            problems = prechecks.check_spdx_headers()
            self.assertEqual(len(problems), 1)
            self.assertIn("src/lib/precheck-spdx-probe.ts", problems[0])
        finally:
            probe.unlink(missing_ok=True)

    def test_tests_tree_is_advisory_only(self) -> None:
        self.assertIn("tests", prechecks.SPDX_ADVISORY_DIRS)
        self.assertNotIn("tests", prechecks.SPDX_DIRS)


class SecretDetectionTests(unittest.TestCase):
    def test_detects_secret_material(self) -> None:
        for name in (".env", "deploy/.env.prod", "certs/tls.pem", "signing.key", "id_rsa"):
            self.assertTrue(prechecks.is_secret_material(name), name)

    def test_allows_examples_and_source(self) -> None:
        for name in (".env.example", "deploy/.env.example", ".npmrc", "src/lib/env.ts"):
            self.assertFalse(prechecks.is_secret_material(name), name)


class GatePlanTests(unittest.TestCase):
    def test_static_gates_run_before_build_and_test(self) -> None:
        order = [prechecks.TIER_ORDER[tier] for tier in
                 [prechecks.TIER_STATIC, prechecks.TIER_BUILD, prechecks.TIER_TEST,
                  prechecks.TIER_E2E]]
        self.assertEqual(order, sorted(order))

        checks = prechecks.build_checks()
        tiers = [check.tier for check in checks]
        self.assertEqual(tiers, sorted(tiers, key=lambda tier: prechecks.TIER_ORDER[tier]))

    def test_quick_run_excludes_build_test_and_e2e(self) -> None:
        tiers = {check.tier for check in prechecks.build_checks(quick=True)}
        self.assertEqual(tiers, {prechecks.TIER_STATIC})

    def test_e2e_is_opt_in(self) -> None:
        names = [check.name for check in prechecks.build_checks()]
        self.assertNotIn("End-to-end tests", names)
        names = [check.name for check in prechecks.build_checks(include_e2e=True)]
        self.assertIn("End-to-end tests", names)
        self.assertEqual(prechecks.build_checks(include_e2e=True)[-1].name,
                         "End-to-end tests")

    def test_database_gate_is_opt_in(self) -> None:
        names = [check.name for check in prechecks.build_checks()]
        self.assertNotIn("Database migration status", names)
        self.assertIn(
            "Database migration status",
            [check.name for check in prechecks.build_checks(database=True)],
        )

    def test_every_gate_declares_a_command_or_a_function(self) -> None:
        for check in prechecks.build_checks(include_e2e=True, database=True):
            self.assertTrue(
                (check.command is None) != (check.func is None),
                f"{check.name} must declare exactly one of command/func",
            )

    def test_skip_by_name_fragment_and_reject_typos(self) -> None:
        checks = prechecks.build_checks()
        reduced = prechecks.select_checks(checks, ["lockfile"])
        self.assertNotIn("Lockfile sync", [check.name for check in reduced])
        self.assertEqual(len(reduced), len(checks) - 1)
        with self.assertRaises(SystemExit):
            prechecks.select_checks(checks, ["definitely-not-a-gate"])


class RepositoryInvariantTests(unittest.TestCase):
    """Assertions about this checkout that the gates exist to protect."""

    def test_migration_journal_is_consistent(self) -> None:
        prechecks.NOTES.clear()
        self.assertEqual(prechecks.check_migration_journal(), [])
        self.assertTrue((REPO_ROOT / "drizzle" / "migrations" / "meta" / "_journal.json").is_file())

    def test_repository_hygiene_passes(self) -> None:
        self.assertEqual(prechecks.check_repo_hygiene(), [])

    def test_release_metadata_passes(self) -> None:
        self.assertEqual(prechecks.check_release_metadata(), [])

    def test_spdx_inventory_passes(self) -> None:
        self.assertEqual(prechecks.check_spdx_headers(), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
