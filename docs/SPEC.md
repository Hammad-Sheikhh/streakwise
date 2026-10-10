# Streakwise — Product Specification

| | |
|---|---|
| **Version** | 2.1 |
| **Status** | Approved for build |
| **Users** | One (the owner, a student) |
| **Builder** | Claude Code, following docs/SETUP.md and CLAUDE.md |

## How to use this document

- **Part A** is plain English for the owner. It's the only part the owner needs to read.
- **Part B** is the technical specification for Claude Code. It is the source of truth for what to build.
- Every requirement in Part B has an **ID** (e.g. `LOG-3`) and a **priority**:
  - **MUST**: required for v1.0
  - **SHOULD**: build it unless time or usage runs short
  - **COULD**: only if everything else in the milestone is done

  If something has to be cut, follow the cut order in §B14.5. PR descriptions, tests, and the final
  checklist refer to these IDs.
- Changing this spec needs the owner's OK. Record every change in the decision log (§B15).

---

# Part A — In plain English (for the owner)

## A1. What you're building

A private study tracker that works on your phone and laptop. You log your study time yourself
(there's no timer) under your three tracks:

- **Exam Prep**: flashcards and your class
- **School Subjects**: Maths and English
- **Online Course**: your institute course

Each track has **subtasks** (like Maths), and each subtask can have **topics** (like Chapter 3).
You can also create to-do **tasks** anywhere, with sub-tasks nested as deep as you like. One
example is a weekly self-test that you give yourself a score on.

The app then shows you:
- how much you studied today and this week, compared with weekly goals you set
- anything you haven't touched for 3 or more days
- your study streak, and a GitHub-style grid (a **heatmap**) of every day you studied
- how much of each syllabus is done, and how your past paper, quiz, and revision scores are changing
- how many days are left until each exam

You can turn any day or week into a **report**: print it as a PDF, copy it into WhatsApp, copy it
into Claude for advice, or share a private link with a teacher or parent. **Claude can also connect
to the app directly**, so in a chat you can say "log 45 minutes of Maths" or "what am I neglecting?"

Visitors to your portfolio get a **demo with made-up data**, so your real data stays private.

## A2. The screens

| Screen | What it's for |
|---|---|
| **Home** | Warnings, today's total, streak, weekly goals, tasks due, exam countdowns, heatmap |
| **+ Log** | Log a study session in under 15 seconds |
| **Tasks** | Your to-do lists, including the weekly revision |
| **Scores** | Past papers, quizzes, revision scores, and how they're trending |
| **Reports** | Create, print, copy, and share reports |
| **History** | Every session you've logged, which you can edit or delete |
| **Track pages** | Everything about one track on one page |
| **Settings** | Your name, goals, subjects, exam dates, shared links, data download, Claude connection |

## A3. Decisions you've already made

- Only you use the app, protected by a passcode. There's no sign-up.
- Three tracks with three levels each (track → subtask → topic). Tasks can nest as deep as you want.
- You log time by hand. There's no timer.
- Weekly goals are set per track. A warning appears after 3 days without study.
- Scores: past papers, quizzes, mock tests, and weekly self-tests.
- Reports are in English and formal enough for teachers and parents. Your private notes are hidden
  from reports unless you switch them on.
- Reports can be shared as a link, like a Claude artifact link.
- Light or dark mode follows your phone's setting. The app can be installed on your phone's home screen.
- It's built professionally for your portfolio: React + TypeScript, a public GitHub repo, tests,
  pull requests, an MIT license, and a demo mode.
- Claude Code explains what it's doing as it builds and asks you before big decisions.

## A4. How it stays free

- **Netlify** (hosting): the free plan gives 300 credits a month. Each update of the **live site**
  costs about 15 credits, so about 20 live updates a month. If the credits run out, the site can stop
  working until the next month. **Test versions (previews) are free.** So Claude Code builds on a test
  branch and updates the live site only about **5 times during the whole build**, and always asks you first.
- **Supabase** (database): the free plan **pauses a database after 7 days without use** and has no
  automatic backups. The app pings your real database automatically every few days, and you can
  download a full backup from Settings at any time.
- **Two databases:** one for testing and one for your real data, so experiments never touch your real log.
- GitHub is free for public projects. Building uses your Claude subscription.

## A5. When you can start using it

The whole build takes roughly **10–13 Claude Code sessions**, split into 9 milestones (M0–M8).

| After | What you get |
|---|---|
| Milestone 2 (first live update) | You can **start logging for real** on your phone, and edit your history |
| Milestone 4 (second live update) | Home dashboard, heatmap, streaks, exam countdowns, and **Claude connected**. This is the **minimum useful version**: if exams or usage limits get in the way, it's fine to pause here |
| Milestone 6 (third live update) | Topics and syllabus %, tasks, scores, reports, and share links |
| Milestone 8 (final update) | The polished portfolio version: demo mode, installable app, README with screenshots |

## A6. Words you'll see

| Word | Meaning |
|---|---|
| **Repo** | Your project's folder on GitHub |
| **Branch** | A separate copy of the code where changes are made safely |
| **PR (pull request)** | A proposal to add a branch's changes into the main code |
| **CI** | Automatic checks that run on every PR |
| **Deploy preview** | A free test version of the site, created for each PR |
| **Production / live site** | The real site you use every day |
| **Release** | Updating the live site with everything finished so far |
| **Migration** | A file that creates or changes the database's tables |
| **Environment variable** | A secret setting (like a password) stored in Netlify, never in the code |
| **Netlify Function** | A small piece of server code that talks to the database |
| **RLS** | A database lock that makes sure only the server can read your data |
| **MCP / connector** | How Claude connects to your app |
| **PWA** | A website you can install like an app |

---

# Part B — Technical specification (for Claude Code)

## B1. Goals

| ID | Goal |
|---|---|
| G1 | Logging a session takes under 15 seconds on a phone |
| G2 | Home answers "How am I doing this week, and what am I neglecting?" at a glance |
| G3 | Reports can be sent to a teacher or parent unchanged |
| G4 | Claude can log sessions and analyse progress through MCP |
| G5 | A portfolio visitor can use the full app in demo mode without touching real data |
| G6 | Runs entirely on free tiers (Netlify, Supabase, GitHub) |

## B2. Actors and access

| Actor | Access |
|---|---|
| Owner | Full app, after entering the passcode |
| Viewer of a shared report | That one report snapshot, without logging in |
| Portfolio visitor | `/demo`, with in-browser sample data |
| Claude | The MCP endpoint at a secret URL |

## B3. Domain model

**B3.1 Nodes (the structure tree)**
- A tree where depth 1 = **track**, 2 = **subtask**, 3 = **topic**. Maximum depth is 3; topics have no child nodes.
- Every node has: a name (1–60 characters, unique among siblings, case-insensitive), a sort order, and an archived flag.
- Tracks also have: a color (one of 8 palette tokens) and an optional weekly target in minutes.
- Topics also have: a status (`not_started` | `in_progress` | `done`) and the time they were marked done.

**B3.2 Sessions.** A session belongs to any non-archived node and has a local date, minutes, an
optional note, and a source (`app` | `claude`). Time rolls up: a session counts for its own node and
for every ancestor.

**B3.3 Tasks.**
- Each task is attached to a node at any depth and may have a parent task, nested to any depth.
- Recurrence is `none` (with an optional due date) or `weekly` (no due date; due every week).
- A task can be scored, with a default maximum score.
- Completions are stored as records. A one-off task has at most one completion; a weekly task has at most one per week.

**B3.4 Scores.** Each score has a kind (`past_paper` | `quiz` | `mock_test` | `revision` | `other`),
a title, a date, a score, a maximum, a node, a note, and an optional link to a task completion.

**B3.5 Deadlines.** A title, a date, and a node.

**B3.6 Shared reports.** A frozen JSON snapshot, a slug, a creation date, and optional expiry and revocation dates.

## B4. Seed data

Seeding runs **automatically on the first successful login when the `nodes` table is empty**, and it is idempotent.

```
Exam Prep          color: amber
├─ Flashcards
└─ Practice
School Subjects    color: blue
├─ Maths
└─ English
Online Course      color: violet
```

- One task: "Weekly self-test" on Exam Prep, weekly, scored, default max 20.
- Settings: student name empty (the app asks for it the first time a report is made); neglect threshold 3.
- No topics, targets, or deadlines. No personal information anywhere in the seed.

## B5. Functional requirements

### B5.1 Authentication (AUTH)
| ID | Priority | Requirement |
|---|---|---|
| AUTH-1 | MUST | `/login` has a passcode field and a "Try the demo" button. |
| AUTH-2 | MUST | A correct passcode sets a signed, httpOnly, Secure, SameSite=Strict session cookie valid for 30 days. A wrong passcode shows a calm error with no hints. |
| AUTH-3 | MUST | Every `/api/*` route requires a valid session, except `auth/login`, `share/:slug` (public read), `health`, and `keepalive`. |
| AUTH-4 | MUST | Logout (in Settings) clears the cookie. |
| AUTH-5 | MUST | 5 wrong attempts from one IP within 15 minutes locks login from that IP for 15 minutes. IPs are stored only as salted hashes. |

### B5.1a Accounts (ACCT) — added by D17, replaces the passcode (AUTH-1, AUTH-2)
| ID | Priority | Requirement |
|---|---|---|
| ACCT-1 | MUST | Accounts live in **Supabase Auth**, called only by Netlify Functions (D5 still holds: the browser never talks to Supabase). Anyone can sign up at `/signup` with name, email and a password of at least 8 characters. |
| ACCT-2 | MUST | When email sending is set up, a new account must confirm its email before it can log in. The confirmation link opens `/auth/confirm` on our site (token-hash flow), never a Supabase page. |
| ACCT-3 | MUST | `/login` has email + password, "Forgot password?", "Create an account", and "Try the demo". A correct login sets a signed, httpOnly, Secure, SameSite=Strict session cookie for that user, valid for 30 days (Supabase Auth checks the password only at login). Changing the password logs out other devices. Wrong details show one calm message that doesn't reveal whether the email exists. |
| ACCT-4 | MUST | Forgot password emails a one-time reset link that opens `/reset-password` on our site, where a new password is chosen. The response never reveals whether the email has an account. |
| ACCT-5 | MUST | Every data row (nodes, sessions, tasks, completions, scores, deadlines, shared reports, settings) belongs to one user (`user_id`), and every server read and write is limited to the logged-in user. The database itself refuses rows that point at another user's rows (composite foreign keys). |
| ACCT-6 | MUST | A new account gets the standard seed (§B4) on its first login. |
| ACCT-7 | MUST | ✅ Done 2026-10-09, then removed by migration `0004` (D19). Claiming existing data: while unclaimed rows (from before accounts) exist and `APP_PASSCODE` is set, the login page's "I have the old passcode" option accepts the passcode once, then asks the owner to create (or log into) an account; all unclaimed rows and the old settings move to it atomically. After that, the passcode is no longer accepted. |
| ACCT-8 | MUST | Each user has their own Claude link `/mcp/<token>`. Only a hash of the token is stored, so Settings → Claude connection shows the link right after "Create link" / "Make a new link" (the old link stops working). The link reaches only that user's data. |
| ACCT-9 | MUST | Settings → Account shows the email, and offers change password, log out, and delete account (typing DELETE to confirm; deletes all of the user's data). |
| ACCT-10 | MUST | Abuse limits: AUTH-5's lockout applies to login (per hashed IP), and sign-up and reset requests are limited per hashed IP (5 per hour). |
| ACCT-11 | MUST | Emails (confirmation, reset) are sent by Supabase through custom SMTP (Brevo, sender = the owner's verified address); templates are in `docs/email-templates/`. Without SMTP set up, the app still works: confirmation is off and the owner can't send reset emails. |
| ACCT-12 | SHOULD | Demo mode is unchanged and never touches accounts. |

### B5.2 Structure (TREE)
| ID | Priority | Requirement |
|---|---|---|
| TREE-1 | MUST | Settings → Structure shows the tree. Nodes can be added and renamed at every level. Depth above 3 is rejected in both the UI and the API. |
| TREE-2 | MUST | Archiving a node hides it, its descendants, and their tasks from pickers, lists, and warnings. Its history still counts in reports. |
| TREE-3 | MUST | A node can be deleted only if neither it nor any descendant has sessions, tasks, scores, or deadlines. Otherwise the app offers Archive instead. The deletion is atomic. |
| TREE-4 | MUST | Track colors come from a fixed palette of 8 accessible colors and are used consistently (badges, charts, heatmap). |
| TREE-5 | SHOULD | Archived nodes can be restored (Settings → Structure → "Show archived"). |
| TREE-6 | SHOULD | Siblings can be reordered with up/down buttons. |
| TREE-7 | COULD | Drag-and-drop reordering; moving a node to another parent (with depth rules enforced). |

### B5.3 Logging (LOG)
| ID | Priority | Requirement |
|---|---|---|
| LOG-1 | MUST | "+ Log" is reachable from every screen (bottom nav on mobile, a button on desktop). It also accepts `?node=<id>` to preselect a node. |
| LOG-2 | MUST | The node picker lets you choose a track, then optionally a subtask, then optionally a topic. Only non-archived nodes appear. |
| LOG-3 | MUST | The date defaults to today (Asia/Karachi), with Today/Yesterday chips and a date picker. Future dates are rejected. |
| LOG-4 | MUST | Duration is entered as hours + minutes, with chips for 15m, 30m, 45m, 1h, 1.5h, and 2h. The total must be 1–1440 minutes. |
| LOG-5 | MUST | An optional note of up to 500 characters. |
| LOG-6 | MUST | Logging to a `not_started` topic sets it to `in_progress`. This happens server-side, so it also applies to MCP. |
| LOG-7 | SHOULD | One-tap shortcuts for the 5 most recently used nodes, derived from recent sessions so they work across devices. |
| LOG-8 | SHOULD | A "+ New topic" option appears inline when a subtask is selected. |
| LOG-9 | SHOULD | After saving, a toast offers Undo for 10 seconds. |
| LOG-10 | SHOULD | A soft warning (not a block) appears if the day's total would exceed 16 hours. |

### B5.4 History (HIST)
| ID | Priority | Requirement |
|---|---|---|
| HIST-1 | MUST | Sessions are grouped by day, newest first, with a total for each day. History loads 30 days at a time. |
| HIST-2 | MUST | Sessions can be edited (all fields) and deleted (with confirmation). |
| HIST-3 | SHOULD | Filters: node (including descendants), date range, and source. |
| HIST-4 | SHOULD | Sessions with source `claude` show a "via Claude" badge. |

### B5.5 Home dashboard (DASH, TGT, NEG, STRK, HEAT, DEAD)
| ID | Priority | Requirement |
|---|---|---|
| DASH-1 | MUST | Home on mobile, top to bottom: (1) neglect warnings, if any; (2) today's total and current streak; (3) weekly target progress per track; (4) tasks due this week; (5) next 3 deadlines; (6) heatmap; (7) a link to this week's report. Desktop may use two columns in the same priority order. All data comes from one dashboard request. Sections that depend on later milestones (tasks in M5, the report link in M6) appear when those milestones land. |
| TGT-1 | MUST | Each track can have a weekly target in hours (0.5 h steps; empty means no target). |
| TGT-2 | MUST | Each track shows a progress bar for this week (§B9.4) with a label like "3h 20m / 8h". Tracks without a target show their time only. |
| NEG-1 | MUST | Neglect warnings follow §B9.5, e.g. "English — 4 days untouched" or "Online Course — never logged". Tapping a warning opens Log with that node preselected. |
| NEG-2 | COULD | Mute warnings for a specific node. |
| STRK-1 | MUST | Current streak (§B9.6). |
| STRK-2 | SHOULD | Longest streak. |
| HEAT-1 | MUST | A GitHub-style heatmap: one square per day, columns = weeks, rows = Mon–Sun. It covers the last 12 months; on mobile it scrolls horizontally and starts scrolled to today. It has 5 levels (§B9.8), month labels, and a less → more legend. |
| HEAT-2 | MUST | Every cell has an accessible label (e.g. "Mon 6 Oct 2026: 1h 30m"), shown on hover or tap. |
| HEAT-3 | SHOULD | Tapping a day opens that day's sessions. |
| HEAT-4 | COULD | Filter the heatmap by track (cells use the track's color). |
| DEAD-1 | MUST | Deadlines can be added, edited, and deleted (title, date, node). |
| DEAD-2 | MUST | Home shows the next 3 upcoming deadlines with days left. Past deadlines are hidden. |
| DEAD-3 | SHOULD | Next to each deadline whose node has topics, show the % of syllabus not yet done. |

### B5.6 Topics and syllabus (TOP)
| ID | Priority | Requirement |
|---|---|---|
| TOP-1 | MUST | A status control for each topic (not started / in progress / done). A done topic can be reopened. |
| TOP-2 | MUST | Syllabus % is shown for every subtask and track that has topics (§B9.7). |

### B5.7 Tasks (TASK)
| ID | Priority | Requirement |
|---|---|---|
| TASK-1 | MUST | The Tasks screen groups tasks by track, then by node, as a collapsible nested list. |
| TASK-2 | MUST | Creating a task or sub-task takes: a title (1–120 characters), an optional description, a node, **either** an optional due date **or** weekly recurrence, and a scored on/off switch with a default max. |
| TASK-3 | MUST | Sub-tasks nest to any depth. The UI indents up to 4 levels; deeper levels stay at the level-4 indent with a small depth marker. |
| TASK-4 | MUST | One-off tasks can be completed and uncompleted. |
| TASK-5 | MUST | A weekly task is due every week (Mon–Sun) until it's completed for that week. Its completion history is visible on the task. |
| TASK-6 | MUST | Completing a scored task asks for a score (with the default max prefilled) and an optional note, then creates a linked score. Uncompleting deletes the completion and its linked score after confirmation. Both actions are atomic. |
| TASK-7 | MUST | "Due this week" (on Home and as a Tasks filter) = weekly tasks not yet completed this week + one-off tasks due on or before this Sunday that aren't completed. Overdue tasks are highlighted. |
| TASK-8 | MUST | Tasks can be edited, archived, and deleted. Deleting a task deletes its sub-tasks and completions after confirmation; linked scores are kept but unlinked. |
| TASK-9 | SHOULD | Parent tasks show sub-task progress, e.g. "3/5". Weekly sub-tasks count as done if they're completed this week. Parents are never completed automatically. |
| TASK-10 | COULD | A weekly task can be completed for the previous week (backfill). |

### B5.8 Scores (SCORE)
| ID | Priority | Requirement |
|---|---|---|
| SCORE-1 | MUST | Scores can be added, edited, and deleted: kind, title, date (≤ today), score (≥ 0), max (> 0 and ≥ score), node, note. |
| SCORE-2 | MUST | A line chart of percentage over time, with one line per subtask (or per track when the score is at track level). Filterable by track and kind. |
| SCORE-3 | MUST | A results table, newest first. |
| SCORE-4 | SHOULD | A trend indicator per line: the average of the last 3 results vs the previous 3 (▲/▼ with the difference in percentage points). |
| SCORE-5 | SHOULD | Default views: each track's chart opens on the score kind it records most. |

### B5.9 Track pages (TRACK)
| ID | Priority | Requirement |
|---|---|---|
| TRACK-1 | SHOULD | `/tracks/:id` shows: this week vs target, all-time total, subtasks with time and syllabus %, topics with status controls, tasks, score chart, deadlines, and recent sessions. |

### B5.10 Reports (REP)
| ID | Priority | Requirement |
|---|---|---|
| REP-1 | MUST | Periods: Today, This week, Last week. |
| REP-2 | SHOULD | Period: Yesterday. |
| REP-3 | COULD | Custom date range (max 92 days). |
| REP-4 | MUST | Content: a header (student name, period, generated date/time, app name); totals (time, sessions, active days, current streak); time per track and subtask, with % of target for week periods; topics studied and topics marked done; tasks completed (with scores); scores recorded; neglected nodes at the end of the period; the next 3 deadlines. |
| REP-5 | MUST | An "Include notes" toggle, off by default. |
| REP-6 | MUST | Print / Save as PDF, using a dedicated print stylesheet (§B10.3). |
| REP-7 | MUST | Copy as text, in WhatsApp format (§B10.1). |
| REP-8 | MUST | Copy for Claude, in Markdown (§B10.2). |
| REP-9 | MUST | All report content comes from one shared function, `buildReport`, used by the app, share links, demo mode, and MCP. |

### B5.11 Shared report links (SHARE)
| ID | Priority | Requirement |
|---|---|---|
| SHARE-1 | MUST | "Share link" stores a frozen snapshot of the report as shown (respecting the notes toggle) and returns `/r/<slug>`. The slug is at least 24 random URL-safe characters from a cryptographically secure generator. |
| SHARE-2 | MUST | The public page shows only the report, with the same look as the print view. It has no navigation into the app, sets `noindex` (meta tag + `X-Robots-Tag` header), and shows a "Made with Streakwise" footer. |
| SHARE-3 | MUST | Settings → Shared links lists every link (period, created, expires) with a Revoke button. |
| SHARE-4 | MUST | An expired or revoked link shows "This report is no longer available." |
| SHARE-5 | SHOULD | Links expire after 30 days. |
| SHARE-6 | COULD | Choice of expiry: 7 days, 30 days, or never. |

### B5.12 Settings and data (SET)
| ID | Priority | Requirement |
|---|---|---|
| SET-1 | MUST | A Settings shell with student name, neglect threshold (1–14 days, default 3), and logout (M2). Other sections are added by their own milestones: targets, structure, deadlines, shared links, export, Claude connection. |
| SET-2 | MUST | Export: all data as JSON, and sessions as CSV. Records the export time. |
| SET-3 | SHOULD | A backup reminder in Settings and on Home when the last export is more than 30 days ago (or there has never been one). |
| SET-4 | SHOULD | A "Claude connection" section: setup steps, the MCP URL masked with a copy button, and the time of the last MCP call. |

### B5.13 Installable app (PWA)
| ID | Priority | Requirement |
|---|---|---|
| PWA-1 | SHOULD | Installable (manifest, icons, theme color); opens full-screen. |
| PWA-2 | SHOULD | The service worker caches only the app shell. It never caches responses from `/api/*` or `/mcp/*`. |
| PWA-3 | COULD | When offline, the app shell loads and shows "You're offline". |

### B5.14 Demo mode (DEMO)
| ID | Priority | Requirement |
|---|---|---|
| DEMO-1 | MUST | `/demo` (from "Try the demo" on the login page) runs the full app on in-browser sample data. |
| DEMO-2 | MUST | Demo mode uses the same core services as the server, backed by the in-memory repository (§B12). It never calls `/api` or `/mcp`. |
| DEMO-3 | MUST | Sample data is generated relative to today with a seeded random generator: about 12 weeks of sessions across all tracks, topics in every status, nested and weekly tasks, past paper/quiz/revision scores, 3 deadlines, and at least one neglected subtask. Student name: "Demo Student". |
| DEMO-4 | MUST | A persistent banner: "Demo — sample data. Changes aren't saved." Changes reset on reload. |
| DEMO-5 | MUST | Share links and the Claude connection are disabled in demo mode, each with a one-line explanation. Print and copy still work. |

### B5.15 MCP server (MCP)
| ID | Priority | Requirement |
|---|---|---|
| MCP-1 | MUST | The endpoint is `/mcp/:secret`. ~~The secret is compared to `MCP_SECRET` in constant time~~ Since D17 the secret is the user's own token (ACCT-8), looked up by its hash; no match returns 404. |
| MCP-2 | MUST | Uses the official MCP TypeScript SDK with the Streamable HTTP transport, stateless, inside a Netlify Function. Check the current SDK docs and any current Netlify guidance on hosting MCP servers, and verify with MCP Inspector before connecting Claude. |
| MCP-3 | MUST | The server's `instructions` explain tracks/subtasks/topics, tasks, scores, the time zone, and that durations are in minutes. |
| MCP-4 | MUST | Tools call the core services directly (not over HTTP) and return compact JSON text. Lists are capped (default 50, max 200) with a `truncated` flag. Each call updates the "last MCP call" time. |
| MCP-5 | MUST | Node references accept an id, or a path like `School Subjects > Maths > Chapter 3` (case-insensitive, `>`-separated; a unique partial name like `maths` also works). An ambiguous or unknown reference returns an error listing up to 5 closest matches. |
| MCP-6 | MUST | Dates accept `today`, `yesterday`, or `YYYY-MM-DD`, interpreted in Asia/Karachi. |
| MCP-7 | MUST | Sessions created through MCP have `source = 'claude'`. |
| MCP-8 | MUST | Every tool has a Zod input schema, a description written for an AI reader, and correct annotations (`readOnlyHint` for reads, `destructiveHint` for deletes). |
| MCP-9 | MUST | The tools below, each delivered in the milestone shown. |

| Tool | Purpose | Milestone |
|---|---|---|
| `get_structure` | The tree with ids, topic statuses, and archived flags | M4 |
| `log_session` | Log a session (node, minutes, date, note) | M4 |
| `list_sessions` | Sessions filtered by node, date range, and source | M4 |
| `delete_session` | Delete a session by id (destructive) | M4 |
| `get_progress` | Weekly targets, streaks, syllabus %, upcoming deadlines | M4 |
| `find_gaps` | Neglected nodes, tracks behind pace (§B9.4), topics not started; tasks due/overdue are added in M5 | M4 |
| `add_node` | Create a subtask or topic | M4 |
| `list_deadlines` | Upcoming deadlines with days left | M4 |
| `set_topic_status` | Set a topic to not_started / in_progress / done | M5 |
| `list_tasks` | Tasks by node and status, including weekly "due this week" | M5 |
| `add_task` | Create a task or sub-task | M5 |
| `complete_task` | Complete a task (with a score if it's scored) | M5 |
| `log_score` | Record a score | M5 |
| `get_report` | Report data for a period, from `buildReport` | M6 |

### B5.16 Operations (OPS)
| ID | Priority | Requirement |
|---|---|---|
| OPS-1 | MUST | `GET /api/health` returns `{ ok: true, version }` without touching the database. |
| OPS-2 | MUST | `GET /api/keepalive` does one trivial database read. A scheduled GitHub Actions workflow calls it on the production URL every 3 days (and on manual dispatch). The workflow skips quietly if the `PROD_URL` repository variable isn't set yet. |
| OPS-3 | MUST | Server logs are structured and never contain secrets, passcodes, or note text. |
| OPS-4 | MUST | Releases follow the deploy budget in §B14.1. |

## B6. Screens and navigation

| Route | Screen | IDs |
|---|---|---|
| `/login` | Passcode + "Try the demo" | AUTH |
| `/` | Home dashboard | DASH, TGT, NEG, STRK, HEAT, DEAD |
| `/log` | Log session (a sheet on mobile, a dialog on desktop) | LOG |
| `/history` | History | HIST |
| `/tasks` | Tasks | TASK |
| `/scores` | Scores | SCORE |
| `/reports` | Reports | REP, SHARE |
| `/tracks/:id` | Track page | TRACK, TOP |
| `/settings/*` | Settings sections | SET, TREE, TGT, DEAD, SHARE |
| `/r/:slug` | Public shared report | SHARE |
| `/demo/*` | Demo mode, mirroring the app's routes | DEMO |

- **Mobile:** a bottom nav with **Home · Tasks · + Log · Reports · More**. More contains History, Scores, Tracks, and Settings.
- **Desktop:** a sidebar, with content in a comfortable max width.
- Every list and chart has an empty state that tells the owner what to do next.

## B7. Data model (Supabase Postgres)

**Create the whole schema in the first migration (`0001_initial.sql`) during M1**, so the owner
runs SQL by hand as rarely as possible. Later changes go only in new numbered migrations.
Names and types may be refined, but the rules below must hold.

| Table | Columns and constraints |
|---|---|
| `nodes` | id uuid pk · parent_id → nodes (on delete restrict) · depth smallint check 1–3 · name check length 1–60 · color (tracks only) · sort_order · weekly_target_minutes check ≥ 0 (tracks only) · topic_status check in (not_started, in_progress, done) (topics only) · topic_done_at · archived_at · created_at · updated_at · unique (parent_id, lower(name)) with NULLS NOT DISTINCT |
| `sessions` | id · node_id → nodes (restrict) · studied_on date · minutes check 1–1440 · note check length ≤ 500 · source check in (app, claude) · created_at · updated_at |
| `tasks` | id · node_id → nodes (restrict) · parent_task_id → tasks (cascade) · title · description · due_on · recurrence check in (none, weekly) · check (recurrence = 'none' or due_on is null) · is_scored · default_max_score · sort_order · archived_at · created_at · updated_at |
| `task_completions` | id · task_id → tasks (cascade) · period_start date (the week's Monday for weekly tasks; null for one-off) · completed_at · note · partial unique indexes: (task_id) where period_start is null; (task_id, period_start) where period_start is not null |
| `scores` | id · node_id → nodes (restrict) · task_completion_id → task_completions (on delete set null) · kind check · title · taken_on · score check ≥ 0 · max_score check > 0 and ≥ score · note · created_at |
| `deadlines` | id · node_id → nodes (restrict) · title · due_on · created_at |
| `shared_reports` | id · slug unique · snapshot jsonb · period_label · created_at · expires_at · revoked_at |
| `settings` | a single row (id boolean pk default true check (id)) · student_name · neglect_days default 3 check 1–14 · last_export_at · last_mcp_call_at |
| `login_attempts` | id · ip_hash · attempted_at · index (ip_hash, attempted_at) |

- **Indexes:** sessions (studied_on), sessions (node_id, studied_on), tasks (node_id), tasks (parent_task_id), scores (node_id, taken_on), deadlines (due_on).
- **Atomic multi-step writes use Postgres functions (RPC):** deleting a node tree, completing a task with a score, uncompleting a task with a score.
- **Enable RLS on every table with no policies**, and revoke execute on the RPC functions from `anon`
  and `authenticated`. Only the server's secret key can read or write.

## B8. API (Netlify Functions)

- Use Netlify's modern function format (Web-standard `Request`/`Response` handlers with `config.path`
  routing). Check current Netlify docs. Everything is under `/api/`.
- Handlers are thin: check auth → validate with Zod → call a core service → return JSON.
- Errors use the shape `{ "error": { "code", "message" } }` with the right status code:
  400 validation, 401 not logged in, 404 not found, 409 conflict, 429 locked out, 500 unexpected.
- **Resources:** auth (login, logout, me) · nodes · sessions · tasks (+ complete / uncomplete) · scores ·
  deadlines · settings · dashboard (one aggregated read for Home) · reports (build) ·
  shares (create, list, revoke) · public share read · export · health · keepalive.

## B9. Calculation rules

All of these live in `src/core/logic` as pure functions that take `now` as a parameter.

1. **Local date.** Every "day" is a calendar date in Asia/Karachi (UTC+5, no daylight saving). `today = localDate(now)`.
2. **Week.** Monday 00:00 to Sunday 23:59 local time. `weekStart(date)` = the Monday on or before `date`.
3. **Roll-up.** `minutes(node, range)` = the sum of sessions on the node or any of its descendants within the range.
4. **Target progress** = `minutes(track, this week) ÷ weekly target`.
   **Behind pace** (for `find_gaps`): with `expected = target × (days elapsed this week, including today) ÷ 7`, a track is behind pace if `target > 0` and `actual < 0.75 × expected`.
5. **Neglect.** For each non-archived track and subtask: `last` = the latest `studied_on` in its subtree,
   and `days = today − last` (or `today − created date` if never logged). Warn when `days ≥ neglect_days`,
   sorted by days, highest first. Topics are never warned about individually.
6. **Streak.** Let `d = today` if today has at least one session, otherwise `yesterday`. If `d` has no
   session, the streak is 0. Otherwise count the consecutive days, going back from `d`, that each have at
   least one session. **Longest streak** = the longest such run in the whole history.
7. **Syllabus %** for a subtask or track = done topics ÷ non-archived topics in its subtree. Shown as "—" when there are no topics.
8. **Heatmap levels** by the day's total minutes: 0 → L0 · 1–30 → L1 · 31–90 → L2 · 91–180 → L3 · 181+ → L4.
9. **Weekly task period:** `period_start = weekStart(local date of completion)`. A weekly task is due this week if it has no completion with `period_start = weekStart(today)`.
10. **Report metrics:**
    - Active days = distinct dates in the period with at least one session.
    - Topics marked done = topics whose `topic_done_at` falls within the period.
    - Tasks completed and scores recorded = by local date within the period.
    - Neglect is computed as of the end of the period, or as of now if the period includes today.
11. **Score %** = `score ÷ max × 100`, rounded to 1 decimal place.
12. **Duration display:** `Xh Ym`, leaving out zero parts (`45m`, `2h`, `1h 30m`); zero is shown as `0m`.

## B10. Report formats

**B10.1 Copy as text (WhatsApp).** Under about 1,000 characters. Long lists are truncated with "+N more".
The structure looks like this (the data is illustrative):

```
*Weekly study report*
<Student name> · 29 Sep – 5 Oct 2026

Total: 14h 30m · 6 of 7 days · streak 9 days

*Exam Prep* — 6h 10m of 8h (77%)
Flashcards 4h 40m · Practice 1h 30m
*School Subjects* — 5h 20m of 6h (89%)
Maths 3h 50m · English 1h 30m
*Online Course* — 3h of 4h (75%)

Completed: Maths Ch. 3 · Weekly self-test 18/20
Needs attention: English (4 days)
Coming up: Maths exam in 41 days (62% of syllabus left)
```

**B10.2 Copy for Claude (Markdown):**

```
# Study report: <period label> (<dates>)
## Summary              totals
## Time by track        table: Track | Subtask | Time | Target | %
## Topics               studied; marked done
## Tasks completed      with scores
## Scores               table: Date | Node | Kind | Title | Score | %
## Needs attention      neglected nodes with days
## Upcoming deadlines
## Notes                only if included
---
Analyse this period: what's going well, what am I neglecting, and what should I prioritise next?
```

**B10.3 Print.** A4 portrait, 15 mm margins, black text on white. Track colors appear only as small
swatches. No navigation or buttons. Sections avoid page breaks inside them. A weekly report fits on 1–2 pages.

## B11. Non-functional requirements

- **Design:** Tailwind CSS + shadcn/ui. Calm, clean, modern. The theme follows the system light/dark
  setting. Track colors are used consistently. Mobile-first, with tap targets of at least 44 px.
  Skeleton loading states and helpful empty states.
- **Accessibility:** WCAG AA contrast, full keyboard use, labelled inputs, visible focus. Color is never
  the only signal. Respect reduced-motion preferences.
- **Performance:** Home is interactive in under 2 s on a mid-range phone over 4G. Initial JavaScript is
  at most about 250 KB gzipped. Charts and the reports module are lazy-loaded.
- **Security:**
  - The browser never talks to Supabase. Secrets exist only in environment variables.
  - Nothing secret ends up in the frontend bundle or build output. Netlify's secret scanning may fail the build if it does.
  - Zod validates every input on the server.
  - Netlify builds set security headers (a CSP that works with the chosen libraries, X-Frame-Options,
    Referrer-Policy, X-Content-Type-Options), via `build/security-headers.ts` → `dist/_headers`.
  - RLS is enabled, logins are rate-limited (AUTH-5), and the MCP secret is compared in constant time.
- **Privacy:**
  - Notes are off by default in reports, and shared links expose only their snapshot.
  - Demo mode never touches real data.
  - No analytics or trackers.
  - No personal data in the repo, seed, tests, or screenshots.
- **Reliability:**
  - Every failed request shows a toast with a retry option. There are no blank screens.
  - Optimistic updates roll back if the request fails.
  - Seeding is idempotent.
- **Browser support:** current Chrome on Android, Safari on iOS, and Chrome/Edge on desktop.

## B12. Architecture and code organisation

```
src/
  app/          routing, layout, providers, auth guard
  features/     dashboard, log, history, tasks, scores, reports, tracks, settings, share, demo
  components/   shared UI (shadcn/ui lives in components/ui)
  data/         DataSource interface, ApiDataSource, DemoDataSource
  core/         isomorphic: no browser-only or Node-only APIs
    domain/     types
    schemas/    Zod schemas, shared by the UI, the API, and MCP
    logic/      pure calculations (§B9); take `now` as a parameter
    services/   use cases (logSession, buildReport, findGaps, ...); depend only on Repository
    repo/       Repository interface + InMemoryRepository
    demo/       sample-data generator (seeded random generator)
netlify/functions/
  _lib/         SupabaseRepository, session/auth, rate limiting, HTTP helpers
  *.ts          thin API handlers
  mcp.ts        MCP server (calls core services)
supabase/migrations/
e2e/            Playwright tests (run against /demo)
docs/           SPEC.md, SETUP.md, PROGRESS.md, architecture.md
```

- The UI talks only to `DataSource`:
  - `ApiDataSource` calls `/api`.
  - `DemoDataSource` runs the **same core services** in the browser on `InMemoryRepository`.

  Because both use the same services, demo mode always matches the real app, with no duplicated logic.
- `SupabaseRepository` implements `Repository` on the server. Multi-step writes that must be atomic use RPC (§B7).
- Services receive a clock, so tests are deterministic.
- Use current stable versions of all libraries. For fast-changing APIs (Netlify Functions, the MCP SDK,
  Supabase keys, shadcn/ui, Tailwind), check the current docs instead of relying on memory.

## B13. Testing and quality gates

| Layer | Tool | Must cover |
|---|---|---|
| Logic | Vitest | Every rule in §B9, including the week boundary (Sunday 23:30 vs Monday 00:30 Karachi time), streak edge cases (today not logged yet, a gap, longest), neglect (never logged, archived excluded), roll-ups, syllabus %, heatmap levels, weekly periods, duration formatting |
| Services | Vitest + InMemoryRepository | Logging (including automatic in-progress), tree rules (depth, delete vs archive), tasks (nesting, weekly, scored complete/uncomplete), `buildReport` for each period, share snapshots, MCP node-path resolution |
| Components | React Testing Library | The log form (validation, chips, picker) and the task tree (expand, complete, score dialog) |
| MCP | Vitest | Each tool's input validation and output on InMemoryRepository; the secret check |
| End-to-end | Playwright on `/demo` | Login page → Try the demo → log a session → see it in History and on Home → complete the weekly scored task → build the weekly report → copy as text. Asserts **zero** requests to `/api` or `/mcp`. |

- **CI on every PR** (to `develop` and `main`): lint, typecheck, unit/service/component tests, and build.
  The end-to-end tests join CI from M7.
- **Coverage target:** at least 90% of lines in `src/core/logic` (SHOULD).
- CI never uses real secrets. `SupabaseRepository` is checked by hand on deploy previews, which use the dev database.

## B14. Delivery plan

### B14.1 Environments and the deploy budget

| Branch | Netlify | Database | Cost |
|---|---|---|---|
| Feature branches (PRs) | Deploy previews | Supabase (shared, see D15) | Free |
| `develop` | Branch deploy | Supabase (shared, see D15) | Free |
| `main` | **Production** | Supabase (shared, see D15) | About 15 credits per deploy (the free plan has 300 a month) |

- Feature PRs target `develop` and are squash-merged. Deploy previews must be on for PRs against
  branch-deploy branches, so PRs into `develop` get a free preview.
- **`main` only receives release PRs from `develop`**, at the release points below, after the owner says yes.
  Release PRs are merged with a **merge commit** (`gh pr merge --merge`), never squashed, so `main` and
  `develop` keep a shared history and later release PRs stay clean.
- **No more than 8 production deploys per calendar month.** Log each one in docs/PROGRESS.md.
- An urgent fix to the live site goes through the same path: a fix branch → `develop` → a release that
  the owner approves and that counts toward the budget.
- `netlify.toml` uses an `ignore` command to skip builds when only docs or Markdown files changed.
- If the month's count reaches 6, ask the owner to check the credit usage in Netlify before releasing again.
  If credits run low, stop releasing and tell the owner.

### B14.2 Milestones and releases

| # | Branch | Scope (IDs) | Owner steps | Release |
|---|---|---|---|---|
| M0 | `chore/scaffold` | Tooling, CI, folder structure, OPS-1 (SETUP.md Step 6) | — | R0: first deploy of `main` during setup |
| M1 | `feat/foundation` | Full schema `0001`, RLS, RPC functions, Repository (Supabase + in-memory), core skeleton, API foundation, AUTH-1–5, automatic seed, OPS-2–3, DataSource (Api + a Demo skeleton running on the seed data in memory) | Run `0001` on dev, then prod | — |
| M2 | `feat/logging` | TREE-1–7, LOG-1–10, HIST-1–4, SET-1 | Try it on the preview | **R1:** first live version |
| M3 | `feat/dashboard` | DASH-1, TGT-1–2, NEG-1–2, STRK-1–2, HEAT-1–4, DEAD-1–3 | — | — |
| M4 | `feat/mcp` | MCP-1–8, MCP-9 (M4 tools), SET-4 | Connect Claude after R2 | **R2:** Claude connected (minimum useful version, §B14.6) |
| M5 | `feat/progress` | TOP-1–2, TASK-1–10, SCORE-1–5, TRACK-1, MCP-9 (M5 tools), tasks added to `find_gaps` | — | — |
| M5A | `feat/accounts` | ACCT-1–12 (accounts with Supabase Auth, per-user data, per-user Claude link; D17) | Brevo account + Supabase SMTP and email templates; run `0003`; replace the Claude connector | **R3** (M5 + M5A), after the owner says yes |
| M6 | `feat/reports` | REP-1–9, SHARE-1–6, SET-2–3, MCP-9 (`get_report`) | — | **R3** (owner held R3 so M6 ships with M5 + M5A) |
| M7 | `feat/demo-pwa` | DEMO-1–5 complete (sample data, banner, disabled features), PWA-1–3, end-to-end suite | — | — |
| M8 | `chore/polish` | Accessibility and performance pass, empty states, README, screenshots, architecture.md | Final checklist (§B17) | **R4:** v1.0.0 |

COULD items are built only if time allows (§B14.5). OPS-4 (the deploy budget) applies to every release.

### B14.3 Definition of done (every milestone)
- Every MUST item in the milestone works. SHOULD items are done or listed in PROGRESS.md as deferred.
  COULD items are optional.
- Tests are added for any new logic and services, and CI is green.
- Demo mode still works for everything built so far.
- README / architecture.md are updated if behaviour or setup changed.
- The PR description lists the IDs delivered, how to test them on the preview, and screenshots of UI changes.
- docs/PROGRESS.md is updated.

### B14.4 Session sizing

Aim for one Claude Code session per milestone; expect about 10–13 sessions in total.

| M0 | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 |
|---|---|---|---|---|---|---|---|---|
| 1 | 1–2 | 1–2 | 1 | 1 | 2 (split at Tasks / Scores) | 1–2 | 1 | 1 |

If a milestone needs more than 3 sessions, stop and propose splitting it.

### B14.5 Cut order (if time or usage runs short)
Cut from the top of this list. Never cut MUST items. Record every cut in PROGRESS.md and the README's
"Future improvements".
1. All COULD items: TREE-7, NEG-2, TASK-10, HEAT-4, REP-3, SHARE-6, PWA-3
2. TRACK-1, TASK-9, SCORE-4, SCORE-5, SHARE-5, SET-3, SET-4
3. LOG-7, LOG-8, LOG-9, LOG-10, HIST-3, HIST-4, REP-2
4. STRK-2, HEAT-3, DEAD-3, TREE-5, TREE-6
5. PWA-1–2; replace automated screenshots with manual ones

### B14.6 Minimum useful version
After **R2** (M0–M4), the owner has a live tracker with logging, history, the Home dashboard, and Claude
connected. That covers the original goal (track activity; Claude can access it). If exams or usage limits
interrupt the build, pausing after R2 is an acceptable outcome. M5–M8 add depth (tasks, scores, reports,
sharing, demo, polish) and can resume at any time from docs/PROGRESS.md.

## B15. Decision log

| # | Decision | Reason |
|---|---|---|
| D1 | Single user, passcode, no accounts | Only the owner uses it; avoids auth complexity |
| D2 | 3-level structure tree; tasks nest without limit | Matches the owner's tracks while keeping to-dos flexible |
| D3 | Manual time entry, no timer | Owner's choice |
| D4 | React + TypeScript + Vite; Tailwind + shadcn/ui | A professional, common portfolio stack |
| D5 | The browser never talks to Supabase; functions use the secret key; RLS on with no policies | Simple, strong security for one user |
| D6 | Core services are isomorphic; demo mode runs them in the browser | Demo parity, less code, easy testing |
| D7 | MCP protected by a secret URL path | Single user; the simplest option that's secure enough |
| D8 | `develop`/`main` split; at most 8 production deploys a month | Netlify free plan credit limit |
| D9 | ~~Two Supabase projects (dev and prod)~~ Superseded by D15 | Previews never touch real data |
| D10 | Full schema in the first migration; seed runs automatically on first login | Fewer manual SQL steps for the owner |
| D11 | Reports in English; notes off by default | The audience is teachers and parents |
| D12 | Public repo, MIT license, one PR per milestone | Portfolio |
| D13 | Feature PRs squash-merged into `develop`; release PRs merged into `main` with a merge commit | Clean history, and release PRs that don't conflict |
| D14 | R2 (M0–M4) is the minimum useful version | Exams come first; the core goal is met early |
| D15 | One Supabase project for every environment (owner's choice, 2026-10-03). Previews and the `develop` deploy use the real database; features are tested in demo mode first, and Claude Code warns the owner before any test that writes to the database. `MCP_SECRET` still differs between production and other contexts. | The owner's Supabase account already uses its free project allowance; a second project isn't available for free |
| D16 | Tasks can be for **Other** (no track; `tasks.node_id` nullable, migration `0002`); "Other" tasks can't be scored. The task form's "For" list also offers **+ New track…**, the Tracks screen has an Add track form, and the Log screen's Track picker offers **+ New track…** (owner's requests, 2026-10-06). | To-dos outside the study structure, and adding tracks where they're needed |
| D17 | **Accounts for other people (owner's request, 2026-10-08)**, replacing D1 and D7: open sign-up with email + password via **Supabase Auth** (a developer's advice the owner chose), confirmation and reset emails through Brevo SMTP sent from the owner's Gmail (no domain; owner accepted that some emails may land in spam), per-user data with `user_id` on every table (migration `0003`, backward compatible with the deployed code; `0004` after R3 removes the old single-user parts), one Claude link per user, existing data claimed by the owner with the old passcode. Built now as M5A, before M6. | Other people asked to use the app |
| D18 | **General sample tracks (owner's request, 2026-10-09):** the seed for new accounts and the demo use Exam Prep (Flashcards, Practice), School Subjects (Maths, English), and Online Course, with a scored "Weekly self-test". The owner's own track names appear nowhere in the code, docs, or tests. Existing accounts keep their data. | The app is public; the starter tracks should suit any student, multitasker, or high achiever, and not reveal the owner's studies |
| D19 | **Single-user leftovers removed (2026-10-10, as planned in D17):** after the owner claimed the old data, migration `0004` makes `user_id` required on every data table and drops the old `settings` table, the old RPCs, and the claim functions. The code drops the old-passcode form, `/api/auth/passcode`, the `sw_claim` cookie, and `APP_PASSCODE`; `MCP_SECRET` was already unused since D17. | Nothing is left to claim; fewer moving parts and no secret that no longer does anything |

## B16. Out of scope

~~Multiple users or sign-up~~ (now in scope, D17) · a timer · push notifications · offline logging · built-in AI features ·
a manual theme switch · Urdu · data import · native mobile apps · analytics or tracking.

## B17. Final acceptance checklist

Skip any line that only covers a SHOULD/COULD feature that was cut (§B14.5).

**Access and structure**
- [ ] A wrong passcode is rejected, lockout works, a correct passcode works, logout works (AUTH-1–5)
- [ ] The seed tree and the weekly revision task appear on first login (B4)
- [ ] Nodes can be added, renamed, reordered, archived, and restored at all 3 levels; a 4th level is blocked; delete vs archive follows TREE-3

**Logging and history**
- [ ] Sessions logged on a track, a subtask, and a topic (today and yesterday) roll up correctly (LOG, §B9.3)
- [ ] Logging to a new topic sets it to in progress (LOG-6)
- [ ] Editing, deleting, and undoing a session all work (HIST-2, LOG-9)

**Home**
- [ ] Target progress is correct, and the week resets on Monday, Karachi time (TGT, §B9.2)
- [ ] A neglect warning appears after 3 days untouched (NEG-1)
- [ ] Current and longest streak are correct (STRK)
- [ ] The heatmap shows the right levels, and tapping a day opens its sessions (HEAT)
- [ ] The deadline countdown shows days left and syllabus % remaining (DEAD)

**Progress**
- [ ] Marking topics done updates syllabus % (TOP)
- [ ] Tasks nest 5+ levels deep; weekly tasks reset each Monday; a scored completion creates a score, and uncompleting removes it (TASK)
- [ ] The score chart shows percentages over time per subtask (SCORE)

**Reports and sharing**
- [ ] Reports are correct for every period; print fits on A4; both copy formats work; notes are hidden by default (REP)
- [ ] A share link opens without logging in, matches the report, and stops working when revoked or expired (SHARE)
- [ ] Export downloads JSON and CSV (SET-2)

**Demo, app, Claude**
- [ ] Demo mode works fully, resets on reload, and makes zero `/api` calls (DEMO)
- [ ] The app installs on a phone's home screen (PWA)
- [ ] In Claude, "Log 45 minutes of Maths, chapter 3, yesterday" works, and the session shows "via Claude" in the app (MCP)
- [ ] In Claude, "How was my week, and what am I neglecting?" returns correct data (MCP)

**Quality and operations**
- [ ] CI is green on `main`; the end-to-end suite passes (B13)
- [ ] The keep-alive workflow has run successfully at least once (OPS-2)
- [ ] Production deploys this month ≤ 8 (B14.1)
- [ ] The README is complete, with the live link, the demo link, and screenshots; v1.0.0 is tagged (M8)
