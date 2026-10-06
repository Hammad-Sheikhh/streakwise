# Progress

_Last updated: 2026-10-06 by Claude Code (M5 merged into develop; owner must run 0002; next M6)_

## Milestones

| #             | Status    | PR  | Notes / deferred items                                                                                               |
| ------------- | --------- | --- | -------------------------------------------------------------------------------------------------------------------- |
| M0 Scaffold   | ✅ done   | #1  |                                                                                                                      |
| M1 Foundation | ✅ done   | #7  | Repository covers nodes, settings, seed so far; later milestones add their own methods                               |
| M2 Logging    | ✅ done   | #8  | All MUST + SHOULD done. Deferred: TREE-7 (COULD: drag-and-drop, move to another parent)                              |
| M3 Dashboard  | ✅ done   | #9  | All MUST + SHOULD done. Deferred: NEG-2 (COULD: mute warnings; needs a migration), HEAT-4 (COULD: heatmap per track) |
| M4 MCP        | 🔍 review | #11 | All MUST + SHOULD built (MCP-1–9 M4 tools, SET-4). CI green; checked live on the preview with curl and MCP Inspector |
| M5 Progress   | ✅ done   | #16 | All MUST + SHOULD built. Deferred: TASK-10 (COULD: complete a weekly task for last week)                             |
| M6 Reports    | ⏳        |     |                                                                                                                      |
| M7 Demo + PWA | ⏳        |     |                                                                                                                      |
| M8 Polish     | ⏳        |     |                                                                                                                      |

## Releases to production (budget: max 8 per month, ~15 of 300 credits each)

