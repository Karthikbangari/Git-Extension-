# CLAUDE.md — Instructions for Claude

---

## ⚠️ TOP PRIORITY — Read Before Every Task

**MV3 compliance and security standards in this file override everything else.**
Check the relevant section before writing any code, posting any proposal, or making any fix.
A build that violates MV3 policy will be rejected by Chrome Web Store and rebuilt from scratch.
No exceptions.

---

## Session Handoff — Read This First

> New Claude session? Start here. Every other section is reference.

| Field                  | Value                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| Last active session    | 2026-05-30                                                            |
| Active phase           | Phase 4 — Polish + ship                                               |
| Phase 1 status         | Sealed ✅ (2026-05-30)                                                |
| Phase 2 status         | Sealed ✅ (2026-06-02)                                                |
| Phase 3 status         | Sealed ✅ (2026-05-29)                                                |
| Waiting on             | Codex/Gemini E2E + live BUG-11 verify → Phase 4 seal → CWS submission |
| Last build             | BP-010 ✅ — version 1.0.0, manifest hardening, store assets           |
| Next action for Claude | Seal Phase 4 after Codex/Gemini E2E confirms clean                    |
| Open bugs              | BUG-11 fixed (needs live verification) — see note below               |
| Blocked                | No                                                                    |
| Last clean check       | build ✅ · lint ✅ · format ✅ · tests 100/100 ✅                     |

### What was built and confirmed

- BP-001: Full Phase 1 scaffold (manifest, sidebar, popup, page detection, CI)
- BP-002: Vite build pipeline, TypeScript conversion, single root `package.json`, icon generation, Vitest tests
- BUG-1/2/3 fixes: ESLint Node globals, Prettier, innerHTML → DOM construction
- BP-003: Local risk classifier (IAM wildcard, open SG, force_destroy, destructive actions) + hunk parser. 46 tests.
- BP-004: Dependency minimap — `refParser.ts` (word-boundary regex reference detection), SVG renderer (2-col layout, risk-coloured nodes, arrowhead edges). 57 tests.
- BP-005: Session cache (`chrome.storage.session`, URL-keyed), cache-first `runAnalysis`, hover relationship highlighting (AbortController delegation, CSS dimming). 62 tests.
- BP-006: AI Change Summary — `aiSummary.ts` (prompt builder, SHA-256 hash, background-proxied fetch), `background/index.ts` (FETCH_AI_SUMMARY handler fetches `claude-haiku-4-5-20251001`), AI local cache (`chrome.storage.local`, hash-keyed), `updateAISummary` (5 states), AI section CSS, manifest CSP. 80 tests.
- BP-007: PR Description + Rollback Checklist — `AISummaryResult` extended with `prDescription`, prompt v2 (6 rollback steps + markdown PR description), `max_tokens` 768, `CACHE_VERSION` v2, shape validation, interactive rollback checklist (`<ol>` with checkboxes), PR Description section with Copy button (`navigator.clipboard`). 84 tests.
- BP-008: Onboarding — install badge `'!'` on extension icon; popup welcome banner (2-step guide + `console.anthropic.com` link) shown when no key set; badge clears + banner hides on key save; sidebar no-key CTA improved to blue action text. 84 tests (unchanged).
- BP-009: Enterprise org policy — `managed_schema.json` (Chrome policy schema for IT admins); `getApiKey` + `isEnabledForHost` check `chrome.storage.managed` first (Managed → Local fallback); new `isManagedApiKey()` + `isManagedDisabledHosts()`; popup disables API key + site toggle when org policy active. 97 tests (+13 managed storage tests).
- Bug batch (BUG-6/7/9/10/11 + hash redaction): generation counter in `runAnalysis` (BUG-6); `response.content[0]?.text` guard (BUG-7); empty-changes guard before AI path (BUG-9); `.filter(a => !a.isSensitive)` in `buildPrompt` (BUG-10); `scrapeGitHub()` four-level fallback chain including `.file-header a[title]` (BUG-11); `generateDiffHash` redacts sensitive attr values with `<sensitive>`. 100 tests.
- BP-010: Version bumped to `1.0.0`, `manifest.json` gains `homepage_url` + `minimum_chrome_version: "120"`, `store/privacy-policy.md` + `store/listing.md` created for CWS dashboard.

### BUG-11 status — needs live verification

`scrapeGitHub()` now uses a four-level fallback chain:

1. `data-path` on `.file` container
2. `[data-path]` on any nested element (older GitHub)
3. `.file-header a[title]` → `title` attribute (modern GitHub; stable across redesigns)
4. `.file-header .Truncate-text` → `textContent`

