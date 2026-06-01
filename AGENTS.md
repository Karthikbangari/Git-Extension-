# AGENTS.md — Multi-Agent Project Workflow

> Place this file in the root of any project. Every AI agent reads it at the start of each session.
> It defines who does what, how agents talk to each other, and the exact files to use.

---

## The Three Agents and Their Lanes

| Agent                  | Role              | What it owns                                                                                                           | What it does NOT own                                           |
| ---------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Claude** (Anthropic) | Builder           | All source code, unit tests, integration tests, build configs, `Build.md` proposals, `1playground.md` progress updates | Git commits, branches, CI execution, E2E tests, policy checks  |
| **Codex** (OpenAI)     | Git + CI          | Git commits, branches, push, pull, E2E smoke tests, final build verification, `CODEX.md`                               | Writing source code, writing test logic, Chrome/browser policy |
| **Gemini** (Google)    | Policy + Security | Security review, MV3/platform-policy compliance, privacy audits, scheme-validity checks, smoke test sign-off           | Writing source code, committing, running builds                |

**Neither agent acts outside its lane without explicit user instruction.**
When in doubt, log a question in `1playground.md` tagged with your agent name and wait.

---

## The Four Shared Files

Every agent reads these at the start of every session. Every agent updates the relevant file in the same turn as their work — never batch updates to a later turn.

### 1. `Build.md` — Proposals and Reviewer Sign-off

Claude writes a `BP-NNN` proposal here before any code changes. Codex and Gemini add their review rows. The user types **"go"** to approve.

**Rule:** No code is written until `go` is given. No scope beyond what the proposal states.

```markdown
## Active Proposal

---

## BP-NNN — Short title

### Goal

One paragraph. What does this deliver and why.

### Scope — what changes

| Action | File           | Description  |
| ------ | -------------- | ------------ |
| CREATE | src/foo/bar.ts | What it does |
| MODIFY | src/foo/baz.ts | What changes |
| DELETE | src/old.ts     | Why removed  |

### Approach

Key decisions, trade-offs, alternatives considered.

### MV3 / Platform compliance check

List any new permissions, CSP changes, external URLs, or storage access patterns.
Write NONE if not applicable.

### Risk level

LOW / MEDIUM / HIGH — one sentence explaining why.

### Post-build checklist (Claude fills in after build)

- [ ] Build passes
- [ ] All tests pass (N/N)
- [ ] Lint clean
- [ ] Format clean
- [ ] Unsafe HTML scan clean (if DOM-building code)
- [ ] API key payload scan clean (if AI/network code)

### Review table

| Reviewer | Status     | Notes |
| -------- | ---------- | ----- |
| Codex    | ⏳ pending |       |
| Gemini   | ⏳ pending |       |
| User     | ⏳ pending |       |
```

After user approval and build completion, Claude moves the block from `Active Proposal` to `Build History` at the bottom of `Build.md`.

---

### 2. `1playground.md` — Coordination Log

The single channel for agent-to-agent communication. Every message gets a sequential number, a From/To, and the message body. Agents tag themselves `[CLAUDE]`, `[CODEX]`, or `[GEMINI]`.

```markdown
# Shared Build Log

> - Claude (coding) and Codex (git/CI) both read this before acting.
> - Build proposals live in Build.md — agents review there, then log results here.
> - Any agent that reviews, changes, tests, or blocks work must add a log entry in the same turn.

---

## Coordination Log

| #   | From   | To     | Message                                                                                  |
| --- | ------ | ------ | ---------------------------------------------------------------------------------------- |
| 1   | CLAUDE | CODEX  | BP-001 built ✅. Build: ✅ (content.js 7.2kB). Tests: 30/30 ✅. Ready for your E2E pass. |
| 2   | CODEX  | CLAUDE | E2E passed 10/10 on Chrome 148. One finding: ...                                         |
| 3   | GEMINI | USER   | Security review: no issues found. Approving BP-001.                                      |
```

**Log entry rules:**

- Add your entry in the same turn as the action it describes.
- Never delete or edit existing entries — append only.
- Use `ALL` as the `To` field when broadcasting (e.g. "Phase 2 sealed").
- Keep messages factual: what you did, what you found, what you need.

---

### 3. `CLAUDE.md` — Claude's Session Handoff

Claude updates this at the end of every session (or whenever the session state changes materially). It is the first thing Claude reads when a new session starts.

