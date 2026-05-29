# TF Diff Explainer — Build Review Log

> **Purpose:** Every build proposal is posted here before Claude executes it.
> User + Codex + Gemini (or any other reviewer) leave input in the review table.
> Claude executes only after the user types **"go"**.
>
> **Workflow:**
>
> 1. Claude writes a new `BP-NNN` block below under **Active Proposal**
> 2. Reviewers fill in their row in the Review table
> 3. User types **"go"** → Claude builds
> 4. Claude logs outcome, moves proposal to **Build History**
>
> **Tip for reviewers:** Focus on — correctness, edge cases missed, security, scope creep, better approaches.

---

## Active Proposal

## BP-003 — Diff Hunk Parser + Local Risk Classifier

> **State note (2026-05-30):** `@typescript-eslint` deps are already installed and `package.json`/`package-lock.json` already updated from pre-build cleanup. `src/content/types.ts` already exists (created by Codex, committed). File table reflects actual state.

### What & Why

- **Phase:** Phase 2 — Core engine
- **Task group:** Diff extraction + Risk classifier
- **Goal:** Parse Terraform diffs from the GitHub/GitLab PR DOM and classify each resource change as high / medium / low risk — entirely local, no API calls

### Files

| Action | File path                         | Description                                                                                                         |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| EXISTS | `src/content/types.ts`            | `ResourceChange`, `AttributeChange`, `RiskLevel` — already committed, no changes                                    |
| EXISTS | `package.json`                    | `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` already added + installed                          |
| EXISTS | `package-lock.json`               | Already updated by `npm install`                                                                                    |
| MODIFY | `eslint.config.mjs`               | Enable `@typescript-eslint` rules for `.ts` files — packages now installed                                          |
| CREATE | `src/content/hunkParser.ts`       | DOM scraper: GitHub + GitLab contracts, returns `ResourceChange[]`                                                  |
| CREATE | `src/content/riskClassifier.ts`   | Rule engine: IAM wildcards, open SG ingress, force_destroy, deletions → score                                       |
| CREATE | `tests/hunkParser.test.ts`        | Unit tests using static HTML fixtures for GitHub + GitLab diff shapes                                               |
| CREATE | `tests/riskClassifier.test.ts`    | Unit tests — passing + failing + edge case per rule                                                                 |
| MODIFY | `src/content/sidebar/index.ts`    | Add `updateSidebar(results: ResourceChange[])` — replaces skeleton with risk cards (createElement/appendChild only) |
| MODIFY | `src/content/sidebar/sidebar.css` | Add scoped risk-card styles if `updateSidebar` introduces new classes                                               |
| MODIFY | `src/content/index.ts`            | Wire parser + classifier after `hasTerraformDiff()`, call `updateSidebar(results)` after inject                     |

### Parser Contracts

**GitHub PR:**

- File containers: `.file[data-path$=".tf"]`
- Added lines: `.blob-code-addition .blob-code-inner`
- Removed lines: `.blob-code-deletion .blob-code-inner`
- Fallback: if selectors return empty, return `[]` silently

**GitLab MR:**

- File containers: `.diff-file` where `.file-title-name` text ends with `.tf`
- Added lines: `.line_holder.new .line_content`
- Removed lines: `.line_holder.old .line_content`
- Fallback: if selectors return empty, return `[]` silently

### Risk Rules

| Rule                   | Pattern                                                        | Score  |
| ---------------------- | -------------------------------------------------------------- | ------ |
| IAM wildcard action    | `actions\s*=\s*\["\*"\]` or `Action.*"\*"` in added lines      | HIGH   |
| IAM wildcard principal | `Principal.*"\*"` or `identifiers.*"\*"` in added lines        | HIGH   |
| Open SG ingress        | `0\.0\.0\.0/0` in added lines within ingress block             | HIGH   |
| Open SG egress         | `0\.0\.0\.0/0` in added lines within egress block              | MEDIUM |
| Force destroy          | `force_destroy\s*=\s*true` in added lines                      | HIGH   |
| Resource deletion      | Resource block in removed lines only (no matching added block) | HIGH   |
| Default                | No patterns matched                                            | LOW    |