Live testing needed to confirm. If still broken, run in the browser console on a GitHub PR `/files` page and paste output:

```js
Array.from(document.querySelector('.file').attributes).map((a) => a.name + '=' + a.value);
document.querySelector('.file-header')?.outerHTML.slice(0, 400);
```

- Git + GitHub: repo at https://github.com/Karthikbangari/Terraf, SSH key configured (port 443), all commits pushed.
- Codex is currently **out of commission** — Claude is handling git commits and pushes this session.

### Confirmed decisions (do not re-litigate)

- **TypeScript** — all source files are `.ts`
- **Single root `package.json`** at `/Terraf/` — no inner `package.json`
- **Vite now** — three separate single-entry configs (Vite 8 prohibits IIFE + multiple entries)
- **Gemini + Codex** both run final phase E2E tests — not Codex alone
- **Claude tests after every subphase** (task group), not just end of phase
- **CLAUDE.md is the session handoff file** — no new `.md` files for this purpose

### Known gotchas (discovered during BP-002)

- **Vite 8 IIFE limitation:** `lib` mode with multiple entries + IIFE format is blocked. Must use one Vite config per entry point.
- **Vitest root:** `vitest.config.ts` must set `root: __dirname` explicitly, otherwise it resolves test paths from `/Terraf/` not `tf-diff-explainer/`.
- **Vite lib mode + publicDir:** `publicDir` is silently disabled in lib mode. Static assets are copied via a `closeBundle()` plugin using `cpSync`.
- **Node path in terminal:** Always prefix npm commands from `/Terraf/` with `PATH="$PWD/.tools/node/bin:$PATH"` — Codex set up a local Node 22 runtime there.

### Key file locations

| Purpose                                   | File                                |
| ----------------------------------------- | ----------------------------------- |
| Build proposals + reviewer sign-off       | `Build.md` → Active Proposal        |
| Agent coordination (Claude ↔ Codex)       | `1playground.md` → Coordination Log |
| Progress tracking + bugs                  | `1playground.md`                    |
| Phase tracker (source of truth for tasks) | `tf_diff_explainer_tracker.xlsx`    |

---

## Role

Claude handles all **coding, unit tests, and integration tests**.
Codex handles **git, branches, CI execution, and runs the final E2E test suite with Gemini after each phase**.
Neither acts outside its lane without explicit user instruction.

---

## Project Overview

**TF Diff Explainer** — Chrome extension (MV3) that injects a sidebar into GitHub PR and GitLab MR pages when Terraform (`.tf`) files appear in the diff.

| Phase             | Weeks | Hours | Key deliverable                                             |
| ----------------- | ----- | ----- | ----------------------------------------------------------- |
| 1 — Foundation    | 1–2   | ~20   | ✅ Loadable extension, sidebar shell, popup, page detection |
| 2 — Core engine   | 3–5   | ~35   | Local risk classifier, dependency minimap, no API calls     |
| 3 — AI layer      | 6–8   | ~30   | Claude API: summary, PR description, rollback checklist     |
| 4 — Polish + ship | 9–11  | ~25   | Org policy, onboarding, Chrome Web Store                    |

---

## Toolchain Reference

All commands run from `/Terraf/` with `PATH="$PWD/.tools/node/bin:$PATH"`.

| Command             | What it does                                                                        |
| ------------------- | ----------------------------------------------------------------------------------- |
| `npm run build:ext` | Icons → content bundle → background bundle → popup bundle → copies public/ to dist/ |
| `npm run test:ext`  | Runs Vitest against `tf-diff-explainer/tests/**/*.test.ts`                          |
| `npm run dev:ext`   | Loads `tf-diff-explainer/dist/` in Chrome via web-ext                               |
| `npm run lint`      | ESLint v10 flat config (JS files only; TS lint added Phase 2+)                      |
| `npm run format`    | Prettier across project                                                             |

### Build pipeline (three sequential Vite calls)

```
vite.scripts.config.ts    → src/content/index.ts    → dist/content.js    (IIFE)
vite.background.config.ts → src/background/index.ts → dist/background.js (IIFE)
vite.config.ts            → src/popup/popup.ts      → dist/popup/popup.js (IIFE)
                          + cpSync public/ → dist/   (manifest, icons, popup.html/css)
```

### dist/ layout (what Chrome loads)

```
tf-diff-explainer/dist/
├── manifest.json
├── content.js
├── background.js
├── sidebar.css
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── popup/
    ├── popup.html
    ├── popup.js
    └── popup.css
```

---

## MV3 Policy Standards

### 1. No Remote Code — Ever

