# Progress

_Last updated: 2026-10-10 by Claude Code (owner chose to move hosting to Vercel; next session: the Vercel move, then M8 and R4)_

## Milestones

| #             | Status    | PR  | Notes / deferred items                                                                                                            |
| ------------- | --------- | --- | --------------------------------------------------------------------------------------------------------------------------------- |
| M0 Scaffold   | ✅ done   | #1  |                                                                                                                                   |
| M1 Foundation | ✅ done   | #7  | Repository covers nodes, settings, seed so far; later milestones add their own methods                                            |
| M2 Logging    | ✅ done   | #8  | All MUST + SHOULD done. Deferred: TREE-7 (COULD: drag-and-drop, move to another parent)                                           |
| M3 Dashboard  | ✅ done   | #9  | All MUST + SHOULD done. Deferred: NEG-2 (COULD: mute warnings; needs a migration), HEAT-4 (COULD: heatmap per track)              |
| M4 MCP        | 🔍 review | #11 | All MUST + SHOULD built (MCP-1–9 M4 tools, SET-4). CI green; checked live on the preview with curl and MCP Inspector              |
| M5 Progress   | ✅ done   | #16 | All MUST + SHOULD built. Deferred: TASK-10 (COULD: complete a weekly task for last week)                                          |
| M5A Accounts  | ✅ done   | #20 | Merged into `develop` 2026-10-09. Not live yet: R3 is held by the owner                                                           |
| M6 Reports    | ✅ done   | #21 | All MUST + SHOULD + COULD (REP-3, SHARE-6) built. No migration. Merged into `develop` 2026-10-09 (owner's OK)                     |
| M7 Demo + PWA | ✅ done   | #26 | DEMO-1–5, PWA-1–3 (incl. COULD PWA-3), e2e suite in CI. No migration. Merged into `develop` 2026-10-10 (owner's OK); not live yet |
| Cleanup       | ✅ done   | #27 | Migration `0004` (applied 2026-10-10), old-passcode claim removed (D19). Merged into `develop` 2026-10-10                         |
| M8 Polish     | ⏳        |     |                                                                                                                                   |

## Releases to production (budget: max 8 per month, ~15 of 300 credits each)

