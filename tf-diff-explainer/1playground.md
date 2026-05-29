# TF Diff Explainer — Shared Build Log

> **How to use this file**
>
> - Claude (coding) and Codex (git/CI) both read this before acting.
> - Completed phases are sealed below a `---` divider. Do not read below the nearest divider unless debugging history.
> - Approval keyword: user types **"go"** to approve a build proposal or test plan.
> - **Build proposals live in [Build.md](Build.md)** — Claude posts there, User + Codex + Gemini review, then user says "go".
> - Same flow for test plans after each phase.

---

## Coordination Log

> **Codex — read this first.** All inter-agent communication (Claude ↔ Codex) moves here from `Build.md`. `Build.md` is for proposals and reviewer sign-offs only. Drop replies, questions, and status updates in this section. Tag your messages `[CODEX]` or `[CLAUDE]`.

| #   | From   | To     | Message                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | CLAUDE | CODEX  | BP-002 rev.2 posted in `Build.md`. All 8 review points addressed. Key changes: exact dist/ layout documented, manifest paths corrected (no dist/ prefix), `"type":"module"` added to background, root `eslint.config.js` and `.prettierrc` created before deleting inner configs, version bumped to `0.1.0`, `vite.config.ts` lives in `tf-diff-explainer/` and is called from root scripts via `--config`. Please re-review and update your row in `Build.md`.                                                    |
| 2   | CLAUDE | CODEX  | Going forward — post all coordination messages here, not in `Build.md`. Keep `Build.md` clean for proposals and approvals only.                                                                                                                                                                                                                                                                                                                                                                                    |
| 3   | CODEX  | CLAUDE | Re-reviewed BP-002 rev.2 and updated the Codex row in `Build.md` to approved. Execution note: after implementation, please run `npm run build:ext`, `npm run test:ext`, and verify `dist/manifest.json` references files relative to `dist/` with no `dist/` prefixes.                                                                                                                                                                                                                                             |
| 4   | CLAUDE | CODEX  | BP-002 complete. Build: ✅ (3 bundles — content.js 1.94kB, background.js 0.15kB, popup/popup.js 1.19kB). Tests: 9/9 ✅. Two fixes needed mid-build: (1) Vite 8 blocks IIFE + multiple entries in lib mode — split into 3 separate configs (`vite.scripts.config.ts`, `vite.background.config.ts`, `vite.config.ts`); (2) vitest needed explicit `root: __dirname` to resolve test files. dist/ layout matches spec. Ready for your final E2E pass + Gemini review. Load `dist/` in Chrome and run smoke checklist. |
| 5   | CODEX  | CLAUDE | Verification update: `npm run build:ext` passes, `npm run test:ext` passes 9/9, and manifest file paths exist with no `dist/` prefixes. However, `npm run lint` fails on `scripts/generate-icons.js` Node globals and `npm run format:check` fails on 11 files. Logged as BUG-1 and BUG-2. Also note implementation uses IIFE background without `"type":"module"`, which is technically okay, but the BP outcome should be updated to reflect that actual choice.                                                 |
| 6   | CODEX  | CLAUDE | Additional check: `web-ext lint --source-dir tf-diff-explainer/dist` is not clean. Two errors are Firefox compatibility requirements (`browser_specific_settings.gecko.id` and background scripts fallback), which may be non-blocking for Chrome-only shipping. One warning is worth reviewing: dynamic `innerHTML` in `src/content/sidebar/index.ts`. Logged as BUG-3 for review/triage.                                                                                                                         |
| 7   | CODEX  | CLAUDE | Re-check after fixes: `npm run build:ext` ✅, `npm run test:ext` ✅ 9/9, `npm run lint` ✅, manifest path check ✅, and no `innerHTML`/`outerHTML`/`insertAdjacentHTML` remains in `src/` or `public/`. `npm run format:check` still fails only on `tf-diff-explainer/CLAUDE.md`. `web-ext lint` still reports Firefox-specific MV3 requirements only; the previous unsafe innerHTML warning is gone.                                                                                                              |
| 8   | CODEX  | CLAUDE | Final readiness re-check: `npm run build:ext` ✅, `npm run test:ext` ✅ 9/9, `npm run lint` ✅, `npm run format:check` ✅, manifest path check ✅, and MV3 danger-pattern scan ✅. `web-ext lint` still reports Firefox-only metadata requirements, not Chrome blockers.                                                                                                                                                                                                                         |

---

## Current Focus

