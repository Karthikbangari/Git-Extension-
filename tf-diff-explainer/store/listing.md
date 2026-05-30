# Chrome Web Store Listing — TF Diff Explainer

## Name (45 char max)

```
TF Diff Explainer
```

_(17 chars)_

## Short description (132 char max)

```
Understand code and Terraform diffs at a glance with risk analysis and AI summaries directly in GitHub and GitLab.
```

_(113 chars)_

## Detailed description

```
TF Diff Explainer adds a sidebar to GitHub Pull Requests and GitLab Merge Requests whenever supported code or configuration files are part of the diff. No tab switching, no copy-pasting — review context appears alongside the diff.

Terraform (.tf) changes get the deepest analysis today, including local infrastructure risk classification and dependency mapping.

RISK ANALYSIS
Every changed resource is scored Low / Medium / High based on the type of change:
• IAM permission changes (wildcard policies, inline policies)
• Security group rules opened to 0.0.0.0/0
• Destructive actions (delete, force_destroy, replace)
• Data-store changes (S3, RDS, DynamoDB)

DEPENDENCY MINIMAP
See which resources reference each other. Hover any resource card to highlight the relationships across the sidebar and minimap. Useful for spotting blast radius before you approve.

AI CHANGE SUMMARY (optional — requires Anthropic API key)
Set your own Anthropic API key in the popup and the sidebar will generate:
• A plain-English summary of what changed and why it matters
• A risk narrative based on the classifier findings
• A rollback checklist with 6 specific steps to undo the change safely
• A ready-to-copy PR description in Markdown

Summaries are cached locally — refreshing the same PR is instant.

ENTERPRISE SUPPORT
IT administrators can deploy an API key and site restrictions organization-wide via Chrome managed policy (no user action required).

PRIVACY
Your API key never leaves your browser. The only external connection is to api.anthropic.com — and only when you have set a key and the extension is enabled. No analytics, no telemetry, no data collected by the developer.

HOW TO SET UP
1. Install the extension
2. Click the extension icon and paste your Anthropic API key (get one free at console.anthropic.com)
3. Open any GitHub PR or GitLab MR that contains supported code or configuration files — the sidebar appears automatically
```

## Category

`Developer Tools`

## Language

`English`

## Keywords / tags

```
terraform, infrastructure, devops, code review, github, gitlab, diff, iac, security, risk analysis, code review
```

## Screenshots spec (3 required — 1280×800 each)

| #   | Content                                  | What to show                                                                                                                 |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | GitHub PR `/files` tab with sidebar open | Full sidebar visible: risk cards (at least one High), dependency minimap with highlighted edges, AI summary section rendered |
| 2   | Close-up of the AI summary section       | Summary text, rollback checklist with 2–3 checkboxes, PR Description with "Copy" button                                      |
| 3   | Extension popup                          | Onboarding banner (step 1 + 2) **or** key-set state with per-site toggle on                                                  |

Recommended: use a real Terraform AWS PR (e.g. IAM + S3 + SG changes) for maximum visual impact.

## Small promotional tile (440×280 px)

Text overlay suggestion:

```
TF Diff Explainer
─────────────────
Risk analysis + AI summaries
for Terraform PRs
```

Background: dark (#0d1117 GitHub dark bg) with sidebar UI screenshot cropped to the risk cards column.

## Privacy policy URL

Host `store/privacy-policy.md` at one of:

- GitHub raw: `https://raw.githubusercontent.com/Karthikbangari/Git-Exp/main/tf-diff-explainer/store/privacy-policy.md`
- GitHub Pages (if enabled): `https://karthikbangari.github.io/Terraf/privacy-policy`

Use the raw URL — it works immediately without any Pages setup.
