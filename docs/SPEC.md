# Streakwise — Product Specification

| | |
|---|---|
| **Version** | 3.0 (adds v1.1, "the exam update": §A7, milestone M9, D23–D28) |
| **Status** | v1.0 built and live (v1.0.1). v1.1 approved for build by the owner, 2026-11-23 |
| **Users** | Anyone with an account (D17); built for the owner, a student |
| **Builder** | Claude Code, following docs/SETUP.md and CLAUDE.md |

## How to use this document

- **Part A** is plain English for the owner. It's the only part the owner needs to read.
- **Part B** is the technical specification for Claude Code. It is the source of truth for what to build.
- Every requirement in Part B has an **ID** (e.g. `LOG-3`) and a **priority**:
  - **MUST**: required for the release it belongs to (v1.0, or v1.1 for the M9 items)
  - **SHOULD**: build it unless time or usage runs short (for v1.1 the owner asked for every item,
    SHOULD included, to be built in one go)
  - **COULD**: only if everything else in the milestone is done

  If something has to be cut, follow the cut order in §B14.5. PR descriptions, tests, and the final
  checklist refer to these IDs.
- Changing this spec needs the owner's OK. Record every change in the decision log (§B15).

---

# Part A — In plain English (for the owner)

## A1. What you're building

A private study tracker that works on your phone and laptop. You log your study time yourself
(v1.1 adds an optional start/stop timer) under your three tracks:

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
| **Home** | Today's task and pace (v1.1), warnings, today's total, streak, weekly goals, tasks due, exam countdowns, mistakes due, heatmap |
| **+ Log** | Log a study session in under 15 seconds, or start a timer (v1.1) |
| **Tasks** | Your to-do lists, including the weekly revision |
| **Scores** | Past papers, quizzes, revision scores, and how they're trending |
| **Exam** (v1.1) | Days left to your exam, score charts per module with your targets, and the mock-test grid |
| **Mistakes** (v1.1) | Your mistakes to review today (+1, +3, +7 days), and open vs learned per module |
| **Recent changes** (v1.1) | Everything you or Claude changed in the last 7 days, with Undo on each |
| **Reports** | Create, print, copy, and share reports |
| **History** | Every session you've logged, which you can search, edit, or delete |
| **Track pages** | Everything about one track on one page |
| **Settings** | Your name, when your study day ends (v1.1), goals, subjects, exam dates, shared links, data download and restore, Claude connection |

## A3. Decisions you've already made

- Only you use the app, protected by a passcode. There's no sign-up.
- Three tracks with three levels each (track → subtask → topic). Tasks can nest as deep as you want.
- You log time by hand. ~~There's no timer.~~ v1.1 adds an optional start/stop timer (D26).
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

- **Vercel** (hosting, D20: the owner moved Streakwise from Netlify to Vercel's free Hobby plan on
  2026-10-10): no cost per deploy (about 100 deployments a day on the Hobby plan) and 1M function
  requests a month, which is far above what personal use needs. The plan is for non-commercial,
  personal use only, which fits this app. **Test versions (previews) are free too.** Live-site
  updates are still release points, and Claude Code always asks you first.
- **Supabase** (database): the free plan **pauses a database after 7 days without use** and has no
  automatic backups. The app pings your real database automatically every few days, and you can
  download a full backup from Settings at any time.
- **One database** (D15): a single Supabase project serves testing previews and the live site, so
  migrations run once. Test features in demo mode first.
- GitHub is free for public projects. Building uses your Claude subscription.

## A5. When you can start using it

The whole build takes roughly **10–13 Claude Code sessions**, split into 9 milestones (M0–M8).

| After | What you get |
|---|---|
| Milestone 2 (first live update) | You can **start logging for real** on your phone, and edit your history |
| Milestone 4 (second live update) | Home dashboard, heatmap, streaks, exam countdowns, and **Claude connected**. This is the **minimum useful version**: if exams or usage limits get in the way, it's fine to pause here |
| Milestone 6 (third live update) | Topics and syllabus %, tasks, scores, reports, and share links |
| Milestone 8 (final update) | The polished portfolio version: demo mode, installable app, README with screenshots |
| Milestone 9 (v1.1, the exam update) | Everything in §A7 below |

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
| **Environment variable** | A secret setting (like a password) stored in Vercel, never in the code |
| **Function** | A small piece of server code that talks to the database |
| **RLS** | A database lock that makes sure only the server can read your data |
| **MCP / connector** | How Claude connects to your app |
| **PWA** | A website you can install like an app |
| **Study day** | The day your study counts for. With "My day ends at 04:00", 01:50 at night still counts for the day before |

## A7. Version 1.1: the exam update (owner's feature list, 2026-11-23)

You use Streakwise with Claude for a 30-day ÖSD B1 exam plan, and five Claude projects read it
every day. Three things hurt: big answers use up Claude's limits, mistakes can't be undone, and study
after midnight lands on the wrong day. Version 1.1 fixes all three and adds exam tools. Everything
below is built in one go (milestone M9, three parts), then released as **v1.1.0** after you say yes.

**For Claude (the connector)**
- **Smaller answers:** a "compact" mode for task and session lists, filters (due dates, title
  contains "Day 3", note contains), one task in full by id, and "the latest note starting with Day".
- **Undo and edit:** Claude can edit or delete sessions, scores, and tasks, untick a task (its score
  goes too), rename a track or change its weekly goal, and archive or restore parts of your tree.
  Claude can do this for items of **any date, past or future** (your decision, D24). Things that
  already happened (sessions, scores, ticks) still can't be dated in the future. Claude still asks
  you before deleting anything.
- **Tick a task for an earlier day**, and **log up to 10 sessions at once** (all saved, or none).
- **Mistake tracker:** Claude can save a mistake, list the ones due for review today, and mark a
  review right or wrong. Your "ERR:" notes keep working as now.
- Every change Claude makes comes back with the changed item, so it can confirm in one line.

