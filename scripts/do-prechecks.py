#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Run Narravo's local quality gates in fail-fast order.

Quick, dependency-free checks run first (toolchain, release metadata, migration
journal, SPDX headers, repository hygiene), then the slower gates (lockfile
sync, type checking, ESLint, production build, Vitest). Execution stops at the
first failing gate, so cheap failures surface before anything expensive runs.

The script is intentionally stdlib-only. Rich is used for nicer output when it
is installed, but plain-text output works without it.

Examples:
    ./scripts/do-prechecks.py                 # every default gate (~35 seconds)
    ./scripts/do-prechecks.py --quick         # static gates + typecheck only
    ./scripts/do-prechecks.py --skip Lockfile # skip one gate by name fragment
    ./scripts/do-prechecks.py --database      # also verify drizzle migration state
    ./scripts/do-prechecks.py --include-e2e   # add Playwright at the end
    ./scripts/do-prechecks.py --list          # print the gate plan and exit
    ./scripts/do-prechecks.py --install-hook  # wire this script to git pre-commit
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List, Optional, Sequence, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]

# Tiers are ordered; --quick keeps only TIER_STATIC.
TIER_STATIC = "static"
TIER_BUILD = "build"
TIER_TEST = "test"
TIER_E2E = "e2e"
TIER_ORDER = {
    TIER_STATIC: 0,
    TIER_BUILD: 1,
    TIER_TEST: 2,
    TIER_E2E: 3,
}

ANSI_ESCAPE_PATTERN = re.compile(
    r"\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))"
)
# Matches Rich markup tags only ([bold], [/dim], [#00ff00], [bold cyan]); literal
# brackets such as src/app/uploads/[...path] must survive plain-text rendering.
MARKUP_PATTERN = re.compile(r"\[/?(?:[a-zA-Z#][a-zA-Z0-9_#.,;:=+ \-]*)\]")

# Build output matching any of these markers fails the build gate even when the
# build exits zero, so newly introduced warnings cannot be absorbed silently.
BUILD_WARNING_PATTERN = re.compile(
    r"\b(?:warn|[a-z0-9_]*warnings?)\b|\bdeprecat(?:ed|ion)\b|(?:^|\s)⚠(?:\s|$)",
    re.IGNORECASE,
)

SEMVER_PATTERN = re.compile(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?")
VERSION_NUMBER_PATTERN = re.compile(r"(\d+)(?:\.(\d+))?(?:\.(\d+))?")

# SPDX policy mirrors scripts/add-spdx.ts, scoped to first-party source trees.
# tests/ is advisory until its existing headers are backfilled; move it into
# SPDX_DIRS after running `pnpm spdx:add` over the test tree.
SPDX_DIRS = ("src", "scripts")
SPDX_ADVISORY_DIRS = ("tests",)
# Every extension below is covered by scripts/add-spdx.ts, so `pnpm spdx:add`
# can fix anything this gate flags.
SPDX_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".cts",
    ".mts",
    ".js",
    ".jsx",
    ".cjs",
    ".mjs",
    ".py",
    ".sh",
}
SPDX_GENERATED = {"src/version.ts"}

ESLINT_CONFIG_NAMES = (
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
    "eslint.config.ts",
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.json",
    ".eslintrc.yml",
)

PLAYWRIGHT_CONFIG_NAMES = (
    "playwright.config.ts",
    "playwright.config.mjs",
    "playwright.config.js",
)

SECRET_SUFFIXES = {".pem", ".key", ".p12", ".pfx", ".keystore"}
# Name-based rules only: a repo full of security fixtures is the wrong place for
# content sniffing, which would flag test credentials and example keys.
SECRET_NAMES = {".env", "id_rsa", "id_ed25519", ".netrc"}

# Tracked files that intentionally match .gitignore rules.
IGNORED_BUT_ALLOWED: frozenset[str] = frozenset()

# Non-blocking observations surfaced in the final summary.
NOTES: List[str] = []

try:  # pragma: no cover - presentation detail
    from rich import box  # type: ignore
    from rich.console import Console  # type: ignore
    from rich.markup import escape as rich_escape  # type: ignore
    from rich.panel import Panel  # type: ignore
    from rich.table import Table  # type: ignore
    from rich.text import Text  # type: ignore

    RICH = True
    _console = Console(highlight=False)
