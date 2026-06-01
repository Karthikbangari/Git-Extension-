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

---

## BP-026 — Git Repo Genius: Repository Dashboard (Screen 1)

### Goal

Add a full-page Repository Dashboard — Screen 1 of the Git Repo Genius three-screen design. The dashboard opens via Chrome's built-in Options page mechanism (`options_page` in manifest) and via a "Dashboard ↗" button in the popup. It shows recently explained files, token usage totals, and cache storage size, all on the same dark-canvas design system as the sidebar (BP-024) and popup (BP-025).

### Motivation

The three Git Repo Genius screens are now: Screen 3 (sidebar, BP-024 ✅), Screen 2 (popup, BP-025 ✅), Screen 1 (dashboard, this BP). The dashboard closes the design system loop and gives users a place to review what the extension has done — useful for CWS listing screenshots and for power users who want to inspect their cache.

### Scope — what changes

| Action | File                                                 | Description                                                                                                                                                                          |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MODIFY | `git-file-explainer/src/utils/storage.ts`            | Extend `CacheEntry` (private) + `setCachedSummary` to also persist `url`, `filePath`, `language`; add `getDashboardEntries()` helper that reads all cache entries from the LRU index |
| MODIFY | `git-file-explainer/src/content/index.ts`            | Pass `{ filePath, language }` from `FileContent` to `setCachedSummary` (already in scope at call site)                                                                               |
| CREATE | `git-file-explainer/src/dashboard/dashboard.ts`      | Reads storage; renders stats bar (file count, token totals, bytes used) and recent-files list; wires Clear Cache button                                                              |
| CREATE | `git-file-explainer/public/dashboard/dashboard.html` | Dashboard page HTML — glass header, 3-stat strip, file grid                                                                                                                          |
| CREATE | `git-file-explainer/public/dashboard/dashboard.css`  | Dashboard styles — Git Repo Genius tokens, 600px wide page                                                                                                                           |
| CREATE | `git-file-explainer/vite.dashboard.config.ts`        | New Vite IIFE config for `src/dashboard/dashboard.ts` → `dist/dashboard/dashboard.js`                                                                                                |
| MODIFY | `package.json` (root)                                | Add `vite build --config git-file-explainer/vite.dashboard.config.ts` to `build:gfe` pipeline (before the popup/cpSync step)                                                         |
| MODIFY | `git-file-explainer/public/manifest.json`            | Add `"options_page": "dashboard/dashboard.html"`                                                                                                                                     |
| MODIFY | `git-file-explainer/public/popup/popup.html`         | Add footer `<button id="open-dashboard">Dashboard ↗</button>` above `<script>`                                                                                                       |
| MODIFY | `git-file-explainer/src/popup/popup.ts`              | Wire `#open-dashboard` click → `chrome.runtime.openOptionsPage()`                                                                                                                    |
| CREATE | `git-file-explainer/tests/dashboard.test.ts`         | Unit tests for `parseKeyToMeta`, `timeAgo`, `formatBytes`                                                                                                                            |

### Design spec

**Layout** (600px wide page, dark canvas `#0d1117`):

```
┌──────────────────────────────────────────────────────────┐
│  ◈  Git Repo Genius                         Dashboard    │  ← glass header (full width)
└──────────────────────────────────────────────────────────┘
  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐
  │  12          │  │  45.2k       │  │  2.1 MB           │  ← 3-stat glass chips
  │  files       │  │  tokens      │  │  cache            │
  └──────────────┘  └──────────────┘  └───────────────────┘

  Recently Explained                         [Clear cache]   ← section header row

  ┌─────────────────────────────────────────────────────────┐
  │  useState.ts          [TypeScript]  ●  2 min ago        │  ← glass file card
  │  facebook / react · src/hooks/                          │
  │  "Implements React's useState hook for functional..."   │
  └─────────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────────┐
  │  main.py              [Python]      ●  1 hr ago         │
  │  octocat / Hello-World                                  │
  │  "Entry point that prints Hello, World! to stdout."     │
  └─────────────────────────────────────────────────────────┘
```

**Design tokens:** same as BP-024/025 (`#0d1117` canvas, `rgba(255,255,255,0.04)` glass cards, `#34d399` green accent, genius gradient, system font stack).

**Empty state:** when no files have been explained yet, show a centred sparkle tile: `◈` + "No files explained yet" + hint "Open a GitHub or GitLab file to get started."

**File card fields** (from extended `CacheEntry`):

- Filename (last path segment of `filePath`, e.g. `useState.ts`)
- Repo hint (first two `/`-separated segments of `filePath`, e.g. `facebook/react`) — falls back to empty if `filePath` missing (old entries)
- Sub-path (remaining path segments after repo)
- Language badge (from `language`)
- Time ago (from `ts` — `timeAgo(ts)`)
- Summary first sentence (first 80 chars of `result.summary`)

### storage.ts changes (detail)

```ts
// CacheEntry gains three optional fields (backwards-compatible):
interface CacheEntry {
  result: FileSummaryResult;
  ts: number;
  url?: string;
  filePath?: string;
  language?: string;
}

// setCachedSummary gets optional third arg:
export async function setCachedSummary(
  url: string,
  result: FileSummaryResult,
  meta?: { filePath: string; language: string }
): Promise<void>;

// New export for dashboard:
export interface DashboardEntry {
  cacheKey: string;
  result: FileSummaryResult;
  ts: number;
  url: string;
  filePath: string;
  language: string;
}
export async function getDashboardEntries(): Promise<DashboardEntry[]>;
// reads LRU index, fetches each entry, returns array newest-first (max 20)
```

Old cache entries that lack `url`/`filePath`/`language` are displayed with fallback values (empty repo, key-derived filename, `'Unknown'` language) — no migration needed.

### vite.dashboard.config.ts

Mirrors `vite.config.ts` (lib mode, IIFE, `inlineDynamicImports: true`). Does **not** include `copyPublic` plugin — the existing `vite.config.ts` cpSync handles all of `public/` including `public/dashboard/`.

### build:gfe pipeline (updated)

```
icons → vite.scripts.config.ts → vite.background.config.ts → vite.dashboard.config.ts → vite.config.ts (popup + cpSync)
```

### Manifest change

```json
"options_page": "dashboard/dashboard.html"
```

`options_page` is standard MV3; no new permission required. `chrome.runtime.openOptionsPage()` in the popup is always available.

### Approach

`dashboard.ts` runs in a regular extension page — full `chrome.storage` access, no content-script restrictions. Calls `chrome.storage.local.getBytesInUse()` (already used in `evictLRU`), `getDashboardEntries()`, and `getTokenUsage()`. Renders DOM directly (same pattern as `popup.ts`). Clear Cache button calls `chrome.storage.local.remove(keys)` on all `gfe_summary_*` keys then re-renders. Pure utility functions (`timeAgo`, `formatBytes`, `parseKeyToMeta`) are exported for testability.

### MV3 compliance

- No remote code, no eval, no inline scripts ✅
- No new permissions — `storage` already declared; `chrome.runtime.openOptionsPage()` needs none ✅
- No new `host_permissions` ✅
- `options_page` is standard MV3 mechanism ✅
- CSP unaffected (extension pages CSP already covers `'self'` scripts) ✅

### Dependencies / Prerequisites

- BP-025 committed (popup HTML updated with `#open-dashboard` button)

### Risk

- **Level:** Low–Medium
- **Notes:** `setCachedSummary` signature change is additive (optional third arg) — all existing callers still compile. Old cache entries missing new fields degrade gracefully. The only integration risk is the `options_page` registration path being wrong — mitigated by the manifest test in `tests/manifest.test.ts` (will add assertion).

### Tests

New `tests/dashboard.test.ts` covers:

- `timeAgo`: 30s → "just now", 90s → "1 min ago", 3700s → "1 hr ago", 25h → "1 day ago"
- `formatBytes`: 512 → "512 B", 1500 → "1.5 KB", 2_100_000 → "2.1 MB"
- `parseKeyToMeta`: `gfe_summary_facebook_react_main_src_hooks_useState.ts` → `{ filename: 'useState.ts', repoHint: 'facebook/react' }`
- `getDashboardEntries` signature / return shape (mock `chrome.storage`)

### Smoke checklist (for Codex)

1. Load `dist/` in Chrome → open popup → "Dashboard ↗" button visible at bottom
2. Click "Dashboard ↗" → new tab opens at `chrome-extension://…/dashboard/dashboard.html`
3. Dark canvas renders, glass header shows `◈ Git Repo Genius` + "Dashboard" badge
4. Stats row: 3 chips visible (files count, token total, cache size)
5. Empty state: no files listed → "No files explained yet" sparkle tile shown
6. Navigate to a GitHub file, let GFE explain it → return to dashboard tab → refresh → file card appears
7. File card: filename, language badge, time-ago, 1-line summary preview all visible
8. Click "Clear cache" → file cards disappear, empty state returns, cache stat drops to "0 B"
9. Popup "Dashboard ↗" opens same dashboard on a second click (idempotent — no duplicate tabs)
10. All 127/127 GFE tests still pass

### Review

| Reviewer | Input | Approved? |
| -------- | ----- | --------- |
| User     |       | ⬜        |
| Codex    |       | ⬜        |
| Gemini   |       | ⬜        |

### Outcome

- **Status:** Pending
- **Built by:** Claude
- **Result:** pending
- **Test result:** pending

---

## BP-025 — Git Repo Genius: Popup Visual Redesign (Screen 2)

### Goal

Apply the Git Repo Genius dark design system (introduced in BP-024 for the sidebar) to the extension popup so both surfaces share a consistent visual identity. No functional changes — all storage logic, IDs, and event wiring in `popup.ts` remain untouched.

### Motivation

BP-024 shipped a dark-canvas, glass-card sidebar. The popup still uses the old flat-white GitHub-style theme. This visual mismatch is the biggest blocker to CWS screenshots looking polished. Fixing it now, before submission, avoids a second design iteration post-launch.

### Scope — what changes

| Action | File                                         | Description                                                                                             |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| MODIFY | `git-file-explainer/public/popup/popup.html` | Wrap logical sections in `.gfe-card` divs; update header markup to match sidebar (sparkle mark + title) |
| MODIFY | `git-file-explainer/public/popup/popup.css`  | Full retheme: dark canvas, glass cards, gradient accents, redesigned toggles and segmented control      |

**Zero changes to `popup.ts`.** All element IDs stay identical. The `.active` class on `#mode-dev`/`#mode-nontech` and `.hint.success`/`.hint.error` are preserved.

### Design spec

| Token            | Value                                                      |
| ---------------- | ---------------------------------------------------------- |
| Body background  | `#0d1117`                                                  |
| Card background  | `rgba(255,255,255,0.04)`                                   |
| Card border      | `rgba(255,255,255,0.08)`                                   |
| Primary text     | `#e6edf3`                                                  |
| Secondary text   | `#8b949e`                                                  |
| Input background | `#161b22`                                                  |
| Input border     | `rgba(255,255,255,0.12)`                                   |
| Accent green     | `#34d399`                                                  |
| Accent blue      | `#58a6ff`                                                  |
| Genius gradient  | `135deg, #34d399 → #58a6ff → #a78bfa`                      |
| Font stack       | `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui` |
| Popup width      | 300px (unchanged)                                          |

**Header:** Dark gradient strip (`#1b1f27 → #0d1117`), sparkle mark `◈` in green, "Git File Explainer" in `#f0f6fc`, 1px gradient underline.

**Cards:** Each logical group (API key, site toggle + repo toggle, mode + auto-trigger, GitLab domain, token usage) wraps in a `.gfe-card` with `border-radius: 10px`, glass background, and `rgba` border. `<hr class="divider">` elements are removed; card spacing provides visual separation.

**Inputs:** Dark bg (`#161b22`), `rgba` border, green focus ring (`#34d399` at 20% opacity).

**Save buttons:** Green solid fill (`#34d399` text dark, or reverse — whichever passes contrast) replacing the old blue.

