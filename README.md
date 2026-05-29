# TF Diff Explainer

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

**Requirements:** Node 22, Chrome 102+

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
├── public/               # Static assets copied to dist/
│   ├── manifest.json
│   ├── managed_schema.json  # Chrome enterprise policy schema
│   ├── icons/
│   └── popup/
└── dist/                 # Built extension — load this in Chrome
```

## Roadmap

| Phase             | Status  | Deliverable                                                                |
| ----------------- | ------- | -------------------------------------------------------------------------- |
| 1 — Foundation    | ✅ Done | Loadable extension, sidebar shell, popup, page detection                   |
| 2 — Core engine   | ✅ Done | Local risk classifier, dependency minimap, caching, highlighting           |
| 3 — AI layer      | ✅ Done | AI change summary, interactive rollback checklist, copyable PR description |
| 4 — Polish + ship | 🔄 In progress | Onboarding ✅, enterprise org policy ✅, Chrome Web Store (next)  |

## Tech

- TypeScript, Vite (three separate IIFE bundles), Vitest (97 tests)
- No runtime dependencies — everything ships in the bundle
- MV3 compliant: no `eval`, no `innerHTML`, no remote code
- AI calls proxied through the background service worker so the host page's CSP cannot block them
