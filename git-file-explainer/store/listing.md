# Chrome Web Store Listing — Git File Explainer

## Name (45 char max)

```
Git File Explainer
```

_(18 chars)_

## Short description (132 char max)

```
AI-powered sidebar for GitHub & GitLab files. Instant summaries, Q&A, quick actions, health score, and a usage dashboard.
```

_(122 chars)_

## Detailed description

```
Git File Explainer injects an AI-powered floating panel into every GitHub and GitLab file view. Open any file and get a structured explanation alongside the code — no tab switching, no copy-pasting, no prompt engineering.

THREE-TAB PANEL
The floating glass panel appears at the right of the page with three tabs:
• Summary — AI-generated explanation, key points, connections between files, watch-out items (TODOs, hardcoded values, complexity hotspots), and a plain-English analogy
• Files — Quick actions and a streaming Q&A box for deeper investigation
• Health — Visual complexity score ring (Low / Medium / High)

Click the FAB (floating action button) at any time to reopen the panel.

QUICK ACTIONS
One-click tasks in the Files tab:
• Explain — re-runs the full explanation
• Find Bugs — pre-fills Q&A with a bug-hunt prompt
• Security Scan — scans for common security issues
• Generate Tests — asks the AI to suggest test cases

STREAMING Q&A
Ask follow-up questions. Answers stream in token-by-token so you're never waiting for a spinner. Each session builds on the file context already loaded.

SMART CACHING
Summaries are cached locally by file URL. Navigate back to the same file and the explanation is instant — no API call, no wait. Cache entries expire via LRU eviction when storage pressure is high.

REPOSITORY DASHBOARD
Open the dashboard (from the popup or Chrome's extension options) to review your explanation history, total tokens used, and cache storage size. Clear the cache with one click.

40+ FILE TYPES
Works on TypeScript, Python, Go, Java, Rust, C/C++, Ruby, PHP, Kotlin, Swift, Scala, Terraform, HCL, SQL, YAML, JSON, TOML, Markdown, HTML, CSS, SCSS, Vue, Svelte, GraphQL, Protobuf, Shell, PowerShell, and more. Binary files are detected and skipped cleanly.

ENTERPRISE SUPPORT
IT administrators can pre-deploy an API key organisation-wide via Chrome managed policy (no user action required).

PRIVACY
Your API key never leaves your browser. The only external connections are to api.anthropic.com (AI summaries) and raw.githubusercontent.com (file content fallback for preview-rendered pages). No analytics, no telemetry, no data collected by the developer.

HOW TO SET UP
1. Install the extension
2. Click the extension icon and paste your Anthropic API key (get one free at console.anthropic.com)
3. Open any file on github.com or gitlab.com — the floating panel appears automatically
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

| #   | Content                          | What to show                                                                                                                                   |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | GitHub file view with panel open | Floating glass panel (fixed right, 360px wide): Summary tab active, AI explanation visible with key points and complexity badge; FAB in corner |
| 2   | Files tab — quick actions + Q&A  | Quick action buttons (Explain / Find Bugs / Security Scan / Generate Tests); user question bubble (right, blue); AI answer streaming (left)    |
| 3   | Dashboard page                   | `chrome-extension://…/dashboard/dashboard.html` — 3-stat strip (files, tokens, cache), file cards with language badge + time-ago               |

Optional 4th: Extension popup — API key card + token usage card (Input / Output / Total) + "Dashboard ↗" button.

Recommended: use a real TypeScript or Python file on a public repo for maximum visual impact on screenshots 1 and 2.

> **User action required:** Capture actual 1280×800 PNG screenshots and save to `store/screenshots/` (replace the pre-BP-028 placeholders currently there).

## Small promotional tile (440×280 px)

Text overlay suggestion:

```
Git File Explainer
──────────────────
AI explanations for
GitHub & GitLab files
```

Background: dark (`#0d1117`) with the floating glass panel cropped to the Summary tab.

## Privacy policy URL

Host `store/privacy-policy.md` at:

- GitHub raw: `https://raw.githubusercontent.com/Karthikbangari/Git-Extension-/main/git-file-explainer/store/privacy-policy.md`

Use the raw URL — it works immediately without any Pages setup.