except ImportError:  # pragma: no cover - fallback presentation
    RICH = False

    def rich_escape(value: str) -> str:  # type: ignore[misc]
        return value

    class _PlainConsole:  # pragma: no cover - fallback presentation
        @staticmethod
        def print(value: object = "") -> None:
            print(strip_markup(str(value)))

        @staticmethod
        def rule(value: object = "") -> None:
            body = strip_markup(str(value))
            print(f"\n--- {body} " + "-" * max(0, 60 - len(body)))

    _console = _PlainConsole()  # type: ignore[assignment]


# --------------------------------------------------------------------------- #
# Presentation helpers
# --------------------------------------------------------------------------- #

def strip_markup(value: str) -> str:
    """Remove Rich markup so the plain-text fallback stays readable."""
    return MARKUP_PATTERN.sub("", value)


def render(value: str = "") -> None:
    _console.print(value)  # type: ignore[attr-defined]


def rule(value: str = "") -> None:
    if RICH:
        _console.rule(value)  # type: ignore[attr-defined]
    else:  # pragma: no cover - fallback presentation
        _console.rule(value)  # type: ignore[attr-defined]


def panel(body: str, title: str) -> None:
    if RICH:
        _console.print(Panel(body, title=title, border_style="cyan"))  # type: ignore[attr-defined]
    else:  # pragma: no cover - fallback presentation
        _console.print(f"=== {title} ===\n{body}")  # type: ignore[attr-defined]


# --------------------------------------------------------------------------- #
# Data structures
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class Check:
    """One fail-fast quality gate.

    A gate either runs a subprocess (``command``) or an in-process function
    (``func``) returning human-readable problems. ``skip_reason`` marks a gate
    that cannot run in the current environment without failing the run.
    """

    name: str
    detail: str
    tier: str
    command: Optional[Tuple[str, ...]] = None
    func: Optional[Callable[[], Sequence[str]]] = None
    reject_warnings: bool = False
    skip_reason: Optional[str] = None


@dataclass(frozen=True)
class CheckResult:
    """The outcome of one gate."""

    check: Check
    elapsed_seconds: float
    returncode: int = 0
    problems: Tuple[str, ...] = ()
    warning_lines: Tuple[str, ...] = ()

    @property
    def skipped(self) -> bool:
        return self.check.skip_reason is not None

    @property
    def passed(self) -> bool:
        return self.returncode == 0 and not self.problems and not self.warning_lines


# --------------------------------------------------------------------------- #
# Small helpers
# --------------------------------------------------------------------------- #

def read_package() -> dict:
    return json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))


