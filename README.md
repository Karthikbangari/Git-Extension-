# Git-Exp — Chrome Extensions for Developers

Two Chrome extensions (Manifest V3) that bring AI-powered insights directly into GitHub and GitLab.

| Extension | What it does | Status |
| --------- | ------------ | ------ |
| [TF Diff Explainer](tf-diff-explainer/) | Sidebar for GitHub PR / GitLab MR pages with Terraform diffs — risk analysis, dependency minimap, AI change summary | v1.0.0 ✅ |
| [Git File Explainer](git-file-explainer/) | Sidebar for GitHub file pages — plain-English summary, key points, complexity rating | v0.1.0 (Phase 2) |

---

## TF Diff Explainer

A Chrome extension (Manifest V3) that injects a sidebar into GitHub PR and GitLab MR pages when Terraform `.tf` files appear in the diff. Provides instant local risk analysis, a dependency minimap, and optional AI-powered summaries via the Claude API.

## What it does

- **Risk sidebar** — classifies each changed Terraform resource as Low / Medium / High based on local rules: IAM wildcard actions/principals, open security group ingress/egress, `force_destroy`, resource deletions
- **Dependency minimap** — SVG graph showing which changed resources reference each other, laid out in a two-column dependent → target layout
- **Relationship highlighting** — hover any resource card to dim unrelated resources and edges
- **Session caching** — analysis results are cached per URL so re-opening the sidebar is instant
- **AI Change Summary** _(requires Anthropic API key)_ — plain-English summary of the diff, up to 3 risk bullets, and a 6-step interactive rollback checklist; results are cached per diff hash so each unique diff costs one API call
- **PR Description generator** _(requires Anthropic API key)_ — generates a copyable markdown PR description (Summary, Changes, Risk Assessment, Pre-merge Checklist sections) with a one-click Copy button
- **Enterprise org policy** — IT admins can deploy an API key and host restrictions via `chrome.storage.managed`; the popup shows fields as read-only when a managed policy is active

Local analysis runs entirely in the browser. AI features make a single request to `api.anthropic.com` via the extension's background service worker — the API key never touches the page DOM.

## Install (development)

**Requirements:** Node 22, Chrome 120+

```bash
git clone https://github.com/Karthikbangari/Terraf.git
cd Terraf
npm install
npm run build:ext
```

Then in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `tf-diff-explainer/dist/`

The sidebar appears automatically on GitHub PR and GitLab MR pages that contain `.tf` file changes.

To enable AI features, open the extension popup and paste an Anthropic API key (`sk-ant-…`). The key is stored in `chrome.storage.local` and never leaves the extension.

**Enterprise deployment:** IT admins can push an API key and disabled-host list via `chrome.storage.managed` (Chrome enterprise policy). See `public/managed_schema.json` for the policy schema.

## Development commands

All commands run from the repo root (`/Terraf`).

| Command                | What it does                                      |
| ---------------------- | ------------------------------------------------- |
| `npm run build:ext`    | Full production build → `tf-diff-explainer/dist/` |
| `npm run test:ext`     | Run Vitest unit + integration tests               |
| `npm run lint`         | ESLint                                            |
| `npm run format`       | Prettier (write)                                  |
| `npm run format:check` | Prettier (check only)                             |

## Project structure

```
tf-diff-explainer/
├── src/
│   ├── master.ts         # ★ All modules in one file — start here for a full read
│   ├── content/          # Content script (injected into PR pages)
│   │   ├── index.ts      # Orchestrator: detect → cache → analyse → render → AI
│   │   ├── hunkParser.ts # DOM scraper: extracts ResourceChange[] from diff
│   │   ├── riskClassifier.ts
│   │   ├── refParser.ts  # Cross-resource reference detection (regex)
│   │   ├── aiSummary.ts  # Prompt builder, diff hash, background-proxied fetch
│   │   ├── pageDetector.ts
│   │   ├── types.ts
│   │   └── sidebar/
│   │       ├── index.ts  # Sidebar DOM, cards, minimap, AI sections, copy button
│   │       ├── minimap.ts # SVG renderer
│   │       └── sidebar.css
│   ├── background/       # MV3 service worker — handles Anthropic API fetch
│   ├── utils/storage.ts  # chrome.storage wrappers (local + session cache)
│   └── popup/            # Extension popup (API key, per-site toggle)
├── tests/
│   ├── pageDetector.test.ts
│   ├── hunkParser.test.ts
│   ├── riskClassifier.test.ts
│   ├── refParser.test.ts
│   ├── aiSummary.test.ts
│   ├── storageManaged.test.ts  # managed→local fallback logic
│   └── integration/caching.test.ts
├── store/                # Chrome Web Store submission assets
│   ├── privacy-policy.md # Privacy policy (host at GitHub raw URL for CWS)
│   └── listing.md        # Store name, descriptions, screenshot spec
├── public/               # Static assets copied to dist/
│   ├── manifest.json
│   ├── managed_schema.json  # Chrome enterprise policy schema
│   ├── icons/
│   └── popup/
└── dist/                 # Built extension — load this in Chrome
```