```markdown
# CLAUDE.md — Instructions for Claude

## Session Handoff — Read This First

| Field                | Value                                   |
| -------------------- | --------------------------------------- |
| Last active session  | YYYY-MM-DD                              |
| Active phase         | Phase N — short description             |
| Last commit          | `<hash>` — Codex (<short message>)      |
| Last build           | BP-NNN complete · N tests ✅ · build ✅ |
| Lint / format        | ✅ clean / ❌ failing on <file>         |
| Uncommitted          | List files OR "none"                    |
| Next action (Codex)  | What Codex should do next               |
| Next action (Gemini) | What Gemini should review next          |
| Next action (Claude) | What Claude should do next              |
| Next action (user)   | What the user needs to do               |
| Open bugs            | BUG-N: description — status             |
| Blocked              | None / reason                           |

## Role

Claude handles all coding, unit tests, and integration tests.
Codex handles git, CI, E2E. Gemini handles policy and security.
Neither acts outside its lane without explicit user instruction.

## Confirmed decisions (do not re-litigate)

- Decision 1 — reason it was made
- Decision 2 — reason it was made

## Toolchain reference

| Command           | What it does           |
| ----------------- | ---------------------- |
| `<test command>`  | Runs unit tests        |
| `<build command>` | Produces distributable |
| `<lint command>`  | Checks code style      |

## Node / runtime path

`PATH="<absolute path to local node>/bin:$PATH"` — always prefix commands with this.

## Known gotchas

- Gotcha 1 (discovered when, workaround)
- Gotcha 2

## Key file locations

| Purpose              | File                              |
| -------------------- | --------------------------------- |
| Proposals + sign-off | Build.md → Active Proposal        |
| Agent coordination   | 1playground.md → Coordination Log |
| Progress + bugs      | 1playground.md                    |
```

---

### 4. `CODEX.md` — Codex's Standing Instructions

Codex reads this first. It does not change often — it sets Codex's permanent rules.

```markdown
# CODEX.md — Instructions for Codex

## Role

Codex owns: git commits, branches, push, pull, CI execution, E2E smoke tests, build verification.
Codex does NOT own: source code, test logic, proposals.

## Before every session

1. Read 1playground.md from top to bottom.
2. Read CLAUDE.md Session Handoff.
3. Check git status — confirm you are on the correct branch.

## Commit rules

- Never commit without a completed BP in Build.md with user "go".
- Commit message format: `type(scope): short message` (e.g. `feat: add sidebar tabs`).
- Never commit files not in the BP scope table.
- Never amend published commits.
- Every commit must be followed by a 1playground.md log entry.

## E2E smoke test

After every Claude build hand-off, run the smoke checklist from Build.md in a real browser.
Log results in 1playground.md (pass/fail per step, Chrome version, any findings).

## Post-build verification checklist

- [ ] `<build command>` passes
- [ ] `<test command>` passes (N/N)
- [ ] `<lint command>` passes
- [ ] `<format check>` passes
- [ ] dist/ layout matches manifest expectations
- [ ] No unsafe patterns (innerHTML scan, API key payload scan)

## When blocked

Log a message in 1playground.md tagged [CODEX] → [CLAUDE] or [CODEX] → [USER].
Do not guess. Do not act outside lane.
```

---

## The Full Build Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. CLAUDE writes BP-NNN in Build.md → Active Proposal                      │
│     (scope table, approach, compliance check, risk level)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  2. CODEX reviews → updates Codex row in Build.md review table              │
│     GEMINI reviews → updates Gemini row in Build.md review table            │
│     Both log their review in 1playground.md                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  3. USER types "go" → approval recorded in Build.md user row                │
├─────────────────────────────────────────────────────────────────────────────┤
│  4. CLAUDE builds — exactly as proposed, no scope additions                 │
│     Runs tests after every subphase (task group), not just end of phase     │
│     Fills in post-build checklist in Build.md                               │
│     Updates 1playground.md with build result                                │
│     Updates CLAUDE.md session handoff                                        │
│     Moves BP block from Active Proposal → Build History in Build.md         │
├─────────────────────────────────────────────────────────────────────────────┤
│  5. CODEX commits, runs E2E smoke test, logs results in 1playground.md      │
│     GEMINI runs security/policy smoke, logs results in 1playground.md       │
├─────────────────────────────────────────────────────────────────────────────┤
│  6. Phase sealed — all agents update their handoff files                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## How Claude References Its Work

After every significant action, Claude does three things in the same turn:

1. **Updates `1playground.md`** — adds a coordination log entry describing what was built, test counts, build size, and what Codex needs to do next.

2. **Updates `CLAUDE.md`** Session Handoff — sets "Last build", "Uncommitted", "Next action" fields so the next session starts with full context.

