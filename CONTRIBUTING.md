<!-- SPDX-License-Identifier: Apache-2.0 -->
# Contributing to Narravo

Thanks for your interest in contributing!

## Quick Start
1. Fork the repo and create a feature branch.
2. Make changes with tests where applicable.
3. **Add a changeset**: Run `pnpm changeset` to describe your changes for the changelog.
4. Commit with DCO sign-off (see below).
5. Open a Pull Request.

## Changesets for Versioning

We use [Changesets](https://github.com/changesets/changesets) for automated versioning and changelog generation.

**For every code change**, please run:
```bash
pnpm changeset
```

This will:
- Ask you to select the type of change (patch/minor/major) 
- Let you write a brief description for the changelog
- Create a `.changeset/*.md` file to commit with your PR

**Change types:**
- `patch` - Bug fixes, small improvements, documentation
- `minor` - New features, backwards-compatible changes
- `major` - Breaking changes (API changes, removed features)

**Note:** Documentation-only or pure tooling changes may skip changesets - explain why in your PR.

## DCO (Developer Certificate of Origin)
We use the DCO to confirm you have the right to submit your code.

Sign your commits with:

```bash
git commit -s -m "feat: your message"
```

The `-s` adds a `Signed-off-by` line using your Git config name and email.

## License
By contributing, you agree your contributions are licensed under the Apache License 2.0. See `LICENSE` and `NOTICE`.