> **New to the codebase?** Open [`src/master.ts`](tf-diff-explainer/src/master.ts) — it has every module concatenated in pipeline order with section headings, so you can read the entire extension in one file.

## Roadmap

| Phase             | Status  | Deliverable                                                                |
| ----------------- | ------- | -------------------------------------------------------------------------- |
| 1 — Foundation    | ✅ Done | Loadable extension, sidebar shell, popup, page detection                   |
| 2 — Core engine   | ✅ Done | Local risk classifier, dependency minimap, caching, highlighting           |
| 3 — AI layer      | ✅ Done | AI change summary, interactive rollback checklist, copyable PR description |
| 4 — Polish + ship | ✅ Done | Onboarding, enterprise org policy, CWS prep (v1.0.0, store assets)         |

## Security guardrails (MV3 compliance)

These rules are enforced across every build and reviewed on every proposal:

| Guardrail                    | Requirement                                                                                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No remote code**           | All JS is bundled locally. No `eval()`, `new Function()`, `setTimeout(string)`, or scripts loaded from external URLs at runtime.                                                                                  |
| **Content Security Policy**  | Extension pages: `script-src 'self'; object-src 'self'`. No `unsafe-eval`, no `unsafe-inline`. Content script connects only to `https://api.anthropic.com`.                                                       |
| **Service worker**           | No DOM access, no `XMLHttpRequest`. State is never held in memory — always persisted to `chrome.storage` so the worker can be terminated at any time.                                                             |
| **Content script isolation** | Runs in an isolated world. Never injects `<script>` tags. All Chrome APIs beyond `chrome.storage` / `chrome.runtime` are proxied through the background service worker.                                           |
| **Storage**                  | API key stored in `chrome.storage.local` only — never `localStorage`, cookies, or DOM attributes. Session cache in `chrome.storage.session`. Enterprise key via `chrome.storage.managed`.                         |
| **Permissions**              | `storage` + `activeTab` only. `activeTab` is used solely for `chrome.tabs.query` in the popup to read the current tab URL for per-site enable/disable. No `tabs`, `history`, or `webRequest`.                     |
| **API key handling**         | Key is read from storage at call time. Never passed in message payloads, never logged, never appears in the DOM. Sensitive Terraform attribute values are redacted to `<sensitive>` before being sent to the API. |
| **Unsafe HTML**              | All sidebar DOM is built via `createElement` / `appendChild`. No `innerHTML`, `outerHTML`, or `insertAdjacentHTML` anywhere in the codebase (enforced in every post-build scan).                                  |
| **Host permissions**         | Scoped to `https://github.com/*`, `https://gitlab.com/*`, and `https://api.anthropic.com/*` only. `web_accessible_resources` are not declared (nothing needs to be URL-accessible from the host page).            |

## Tech

- TypeScript, Vite (three separate IIFE bundles), Vitest (104 tests)
- No runtime dependencies — everything ships in the bundle
- AI calls proxied through the background service worker so the host page's CSP cannot block them

## Chrome Web Store

The extension is prepared for CWS submission at version 1.0.0. Store assets (privacy policy, listing description, screenshot spec) are in [`tf-diff-explainer/store/`](tf-diff-explainer/store/).

---

## Git File Explainer

See [`git-file-explainer/README.md`](git-file-explainer/README.md) for full documentation.
