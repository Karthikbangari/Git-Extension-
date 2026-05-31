# Privacy Policy — Git File Explainer

_Last updated: 2026-05-31_

## What this extension does

Git File Explainer is a Chrome extension that injects a sidebar into GitHub and GitLab file views. When you open a file on `github.com` or `gitlab.com`, the extension reads the visible file content from the page and, if an Anthropic API key is configured, sends a summary request to the Anthropic API.

## Data stored locally

The extension stores the following data in `chrome.storage.local` on your device only:

| Data                                          | Purpose                                                  | Leaves your device?                                                      |
| --------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Anthropic API key                             | Authenticates requests to `api.anthropic.com`            | No — never transmitted; used only to make API requests from your browser |
| Per-site enable/disable list                  | Remembers which sites you have disabled the extension on | No                                                                       |
| Cached AI summaries (keyed by SHA-256 of URL) | Avoids re-fetching the same summary                      | No                                                                       |

Enterprise deployments may additionally supply an API key and host restrictions via `chrome.storage.managed` (set by IT administrators through Chrome policy — not by this extension).

## Data transmitted externally

When an API key is configured and the extension is enabled, a request is sent to `https://api.anthropic.com` containing:

- The visible file content from the current page, truncated to 5,000 characters
- The file name and detected language
- A structured Q&A question if the user submits one via the sidebar
- The Claude model identifier (`claude-haiku-4-5-20251001`)

No GitHub or GitLab credentials, no repository metadata beyond the file name, and no personally identifiable information is ever transmitted.

## What is not collected

- No analytics or telemetry
- No usage tracking
- No crash reporting
- No data is sent to the extension developer

## Third-party services

The only external service contacted is the [Anthropic API](https://www.anthropic.com/privacy) (`api.anthropic.com`), and only when you have set an API key and the extension is enabled on the current page. Anthropic's own privacy policy governs how they handle API requests.

## Data retention and deletion

All locally stored data (API key, site list, cached summaries) can be cleared at any time by removing the extension from Chrome (`chrome://extensions → Remove`). No data is stored server-side by this extension.

## Contact

For questions or concerns, open an issue at <https://github.com/Karthikbangari/Git-Exp/issues>.