- All JS must be bundled locally. No `eval()`, `new Function()`, `setTimeout("string")`.
- No loading scripts from external URLs at runtime.
- Dynamic `import()` not supported in service workers.

### 2. Content Security Policy

- Extension pages: `script-src 'self'; object-src 'self'` — no `unsafe-eval`, no `unsafe-inline`
- No inline `<script>` blocks in HTML — all JS referenced by `src` attribute
- Before Phase 3: add `connect-src https://api.anthropic.com` to manifest CSP block

### 3. Service Worker Rules

- **Can be terminated at any time** — never store state in memory, always use `chrome.storage`
- **No DOM access** — use Offscreen Document if DOM is ever needed from background
- **No XMLHttpRequest** — use `fetch()` only
- Declared in manifest under `"background": { "service_worker": "..." }` — not programmatically

### 4. Content Script Rules

- Runs in an **isolated world** — cannot access host page JS or other extensions
- Direct Chrome API access: `chrome.storage`, `chrome.runtime` (limited), `chrome.i18n`, `chrome.dom` only
- All other Chrome APIs → message passing to background service worker
- **Never inject `<script>` tags into host page DOM**
- Entry point (`src/content/index.ts`) is wrapped in `try/catch` — errors must not surface to host page
- Bundler (Vite) produces a single IIFE — proper TS `import`/`export` is fine in source

### 5. Permissions

- Minimum required only — justify any new permission in the `Build.md` proposal
- `host_permissions` and `permissions` are separate in MV3
- Sensitive permissions (`"tabs"`, `"history"`) require user sign-off

### 6. Storage

- `chrome.storage.local` for persistence (API key, disabled hosts)
- `chrome.storage.session` for ephemeral tab-scoped state (Phase 3+)
- API keys never in `localStorage`, cookies, or DOM

### 7. External API Calls (Phase 3+)

- Calls to `api.anthropic.com` from content script via `fetch()` — key read from storage at call time
- Implement: rate limiting, error states (auth failure, timeout, rate limit), response cache per diff hash
- Token budget: keep prompts under 2k tokens

### 8. Web Accessible Resources

- Declare in manifest under `"web_accessible_resources"` anything a content script references as a URL
- Scope to specific host matches — never use `"<all_urls>"`

---

## Build Workflow

1. Claude writes `BP-NNN` in **Active Proposal** in `Build.md`
2. User, Codex, Gemini review — fill in review table rows
3. User types **"go"** → Claude builds exactly as proposed, no scope additions
4. Claude logs outcome, moves proposal to Build History
5. Claude updates `1playground.md` checklist and `CLAUDE.md` Session Handoff

### Every proposal must include

- Full file list (create / modify / delete / move)
- Approach (decisions, trade-offs)
- Explicit MV3 compliance check
- Risk level + notes
- Any new permissions and justification

---

## Testing Methodology

### Who runs what

| Test type            | Run by             | When                                            |
| -------------------- | ------------------ | ----------------------------------------------- |
| Unit tests           | Claude             | After **every subphase** (task group)           |
| Integration tests    | Claude             | After all subphases in a phase are done         |
| Final E2E test suite | **Codex + Gemini** | After Claude signs off — before phase is sealed |

### Unit Tests

- **Scope:** Pure logic — URL matchers, risk rules, storage helpers, prompt builders
- **Runner:** `npm run test:ext` (Vitest, `tf-diff-explainer/vitest.config.ts`)
- **Location:** `tf-diff-explainer/tests/*.test.ts`
- **Standard:** passing case + failing case + edge case for every rule/regex/scorer
- Must pass before integration tests run

### Integration Tests

- **Scope:** Chrome API interactions — storage R/W, message passing, sidebar DOM inject/remove
- **Runner:** Vitest with a `chrome` global mock (mock layer added Phase 2)
- **Location:** `tf-diff-explainer/tests/integration/`
- One test per user-facing feature

### Smoke Test Checklist

Claude writes a numbered checklist in `Build.md` before handing to Codex. Codex + Gemini run it against a real Chrome load of `dist/`.

### Bug Handling

- Format: `[BUG-N] Description — found by <Claude/Codex/Gemini/User> — Phase N — status: open/fixed`
- Log in `1playground.md` → Open Bugs
- Fix before moving to next phase unless user deprioritises
- Never delete bug entries — mark `status: fixed` with a change note

### Test naming

```
[module].[scenario].[expectedOutcome]
e.g. pageDetector.githubPR.matchesCorrectly
     riskClassifier.iamInlinePolicy.scoresHigh
```

---

## Code Standards

