# CODEX.md — Instructions for Codex

---

## Role

Codex handles repository stewardship for this project:

- Git status checks, staging, commits, branches, and merge support
- CI review and CI troubleshooting when requested
- Final phase end-to-end verification after Claude signs off
- Reporting test results and logging phase-blocking bugs

Claude handles day-to-day coding, unit tests, integration tests, build proposals, and implementation details.

The user has also authorized Codex to write code when asked or when it is the most direct way to complete an assigned task. When Codex writes code, keep changes scoped, preserve Manifest V3 compliance, and avoid colliding with Claude's active work.

---

## Collaboration Rules

- Treat Claude-generated files as peer-agent work.
- Do not delete, revert, overwrite, or "clean up" files created by Claude unless the user explicitly asks.
- Read `CLAUDE.md`, `Build.md`, `1playground.md`, and this file before phase work, build review, testing, or commits.
- Check `HANDOFF.md` when present for current alignment decisions or blockers.
- After every Codex review, test pass, code/doc change, blocker, or approval decision, add or update a `[CODEX]` coordination entry in `1playground.md` in the same turn.
- If Codex changes the repository workflow, ownership rules, active blockers, or verification status, update this file and the current-focus/bug sections in `1playground.md` before reporting back.
- Build agents must keep each other current through `1playground.md`; do not leave review conclusions only in chat.
- Before committing, check `git status --short` and stage only files relevant to the requested Codex task.
- Keep unrelated Claude/user changes out of Codex commits.
- If a file has unexpected changes, assume they are intentional and work around them.
- Prefer small, descriptive commits.

---

## Build Review Workflow

- Build proposals live in `Build.md` as `BP-NNN` blocks.
- Codex fills in the `Codex` row in the proposal review table before Claude builds.
- Gemini is a third reviewer. Do not proceed if the `Gemini` review row is empty unless the user explicitly overrides that requirement.
- The approval keyword is `go`. A user message containing `go` approves the reviewed build proposal or test plan for execution.
- Claude executes approved build proposals unless the user explicitly assigns implementation to Codex.
- Codex should flag security, MV3 compliance, missing tests, scope creep, and CI/release risks during review.

---

## Branch Policy

- Use branch names in the format `phase-N/<short-description>`, for example `phase-1/scaffold`.
- Do not merge to `main` without user approval.
- Do not rebase, force-push, delete branches, or rewrite history without explicit user instruction.

---

## Codex Commit Policy

Unless the user says otherwise, Codex may commit completed repository-management work.

Before each commit:

1. Run `git status --short`.
2. Review the files being staged.
3. Stage only the intended paths.
4. Commit with a concise imperative message.
5. Report the commit hash and working-tree state.

Always commit `package-lock.json` when dependency changes affect it, so CI and other agents reproduce the same dependency tree.

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
- The sibling extension `git-file-explainer/` is active for GFE phases.
- The project uses a single root `package.json` at `/Terraf/package.json`; there is no inner extension package file.

## Current Codex Handoff

- 2026-05-31: BP-015 was locally stabilized after partial cross-agent edits and committed as `e5ec584`. GFE checks: build ✅, tests 73/73 ✅, lint ✅, format ✅, unsafe HTML scan ✅, apiKey payload scan ✅. TFE regression tests: 129/129 ✅.
- `web-ext run --source-dir git-file-explainer/dist --target=chromium --start-url https://github.com/Karthikbangari/Git-Extension-/blob/main/package.json` loaded without manifest/CSS errors.
- Automated DOM smoke remains inconclusive because manual Chrome/CDP launches did not install the unpacked GFE extension, while `web-ext` uses `--remote-debugging-pipe`. Do not seal GFE Phase 3 until a manual/Gemini live DOM smoke confirms sidebar injection on GitHub and GitLab blob pages.
- 2026-05-31: GFE root-folder Chrome load support is documented in both READMEs and pushed in commit `8d70eb9`. That repository update includes the SPA navigation content-script fix, GFE store screenshot generator/assets, Gemini MV3/privacy audit log entry, and ESLint coverage for root `scripts/**/*.mjs`. Latest local checks before commit: `npm run lint` ✅, `npm run format:check` ✅, `npm run test:gfe` ✅ 79/79, `npm run build:gfe` ✅.
- 2026-05-31: GFE live test was confirmed by user screenshot after Codex fixed current GitHub blob DOM extraction; pushed in `ea1ccfb` and log commit `278689f`.
- 2026-05-31: Claude built BP-017 and GFE BP-018 through BP-022 after user "go". Codex local post-build verification: `npm run test:ext` ✅ 191/191, `npm run test:gfe` ✅ 81/81, `npm run build:ext` ✅, `npm run build:gfe` ✅, `npm run lint` ✅, `npm run format:check` ✅. Codex `Build.md` review rows are updated; build commit `dbc7a9a` is pushed. Live TFE 5-step PR smoke remains the main residual check.
- 2026-05-31: Live smoke tests completed post-push. TFE `tf-diff-explainer/dist` passed all 5 steps on `terraform-aws-modules/terraform-aws-lambda/pull/577/files` via web-ext Chromium. GFE `git-file-explainer/dist` passed sidebar/no-key smoke on `Karthikbangari/Git-Extension-/blob/main/package.json`.
- 2026-05-31: Added repo-level Playwright verifier `npm run verify:extensions` with screenshot output in `verify-shots/`, pushed in `04e61a6`. Latest verifier run: 12 pass, 0 fail, 1 expected warning for GitHub `.png` image preview not rendering a blob-code sidebar target. Latest re-checks: lint ✅, format ✅, TFE 191/191 ✅, GFE 81/81 ✅, TFE build ✅, GFE build ✅.
- 2026-05-31: README refresh pushed in `d458747`: root README now documents TFE 5-step flow, current test counts, and `verify:extensions`; GFE README now documents BP-018..BP-022 polish features and current GitHub DOM fallbacks. BP-023 is not approved as written until it avoids broad `"tabs"` permission/content-script `chrome.tabs.create`.
- 2026-05-31: Project direction changed per user/Claude: GFE is the sole primary extension going forward; TFE is archived/background and should not receive new feature work. BP-023 verified locally and pushed in `e0bc5ef`: GFE 90/90 ✅, TFE 191/191 ✅, GFE build ✅, TFE build ✅, lint ✅, format ✅. Implementation uses fixed-url `window.open('https://claude.ai', '_blank', 'noopener')` and adds no `"tabs"` permission.
- 2026-05-31: Added GFE supported-file-type regression coverage for all 22 user-listed extensions (`.tf`, `.ts`, `.js`, `.py`, `.go`, `.java`, `.rb`, `.cs`, `.cpp`, `.c`, `.tsx`, `.jsx`, `.php`, `.json`, `.yaml`, `.yml`, `.xml`, `.sql`, `.html`, `.css`, `.scss`, `.md`). Verification: `npm run test:gfe` ✅ 112/112, targeted verbose extractor run ✅ 43/43, `npm run build:gfe` ✅, `npm run format:check` ✅.
- 2026-05-31: Added `npm run smoke:gfe:filetypes` and committed realtime screenshot evidence under `git-file-explainer/realtime-screenshots/supported-file-types/`. Live Chrome/Playwright pass opened all 22 GitHub sample blob URLs with GFE loaded: 22 pass, 0 warn, 0 fail. Fixed Markdown preview blobs by running the raw fallback after selector timeout and allowing `https://raw.githubusercontent.com` in extension CSP. Verification: `npm run test:gfe` ✅ 113/113, `npm run build:gfe` ✅, `npm run format:check` ✅.