**In the app**
- **"My day ends at"** setting (for example 04:00): study logged before that time counts for the
  day before, everywhere (sessions, scores, ticks, streak, Claude's "today").
- **Undo everywhere:** after logging, ticking, or scoring, a 10-second Undo button. A **Recent
  changes** screen lists everything you or Claude changed in the last 7 days, with Undo on each.
- **Mistakes screen:** mistakes grouped by module, a "Due today" tab with Right/Wrong buttons, and
  open vs learned counts.
- **Exam view:** days left to the deadline you mark as your exam, score charts per module with your
  target lines (e.g. Mock 1 ≥ 60% … Mock 6 ≥ 90%), and a mock grid that marks scores below target.
- **Today card on Home:** today's task (or the oldest overdue one) with its description and
  sub-tasks, minutes per subject today, and a pace bar with "needed per day".
- **Timer:** start and stop on any subject; stopping fills in the Log form for you.
- **Search** all your session notes, **export** everything (JSON and CSV), and **restore** from a
  backup file. Restore replaces all your study data with the file's contents, so it downloads a fresh
  backup first and asks you to type RESTORE.
- Your streak still counts only days with logged study time (your decision, D25).

**What you'll do by hand:** run one database script (`0005`) when Claude Code asks, try each part on
its preview, and say yes to the release.

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
| G6 | Runs entirely on free tiers (Vercel, Supabase, GitHub) |

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
- (v1.1, TASK-11) Every completion has a **completion date** (`completed_on`, a study day, §B9.1a)
  besides its timestamp. It defaults to today and may be any earlier day; reports use it. For a
  weekly task, the completion's week is `weekStart(completed_on)`.

**B3.4 Scores.** Each score has a kind (`past_paper` | `quiz` | `mock_test` | `revision` | `other`),
a title, a date, a score, a maximum, a node, a note, and an optional link to a task completion.

**B3.5 Deadlines.** A title, a date, and a node. (v1.1, EXAM-1) A deadline can be marked as an
**exam**; an exam can have **score targets**: a label (e.g. "Mock 1"), a date, and a minimum
percentage (0–100).

**B3.6 Shared reports.** A frozen JSON snapshot, a slug, a creation date, and optional expiry and revocation dates.

**B3.7 Mistakes (v1.1, ERR).** A mistake belongs to any node and has a text (1–500 characters), a
created date (study day), a source (`app` | `claude`), a status (`open` | `learned`), a review
step (1, 2, or 3), an anchor date, the next review date, a review count, and the last review date
and result. The review schedule is §B9.13.

**B3.8 Change history (v1.1, UNDO).** Every change to sessions, scores, tasks, task completions,
mistakes, nodes, deadlines, and exam targets is recorded as an entry: time, source (`app` |
`claude`), entity type and id, action (`create` | `update` | `delete` | `complete` | `uncomplete` |
`archive` | `unarchive` | `review`), a one-line summary, the state before and after (JSON), and when
it was undone (if it was). Entries are kept for 30 days.

**B3.9 Study day (v1.1, DAY).** Each user has a "My day ends at" time between 00:00 and 06:00
(default 00:00). Every "today" in the app, the API, and MCP is the study day of the current time
(§B9.1a).

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
| ACCT-1 | MUST | Accounts live in **Supabase Auth**, called only by the server functions (D5 still holds: the browser never talks to Supabase). Anyone can sign up at `/signup` with name, email and a password of at least 8 characters. |
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
| TASK-10 | COULD | A weekly task can be completed for the previous week (backfill). (v1.1: delivered by TASK-11.) |
| TASK-11 | MUST | (v1.1) Completing a task (app and MCP) takes an optional **completion date**: default today (the study day), never in the future, no lower limit (D24). The completion, its week (weekly tasks: `period_start = weekStart(date)`), and its linked score's date all use it, and reports count it on that date. The app's complete dialog has a "Done on" date field with Today/Yesterday chips. Uncompleting a weekly task removes the completion for the week of the chosen date (default this week). |

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
| MCP-2 | MUST | Uses the official MCP TypeScript SDK with the Streamable HTTP transport, stateless, inside a server function. Check the current SDK docs and any current guidance on hosting MCP servers, and verify with MCP Inspector before connecting Claude. |
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

#### v1.1 additions (M9a; owner's feature list, 2026-11-23, D23)

Context: the owner runs a 30-day ÖSD B1 plan through Claude. Claude logs sessions, records scores,
and ticks tasks, and five Claude projects read Streakwise daily, so response size directly costs
the owner's Claude usage.

| ID | Priority | Requirement |
|---|---|---|
| MCP-10 | MUST | **Compatibility.** Existing tools keep their names, parameters, defaults, and output shape. New behaviour comes only through new optional parameters whose defaults reproduce today's output, new fields added to existing outputs, and new tools. |
| MCP-11 | MUST | **Writes confirm in one line.** Every write, edit, undo, and delete tool returns the changed item (deletes return the deleted item; batch tools return every item) in the same compact shape the matching list tool uses, so Claude can confirm without a second call. |
| MCP-12 | MUST | **No age limit (D24).** Claude may edit, undo, or delete items of any date, past or future. Dates of things that already happened (session `date`, score `date`, completion `date`, mistake reviews) still can't be in the future, exactly as in the app. Deletes carry `destructiveHint: true`, and the instructions tell Claude to confirm with the student first. |
| MCP-13 | MUST | **`list_tasks` options.** `compact` (boolean, default false): each task is only `id`, `title`, `path`, and `done`, plus `parentTaskId`, `dueOn`, `scored: true`, `weekly: true`, `overdue: true`, and `subtasks` ({done, total}) only when they carry information (non-null / true / has sub-tasks); never the description. `due_from` / `due_to` (date references, inclusive): only one-off tasks whose due date is in that range (tasks without a due date are left out when either is set). `title_contains`: case-insensitive substring of the title (e.g. "Day 3"). All combine with the existing `node`, `status`, `include_archived`, and `limit`. |
| MCP-14 | MUST | **Size target.** On a fixture of 70 tasks shaped like the owner's plan (two levels, descriptions of 200–400 characters, mixed due dates, some scored), `list_tasks` with `compact: true` returns under 25% of the characters of the default output. A test asserts it. |
| MCP-15 | MUST | **`get_task(task_id)`.** One task in full (the `list_tasks` fields, including the description), its current completion (date, note, linked score) if done, completed weeks for weekly tasks, and all its sub-tasks nested to any depth (each in the full shape, with their own `subtasks` array). |
| MCP-16 | MUST | **`list_sessions` options.** `note_contains`: case-insensitive substring of the note. `compact` (boolean, default false): each session is `id`, `date`, `minutes`, `path`, and the first 80 characters of the note (with "…" when cut; left out when there's no note). The id stays so Claude can edit or delete from a compact list. |
| MCP-17 | MUST | **`get_latest_note(prefix, node?)`.** The newest session (by date, then creation time) whose note starts with `prefix` (case-insensitive, leading spaces ignored), optionally within a node's subtree. Returns `{ session: { id, date, minutes, path, note } }`, or `{ session: null }`. Used to work out "today's Day N". |
| MCP-18 | MUST | **Edit and undo tools:** `update_session(session_id, minutes?, note?, date?, node?)` (`note: null` clears it); `uncomplete_task(task_id, date?)` (removes the completion for the task's period containing `date`, default today, and the score that completing it created, atomically); `list_scores(node?, from?, to?, kind?, title_contains?, limit?)` (newest first; each score also says `fromTask: true` when a completion created it); `update_score(score_id, score?, max_score?, title?, note?, date?, kind?)`; `delete_score(score_id)`; `update_task(task_id, title?, description?, due_date?, weekly?, scored?, default_max_score?)` (null clears `description` and `due_date`; same rules as TASK-2/TASK-8); `delete_task(task_id, include_subtasks = false)` (refuses with `has_subtasks` and the sub-task count unless `include_subtasks` is true; then removes the sub-tasks too, as TASK-8); `update_node(node, name?, weekly_target?)` (`weekly_target` in minutes, tracks only, null clears); `archive_node(node)` and `unarchive_node(node)` (TREE-2, TREE-5; `unarchive_node` resolves archived nodes too). Parameter names follow the existing snake_case style (`due_date`, `default_max_score`, as in `add_task`). |
| MCP-19 | MUST | **`complete_task` date.** New optional `date` (date reference, default today; TASK-11). |
| MCP-20 | MUST | **`log_sessions(sessions[])`.** 1–10 sessions, each with the `log_session` fields. Every item is resolved and validated first; if any fails, nothing is saved and the error names the failing item (`index`, 0-based, plus a message like "Session 3: …"). Otherwise all are saved in one atomic write (LOG-6 applies to each) and returned in order. |
| MCP-21 | MUST | **Mistake tools (ERR):** `add_mistake(node, text, date?)` stores a mistake (source `claude`); `list_due_mistakes(node?, date?)` lists open mistakes whose next review is on or before `date` (default today), oldest due first; `review_mistake(mistake_id, result: "right" \| "wrong")` applies §B9.13 and returns the mistake with its new step, status, and next review date. |
| MCP-22 | MUST | **Study day (DAY-2).** "today", "yesterday", every default date, and every `today` field in tool output use the study day. The instructions explain the "My day ends at" rule and give the current setting's meaning in one sentence. |
| MCP-23 | MUST | **Instructions and version.** `MCP_INSTRUCTIONS` gain short paragraphs on compact mode (prefer it for lists), editing and undoing, the mistake tracker, and the study day, staying under about 3,500 characters in total. `MCP_SERVER_VERSION` becomes `1.1.0`. |
| MCP-24 | MUST | **Change history.** Every MCP write is recorded in the change history (UNDO-3) with source `claude`, so the owner can see and undo Claude's changes in the app. |

New tools (all M9a; the read-only ones are marked `readOnlyHint`, the deletes `destructiveHint`):

| Tool | Purpose |
|---|---|
| `get_task` | One task in full, with nested sub-tasks (MCP-15) |
| `get_latest_note` | Newest session whose note starts with a prefix (MCP-17) |
| `update_session` | Edit a session (MCP-18) |
| `uncomplete_task` | Untick a task, removing its linked score (MCP-18) |
| `list_scores` | Find scores and their ids (MCP-18) |
| `update_score` / `delete_score` | Edit or delete a score (MCP-18) |
| `update_task` / `delete_task` | Edit or delete a task (MCP-18) |
| `update_node` | Rename a node or set a track's weekly target (MCP-18) |
| `archive_node` / `unarchive_node` | Hide or restore part of the tree (MCP-18) |
| `log_sessions` | Up to 10 sessions, all or nothing (MCP-20) |
| `add_mistake` / `list_due_mistakes` / `review_mistake` | The mistake tracker (MCP-21) |

New options on existing tools: `list_tasks` (`compact`, `due_from`, `due_to`, `title_contains`),
`list_sessions` (`note_contains`, `compact`), `complete_task` (`date`). `list_deadlines` items gain
`isExam` (EXAM-1).

### B5.16 Operations (OPS)
| ID | Priority | Requirement |
|---|---|---|
| OPS-1 | MUST | `GET /api/health` returns `{ ok: true, version }` without touching the database. |
| OPS-2 | MUST | `GET /api/keepalive` does one trivial database read. A scheduled GitHub Actions workflow calls it on the production URL every 3 days (and on manual dispatch). The workflow skips quietly if the `PROD_URL` repository variable isn't set yet. |
| OPS-3 | MUST | Server logs are structured and never contain secrets, passcodes, or note text. |
| OPS-4 | MUST | A production release only happens with the owner's explicit OK, at the release points in §B14.2, and is logged in PROGRESS.md. |

### B5.17 Study day (DAY) — v1.1
| ID | Priority | Requirement |
|---|---|---|
| DAY-1 | MUST | Settings → General has **"My day ends at"**: 00:00 to 06:00 in 30-minute steps, default 00:00 (stored per user). |
| DAY-2 | MUST | Every "today" uses the study day (§B9.1a): the log form's default date and Today/Yesterday chips, the future-date checks, the week (so a Sunday-night session before the cutoff still counts for that week), streaks, the heatmap's last day, targets and pace, neglect, tasks due and overdue, completion dates, score dates, mistake reviews, reports' "today", the timer, demo mode, and MCP (MCP-22). Timestamps (created/updated/completed-at) stay real UTC instants. |
| DAY-3 | MUST | Stored dates are never rewritten when the setting changes. Where a timestamp becomes a day at read time (a topic's done time in reports, a node's creation for "never logged" neglect), the same rule applies with the current setting. |
| DAY-4 | MUST | Acceptance: with the cutoff at 04:00, a session logged at 01:50 on 23 Nov (Karachi) with the default date is dated 22 Nov in the app and through MCP, and the streak counts it for 22 Nov. At 04:00 the study day becomes 23 Nov. |
| DAY-5 | SHOULD | Between midnight and the cutoff, the log form shows a hint such as "Counts for Sun 22 Nov (your day ends at 04:00)". |

### B5.18 Undo and change history (UNDO) — v1.1
| ID | Priority | Requirement |
|---|---|---|
| UNDO-1 | MUST | After logging a session (LOG-9, already built), completing or uncompleting a task, adding a score, adding or reviewing a mistake, and deleting a session, score, or mistake, a toast offers **Undo** for 10 seconds. |
| UNDO-2 | MUST | Sessions, scores, and tasks open an **edit sheet on tap** wherever they are listed (History, Scores, Tasks, track pages, the Today card), with Save and Delete (delete asks for confirmation). Editing and deleting themselves already exist (HIST-2, SCORE-1, TASK-8); this makes the entry point consistent. |
| UNDO-3 | MUST | Every change listed in §B3.8, whether made in the app, in demo mode, or through MCP, is recorded once, in `src/core` (for example a change-recording wrapper around `Repository`, or one helper every service calls), so all three paths behave the same. Recording happens after the write succeeds; if recording fails, the write still stands and the failure is logged without data. |
| UNDO-4 | MUST | **Recent changes** (`/changes`, in More and linked from Settings): the last 7 days, newest first, grouped by day, each with time, summary (e.g. "Logged 45m · Exam Prep > Flashcards"), a "via Claude" badge for Claude's changes, and an **Undo** button; undone entries show "Undone". |
| UNDO-5 | MUST | **Undo means the inverse:** create → delete; update → restore the before-state; delete → recreate with the same id (a deleted task comes back with its sub-tasks, completions, and score links); complete → uncomplete (the linked score goes too); uncomplete → re-complete with the same completion and score; archive ↔ unarchive; review → the mistake's previous state. Undo refuses with a clear message (409 `changed_since`) when the item has a later change that isn't undone, or when it can't be restored (for example its node was deleted). Undo itself is not recorded and can't be undone (no redo). Multi-row undos (task tree, completion + score) are atomic. |
| UNDO-6 | MUST | The changes list and undo are available in the API and in demo mode. |
| UNDO-7 | SHOULD | Entries older than 30 days are removed automatically (on write, at most once a day per user). |

### B5.19 Mistakes (ERR) — v1.1
| ID | Priority | Requirement |
|---|---|---|
| ERR-1 | MUST | Mistakes (§B3.7) can be added (node, text, optional date: default today, not in the future), edited (text, node), and deleted (with confirmation) in the app, and added and reviewed through MCP (MCP-21). |
| ERR-2 | MUST | The review schedule is §B9.13: due +1, +3, and +7 days after the anchor date; right moves to the next step; wrong goes back to step 1 from the review day; right at step 3 marks it learned. |
| ERR-3 | MUST | **Mistakes screen** (`/mistakes`, in More): a **Due today** tab (open mistakes due on or before today, oldest due first, each with Right and Wrong buttons) and an **All** tab (grouped by node path, filter open / learned / all). |
| ERR-4 | MUST | The top of the screen shows open vs learned counts per module (the mistake's subtask, or its track when the mistake is on the track itself). |
| ERR-5 | MUST | "ERR:" text in session notes keeps working exactly as now (it's ordinary note text); the mistake tracker is an extra path. |
| ERR-6 | SHOULD | Home shows "N mistakes due today" linking to the Due today tab when N > 0. |

### B5.20 Exam view (EXAM) — v1.1
| ID | Priority | Requirement |
|---|---|---|
| EXAM-1 | MUST | The deadline form (DEAD-1) has a **"This is an exam"** switch. Exam deadlines show an "Exam" badge on Home, and `list_deadlines` items gain `isExam`. |
| EXAM-2 | MUST | **Exam view** (`/exam`, in More, and linked from exam deadlines on Home): the next upcoming exam by default, with a picker when there are several (past exams included, marked as past). It shows a large countdown ("23 days left", "Today", or "2 days ago"). Without any exam, an empty state explains how to mark a deadline as an exam. |
| EXAM-3 | MUST | **Score targets** per exam: a list of label, date, and minimum % (e.g. Mock 1 · 1 Dec · 60%), added, edited, and deleted on the exam view. |
| EXAM-4 | MUST | **Per-module chart:** % over time of the scores in the exam node's subtree, one line per module (§B9.16), with the targets drawn as a stepped target line by date. Lazy-loaded like the other charts. |
| EXAM-5 | MUST | **Mock grid:** rows = mock tests (§B9.16), columns = modules, cell = % (with score/max on hover or tap). A cell below its row's target is marked red **and** with a text marker (e.g. "▼ below 70%"), so colour is never the only signal; empty cells show "—". |
| EXAM-6 | SHOULD | Each grid row also shows its average across modules and its target. |

### B5.21 Today card (TODAY) — v1.1
| ID | Priority | Requirement |
|---|---|---|
| TODAY-1 | MUST | Home starts (below neglect warnings) with a **Today** card. **Today's task** (§B9.15) shows its title, description, and sub-tasks with working checkboxes, and opens the task's edit sheet on tap. With no such task, the card says so and links to Tasks. |
| TODAY-2 | MUST | The card lists today's minutes per subtask (and per track for time logged on a track itself), from today's sessions. |
| TODAY-3 | MUST | **Pace bar** per track with a weekly target: minutes this week vs target, and "needed per day" (§B9.14), or "Target met" when reached. |
| TODAY-4 | MUST | All of it comes from the existing single dashboard request (DASH-1). |

### B5.22 Timer (TIMER) — v1.1, supersedes D3
| ID | Priority | Requirement |
|---|---|---|
| TIMER-1 | SHOULD | A **Start timer** button on the Log screen and on track pages starts a timer on the chosen node. One timer runs at a time. It is stored on the device (start time and node, in `localStorage`), so it survives reloads and closing the app; a pill in the layout shows the node and elapsed time. |
| TIMER-2 | SHOULD | **Stop** opens the Log form prefilled with the node, the minutes (rounded to the nearest minute, at least 1, at most 1440; longer runs ask what to keep), the study day of the start time, and the note box focused. **Discard** cancels without saving. |
| TIMER-3 | SHOULD | The timer works in demo mode and never calls the server while running. |

### B5.23 Search, export, and restore (DATA) — v1.1
| ID | Priority | Requirement |
|---|---|---|
| DATA-1 | SHOULD | **Search notes:** History has a search box that finds sessions in all history whose note contains the text (case-insensitive), combined with the existing filters, grouped by day, with the match highlighted. The history API takes `noteContains`. |
| DATA-2 | SHOULD | **Export:** the JSON export becomes `formatVersion: 2` and adds mistakes, exam targets, deadlines' exam flag, completion dates, and the "day ends at" setting. Settings → Data offers CSV downloads for sessions (as now), scores, tasks (with path, due date, done), and mistakes. CSV cells keep the formula-injection guard. |
| DATA-3 | SHOULD | **Restore from backup** (Settings → Data): choose a Streakwise JSON file (format 1 or 2, at most 4 MB). The whole file is validated first and a summary is shown (counts per type, date range, the file's export date) before anything changes. The owner must type RESTORE; the app then downloads a fresh backup of the current data and restores. |
| DATA-4 | SHOULD | Restore **replaces** all of the user's study data (nodes, sessions, tasks, completions, scores, deadlines, exam targets, mistakes, and the name, neglect, and "day ends at" settings) in one atomic database call. It keeps the account, the Claude link, and shared links. Every restored row gets a new id, with the links between rows kept. The change history is cleared. It never merges. Demo mode restores into memory. |

## B6. Screens and navigation

| Route | Screen | IDs |
|---|---|---|
| `/login` | Passcode + "Try the demo" | AUTH |
| `/` | Home dashboard | DASH, TGT, NEG, STRK, HEAT, DEAD |
| `/log` | Log session (a sheet on mobile, a dialog on desktop) | LOG |
| `/history` | History | HIST |
| `/tasks` | Tasks | TASK |
| `/scores` | Scores | SCORE |
| `/exam` | Exam view (v1.1) | EXAM |
| `/mistakes` | Mistakes (v1.1) | ERR |
| `/changes` | Recent changes (v1.1) | UNDO |
| `/reports` | Reports | REP, SHARE |
| `/tracks/:id` | Track page | TRACK, TOP |
| `/settings/*` | Settings sections | SET, TREE, TGT, DEAD, SHARE |
| `/r/:slug` | Public shared report | SHARE |
| `/demo/*` | Demo mode, mirroring the app's routes | DEMO |

- **Mobile:** a bottom nav with **Home · Tasks · + Log · Reports · More**. More contains History, Scores, Tracks, and Settings, plus (v1.1) Exam, Mistakes, and Recent changes. The running timer's pill (TIMER-1) sits above the bottom nav.
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

**B7.1 Migration `0005_v1_1.sql` (M9a, written once for all of v1.1, so the owner runs SQL once).**
Since 0003, every data table has `user_id` (required since 0004) and same-user composite foreign
keys, and per-user settings live in `user_settings`. New tables follow the same pattern.

**It must be backward compatible:** there is one database (D15), so production keeps running v1.0.1
code against it until R6. Only add columns (with defaults), tables, indexes, triggers, and new
functions; never drop or rename anything the v1.0.1 code uses, and keep the old RPC signatures
working.

| Change | Details |
|---|---|
| `user_settings.day_ends_at_minutes` | smallint not null default 0 · check between 0 and 360 and a multiple of 30 (DAY-1) |
| `task_completions.completed_on` | date; backfilled from `completed_at` in Asia/Karachi; then not null. A BEFORE INSERT trigger fills it the same way when an insert leaves it null (the v1.0.1 code). Index (user_id, completed_on) |
| `deadlines.is_exam` | boolean not null default false (EXAM-1) |
| `exam_targets` | id · user_id · deadline_id → deadlines (same user, on delete cascade) · label check length 1–60 · target_on date · min_percent numeric check 0–100 · created_at · updated_at · index (deadline_id, target_on) |
| `mistakes` | id · user_id · node_id → nodes (same user, no action) · text check length 1–500 · created_on date · source check in (app, claude) · status check in (open, learned) · step smallint check 1–3 · anchor_on date · next_due_on date · review_count int default 0 · last_reviewed_on date · last_result check in (right, wrong) · learned_on date · created_at · updated_at · index (user_id, status, next_due_on), (node_id) |
| `change_log` | id · user_id · at timestamptz · source check in (app, claude) · entity check in (session, score, task, completion, mistake, node, deadline, exam_target) · entity_id uuid · action check in (create, update, delete, complete, uncomplete, archive, unarchive, review) · summary text check length ≤ 200 · before jsonb · after jsonb · undone_at timestamptz · index (user_id, at desc) |
| `delete_user_node_tree` | replaced (same signature) so `node_in_use` also counts mistakes |
| `complete_user_task_on` | new RPC: like `complete_user_task` plus `p_completed_on date` and optional ids, so undo can recreate a completion and its score with their original ids |
| `restore_user_task_tree` | new RPC: re-inserts a deleted task tree (tasks parents first, completions, score links) from a change-log snapshot, atomically (UNDO-5) |
| `restore_user_backup` | new RPC: DATA-4 in one transaction: deletes the user's study rows (children first), inserts the file's rows with fresh ids and remapped links (nodes top-down, tasks parents first), updates the three settings, clears `change_log` |
| `insert_user_sessions` | not needed: a single multi-row insert is already atomic (MCP-20) |

RLS on, no policies, grants to `service_role` only, exactly as in 0003. `supabase/tests/migrations.test.ts`
gains checks for the new file (RLS on every new table, no drops of existing objects).

## B8. API (Vercel Functions)

- Host one deployable function (`api/server.ts`) that dispatches every `/api`, `/auth`, `/mcp`, and
  `/.well-known` request to per-route handlers (`server/functions/*`), with the route patterns and
  method lists from a table in `server/functions/_lib/router.ts`. Use web-standard `Request`/`Response`
  handlers. Check the current Vercel docs (`vercel.json` rewrites/headers, Node runtime). Everything
  is under `/api/` except `/auth/confirm`, `/mcp/:secret`, and the `/.well-known/*` 404 stub.
- Handlers are thin: check auth → validate with Zod → call a core service → return JSON.
- Errors use the shape `{ "error": { "code", "message" } }` with the right status code:
  400 validation, 401 not logged in, 404 not found, 409 conflict, 429 locked out, 500 unexpected.
- **Resources:** auth (login, logout, me) · nodes · sessions · tasks (+ complete / uncomplete) · scores ·
  deadlines · settings · dashboard (one aggregated read for Home) · reports (build) ·
  shares (create, list, revoke) · public share read · export · health · keepalive.
- **v1.1 resources:** sessions and history take `noteContains` · tasks/complete takes `completedOn`
  and uncomplete takes a date · deadlines take `isExam` · exam targets (CRUD under a deadline) ·
  mistakes (list with status/due filters, create, update, delete, review) · changes (list the last 7
  days, undo one) · restore (POST the backup JSON) · settings take `dayEndsAtMinutes`. Every new
  route goes in the route table in `server/functions/_lib/router.ts` and follows the rules above.

## B9. Calculation rules

All of these live in `src/core/logic` as pure functions that take `now` as a parameter.

1. **Local date.** Every "day" is a calendar date in Asia/Karachi (UTC+5, no daylight saving). `today = localDate(now)`.
   1a. **Study day (v1.1, DAY).** `studyDate(instant, dayEndsAtMinutes) = localDate(instant − dayEndsAtMinutes)`,
   and `today = studyDate(now, setting)`. With the default 0 this equals `localDate(now)`, so v1.0
   behaviour is unchanged. A pure function in `src/core/logic/dates.ts`; services get the setting
   from the user's settings (read once per call), and `localDate(clock())` is no longer used for
   "today" anywhere outside that function.
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
13. **Mistake schedule (v1.1, ERR-2).** Intervals: step 1 = +1 day, step 2 = +3 days, step 3 = +7
    days, counted from the anchor date. A new mistake: `anchor = created_on`, `step = 1`,
    `next_due = anchor + 1`. It is due on day `d` when it is open and `next_due ≤ d`. Reviewing on
    day `r`: **right** at step 1 or 2 → the step becomes `step + 1` and `next_due = anchor +
    interval(new step)` (if that is not after `r`, because the review was late, use `r + 1`); **right** at step 3 → `status = learned`, `learned_on = r`, no next
    due date; **wrong** → `anchor = r`, `step = 1`, `next_due = r + 1`. Every review increments
    `review_count` and sets `last_reviewed_on` and `last_result`. A learned mistake can't be reviewed
    (undo restores the previous state instead).
14. **Needed per day (v1.1, TODAY-3).** `days_left` = days from today to Sunday inclusive (1–7);
    `needed = ceil(max(0, target − minutes this week) ÷ days_left)` minutes; shown as a duration.
15. **Today's task (v1.1, TODAY-1).** Among visible, open, one-off tasks: those due today, else the
    one with the oldest overdue due date. Prefer top-level tasks (no parent); then the earliest due
    date; then sort order. None → no task.
16. **Exam modules and mocks (v1.1, EXAM-4/5).** The exam's node is its deadline's node. Its
    **modules** are the node's visible direct children (or the node itself when it has none). A
    score belongs to the module whose subtree contains its node; scores on the exam node itself go
    to an "Overall" column. **Mock rows** = distinct titles (case-insensitive, trimmed) of
    `mock_test` scores in the exam node's subtree, ordered by their earliest date; a cell is the
    latest score with that title in that module. **A row's target** = the target whose label
    matches the row title (case-insensitive); otherwise the latest target dated on or before the
    row's earliest date; otherwise none. The chart's target line steps to each target's
    `min_percent` at its `target_on`.

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
  - Nothing secret ends up in the frontend bundle or build output.
  - Zod validates every input on the server.
  - vercel.json sets security headers (a CSP that works with the chosen libraries, X-Frame-Options,
    Referrer-Policy, X-Content-Type-Options), kept in sync with `build/security-headers.ts` by a test.
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
api/
  server.ts     the one deployed Vercel function; dispatches to the handlers below
server/functions/
  _lib/         SupabaseRepository, session/auth, rate limiting, HTTP helpers, route table
  *.ts          thin per-route API handlers
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
- Use current stable versions of all libraries. For fast-changing APIs (Vercel Functions and
  `vercel.json` routing, the MCP SDK, Supabase keys, shadcn/ui, Tailwind), check the current docs
  instead of relying on memory.

## B13. Testing and quality gates

| Layer | Tool | Must cover |
|---|---|---|
| Logic | Vitest | Every rule in §B9, including the week boundary (Sunday 23:30 vs Monday 00:30 Karachi time), streak edge cases (today not logged yet, a gap, longest), neglect (never logged, archived excluded), roll-ups, syllabus %, heatmap levels, weekly periods, duration formatting |
| Services | Vitest + InMemoryRepository | Logging (including automatic in-progress), tree rules (depth, delete vs archive), tasks (nesting, weekly, scored complete/uncomplete), `buildReport` for each period, share snapshots, MCP node-path resolution |
| Components | React Testing Library | The log form (validation, chips, picker) and the task tree (expand, complete, score dialog) |
| MCP | Vitest | Each tool's input validation and output on InMemoryRepository; the secret check |
| End-to-end | Playwright on `/demo` | Login page → Try the demo → log a session → see it in History and on Home → complete the weekly scored task → build the weekly report → copy as text. Asserts **zero** requests to `/api` or `/mcp`. |
| v1.1 logic | Vitest | `studyDate` (00:00 vs 04:00 cutoff at 01:50, 03:59, 04:00; Sunday 23:30 vs Monday 01:00 with a cutoff, so the week is right), the mistake schedule (each step, late review, wrong resets, learned), needed per day, today's task selection, exam modules, mock rows, and row targets |
| v1.1 services | Vitest + InMemoryRepository | DAY-4 end to end (log, streak, MCP "today"); completion dates (one-off and weekly, linked score date, report date); change recording for every entity and action, and every undo in UNDO-5 including `changed_since`; mistakes CRUD and reviews; restore (validation errors, replace, id remapping, links kept, change log cleared); export format 2 round-trips through restore |
| v1.1 MCP | Vitest | Every new tool and option (MCP-13–22): input validation, output shape, errors (`has_subtasks`, batch `index`, future dates), annotations, "today" with a cutoff, and the MCP-14 size test; existing tool outputs unchanged by default (MCP-10) |
| v1.1 components and e2e | RTL, Playwright on `/demo` | Undo toasts, Recent changes undo, Mistakes Due today right/wrong, exam grid's below-target marker, Today card, timer start → stop → prefilled log, notes search, restore summary and typed confirmation. The e2e suite still asserts zero `/api` and `/mcp` requests |

- **CI on every PR** (to `develop` and `main`): lint, typecheck, unit/service/component tests, and build.
  The end-to-end tests join CI from M7.
- **Coverage target:** at least 90% of lines in `src/core/logic` (SHOULD).
- CI never uses real secrets. `SupabaseRepository` is checked by hand on deploy previews, which use the dev database.

## B14. Delivery plan

### B14.1 Environments and the deploy budget

| Branch | Vercel | Database | Cost |
|---|---|---|---|
| Feature branches (PRs) | Preview deploy | Supabase (shared, see D15) | Free |
| `develop` | Preview deploy | Supabase (shared, see D15) | Free |
| `main` | **Production** | Supabase (shared, see D15) | Free on the Hobby plan (§A4; no per-deploy cost) |

- Feature PRs target `develop` and are squash-merged. Preview deployments are automatic for all
  branches and pull requests.
- **`main` only receives release PRs from `develop`**, at the release points below, after the owner says yes.
  Release PRs are merged with a **merge commit** (`gh pr merge --merge`), never squashed, so `main` and
  `develop` keep a shared history and later release PRs stay clean.
- Log each production release in docs/PROGRESS.md (the owner's yes is the gate; see D20).
- An urgent fix to the live site goes through the same path: a fix branch → `develop` → a release
  that the owner approves.
- `vercel.json` uses an `ignoreCommand` (`scripts/vercel-ignore.sh`) to skip builds when only docs
  or Markdown files changed.

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

| M9a | `feat/v1.1-claude` | Migration `0005` (all of B7.1), DAY-1–5, TASK-11 (and TASK-10), change recording and undo in core (UNDO-3, UNDO-5, UNDO-6 API), mistakes core (ERR-1–2 services), MCP-10–24 | Run `0005` in the SQL Editor (one step, explained in detail when asked); try Claude on the preview | — |
| M9b | `feat/v1.1-app` | UNDO-1, UNDO-2, UNDO-4, UNDO-7, ERR-3–6, EXAM-1–6, TODAY-1–4 | Try it on the preview (demo first) | — |
| M9c | `feat/v1.1-timer-data` | TIMER-1–3, DATA-1–4, README/architecture/screenshots for v1.1 | Try it on the preview; try restore only in demo mode or a throwaway account | **R6:** v1.1.0, after the owner says yes |

COULD items are built only if time allows (§B14.5). OPS-4 (the owner's OK for releases) applies to every release.

**M9 order and rules.** Build M9a → M9b → M9c, one PR into `develop` each. M9a lands first because
it carries the migration and the core every later part uses; it must not change any behaviour while
`day_ends_at_minutes` is 0, apart from the new options and tools. The owner runs `0005` once, after
the M9a PR's CI is green and before trying any v1.1 preview (previews use the real database, D15).
Until R6, production (v1.0.1) keeps working on the migrated database (B7.1 compatibility). If R6 has
to wait, the owner may choose to release after M9a alone, since it already fixes the three main
pain points for Claude.

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

**M9 (v1.1):** the owner asked for all of it in one session (2026-11-23). Expect one long session,
with context summarised along the way, and three PRs (M9a, M9b, M9c). Work stays resumable from
docs/PROGRESS.md after every PR.

### B14.5 Cut order (if time or usage runs short)
Cut from the top of this list. Never cut MUST items. Record every cut in PROGRESS.md and the README's
"Future improvements".
1. All COULD items: TREE-7, NEG-2, TASK-10, HEAT-4, REP-3, SHARE-6, PWA-3
2. TRACK-1, TASK-9, SCORE-4, SCORE-5, SHARE-5, SET-3, SET-4
3. LOG-7, LOG-8, LOG-9, LOG-10, HIST-3, HIST-4, REP-2
4. STRK-2, HEAT-3, DEAD-3, TREE-5, TREE-6
5. PWA-1–2; replace automated screenshots with manual ones

For v1.1 (only if blocked; the owner wants everything): 1. DATA-3–4 (restore) · 2. TIMER-1–3 ·
3. DATA-1–2 · 4. EXAM-6, ERR-6, UNDO-7, DAY-5. MUST items are never cut.

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
| D8 | `develop`/`main` split; at most 8 production deploys a month (superseded on hosting by D20: Vercel charges nothing per deploy, but releases still need the owner's OK per OPS-4) | Netlify free plan credit limit |
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
| D20 | **Hosting moves from Netlify to Vercel's free Hobby plan (owner's decision, 2026-10-10).** R3a was the last Netlify release. Vercel charges nothing per deploy (about 100 deployments a day on Hobby, 1M function requests a month) and fits the app's non-commercial use; limits: runtime logs kept 1 hour, non-commercial personal use only. The server moves to one deployed function (`api/server.ts`) that dispatches `/api/*`, `/auth/*`, `/mcp/*`, `/.well-known/*` to the unchanged handlers. Releases still need the owner's OK (OPS-4); R4 (v1.0.0) is the first Vercel release. | No deployment budget; Netlify credits were nearly exhausted, and Vercel's free limits are far above this app's traffic |
| D21 | **Final colours and track management (owner's requests, 2026-10-25).** The v1.0.0 theme is warm paper and sand neutrals, deep teal for actions, pale mint for highlights, and a warm brick red for destructive actions, with the same roles inverted in dark mode (the theme still follows the system setting). A cooler paper/slate version was also built; the owner compared both and kept this warm one. Track and score-chart colours keep their own validated palette. A track's page has a **Manage track** button that opens the same node dialog as Settings → Structure, so rename, recolour, add a child, archive, restore, and delete live where the track is (TREE-1–3, TREE-5). | The owner asked for a nicer, cohesive colour scheme for the final version, and for a way to delete a track without digging through Settings |
| D22 | **Pure black dark theme (owner's request, 2026-10-27, v1.0.1).** In dark mode the background and sidebar are `#000000`, and cards, popovers, secondary, muted, and accent surfaces are neutral greys instead of green-tinted ones. The mint stays for actions and highlights, and text/destructive colours are unchanged; the theme still follows the system setting and all pairs meet WCAG AA. The browser theme colour follows the scheme too (paper in light, black in dark). | The owner said the green-tinted dark background "looks AI generated" and asked for full black |
| D23 | **v1.1 "the exam update" (owner's feature list, 2026-11-23).** All of the owner's list is in scope: smaller MCP responses, MCP edit/undo tools, completion dates, batch logging, the mistake tracker, the study-day cutoff, undo and change history in the app, the mistakes screen, the exam view, the Today card, the timer, notes search, export, and restore. Built as M9a–c in one session and released as v1.1.0 (R6). Existing MCP tools stay compatible (MCP-10). Interpretations made while writing the spec: compact sessions keep their id (MCP-16); the Today view is a card at the top of Home (TODAY-1); an exam's modules are its node's direct children (§B9.16); the app's complete dialog also gets a "Done on" date (TASK-11). | The owner uses Streakwise daily with Claude for a 30-day exam plan; large responses cost usage, mistakes couldn't be undone, and late-night study landed on the wrong day |
| D24 | **No age limit on Claude's edits (owner, 2026-11-23: "claude should be able to do anything in future and past").** This replaces the draft rule that undo/edit tools only touch items from the last 7 days, and the 7-day limit on completion dates. Things that already happened still can't be dated in the future, and Claude confirms before deleting. The app's Recent changes list still shows 7 days. | The owner wants Claude to manage the plan freely |
| D25 | **The streak stays session-based (owner, 2026-11-23).** A day counts toward the streak only when it has a session (§B9.6); completions and scores are dated by their study day but don't extend the streak. | "Streak" keeps meaning "days I actually studied" |
| D26 | **Timer added (v1.1), superseding D3.** Optional; manual entry stays the default. Stored on the device only, so no database change. | The owner asked for it |
| D27 | **Backup restore added (v1.1), removing "data import" from §B16.** Replace-only (never merge), validated first, with an automatic safety export and a typed RESTORE confirmation; new ids for every row. | The owner keeps JSON backups and wants a way back if data is ever lost |
| D28 | **Change history is recorded in core, after the write, best effort (UNDO-3).** Not in the same transaction as the write (the Supabase client can't span calls without an RPC per write); a missed entry only means that change can't be undone from the list. Multi-row undos still use RPCs. | One code path for app, demo, and MCP, without rewriting every write as an RPC |

## B16. Out of scope

~~Multiple users or sign-up~~ (now in scope, D17) · ~~a timer~~ (v1.1, D26) · push notifications · offline logging · built-in AI features ·
a manual theme switch · Urdu · ~~data import~~ (v1.1 restore, D27; merging or importing from other apps stays out) · native mobile apps · analytics or tracking.

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
- [x] The README is complete, with the live link, the demo link, and screenshots; v1.0.0 is tagged (M8, R4 2026-10-26)

**v1.1 (M9, R6)**
- [ ] Every new MCP tool has a test and appears in the tool list with a clear description (MCP-18–21)
- [ ] `list_tasks` with `compact: true` on 70 tasks returns under 25% of the default size (MCP-14)
- [ ] Existing MCP tools return the same output as v1.0.1 when the new options aren't used (MCP-10)
- [ ] With "My day ends at" 04:00, a session logged at 01:50 on 23 Nov is dated 22 Nov in the app and through MCP, and the streak counts it for 22 Nov (DAY-4)
- [ ] Undoing a task completion also removes its linked score, in the app and through MCP (UNDO-5, MCP-18)
- [ ] `log_sessions` saves all items or none, and names the failing item (MCP-20)
- [ ] A task completed for an earlier date appears on that date in reports (TASK-11)
- [ ] Recent changes shows app and Claude changes for 7 days, and each kind of change can be undone (UNDO-4–5)
- [ ] Mistakes follow +1/+3/+7, wrong resets, and learned counts are right per module (ERR)
- [ ] The exam view shows the countdown, per-module chart with target lines, and the mock grid with below-target marks (EXAM)
- [ ] Home's Today card shows today's task, minutes per subtask, and needed per day (TODAY)
- [ ] Timer stop opens a prefilled log; notes search finds old notes; export format 2 restores cleanly into a throwaway account (TIMER, DATA)
- [ ] `0005` ran on the real database, and v1.0.1 kept working until the R6 release (B7.1)