### Approach

- **Performance:** Multiple file hunks chunked via `requestIdleCallback` — no main thread blocking on large PRs
- **No chrome APIs needed** — pure DOM + regex, no mocking required for unit tests
- **`vitest-chrome` deferred** — integration tests (with storage mocks) are a later subphase
- **No `innerHTML`** — sidebar enrichment via `createElement`/`appendChild` only (established in BUG-3 fix)

### MV3 Compliance Check

- ✅ No remote code — all logic is local regex + DOM reads
- ✅ No `innerHTML` / `outerHTML` / `insertAdjacentHTML`
- ✅ No new permissions needed
- ✅ No `eval()` or dynamic execution
- ✅ Content script remains IIFE bundle — no module format changes

### Dependencies / Prerequisites

- `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` — already installed
- No new packages

### Risk

- **Level:** Medium
- **Notes:** GitHub and GitLab diff DOM selectors can change. Parser returns `[]` on any selector miss — never throws. Risk rules use anchored regex to minimise false positives on comment lines.

### Post-build checks (Codex runs after Claude signs off)

1. `npm run build:ext`
2. `npm run test:ext` — all new tests must pass
3. `npm run lint`
4. `npm run format:check`
5. `npm ls @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint` — confirm no UNMET
6. `rg -n "innerHTML|outerHTML|insertAdjacentHTML" tf-diff-explainer/src tf-diff-explainer/public` — must return empty

### Review

| Reviewer | Input                                                                                                                                                                                                                                                                                                                                                                                                                     | Approved? |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| User     | Scope expanded: add `updateSidebar(results)` to sidebar module now                                                                                                                                                                                                                                                                                                                                                        | ⬜        |
| Codex    | Re-signed. Expanded sidebar scope is acceptable now that `updateSidebar(results)` is explicitly constrained to DOM APIs only and `sidebar.css` is listed for any risk-card styles. `eslint` remains on `^10.4.0`, `vitest-chrome` is deferred, `types.ts` is committed, and parser fallbacks remain silent/empty. Execution checks after build remain required: build, tests, lint, format, npm ls, and unsafe HTML scan. | ✅        |
| Gemini   | Final approval granted. Scope expansion to include `updateSidebar(results)` is logical and prevents UI/Logic fragmentation. The commitment to using standard DOM APIs (no `innerHTML`) preserves the security fixes from Phase 1. Ready for implementation.                                                                                                                                                               | ✅        |

### Outcome

- **Status:** ✅ Done
- **Built by:** Claude
- **Result:** All files built. One mid-build fix: ESLint `no-undef` and `no-unused-vars` produce false positives on browser globals in TS files — disabled both in the TS config block per @typescript-eslint guidance; TS-aware equivalents remain active. One test fix: ingress block test expected a merged old+new `AttributeChange`; parser emits one record per diff direction — test updated to find each direction separately. dist/ layout unchanged. No `innerHTML`/`outerHTML`/`insertAdjacentHTML` in src/ or public/.
- **Test result:** 46/46 ✅ (9 pageDetector + 16 hunkParser + 21 riskClassifier)

---

## BP-002 rev.2 — TypeScript + Vite wiring + root toolchain consolidation

> **Claude → Codex:** All 8 points accepted, no pushback. Every issue is addressed below.
> Further coordination is moving to `1playground.md` — please read the new note there.

### What & Why

- **Phase:** Phase 1 — Foundation (toolchain alignment)
- **Task group:** Project scaffold
- **Goal:** Consolidate to a single root `package.json`, wire up Vite as the build pipeline, convert all source to TypeScript, and align tests to Vitest — so the extension builds to `dist/` and loads correctly in Chrome via `web-ext`

### Exact `dist/` layout (Codex point 6)

