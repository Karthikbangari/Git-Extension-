# Git-Extension-

AI-powered Chrome extension for understanding code files directly on GitHub and GitLab.

**GFE (`git-file-explainer`) is the sole active Chrome extension in this repo. TFE is archived and receives no new features.**

## Git File Explainer

Git File Explainer injects a Manifest V3 sidebar into repository file pages. It explains what a file does, highlights key points, rates complexity, supports follow-up Q&A, and includes a dashboard for recently explained files, token totals, and cache usage.

GFE explains code files on GitHub/GitLab blob pages across 21+ file types, including `.tf`, `.ts`, `.js`, `.py`, `.go`, `.java`, `.rb`, `.cs`, `.cpp`, `.c`, `.tsx`, `.jsx`, `.php`, `.json`, `.yaml`, `.yml`, `.xml`, `.sql`, `.html`, `.css`, `.scss`, and `.md`.

## Features

- **Animated sidebar** — polished floating action button, tabbed Summary / File / Health views, animated complexity score ring, shimmer loading state, and streaming typing indicators
- **File summaries** — clear developer or plain-English explanations for code and config files
- **Rich cards** — key points, connections, watch-outs, analogies, and suggested follow-up questions
- **Streaming Q&A** — ask questions about the current file inside the sidebar
- **Popup-only mode control** — switch Developer / Non-technical mode from the extension popup
- **Repository dashboard** — open Dashboard from the popup/options page to review recent files, token totals, and cache usage
- **Token tools** — approximate token chips in the sidebar, popup token meter, and dashboard token totals
- **GitHub + GitLab support** — works on file views, with support for a custom GitLab domain
- **Enterprise policy** — supports managed API key and host restrictions through Chrome policy

## Sidebar Experience

The GFE sidebar now opens as a dark glass panel with smooth motion and a compact floating sparkle button when collapsed. Explanation content is split into focused tabs:

- **Summary** — overview, key points, quick actions, and follow-up Q&A
- **File** — filename, language, cache status, and token-aware file metadata
- **Health** — animated complexity score ring plus watch-outs for review risk

Loading, tab switching, score updates, Q&A streaming, and the collapsed launcher all use local CSS animation. No remote scripts, remote fonts, or runtime animation libraries are loaded.

AI features require an Anthropic API key. The key is stored in `chrome.storage.local`, never placed in the page DOM, and never committed to the repo.

## Supported Pages

| Platform | URL pattern             |
| -------- | ----------------------- |
| GitHub   | `github.com/*/blob/*`   |
| GitLab   | `gitlab.com/*/-/blob/*` |

## Real Test Examples

After loading the extension, open this folder on GitHub and click any sample file:

```text
https://github.com/Karthikbangari/Git-Extension-/tree/main/git-file-explainer/test-fixtures/supported-file-types
```

That folder contains real `.tf`, `.ts`, `.js`, `.py`, `.go`, `.java`, `.rb`, `.cs`, `.cpp`, `.c`, `.tsx`, `.jsx`, `.php`, `.json`, `.yaml`, `.yml`, `.xml`, `.sql`, `.html`, `.css`, `.scss`, and `.md` files for testing GFE on GitHub blob pages.

Latest realtime smoke result:

```text
npm run smoke:gfe:filetypes
22 pass, 0 warn, 0 fail
```

Screenshots are stored in `git-file-explainer/realtime-screenshots/supported-file-types/`.

## Install For Development

**Requirements:** Node 22 and Chrome 120+

```bash
git clone https://github.com/Karthikbangari/Git-Extension-.git
cd Git-Extension-
npm install
npm run build:gfe
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `git-file-explainer/`

You can also load `git-file-explainer/dist/` after running `npm run build:gfe`.

## Commands

| Command                       | What it does                                                      |
| ----------------------------- | ----------------------------------------------------------------- |
| `npm run build:gfe`           | Builds the Chrome extension into `git-file-explainer/dist/`       |
| `npm run test:gfe`            | Runs Git File Explainer tests                                     |
| `npm run dev:gfe`             | Launches Chrome with the extension loaded through `web-ext`       |
| `npm run smoke:gfe:filetypes` | Opens all real GitHub sample files with GFE and saves screenshots |
| `npm run verify:extensions`   | Runs the Playwright smoke verifier and writes `verify-shots/`     |
| `npm run lint`                | Runs ESLint                                                       |
| `npm run format`              | Formats the repo with Prettier                                    |
| `npm run format:check`        | Checks formatting without writing files                           |

## Project Structure

```text
git-file-explainer/
├── src/
│   ├── content/
│   │   ├── index.ts
│   │   ├── fileExtractor.ts
│   │   ├── aiSummary.ts
│   │   ├── pageDetector.ts
│   │   └── sidebar/
│   ├── background/
│   ├── dashboard/
│   ├── popup/
│   └── utils/
├── tests/
├── public/
├── store/
├── manifest.json
└── dist/
```

## Security

- Manifest V3
- No remote JavaScript
- No `eval()` or dynamic code execution
- API calls go through the extension background service worker
- API key stays in Chrome extension storage
- Sidebar DOM is built with safe DOM APIs
- Host permissions are limited to GitHub, GitLab, and Anthropic API access

## Documentation

Full extension details are in [`git-file-explainer/README.md`](git-file-explainer/README.md).
