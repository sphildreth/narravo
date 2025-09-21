# 🧑‍💻 Agent Prompt: Re-license “Narravo” to Apache-2.0

**Repository:** `https://github.com/sphildreth/narravo`  
**Project name:** Narravo  
**Copyright owner:** Steven Hildreth and Narravo contributors  
**Primary languages:** TypeScript/TSX (Next.js), plus any scripts/config files

## Goal
Migrate the repository license from MIT to **Apache License 2.0** and wire in best-practice artifacts (NOTICE, SPDX headers, README badge/text, CONTRIBUTING with DCO). Do not change runtime behavior.

## Constraints & Rules
- Apply changes **repo-wide** without altering functional code.
- If any external code is vendored, preserve third-party notices in `NOTICE`.
- Use **SPDX identifiers** at the top of source files:
  - TypeScript/TSX: `// SPDX-License-Identifier: Apache-2.0`
  - Shell/YAML/JSON (where comments are supported): use the correct comment style or skip where the format disallows comments (e.g., JSON).
- Keep commit history intact; create a PR with a clear title and body.
- Assume all current code is owned by the project (no CLA backfills needed).

---

## Actions

1. **Replace LICENSE**
   - Create/replace `LICENSE` at repo root with the **canonical** Apache License, Version 2.0 text.
   - File name must be exactly `LICENSE` (no extension).

2. **Add NOTICE**
   - Create `NOTICE` at repo root with:
     ```
     Narravo
     Copyright (c) 2025 Steven Hildreth and Narravo contributors

     This product includes software developed by the Narravo project.
     ```
   - If you find third-party code that requires attribution or has its own NOTICE, add those lines under the header.

3. **Update README**
   - At the top, add a license badge and a short license blurb:
     - Badge (Markdown): `[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)`
     - Text: “Licensed under the Apache License, Version 2.0. See **LICENSE** and **NOTICE**.”
   - If README previously referenced MIT, update to Apache-2.0.

4. **Add CONTRIBUTING with DCO**
   - Create `CONTRIBUTING.md` with:
     - Short contributing steps (fork, branch, PR).
     - Adopt **Developer Certificate of Origin (DCO)**. Instruct contributors to sign commits with `Signed-off-by: Name <email>` (or enforce via bot if present).
     - Link to LICENSE and NOTICE.

     Minimal content:
     ```md
     # Contributing to Narravo

     Thanks for your interest in contributing!

     ## Quick Start
     1. Fork the repo and create a feature branch.
     2. Make changes with tests where applicable.
     3. Commit with DCO sign-off (see below).
     4. Open a Pull Request.

     ## DCO (Developer Certificate of Origin)
     We use the DCO to confirm you have the right to submit your code.

     Sign your commits with:
     git commit -s -m "feat: your message"

     The `-s` adds a `Signed-off-by` line using your Git config name and email.

     ## License
     By contributing, you agree your contributions are licensed under the Apache License 2.0. See `LICENSE` and `NOTICE`.
     ```

5. **SPDX Headers**
   - Add SPDX header comments to **all** first-party source files where the format allows comments.
   - For TypeScript/TSX:
     ```ts
     // SPDX-License-Identifier: Apache-2.0
     ```
   - For shell scripts:
     ```bash
     #!/usr/bin/env bash
     # SPDX-License-Identifier: Apache-2.0
     ```
   - For YAML:
     ```yaml
     # SPDX-License-Identifier: Apache-2.0
     ```
   - **Do not** add comments to JSON/lockfiles or formats that disallow comments.

   Implementation detail:
   - Recursively scan tracked files; apply header if:
     - File extension in `{.ts,.tsx,.cts,.mts,.js,.jsx,.cjs,.mjs,.sh,.bash,.zsh,.ps1,.yaml,.yml,.toml,.md,.css,.scss,.sass,.py,.go,.rs}` and
     - File does **not** already contain an SPDX identifier.
   - Place SPDX header as the **first non-shebang line** (preserve shebangs).

6. **Package Metadata (optional but nice)**
   - If there is a `package.json`, ensure `"license": "Apache-2.0"`.

7. **PR & Release Notes**
   - Create a branch `chore/relicense-apache-2.0`.
   - Commit with message:
     ```
     chore: re-license to Apache-2.0 (LICENSE, NOTICE, SPDX, CONTRIBUTING, README)
     ```
   - Open a PR titled:
     ```
     Relicense to Apache-2.0 (with NOTICE, SPDX headers, DCO)
     ```
   - PR body should summarize changes and include a checklist (see below).

---

## Files to (Create|Update)

**`LICENSE`** (canonical Apache-2.0 text)  
> Insert the full, unmodified text of the Apache License, Version 2.0 (January 2004).  
> Ensure the appendix “How to apply the Apache License to your work” remains intact.

**`NOTICE`**
```text
Narravo
Copyright (c) 2025 Steven Hildreth and Narravo contributors

This product includes software developed by the Narravo project.
```

**`CONTRIBUTING.md`**  
> Use the exact content from step 4 (you may add repo-specific details).

**`README.md`** (diff-style guidance)
- Add badge near the top:
  ```md
  [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
  ```
- Replace any “MIT” mentions with:
  ```md
  Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
  ```

**SPDX headers across source files**  
> Insert `SPDX-License-Identifier: Apache-2.0` using correct comment syntax.

---

## Validation Checklist (have the agent assert all are true)

- [ ] `LICENSE` exists and contains **canonical** Apache-2.0 text.  
- [ ] `NOTICE` exists and includes project + year + owner string shown above.  
- [ ] `README.md` shows an Apache-2.0 badge and correct license text.  
- [ ] `CONTRIBUTING.md` exists and documents DCO with `git commit -s`.  
- [ ] `package.json` (if present) has `"license": "Apache-2.0"`.  
- [ ] **All applicable source files** include an SPDX identifier, respecting shebangs and comment syntax.  
- [ ] No JSON/lock or comment-less formats were modified to include comments.  
- [ ] CI/lint passes.  
- [ ] PR created from `chore/relicense-apache-2.0` with a clear summary.

---

## (Optional) Auto-fix script idea
If you choose to add a helper script (Node/TS) to insert SPDX headers, it should:
1. Walk the repo excluding `.git`, `node_modules`, build/output dirs.
2. Detect comment style by extension.
3. Skip files already containing `SPDX-License-Identifier`.
4. Insert the header after a shebang if present.

---

## Output
- A single PR containing the changes above, passing CI, ready to merge.