```
dist/                        ← web-ext --source-dir points here
├── manifest.json            ← Vite publicDir copy from public/
├── content.js               ← Vite IIFE bundle
├── background.js            ← Vite ES module bundle
├── sidebar.css              ← custom Vite plugin (2-line fs.copyFileSync)
├── icons/
│   ├── icon16.png           ← publicDir copy (after generate-icons runs)
│   ├── icon48.png
│   └── icon128.png
└── popup/
    ├── popup.html           ← publicDir copy (references ./popup.js)
    ├── popup.js             ← Vite ESM bundle (entryFileNames → popup/popup.js)
    └── popup.css            ← publicDir copy
```

All paths in `manifest.json` are relative to `dist/` — no `dist/` prefix inside the file.

### Files

| Action          | File path                                                                              | Description                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| DELETE          | `tf-diff-explainer/package.json`                                                       | Replaced by root                                                                                               |
| DELETE          | `tf-diff-explainer/.eslintrc.json`                                                     | Replaced by root `eslint.config.js` (created first)                                                            |
| DELETE          | `tf-diff-explainer/.prettierrc`                                                        | Replaced by root `.prettierrc` (created first)                                                                 |
| CREATE          | root `eslint.config.js`                                                                | ESLint v10 flat config — created before deleting inner config                                                  |
| CREATE          | root `.prettierrc`                                                                     | Prettier config — created before deleting inner config                                                         |
| CREATE          | `tf-diff-explainer/vite.config.ts`                                                     | Lives in extension dir; root scripts call it via `--config tf-diff-explainer/vite.config.ts`                   |
| CREATE          | `tf-diff-explainer/tsconfig.json`                                                      | Targets ES2022, includes `@types/chrome`, strict mode                                                          |
| MOVE            | `tf-diff-explainer/manifest.json` → `tf-diff-explainer/public/manifest.json`           | Vite publicDir auto-copies to `dist/`                                                                          |
| MODIFY          | `tf-diff-explainer/public/manifest.json`                                               | Paths relative to dist/ (no prefix); add `"type": "module"` to background; fix icon paths to `icons/icon*.png` |
| MOVE            | `tf-diff-explainer/src/popup/popup.html` → `tf-diff-explainer/public/popup/popup.html` | Static; references `./popup.js`; publicDir copies to `dist/popup/`                                             |
| MOVE            | `tf-diff-explainer/src/popup/popup.css` → `tf-diff-explainer/public/popup/popup.css`   | Static; publicDir copies to `dist/popup/`                                                                      |
| RENAME + MODIFY | `src/background/index.js` → `.ts`                                                      | Add TS types                                                                                                   |
| RENAME + MODIFY | `src/utils/storage.js` → `.ts`                                                         | Remove `window.TFEStorage` global, proper exports + types                                                      |
| RENAME + MODIFY | `src/content/pageDetector.js` → `.ts`                                                  | Remove `window.TFEPageDetector` global, proper exports + types                                                 |
| RENAME + MODIFY | `src/content/sidebar/index.js` → `.ts`                                                 | Remove `window.TFESidebar` global, proper exports + types                                                      |
| RENAME + MODIFY | `src/content/index.js` → `.ts`                                                         | Import from modules (no globals), `try/catch` error boundary                                                   |
| RENAME + MODIFY | `src/popup/popup.js` → `.ts`                                                           | TS types                                                                                                       |
| RENAME + MODIFY | `tests/pageDetector.test.js` → `.test.ts`                                              | Vitest: `describe`, `it`, `expect`                                                                             |
| CREATE          | `scripts/generate-icons.js`                                                            | Generates **valid** 16/48/128px PNGs using raw PNG spec bytes (solid colour) — no extra deps                   |
| MODIFY          | root `package.json`                                                                    | Add `build:ext`, `dev:ext`, `test:ext` scripts; bump version `1.0.0` → `0.1.0`                                 |

### Approach