def run_command(args: Sequence[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        list(args), cwd=REPO_ROOT, capture_output=True, text=True, check=False
    )


def git(args: Sequence[str]) -> Optional[str]:
    """Run git in the repo, returning None when git or the repo is unavailable."""
    if shutil.which("git") is None:
        return None
    try:
        completed = run_command(["git", *args])
    except OSError:  # pragma: no cover - defensive
        return None
    return completed.stdout if completed.returncode == 0 else None


def tracked_files() -> Optional[List[str]]:
    """Files git already knows about (committed or staged)."""
    output = git(["ls-files", "-z"])
    if output is None:
        return None
    return [name for name in output.split("\0") if name]


def pending_files() -> Optional[List[str]]:
    """Tracked files plus new, not-yet-ignored files.

    Pre-commit checks must see files that have not been `git add`-ed yet, while
    still honouring .gitignore so local scratch files are never inspected.
    """
    output = git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
    if output is None:
        return None
    return [name for name in output.split("\0") if name]


def version_tuple(value: str) -> Tuple[int, int, int]:
    match = VERSION_NUMBER_PATTERN.search(value)
    if not match:
        return (0, 0, 0)
    major, minor, patch = match.groups()
    return (int(major), int(minor or 0), int(patch or 0))


def engine_minimum(spec: Optional[str]) -> Optional[Tuple[int, int, int]]:
    if not spec:
        return None
    return version_tuple(spec) if VERSION_NUMBER_PATTERN.search(spec) else None


def tool_version(args: Sequence[str]) -> Optional[str]:
    if shutil.which(args[0]) is None:
        return None
    try:
        completed = run_command(args)
    except OSError:  # pragma: no cover - defensive
        return None
    if completed.returncode != 0:
        return None
    match = VERSION_NUMBER_PATTERN.search(completed.stdout)
    return match.group(0) if match else None


def render_command(command: Sequence[str]) -> str:
    return shlex.join(str(part) for part in command)


def strip_terminal_codes(value: str) -> str:
    return ANSI_ESCAPE_PATTERN.sub("", value)


def warning_markers(lines: Sequence[str]) -> Tuple[str, ...]:
    """Unique warning markers found in captured command output."""
    unique = [
        line.strip()
        for line in lines
        if line.strip() and BUILD_WARNING_PATTERN.search(strip_terminal_codes(line))
    ]
    return tuple(dict.fromkeys(unique))


# --------------------------------------------------------------------------- #
# Static in-process gates
# --------------------------------------------------------------------------- #

def check_toolchain() -> List[str]:
    problems: List[str] = []
    if shutil.which("pnpm") is None:
        problems.append("pnpm is not on PATH; enable Corepack (`corepack enable`)")
    node = tool_version(["node", "--version"])
    if node is None:
        problems.append("node is not on PATH")

    if not (REPO_ROOT / "package.json").is_file():
        problems.append(f"package.json was not found under {REPO_ROOT}")
        return problems
    if not (REPO_ROOT / "pnpm-lock.yaml").is_file():
        problems.append("pnpm-lock.yaml is missing; the lockfile must be committed")
    if not (REPO_ROOT / "node_modules").is_dir():
        problems.append(
            "node_modules is missing; run `pnpm install --frozen-lockfile` first"
        )

    package = read_package()
    if not package.get("packageManager"):
        problems.append("package.json is missing the `packageManager` field")

    engines = package.get("engines", {})
    if node:
        minimum = engine_minimum(engines.get("node"))
        if minimum and version_tuple(node) < minimum:
            problems.append(
                f"Node {node} is older than package.json engines.node "
                f"({engines.get('node')})"
            )
    pnpm = tool_version(["pnpm", "--version"])
    if pnpm:
        minimum = engine_minimum(engines.get("pnpm"))
        if minimum and version_tuple(pnpm) < minimum:
            problems.append(
                f"pnpm {pnpm} is older than package.json engines.pnpm "
                f"({engines.get('pnpm')})"
            )
    return problems


def find_stray_package_json_keys(package: dict) -> List[str]:
    """Top-level fields that shadow a dependency name are ignored by npm."""
    declared: set[str] = set()
    for section in (
        "dependencies",
        "devDependencies",
        "optionalDependencies",
        "peerDependencies",
    ):
        declared.update((package.get(section) or {}).keys())
    return [key for key in package if key in declared]


def check_release_metadata() -> List[str]:
    problems: List[str] = []
    package = read_package()
    version = str(package.get("version", ""))
    if not SEMVER_PATTERN.fullmatch(version):
        problems.append(f"package.json version {version!r} is not valid SemVer")

    for key in find_stray_package_json_keys(package):
        problems.append(
            f'package.json has a top-level "{key}" field that duplicates the dependency '
            "of the same name; npm ignores it, so delete the stray field"
        )

    readme = REPO_ROOT / "README.md"
    if readme.is_file():
        badge = re.search(
            r"img\.shields\.io/badge/version-([^-)\s]+)-",
            readme.read_text(encoding="utf-8"),
        )
        if not badge:
            problems.append("README.md has no version badge to compare with package.json")
        elif badge.group(1) != version:
            problems.append(
                f"README.md version badge says {badge.group(1)} but package.json says {version}"
            )
    else:
        problems.append("README.md is missing")

    changelog = REPO_ROOT / "CHANGELOG.md"
    if not changelog.is_file():
        problems.append("CHANGELOG.md is missing")
    elif not has_changelog_entry(
        changelog.read_text(encoding="utf-8"), version
    ):
        problems.append(
            f"CHANGELOG.md has no `## [{version}]` section; add the release entry before "
            "committing this version"
        )
    return problems


def has_changelog_entry(changelog: str, version: str) -> bool:
    return bool(
        re.search(rf"^## \[{re.escape(version)}\]", changelog, re.MULTILINE)
    )


def missing_spdx_files(files: Sequence[str], dirs: Sequence[str]) -> List[str]:
    missing: List[str] = []
    for name in files:
        parts = name.split("/", 1)
        suffix = Path(name).suffix.lower()
        if len(parts) < 2 or parts[0] not in dirs:
            continue
        if suffix not in SPDX_EXTENSIONS or name in SPDX_GENERATED:
            continue
        path = REPO_ROOT / name
        if not path.is_file():
            continue
        if "SPDX-License-Identifier:" not in path.read_text(
            encoding="utf-8", errors="replace"
        ):
            missing.append(name)
    return missing


def check_spdx_headers() -> List[str]:
    files = pending_files()
    if files is None:
        render("[yellow]git is unavailable; skipping the SPDX header inventory.[/yellow]")
        return []
    advisory = missing_spdx_files(files, SPDX_ADVISORY_DIRS)
    if advisory:
        NOTES.append(
            f"{len(advisory)} file(s) under {'/'.join(SPDX_ADVISORY_DIRS)} still lack the "
            "SPDX header (advisory). Run `pnpm spdx:add`, then add that directory to "
            "SPDX_DIRS in scripts/do-prechecks.py to enforce it."
        )

    missing = missing_spdx_files(files, SPDX_DIRS)
    if not missing:
        return []
    shown = "\n  ".join(missing[:12])
    extra = "" if len(missing) <= 12 else f"\n  … and {len(missing) - 12} more"
    return [
        f"{len(missing)} tracked source file(s) are missing the Apache-2.0 SPDX header "
        f"(fix with `pnpm spdx:add`):\n  {shown}{extra}"
    ]


def check_migration_journal() -> List[str]:
    problems: List[str] = []
    migrations = REPO_ROOT / "drizzle" / "migrations"
    journal_path = migrations / "meta" / "_journal.json"

    if not (REPO_ROOT / "drizzle" / "schema.ts").is_file():
        problems.append("drizzle/schema.ts is missing")
    if not journal_path.is_file():
        problems.append("drizzle/migrations/meta/_journal.json is missing")
        return problems

    try:
        journal = json.loads(journal_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        return [f"drizzle/migrations/meta/_journal.json is not valid JSON: {error}"]

    entries = journal.get("entries", [])
    if journal.get("dialect") not in (None, "postgresql"):
        problems.append(
            f"migration journal dialect is {journal.get('dialect')!r}, expected 'postgresql'"
        )
    if not entries:
        problems.append("migration journal has no entries")
        return problems

    indexes = [entry.get("idx") for entry in entries]
    if indexes != list(range(len(indexes))):
        problems.append(f"migration journal idx values are not sequential: {indexes}")

    tags = [str(entry.get("tag", "")) for entry in entries]
    if len(set(tags)) != len(tags):
        problems.append("migration journal contains duplicate migration tags")

    referenced = {f"{tag}.sql" for tag in tags}
    for name in sorted(referenced):
        if not (migrations / name).is_file():
            problems.append(
                f"migration journal references missing file drizzle/migrations/{name}"
            )

    orphans = sorted(
        path.name for path in migrations.glob("*.sql") if path.name not in referenced
    )
    if orphans:
        problems.append(
            "SQL files exist that the journal never references, so drizzle-kit will not "
            "apply them: " + ", ".join(orphans)
        )

    timestamps = [entry.get("when", 0) for entry in entries]
    if any(current < previous for previous, current in zip(timestamps, timestamps[1:])):
        NOTES.append(
            "Migration journal timestamps are not monotonically increasing; confirm no "
            "committed migration was hand-edited afterwards."
        )

    mismatches = [
        f"{entry.get('tag')} is journal index {index}"
        for index, entry in enumerate(entries)
        if str(entry.get("tag", "")).split("_", 1)[0] != f"{index:04d}"
    ]
    if mismatches:
        NOTES.append(
            f"{len(mismatches)} migration filename prefix(es) disagree with their journal "
            f"index (first: {mismatches[0]}). drizzle-kit uses the journal, so this is "
            "informational, but it usually means a migration was renamed or deleted after "
            "generation."
        )
    return problems


def is_secret_material(name: str) -> bool:
    """Flag files that should never be committed to this repository."""
    path = Path(name)
    if path.name in SECRET_NAMES:
        return True
    if path.suffix.lower() in SECRET_SUFFIXES:
        return True
    if path.name.startswith(".env.") and path.name != ".env.example":
        return True
    return False


def check_repo_hygiene() -> List[str]:
    problems: List[str] = []
    files = tracked_files()
    if files is None:
        render("[yellow]git is unavailable; skipping repository hygiene checks.[/yellow]")
        return problems

    ignored_output = git(
        ["ls-files", "--cached", "--ignored", "--exclude-standard", "-z"]
    )
    committed_ignored = sorted(
        name
        for name in (ignored_output or "").split("\0")
        if name and name not in IGNORED_BUT_ALLOWED
    )
    if committed_ignored:
        problems.append(
            "Files are tracked although .gitignore lists them: "
            + ", ".join(committed_ignored[:10])
        )

    secrets = sorted(name for name in files if is_secret_material(name))
    if secrets:
        problems.append(
            "Potential secret material is tracked: " + ", ".join(secrets[:10])
        )

    if not (REPO_ROOT / "LICENSE").is_file() or not (REPO_ROOT / "NOTICE").is_file():
        problems.append("LICENSE and NOTICE must both exist for this Apache-2.0 project")
    return problems


# --------------------------------------------------------------------------- #
# Gate plan
# --------------------------------------------------------------------------- #

def eslint_skip_reason() -> Optional[str]:
    if "lint" not in read_package().get("scripts", {}):
        return "package.json has no `lint` script yet"
    if not any((REPO_ROOT / name).is_file() for name in ESLINT_CONFIG_NAMES):
        return "no ESLint configuration file was found (eslint.config.mjs is expected)"
    return None


def e2e_skip_reason() -> Optional[str]:
    if not any((REPO_ROOT / name).is_file() for name in PLAYWRIGHT_CONFIG_NAMES):
        return "no playwright.config.* exists yet, so tests/e2e cannot run"
    return None


def build_checks(
    *,
    quick: bool = False,
    include_e2e: bool = False,
    database: bool = False,
) -> List[Check]:
    """Return gates ordered from quick feedback to the longest-running work."""
    checks: List[Check] = [
        Check(
            name="Toolchain",
            detail="Verify pnpm, Node engines, the lockfile, and an installed workspace.",
            tier=TIER_STATIC,
            func=check_toolchain,
        ),
        Check(
            name="Release metadata",
            detail="Keep package.json, the README version badge, and CHANGELOG in agreement.",
            tier=TIER_STATIC,
            func=check_release_metadata,
        ),
        Check(
            name="Migration journal",
            detail="Validate drizzle/migrations ordering and journal/file parity offline.",
            tier=TIER_STATIC,
            func=check_migration_journal,
        ),
        Check(
            name="SPDX headers",
            detail="Enforce the Apache-2.0 SPDX inventory under src, scripts, and tests.",
            tier=TIER_STATIC,
            func=check_spdx_headers,
        ),
        Check(
            name="Repository hygiene",
            detail="Reject tracked-but-ignored files and committed secret material.",
            tier=TIER_STATIC,
            func=check_repo_hygiene,
        ),
        Check(
            name="Precheck utility tests",
            detail="Verify this gate's own metadata and warning detection logic.",
            tier=TIER_STATIC,
            command=(sys.executable, "-B", "scripts/test_do_prechecks.py"),
        ),
        Check(
            name="Lockfile sync",
            detail="pnpm install --frozen-lockfile must succeed with the committed lockfile.",
            tier=TIER_STATIC,
            command=("pnpm", "install", "--frozen-lockfile", "--ignore-scripts"),
        ),
        Check(
            name="TypeScript",
            detail="Type-check the whole project (also regenerates src/version.ts).",
            tier=TIER_STATIC,
            command=("pnpm", "typecheck"),
        ),
        Check(
            name="ESLint",
            detail="Lint the repository through the canonical `pnpm lint` gate.",
            tier=TIER_STATIC,
            command=("pnpm", "lint"),
            skip_reason=eslint_skip_reason(),
        ),
    ]

    if not quick:
        checks.append(
            Check(
                name="Production build",
                detail="Build the Next.js application and reject warning output.",
                tier=TIER_BUILD,
                command=("pnpm", "build"),
                reject_warnings=True,
            )
        )
        checks.append(
            Check(
                name="Unit tests",
                detail="Run the complete Vitest suite.",
                tier=TIER_TEST,
                command=("pnpm", "test"),
            )
        )

    if database:
        checks.append(
            Check(
                name="Database migration status",
                detail="Compare applied migrations with drizzle/migrations for DATABASE_URL.",
                tier=TIER_TEST,
                command=("pnpm", "drizzle:check"),
                skip_reason=(
                    None
                    if os.environ.get("DATABASE_URL", "").strip()
                    else "DATABASE_URL is not set; export it and re-run with --database"
                ),
            )
        )

    if include_e2e:
        checks.append(
            Check(
                name="End-to-end tests",
                detail="Run Playwright against the built application.",
                tier=TIER_E2E,
                command=("pnpm", "exec", "playwright", "test"),
                skip_reason=e2e_skip_reason(),
            )
        )

    order = [TIER_ORDER[check.tier] for check in checks]
    if order != sorted(order):  # pragma: no cover - guards future edits to the plan
        raise SystemExit("Gate plan is not ordered cheapest-first; fix the tier of the new gate.")

    return checks


# --------------------------------------------------------------------------- #
# Execution
# --------------------------------------------------------------------------- #

def print_process_line(line: str) -> None:
    value = line.rstrip("\r\n")
    if RICH:
        if value:
            _console.print(Text.from_ansi(value), soft_wrap=True)  # type: ignore[attr-defined]
        else:
            _console.print()
    else:  # pragma: no cover - fallback presentation
        print(value)


def run_check(check: Check, *, position: int, total: int) -> CheckResult:
    rule(f"[bold cyan]{position}/{total} · {rich_escape(check.name)}[/bold cyan]")
    render(check.detail)

    started_at = time.monotonic()

    if check.skip_reason:
        render(f"[yellow]SKIP[/yellow] {rich_escape(check.skip_reason)}")
        return CheckResult(check=check, elapsed_seconds=0.0)

    if check.func is not None:
        render("[dim](in-process check)[/dim]")
        problems = tuple(check.func())
        return CheckResult(
            check=check, elapsed_seconds=time.monotonic() - started_at, problems=problems
        )

    assert check.command is not None
    render(f"[dim]$ {rich_escape(render_command(check.command))}[/dim]")

    captured: List[str] = []
    process: Optional[subprocess.Popen] = None
    try:
        process = subprocess.Popen(
            list(check.command),
            cwd=REPO_ROOT,
            env=os.environ.copy(),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
        assert process.stdout is not None
        for line in process.stdout:
            print_process_line(line)
            if check.reject_warnings:
                captured.append(line)
        returncode = process.wait()
    except KeyboardInterrupt:  # pragma: no cover - interactive
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        render("\n[yellow]Prechecks interrupted.[/yellow]")
        raise SystemExit(130)

    return CheckResult(
        check=check,
        elapsed_seconds=time.monotonic() - started_at,
        returncode=returncode,
        warning_lines=warning_markers(captured) if check.reject_warnings else (),
    )


def print_failure(result: CheckResult, *, remaining: Sequence[Check]) -> None:
    reasons: List[str] = []
    if result.returncode != 0:
        reasons.append(f"Command exited with status {result.returncode}.")
    reasons.extend(rich_escape(problem) for problem in result.problems)
    if result.warning_lines:
        plural = "s" if len(result.warning_lines) != 1 else ""
        reasons.append(
            f"The command emitted {len(result.warning_lines)} unique warning marker{plural}:"
        )
        reasons.extend(f"  • {rich_escape(line)}" for line in result.warning_lines)
    if remaining:
        reasons.append(
            "Fail-fast mode did not run: " + ", ".join(check.name for check in remaining)
        )

    render()
    panel(
        "\n".join(reasons),
        title=f"[bold red]Failed · {rich_escape(result.check.name)}[/bold red]",
    )


def print_summary(results: Sequence[CheckResult]) -> None:
    rows = [
        (
            result.check.name,
            "SKIP" if result.skipped else "PASS",
            f"{result.elapsed_seconds:.1f}s",
        )
        for result in results
    ]
    if RICH:
        table = Table(box=box.SIMPLE, show_header=True, header_style="bold")
        table.add_column("Gate")
        table.add_column("Result", justify="center")
        table.add_column("Time", justify="right")
        for name, outcome, elapsed in rows:
            table.add_row(name, f"[green]{outcome}[/green]" if outcome == "PASS"
                          else f"[yellow]{outcome}[/yellow]", elapsed)
        _console.print(table)  # type: ignore[attr-defined]
    else:  # pragma: no cover - fallback presentation
        for name, outcome, elapsed in rows:
            print(f"{name:<28} {outcome:<6} {elapsed}")

    skipped = [result for result in results if result.skipped]
    total_seconds = sum(result.elapsed_seconds for result in results)
    body = (
        f"[bold green]All {len(results)} prechecks passed[/bold green] "
        f"in {total_seconds:.1f}s."
    )
    if skipped:
        body += "\nSkipped: " + ", ".join(
            f"{result.check.name} ({result.check.skip_reason})" for result in skipped
        )
    if NOTES:
        body += "\n\nNotes:\n" + "\n".join(f"• {rich_escape(note)}" for note in NOTES)
    render()
    panel(body, title="Precheck summary")


def select_checks(checks: Sequence[Check], skips: Sequence[str]) -> List[Check]:
    """Drop gates whose name contains a --skip fragment; reject typos."""
    if not skips:
        return list(checks)
    names = [check.name for check in checks]
    unmatched = [
        pattern for pattern in skips
        if not any(pattern.lower() in name.lower() for name in names)
    ]
    if unmatched:
        raise SystemExit(
            f"No gate matches --skip {', '.join(unmatched)}.\n"
            "Available gates: " + ", ".join(names)
        )
    return [
        check
        for check in checks
        if not any(pattern.lower() in check.name.lower() for pattern in skips)
    ]


def install_hook(*, quick: bool, force: bool) -> int:
    hooks_dir = REPO_ROOT / ".git" / "hooks"
    if not hooks_dir.is_dir():
        print("This checkout is not a git repository; cannot install a hook.", file=sys.stderr)
        return 2
    hook = hooks_dir / "pre-commit"
    if hook.exists() and not force:
        print(
            f"{hook} already exists; re-run with --force to replace it.", file=sys.stderr
        )
        return 2

    default_args = "--quick" if quick else ""
    hook.write_text(
        "#!/bin/sh\n"
        "# SPDX-License-Identifier: Apache-2.0\n"
        "# Installed by scripts/do-prechecks.py --install-hook.\n"
        "# Bypass once with: git commit --no-verify\n"
        "set -e\n"
        'root="$(git rev-parse --show-toplevel)"\n'
        'exec python3 "$root/scripts/do-prechecks.py" '
        "${NARRAVO_PRECHECKS_ARGS:-" + default_args + "}\n"
    )
    hook.chmod(0o755)
    print(f"Installed pre-commit hook -> {hook}")
    print(
        f"Default arguments: {default_args or '(full run)'}. "
        "Override with NARRAVO_PRECHECKS_ARGS."
    )
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Run quick static checks first, then type checking, the production build, "
            "and the Vitest suite. Stops immediately when a gate fails."
        )
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Run only the fast static gates plus TypeScript (skips build and tests).",
    )
    parser.add_argument(
        "--include-e2e",
        action="store_true",
        help="Run Playwright last. Requires playwright.config.* and an installed browser.",
    )
    parser.add_argument(
        "--database",
        action="store_true",
        help="Also run `pnpm drizzle:check` against DATABASE_URL.",
    )
    parser.add_argument(
        "--skip",
        action="append",
        default=[],
        metavar="GATE",
        help="Skip a gate by name fragment (repeatable), e.g. --skip Lockfile.",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="Print the planned gates and exit without running them.",
    )
    parser.add_argument(
        "--install-hook",
        action="store_true",
        help="Install a git pre-commit hook that runs these gates.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="With --install-hook, replace an existing hook.",
    )
    return parser.parse_args()


def main() -> int:
    options = parse_args()

    if options.install_hook:
        return install_hook(quick=options.quick, force=options.force)
    if options.quick and options.include_e2e:
        raise SystemExit("--include-e2e needs the build gate; drop --quick to use it.")

    checks = select_checks(
        build_checks(
            quick=options.quick,
            include_e2e=options.include_e2e,
            database=options.database,
        ),
        options.skip,
    )

    if options.list:
        for index, check in enumerate(checks, start=1):
            target = render_command(check.command) if check.command else "in-process"
            print(f"{index:>2}. [{check.tier:<6}] {check.name:<28} -> {target}")
        return 0

    panel(
        "Fast gates run first and execution stops on the first failure. "
        + (
            "Build and test gates are disabled (--quick)."
            if options.quick
            else "Build and test gates are included."
        ),
        title="[bold]Narravo prechecks[/bold]",
    )

    results: List[CheckResult] = []
    for index, check in enumerate(checks):
        result = run_check(check, position=index + 1, total=len(checks))
        results.append(result)
        if result.skipped:
            continue
        if not result.passed:
            print_failure(result, remaining=checks[index + 1 :])
            return result.returncode if result.returncode else 1
        render(
            f"[bold green]PASS[/bold green] {rich_escape(check.name)} "
            f"[dim]({result.elapsed_seconds:.1f}s)[/dim]"
        )

    print_summary(results)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
