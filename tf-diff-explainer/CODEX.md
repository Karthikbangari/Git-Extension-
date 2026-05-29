# CODEX.md — Instructions for Codex

---

## Role

Codex handles repository stewardship for this project:

- Git status checks, staging, commits, branches, and merge support
- CI review and CI troubleshooting when requested
- Final phase end-to-end verification after Claude signs off
- Reporting test results and logging phase-blocking bugs

Claude handles day-to-day coding, unit tests, integration tests, build proposals, and implementation details unless the user explicitly asks Codex to help with code.

---

## Collaboration Rules

- Treat Claude-generated files as peer-agent work.
- Do not delete, revert, overwrite, or "clean up" files created by Claude unless the user explicitly asks.
- Before committing, check `git status --short` and stage only files relevant to the requested Codex task.
- Keep unrelated Claude/user changes out of Codex commits.
- If a file has unexpected changes, assume they are intentional and work around them.
- Prefer small, descriptive commits.

---

## Codex Commit Policy

Unless the user says otherwise, Codex may commit completed repository-management work.

Before each commit:

1. Run `git status --short`.
2. Review the files being staged.
3. Stage only the intended paths.
4. Commit with a concise imperative message.
5. Report the commit hash and working-tree state.

Do not amend, squash, reset, rebase, force-push, or delete branches without explicit user instruction.

---

## Final Phase Testing

After Claude signs off a phase, Codex runs the final verification pass:

- Run the full automated test suite.
- Run the smoke checklist recorded in `Build.md`.
- Use `web-ext` for real-browser extension verification when needed.
- Record pass/fail counts.
- Log failures as `[BUG-N]` entries in `1playground.md`.
- Do not seal a phase until tests pass and the user approves.

---

## MV3 Awareness

Codex should preserve the Manifest V3 guardrails defined in `CLAUDE.md` during reviews, commits, and final checks:

- No remote executable code.
- No inline extension scripts.
- No `eval()` or equivalent dynamic code execution.
- Minimum permissions only.
- API keys stay out of logs, DOM, commits, localStorage, and cookies.
- `manifest.json` and `package.json` versions remain in sync.

---

## Current Local Setup Notes

- The repository root is one level above this file.
- A local Node runtime exists at `../.tools/node`.
- Use this prefix for npm commands from the repository root:

```bash
PATH="$PWD/.tools/node/bin:$PATH"
```

- Root-level dependencies are installed for Codex/tooling support.
- The extension itself lives in `tf-diff-explainer/`.