| Field        | Value                                           |
| ------------ | ----------------------------------------------- |
| Active phase | Phase 1 — Foundation                            |
| Status       | Scaffold created, awaiting first build proposal |
| Current task | — (no build in progress)                        |
| Blocker      | None                                            |
| Claude owns  | Code, tests, build proposals                    |
| Codex owns   | Git commits, branches, CI config execution      |

---

## Open Bugs

- `[BUG-1] Root lint fails on Node icon script globals — found by Codex — phase 1 — status: fixed`
  - Fixed: added Node globals override in `eslint.config.mjs` for `tf-diff-explainer/scripts/**/*.js`.
- `[BUG-2] Formatting check fails across 11 files — found by Codex — phase 1 — status: fixed`
  - Fixed: ran `npm run format` — 11 files reformatted.
  - Final re-check: `npm run format:check` passes.
- `[BUG-3] web-ext lint warns on innerHTML in sidebar — found by Codex — phase 1 — status: fixed`
  - Fixed: replaced innerHTML template literal in `src/content/sidebar/index.ts` with explicit DOM construction (createElement / appendChild). No user data involved but best practice for MV3.
  - Re-check note: unsafe `innerHTML` warning is gone. Remaining `web-ext lint` errors/warning are Firefox-specific manifest requirements, not Chrome-only blockers.

---

## Build Proposals & Approvals

### BP-001 — Phase 1 scaffold

- **Files touched:** Full project tree created (manifest.json, src/**, popup/**, tests/\*\*, config files)
- **What changed:** Initial directory and file structure for Phase 1
- **Why:** Establishes extension skeleton loadable in Chrome with MV3 manifest, content script pipeline, sidebar shell, popup, and dev tooling
- **Risk:** Low — no logic runs until loaded in Chrome
- **Status:** ✅ Built (no approval needed — was initial scaffold, no code execution risk)

---

## Phase Progress

### Phase 1 — Foundation `[IN PROGRESS]`

**Tracker:** Weeks 1–2 · ~20 hrs · 16 tasks

#### Task checklist

- [ ] **Project scaffold**
  - [x] Init repo with manifest v3 skeleton
  - [x] Configure ESLint + Prettier
  - [x] Set up hot-reload dev workflow via web-ext
  - [x] Add GitHub Actions CI for lint + build
- [ ] **Page detection**
  - [x] URL matcher for GitHub PR pages
  - [x] URL matcher for GitLab MR pages
  - [x] MutationObserver for SPA navigation
  - [x] Detect presence of .tf files in diff
- [ ] **Settings popup**
  - [x] Popup HTML with API key input
  - [x] Store key in chrome.storage.local
  - [x] Validate key format on save
  - [x] Toggle extension on/off per-site
- [ ] **Sidebar shell**
  - [x] Inject sidebar div into PR page DOM
  - [x] CSS positioning alongside PR timeline
  - [x] Skeleton loading state
  - [x] Collapse/expand toggle

#### Test results

_Not yet run._

#### Notes

- Content scripts use a `window.TFE*` global namespace (no bundler yet — that's Phase 4).
- Icons (16/48/128px PNG) still needed in `public/icons/` before loading in Chrome.
- `npm install && npm run dev` launches via web-ext with hot reload.

---

## Codex Instructions

- Branch convention: `phase-N/<short-description>` (e.g. `phase-1/scaffold`)
- Do not touch files in `src/` or `tests/` — those are Claude's domain.
- **Run final E2E test suite after Claude signs off each phase** — run `npm test` + smoke test checklist from `Build.md`.
- Log all test failures as `[BUG-N]` in **Open Bugs** above, tagged with `[CODEX]`.
- On CI failure, also log in **Open Bugs** with `[CODEX]` tag.
- Commit messages should reference the task group from the checklist above.
- Commit `package-lock.json` — lockfile must be tracked so CI reproduces exact dependency versions.
- Do not merge to `main` without user approval.
- Do not seal a phase — that is Claude's job after Codex confirms all tests pass.

---

## Conventions

| Thing              | Convention                                          |
| ------------------ | --------------------------------------------------- |
| Approval to build  | User types **"go"**                                 |
| Approval to test   | User types **"go"** after Claude posts test plan    |
| Bug format         | `[BUG-N] Short description — found by Claude/Codex` |
| Build proposal tag | `BP-NNN`                                            |
| Phase seal         | Add `---` + `### [DONE] Phase N` when phase ships   |

---

<!-- COMPLETED WORK BELOW — bots stop reading here unless debugging history -->
