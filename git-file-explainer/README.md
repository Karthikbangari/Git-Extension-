# Git File Explainer

A Chrome extension (Manifest V3) that injects an AI-powered sidebar into GitHub file pages, explaining what a file does, its key points, and complexity — powered by the Claude API.

## What it does

- **File summary** — 2-3 sentence plain-English description of what the file does
- **Key points** — up to 5 verb-led bullets covering the file's main responsibilities
- **Complexity chip** — Low / Medium / High rating so you can gauge review effort at a glance
- **URL-keyed cache** — summary is stored in `chrome.storage.local` per file URL; revisiting the same file is instant with no extra API call
- **No-content state** — gracefully handles pages where file content cannot be extracted

AI features require an Anthropic API key (`sk-ant-…`), set via the extension popup. The key is stored in `chrome.storage.local` and never touches the page DOM.

## Supported pages (Phase 2)

| Platform | URL pattern           |
| -------- | --------------------- |
| GitHub   | `github.com/*/blob/*` |
| GitLab   | Coming in Phase 3     |

## Install (development)

**Requirements:** Node 22, Chrome 120+

```bash
git clone https://github.com/Karthikbangari/Git-Exp.git
cd Git-Exp
npm install
npm run build:gfe
```

Then in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `git-file-explainer/dist/`

Navigate to any `github.com/*/blob/*` file page — the sidebar injects automatically on the right side of the page.

To enable AI summaries, open the extension popup and paste an Anthropic API key (`sk-ant-…`).

## Development commands

All commands run from the repo root (`/Git-Exp`).

| Command             | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `npm run build:gfe` | Full production build → `git-file-explainer/dist/` |
| `npm run test:gfe`  | Run Vitest unit tests                              |
| `npm run dev:gfe`   | Launch Chrome with extension loaded via web-ext    |

## Project structure

```
git-file-explainer/
├── src/
│   ├── content/
│   │   ├── index.ts          # Orchestrator: detect → extract → cache → AI → render
│   │   ├── fileExtractor.ts  # DOM extraction (3-layer fallback for GitHub blob pages)
│   │   ├── aiSummary.ts      # Prompt builder + background-proxied Claude API fetch
│   │   ├── pageDetector.ts   # URL route matching (GitHub/GitLab blob views)
│   │   ├── types.ts          # FileSummaryResult, FileContent, FileExtractor interface
│   │   └── sidebar/
│   │       ├── index.ts      # Sidebar DOM, summary/key-points/complexity rendering
│   │       └── sidebar.css   # Sidebar styles + dark mode + shimmer skeleton
│   ├── background/
│   │   └── index.ts          # MV3 service worker — proxies GFE_FETCH_AI_SUMMARY to Anthropic
│   ├── utils/
│   │   └── storage.ts        # chrome.storage wrappers + SHA-256 URL cache helpers
│   └── popup/
│       └── popup.ts          # API key entry, per-site toggle
├── tests/
│   ├── pageDetector.test.ts
│   ├── fileExtractor.test.ts
│   └── aiSummary.test.ts
├── public/
│   ├── manifest.json         # MV3 manifest (v0.1.0)
│   ├── icons/
│   └── popup/
└── dist/                     # Built extension — load this in Chrome
```

## DOM extraction

File content is extracted from GitHub's blob view using a 3-layer fallback:

1. `td.blob-code-inner` — standard GitHub code table cells
2. `td[id^="LC"]` — line-content cells by ID prefix
3. `[data-testid="blob-code-content"]` — data-testid attribute (newer GitHub markup)

If all three fail (binary files, images, empty files), the sidebar shows a `no-content` state.

## Security guardrails (MV3 compliance)

| Guardrail            | Requirement                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **No remote code**   | All JS bundled locally. No `eval()`, `new Function()`, or externally loaded scripts.                                                   |
| **CSP**              | Extension pages: `script-src 'self'; object-src 'self'; connect-src https://api.anthropic.com`.                                        |
| **API key handling** | Key read from `chrome.storage.local` at call time. Never in message payloads, never logged, never in DOM.                              |
| **Unsafe HTML**      | All sidebar DOM built via `createElement`/`appendChild`. No `innerHTML` anywhere.                                                      |
| **Host permissions** | Scoped to `https://github.com/*`, `https://gitlab.com/*`, and `https://api.anthropic.com/*`.                                           |
| **Content script**   | Runs in an isolated world. All Chrome APIs beyond `chrome.storage`/`chrome.runtime` are proxied through the background service worker. |

## Roadmap

| Phase             | Status  | Deliverable                                                         |
| ----------------- | ------- | ------------------------------------------------------------------- |
| 1 — Scaffold      | Done    | Extension shell, route detection, provider interface, sidebar shell |
| 2 — Core          | Done    | GitHub DOM extraction, AI summary, URL cache, no-content state      |
| 3 — GitLab + Q&A  | Planned | GitLab DOM extraction, follow-up Q&A with file context              |
| 4 — Polish + ship | Planned | Onboarding, CWS submission                                          |

## Tech

- TypeScript, Vite (three separate IIFE bundles), Vitest
- No runtime dependencies
- AI calls proxied through the background service worker (model: `claude-haiku-4-5-20251001`)
- Content truncated to 5,000 characters before sending to the API