| Release | Date       | Includes                                                                                                                                                                                               |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R0      | 2026-10-03 | M0 scaffold, placeholder page, `/api/health` (#3, #5). 2 production builds: the first failed (test file in `netlify/functions`, fixed in #4). Count both toward the month.                             |
| R1      | 2026-10-03 | M1 foundation, M2 logging, M3 dashboard (#10, merge commit). Owner approved. Live check: `/login` 200, `/api/health` ok, `/api/dashboard` 401 without login (new build).                               |
| R2      | 2026-10-06 | M4 Claude connection, MCP `/.well-known` fix, owner-task rule (#15, merge commit). Owner approved. Live check: `/api/health` ok, `/api/claude-connection` 401, `/mcp/wrong` 404, `/.well-known/*` 404. |

Production builds this month (Oct 2026): **4** (~60 credits, counted conservatively).

Live site: https://streakwise-ap.netlify.app · Netlify project: `streakwise-ap`

## Database migrations applied

One database for everything (D15), so each migration runs once.

| Migration                     | Applied                                                                  |
| ----------------------------- | ------------------------------------------------------------------------ |
| `0001_initial.sql`            | ✅ 2026-10-03 (owner, SQL Editor); seeded on first login                 |
| `0002_tasks_without_node.sql` | ⏳ not yet run (needed for "Other" tasks; must be run before release R3) |

## Owner's manual steps

- [x] GitHub CLI logged in
- [x] Netlify account
- [x] Supabase account
- [x] Supabase project `streakwise-dev` created (Southeast Asia / Singapore), keys in `.env`, connection verified
- [x] ~~Supabase prod project created~~ Not needed: one project for everything (SPEC D15)
- [x] Netlify site connected (`streakwise-ap`, production branch `main`)
- [x] Netlify branch deploys for `develop` turned on by the owner (verified after #6:
      https://develop--streakwise-ap.netlify.app)
- [x] Netlify env vars set via the Netlify API from `.env` (5 vars; 4 marked secret, scopes builds/functions/runtime;
      `MCP_SECRET` has its own Production value, temp file deleted)
- [x] Netlify CLI logged in and folder linked (`netlify link`); `netlify dev` serves `/api/health` locally
- [x] PROD_URL repo variable set
- [x] Run `supabase/migrations/0001_initial.sql` in the Supabase SQL Editor (M1)
- [x] Try M2 on the deploy preview (owner logged, checked, and deleted a real test session)
- [x] Try M3 (Home dashboard, targets, deadlines) on its preview (demo steps all worked)
- [x] Merge #8 (merged by Claude Code with the owner's OK)
- [x] Merge #9 (merged by Claude Code at the owner's request)
- [x] Say yes/no to release R1 (first live version): yes, released 2026-10-03 (#10)
- [x] Try M4 on the live site: Settings → Claude connection (owner used it to add the connector, 2026-10-06)
- [x] OK to merge #11 into `develop` (owner confirmed 2026-10-06)
- [x] Say yes/no to release R2: yes, released 2026-10-06 (#15)
- [x] Claude custom connector added (after R2), using the URL from the **live** Settings page: owner confirmed it works, 2026-10-06
- [x] Try M5 on the PR #16 preview (owner confirmed, 2026-10-06)
- [x] OK to merge #16 into `develop` (owner confirmed and allowed Claude Code to merge, 2026-10-06; merged with #17)
- [ ] Try "+ New track…" on the Log screen (PR #18 preview, demo mode) and say OK to merge #18
- [ ] Run `supabase/migrations/0002_tasks_without_node.sql` in the Supabase SQL Editor (lets tasks be "Other")
- [ ] After 0002: try "Other (no track)", "+ New track…" (task form) and Add track (Tracks screen) on
      https://develop--streakwise-ap.netlify.app (real data: delete test items afterwards)

## Current work / next step

Setup is done (R0 live; Step 8.7 explained to the owner). Blank local dev page fixed in #6.

**M1 done (PR #7).** Verified against the real database locally and on the preview: keepalive,
login (cookie attributes), seeded tree, settings, `me`, logout; `/login` and `/demo` render.

**M2 built on `feat/logging`** (TREE-1–6, LOG-1–10, HIST-1–4, SET-1): navigation (bottom nav /
sidebar), Log, History, Settings, Settings → Structure; core services, endpoints, tests (161 unit/
component + e2e on /demo). Tested in demo mode and with in-memory tests only. **Not yet checked
against the real database**, because previews share it (D15) and the owner was away.
Later checked by the owner on the real database; merged as #8. A dark-mode fix for unreadable
dropdown options on Windows (white text on the system's white list) went in with it.

**M3 built on `feat/dashboard`** (DASH-1, TGT-1–2, NEG-1, STRK-1–2, HEAT-1–3, DEAD-1–3), branched
from `feat/logging` because merging #8 needs the owner's OK (Claude Code's auto mode refused
the merge without the owner's review). Home dashboard (neglect, today + streaks, weekly target
bars, next 3 deadlines with syllabus left, 12-month heatmap with keyboard navigation), Settings →
Weekly targets and Deadlines, `/api/dashboard` and `/api/deadlines`. 205 tests + e2e. Checked in
demo mode only. The owner then tried it on the preview: all demo steps worked. Heatmap shading
by time studied (not by number of sessions) confirmed by the owner.

**R1 released 2026-10-03 (#10).** The keepalive workflow on `main` now has a live site to ping.

**M4 built on `feat/mcp` (PR #11)**: MCP-1–8, MCP-9 (the 8 M4 tools), SET-4. `/mcp/:secret` on the
official SDK v2, Settings → Claude connection, `/api/claude-connection`. 244 tests (17 MCP handler
tests through the real SDK, both protocol versions). No migration. Checked on the deploy preview:
wrong secret 404, GET 405, `tools/list` returns all 8 tools, `get_structure` reads the real tree;
MCP Inspector (CLI) lists the tools with the right annotations. Only read-only tools were called on
the shared database, but that call stamped "last MCP call" (2026-10-04), so Settings won't say
"never".

**Merged into `develop`:** #11 (M4, 2026-10-04), #13 (MCP fix: `/.well-known/*` answers 404 so
Claude connects without asking to sign in, 2026-10-06), #14 (CLAUDE.md rule: tick owner tasks only
after the owner confirms, 2026-10-06).

**Next:**

1. Done: R2 released 2026-10-06; owner added the Claude connector and confirmed it works.
2. M5 merged into `develop` as #16 (2026-10-06), with the owner's later requests: tasks can be
   for "Other" (no track; can't be scored; migration `0002`, D16), the task form's For list has
   "+ New track…", and the Tracks screen has an Add track form. #17 added the CLAUDE.md rule to
   explain every owner task in detail. 302 tests. Until the owner runs `0002`, choosing "Other"
   on the real database fails with an error toast; everything else works.
   `backup/progress-old` (local only) can be deleted.
3. Next: M6 (`feat/reports`: REP-1–9, SHARE-1–6, SET-2–3, MCP `get_report`), then release R3
   (M5 + M6) after the owner says yes. `0002` must be run before R3 goes live.

No new migration was needed for M2. Run future SQL in the SQL Editor the same way:
https://supabase.com/dashboard/project/ckoaxcyyxmdfgukkbuob/sql/new, with the file copied via
`Get-Content <file> -Raw -Encoding UTF8 | Set-Clipboard`.

With D15, `SUPABASE_URL` / `SUPABASE_SECRET_KEY` are the same in every Netlify context.

## Open questions for the owner

## Decisions made during the build

- App name: **Streakwise** (repo `streakwise`), public repo, MIT license under "Hammad Sheikh".
- Netlify CLI installed globally; npm skipped its optional postinstall scripts (new npm allow-scripts
  policy). `netlify dev` works anyway (verified).
- Function tests live in `netlify/tests/`, never in `netlify/functions/` (Netlify deploys every
  top-level file there; a test there broke the first R0 build). A test enforces this.
- Netlify env vars are managed with the Netlify API/CLI (values read from local files, never printed)
  instead of the UI, because the free-plan UI differs from the docs.
- Node 24 (current LTS) pinned in `.nvmrc`, `engines`, and `NODE_VERSION`.
- TypeScript pinned to 6.0.x: TypeScript 7 is out, but typescript-eslint supports only `<6.1`.
- Time zones: `@date-fns/tz` (the official companion of date-fns v4) instead of `date-fns-tz`.
- shadcn/ui: Radix base, Nova preset. Dark mode follows `prefers-color-scheme` (no manual switch, SPEC §B16).
- CSP: `style-src 'unsafe-inline'` allowed (needed by Radix/Recharts inline styles); scripts stay `'self'` only.
- CI also runs `prettier --check`.
- Response headers live in `build/security-headers.ts`, written to `dist/_headers` only when
  `NETLIFY=true`. Not in `netlify.toml`: `netlify dev` applies them locally (it even reads a leftover
  `dist/_headers` despite `[dev] publish`) and the CSP blanks the Vite dev page (#6).
- Migrations are tested in CI on PGlite (Postgres in WebAssembly, dev dependency): schema rules, RPCs,
  RLS on, and no access for `anon`/`authenticated`.
- Track palette tokens: amber, blue, violet, emerald, rose, cyan, orange, slate.
- Session cookie `sw_session` = `<expiry>.<HMAC>`; the HMAC also covers a digest of `APP_PASSCODE`, so
  changing the passcode (or `SESSION_SECRET`) logs out every device. `SESSION_SECRET` must be ≥ 32 chars.
- Login lockout stores only failures (hashed IP); a successful login clears that IP's failures.
- The local `.env` passcode contained `#`, which dotenv treats as a comment (locally only 1 character
  counted). It is now double-quoted; `.env.example` warns about this. Netlify's value was correct.
  `netlify env:get` masks secret values, so check them by testing the preview, not by reading them.
- Functions import core code with relative paths (`../../src/core/...`), not the `@/` alias.
- Bundle after M1: ~150 KB gzipped (Zod is a large part). Budget is 250 KB; consider `zod/mini` in the
  browser if it gets tight.
- M2: `/log` is a full page (it fills the screen like a sheet on phones, centred on desktop)
  instead of a modal over the previous screen; after saving it returns to the previous screen.
- M2: Undo after logging deletes the session; a topic it moved to "in progress" stays there.
- M2: Archiving marks only the node itself; its descendants are hidden through it, so Restore
  brings the whole subtree back. A session can stay on a node that was archived later.
- M2: Log out / Exit demo live in Settings. Tasks, Scores, Tracks, and Reports show a
  "later update" placeholder until their milestones.
- M2: Services validate their own input (`parseInput`), so API, MCP, and demo share the rules.
- M2: Native `<select>` for pickers (system picker on phones); toasts via `sonner`.
- Bundle after M2: ~194 KB gzipped (budget 250 KB). After M3: ~200 KB.
- M3: the dashboard computes everything in core from one light read of all sessions (paged, since
  Supabase returns ≤ 1000 rows per request). No migration needed.
- M3: heatmap uses an emerald scale (not track colors; HEAT-4 would add those). Tapping a day
  shows its total and a "See sessions" link (HEAT-2/3) instead of navigating at once, because the
  cells are small on phones. Arrow keys move between days; only one cell is in the tab order.
- M3: targets are chosen from a list (0.5 h to 40 h, half-hour steps) and saved on change.
- Tests: whole-page screen tests get 15 s (`testTimeout`) and 5 s for async queries, because the
  heatmap makes jsdom slower under a full parallel run.
- M4: MCP SDK is **v2** (`@modelcontextprotocol/server` 2.x, owner's choice): the stable line, web
  `Request`/`Response` via `createMcpHandler`, serves the 2025 protocol and 2026-07-28 from one URL.
  The v1 package (`@modelcontextprotocol/sdk`) is not used.
- M4: `MCP_SECRET` is optional in the env schema so a missing value only disables Claude; shorter
  than 32 characters counts as "not configured" (404, and Settings says it isn't set up).
  Production has its own value (see setup), so the live connector URL differs from previews'.
- M4: tool parameters are snake_case (`session_id`, `include_archived`); results are camelCase JSON.
  `get_structure` hides archived nodes unless `include_archived` is true.
- M4: node references try, in order: id, full path, end of path, partial name (each segment
  contained); archived nodes only match when nothing visible does.
- M4: "last MCP call" is stamped on every tool call (not on `initialize` / `tools/list`).
- M5: a task's score uses the task title; its kind defaults to "revision" for weekly tasks and
  "other" for one-off ones (the score dialog lets the owner change it). The completion note is
  also the score's note. Sub-task progress counts direct sub-tasks only.
- M5: SCORE-5 "default views" = each track's chart opens on the kind it records most (latest wins
  a tie), instead of matching track names, so renaming a track doesn't break it. With the usual
  habits it gives past papers for Improvement, quizzes for Certification, revision for German.
- M5: SCORE-4 trend = average of the last 3 results minus the 3 before them; with fewer than 4
  results, the oldest is "before" and the rest are "last". Shown from 2 results on.
- M5: the score chart is hand-drawn SVG (no chart library, keeps the bundle at ~211 KB gzipped).
  Line colors are a fixed 8-color palette (validated for color blindness, separate dark steps);
  a line keeps its color when filters change. The results table is the accessible view.
- M5: deleting a score that came from a task leaves the task completed.
- **D15 (owner's choice): one Supabase project (`streakwise-dev`, Singapore) for every environment.**
  The owner's free project allowance was already used. Previews and the `develop` deploy touch real
  data, so test features in demo mode first and warn the owner before any test that writes to the
  database. Migrations are run once. Keep-alive covers the only project.
