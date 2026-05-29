# TF Diff Explainer

A Chrome extension (Manifest V3) that injects a sidebar into GitHub PR and GitLab MR pages when Terraform `.tf` files appear in the diff. Provides instant, local risk analysis and a dependency minimap — no API key required for core features.

## What it does

- **Risk sidebar** — classifies each changed Terraform resource as Low / Medium / High based on local rules: IAM wildcard actions/principals, open security group ingress/egress, `force_destroy`, resource deletions
- **Dependency minimap** — SVG graph showing which changed resources reference each other, laid out in a two-column dependent → target layout
- **Relationship highlighting** — hover any resource card to dim unrelated resources and edges
- **Session caching** — analysis results are cached per URL so re-opening the sidebar is instant

All analysis runs entirely in the browser. Nothing is sent to any server.

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
│   │   ├── index.ts      # Orchestrator: detect → cache → analyse → render
│   │   ├── hunkParser.ts # DOM scraper: extracts ResourceChange[] from diff
│   │   ├── riskClassifier.ts
│   │   ├── refParser.ts  # Cross-resource reference detection (regex)
│   │   ├── pageDetector.ts
│   │   ├── types.ts
│   │   └── sidebar/
│   │       ├── index.ts  # Sidebar DOM, cards, minimap, hover highlighting
│   │       ├── minimap.ts # SVG renderer
│   │       └── sidebar.css
│   ├── background/       # MV3 service worker
│   ├── utils/storage.ts  # chrome.storage wrappers (local + session cache)
│   └── popup/            # Extension popup (API key, per-site toggle)
├── tests/
│   ├── pageDetector.test.ts
│   ├── hunkParser.test.ts
│   ├── riskClassifier.test.ts
│   ├── refParser.test.ts
│   └── integration/caching.test.ts
├── public/               # Static assets copied to dist/
│   ├── manifest.json
│   ├── icons/
│   └── popup/
└── dist/                 # Built extension — load this in Chrome
```

## Roadmap

| Phase             | Status  | Deliverable                                                      |
| ----------------- | ------- | ---------------------------------------------------------------- |
| 1 — Foundation    | ✅ Done | Loadable extension, sidebar shell, popup, page detection         |
| 2 — Core engine   | ✅ Done | Local risk classifier, dependency minimap, caching, highlighting |
| 3 — AI layer      | Planned | Claude API: change summary, PR description, rollback checklist   |
| 4 — Polish + ship | Planned | Org policy, onboarding, Chrome Web Store                         |

## Tech

- TypeScript, Vite (three separate IIFE bundles), Vitest
- No runtime dependencies — everything ships in the bundle
- MV3 compliant: no `eval`, no `innerHTML`, no remote code