| Release | Date       | Includes                                                                                                                                                                                               |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R0      | 2026-10-03 | M0 scaffold, placeholder page, `/api/health` (#3, #5). 2 production builds: the first failed (test file in `netlify/functions`, fixed in #4). Count both toward the month.                             |
| R1      | 2026-10-03 | M1 foundation, M2 logging, M3 dashboard (#10, merge commit). Owner approved. Live check: `/login` 200, `/api/health` ok, `/api/dashboard` 401 without login (new build).                               |
| R2      | 2026-10-06 | M4 Claude connection, MCP `/.well-known` fix, owner-task rule (#15, merge commit). Owner approved. Live check: `/api/health` ok, `/api/claude-connection` 401, `/mcp/wrong` 404, `/.well-known/*` 404. |

| R3 | 2026-10-09 | M5 progress, M5A accounts, M6 reports, sample tracks (#16–#22; release #23, merge commit). Owner approved. Live check: `/api/health` ok, `/api/reports` 401, `/api/share/<unknown>` 404 "no longer available", `/r/*` sends `X-Robots-Tag: noindex`, `/signup` 200, unknown `/mcp/*` 404. |

| Docs | 2026-10-09 | New README and progress notes only (#24; release #25, merge commit). Owner approved. Netlify skipped the build (Markdown only), so it isn't counted. |

Production builds this month (Oct 2026): **5** (~75 credits, counted conservatively). At 6, check credits in Netlify before releasing again.

**2026-10-10: the owner reports 230 of 300 Netlify credits are left** (usage period 2026-10-03 → resets
2026-11-03). The owner asked for one more Netlify release (R3a: M7, cleanup #27, README) before moving to Vercel;
after that, no more Netlify production deploys.

Live site: https://streakwise-ap.netlify.app · Netlify project: `streakwise-ap`

## Database migrations applied

One database for everything (D15), so each migration runs once.

| Migration                     | Applied                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `0001_initial.sql`            | ✅ 2026-10-03 (owner, SQL Editor); seeded on first login                               |
| `0002_tasks_without_node.sql` | ✅ 2026-10-06 (owner, SQL Editor)                                                      |
| `0003_accounts.sql`           | ✅ 2026-10-08 (owner, SQL Editor); verified: `user_settings` exists, 9 unclaimed nodes |
| `0004_accounts_cleanup.sql`   | ✅ 2026-10-10 (owner, SQL Editor): "Success"                                           |

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
- [x] Try "+ New track…" on the Log screen (PR #18 preview) and OK to merge #18 (owner, 2026-10-06; merged)
- [x] Try "+ Add new track…" on the Log screen (PR #19) and OK to merge #19 (owner, 2026-10-06; merged)
- [x] Run `supabase/migrations/0002_tasks_without_node.sql` in the Supabase SQL Editor (lets tasks be "Other")
- [x] After 0002: try "Other (no track)", "+ New track…" (task form) and Add track (Tracks screen) on
      https://develop--streakwise-ap.netlify.app (real data: delete test items afterwards)
- [x] Run `supabase/migrations/0003_accounts.sql` in the Supabase SQL Editor (owner, 2026-10-08)
- [x] Create a free Brevo account, verify your Gmail as a sender, and create an SMTP key (owner, 2026-10-08)
- [x] Supabase custom SMTP saved with the Brevo details (owner, 2026-10-08)
- [x] Supabase: both email templates pasted, URL configuration set (Site URL + 3 redirect URLs),
      "Allow new users to sign up" and "Confirm email" on (owner, 2026-10-09)
- [x] Try accounts on the PR #20 preview with throwaway `+test` addresses: sign-up, confirmation email
      (arrived in Spam), log out/in, forgot + reset password, delete account; all worked, test accounts
      deleted, 9 original nodes untouched (owner, 2026-10-09)
- [x] OK to merge #20 into `develop` (owner, 2026-10-09; merged)
- [x] OK to merge #21 (M6 Reports) into `develop` (owner, 2026-10-09; merged)
- [x] Tried M6 Reports (owner confirmed it works, 2026-10-09)
- [x] Say yes/no to release R3: yes (owner, 2026-10-09); released as #23 with the general sample tracks (D18, #22)
- [x] Right after R3: claimed the old data with the old passcode and created an account (owner confirmed, 2026-10-09)
- [x] After R3: made a new Claude link and replaced the Claude connector; works (owner confirmed, 2026-10-09)
- [x] OK to merge #26 (M7) into `develop` (owner, 2026-10-10; merged)
- [x] Try M7 (demo sample data; optional "Install app" on the phone) on
      https://develop--streakwise-ap.netlify.app/demo (owner confirmed, 2026-10-10)
- [x] Run `supabase/migrations/0004_accounts_cleanup.sql` in the Supabase SQL Editor (owner, 2026-10-10: success)
- [x] OK to merge the cleanup PR #27 into `develop` (owner, 2026-10-10; merged)
- [ ] Delete `APP_PASSCODE` and `MCP_SECRET` from `.env` (unused since #27). They are simply not copied to
      Vercel; Netlify's copies go away when the Netlify project is deleted
- [ ] Vercel move (next session, explain each in detail, checking current Vercel docs first):
  - [ ] Create a free Vercel account with "Continue with GitHub" (Hobby plan, no card)
  - [ ] Import the `streakwise` repo into Vercel (or let Claude Code do it with the Vercel CLI after `vercel login`)
  - [ ] Supabase → Authentication → URL Configuration: new Site URL + redirect URLs for the Vercel addresses
  - [ ] After the Vercel production site works: Settings → Claude connection → "Make a new link", replace the
        connector in Claude
  - [ ] Delete the Netlify project (only after Vercel is confirmed working)

## Current work / next step

**2026-10-10: owner's decision (D20): move hosting from Netlify to Vercel's free Hobby plan.** The owner
released once more on Netlify (R3a) and then moves. The move is the **next session's work**, before M8.
After it, releases go to Vercel; R4 (v1.0.0) is the final one.

Why Vercel (checked in Vercel's docs 2026-10-10): no cost per deploy (Hobby: 100 deployments/day),
1M function invocations, 100 GB transfer, 1M requests a month. Limits: non-commercial personal use only
(fine: the app is free); runtime logs kept 1 hour; going over a limit pauses that feature up to 30 days.

**Plan for the Vercel move (branch `chore/vercel` from `develop`, PR into `develop`):**

1. Check current Vercel docs first (fast-changing): Node.js functions with web `Request`/`Response`,
   routing/rewrites in `vercel.json`, headers, `ignoreCommand`, Node 24, `vercel dev`, Git branch
   previews, env vars via CLI. Pick the approach (likely one catch-all function for `/api/*`, `/auth/*`,
   `/mcp/*`, `/.well-known/*` that dispatches to the existing handlers, so `netlify/functions/*`
   handler code is reused; each file exports a `create…Handler` plus a Netlify `config.path`).
2. Replace Netlify-only pieces: `netlify.toml` (build, SPA fallback, `ignore` via
   `scripts/netlify-ignore.sh`), `build/security-headers.ts` writing `dist/_headers` (→ `vercel.json`
   headers, keep the same CSP), `@netlify/functions` `Config` types, `netlify dev` in `npm run dev`,
   the CI test that forbids tests in `netlify/functions/`. Consider renaming `netlify/` → `server/`.
3. Keep: Supabase (data doesn't move), all core code, tests, the e2e suite on `/demo`.
4. Env vars on Vercel (Production + Preview): `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SESSION_SECRET`.
   Set them with the Vercel CLI from `.env` without printing values. Not `APP_PASSCODE`/`MCP_SECRET`.
   Note: a new `SESSION_SECRET` would log everyone out; reusing it is fine.
5. Update: `PROD_URL` repo variable (keepalive workflow), README links, `docs/SETUP.md`,
   `docs/architecture.md`, CLAUDE.md "Branches and deploys" (Vercel, no credit budget; keep "release
   only with the owner's OK"), SPEC §B14.1/OPS-4 and D20 in §B15, email templates if they hard-code the
   site URL, Supabase redirect URLs (owner step).
6. Verify on a Vercel preview: `/api/health`, login/logout, sign-up email link opens the right site,
   `/mcp/<token>` with MCP Inspector, `/r/<slug>` sends `X-Robots-Tag: noindex`, `/.well-known/*` 404,
   service worker never caches `/api`, `/mcp`, `/auth`.
7. Then the owner makes a new Claude link on the Vercel site; old share links (`/r/...` on netlify.app)
   stop working once Netlify is deleted.

**2026-10-10: single-user cleanup on `chore/accounts-cleanup` (D19).**

- `0004_accounts_cleanup.sql`: makes `user_id` required on every data table; drops the old
  `settings` table, the 0001 RPCs (`seed_if_empty`, `delete_node_tree`, `complete_task`,
  `uncomplete_task`) and the claim functions. Stops and changes nothing if any row has no owner.
  Tested on PGlite, including that refusal.
- Code: removed the old-passcode form on the login page, `/api/auth/passcode`, the `sw_claim` cookie,
  `APP_PASSCODE` from the env schema and `.env.example`; login no longer returns `claimed`.
- Docs: SPEC D19 + ACCT-7 marked done/removed, architecture.md.
- 388 unit/component tests + 8 e2e, lint, typecheck, build all green locally.
- Order doesn't matter: the new code never used the dropped parts, and the live R3 code only used
  them for the old-passcode form (nothing left to claim).

**Owner's decision (2026-10-10): no more releases until the final version.** The next production
deploy is R4 (v1.0.0) after M8. Until then the live site keeps R3 (it still shows the old-passcode
option; it does nothing useful).

**Next (in order):** `0004` done (owner, 2026-10-10); #27 merged (2026-10-10); then M8 Polish (`chore/polish`) and R4.

**2026-10-10: M7 Demo + PWA built on `feat/demo-pwa`.**

- DEMO-3: `src/core/demo/sampleData.ts` gives the demo 12 weeks of seeded sample data ("Demo
  Student", topics in every status, nested/weekly/overdue/"Other" tasks, scores, 3 deadlines,
  Science neglected). DEMO-1/2/4/5 were already in place and are now covered by e2e tests.
- PWA-1–3: manifest + icons, a build-generated service worker that caches only the app shell (never
  `/api`, `/mcp`, `/auth`), and a "You're offline" banner.
- E2E: the full SPEC §B13 journey on phone and desktop (zero `/api`/`/mcp` calls), DEMO-5, and PWA
  checks (install files, offline). New CI job "End-to-end (demo, PWA)".
- Owner's request: the GitHub repo description now reads "A convenience tool for multitaskers: …"
  (changed on GitHub 2026-10-10; `package.json` and the README intro match).
- 391 unit/component tests + 8 e2e; main bundle ~223 KB gzipped (unchanged).

**Next (in order):**

1. Done: #26 merged into `develop` (2026-10-10, owner's OK). README intro reworded too (owner's words).
2. Migration `0004` (remove single-user leftovers, make `user_id` required), then M8 Polish and R4.
3. Release (R4 or earlier, owner's choice); the service worker only matters once it's live.

Previous notes:

**2026-10-09: M6 Reports built on `feat/reports`, PR #21 (into `develop`).** The owner said to keep
building and do their open tasks later. Delivered: REP-1–9, SHARE-1–6, SET-2–3, MCP `get_report`;
no migration. 378 tests + e2e green; main bundle ~223 KB gzipped (Reports lazy-loaded).

**R3 released 2026-10-09 (#23).** Before it, the owner asked that their own track names never appear
in the public app: #22 (D18) made new accounts and the demo start with general sample tracks.

**Next (in order):**

0. Done: owner claimed the old data (2026-10-09). New Claude link done (2026-10-09). Possible later improvement (owner asked how per-user MCP works): OAuth sign-in
   for the connector instead of a secret link.
1. Done: #21 merged into `develop` (2026-10-09, owner's OK). Owner can still try it on the develop
   site (share links and export on the real login write to the shared database).
2. Owner decides on release R3 (now M5 + M5A + M6), then the claim and new-Claude-link steps.
3. After R3: migration `0004` (remove single-user leftovers, make `user_id` required).
4. Meanwhile: M7 (`feat/demo-pwa`: DEMO-1–5 sample data, PWA-1–3, e2e suite) can start from
   `develop` once #21 is merged.

Previous notes:

**2026-10-08: M5A Accounts (SPEC D17, ACCT-1–12), branch `feat/accounts`, draft PR #20.** The owner asked
for accounts for other people: open sign-up, email + password, reset emails, one Claude link per
person, built now (before M6). On a developer's advice the owner chose **Supabase Auth**; emails go
through **Brevo** SMTP sent from the owner's Gmail (no domain; owner accepted the spam risk).

Built and tested (lint, typecheck, 330 tests, e2e, build; bundle ~211 KB gzipped):

- `0003_accounts.sql`: `user_id` on every data table with same-owner composite keys,
  `user_settings` (incl. hashed Claude token, `sessions_valid_after`), `auth_requests`, per-user RPCs,
  `claim_unclaimed_data`. Backward compatible with the deployed code, so it can run any time.
- Server: Supabase Auth wrapper, sign-up / login / passcode-claim / forgot / resend / password /
  delete-account endpoints, `/auth/confirm` for email links, per-user repositories, per-user MCP links.
- UI: login (email + password, old passcode, resend confirmation), sign-up, forgot and reset password,
  Settings → Account (change password, delete account), Claude link made in Settings (shown once).
- Docs: SPEC (M5A, ACCT-1–12, D17, ACCT-3 and MCP-1 wording), architecture.md, `.env.example`,
  `docs/email-templates/`.

**Next (in order):**

1. Done: owner ran `0003` (2026-10-08).
2. Done (2026-10-09): owner set up Brevo and Supabase email (explain in detail, checking current Brevo/Supabase docs first):
   Brevo account + verified Gmail sender + SMTP key → Supabase Authentication → Emails (SMTP settings);
   paste both templates from `docs/email-templates/`; Authentication → URL Configuration: Site URL
   `https://streakwise-ap.netlify.app`, redirect URLs for production, `develop--…` and `deploy-preview-*--…`;
   make sure "Confirm email" is on.
3. Done (2026-10-09): owner tried it on the PR #20 preview with `+test` addresses. Claiming the real
   data is deliberately left until right after R3, so nothing logged on the old live site is left out.
4. Done: #20 merged into `develop` (2026-10-09). **Owner chose to hold the release** (save credits) and
   keep building first; next work is M6 Reports on a new branch from `develop`. Release R3 later
   (M5 + M5A + whatever is ready), with the claim steps right after it.
5. After R3: owner makes a new Claude link in Settings and replaces the Claude connector; then
   migration `0004` removes the old single-user leftovers (`settings` table, old RPCs, `MCP_SECRET`,
   later `APP_PASSCODE`) and makes `user_id` required.
6. Then M6 Reports (shared reports are per user now: `shared_reports.user_id`).

Known limits / deferred: Supabase Auth's own per-IP rate limits see Netlify's IPs (all users share
them; fine at small scale). No CAPTCHA on sign-up (ACCT-10 per-IP limits only). Previous plan text below.

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
   explain every owner task in detail. 302 tests. `0002` was run by the owner (2026-10-06) and the owner
   tried "Other" and "+ New track…" on the develop site. #18 added "+ New track…" to the Log screen; #19 made it open a New track window (name, color,
   weekly target, subtasks) and select the track.
   `backup/progress-old` (local only) can be deleted.
3. Next: M6 (`feat/reports`: REP-1–9, SHARE-1–6, SET-2–3, MCP `get_report`), then release R3
   (M5 + M6) after the owner says yes. `0002` must be run before R3 goes live.

No new migration was needed for M2. Run future SQL in the SQL Editor the same way:
https://supabase.com/dashboard/project/ckoaxcyyxmdfgukkbuob/sql/new, with the file copied via
`Get-Content <file> -Raw -Encoding UTF8 | Set-Clipboard`.

With D15, `SUPABASE_URL` / `SUPABASE_SECRET_KEY` are the same in every Netlify context.

## Open questions for the owner

- Vercel project name / address (e.g. `streakwise.vercel.app` if free): ask at the start of the move.

## Decisions made during the build

- M6: share links are created by sending the report's period and notes choice; the server rebuilds
  the report with `buildReport` and freezes it, so a link can never show numbers the app didn't make.
- M6: the public read is the only cross-user query (`PublicShareStore.findBySlug`); unknown, expired,
  and revoked links all answer the same 404. The `/r/*` page also gets `X-Robots-Tag` from `_headers`.
- M6: a report's "current streak" and neglect are judged at the end of the period (or today, if the
  period hasn't ended); deadlines are always the next 3 from today.
- M6: week periods run Monday–Sunday in full; "active days of N" counts only days up to today.
- M6: export is one POST that returns all data as JSON and stamps `last_export_at`; the CSV is made
  in the browser from the same data. CSV cells that start like a formula get a leading apostrophe.
- M6: SET-3's reminder is a `backupDue` flag on the dashboard, so Home makes no extra request.
- M6: date labels and score-kind names moved to `src/core/logic/labels.ts` (shared with report text);
  `src/lib/format.ts` re-exports them.

- M5A: sessions are our own signed cookie with the user id (not Supabase's tokens), so requests don't
  call Supabase Auth; a password change revokes older cookies via `sessions_valid_after` (cached 60 s).
- M5A: Supabase Auth is called with the secret key through a fresh client per call, so a sign-in
  never replaces the database client's key.
- M5A: the login page makes no request until the visitor acts (no "status" call), so the demo e2e
  still sees zero API calls. The old-passcode form is behind "Used Streakwise before accounts?".
- M5A: the claim cookie is SameSite=Lax (it must reach `/auth/confirm` from an email link); the
  session cookie stays Strict.
- M5A: Claude link tokens are 32 random bytes; only the SHA-256 hash is stored, so the link is shown
  once and "Make a new link" replaces it.

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
  a tie), instead of matching track names, so renaming a track doesn't break it.
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