- No comments unless the WHY is non-obvious (hidden constraint, Chrome bug workaround)
- No abstractions ahead of need — build only what the current phase task requires
- No error handling for impossible cases — validate at real boundaries only
- No `console.log` in shipped code — `console.warn`/`console.error` for real errors only
- Dark mode required on all injected UI (`prefers-color-scheme: dark`)
- Accessibility required — `aria-label` on every interactive element
- API keys never logged, never in DOM, never in message payloads
- `package.json` version and `manifest.json` version must always match

---

## What Claude Owns

| Owns                                  | Does not own                        |
| ------------------------------------- | ----------------------------------- |
| All `src/**/*.ts`                     | Git commits / branches / merging    |
| All `tests/**`                        | CI pipeline execution               |
| Vite configs, tsconfig, vitest config | Final E2E test run (Codex + Gemini) |
| `public/manifest.json`                | Chrome Web Store submission         |
| `Build.md` proposals                  | `CLAUDE.md` annotations (user)      |
| `1playground.md` progress updates     |                                     |
| Smoke test checklists                 |                                     |

---

## File Map (current — post BP-002)

```
/Terraf/                                ← repo root
├── package.json                        ← single root package.json (v0.1.0)
├── package-lock.json
├── eslint.config.mjs                   ← ESLint v10 flat config
├── .prettierrc
├── .gitignore
├── .tools/node/                        ← local Node 22 runtime (Codex-managed)
└── tf-diff-explainer/                  ← extension root
    ├── CLAUDE.md                       ← you are here (session handoff)
    ├── CODEX.md                        ← Codex instructions
    ├── 1playground.md                  ← coordination log + progress + bugs
    ├── Build.md                        ← build proposals + reviewer table
    ├── HANDOFF.md                      ← one-time alignment doc (resolved, ignore)
    ├── tsconfig.json                   ← TS: ES2022, bundler moduleResolution, @types/chrome
    ├── vitest.config.ts                ← root: __dirname, include: tests/**/*.test.ts
    ├── vite.config.ts                  ← popup bundle + cpSync public/ → dist/
    ├── vite.scripts.config.ts          ← content bundle (IIFE, single entry)
    ├── vite.background.config.ts       ← background bundle (IIFE, single entry)
    ├── .github/workflows/ci.yml        ← lint + format + test on push/PR
    ├── public/                         ← static assets (copied to dist/ by vite.config.ts)
    │   ├── manifest.json               ← dist-relative paths, no "type":"module" on bg
    │   ├── icons/
    │   │   ├── icon16.png              ← generated by scripts/generate-icons.js
    │   │   ├── icon48.png
    │   │   └── icon128.png
    │   └── popup/
    │       ├── popup.html              ← references ./popup.js (built by Vite)
    │       └── popup.css
    ├── src/
    │   ├── background/index.ts         ← service worker: sets storage on install
    │   ├── utils/storage.ts            ← getApiKey, isEnabledForHost, toggleHost
    │   ├── content/
    │   │   ├── index.ts                ← orchestrator, try/catch boundary
    │   │   ├── pageDetector.ts         ← URL matchers, hasTerraformDiff, MutationObserver
    │   │   └── sidebar/
    │   │       ├── index.ts            ← injectSidebar, removeSidebar, collapse toggle
    │   │       └── sidebar.css         ← fixed position, skeleton shimmer, dark mode
    │   └── popup/
    │       └── popup.ts               ← API key validation, per-site toggle
    ├── scripts/
    │   └── generate-icons.js          ← Node: writes valid 16/48/128px PNGs via raw PNG spec
    ├── tests/
    │   ├── pageDetector.test.ts        ← 9 Vitest tests for URL matchers ✅
    │   └── integration/               ← added Phase 2+
    └── dist/                           ← built output (web-ext loads this)
        ├── manifest.json
        ├── content.js   (1.94kB)
        ├── background.js (0.15kB)
        ├── sidebar.css
        ├── icons/
        └── popup/
            ├── popup.html
            ├── popup.js  (1.19kB)
            └── popup.css
```

---

## Safeguards Checklist (run before every proposal)

- [ ] Every `chrome.*` API called is declared in `public/manifest.json` permissions
- [ ] No new packages added without listing them in the proposal
- [ ] `public/manifest.json` version matches root `package.json` version
- [ ] Content script output will be IIFE (single-entry Vite config)
- [ ] No inline scripts in any HTML file
- [ ] API keys not touched by this build (or if they are, storage-only, never DOM)
- [ ] Phase 3 only: `connect-src https://api.anthropic.com` in manifest CSP before any fetch
