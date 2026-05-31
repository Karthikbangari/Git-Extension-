# Git-Extension-

AI-powered Chrome extension for understanding code files directly on GitHub and GitLab.

**GFE (`git-file-explainer`) is the sole active Chrome extension in this repo. TFE is archived and receives no new features.**

## Git File Explainer

Git File Explainer injects a Manifest V3 sidebar into repository file pages. It explains what a file does, highlights key points, rates complexity, supports follow-up Q&A, and lets you copy or share summaries with Claude.ai.

GFE explains code files on GitHub/GitLab blob pages across 21+ file types, including `.tf`, `.ts`, `.js`, `.py`, `.go`, `.java`, `.rb`, `.cs`, `.cpp`, `.c`, `.tsx`, `.jsx`, `.php`, `.json`, `.yaml`, `.yml`, `.xml`, `.sql`, `.html`, `.css`, `.scss`, and `.md`.

## Features

- **File summaries** — clear developer or plain-English explanations for code and config files
- **Rich cards** — key points, connections, watch-outs, analogies, and suggested follow-up questions
- **Streaming Q&A** — ask questions about the current file inside the sidebar
- **Copy/export** — copy summaries as plain text or Markdown
- **Share to Claude.ai** — copies a formatted prompt and opens Claude.ai without extra extension permissions
- **Token tools** — approximate token chips in the sidebar and a popup token meter
- **GitHub + GitLab support** — works on file views, with support for a custom GitLab domain
- **Enterprise policy** — supports managed API key and host restrictions through Chrome policy

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

| Command                     | What it does                                                  |
| --------------------------- | ------------------------------------------------------------- |
| `npm run build:gfe`         | Builds the Chrome extension into `git-file-explainer/dist/`   |
| `npm run test:gfe`          | Runs Git File Explainer tests                                 |
| `npm run dev:gfe`           | Launches Chrome with the extension loaded through `web-ext`   |
| `npm run verify:extensions` | Runs the Playwright smoke verifier and writes `verify-shots/` |
| `npm run lint`              | Runs ESLint                                                   |
| `npm run format`            | Formats the repo with Prettier                                |
| `npm run format:check`      | Checks formatting without writing files                       |

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
