# Chrome Web Store Listing — Git File Explainer

## Name (45 char max)

```
Git File Explainer
```

_(18 chars)_

## Short description (132 char max)

```
AI-powered sidebar for GitHub & GitLab files. Instant summaries, dual-mode explanations, Q&A, quick actions, and a usage dashboard.
```

_(132 chars)_

## Detailed description

```
Git File Explainer injects an AI-powered sidebar into every GitHub and GitLab file view. Open any file and get a structured explanation alongside the code — no tab switching, no copy-pasting, no prompt engineering.

DUAL-MODE EXPLANATIONS
Choose the lens that fits your audience:
• Developer mode — technical 2-3 sentence summary, up to 5 key points, connections to other files/modules, watch-out items (TODOs, hardcoded values, complexity hotspots), complexity rating
• Non-technical mode — plain-English summary, real-world analogy, watch-out items in everyday language

QUICK ACTIONS
One-click tasks directly in the sidebar:
• Find Bugs — pre-fills the Q&A with a bug-hunt prompt
• Security Scan — scans for common security issues
• Generate Tests — asks the AI to suggest test cases
• Explain — re-runs the full explanation

STREAMING Q&A
Ask follow-up questions. Answers stream in token-by-token so you're never waiting for a spinner. Each session builds on the file context already loaded.

SMART CACHING
Summaries are cached locally by file URL. Navigate back to the same file and the explanation is instant — no API call, no wait. Cache entries expire via LRU eviction when storage pressure is high.

REPOSITORY DASHBOARD
Open the dashboard (from the popup or Chrome's extension options) to review your explanation history, total tokens used, and cache storage size. Clear the cache with one click.

40+ FILE TYPES
Works on TypeScript, Python, Go, Java, Rust, C/C++, Ruby, PHP, Terraform, SQL, YAML, JSON, Markdown, HTML, CSS, Dockerfile, and more. Binary files are detected and skipped cleanly.

SELF-HOSTED GITLAB
Configure a custom GitLab domain (e.g. gitlab.mycompany.com) from the popup — no code changes needed.

PER-SITE AND PER-REPO CONTROLS
Enable or disable the extension per-host or per-repository from the popup. Useful for repos with sensitive code you don't want sent to the API.

ENTERPRISE SUPPORT
IT administrators can pre-deploy an API key and site restrictions organisation-wide via Chrome managed policy (no user action required).

PRIVACY
Your API key never leaves your browser. The only external connections are to api.anthropic.com (AI summaries) and raw.githubusercontent.com (file content fallback for preview-rendered pages). No analytics, no telemetry, no data collected by the developer.

HOW TO SET UP
1. Install the extension
2. Click the extension icon and paste your Anthropic API key (get one free at console.anthropic.com)
3. Open any file on github.com or gitlab.com — the sidebar appears automatically
4. Toggle Developer / Non-technical mode to match your audience
```

## Category

`Developer Tools`

## Language

`English`

## Keywords / tags

```
github, gitlab, code review, ai, file explanation, code summary, developer tools, anthropic, claude, terraform, typescript, python
```

## Screenshots spec (3 required — 1280×800 each)

| #   | Content                            | What to show                                                                                                                                 |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | GitHub file view with sidebar open | Full Git Repo Genius sidebar visible: glass header with filename + language badge, Summary accordion open, Key Points accordion, mode toggle |
| 2   | Q&A interaction + quick actions    | Quick action buttons (Find Bugs / Security Scan / Generate Tests); user question bubble (right, blue); AI answer streaming (left, surface)   |
| 3   | Dashboard page                     | `chrome-extension://…/dashboard/dashboard.html` — 3-stat strip (files, tokens, cache), file cards with language badge + time-ago             |

Optional 4th: Extension popup — dark canvas, "Dashboard ↗" button, mode toggle with gradient active pill.

Recommended: use a real TypeScript or Python file on a public repo for maximum visual impact on screenshots 1 and 2.

> **User action required:** Capture actual 1280×800 PNG screenshots and save to `store/screenshots/` (replace the pre-BP-024 placeholders currently there).

## Small promotional tile (440×280 px)

Text overlay suggestion:

```
Git File Explainer
──────────────────
AI explanations for
GitHub & GitLab files
```

Background: dark (`#0d1117`) with sidebar UI cropped to the summary accordion section.

## Privacy policy URL

Host `store/privacy-policy.md` at:

- GitHub raw: `https://raw.githubusercontent.com/Karthikbangari/Git-Extension-/main/git-file-explainer/store/privacy-policy.md`

Use the raw URL — it works immediately without any Pages setup.
