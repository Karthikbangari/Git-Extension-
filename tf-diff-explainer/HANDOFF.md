# HANDOFF — Alignment Review & Decisions Needed

> **Purpose:** Claude has reviewed CODEX.md against the project flow and found gaps and conflicts that need resolution before BP-002 is posted and any further building begins.
> Share this with Codex, Gemini, or any reviewer. Annotate the Decision column and hand back.

---

## Context

- Claude built the Phase 1 scaffold inside `tf-diff-explainer/` with its own `package.json`, test runner, and dev setup.
- Codex independently set up a root-level toolchain at `/Terraf/package.json` with Vite, Vitest, TypeScript, and web-ext v10.
- The two setups conflict. These must be reconciled before any Phase 1 testing or Phase 2 work begins.

---

## CODEX.md Gaps (things Codex doesn't know yet)

These need to be added to CODEX.md by Codex or the user:

| Gap                | What's missing                                                                  | Where it's defined |
| ------------------ | ------------------------------------------------------------------------------- | ------------------ |
| Build review table | Codex doesn't know it should fill in its row in `Build.md` before Claude builds | `Build.md`         |
| Approval keyword   | Codex doesn't know the "go" keyword triggers execution                          | `1playground.md`   |
| Branch naming      | No convention mentioned — should be `phase-N/<short-description>`               | `1playground.md`   |
| Lockfile policy    | No instruction to commit `package-lock.json`                                    | `CLAUDE.md`        |
| Gemini reviewer    | Codex doesn't know Gemini is a third reviewer in the Build.md table             | `Build.md`         |

---

## Critical Conflicts — Decisions Required

### Decision 1 — TypeScript or plain JavaScript?

| Option               | Pros                                                                                                                    | Cons                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **TypeScript**       | Codex already installed it. Catches type errors early. Better Chrome API types via `@types/chrome` (already installed). | Adds compilation step. More setup in Vite config. Slightly more overhead per task. |
| **Plain JavaScript** | Simpler. Matches current Phase 1 scaffold. No config changes needed.                                                    | Misses the TS toolchain Codex already set up.                                      |

**Decision:** ☐ TypeScript &nbsp;&nbsp; ☐ Plain JavaScript

---

### Decision 2 — One package.json or two?

Currently there are two:

- `/Terraf/package.json` — root, Codex-managed, has Vite/Vitest/TS/web-ext v10
- `/Terraf/tf-diff-explainer/package.json` — inner, Claude-created, has older versions, no Vite

These conflict. Claude recommends **removing the inner `package.json`** and using the root one as the single source of truth. All `npm` commands would then run from `/Terraf/`.

| Option                                     | Pros                                                                                | Cons                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Single root package.json** (recommended) | One source of truth. Matches Codex's setup. Vite, Vitest, web-ext all in one place. | Claude's inner config files (`.eslintrc.json`, `.prettierrc`) need updating to match root toolchain versions. |
| **Keep both**                              | Less immediate disruption.                                                          | Conflicting versions, duplicate scripts, confusion about which to run. Not sustainable.                       |

**Decision:** ☐ Single root package.json &nbsp;&nbsp; ☐ Keep both

---

### Decision 3 — Wire up Vite now (Phase 1) or wait until Phase 4?

Codex's root `package.json` already has Vite installed and `web-ext run --source-dir dist` — meaning a build step is already expected. Claude's current scaffold loads source directly (`--source-dir .`) with no bundler.

| Option                          | Pros                                                                                                                          | Cons                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Wire Vite now** (recommended) | Aligns with what Codex already set up. Enables proper ES module imports from Phase 2 onward. No surprise refactor in Phase 4. | Small extra setup task in Phase 1. Need a `vite.config.js` for Chrome extension multi-entry build.                           |
| **Wait until Phase 4**          | Less scope in Phase 1.                                                                                                        | Conflicts with Codex's root `web-ext` script. Content scripts can't use imports until then. Phase 4 refactor will be larger. |

**Decision:** ☐ Wire Vite now &nbsp;&nbsp; ☐ Wait until Phase 4

---

## Impact of Decisions on Claude's Work

Once decisions are made, Claude will post **BP-002** in `Build.md` covering:

- Remove `tf-diff-explainer/package.json` (if Decision 2 = single root)
- Add `vite.config.js` for multi-entry Chrome extension build (if Decision 3 = now)
- Convert `tests/pageDetector.test.js` from Node `assert` to Vitest syntax
- Update `.eslintrc.json` to ESLint v10 flat config format
- Add `try/catch` error boundary to `src/content/index.js`
- Add icon generation script to `public/icons/`

Nothing is touched until user types **"go"** after reviewing BP-002.

---

## Action Items for Codex

After decisions are confirmed, Codex should update `CODEX.md` with:

1. Branch naming convention: `phase-N/<short-description>`
2. Build.md review table — Codex fills its row before Claude builds
3. Approval keyword: **"go"** triggers execution
4. Lockfile: always commit `package-lock.json`
5. Gemini is a third reviewer — do not proceed if Gemini review row is empty (unless user overrides)

---

_Generated by Claude · `/Terraf/tf-diff-explainer/HANDOFF.md` · Phase 1 alignment review_