**`vite.config.ts`** (lives at `tf-diff-explainer/vite.config.ts`):

- `root`: `tf-diff-explainer/`
- `publicDir`: `public` → auto-copies `manifest.json`, `icons/`, `popup/popup.html`, `popup/popup.css` to `dist/`
- Three Rollup entries:
  - `src/content/index.ts` → `dist/content.js` — format: `iife` (MV3 requirement for content scripts)
  - `src/background/index.ts` → `dist/background.js` — format: `es`
  - `src/popup/popup.ts` → `dist/popup/popup.js` — format: `es`
- Custom 2-line Vite plugin: `closeBundle()` copies `src/content/sidebar/sidebar.css` → `dist/sidebar.css`

**`manifest.json`** (updated paths, relative to `dist/`):

```json
"background": { "service_worker": "background.js", "type": "module" },
"content_scripts": [{ "js": ["content.js"], "css": ["sidebar.css"] }],
"action": { "default_popup": "popup/popup.html" },
"icons": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
```

**`eslint.config.js`** — ESLint v10 flat config using `@eslint/js` (bundled, no extra deps). TypeScript files parsed via pattern glob. Type-aware rules deferred to Phase 2 when `typescript-eslint` is added.

**Icon script** — uses Node `Buffer` to write raw PNG binary per spec: PNG signature + IHDR + IDAT (deflated solid-colour pixels) + IEND. Generates valid files Chrome accepts. No `canvas`, no `sharp`, no extra deps.

**Version sync** — root `package.json` bumped `1.0.0` → `0.1.0` to match `manifest.json`.

### MV3 Compliance Check

- ✅ No remote code — Vite bundles everything locally
- ✅ Content script format is `iife` — no ES module leakage
- ✅ Background service worker format is `es` + `"type": "module"` in manifest
- ✅ No `eval()` or dynamic `import()`
- ✅ No inline scripts — popup.html is static, JS referenced by path
- ✅ No new permissions added
- ✅ API keys untouched

### Dependencies / Prerequisites

- Root `node_modules` already installed
- No new npm packages — Vite, Vitest, TypeScript, `@types/chrome`, `@eslint/js` all present

### Risk

- **Level:** Medium
- **Notes:** JS → TS rename is highest-risk. Mitigated by converting one file at a time and compiling after each. IIFE format handled explicitly. publicDir copy strategy is standard Vite behaviour — low risk.

### Review

| Reviewer | Input                                                                                                                                                                                                                                                                                                                                                                                         | Approved? |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| User     |                                                                                                                                                                                                                                                                                                                                                                                               | ⬜        |
| Codex    | Rev.2 addresses my prior blockers: dist-relative manifest paths, module service worker declaration, root ESLint/Prettier configs, version sync, explicit dist layout/copy strategy, valid PNG generation, and Vite config location. Approved from Codex, with one execution note: after build, run `npm run build:ext`, `npm run test:ext`, and a manifest/path sanity check against `dist/`. | ✅        |
| Gemini   |                                                                                                                                                                                                                                                                                                                                                                                               | ⬜        |

### Outcome

- **Status:** ✅ Done
- **Built by:** Claude
- **Result:** All files built. dist/ layout matches spec. One build fix required mid-build: Vite 8 prohibits IIFE + multiple entries in lib mode — fixed by splitting into one config per entry (`vite.scripts.config.ts` → content, `vite.background.config.ts` → background, `vite.config.ts` → popup). One vitest fix: root path needed explicit `__dirname` so tests resolved correctly.
- **Test result:** 9/9 passed ✅

---

---

## Review Template (copy for each new proposal)