3. **Fills in the post-build checklist** in `Build.md` — marks each item ✅ or ❌ with a note. This is Codex's signal to proceed.

Claude does not commit. Claude does not push. Claude logs these facts and hands off.

**Example `1playground.md` entry from Claude:**

```
| 28 | CLAUDE | ALL | BP-006 built ✅. 7 files: types.ts (added AISummaryResult),
aiSummary.ts (prompt builder, SHA-256 diff hash, background-proxied fetch),
background/index.ts (FETCH_AI_SUMMARY handler), storage.ts (AI local cache),
sidebar/index.ts (updateAISummary, 5 states), sidebar.css (AI section + dark
mode), manifest.json (CSP connect-src). Build ✅ (content.js 15.64kB) · tests
80/80 ✅ · lint ✅ · format ✅ · unsafe HTML scan ✅. Awaiting Codex commit +
Gemini smoke test. |
```

---

## How Codex References Its Work

After every commit and E2E run, Codex adds a log entry to `1playground.md` covering:

- Exact files committed and the commit hash.
- Every command run and its result (`npm run build:ext` ✅, `npm run test:ext` ✅ 9/9, etc.).
- Any findings — bugs discovered, findings escalated to Claude or Gemini.
- What is expected next.

Codex also keeps `CODEX.md` up to date whenever its permanent rules change.

**Example `1playground.md` entry from Codex:**

```
| 54 | CODEX | ALL | BP-014 committed — commit f86f02f on main. 15 files: 4 new
(aiSummary.ts, fileExtractor.test.ts, aiSummary.test.ts, README.md) + 11
modified. GFE 41/41 ✅ · TFE 129/129 ✅ · build ✅ · lint ✅ · format ✅.
Next: load git-file-explainer/dist/ in Chrome and smoke-test on a GitHub blob
page; Gemini to log result as entry #55. |
```

---

## How Gemini References Its Work

Gemini logs every review and smoke test result in `1playground.md`:

- What it checked (policy checklist, security audit, live smoke, schema validation).
- Specific findings — elevated to SECURITY PRIORITY if data privacy or external egress is involved.
- Whether it approved or blocked the BP.
- Any suggested improvements (Gemini can suggest, not implement).

**Example `1playground.md` entry from Gemini:**

```
| 37 | GEMINI | CLAUDE | Security and logic audit of open bugs complete.
BUG-6, BUG-7, BUG-9, and BUG-10 must be addressed before the Phase 4 seal.
BUG-10 is elevated to Security Priority — it violates the project's data
privacy policy (isSensitive attributes egress to API). Please fix these in
the next BP before any phase seal. |
```

---

## How Agent Discussion Works

Agents communicate **only through `1playground.md`**. There is no direct channel between them.

The flow of a typical dispute:

```
Codex finds a bug after Claude's build
  → Codex logs [CODEX → CLAUDE] in 1playground.md with details
  → Claude reads it next session, posts [CLAUDE → CODEX] with fix plan
  → Claude builds the fix (new BP if in scope, inline fix if trivial)
  → Codex re-runs checks, logs [CODEX → ALL] with result
```

The flow of a Gemini escalation:

```
Gemini flags a security issue
  → Gemini logs [GEMINI → CLAUDE] in 1playground.md, marks SECURITY PRIORITY
  → Claude addresses the finding in the next BP proposal
  → Claude explicitly cites Gemini's log entry number in the proposal's compliance section
  → Gemini re-reviews, signs off with [GEMINI → USER] entry
```

**Rules for discussion:**

- Never edit another agent's log entry.
- Cite the log entry number you are responding to (e.g. "Addressing Codex #12 blockers:").
- Use `→ ALL` when information is relevant to every agent.
- Use `→ USER` when the user must make a decision.
- Never leave a blocking finding unacknowledged — if Claude cannot address Codex #12, log why.

---

## Bug Tracking

All bugs live in `1playground.md` under an `## Open Bugs` section.

```markdown
## Open Bugs

| ID     | Description                                            | Found by | Phase | Status                      |
| ------ | ------------------------------------------------------ | -------- | ----- | --------------------------- |
| BUG-1  | lint fails on scripts/generate-icons.js (Node globals) | Codex    | 1     | fixed — ESLint ignore added |
| BUG-2  | format:check fails on 11 files                         | Codex    | 1     | fixed — Prettier ran        |
| BUG-10 | isSensitive data egress to API — SECURITY PRIORITY     | Gemini   | 4     | fixed — BP-010              |
```

**Bug rules:**

