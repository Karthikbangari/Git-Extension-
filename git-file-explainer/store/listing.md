# Chrome Web Store Listing — Git File Explainer

## Name (45 char max)

```
Git File Explainer
```

_(18 chars)_

## Short description (132 char max)

```
Instantly understand any file on GitHub or GitLab with AI-powered summaries, key points, and interactive Q&A.
```

_(109 chars)_

## Detailed description

```
Git File Explainer adds a sidebar to GitHub and GitLab file views. Open any file and get an AI-powered explanation alongside the code — no tab switching, no copy-pasting.

AI FILE SUMMARY
Every file you open is analysed by Claude (Anthropic's AI) and summarised in plain English:
• 2–3 sentence summary of what the file does
• Up to 5 key points describing the file's purpose and structure
• Complexity indicator (Low / Medium / High) to gauge reading effort

INTERACTIVE Q&A
Ask follow-up questions about the file directly in the sidebar. The AI answers in context — useful for understanding unfamiliar code, APIs, or configuration files.
• 280-character question limit keeps prompts focused
• Answers render as plain text with no formatting overhead
• Cached summaries are reused when asking multiple questions about the same file

INSTANT REVISITS
Summaries are cached locally by file URL. Navigating back to the same file is instant with no API call.

ENTERPRISE SUPPORT
IT administrators can deploy an API key and site restrictions organisation-wide via Chrome managed policy (no user action required).

PRIVACY
Your API key never leaves your browser. The only external connection is to api.anthropic.com — and only when you have set a key and the extension is enabled. No analytics, no telemetry, no data collected by the developer.

HOW TO SET UP
1. Install the extension
2. Click the extension icon and paste your Anthropic API key (get one free at console.anthropic.com)
3. Open any file on github.com or gitlab.com — the sidebar appears automatically
```

## Category

`Developer Tools`

## Language

`English`

## Keywords / tags

```
github, gitlab, code review, ai, file explanation, code summary, developer tools, anthropic, claude
```

## Screenshots spec (3 required — 1280×800 each)

| #   | Content                            | What to show                                                                                        |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | GitHub file view with sidebar open | Full sidebar visible: AI summary paragraph, key points list, complexity chip, Q&A input field below |
| 2   | Close-up of Q&A interaction        | Question typed in input; answer rendered below; "Clear" button visible                              |
| 3   | Extension popup                    | Onboarding banner (step 1 + 2) **or** key-set state with per-site toggle on                         |

Recommended: use a real file on a public repo (e.g. a TypeScript source file or a configuration file) for maximum visual impact.

> **User action required:** Capture actual 1280×800 PNG screenshots and save to `store/screenshots/`.

## Small promotional tile (440×280 px)

Text overlay suggestion:

```
Git File Explainer
──────────────────
AI summaries + Q&A
for GitHub & GitLab files
```

Background: dark (#0d1117 GitHub dark bg) with sidebar UI screenshot cropped to the summary section.

## Privacy policy URL

Host `store/privacy-policy.md` at:

- GitHub raw: `https://raw.githubusercontent.com/Karthikbangari/Git-Exp/main/git-file-explainer/store/privacy-policy.md`

Use the raw URL — it works immediately without any Pages setup.