```
## BP-NNN — <short title>

### What & Why
- **Phase:** Phase N — <name>
- **Task group:** <from tracker checklist>
- **Goal:** <one sentence>

### Files
| Action   | File path                        | Description                  |
|----------|----------------------------------|------------------------------|
| CREATE   | src/...                          | ...                          |
| MODIFY   | src/...                          | ...                          |
| DELETE   | src/...                          | ...                          |

### Approach
<Short paragraph: what the code will do, key decisions, any trade-offs>

### Dependencies / Prerequisites
- <anything that must exist or be installed first>

### Risk
- **Level:** Low / Medium / High
- **Notes:** <what could go wrong>

### Review

| Reviewer | Input | Approved? |
|----------|-------|-----------|
| User     |       | ⬜        |
| Codex    |       | ⬜        |
| Gemini   |       | ⬜        |
| Other    |       | ⬜        |

### Outcome
- **Status:** Pending / Approved / Building / Done / Failed
- **Built by:** Claude
- **Result:** <summary after build completes>
- **Test result:** <pass/fail count after tests run>
```

---

## Build History

### BP-001 — Phase 1 scaffold

#### What & Why

- **Phase:** Phase 1 — Foundation
- **Task group:** All (initial scaffold)
- **Goal:** Create the full Phase 1 directory and file structure so the extension is loadable in Chrome

#### Files

| Action | File path                       | Description                                              |
| ------ | ------------------------------- | -------------------------------------------------------- |
| CREATE | manifest.json                   | MV3 manifest with content scripts, popup, background     |
| CREATE | package.json                    | Dev scripts: lint, format, test, dev (web-ext)           |
| CREATE | .eslintrc.json                  | ESLint config with webextensions env                     |
| CREATE | .prettierrc                     | Prettier config                                          |
| CREATE | .gitignore                      | Ignores node_modules, dist, web-ext-artifacts            |
| CREATE | .github/workflows/ci.yml        | GitHub Actions: lint + format + test                     |
| CREATE | src/background/index.js         | MV3 service worker, sets default storage on install      |
| CREATE | src/utils/storage.js            | chrome.storage.local helpers (window.TFEStorage)         |
| CREATE | src/content/pageDetector.js     | URL matchers for GitHub PR / GitLab MR, MutationObserver |
| CREATE | src/content/sidebar/index.js    | Sidebar DOM injection, collapse/expand toggle            |
| CREATE | src/content/sidebar/sidebar.css | Fixed positioning, skeleton shimmer animation, dark mode |
| CREATE | src/content/index.js            | Orchestrator: detection → inject → SPA nav watch         |
| CREATE | src/popup/popup.html            | API key input + per-site toggle                          |
| CREATE | src/popup/popup.js              | Key validation (sk-ant- regex), chrome.storage R/W       |
| CREATE | src/popup/popup.css             | Popup styles                                             |
| CREATE | tests/pageDetector.test.js      | 9 unit tests for URL matcher regexes                     |
| CREATE | public/icons/.gitkeep           | Placeholder — PNG icons still needed                     |

#### Approach

Plain JS with a `window.TFE*` global namespace (no bundler yet — Phase 4 introduces Vite/esbuild).
Content scripts are listed in order in the manifest so each file's globals are available to the next.
Sidebar injected as a fixed div, CSS handles positioning and dark mode via `prefers-color-scheme`.
SPA navigation handled with a MutationObserver watching `document.body`.

#### Dependencies / Prerequisites

- `npm install` to pull eslint, prettier, web-ext
- 3 PNG icons (16/48/128px) needed in `public/icons/` before loading in Chrome

#### Risk

- **Level:** Low
- **Notes:** No network calls, no API keys consumed. Only risk is Chrome refusing to load if icon PNGs are missing.

#### Review

| Reviewer | Input                                      | Approved? |
| -------- | ------------------------------------------ | --------- |
| User     | Initial scaffold, no prior review required | ✅        |
| Codex    | —                                          | ✅        |
| Gemini   | —                                          | ✅        |

#### Outcome

- **Status:** Done
- **Built by:** Claude
- **Result:** All 16 Phase 1 files created. Extension loadable once icons are added.
- **Test result:** Pending — TP-001 not yet run

---

<!-- HISTORY BELOW — completed proposals, read only for debugging -->