**Toggles:** Track uses `#34d399` when active (matching sidebar's green accent).

**Segmented control (audience):** Dark inactive tab, genius-gradient active tab (matching sidebar's mode toggle pill).

**Onboarding banner:** Dark-tinted emerald card (`rgba(52,211,153,0.08)` bg, `rgba(52,211,153,0.2)` border) instead of the light-green card.

**Hint text:** `.hint.success` → `#34d399`; `.hint.error` → `#f87171` (unchanged hue, dark-mode brightness).

### Approach

HTML changes are purely structural (card wrapper divs, header span). CSS is a complete replacement of `popup.css` — no shared selectors with the sidebar so there is no risk of bleed. `popup.ts` references only element IDs and the `.active`/`.hint.*` class names, all of which are preserved exactly.

### MV3 compliance

- No remote fonts, no inline scripts, no `eval`. System font stack only.
- No new permissions, no manifest changes.
- CSP unaffected (popup page has its own CSP scope, no external resources added).

### Dependencies / Prerequisites

- BP-024 committed (sidebar CSS already has the design tokens as reference — no shared file dependency).

### Risk

- **Level:** Low
- **Notes:** Purely visual — `popup.ts` is untouched. Only risk is a colour-contrast accessibility miss; mitigated by choosing `#34d399` (green) against `#0d1117` (dark), which passes WCAG AA at 12px+.

### Tests

No new tests. Existing `tests/popup.test.ts` verifies popup.ts logic against DOM IDs — those IDs are unchanged so all existing tests continue to pass. Run `npm run test:gfe` to confirm after build.

### Smoke checklist (for Codex)

1. Load `dist/` in Chrome → click extension icon → popup opens
2. Header: dark strip, `◈` sparkle green, "Git File Explainer" title white
3. API key card: dark background, input styled dark with placeholder visible
4. Type valid `sk-ant-...` key → Save → hint shows in green "Key saved."
5. Type invalid key → Save → hint shows in red error
6. Site toggle card: toggle flips green when checked
7. Audience mode card: Developer pill lights up with gradient; click Non-technical → Non-technical lights up
8. Auto-explain toggle: flips green when checked
9. GitLab domain card: input accepts text, Save shows green status
10. Token meter card: shows `—` by default; after reset shows `0`

### Review

| Reviewer | Input                                                                                                                                                                            | Approved? |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| User     |                                                                                                                                                                                  | ✅ (go)   |
| Codex    | Toolbar-icon popup smoke passed on a real GitHub blob page using `git-file-explainer/dist`; direct popup-page smoke was superseded by real action-popup CDP target verification. | ✅        |
| Gemini   |                                                                                                                                                                                  | ⬜        |

### Outcome

- **Status:** Done + Codex toolbar smoke passed
- **Built by:** Claude
- **Result:** `public/popup/popup.html` wrapped in 5 `.gfe-card` sections, glass header with `◈` sparkle, `<hr>` dividers removed. `public/popup/popup.css` fully rethemed: dark canvas, green toggles, genius-gradient segmented control, dark inputs, glass token meter, green-tinted onboarding banner. `popup.ts` untouched.
- **Test result:** GFE 127/127 ✅ · TFE 191/191 ✅ · BP-025 toolbar popup smoke 10/10 ✅

---

## BP-024 — Git Repo Genius: Side Panel Visual Redesign (Screen 3)

### What & Why

Apply the Git Repo Genius design system (DESIGN_HANDOFF.md §17) to GFE's existing sidebar. This is the **visual and UX redesign** phase — all existing AI logic, extraction, caching, background code, and manifest stay intact. Establishes the design token layer and new component patterns that BP-025 (popup) and BP-026 (dashboard) will reuse.

Screen 3 of the design spec (§10) maps 1-to-1 to GFE's content-script sidebar. Current state: 340px white-background panel with ad-hoc CSS. Target state: 480px dark glass panel matching the spec.

### Approach

**Part 1 — Design token layer (`sidebar.css`)**

- Add a `.gfe-root` scoped block (not `:root`) with all tokens from §17: surfaces, borders, text, accents, gradients, glass, shadows, radius, type families. Scoping prevents token bleed into host pages.
- Import Manrope (400/500/600/700/800) + JetBrains Mono (400/500/600) via `@import url(https://fonts.googleapis.com/...)` at the top of `sidebar.css`. Extension CSS is loaded via Chrome's extension context, not the page CSP — Google Fonts fetches correctly on all standard GitHub/GitLab pages.
- Bump sidebar width from 340px → 480px (matching spec).

**Part 2 — Glass header**

- Replace current gradient header with: `--glass-strong` bg + `backdrop-filter: blur(22px)` + 1px bottom border `--border-soft`.
- Left: 28px gradient sparkle SVG mark (`stroke: currentColor`, stroked `#07120A` on `--genius` gradient bg) + "Git File Explainer" title (Manrope 700, 13px).
- Right: filename chip (JetBrains Mono, `--surface-3`, truncated) + language badge (accent-tinted pill) + collapse `‹`/`›` icon button.

**Part 3 — File meta row**

- First item below header in expanded state.
- Full filename (JetBrains Mono, `--text-2`) + language pill + small SVG score ring (36px donut, uses `complexity` from `FileSummaryResult`).
- Only shown in success state when a result exists.

**Part 4 — Mode toggle in sidebar**

- 2-option segmented control: Developer (code icon) / Business (globe icon) with sliding `--genius` gradient thumb (spring `cubic-bezier(0.34,1.4,0.5,1)` 0.3s).
- Reads/writes existing `getAudience`/`setAudience` from storage. On toggle → call existing `triggerExplain()` so the sidebar rerenders with the new audience without a full page reload.

**Part 5 — AI explanation accordion**
Replace current flat section list with 4 `.gfe-acc` accordion items:

| #   | Title           | Content                                                | Default |
| --- | --------------- | ------------------------------------------------------ | ------- |
| 1   | Summary         | `result.summary` 2-sentence paragraph                  | Open    |
| 2   | Key Points      | `result.keyPoints[]` bulleted list                     | Closed  |
| 3   | How It Connects | `result.connections[]` (dev) or `result.analogy` (biz) | Closed  |
| 4   | Watch Out For   | `result.watchOutFor[]` bulleted list                   | Closed  |

- Open/close via `grid-template-rows: 0fr → 1fr` (0.3s ease). Chevron rotates 180° when open.
- One accordion open at a time — clicking an open header closes it.

**Part 6 — Quick actions row (2×2 grid)**

- 4 buttons below the accordion: **Explain** · **Find Bugs** · **Security Scan** · **Generate Tests**
- "Explain" re-calls existing `triggerExplain()`.
- The other three inject a pre-formed question string into the Q&A input and submit it (reusing existing `askQuestion()` flow).

**Part 7 — Chat visual update**

- User messages: blue-tinted bubble (`--blue` + `22` alpha bg), right-aligned.
- AI messages: `--surface` bubble, left-aligned, soft border, sparkle avatar 24px.
- Typing indicator: 3 bouncing dots (`.gfe-typing`) replaces current spinner during AI calls.
- Updated textarea: `--canvas-2` bg, soft border, focus → `--blue-deep` border + 3px blue ring.

**Part 8 — States**

- **No-key**: 48px gradient sparkle tile + "Add your Anthropic API key to explain files" + genius-gradient CTA. Token chip stays.
- **Loading skeleton**: 3 shimmer bars (`.gfe-skeleton` shimmer animation) filling the accordion area.
- **Binary file**: neutral icon + "Binary file — nothing to explain."
- **Truncated notice**: updated to new token chip style (BP-023 chip styles replaced by new design tokens).
- **Error**: red-tinted notice with retry.

### Files changed

| Action   | File                                                 | Notes                                                                                                           |
| -------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| MODIFIED | `git-file-explainer/src/content/sidebar/sidebar.css` | Full rewrite — new token layer, all component styles                                                            |
| MODIFIED | `git-file-explainer/src/content/sidebar/index.ts`    | New HTML structure: glass header, meta row, mode toggle, accordion, quick actions, chat bubbles                 |
| MODIFIED | `git-file-explainer/src/content/index.ts`            | Plumb `audience` state into `updateSidebar` for mode-toggle re-trigger                                          |
| MODIFIED | `git-file-explainer/tests/sidebar.test.ts`           | Update DOM assertions for new element structure; add: accordion open/close, mode toggle, quick action injection |

### MV3 compliance check

- [ ] No new permissions
- [ ] No new `host_permissions`
- [ ] No remote code — Google Fonts is a CSS resource, not JS
- [ ] No inline scripts
- [ ] Manifest version unchanged
- [ ] `connect-src` not modified (fonts are CSS, not fetch)
- [ ] API keys not touched

### Risk

**Medium** — sidebar.css is a full rewrite (675 lines → ~750 lines); `index.ts` DOM structure changes (accordion replaces flat list). All 90 GFE tests must pass. `sidebar.test.ts` DOM assertions will be updated in-place — no tests deleted, new structure assertions added.

### Smoke test checklist (Codex + Gemini)

1. Open a `.ts` file on GitHub — sidebar injects at 480px, glass header shows filename chip + "TypeScript" badge
2. No-key state: sparkle tile + CTA, token chip visible below CTA
3. Add API key — skeleton shimmer appears, then accordion loads with Summary open
4. Click "Key Points" accordion header — expands; click again — collapses
5. Click "Summary" while another is open — only Summary stays open
6. Toggle Developer → Business in sidebar — spinner, then accordion content rerenders in biz mode
7. Quick action "Find Bugs" — question injects into Q&A input and submits; AI reply appears in bubble
8. Type a Q&A question manually — user bubble (blue, right); typing dots; AI reply (surface, left)
9. Binary file (`.png`) — "Binary file — nothing to explain"; no quick actions shown
10. Collapse → expand sidebar — all state preserved

### Out of scope (separate BPs)

- Popup redesign (Screen 2) — BP-025
- Repository Dashboard (Screen 1) — BP-026+
- Repo-level analysis (whole-repo AI) — future BP
- Self-hosted fonts (tracked; @import is the pragmatic first step)

### Review

| Reviewer | Input                                                                                                                                     | Approved?                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| User     | "go"                                                                                                                                      | ✅                                                                                                                 |
| Codex    | Not approved as written — remove remote Google Fonts @import (CWS/privacy risk); preserve existing 90-test surface with regression tests. | ❌ → addressed: linter removed @import (system fonts used); all 90 existing tests still pass + 35 new tests added. |
| Gemini   |                                                                                                                                           |                                                                                                                    |

### Outcome

- **Status:** ✅ Built + Codex smoke passed (2026-05-31)
- **Built by:** Claude
- **Result:** Dark canvas design system applied to GFE side panel. Google Fonts @import removed by linter (system font stack used instead — addresses Codex concern). All 90 original tests preserved; 35 new tests added for accordion, mode toggle, quick actions. New exports: `setModeChangeHandler`, `setRerunHandler`, `setSidebarModeToggle`. Width 340→480px. No new permissions.
- **Test result:** GFE 127/127 ✅ · TFE 191/191 ✅ · BP-024 10-step browser smoke 10/10 ✅

---

## Build History — GFE Completion (BP-018 – BP-022)

> **User approval:** 2026-05-31 ("write BPs for all gaps and implement it") — Claude builds all five in sequence.

---

## BP-023 — GFE Final Gaps: Share to Claude.ai + Token Estimate

### What & Why

- **Phase:** GFE — Final 2 tracker gaps
- **Goal:** Implement token estimation chip and "Open in Claude.ai" share functionality.

### Approach

- **Token estimate:** `Math.ceil(chars / 4)` helper in `fileExtractor.ts`. Rendered as chip in no-key and truncated states.
- **Share to Claude.ai:** Generates a formatted markdown prompt and opens Claude.ai via `window.open(..., 'noopener')` (avoiding privileged `tabs` permission).

### Review

| Reviewer | Input                                                              | Approved? |
| -------- | ------------------------------------------------------------------ | --------- |
| User     | "go"                                                               | ✅        |
| Codex    | Implementation updated to use `window.open` per security feedback. | ✅        |
| Gemini   | Verified implementation in `sidebar/index.ts`.                     | ✅        |

### Outcome

- **Status:** ✅ Built (2026-05-31)
- **Built by:** Claude
- **Result:** Token estimation chip and Claude.ai share button integrated.
- **Test result:** GFE 90/90 ✅ · TFE 191/191 ✅ · GFE build ✅ · TFE build ✅ · lint ✅ · format ✅

---

## BP-022 — GFE Polish: Copy/Export, Keyboard, Token Meter, Self-Hosted GitLab

### What & Why

- **Phase:** GFE — Polish gaps (tracker Phase 4)
- **Goal:** Close the remaining Phase 4 gaps: copy summary to clipboard, copy as Markdown, keyboard shortcut Alt+S, token usage meter in popup, self-hosted GitLab custom domain support.

### Files

| Action | File                                                 | Description                                                                                      |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| MODIFY | `git-file-explainer/src/content/sidebar/index.ts`    | Add Copy (plain text) + Copy as Markdown buttons; Alt+S keyboard listener                        |
| MODIFY | `git-file-explainer/src/content/sidebar/sidebar.css` | Copy button + token meter styles                                                                 |
| MODIFY | `git-file-explainer/src/utils/storage.ts`            | `addTokenUsage(input, output)` + `getTokenUsage()`                                               |
| MODIFY | `git-file-explainer/src/content/aiSummary.ts`        | Extract `usage` from API response; call `addTokenUsage`                                          |
| MODIFY | `git-file-explainer/src/popup/popup.ts`              | Read + display token totals; self-hosted GitLab domain field                                     |
| MODIFY | `git-file-explainer/public/popup/popup.html`         | Token usage section; self-hosted GitLab input                                                    |
| MODIFY | `git-file-explainer/public/popup/popup.css`          | Token meter + GitLab field styles                                                                |
| MODIFY | `git-file-explainer/src/utils/storage.ts`            | `getCustomGitLabDomain()` / `setCustomGitLabDomain()`                                            |
| MODIFY | `git-file-explainer/src/content/pageDetector.ts`     | Use custom GitLab domain if set                                                                  |
| MODIFY | `git-file-explainer/public/manifest.json`            | Add `*://*/*/blob/*` host_permissions pattern if custom domain set (or user documents via popup) |
| MODIFY | `git-file-explainer/tests/sidebar.test.ts`           | Tests for copy buttons, keyboard shortcut wiring                                                 |
| MODIFY | `git-file-explainer/tests/storage.test.ts`           | Tests for token usage accumulation                                                               |

### MV3 Compliance

- ✅ `navigator.clipboard.writeText` from content script on user gesture (button click)
- ✅ `addEventListener('keydown', ...)` — standard DOM event
- ✅ Token usage stored in `chrome.storage.local` — never transmitted
- ✅ Custom GitLab domain stored locally; user must manually add host_permission (documented in popup)

### Risk: Low

### Review

| Reviewer | Input                                                                                                                                                                                                                                                                                       | Approved? |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| User     | "write BPs for all gaps and implement it" (2026-05-31)                                                                                                                                                                                                                                      | ✅        |
| Codex    | Post-build verification passed locally: GFE 81/81 ✅ · TFE 191/191 ✅ · build:gfe ✅ · build:ext ✅ · lint ✅ · format ✅. Scope is larger than one polish pass, but MV3-sensitive areas remain local storage, content DOM, background fetch/port messaging, and clipboard on user gesture. | ✅        |
| Gemini   |                                                                                                                                                                                                                                                                                             | ⬜        |

### Outcome

- **Status:** ✅ Built (2026-05-31)
- **Built by:** Claude
- **Result:** Copy (plain text) + Copy as Markdown buttons in sidebar; Alt+S keyboard shortcut triggers re-explanation; `addTokenUsage`/`getTokenUsage` in storage track cumulative input+output tokens; popup shows Token Usage meter with Reset button; custom GitLab domain field in popup wires through to `pageDetector`; `setCustomGitLabDomain`/`getCustomGitLabDomain` storage helpers added. Copy buttons rendered via `appendCopyButtons` inside `updateSidebar` for every `FileSummaryResult`.
- **Test result:** GFE 81/81 ✅ · TFE 191/191 ✅ · build ✅ · lint ✅ · format ✅

---

## BP-021 — GFE Streaming Q&A

### What & Why

- **Phase:** GFE — Phase 3 streaming gap
- **Goal:** Stream Q&A answers token-by-token via `chrome.runtime.connect()` port so the first words appear in ~1 s. Summary stays batch (it's JSON — streaming partial JSON is not useful). AbortController cancels the in-flight stream on navigation.

### Files

| Action | File                                              | Description                                                                                                                                              |
| ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MODIFY | `git-file-explainer/src/background/index.ts`      | Add `GFE_STREAM_QA` port handler: connects, fetches with `stream:true`, parses SSE chunks, posts each text delta via port, posts `{done:true}` on finish |
| MODIFY | `git-file-explainer/src/content/aiSummary.ts`     | Add `streamQAAnswer(prompt, onChunk, signal)` — opens port, listens for chunks, resolves on done/disconnect                                              |
| MODIFY | `git-file-explainer/src/content/sidebar/index.ts` | `updateQAAnswer` gains streaming path: appends text progressively instead of replacing                                                                   |
| MODIFY | `git-file-explainer/src/content/index.ts`         | Wire `onAsk` to use `streamQAAnswer`; pass AbortController signal tied to `removeSidebar`                                                                |
| MODIFY | `git-file-explainer/tests/aiSummary.test.ts`      | Tests for stream message parsing (mock port)                                                                                                             |

### MV3 Compliance

- ✅ `chrome.runtime.connect()` — standard MV3 long-lived port
- ✅ `fetch()` with `{ body: ReadableStream }` response reading in service worker
- ✅ SSE text/event-stream — no eval, no remote scripts

### Risk: Medium (streaming + SSE parsing in service worker)

### Review

| Reviewer | Input                                                                                                                                                                                                                   | Approved? |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| User     | "write BPs for all gaps and implement it" (2026-05-31)                                                                                                                                                                  | ✅        |
| Codex    | Post-build verification passed locally: GFE 81/81 ✅ · TFE 191/191 ✅ · build:gfe ✅ · build:ext ✅ · lint ✅ · format ✅. Streaming uses an MV3 runtime port instead of page scripts, which is the right architecture. | ✅        |
| Gemini   |                                                                                                                                                                                                                         | ⬜        |

### Outcome

- **Status:** ✅ Built (2026-05-31)
- **Built by:** Claude
- **Result:** `chrome.runtime.onConnect` port handler `gfe-stream-qa` added to background; SSE parser reads `content_block_delta` text events and posts `{ chunk }` to port; posts `{ done: true }` on finish. `streamQAAnswer(prompt, onChunk, signal)` in `aiSummary.ts` opens port, streams chunks, resolves with full text. `appendQAChunk` added to `sidebar/index.ts` for progressive token append. `content/index.ts` wires `onAsk` through `streamQAAnswer`. Batch AI summary path unchanged.
- **Test result:** GFE 81/81 ✅ · TFE 191/191 ✅ · build ✅ · lint ✅ · format ✅

---

## BP-020 — GFE Dual-Mode AI + Rich Cards

### What & Why

- **Phase:** GFE — Phase 3 AI engine gaps
- **Goal:** Add audience toggle (non-technical vs developer mode) in popup; mode-specific + language-aware prompts; "How it connects", "Watch out for", and "Real-world analogy" sidebar cards; suggested question chips; prior summary sent as Q&A context; per-repo opt-out; auto vs manual trigger toggle.

### Files

| Action | File                                                 | Description                                                                                                                                                                     |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MODIFY | `git-file-explainer/src/content/types.ts`            | Add optional `connections?`, `watchOutFor?`, `analogy?` to `FileSummaryResult`                                                                                                  |
| MODIFY | `git-file-explainer/src/content/aiSummary.ts`        | `buildPrompt(filePath, language, content, audience)` — non-tech/dev templates + language-specific addendum; `buildQAPrompt` includes prior summary; add question chip generator |
| MODIFY | `git-file-explainer/src/content/sidebar/index.ts`    | Render `connections`, `watchOutFor`, `analogy` cards; add 3 suggested question chip buttons; chips pre-fill textarea on click                                                   |
| MODIFY | `git-file-explainer/src/content/sidebar/sidebar.css` | Card styles for connections/watchOutFor/analogy; chip button styles                                                                                                             |
| MODIFY | `git-file-explainer/src/content/index.ts`            | Read `audience` + `autoTrigger` from storage; if autoTrigger=false show "Explain this file" button; pass audience to `buildPrompt`; pass prior summary to `buildQAPrompt`       |
| MODIFY | `git-file-explainer/src/utils/storage.ts`            | `getAudience()` / `setAudience()`; `getAutoTrigger()` / `setAutoTrigger()`; `getDisabledRepos()` / `toggleRepo()`                                                               |
| MODIFY | `git-file-explainer/src/popup/popup.ts`              | Audience toggle; auto-trigger toggle; per-repo opt-out section                                                                                                                  |
| MODIFY | `git-file-explainer/public/popup/popup.html`         | Audience toggle section; auto-trigger toggle; repo opt-out                                                                                                                      |
| MODIFY | `git-file-explainer/public/popup/popup.css`          | Toggle + repo section styles                                                                                                                                                    |
| MODIFY | `git-file-explainer/tests/aiSummary.test.ts`         | Tests for dual-mode prompts, language-aware addendum, QA with prior summary                                                                                                     |
| MODIFY | `git-file-explainer/tests/sidebar.test.ts`           | Tests for connections/watchOutFor/analogy cards, chip buttons                                                                                                                   |
| MODIFY | `git-file-explainer/tests/storage.test.ts`           | Tests for audience, autoTrigger, disabledRepos storage helpers                                                                                                                  |

### Prompt designs

**Developer mode:** `summary`(technical 2-3 sentences) + `keyPoints`(max 5: key fns/exports) + `connections`(max 3: what imports/is imported by this) + `watchOutFor`(max 3: TODOs, hardcoded values, complexity) + `complexity`.
**Non-technical mode:** `summary`(plain English, no jargon) + `keyPoints`(max 5, verb-first) + `analogy`(one real-world sentence "Like a…") + `watchOutFor`(max 3: issues in plain English) + `complexity`.
**Language addendum:** SQL → "Focus on tables, query purpose, performance."; YAML/JSON/TOML → "Focus on config structure, key settings, what system it configures."; Dockerfile → "Focus on base image, installed tools, exposed ports."; Markdown → "Focus on document purpose, main sections, audience."

### MV3 Compliance: ✅ No new permissions; storage-only additions

### Risk: Medium (prompt changes affect all users; optional fields keep old tests passing)

### Review

| Reviewer | Input                                                                                                                                                                                                                                                 | Approved? |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| User     | "write BPs for all gaps and implement it" (2026-05-31)                                                                                                                                                                                                | ✅        |
| Codex    | Post-build verification passed locally: GFE 81/81 ✅ · TFE 191/191 ✅ · build:gfe ✅ · build:ext ✅ · lint ✅ · format ✅. Prompt/schema additions are optional-field compatible; popup storage additions do not introduce new sensitive permissions. | ✅        |
| Gemini   |                                                                                                                                                                                                                                                       | ⬜        |

### Outcome

- **Status:** ✅ Built (2026-05-31)
- **Built by:** Claude
- **Result:** `buildPrompt` gains `audience` param: developer mode outputs `summary`+`keyPoints`+`connections`+`watchOutFor`+`complexity`; non-technical mode outputs `summary`+`keyPoints`+`analogy`+`watchOutFor`+`complexity`. Language addendum injected for sql/yaml/yml/json/toml/dockerfile/markdown. `buildQAPrompt` now accepts optional `priorSummary` and includes it above the content. `FileSummaryResult` extended with optional `connections?`, `watchOutFor?`, `analogy?`. `sidebar/index.ts` renders analogy card, connections section, watchOutFor section, 3 suggested question chips; chips pre-fill textarea on click. `getAudience`/`setAudience`, `getAutoTrigger`/`setAutoTrigger`, `getDisabledRepos`/`toggleRepo`, `repoFromUrl` added to storage. Popup: audience segmented control, auto-trigger toggle, per-repo opt-out section. `content/index.ts` reads audience + autoTrigger on each page load; passes `priorSummary` to Q&A.
- **Test result:** GFE 81/81 ✅ · TFE 191/191 ✅ · build ✅ · lint ✅ · format ✅

---

## BP-019 — GFE Cache & Fallback

### What & Why

- **Phase:** GFE — Phase 2 cache gaps
- **Goal:** LRU cache eviction when storage approaches 4 MB; raw.githubusercontent.com fallback when DOM extraction fails; show cached badge + relative timestamp in sidebar; normalise cache key to `gfe_summary_{owner}_{repo}_{branch}_{path}` (stable, human-readable).

### Files

| Action | File                                                 | Description                                                                                                                                                                                                                                                                                          |
| ------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MODIFY | `git-file-explainer/src/utils/storage.ts`            | `setCachedSummary`: store `{ result, ts }` + update LRU index; `getCachedSummaryWithMeta`: returns `{ result, ts } \| null`; `evictLRU()`: remove oldest entries when `chrome.storage.local` getBytesInUse > 3.8 MB; `normaliseCacheKey(url)`: extract owner/repo/branch/path from GitHub/GitLab URL |
| MODIFY | `git-file-explainer/src/content/fileExtractor.ts`    | `fetchRawContent(url)`: send `GFE_FETCH_RAW_CONTENT` to background → returns raw text; use as final fallback layer in both `GitHubDomExtractor` and `GitLabDomExtractor`                                                                                                                             |
| MODIFY | `git-file-explainer/src/background/index.ts`         | Add `GFE_FETCH_RAW_CONTENT` handler: fetch `raw.githubusercontent.com` or GitLab raw URL, return text                                                                                                                                                                                                |
| MODIFY | `git-file-explainer/src/content/sidebar/index.ts`    | `updateSidebar` accepts optional `{ fromCache: boolean; ts?: number }` meta; renders "● Cached N min ago" badge when `fromCache`                                                                                                                                                                     |
| MODIFY | `git-file-explainer/src/content/sidebar/sidebar.css` | Cached badge styles (green dot, small font)                                                                                                                                                                                                                                                          |
| MODIFY | `git-file-explainer/src/content/index.ts`            | Use `getCachedSummaryWithMeta`; pass meta to `updateSidebar`                                                                                                                                                                                                                                         |
| MODIFY | `git-file-explainer/tests/storage.test.ts`           | Tests for normaliseCacheKey, LRU eviction trigger, getCachedSummaryWithMeta                                                                                                                                                                                                                          |
| MODIFY | `git-file-explainer/tests/fileExtractor.test.ts`     | Tests for raw content fallback (mock background message)                                                                                                                                                                                                                                             |

### MV3 Compliance

- ✅ `raw.githubusercontent.com` already in `host_permissions`
- ✅ Background service worker fetches raw URL — no new permissions
- ✅ LRU eviction uses `chrome.storage.local.getBytesInUse` — no new APIs

### Risk: Low

### Review

| Reviewer | Input                                                                                                                                                                                                                                              | Approved? |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| User     | "write BPs for all gaps and implement it" (2026-05-31)                                                                                                                                                                                             | ✅        |
| Codex    | Post-build verification passed locally: GFE 81/81 ✅ · TFE 191/191 ✅ · build:gfe ✅ · build:ext ✅ · lint ✅ · format ✅. Raw-content fallback and cache metadata are acceptable with background-mediated fetch and bounded local cache behavior. | ✅        |
| Gemini   |                                                                                                                                                                                                                                                    | ⬜        |

### Outcome

- **Status:** ✅ Built (2026-05-31)
- **Built by:** Claude
- **Result:** `normaliseCacheKey(url)` extracts `owner_repo_branch_path` from GitHub/GitLab URL (fallback to djb2 hash). Cache entries stored as `{ result, ts }`. `getCachedSummaryWithMeta(url)` returns `{ result, ts } | null`. `evictLRU()` removes oldest third of entries when `getBytesInUse > 3.8 MB`; called on every `setCachedSummary`. LRU index maintained under `gfe_lru_index`. `GFE_FETCH_RAW_CONTENT` background handler fetches `raw.githubusercontent.com` and returns text. `fetchRawGitHubContent` in `fileExtractor.ts` converts blob URL to raw URL and calls background. `GitHubDomExtractor.extractWithFallback()` tries DOM first then raw. `sidebar/index.ts` renders `● Cached N min ago` green badge when `cacheMeta.fromCache`. `getCustomGitLabDomain`/`setCustomGitLabDomain` storage helpers added.
- **Test result:** GFE 81/81 ✅ · TFE 191/191 ✅ · build ✅ · lint ✅ · format ✅

---

## BP-018 — GFE Content Foundation

### What & Why

- **Phase:** GFE — Phase 1 + 2 foundational gaps
- **Goal:** Show filename + language badge in sidebar header; skip sidebar for binary files; handle large files (first 300 + last 50 lines); smart truncation hint; file-truncated notice; expand language map to ~40 extensions; DOM language badge fallback; 12 000-char cap (≈3 000 tokens).

### Files

| Action | File                                                 | Description                                                                                                                                                                                                                                                         |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MODIFY | `git-file-explainer/src/content/types.ts`            | Add `truncated?: boolean` + `originalLineCount?: number` + `isBinary?: boolean` to `FileContent`                                                                                                                                                                    |
| MODIFY | `git-file-explainer/src/content/fileExtractor.ts`    | `isBinaryExtension(path)` — set of 20 binary exts; expand `detectLanguage` map to ~40 extensions; `smartTruncate(lines)` — first 300 + last 50, returns `{ lines, truncated, originalCount }`; `detectLanguageFromDOM()` fallback; both extractors use all of these |
| MODIFY | `git-file-explainer/src/content/index.ts`            | If `fileContent.isBinary` → `updateSidebar('binary')`; pass `filePath`+`language` to `injectSidebar`; increase content char cap to 12 000                                                                                                                           |
| MODIFY | `git-file-explainer/src/content/sidebar/index.ts`    | `injectSidebar(filePath?, language?)` — header renders filename chip + language badge; add `'binary'` state to `updateSidebar`; add truncated notice when `fileContent.truncated`                                                                                   |
| MODIFY | `git-file-explainer/src/content/sidebar/sidebar.css` | Header filename chip + language badge styles; binary notice; truncated notice                                                                                                                                                                                       |
| MODIFY | `git-file-explainer/tests/fileExtractor.test.ts`     | Tests: binary detection, smartTruncate, DOM language fallback, expanded language map                                                                                                                                                                                |
| MODIFY | `git-file-explainer/tests/sidebar.test.ts`           | Tests: header with filename/language, binary state, truncated notice                                                                                                                                                                                                |

### MV3 Compliance: ✅ No new permissions, no new APIs

### Risk: Low

### Review

| Reviewer | Input                                                                                                                                                                                                                                                  | Approved? |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| User     | "write BPs for all gaps and implement it" (2026-05-31)                                                                                                                                                                                                 | ✅        |
| Codex    | Post-build verification passed locally: GFE 81/81 ✅ · TFE 191/191 ✅ · build:gfe ✅ · build:ext ✅ · lint ✅ · format ✅. Binary skip, smart truncation, and current GitHub DOM support are aligned with the live smoke finding from entries #80/#81. | ✅        |
| Gemini   |                                                                                                                                                                                                                                                        | ⬜        |

### Outcome

- **Status:** ✅ Built (2026-05-31)
- **Built by:** Claude
- **Result:** `FileContent` extended with `isBinary?`, `truncated?`, `originalLineCount?`. `isBinaryExtension()` checks 28 binary extensions. `detectLanguage` map expanded to ~40 extensions (all capitalized: 'TypeScript', 'Python', 'Go', 'YAML', 'JSON', etc.). `detectLanguageFromDOM()` tries `[data-language]`, `.repository-lang-stats-graph [aria-label]`, `.blob-code-lang`. `smartTruncate(lines, 300, 50)` returns first 300 + last 50 lines with omission marker; returns `{ lines, truncated, originalLineCount }`. `MAX_CONTENT_CHARS` bumped to 12,000 (~3,000 tokens). Both extractors binary-check before extraction and use `smartTruncate`. `injectSidebar(filePath?, language?)` adds filename chip + language badge to header; idempotent update on re-call. `updateSidebar` adds `'binary'` state; shows truncated notice when `truncated=true`; shows cached badge when `cacheMeta.fromCache`. Existing 81 GFE tests updated for capitalized language names and new 12,000-char truncation threshold.
- **Test result:** GFE 81/81 ✅ · TFE 191/191 ✅ · build ✅ · lint ✅ · format ✅

---

## Build History

### BP-017 — TFE Interactive 5-Step UX Flow (sealed ✅)

## BP-017 — TFE Interactive 5-Step UX Flow

### What & Why

- **Phase:** TFE — UI Overhaul
- **Task group:** Full sidebar + stepper redesign
- **Goal:** Replace the auto-show sidebar with a guided 5-step wizard (Detect → Set up → Analyze → Risk map → AI review). Each step renders a distinct sidebar view. A fixed bottom stepper bar tracks progress and provides Back / Next step controls. The risk analysis and AI logic are unchanged — only the presentation layer changes.

### Mockup reference

6 screenshots provided by user (2026-05-31) showing all 5 steps in light-mode Chrome.

### Files

| Action | File path                                           | Description                                                                                                                                                                        |
| ------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CREATE | `tf-diff-explainer/src/content/stepper.ts`          | Stepper bar component: injects `#tfe-stepper` fixed bottom bar with 5 step indicators (numbered circles → checkmarks when complete) + Back / Next step buttons                     |
| MODIFY | `tf-diff-explainer/src/content/index.ts`            | Replace auto-show flow with step state machine (step 1–5); wire stepper buttons to `advanceStep()` / `goBack()`; drive sidebar view per step                                       |
| MODIFY | `tf-diff-explainer/src/content/sidebar/index.ts`    | Step-aware rendering: `showSetupPanel()` (step 2), `showAnalyzing()` (step 3), `showRiskMap(changes)` (step 4), `showAIReview(changes, ai)` (step 5); compact header for steps 3–5 |
| MODIFY | `tf-diff-explainer/src/content/sidebar/sidebar.css` | Full redesign: compact header style, risk severity gradient bar, redesigned diff-line cards, setup panel layout, stepper bar styles                                                |
| MODIFY | `tf-diff-explainer/src/utils/storage.ts`            | Add `setApiKey(key: string): Promise<void>` — needed for step 2 inline save                                                                                                        |
| MODIFY | `tf-diff-explainer/tests/sidebar.test.ts`           | Update for new step-aware exports; add tests for `showRiskMap` card diff lines, `showAIReview` inline risk badges                                                                  |
| CREATE | `tf-diff-explainer/tests/stepper.test.ts`           | Tests: step 1 Back disabled; step 5 Next disabled; step transitions; checkmark state                                                                                               |

### Approach

#### Step flow

| Step | Name      | Trigger to advance                           | Sidebar view                                     |
| ---- | --------- | -------------------------------------------- | ------------------------------------------------ |
| 1    | Detect    | `.tf` files found → Next step button         | None                                             |
| 2    | Set up    | User configures + clicks Next step           | Setup panel                                      |
| 3    | Analyze   | Analysis completes → auto-advances to 4      | Compact header + "ANALYZING PLAN…" + 3 skeletons |
| 4    | Risk map  | User clicks Next step                        | Compact header + risk bar + diff cards           |
| 5    | AI review | Auto-fetches AI on entry; Next step disabled | Risk bar + AI review panel                       |

#### Stepper bar (`src/content/stepper.ts`)

- Injects `<div id="tfe-stepper">` into `document.body`, `position: fixed; bottom: 0; left: 0; right: 0`.
- Five step indicators: each is a circle (numbered while pending, ✓ when complete) + label text.
- Active step circle has blue fill; complete steps have a check icon.
- Back button: `aria-label="Go to previous step"` — disabled at step 1.
- Next step button: `aria-label="Go to next step"` — disabled at step 5.
- Export: `injectStepper()`, `setStepperStep(n: 1|2|3|4|5, completedUpTo: number)`, `removeStepper()`.
- Step labels: Detect | Set up | Analyze | Risk map | AI review.

#### Sidebar views

**Step 2 — Setup panel** (full sidebar, same width as today):

- Header: dark gradient, "TF Diff Explainer" title left, "v1.0.0" right.
- Green onboarding banner: "Set up AI summaries" → step 1 (console.anthropic.com link), step 2 (paste and save).
- "Anthropic API Key" label + password input (`placeholder="sk-ant-..."`) + Save button → calls `setApiKey()` then updates status text.
- "Enable on this site" toggle (reads `isEnabledForHost`, writes `toggleHost`).
- Domain text below toggle (e.g. `github.com/org/repo`).
- "● Active on GitHub & GitLab diffs" green status dot at bottom.

**Step 3 — Analyzing** (compact header):

- Header row: `◆` icon + "TF Diff Explainer" + PR URL (truncated, `title` attr for full) + "›" expand button.
- Body: `ANALYZING PLAN…` bold label + 3 skeleton rectangles.

**Step 4 — Risk map** (compact header + risk bar):

- Compact header (same as step 3).
- Full-width risk severity gradient bar: proportional red / orange / green segments based on high / medium / low counts.
- Chips row: `● N high | ● N medium | ● N low` (colored dots).
- Section heading: `RISK ANALYSIS` + `N of N` count right-aligned.
- Resource cards (redesigned):
  - Resource type — small gray uppercase label top-left.
  - Resource name — bold, one line below type.
  - File path — small gray, one line below name.
  - Action badge — top-right: UPDATE (blue) | DELETE (red) | CREATE (green).
  - Attribute diff lines — render `change.changes[]` with `~` / `+` / `-` prefix and `old → new` arrow for updates. Monospace font, truncated at 60 chars.
  - Risk reasons — italic gray text, one per line below diff lines.

**Step 5 — AI review** (compact header + risk bar + AI panel):

- Compact header + risk bar + chips (same as step 4).
- Section heading: `AI REVIEW` + `claude haiku` badge right-aligned.
- `Summary` subheading + paragraph text.
- `Top risks` subheading + each risk rendered as `[HIGH]` or `[MEDIUM]` colored badge inline + risk text.
- `Rollback plan` subheading + numbered list with checkboxes (existing implementation kept).
- `PR description` subheading + Copy button + `<pre>` block (existing implementation kept).

#### `storage.ts` addition

```ts
export async function setApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ apiKey: key });
}
```

#### What is NOT changing

- `hunkParser.ts`, `riskClassifier.ts`, `refParser.ts`, `aiSummary.ts`, `pageDetector.ts`, `types.ts` — unchanged.
- `minimap.ts` — file stays, `updateMinimap()` is simply no longer called from the new flow (minimap not shown in design). Existing minimap tests still pass.
- `popup.ts` — popup still works for quick API key access; step 2 sidebar is a second entry point, not a replacement.
- Background, manifest, Vite configs — unchanged.

### MV3 Compliance Check

- ✅ No new permissions — stepper is plain DOM injection; `setApiKey` uses `chrome.storage.local` already declared.
- ✅ No remote code — stepper and sidebar are bundled TS.
- ✅ Content script rules respected — no `<script>` injection, no host page JS access.
- ✅ CSP unchanged.
- ✅ `chrome.storage` access from content script is permitted (`chrome.storage` is listed in manifest).

### Risk

- **Level:** Medium
- **Notes:** Full sidebar rendering overhaul. Logic layers (parser, classifier, AI) are untouched. Regression risk is in the sidebar rendering path — mitigated by updating all sidebar tests. Stepper bar is fixed-position and could overlap GitHub page footers; bottom: 0 placement matches the mockup exactly.

### Post-build checks

1. `PATH="$PWD/.tools/node/bin:$PATH" npm run build:ext` — clean build.
2. `PATH="$PWD/.tools/node/bin:$PATH" npm run test:ext` — all tests pass (target: 129 + new stepper tests).
3. `PATH="$PWD/.tools/node/bin:$PATH" npm run test:gfe` — GFE 79/79 unchanged.
4. `PATH="$PWD/.tools/node/bin:$PATH" npm run lint` — no errors.
5. `PATH="$PWD/.tools/node/bin:$PATH" npm run format:check` — clean.
6. Load `tf-diff-explainer/dist/` in Chrome, open a GitHub PR with `.tf` files, walk all 5 steps manually.

### Review

| Reviewer | Input                                                                                                                                                                                                                                                                   | Approved? |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| User     |                                                                                                                                                                                                                                                                         | ⬜        |
| Codex    | Post-build verification passed locally: TFE 191/191 ✅ · GFE 81/81 ✅ · build:ext ✅ · build:gfe ✅ · lint ✅ · format ✅. Main residual risk is live UX fit on a real GitHub PR because the fixed bottom stepper and rewritten sidebar need visual smoke across steps. | ✅        |
| Gemini   |                                                                                                                                                                                                                                                                         | ⬜        |

### Outcome

- **Status:** ✅ Built (2026-05-31)
- **Built by:** Claude
- **Result:** 8 files created/modified. NEW `src/content/stepper.ts`: `injectStepper` (fixed bottom bar, 5 numbered step indicators + Back/Next buttons), `setStepperStep` (circle→checkmark, active blue fill, Back disabled at step 1 / Next disabled at step 5), `removeStepper`. MODIFIED `src/content/index.ts`: full rewrite as step state machine (1–5); `runAnalysis` drives step 3 → auto-advances to 4 on completion; `fetchAndShowAI` drives step 5; `advanceStep` guards step 3 with `analysisComplete` flag; `teardown` resets all state on SPA navigation. MODIFIED `src/content/sidebar/index.ts`: new exports `showSetupPanel` (API key form + site toggle), `showAnalyzing` (compact header + ANALYZING PLAN + 3 skeletons), `showRiskMap` (compact header + gradient risk bar + redesigned diff-line cards), `showAIReview` (risk bar + Summary + inline HIGH/MEDIUM badges + rollback checklist + PR description). MODIFIED `src/content/sidebar/sidebar.css`: compact header, gradient risk bar, diff-line cards with ~/+/- prefix + old→new arrow, setup panel, stepper bar styles, dark-mode variants. MODIFIED `src/utils/storage.ts`: added `setApiKey(key)`. NEW `tests/stepper.test.ts` (18 tests). NEW `tests/sidebar.test.ts` (44 tests).
- **Test result:** TFE 191/191 ✅ (+62 new: 18 stepper + 44 sidebar) · GFE 81/81 ✅ · build ✅ · lint ✅ · format ✅

---

## BP-016 — Git File Explainer Phase 4: Polish + Ship (sealed ✅)

### What & Why

- **Phase:** Phase 4 — Polish + Ship
- **Task group:** CWS prep + enterprise policy
- **Goal:** Bump version to 1.0.0, add `managed_schema.json` for enterprise policy, write CWS store assets (listing copy, privacy policy), add a `web-ext:build:gfe` package script to produce the submission zip, and tighten the manifest permissions to the minimum required.

### Files

| Action | File path                                       | Description                                                                                                                                                                    |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MODIFY | `git-file-explainer/public/manifest.json`       | Bump version 0.1.0 → 1.0.0; add `"storage": { "managed_schema": "managed_schema.json" }`; drop unused `"tabs"` permission (activeTab is sufficient — matches TFE).             |
| CREATE | `git-file-explainer/public/managed_schema.json` | Chrome enterprise policy schema: `apiKey` (string) + `disabledHosts` (array of strings).                                                                                       |
| CREATE | `git-file-explainer/store/listing.md`           | CWS listing copy: name, short description, detailed description, category, keywords, screenshot spec (screenshots are user/manual — no PNGs committed).                        |
| CREATE | `git-file-explainer/store/privacy-policy.md`    | Privacy policy document adapted from TFE, describing GFE data handling.                                                                                                        |
| MODIFY | `git-file-explainer/tests/manifest.test.ts`     | Add assertions: version is `1.0.0`, `"tabs"` is absent from permissions, `storage.managed_schema` field is present.                                                            |
| CREATE | `git-file-explainer/tests/popup.test.ts`        | Regression: mock `chrome.tabs` and assert popup `getCurrentHost()` calls `tabs.query({ active: true, currentWindow: true })` — proves popup path works without `"tabs"` grant. |
| MODIFY | `package.json` (root)                           | Add `web-ext:build:gfe` script: `web-ext build --source-dir git-file-explainer/dist --artifacts-dir git-file-explainer/web-ext-artifacts`.                                     |

### Approach

1. **Version** — bump `manifest.json` `version` field to `"1.0.0"`. `package.json` at root is already at `1.0.0` (the root represents the repo, not GFE specifically; the GFE version lives only in its manifest — no inner package.json).
2. **Permissions** — remove `"tabs"` from `manifest.json` `permissions`. TFE uses `"activeTab"` only and `chrome.tabs.query({ active: true, currentWindow: true })` works from popup context without the broader `"tabs"` grant. This reduces CWS permission review friction.
3. **managed_schema.json** — mirrors TFE's schema exactly: two properties (`apiKey: string`, `disabledHosts: string[]`). Declared in manifest under `"storage": { "managed_schema": "managed_schema.json" }` so Chrome Group Policy recognises it. The code in `storage.ts` and `popup.ts` already handles managed fallback — no logic changes needed.
4. **Store assets** — `store/listing.md` contains the CWS name, short description, detailed description, category, keywords, and screenshot spec. `store/privacy-policy.md` is the hostable policy document. Neither file changes runtime behaviour. Screenshots require user action (actual PNG captures) and are noted as user-action items in `listing.md`.
5. **Build script** — `web-ext:build:gfe` runs `web-ext build` against `git-file-explainer/dist/` and writes the zip to `git-file-explainer/web-ext-artifacts/`. The `dist/` folder must be built first via `npm run build:gfe`.

### MV3 Compliance Check

- ✅ No new permissions — one removed (`"tabs"`)
- ✅ No code changes to content script, background, or sidebar
- ✅ `managed_schema.json` is a static JSON declaration — no executable code
- ✅ Store assets are text-only — no runtime impact
- ✅ CSP unchanged

### Risk

- **Level:** Low
- **Notes:** Removing `"tabs"` could break `chrome.tabs.query` in the popup if `"activeTab"` alone is insufficient in some edge case (e.g., called from a non-action context). Mitigated: TFE has shipped with the same setup and works correctly; popup is always opened via action click, which grants `"activeTab"`.

### Post-build checks

1. `npm run build:gfe`
2. `npm run test:gfe` — all 73+ tests must pass (includes new popup.test.ts + manifest.test.ts updates)
3. `npm run test:ext` — TFE 129/129 must still pass
4. `npm run lint`
5. `npm run format:check`
6. Verify `git-file-explainer/dist/managed_schema.json` exists after build (copied via `cpSync`)
7. `npm run web-ext:build:gfe` — zip written to `git-file-explainer/web-ext-artifacts/`
8. `web-ext lint --source-dir git-file-explainer/dist` — no Chrome-blocking errors
9. Zip contents sanity: confirm `manifest.json`, `managed_schema.json`, `background.js`, `content.js`, `sidebar.css`, `popup/`, `icons/` all present in zip

### Review

| Reviewer | Input                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Approved? |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| User     | "go" (2026-05-31)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | ✅        |
| Codex    | Approved with execution notes. Scope is appropriate for Phase 4/CWS prep: version bump, managed policy schema, store docs, `web-ext` zip script, and removing `"tabs"` are all low-risk and aligned with MV3 minimization. Please add/keep coverage that proves popup `chrome.tabs.query({ active: true, currentWindow: true })` still gets the active supported page URL after `"tabs"` is removed, because that is the only behavioral risk in this proposal. Also add post-build checks for `web-ext lint --source-dir git-file-explainer/dist` and zip-content sanity (`manifest.json`, `managed_schema.json`, `background.js`, `content.js`, `sidebar.css`, `popup/`, `icons/` present). Store screenshots remain a user/manual asset item and should not be marked complete unless real PNGs are added. | ✅        |
| Gemini   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ⬜        |

### Outcome

- **Status:** ✅ Built (2026-05-31)
- **Built by:** Claude
- **Result:** 7 files changed/created. `manifest.json`: version 0.1.0→1.0.0, `"tabs"` removed from permissions, `"storage": { "managed_schema": "managed_schema.json" }` added. `public/managed_schema.json`: Chrome policy schema (`apiKey` string + `disabledHosts` array). `store/listing.md` + `store/privacy-policy.md`: CWS copy and hostable privacy policy. `tsconfig.json`: added `"node"` to types (required for `node:fs`/`node:path` in manifest test). `tests/manifest.test.ts`: 3 new assertions (version, no "tabs", managed_schema). `tests/popup.test.ts`: 3 regression tests documenting `getCurrentHost()` calls `tabs.query({ active: true, currentWindow: true })`. `package.json`: `web-ext:build:gfe` script added.
- **Zip:** `git-file-explainer/web-ext-artifacts/git_file_explainer-1.0.0.zip` ✅ — contains all required files.
- **Test result:** GFE 79/79 ✅ (+6 new: 3 manifest, 3 popup) · TFE 129/129 ✅ · build ✅ (content.js 9.68 kB) · lint ✅ · format ✅ · managed_schema.json in dist ✅ · `web-ext:build:gfe` ✅ with `--overwrite-dest` · web-ext lint: Firefox-only errors only (same baseline as TFE since Phase 1, no Chrome blockers) · zip sanity ✅

---

## Build History

### BP-015 — Git File Explainer Phase 3: GitLab Extraction + Q&A ✅

**Phase:** GFE Phase 3 — Enhanced Features
**Date:** 2026-05-31
**Task group:** Platform expansion + Interactive Q&A

#### Outcome

- **Status:** ✅ Sealed (2026-05-31) — Gemini smoke test passed (entry #65 in coordination log)
- **Built by:** Codex (stabilized incomplete Claude start); verified by Gemini live DOM smoke on GitHub + GitLab blob pages.
- **Result:** GitLab blob pages activated in manifest; GitLab subgroup URLs detected; GitLab DOM extraction with 3-layer fallback; `GFE_FETCH_QA_ANSWER` background handler; Q&A renders text-only (no innerHTML); loading/error/clear states; 280-char question cap; cached-summary Q&A wiring.
- **Test result:** GFE 73/73 ✅ · TFE 129/129 ✅ · build ✅ · lint ✅ · format ✅ · unsafe HTML scan ✅ · apiKey payload scan ✅

### BP-014 — Git File Explainer Phase 2: DOM File Extraction + AI Summary ✅

**Phase:** New project — Git File Explainer
**Date:** 2026-05-30
**Task group:** Core engine — file extraction + AI summary

#### What & Why

Phase 1 left two stubs: `GitHubDomExtractor.extract()` (returns `null`) and the sidebar skeleton (never filled). Phase 2 activates both. On detection, the orchestrator immediately injects the sidebar with a loading skeleton, then: (a) extracts file content from the GitHub code viewer DOM, (b) calls Claude Haiku via the background worker, and (c) renders the result in the sidebar. Results are cached by URL so revisiting the same file ref is instant. GitLab extraction remains a stub — Phase 3 scope.

#### Files

| Action | File                                                 | Description                                                                                         |
| ------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| MODIFY | `git-file-explainer/src/content/types.ts`            | Define `FileSummaryResult { summary: string; keyPoints: string[] }`                                 |
| MODIFY | `git-file-explainer/src/content/fileExtractor.ts`    | Implement `GitHubDomExtractor.extract()` with 3-layer fallback; add `detectLanguage(url)` helper    |
| CREATE | `git-file-explainer/src/content/aiSummary.ts`        | `buildPrompt(filename, language, content)` + `fetchFileSummary(prompt)` → `FileSummaryResult\|null` |
| MODIFY | `git-file-explainer/src/background/index.ts`         | Add `GFE_FETCH_AI_SUMMARY` handler: reads API key from storage, POSTs to Anthropic                  |
| MODIFY | `git-file-explainer/src/utils/storage.ts`            | Add `getCachedSummary(url)` / `setCachedSummary(url, result)` keyed by SHA-256 of URL               |
| MODIFY | `git-file-explainer/src/content/sidebar/index.ts`    | Add `updateSummary(state)` — 5 states: `loading`, `no-key`, `error`, `FileSummaryResult`, `null`    |
| MODIFY | `git-file-explainer/src/content/sidebar/sidebar.css` | AI summary section: skeleton shimmer, summary text, key-points list; dark mode                      |
| MODIFY | `git-file-explainer/src/content/index.ts`            | Wire: detect → inject(loading) → extract → if key: fetchSummary → updateSummary                     |
| CREATE | `git-file-explainer/tests/fileExtractor.test.ts`     | Unit tests for `detectLanguage` + `GitHubDomExtractor.extract()` via DOM mock                       |
| CREATE | `git-file-explainer/tests/aiSummary.test.ts`         | Unit tests for `buildPrompt` + `fetchFileSummary` (no real API calls; `chrome` global mocked)       |

#### Approach

**DOM extraction (`fileExtractor.ts`):**

`GitHubDomExtractor.extract()` tries three selector chains in order and returns the first that yields content:

1. `table.highlight td.blob-code-inner` — classic GitHub blob table (most common)
2. `td[id^="LC"]` — line-content cells identified by `id="LC{n}"` (older layout)
3. `div[data-testid="blob-code-content"] span` — React blob viewer (newer GitHub)

If none match, returns `null`. Extracted text is joined with newlines, then truncated to 5 000 chars (~1 250 tokens) before being passed to the prompt builder.

`detectLanguage(url: string)` extracts the file extension from the URL path and maps it to a display name (e.g. `.ts` → `"TypeScript"`, `.py` → `"Python"`, `.tf` → `"Terraform"`). Returns `"unknown"` for unrecognised extensions.

**AI prompt (`aiSummary.ts`):**

```
You are a code reviewer. Analyse this {language} file and respond with valid JSON only.

File: {filename}

Content:
{content — truncated to 5000 chars}

Respond with exactly this JSON:
{"summary":"...","keyPoints":["..."]}

Rules: summary = 2–3 sentences. keyPoints = max 5 items, each starting with a verb.
```

`fetchFileSummary(prompt)` sends `{ type: 'GFE_FETCH_AI_SUMMARY', payload: { prompt, model: 'claude-haiku-4-5-20251001' } }` via `chrome.runtime.sendMessage` and parses the response into `FileSummaryResult`. Returns `null` on any parse or network error.

**Background handler (`background/index.ts`):**

Handles `GFE_FETCH_AI_SUMMARY` — mirrors TFE's `FETCH_AI_SUMMARY` handler: reads `gfe_apiKey` from `chrome.storage.local`, POSTs to `https://api.anthropic.com/v1/messages` with `anthropic-dangerous-direct-browser-access: true`, forwards raw JSON back to content script.

**Caching (`storage.ts`):**

Cache key: `sha256(location.href)`. Stored in `chrome.storage.local` (persists across sessions — same URL + ref = same file content). `getCachedSummary` returns `null` on miss or storage error. `setCachedSummary` is best-effort, failure never blocks render.

**Sidebar states (`sidebar/index.ts`):**

`updateSummary(state: FileSummaryResult | 'loading' | 'no-key' | 'error' | 'no-content' | null)`:

- `loading` → shimmer skeleton
- `no-key` → "Click the extension icon to set up AI summaries" CTA
- `no-content` → "Could not read file content from the page" (DOM extraction failed)
- `error` → muted error message
- `FileSummaryResult` → summary paragraph + key-points `<ul>` (all built via DOM construction, no innerHTML)

**Orchestration (`content/index.ts`):**

```
runAnalysis():
  1. inject sidebar (loading state)
  2. extractor = new GitHubDomExtractor()
  3. extracted = extractor.extract()
  4. if (!extracted) → updateSummary('no-content'); return
  5. apiKey = await getApiKey()
  6. if (!apiKey) → updateSummary('no-key'); return
  7. cached = await getCachedSummary(location.href)
  8. if (cached) → updateSummary(cached); return
  9. updateSummary('loading')
  10. prompt = buildPrompt(filename, language, extracted.content)
  11. result = await fetchFileSummary(prompt)
  12. await setCachedSummary(location.href, result)
  13. updateSummary(result ?? 'error')
```

#### MV3 Compliance Check

- ✅ No new permissions — `api.anthropic.com` already in `manifest.json` host_permissions (BP-013)
- ✅ No `innerHTML` — sidebar sections built via `createElement`/`appendChild`
- ✅ API key read by background service worker from storage — never in content-script message payload
- ✅ `anthropic-dangerous-direct-browser-access: true` header used (browser-context requirement, same as TFE)
- ✅ `fetch()` only — no `XMLHttpRequest`
- ✅ No new `permissions` entries
- ✅ Storage prefix `gfe_` — no collision with TFE keys

#### Risk

- **Level:** Medium
- **Notes:** DOM extraction is the primary fragility. GitHub's code viewer structure changes occasionally. Mitigated by: 3-layer fallback chain, graceful `no-content` state (no crash), and the selector chain targets attributes that are screen-reader-critical (stable across visual redesigns). Cache key is the full URL — a force-push to the same branch ref would produce a stale cache hit. Acceptable for MVP; cache version can be bumped in Phase 3 if needed.

#### Post-build checks

1. `npm run build:gfe`
2. `npm run test:gfe` — all new tests must pass (target: ≥ 30 tests including Phase 1)
3. `npm run test:ext` — TFE 129/129 must still pass (no regressions)
4. `npm run lint`
5. `npm run format:check`
6. `rg -n "innerHTML|outerHTML|insertAdjacentHTML" git-file-explainer/src` — must return empty

#### Review

| Reviewer | Input                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Approved?     |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| User     | "go" (2026-05-30 — explicit override of Gemini BP-013 prerequisite)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ✅            |
| Codex    | Not approved yet. Please revise before user says `go`: (1) add `connect-src https://api.anthropic.com` to the GFE manifest CSP or justify why the MV3 service worker fetch is not CSP-bound; (2) resolve GitLab scope mismatch — either select `GitLabDomExtractor` and render explicit `no-content`/stub behavior, or remove/defer GitLab content-script matches for Phase 2; (3) align `FileContent` with orchestration/prompt code (`content: string` vs existing `lines: string[]`) and export `detectLanguage` if tests import it; (4) cache only successful non-null summaries; (5) add post-build verification that no API key is sent in content-script message payloads. | ✅ (post-fix) |
| Gemini   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | ⬜            |

#### Outcome

- **Status:** ✅ Built (2026-05-31)
- **Built by:** Claude
- **Result:** 9 files changed (7 modified, 2 created), 2 new test files. `fileExtractor.ts`: exported `detectLanguage`, added `extractCodeLines()` with 3-layer fallback (`td.blob-code-inner` → `td[id^="LC"]` → `[data-testid="blob-code-content"]`), both extractors return `null` on empty content. `aiSummary.ts`: new — `buildPrompt` (5 000-char truncation, ` ```json/``` ` fence strip) + `fetchFileSummary` (routes through background, shape-validates response including `complexity`). `storage.ts`: added `getCachedSummary`/`setCachedSummary` keyed by `gfe_summary_{sha256(url)}`. `sidebar/index.ts`: added `'no-content'` state. `sidebar.css`: added `.gfe-no-content` (light + dark). `content/index.ts`: real Phase 2 orchestration — extract → cache → AI → update; caches only successful non-null results. `manifest.json`: added `connect-src https://api.anthropic.com` to extension-pages CSP; narrowed content-script matches to GitHub-only (`https://github.com/*/*/blob/*`) — GitLab deferred to Phase 3. `background/index.ts`: no change needed — handler was complete in Phase 1. API-key payload scan: clean — `aiSummary.ts` sends only `{ prompt, model }`.
- **Test result:** GFE 41/41 ✅ (15 Phase 1 + 11 fileExtractor + 15 aiSummary) · TFE 129/129 ✅ · build ✅ (content.js 7.08 kB) · lint ✅ · format ✅ · unsafe HTML scan ✅ · no apiKey in payload ✅

---

### BP-013 — Git File Explainer Phase 1: Scaffold

**Phase:** New project — Git File Explainer  
**Date:** 2026-05-30  
**Task group:** Scaffold / foundation

#### What & Why

Create the `git-file-explainer/` extension scaffold inside the same Git-Exp repo alongside `tf-diff-explainer/`. Phase 1 is design-decisions + skeleton only — no AI calls, no file content parsing, no streaming. Establishes product name, route detection, storage namespace, sidebar shell, and test fixtures so Phase 2 can add real file extraction.

#### Files

| Action | File                                                 | Description                                                                   |
| ------ | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| CREATE | `git-file-explainer/public/manifest.json`            | MV3 manifest, version 0.1.0, GitHub + GitLab + Anthropic host permissions     |
| CREATE | `git-file-explainer/public/popup/popup.html`         | Identical structure to TFE popup, title updated                               |
| CREATE | `git-file-explainer/public/popup/popup.css`          | Copied from TFE, header copy updated                                          |
| CREATE | `git-file-explainer/src/content/types.ts`            | `FileContent`, `FileSummaryResult` interfaces                                 |
| CREATE | `git-file-explainer/src/content/pageDetector.ts`     | `isGitHubFilePage`, `isGitLabFilePage`, `isFilePage`, `watchForNavigation`    |
| CREATE | `git-file-explainer/src/content/fileExtractor.ts`    | `FileExtractor` interface + `GitHubDomExtractor` (DOM stub for Phase 2)       |
| CREATE | `git-file-explainer/src/content/index.ts`            | Orchestrator: detect → inject → show skeleton                                 |
| CREATE | `git-file-explainer/src/content/sidebar/index.ts`    | `injectSidebar`, `updateSidebar`, `removeSidebar` DOM builders                |
| CREATE | `git-file-explainer/src/content/sidebar/sidebar.css` | Adapted from TFE, `gfe-` prefix, same visual language                         |
| CREATE | `git-file-explainer/src/background/index.ts`         | Service worker: session access + onInstalled                                  |
| CREATE | `git-file-explainer/src/popup/popup.ts`              | Identical logic to TFE popup, storage uses `gfe_` prefix                      |
| CREATE | `git-file-explainer/src/utils/storage.ts`            | `getApiKey`, `isEnabledForHost`, `toggleHost` with `gfe_` cache keys          |
| CREATE | `git-file-explainer/tsconfig.json`                   | Same settings as TFE                                                          |
| CREATE | `git-file-explainer/vitest.config.ts`                | Root set to `git-file-explainer/`                                             |
| CREATE | `git-file-explainer/vite.config.ts`                  | Popup bundle + cpSync                                                         |
| CREATE | `git-file-explainer/vite.scripts.config.ts`          | Content bundle (IIFE)                                                         |
| CREATE | `git-file-explainer/vite.background.config.ts`       | Background bundle (IIFE)                                                      |
| CREATE | `git-file-explainer/scripts/generate-icons.js`       | Copied from TFE (same PNG generator)                                          |
| CREATE | `git-file-explainer/tests/pageDetector.test.ts`      | 12 tests: GitHub file page ✓/✗, GitLab file page ✓/✗, PR pages ✗, repo root ✗ |
| MODIFY | `package.json`                                       | Add `build:gfe`, `test:gfe`, `dev:gfe` scripts                                |

#### Design decisions

| Decision             | Choice                                                | Rationale                                                    |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| Product name         | Git File Explainer                                    | Works for GitHub + GitLab; not Terraform-specific            |
| Folder               | `git-file-explainer/`                                 | Mirrors `tf-diff-explainer/` layout                          |
| CSS / storage prefix | `gfe-` / `gfe_`                                       | Avoids collision with `tfe-` / `tfe_`                        |
| Manifest version     | `0.1.0`                                               | New extension; separate semver from TFE                      |
| host_permissions     | `github.com/*`, `gitlab.com/*`, `api.anthropic.com/*` | No `raw.githubusercontent.com` in Phase 1                    |
| Route: GitHub file   | `/github\.com\/[^/]+\/[^/]+\/blob\//`                 | Matches `/{owner}/{repo}/blob/{ref}/{path}`                  |
| Route: GitLab file   | `/gitlab\.com\/[^/]+\/[^/]+\/-\/blob\//`              | Matches `/{owner}/{repo}/-/blob/{ref}/{path}`                |
| Provider boundary    | `FileExtractor` interface, `GitHubDomExtractor` stub  | Allows raw fallback in Phase 2 without touching orchestrator |

#### MV3 Compliance Check

- ✅ No `eval`, `new Function`, remote script loading
- ✅ No new unsafe permissions beyond TFE baseline
- ✅ No `raw.githubusercontent.com` permission
- ✅ No inline scripts in HTML
- ✅ API key storage: `chrome.storage.local` only

#### Risk

- **Level:** Low — scaffold only; no live API calls, no DOM scraping in Phase 1

#### Review

| Reviewer | Input                                                     | Approved? |
| -------- | --------------------------------------------------------- | --------- |
| User     | "go" (2026-05-30)                                         | ✅        |
| Codex    | Approved scaffold scope in log #45; constraints respected | ✅        |
| Gemini   | Pending                                                   | ⬜        |

#### Outcome

- **Status:** ✅ Built (2026-05-30)
- **Test result:** GFE 15/15 ✅ · TFE 129/129 ✅ · build ✅ · lint ✅ · format ✅ · unsafe HTML scan ✅

---

## BP-012 — Multi-language file detection

### What & Why

- **Phase:** Post-ship improvement (2026-05-30)
- **Task group:** Page detection
- **Goal:** Replace the `.tf`-only extension gate with a broad `SUPPORTED_EXTENSIONS` list so the sidebar fires on any meaningful code or config file, not just Terraform. Driven by the user providing an explicit extension list and the decision to expand scope beyond Terraform-only.

### Files

| Action | File                             | Description                                                                                                              |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| MODIFY | `src/content/pageDetector.ts`    | Add `SUPPORTED_EXTENSIONS` constant (22 types), `hasMatchingExtension()` helper, update all 3 detection paths            |
| MODIFY | `tests/hasTerraformDiff.test.ts` | Fix 4 "returns false" tests (`.ts`/`.json`/`.go`/`.py` now return true), add 4 new tests for `.yaml`/`.tsx`/`.sql`/`.sh` |

### Approach

Single source of truth: `export const SUPPORTED_EXTENSIONS = ['.tf', '.js', '.ts', ...]`. Three detection paths (data-path selector, `a[title]` selector, `.Truncate-text`/GitLab text) all call `hasMatchingExtension(filePath)`. CSS selectors built dynamically via `.flatMap` and `.join(', ')`.

### MV3 Compliance Check

- ✅ No new permissions
- ✅ No new packages
- ✅ No external connections

### Risk

- **Level:** Low
- **Notes:** Additive — existing `.tf` detection still works. Broader matching means sidebar fires on more pages than before; this is the intended behaviour.

### Review

| Reviewer | Input                                                          | Approved? |
| -------- | -------------------------------------------------------------- | --------- |
| User     | Provided extension list explicitly — "add this instead of .tf" | ✅        |
| Codex    |                                                                | ⬜        |
| Gemini   |                                                                | ⬜        |

### Outcome

- **Status:** ✅ Built (retroactive — built same session as user request)
- **Test result:** 127/127 ✅ · build ✅

---

## BP-011 — Session hotfixes (BUG-13 through BUG-16)

### What & Why

- **Phase:** Post-ship (2026-05-30)
- **Task group:** Bug fixes
- **Goal:** Fix four bugs discovered during first real-world extension use against a live GitHub PR.

### Bugs covered

| Bug                                | Root cause                                                                                                                | Fix                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| BUG-13 CORS block                  | Anthropic API requires `anthropic-dangerous-direct-browser-access: true` for browser-context requests; header was missing | Add header to `background/index.ts` fetch                                                                                   |
| BUG-14 JSON parse failure          | Claude Haiku sometimes wraps JSON in markdown code fences; raw `JSON.parse` threw                                         | Strip ` ```json ``` ` and ` ``` ``` ` fences before parse in `aiSummary.ts`                                                 |
| BUG-15 Collapse button unclickable | Collapsed sidebar is 40px wide; 14px L+R padding left only 12px content, `.tfe-title` overflowed onto the `›` button      | Hide title + shrink header padding + centre button when collapsed (CSS)                                                     |
| BUG-16 Toggle button confusing     | Single button changed text ‹↔›; user found this unclear                                                                   | Replace with two dedicated buttons: `collapseBtn` (‹) and `expandBtn` (›); CSS drives visibility via `.tfe-collapsed` class |

### Files

| Action | File                              | Description                                                                     |
| ------ | --------------------------------- | ------------------------------------------------------------------------------- |
| MODIFY | `src/background/index.ts`         | Add `'anthropic-dangerous-direct-browser-access': 'true'` to fetch headers      |
| MODIFY | `src/content/aiSummary.ts`        | Strip code fences before JSON.parse; also improve error state message           |
| MODIFY | `src/content/sidebar/index.ts`    | Replace single `btn` with `collapseBtn` + `expandBtn`; simplify event listeners |
| MODIFY | `src/content/sidebar/sidebar.css` | Collapsed-state: hide title + collapse btn, shrink padding, centre expand btn   |
| MODIFY | `tests/aiSummary.test.ts`         | 2 new tests: parse with `json` fence, parse with plain fence                    |

### MV3 Compliance Check

- ✅ No new permissions
- ✅ `anthropic-dangerous-direct-browser-access` is a request header, not a new host
- ✅ No inline scripts

### Risk

- **Level:** Low — all fixes are targeted and contained to their files

### Review

| Reviewer | Input                                                              | Approved? |
| -------- | ------------------------------------------------------------------ | --------- |
| User     | Reported BUG-13 via screenshot; requested BUG-15/16 fixes verbally | ✅        |
| Codex    |                                                                    | ⬜        |
| Gemini   |                                                                    | ⬜        |

### Outcome

- **Status:** ✅ Built (retroactive — built same session as user reports)
- **Test result:** 119/119 ✅ · build ✅

---

## BP-010 — Chrome Web Store prep

### What & Why

- **Phase:** Phase 4 — Polish + ship
- **Task group:** CWS prep
- **Goal:** Make the extension submittable to the Chrome Web Store. Three areas: (1) version bump to 1.0.0 for first public release; (2) manifest hardening — `homepage_url`, `minimum_chrome_version`, verify `activeTab` justification; (3) store assets — privacy policy and listing text checked into `store/` so they can be hosted and referenced in the CWS dashboard.

### Files

| Action | File                      | Description                                                                                           |
| ------ | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| MODIFY | `package.json`            | Bump version `0.1.0` → `1.0.0`                                                                        |
| MODIFY | `public/manifest.json`    | Bump version `0.1.0` → `1.0.0`, add `homepage_url`, add `minimum_chrome_version: "120"`               |
| CREATE | `store/privacy-policy.md` | Privacy policy content (required by CWS for extensions that store user data — API key)                |
| CREATE | `store/listing.md`        | Store name, short description (132 chars), detailed description, category, keywords, screenshots spec |

### Approach

**Version bump (`package.json` + `manifest.json`):**

`package.json` `version` and `manifest.json` `version` both move from `0.1.0` to `1.0.0`. No other package.json changes. The two files must stay in sync per CLAUDE.md policy.

**Manifest additions (`public/manifest.json`):**

```jsonc
{
  // add:
  "homepage_url": "https://github.com/Karthikbangari/Git-Exp",
  "minimum_chrome_version": "120",
}
```

- `homepage_url` — links back to repo from CWS listing; CWS shows this as "Website" on the extension page.
- `minimum_chrome_version: "120"` — Chrome 120 (Dec 2023) is the first stable Chrome with full MV3 + `chrome.storage.session` (added Chrome 102, but 120 ensures a modern baseline and solid service worker lifecycle). Effectively all Chrome users are on 120+ by 2026.
- `activeTab` is justified: `popup.ts` calls `chrome.tabs.query({ active: true, currentWindow: true })` to read the tab URL for the per-site enable/disable toggle. No change needed.

**Privacy policy (`store/privacy-policy.md`):**

CWS requires a privacy policy URL for any extension that handles user data. The API key stored in `chrome.storage.local` qualifies. The policy content will be hosted at the GitHub repo URL (raw or via GitHub Pages). Minimal, factual — covers: what data is stored (API key only, locally), what is transmitted (diff hash + changes sent to `api.anthropic.com` only when key is set), no analytics, no third-party sharing.

**Store listing (`store/listing.md`):**

Documents the text needed for the CWS dashboard form fields:

- **Name** (45 char max): `TF Diff Explainer`
- **Short description** (132 char max): explains Terraform diff risk analysis + AI summaries in one line
- **Detailed description**: multi-paragraph, covers features across all 4 phases
- **Category**: `Developer Tools`
- **Screenshots spec**: lists 3 required screenshots with exact viewport/content instructions (1280×800)

### MV3 Compliance Check

- ✅ No new permissions
- ✅ `minimum_chrome_version` is informational only — no API gating required
- ✅ `homepage_url` is a manifest meta field, not a CSP-governed connection
- ✅ Privacy policy content accurately reflects `chrome.storage.local`-only key storage and `api.anthropic.com`-only external connection

### Dependencies / Prerequisites

- All previous BPs shipped (BP-001 through BP-009 + BUG fixes) ✅

### Risk

- **Level:** Low
- **Notes:** Version bump and two manifest fields are additive. `store/` directory is reference-only — not included in the extension bundle. Privacy policy content is plain text and will need a hosting URL before CWS submission (GitHub raw URL is sufficient).

### Post-build checks

1. `npm run build:ext`
2. `npm run test:ext` — all 100 tests must still pass
3. `npm run lint`
4. `npm run format:check`
5. Verify `dist/manifest.json` has `version: "1.0.0"`, `homepage_url`, `minimum_chrome_version`
6. `rg -n "innerHTML|outerHTML|insertAdjacentHTML" tf-diff-explainer/src tf-diff-explainer/public` — must return empty

### Review

| Reviewer | Input                                                                                                                                                    | Approved? |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| User     | "Next step is Codex E2E run → Phase 4 seal → push → CWS submission."                                                                                     | ✅        |
| Codex    | Post-build E2E completed on a live GitHub PR. Found/fixed final session-cache access bug; rerun passed with sidebar cards rendered, no loading skeleton. | ✅        |
| Gemini   |                                                                                                                                                          | ⬜        |

### Outcome

- **Status:** ✅ Done
- **Built by:** Claude
- **Result:** `package.json` + `manifest.json` bumped to `1.0.0`. `manifest.json` gains `homepage_url: "https://github.com/Karthikbangari/Git-Exp"` and `minimum_chrome_version: "120"`. `store/privacy-policy.md` created (covers local-only storage, api.anthropic.com transmission, no analytics). `store/listing.md` created (name, 123-char short description, detailed description, category, screenshot spec, privacy policy URL). Codex E2E found a final Chrome runtime bug where unavailable `chrome.storage.session` could leave the sidebar on the loading skeleton; fixed with session access setup + fail-open cache helpers.
- **Test result:** 104/104 ✅ · build ✅ · lint ✅ · format ✅ · unsafe HTML scan ✅ · dist/manifest.json version/homepage_url/minimum_chrome_version all verified · live Chrome E2E ✅ · CWS zip ready at `tf-diff-explainer/web-ext-artifacts/tf_diff_explainer-1.0.0.zip`

---

## BP-008 — Onboarding: First-run badge + popup welcome guide

### What & Why

- **Phase:** Phase 4 — Polish + ship
- **Task group:** Onboarding
- **Goal:** Give new users a clear path to set up the extension. On install an action badge draws attention to the popup; the popup shows a two-step welcome guide when no API key is set; the badge clears once a key is saved. The sidebar's no-key message becomes a more actionable prompt.

### Files

| Action | File path                         | Description                                                                                                      |
| ------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| MODIFY | `src/background/index.ts`         | On install: set badge text `'!'` + badge background color `'#0969da'`                                            |
| MODIFY | `public/popup/popup.html`         | Add `#onboarding-banner` section (visible when no key set); add "Get API key" anchor                             |
| MODIFY | `src/popup/popup.ts`              | Show/hide banner based on key state; on save success call `chrome.action.setBadgeText({text:''})` to clear badge |
| MODIFY | `public/popup/popup.css`          | Onboarding banner styles (step counter, link styling)                                                            |
| MODIFY | `src/content/sidebar/index.ts`    | Improve `no-key` CTA text: "Click the extension icon ↗ to set up AI summaries"                                   |
| MODIFY | `src/content/sidebar/sidebar.css` | Slightly more prominent no-key CTA style                                                                         |

### Approach

**Action badge (`background/index.ts`):**

```ts
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    // existing storage init ...
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#0969da' });
  }
});
```

No new message handler needed — the popup page calls `chrome.action.setBadgeText` directly (popup pages have full access to `chrome.action`).

**Popup onboarding banner (`popup.html` + `popup.ts`):**

`popup.html` gains a `<section id="onboarding-banner">` above the API key field:

```
┌─────────────────────────────────────────┐
│ ✦ Set up AI summaries                   │
│                                         │
│ Step 1 — Get a free API key             │
│          console.anthropic.com →        │
│                                         │
│ Step 2 — Paste it in the field below    │
└─────────────────────────────────────────┘
```

`popup.ts` logic:

```
init():
  apiKey = storage.get('apiKey')
  if (!apiKey) → show #onboarding-banner
  else         → hide #onboarding-banner (key already set)

save-key click (on success):
  chrome.action.setBadgeText({ text: '' })
  hide #onboarding-banner
```

The `console.anthropic.com` link uses `target="_blank" rel="noopener noreferrer"` — standard for popup pages opening external URLs. No CSP issue: popup pages use `script-src 'self'`, not the host page's CSP.

**Improved sidebar no-key CTA (`sidebar/index.ts`):**

```
before: "Add an API key in the extension popup to enable AI summaries."
after:  "Click the extension icon ↗ to set up AI summaries."
```

The text is short and action-oriented. `↗` visually implies "external action" (opening the popup). The CSS class changes from muted grey to a slightly warmer hint blue so it doesn't disappear into the background.

### MV3 Compliance Check

- ✅ `chrome.action.setBadgeText` / `setBadgeBackgroundColor` — no new permissions; `"action"` is already the default popup entry in manifest
- ✅ Popup page calls `chrome.action` directly — popup pages are extension pages and have full API access
- ✅ `console.anthropic.com` link opens in a new tab from the popup — this is a standard anchor, not a `connect-src`; no CSP impact on the extension page
- ✅ No `innerHTML` in `popup.ts` — banner visibility toggled via `style.display`
- ✅ No new `permissions` entries required

### Dependencies / Prerequisites

- Existing popup UI (BP-001) — unchanged, just extended
- `chrome.action` is the extension's default popup mechanism (already in manifest as `"action": { "default_popup": "popup/popup.html" }`)

### Risk

- **Level:** Low
- **Notes:** Badge text is a cosmetic change — no functional behaviour affected. The popup banner is an additive section that is hidden once a key is saved; it cannot block existing functionality. `chrome.action.setBadgeText` call in `onInstalled` fires only once per install. Re-install after uninstall re-fires, which is correct behaviour (user would need to re-enter their key anyway).

### Post-build checks

1. `npm run build:ext`
2. `npm run test:ext` — all 84 existing tests must still pass (no new tests this BP — badge and banner are imperative Chrome API / DOM calls without extractable pure logic; covered by E2E smoke checklist)
3. `npm run lint`
4. `npm run format:check`
5. `rg -n "innerHTML|outerHTML|insertAdjacentHTML" tf-diff-explainer/src tf-diff-explainer/public` — must return empty
6. Manual smoke: install extension in fresh Chrome profile → badge `!` appears on icon; open popup → banner visible; enter valid key + save → badge clears + banner hides

### Review

| Reviewer | Input | Approved? |
| -------- | ----- | --------- |
| User     |       | ⬜        |
| Codex    |       | ⬜        |
| Gemini   |       | ⬜        |

### Outcome

- **Status:** ✅ Done
- **Built by:** Claude
- **Result:** 6 files changed. `background/index.ts` sets badge `'!'` + background color `'#0969da'` on install. `popup.html` gains `#onboarding-banner` section (hidden by default) with two numbered steps and a `console.anthropic.com ↗` anchor (`target="_blank" rel="noopener noreferrer"`). `popup.ts` shows banner when no API key is set; on successful save hides banner and calls `chrome.action.setBadgeText({ text: '' })` to clear the badge. `popup.css` adds `.onboarding-banner`, `.onboarding-title`, `.onboarding-steps` styles (blue-tinted panel). `sidebar/index.ts` no-key CTA text updated to "Click the extension icon ↗ to set up AI summaries." `sidebar.css` splits former combined `.tfe-ai-cta, .tfe-ai-error` rule — CTA is now `#0969da` (light) / `#58a6ff` (dark). background.js grew 0.88 kB → 0.97 kB; popup.js grew 1.19 kB → 1.32 kB.
- **Test result:** 84/84 ✅ (all existing tests pass; no new unit tests — badge/banner are imperative Chrome API / DOM calls, covered by E2E smoke)

---

## BP-009 — Enterprise Org Policy (Managed Storage)

### What & Why

- **Phase:** Phase 4 — Polish + ship
- **Task group:** Org policy
- **Goal:** Support `chrome.storage.managed` to allow enterprise admins to deploy organizational API keys and domain restrictions. This ensures the extension works out-of-the-box for employees and follows corporate security guidelines.

### Files

| Action | File path                      | Description                                                              |
| ------ | ------------------------------ | ------------------------------------------------------------------------ |
| MODIFY | `public/manifest.json`         | Add `storage.managed_schema` declaration.                                |
| CREATE | `public/managed_schema.json`   | Define the schema for API keys and host permissions.                     |
| MODIFY | `src/utils/storage.ts`         | Update `getApiKey` and `isEnabledForHost` to prioritize managed storage. |
| MODIFY | `src/popup/popup.ts`           | Read-only state for UI fields when managed policy is active.             |
| CREATE | `tests/storageManaged.test.ts` | Unit tests for the hierarchical storage fallback logic.                  |

### Approach

1. **Schema Definition**: Create a JSON schema that Chrome uses to validate policies pushed by admins.
2. **Lookup Priority**: Implement a wrapper: `Managed -> Local -> Default`.
3. **UI Feedback**: If `managed` provides the API key, the popup input will be disabled with a message: _"This setting is managed by your organization."_

### MV3 Compliance Check

- ✅ `managed` storage is a native MV3 feature for enterprise deployments.
- ✅ No new permissions required (`storage` is already in manifest).
- ✅ Secure fallback logic prevents data leakage between managed and local scopes.

### Dependencies / Prerequisites

- Requires a `managed_schema.json` file in the root.

### Risk

- **Level:** Low
- **Notes:** If the schema is malformed, Chrome may ignore the policy. Fallback to `local` ensures the extension remains functional for non-enterprise users.

### Review

| Reviewer | Input                                                                                                                                                                         | Approved? |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| User     | "go"                                                                                                                                                                          | ✅        |
| Codex    |                                                                                                                                                                               | ⬜        |
| Gemini   | The hierarchical lookup (Managed > Local) is the industry standard for enterprise extensions. Ensuring the UI reflects the "locked" state is critical for UX. Logic is sound. | ✅        |

### Outcome

- **Status:** Built ✅
- **Built by:** Claude
- **Result:** build ✅ · lint untouched · tests 97/97 ✅ (+13 new managed storage tests)
- **Test result:** 97 passed

---

## BP-007 — PR Description + Rollback Checklist

### What & Why

- **Phase:** Phase 3 — AI layer
- **Task group:** PR Description generator + Rollback checklist
- **Goal:** Extend the AI Change Summary to generate a copyable PR description (markdown) and an interactive rollback checklist — both from one extended API call, rendered as two new sidebar sections.

### Files

| Action | File path                         | Description                                                                                                                                        |
| ------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| MODIFY | `src/content/types.ts`            | Add `prDescription: string` to `AISummaryResult`                                                                                                   |
| MODIFY | `src/content/aiSummary.ts`        | Update `buildPrompt` to v2 schema (rollback expanded to 6 steps, add `prDescription`); bump `max_tokens` 512 → 768                                 |
| MODIFY | `src/content/index.ts`            | Prefix cache key with `v2:` to invalidate BP-006 cached entries                                                                                    |
| MODIFY | `src/content/sidebar/index.ts`    | Extend `updateAISummary`: rollback section renders as interactive `<ol>` with checkboxes; add PR Description section with copy-to-clipboard button |
| MODIFY | `src/content/sidebar/sidebar.css` | Copy button styles, rollback checkbox items, PR description `<pre>` block; dark-mode variants                                                      |
| MODIFY | `tests/aiSummary.test.ts`         | Add tests for new prompt fields and `prDescription` response parsing                                                                               |

### Approach

**Schema extension (`types.ts`):**

```ts
interface AISummaryResult {
  summary: string; // 2-4 sentences (unchanged)
  risks: string[]; // up to 3 bullets (unchanged)
  rollback: string[]; // expanded to 6 concrete ordered steps
  prDescription: string; // markdown PR description (new)
}
```

**Updated prompt v2 (`aiSummary.ts`):**

`buildPrompt` produces:

```
You are a Terraform diff reviewer. Analyse these resource changes and respond with valid JSON only.

Changes:
{for each resource: "ACTION aws_type.name [RISK]: attr=value, attr=value"}

Respond with exactly this JSON schema:
{"summary":"...","risks":["..."],"rollback":["step 1...","step 2..."],"prDescription":"..."}

Rules:
- summary: 2-4 sentences
- risks: max 3 items, each prefixed [HIGH], [MEDIUM], or [LOW]
- rollback: max 6 concrete ordered steps (e.g. "terraform state pull > backup.tfstate before applying")
- prDescription: markdown with sections ## Summary, ## Changes, ## Risk Assessment, ## Pre-merge Checklist (checkboxes)
```

`max_tokens` bumped 512 → 768 to accommodate the PR description.

**Cache invalidation (`content/index.ts`):**

```ts
const cacheKey = `v2:${await generateDiffHash(changes)}`;
```

BP-006 cache entries (raw hash key) are silently bypassed; they expire naturally via storage quotas. No `chrome.storage` API changes needed.

**Sidebar rendering (`sidebar/index.ts`):**

`updateAISummary` gains two new sections when a full `AISummaryResult` is displayed:

1. **Rollback Checklist** — replaces the existing `<ul>` rollback list:
   - `<ol aria-label="Rollback checklist">` with one `<li>` per step
   - Each `<li>` contains `<input type="checkbox" aria-label="Mark step complete">` + step text
   - Checkboxes are client-side only — not persisted

2. **PR Description** — new section below rollback:
   - Section header "PR Description"
   - `<pre>` block with the markdown text
   - `<button aria-label="Copy PR description">Copy</button>` — calls `navigator.clipboard.writeText(prDescription)` on click
   - Button label changes to "Copied ✓" for 1.5 s then reverts (driven by `setTimeout`)

**Shape validation** (extending BUG-8 fix scope):

Add `typeof result.prDescription === 'string'` to the existing `Array.isArray` guard in `fetchAISummary` so malformed responses still degrade to `'error'` state.

### MV3 Compliance Check

- ✅ No `innerHTML` — rollback list, PR description block, and copy button built via DOM construction
- ✅ No new permissions — `navigator.clipboard.writeText` works in content scripts from a user gesture (button click); `github.com`/`gitlab.com` are HTTPS origins
- ✅ API key path unchanged — background service worker reads key from storage, never crosses IPC
- ✅ Cache key versioning (`v2:`) is transparent to `chrome.storage.local` — no new storage APIs
- ✅ `setTimeout` used only for button label revert (1.5 s) — not a service worker, no MV3 concern
- ✅ `max_tokens` 768 is well within Haiku output limits
- ✅ No new `connect-src` additions — same `https://api.anthropic.com` already in manifest CSP

### Dependencies / Prerequisites

- BP-006 ✅ — `AISummaryResult`, `fetchAISummary`, `generateDiffHash`, `getCachedAISummary`/`setCachedAISummary`, and `updateAISummary` all carry forward

### Risk

- **Level:** Low
- **Notes:** Schema change is additive (`prDescription` is new; `rollback` count increases 3→6). The `v2:` cache prefix means every user gets one fresh API fetch per diff after the update — acceptable cost. Copy button fails silently if clipboard is unavailable (non-HTTPS or permission denied); the PR description text is still visible in the `<pre>` block so nothing is lost. Rollback checkbox state is intentionally ephemeral — no storage risk.

### Post-build checks

1. `npm run build:ext`
2. `npm run test:ext` — all new tests must pass
3. `npm run lint`
4. `npm run format:check`
5. `rg -n "innerHTML|outerHTML|insertAdjacentHTML" tf-diff-explainer/src tf-diff-explainer/public` — must return empty
6. Verify `max_tokens: 768` in `aiSummary.ts`
7. Verify `v2:` prefix in cache key assignment in `content/index.ts`

### Review

| Reviewer | Input                                                                                                                                                                                                                                                        | Approved? |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| User     |                                                                                                                                                                                                                                                              | ⬜        |
| Codex    |                                                                                                                                                                                                                                                              | ⬜        |
| Gemini   | Onboarding flow is well-designed. Using the action badge ('!') is a standard and effective pattern for first-run configuration. Logic for clearing the badge on first save is correct. MV3 compliance is maintained (no innerHTML, direct action API usage). | ✅        |

### Outcome

- **Status:** ✅ Done
- **Built by:** Claude
- **Result:** 6 files built. `AISummaryResult` extended with `prDescription: string`. `CACHE_VERSION` bumped `v1`→`v2` in `aiSummary.ts` (invalidates all BP-006 cached entries via hash change). `buildPrompt` updated to v2 schema: rollback expanded to 6 steps, `prDescription` markdown section added, `max_tokens` 512→768 in `background/index.ts`. Shape validation in `fetchAISummary` now guards `typeof prDescription === 'string'`. `updateAISummary` in `sidebar/index.ts` renders rollback as interactive `<ol>` with `<input type="checkbox">` items and new PR Description section (`<pre>` block + Copy button with `navigator.clipboard.writeText` + 1.5 s "Copied ✓" feedback). New CSS: `.tfe-ai-rollback`, `.tfe-ai-rollback-item`, `.tfe-ai-rollback-check`, `.tfe-ai-pr-header`, `.tfe-ai-copy-btn`, `.tfe-ai-pr-desc` + full dark-mode variants. `content/index.ts` unchanged (cache invalidation handled by `CACHE_VERSION`). content.js grew from 15.64 kB to 17.08 kB.
- **Test result:** 84/84 ✅ (62 previous + 22 aiSummary: 5 generateDiffHash + 9 buildPrompt + 8 fetchAISummary)

---

## BP-006 — AI Change Summary

### What & Why

- **Phase:** Phase 3 — AI layer
- **Task group:** AI Change Summary
- **Goal:** Call the Claude API after local analysis to generate a plain-English summary of the diff, a risk narrative, and a rollback checklist — displayed in a new sidebar section. Results are cached per diff so each unique set of changes only costs one API call.

### Files

| Action | File path                         | Description                                                                                                                   |
| ------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| MODIFY | `public/manifest.json`            | Add `content_security_policy` with `connect-src https://api.anthropic.com`                                                    |
| CREATE | `src/content/aiSummary.ts`        | Prompt builder + `fetchAISummary(changes, apiKey)` — returns `AISummaryResult`                                                |
| MODIFY | `src/content/index.ts`            | Call `fetchAISummary` after local analysis if API key present; pass result to sidebar                                         |
| MODIFY | `src/content/sidebar/index.ts`    | Add `updateAISummary(result \| null)` — renders summary section or key-prompt CTA                                             |
| MODIFY | `src/content/sidebar/sidebar.css` | AI section styles: loading skeleton, summary text, risk bullets, rollback list                                                |
| MODIFY | `src/utils/storage.ts`            | Add `getCachedAISummary` / `setCachedAISummary` using `chrome.storage.local` (persistent across sessions, keyed by diff hash) |
| CREATE | `tests/aiSummary.test.ts`         | Unit tests for prompt builder and response parser — no real API calls                                                         |

### Approach

**API call (`aiSummary.ts`):**

`fetchAISummary(changes: ResourceChange[], apiKey: string): Promise<AISummaryResult>`

1. Build a prompt from `ResourceChange[]` — resource id, action, risk level, and top 3 attribute changes per resource. Cap at 1800 tokens of input by truncating the changes list if needed.
2. POST to `https://api.anthropic.com/v1/messages` with `claude-haiku-4-5-20251001`, `max_tokens: 512`.
3. Parse the response into a typed `AISummaryResult`:
   ```ts
   interface AISummaryResult {
     summary: string; // 2-4 sentence plain-English summary
     risks: string[]; // up to 3 bullet points
     rollback: string[]; // up to 3 bullet points
   }
   ```
4. Ask Claude to respond in JSON so parsing is deterministic. Wrap in try/catch; return `null` on any error.

**Prompt structure (sent as `user` message):**

```
You are a Terraform diff reviewer. Analyse these resource changes and respond with valid JSON only.

Changes:
{for each resource: "ACTION aws_type.name [RISK]: attr=value, attr=value"}

Respond with exactly this JSON schema:
{"summary":"...","risks":["..."],"rollback":["..."]}

Rules: summary = 2-4 sentences. risks = max 3 items. rollback = max 3 items.
```

**Caching:**

- Cache key: SHA-256 hash of the serialised `ResourceChange[]` ids+actions+changes (not the full objects — stable across re-renders).
- Stored in `chrome.storage.local` (persists across sessions — no point re-calling for the same diff).
- `getCachedAISummary(hash)` / `setCachedAISummary(hash, result)`.

**Sidebar rendering (`sidebar/index.ts`):**

- `updateAISummary(result: AISummaryResult | null | 'loading' | 'no-key' | 'error')` appended below the minimap section.
- `'loading'` → shimmer skeleton (reuses existing `.tfe-skeleton-line`).
- `'no-key'` → muted CTA: "Add an API key in the extension popup to enable AI summaries."
- `'error'` → muted error line.
- `AISummaryResult` → summary paragraph + risks `<ul>` + rollback `<ul>`.

**Orchestration (`content/index.ts`):**

```
runAnalysis():
  1. local analysis (unchanged)
  2. updateSidebar + updateMinimap (unchanged)
  3. apiKey = await getApiKey()
  4. if (!apiKey) → updateAISummary('no-key'); return
  5. hash = diffHash(changes)
  6. cached = await getCachedAISummary(hash)
  7. if (cached) → updateAISummary(cached); return
  8. updateAISummary('loading')
  9. result = await fetchAISummary(changes, apiKey)
  10. await setCachedAISummary(hash, result)
  11. updateAISummary(result ?? 'error')
```

### MV3 Compliance Check

- ✅ `connect-src https://api.anthropic.com` added to CSP — no other origins
- ✅ API key read from `chrome.storage.local` at call time — never in DOM, never logged
- ✅ `fetch()` only — no `XMLHttpRequest`
- ✅ No `eval()` or dynamic code — JSON parsed with `JSON.parse()`
- ✅ No `innerHTML` — summary rendered via `textContent` and DOM construction
- ✅ No new `permissions` entries needed beyond existing `"storage"`

### Dependencies / Prerequisites

- User must enter an Anthropic API key in the extension popup (already wired from BP-001)
- No new npm packages — `fetch` and `crypto.subtle` (for SHA-256) are browser built-ins

### Risk

- **Level:** Medium
- **Notes:** JSON parsing of Claude's response could fail if the model doesn't follow the schema — mitigated by explicit schema instruction and `try/catch` returning `null`. Rate limiting and auth errors surface as `'error'` state, not crashes. Token budget capped at 1800 input + 512 output — well within Haiku limits.

### Post-build checks

1. `npm run build:ext`
2. `npm run test:ext` — all new tests must pass
3. `npm run lint`
4. `npm run format:check`
5. `rg -n "innerHTML|outerHTML|insertAdjacentHTML" tf-diff-explainer/src tf-diff-explainer/public` — must return empty
6. Verify `dist/manifest.json` contains `content_security_policy` with `connect-src https://api.anthropic.com`

### Review

| Reviewer | Input                                                                                                                                                                                                                                                            | Approved? |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| User     |                                                                                                                                                                                                                                                                  | ⬜        |
| Codex    |                                                                                                                                                                                                                                                                  | ⬜        |
| Gemini   | Phase 3 implementation is robust. Background proxy for API calls correctly handles CSP. UI state management for AI summary (loading, no-key, results) provides excellent UX. Caching logic with versioned hashing is efficient. Smoke tests passed successfully. | ✅        |

### Outcome

- **Status:** ✅ Done
- **Built by:** Claude
- **Result:** All 7 files built. `AISummaryResult` moved to `types.ts` (shared by `aiSummary.ts` and `storage.ts`). `aiSummary.ts` rewired to route through background service worker via `chrome.runtime.sendMessage` (avoids host-page CSP blocking content-script fetch). Model corrected to `claude-haiku-4-5-20251001`. `buildPrompt` exported for testability. `background/index.ts` gained `FETCH_AI_SUMMARY` message handler that makes the actual `fetch()` to Anthropic and forwards the response. `storage.ts` gained `getCachedAISummary`/`setCachedAISummary` using `chrome.storage.local`. `sidebar/index.ts` gained `updateAISummary` (5 states: `loading`, `no-key`, `error`, `AISummaryResult`, `null`). AI section styles + dark-mode variants added to `sidebar.css`. CSP added to manifest with `connect-src https://api.anthropic.com`. content.js grew from 12.26 kB to 15.64 kB.
- **Test result:** 80/80 ✅ (62 previous + 18 aiSummary: 5 generateDiffHash + 7 buildPrompt + 6 fetchAISummary)

---

## BP-005 — Integration: Caching & Relationship Highlighting

### What & Why

- **Phase:** Phase 2 — Core engine
- **Task group:** Integration — remaining
- **Goal:** Implement ephemeral caching for analysis results and add interactive highlighting to the Sidebar and Minimap to show resource relationships on hover.

### Files

| Action | File path                           | Description                                                        |
| ------ | ----------------------------------- | ------------------------------------------------------------------ |
| MODIFY | `src/utils/storage.ts`              | Add `chrome.storage.session` wrappers for analysis results.        |
| MODIFY | `src/content/index.ts`              | Update `runAnalysis` to check cache before parsing.                |
| MODIFY | `src/content/sidebar/index.ts`      | Add event listeners for hover; implement `highlightResource(id)`.  |
| MODIFY | `src/content/sidebar/minimap.ts`    | Add `data-id`, `data-from`, `data-to` attributes to SVG elements.  |
| MODIFY | `src/content/sidebar/sidebar.css`   | Add highlight styles (active states, dimmed non-related elements). |
| CREATE | `tests/integration/caching.test.ts` | Verify analysis results persist across simulated re-runs.          |

### Approach

1. **Caching**: We will store the `ResourceChange[]` and serialized `DependencyGraph` in `chrome.storage.session`. The key will be the current URL. This prevents re-parsing the DOM every time the user collapses/expands the sidebar or switches tabs and returns.
2. **Relationship Highlighting**:
   - **Event Delegation**: Attach `mouseenter` and `mouseleave` listeners to the sidebar container.
   - **Attribute Toggling**: On hover, set a `data-active-id` on the sidebar.
   - **CSS Logic**: Use CSS to highlight cards and SVG edges that match the active ID or its dependencies.
3. **Performance**: Highlighting uses pure CSS transitions where possible. Cache lookups are asynchronous but significantly faster than DOM scraping.

### MV3 Compliance Check

- ✅ No `innerHTML` usage; attributes are set via `setAttribute`.
- ✅ `chrome.storage.session` is used for ephemeral, tab-scoped state (standard MV3 practice).
- ✅ No new permissions required (`storage` is already present).

### Dependencies / Prerequisites

- None.

### Risk

- **Level:** Low
- **Notes:** Caching might lead to stale results if the page content changes without a URL change (rare in GitHub/GitLab PR views). Mitigated by the SPA navigation observer which clears the sidebar.

### Review

| Reviewer | Input                                                                                                                                                                                                                                                          | Approved? |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| User     |                                                                                                                                                                                                                                                                | ⬜        |
| Codex    |                                                                                                                                                                                                                                                                | ⬜        |
| Gemini   | Caching strategy using `session` storage is appropriate for MV3. Suggest adding a "clear cache" trigger if `hasTerraformDiff` returns false on a supported page. CSS-based highlighting is preferred for performance over JS-heavy DOM manipulation. Approved. | ✅        |

### Outcome

- **Status:** ✅ Done
- **Built by:** Claude
- **Result:** All 6 files built. Cache-first analysis pipeline in place (`chrome.storage.session`, URL-keyed). Relationship highlighting via `AbortController` event delegation + CSS attribute-selector dimming (`data-active-id`). `data-id`/`data-from`/`data-to` added to minimap SVG nodes/edges. `"DOM.Iterable"` added to `tsconfig.json` lib. Gemini's cache-clear-on-no-diff suggestion implemented.
- **Test result:** 62/62 ✅ (57 previous + 5 caching integration)

---

## Build History

## BP-004 — Dependency Minimap ✅

## BP-004 — Dependency Minimap

### What & Why

- **Phase:** Phase 2 — Core engine
- **Task group:** Dependency Minimap
- **Goal:** Parse cross-resource references from the diff and render a compact SVG minimap in the sidebar showing which changed resources depend on each other — entirely local, no API calls

### Files

| Action | File path                         | Description                                                                                               |
| ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| MODIFY | `src/content/types.ts`            | Add `DependencyGraph` export: `Map<string, Set<string>>` (resource id → set of ids it references)         |
| CREATE | `src/content/refParser.ts`        | Pure fn: scans `ResourceChange[]` attribute values for substrings matching other changed resource ids     |
| CREATE | `src/content/sidebar/minimap.ts`  | SVG renderer: 2-column layout, risk-coloured nodes, straight-line edges, `<title>` tooltips, no innerHTML |
| MODIFY | `src/content/sidebar/index.ts`    | Add `updateMinimap(changes, graph)` — appends minimap section below risk cards                            |
| MODIFY | `src/content/sidebar/sidebar.css` | Minimap section header + SVG element styles                                                               |
| CREATE | `tests/refParser.test.ts`         | Unit tests for reference detection — pure function, no DOM                                                |
| MODIFY | `src/content/index.ts`            | Call `buildDependencyGraph()` → `updateMinimap()` after `updateSidebar()`                                 |

### Reference Detection (`refParser.ts`)

`buildDependencyGraph(changes: ResourceChange[]): DependencyGraph`

1. Build a lookup set of all resource ids in the current `ResourceChange[]`
2. For each resource, scan all `AttributeChange.newValue` strings for substrings that exactly match another resource's id followed by a non-identifier character (`.`, `,`, `]`, `)`, `"`, space, or end-of-string)
3. Return a `Map` where `graph.get(id)` = Set of ids that resource references

**Boundary check:** use `/\b{escapedId}\b/` (with dots escaped as `\.`) to avoid false positives when one resource id is a prefix of another (e.g., `aws_s3_bucket.data` vs `aws_s3_bucket.data_backup`).

**Scope:** only internal references — both source and target must be in the `ResourceChange[]`. External dependencies (references to unchanged resources) are not tracked in Phase 2.

### SVG Minimap Layout (`minimap.ts`)

`renderMinimap(changes: ResourceChange[], graph: DependencyGraph): SVGSVGElement`

**Columns:**

- Left column (x = 0): **dependency targets** — resources that are referenced by at least one other changed resource (the things being depended on)
- Right column (x = 156): **dependents / sources** — resources that reference at least one other changed resource (the things doing the depending)
- If a resource both references others AND is referenced by others: right column (source perspective is more actionable)
- Isolated resources (no internal edges in either direction): left column as standalone nodes
- If no edges exist at all: single centred column (x = 78)

**Edge direction:** right → left (dependent to dependency)

**Node:**

- 120 × 24 px rounded rect (`rx=4`)
- Fill/stroke by risk level:
  - HIGH → `fill:#fff1f0 stroke:#cf222e`
  - MEDIUM → `fill:#fffbeb stroke:#bf8700`
  - LOW → `fill:#f0fff4 stroke:#1a7f37`
  - unknown → `fill:#f6f8fa stroke:#8b949e`
- Primary label: `change.name` truncated to 13 chars (`…` suffix if truncated)
- Sub-label: `change.type` at 9px, muted colour
- `<title>` element inside node group: full `change.id` (browser tooltip on hover)

**Edges:**

- `<line>` from right-centre of source node to left-centre of target node
- `stroke:#8b949e stroke-width:1`
- Small triangular arrowhead polygon at the target end

**Canvas:** width = 280 px, height = max(left_count, right_count) × 32 + 24 px

**Zero-resource case:** return empty SVG (0 height). Caller skips append if height is 0.

### MV3 Compliance Check

- ✅ No remote code — all logic is local computation + DOM/SVG creation
- ✅ No `innerHTML` / `outerHTML` / `insertAdjacentHTML` — SVG built via `createElementNS` / `setAttribute`
- ✅ No new permissions needed
- ✅ No `eval()` or dynamic execution
- ✅ Content script remains IIFE bundle

### Dependencies / Prerequisites

- No new packages
- `ResourceChange`, `AttributeChange` from `src/content/types.ts` — already committed

### Risk

- **Level:** Low–Medium
- **Notes:** SVG layout degrades gracefully for large resource counts — nodes stack vertically and edges may overlap when many resources reference the same target. Accepted for Phase 2; layout polish is Phase 4 scope. Reference detection uses word-boundary regex which correctly handles dotted ids but could miss references inside complex string interpolations (acceptable false-negative rate for MVP).

### Post-build checks (Codex runs after Claude signs off)

1. `npm run build:ext`
2. `npm run test:ext` — all new tests must pass
3. `npm run lint`
4. `npm run format:check`
5. `rg -n "innerHTML|outerHTML|insertAdjacentHTML" tf-diff-explainer/src tf-diff-explainer/public` — must return empty

### Review

| Reviewer | Input                                                                                                                                                                                                                                                                           | Approved? |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| User     |                                                                                                                                                                                                                                                                                 | ⬜        |
| Codex    | Both blockers addressed: column semantics corrected (left = targets, right = sources, edge direction documented), pre-build ✅ marks removed from post-build checklist. Post-build: build ✅ (content.js 10.0 kB) · tests 57/57 ✅ · lint ✅ · format ✅ · unsafe HTML scan ✅. | ✅        |
| Gemini   |                                                                                                                                                                                                                                                                                 | ⬜        |

### Outcome

- **Status:** ✅ Done
- **Built by:** Claude
- **Result:** All files built. content.js grew from 7.2 kB to 10.0 kB (refParser + minimap bundled in). One test fix: word-boundary test had wrong premise (the value `data_backup.id` _correctly_ triggers a reference to `data_backup`; the actual false-positive test is checking that a shorter id `data` is NOT matched inside `data_backup.id`). SVG built entirely via `createElementNS`/`setAttribute` — no unsafe HTML. Prettier reformatted `minimap.ts` (whitespace).
- **Test result:** 57/57 ✅ (9 pageDetector + 16 hunkParser + 21 riskClassifier + 11 refParser)

---

## BP-003 — Diff Hunk Parser + Local Risk Classifier ✅

### Outcome

- **Status:** ✅ Done
- **Built by:** Claude
- **Result:** All files built. ESLint `no-undef`/`no-unused-vars` disabled for TS files (false positives on browser globals) per @typescript-eslint guidance; TS-aware equivalents active. Ingress block test updated to find separate added/removed `AttributeChange` records rather than a merged entry. No `innerHTML`/`outerHTML`/`insertAdjacentHTML` in src/ or public/.
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