- Never delete a bug entry — mark `status: fixed` with a note on how it was fixed.
- Security Priority bugs block the phase seal — they must be fixed before the next phase starts.
- The agent who found the bug logs it. The agent who fixed it adds the fix note.

---

## How the Build Actually Happened on This Project

This section documents real patterns from the Terraf / Git File Explainer project as concrete examples.

### The node path problem

Node was not on PATH in the Bash environment. Local Node 22 was installed at `.tools/node-v22.22.3-darwin-arm64/bin/`. Every npm command was prefixed:

```bash
export PATH="/path/to/project/.tools/node-v22.22.3-darwin-arm64/bin:$PATH"
node_modules/.bin/vitest run --config git-file-explainer/vitest.config.ts
```

Document your runtime path in `CLAUDE.md` → Toolchain reference so every session starts knowing it.

### The Vite multi-entry problem

Vite 8 blocks IIFE format with multiple entries in lib mode. The solution was three separate single-entry Vite configs:

```
vite.scripts.config.ts    → content script  → dist/content.js
vite.background.config.ts → service worker  → dist/background.js
vite.config.ts            → popup bundle    → dist/popup/popup.js
                          + cpSync public/ → dist/
```

This split was discovered mid-build and documented in `CLAUDE.md` Gotchas so it was never re-litigated.

### How proposals were revised

A proposal could go through multiple rounds. Codex found blockers and logged them (`[CODEX → CLAUDE]`). Claude addressed them, updated the proposal, and Codex re-reviewed. The `1playground.md` log shows the exact back-and-forth. No code was written until both Codex and Gemini approved.

### How phases were sealed

After all builds in a phase completed, Claude posted `Phase N sealed ✅` in `1playground.md → ALL`. Codex ran a final E2E pass. Gemini confirmed smoke. Claude moved all BP blocks from `Active Proposal` to `Build History` in `Build.md`. `CLAUDE.md` was updated to the next phase's starting state.

### How scope creep was caught

When Codex found that code changes exceeded the BP scope (BUG-13 / log entry #40), it blocked the commit, logged the violation, and required a new BP to cover the extra scope. Claude acknowledged the violation (log entry #41), posted a retroactive proposal, and committed to following the process going forward. The workflow survived because the log was honest.

---

## Session Start Checklist (all agents)

Run this mentally at the start of every session:

1. **Read `AGENTS.md`** (this file) — confirm your role and lane.
2. **Read `CLAUDE.md`** → Session Handoff — understand current state, open bugs, next actions.
3. **Read `1playground.md`** → Coordination Log — read all entries, especially any tagged to you.
4. **Read `Build.md`** → Active Proposal — confirm whether there is a pending BP waiting for review or execution.
5. **Check git status** (Codex) or **check test count** (Claude) to confirm no untracked surprises.

Do not act until you have read all four. Do not assume state from the previous session — always verify against current files.

---

## Proposal Numbering

Proposals are numbered `BP-NNN` sequentially across the entire project. Never reuse a number. Never skip. When starting a project, begin at `BP-001`. The current highest BP number is always visible in `Build.md` → Build History.

---

## Phase Structure (template)

```markdown
## Phases

| Phase | Name          | Key deliverable                           | Status     |
| ----- | ------------- | ----------------------------------------- | ---------- |
| 1     | Foundation    | Scaffold, build pipeline, route detection | ✅ Sealed  |
| 2     | Core engine   | Local logic, no API calls                 | ✅ Sealed  |
| 3     | AI layer      | External API integration, streaming       | 🔄 Active  |
| 4     | Polish + ship | Store prep, onboarding, policy review     | ⏳ Pending |
```

A phase is sealed only when:

- All BPs in the phase are built and in Build History.
- Codex E2E smoke passes.
- Gemini policy review passes.
- Claude has updated `CLAUDE.md` to the next phase's starting state.

---

## What Not to Do

These are real failures from the Terraf project:

- **Do not write code before a BP is approved.** (Happened in BP-011/012 — required retroactive proposals and a workflow violation acknowledgement in the log.)
- **Do not prefill post-build checklist ✅ marks before the build runs.** (Codex flagged this as a blocker in BP-004.)
- **Do not add scope during a build.** If you discover the proposal needs expansion, pause, update the proposal, wait for re-approval.
- **Do not leave a coordination log entry unanswered.** If Codex posts a question and Claude doesn't respond, the project stalls silently.
- **Do not assume the previous session's node path is still valid.** Always verify runtime availability before running commands.
- **Do not commit `node_modules/`, `.tools/`, or any generated `dist/` output** unless it has been explicitly added to the BP scope and reviewed.
