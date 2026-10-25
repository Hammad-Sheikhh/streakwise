# Progress

_Last updated: 2026-10-25 by Claude (M8 Polish built on `chore/polish`: WCAG AA on every screen, the
final palette, track management, screenshots and README; next: merge the M8 PR, then the owner's R4
decision)_

## Milestones

| #             | Status    | PR  | Notes / deferred items                                                                                                                        |
| ------------- | --------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Scaffold   | ✅ done   | #1  |                                                                                                                                               |
| M1 Foundation | ✅ done   | #7  | Repository covers nodes, settings, seed so far; later milestones add their own methods                                                        |
| M2 Logging    | ✅ done   | #8  | All MUST + SHOULD done. Deferred: TREE-7 (COULD: drag-and-drop, move to another parent)                                                       |
| M3 Dashboard  | ✅ done   | #9  | All MUST + SHOULD done. Deferred: NEG-2 (COULD: mute warnings; needs a migration), HEAT-4 (COULD: heatmap per track)                          |
| M4 MCP        | 🔍 review | #11 | All MUST + SHOULD built (MCP-1–9 M4 tools, SET-4). CI green; checked live on the preview with curl and MCP Inspector                          |
| M5 Progress   | ✅ done   | #16 | All MUST + SHOULD built. Deferred: TASK-10 (COULD: complete a weekly task for last week)                                                      |
| M5A Accounts  | ✅ done   | #20 | Merged into `develop` 2026-10-09. Not live yet: R3 is held by the owner                                                                       |
| M6 Reports    | ✅ done   | #21 | All MUST + SHOULD + COULD (REP-3, SHARE-6) built. No migration. Merged into `develop` 2026-10-09 (owner's OK)                                 |
| M7 Demo + PWA | ✅ done   | #26 | DEMO-1–5, PWA-1–3 (incl. COULD PWA-3), e2e suite in CI. No migration. Merged into `develop` 2026-10-10 (owner's OK); live in R3a (2026-10-10) |
| Cleanup       | ✅ done   | #27 | Migration `0004` (applied 2026-10-10), old-passcode claim removed (D19). Merged into `develop` 2026-10-10                                     |
| M8 Polish     | ✅ done   | #32 | WCAG AA checks on all 8 screens × 2 themes, final palette, "Manage track", screenshots, README, architecture.md                               |

## Releases to production (budget: max 8 per month, ~15 of 300 credits each)

| Release | Date       | Includes                                                                                                                                                                                               |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R0      | 2026-10-03 | M0 scaffold, placeholder page, `/api/health` (#3, #5). 2 production builds: the first failed (test file in `netlify/functions`, fixed in #4). Count both toward the month.                             |
| R1      | 2026-10-03 | M1 foundation, M2 logging, M3 dashboard (#10, merge commit). Owner approved. Live check: `/login` 200, `/api/health` ok, `/api/dashboard` 401 without login (new build).                               |
| R2      | 2026-10-06 | M4 Claude connection, MCP `/.well-known` fix, owner-task rule (#15, merge commit). Owner approved. Live check: `/api/health` ok, `/api/claude-connection` 401, `/mcp/wrong` 404, `/.well-known/*` 404. |

| R3 | 2026-10-09 | M5 progress, M5A accounts, M6 reports, sample tracks (#16–#22; release #23, merge commit). Owner approved. Live check: `/api/health` ok, `/api/reports` 401, `/api/share/<unknown>` 404 "no longer available", `/r/*` sends `X-Robots-Tag: noindex`, `/signup` 200, unknown `/mcp/*` 404. |

| Docs | 2026-10-09 | New README and progress notes only (#24; release #25, merge commit). Owner approved. Netlify skipped the build (Markdown only), so it isn't counted. |

| R3a | 2026-10-10 | M7 demo sample data + installable app (#26), single-user cleanup (#27), README (release #28, merge commit). Owner approved; last Netlify release before the Vercel move. Live check: `/api/health` ok, `/api/dashboard` 401, `/api/auth/passcode` 404 (removed), `/demo` 200, `manifest.webmanifest` and `sw.js` 200, login page has no old-passcode option. |

Production builds this month (Oct 2026): **6** (~90 credits, counted conservatively). At 6, check credits in Netlify before releasing again.

**2026-10-10: the owner reports 230 of 300 Netlify credits are left** (usage period 2026-10-03 → resets
2026-11-03). R3a (M7, cleanup #27, README) was released 2026-10-10 as the last Netlify release; no more Netlify
production deploys.

Live site: https://streakwise-ap.netlify.app · Netlify project: `streakwise-ap`

Next host: Vercel project `streakwise` (account `hammadsheikhcs-7269`, team `team-nick4`), production
URL https://streakwise-mu.vercel.app — working since the 2026-10-25 repair, but it serves `develop`
(pre-M8) and is not the R4 release. Netlify keeps serving R3a until R4.

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
- [x] Netlify (previous host, being retired after the Vercel move): site `streakwise-ap` connected with
      production branch `main`, branch deploys for `develop`, env vars via the Netlify API, CLI linked
      (`netlify dev` served `/api/health` locally)
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
- [x] Delete `APP_PASSCODE` and `MCP_SECRET` from `.env` (owner confirmed deleted by 2026-10-24). Verified
      by Claude Code: no trace of either name in `.env`. They are simply not copied to
      Vercel; Netlify's copies go away when the Netlify project is deleted
- [ ] Vercel move (each step explained in detail when we reach it; current Vercel docs checked 2026-10-10
      and code work is done on `chore/vercel`):
  - [x] Confirm the Vercel account is yours: `hammadsheikhcs-7269` in team `team-nick4` (owner kept this
        account's address and approved work on it, 2026-10-25)
  - [x] Confirm the production address: keep `streakwise-mu.vercel.app` (owner, 2026-10-25)
  - [x] Decide how to repair production: promote the passing build now (owner, 2026-10-25; done with
        `vercel deploy --prod` because the promote path was skipped as docs-only)
  - [x] Decide about preview access: sign in to Vercel to view previews (owner, 2026-10-25)
  - [x] Supabase → Authentication → URL Configuration: redirect URLs for the Vercel addresses
        (`https://streakwise-mu.vercel.app/**`, `https://*-team-nick4.vercel.app/**`) added by the
        owner, 2026-10-25; Site URL stays on Netlify until R4
  - [ ] Check the Vercel site together (the checklist in the session log below)
  - [ ] Say yes to release R4-the-first-Vercel-release (or first an R4.0 preview check) when it works
  - [ ] After the Vercel production site works: Settings → Claude connection → "Make a new link", replace the
        connector in Claude
  - [ ] Delete the Netlify project (only after Vercel is confirmed working)

## Current work / next step

**2026-10-25: Vercel production URL repaired and verified.** The owner confirmed the Vercel account
(`hammadsheikhcs-7269`, team `team-nick4`), chose to keep `https://streakwise-mu.vercel.app`, and
approved repairing production instead of pausing it. Previews stay behind Vercel Authentication; the
owner signs in to Vercel to view them.

- `vercel promote` of the passing PR #30 deployment did **not** work: Vercel re-runs the ignored-build
  step for the promoted commit, saw a docs-only diff, and cancelled the new production deployment
  after 1 s (alias unchanged). Production was then deployed explicitly with `vercel deploy --prod`
  from `develop` at `f6da755` (deployment `streakwise-m6it5qt9b`, READY), which aliased
  `https://streakwise-mu.vercel.app`.
- Verified on production: `/api/health` → `{"ok":true,"version":"0.1.0"}`; `POST /api/health` → 405;
  `/api/nodes` and `/api/dashboard` unauthenticated → 401; `/api/reports` GET → 405 (POST-only route);
  `/mcp/wrong` and `/.well-known/*` → 404; `/login`, `/signup`, `/demo`, `/sw.js`,
  `manifest.webmanifest` → 200; `/r/<slug>` sends `X-Robots-Tag: noindex, nofollow` and
  `Referrer-Policy: no-referrer`; `/sw.js` and the manifest send `Cache-Control: no-cache`; the CSP
  and the other security headers are present.
- Production currently serves `develop` content (pre-M8), not `main`. That is a deliberate repair of
  the earlier accidental deploy, not the R4 release: `main` is still R3a, and R4 still goes through
  the usual merge to `main` + release with the owner's OK.
- Earlier findings still true: Production Branch is `main` (so pushes deploy previews only); env vars
  exist for Preview and Production (`SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`); the
  docs-only push `f6da755` was cancelled by `ignoreCommand` as designed (no build, no deploy).
- The owner saved the Vercel redirect URLs in Supabase (`https://streakwise-mu.vercel.app/**` and
  `https://*-team-nick4.vercel.app/**`) and logged in/out on the Vercel site successfully.

**2026-10-25: login needed a second attempt when a password manager filled the form.** The owner
reported that the first click on **Log in** did nothing and the fields seemed to clear. Runtime logs
showed no request on that click; a headless-browser probe reproduced it: autofill writes values
straight into the DOM without an `input` event, so React state stayed empty, the button (disabled
while either field was empty) never fired, and the next render/typing made it work. Fix on
`fix/login-autofill`: the auth forms (login, sign-up, forgot password, change password) now read their
values from `FormData` at submit time via `src/features/auth/formValues.ts`, keep the fields
uncontrolled so the browser's values are never overwritten, and disable the button only while the
request is in flight; empty submits show "Enter your email and password." instead of doing nothing.
Covered by three new tests (silent autofill on login, silent autofill on sign-up, empty submit);
398 tests, lint, typecheck, and a real-browser check on the Vite dev server pass. PR #31 was
squash-merged into `develop` (`52db165`, CI green) and the Vercel production URL was redeployed from
it (`streakwise-cig5k82ce`, READY); the same real-browser probe on production now sees the login
request on the first click. The owner confirmed on 2026-10-25 that logging in now works on the first
attempt.

**Next steps (in order):**

1. Merge the M8 PR into `develop` (CI green) and check the `develop` preview.
2. Owner: look at the new colours and the "Manage track" button; say if the palette should be
   warmer/cooler before it goes into v1.0.0.
3. Owner: finish the remaining preview-checklist items (sign-up + confirmation with a `+test`
   address, MCP link, share link).
4. Owner: yes/no to R4. Then merge `develop` → `main`, deploy from `main`, tag `v1.0.0`, make a new
   Claude link, and delete Netlify.

**2026-10-25: M8 Polish built on `chore/polish`.** No migration, no release (R4 is still the owner's
decision).

- **Accessibility:** `e2e/a11y.spec.ts` runs axe-core with the WCAG 2.1 A/AA rules over all eight
  screens, in light and dark, on the phone and desktop projects (32 checks). Tinted "overdue" rows
  failed at first: light `--muted-foreground` is now `#55635c` and `--destructive` `#b02a22`, which
  clears 4.5:1 on cards, muted backgrounds, and the 5–10% destructive tints.
- **Palette (owner asked for a final colour scheme):** warm paper and sand neutrals, deep teal
  (`#0c5f57`) for actions, pale mint for highlights, brick red for destructive actions; dark mode is
  the same roles on a near-black green background with mint (`#6fd3bd`) as primary. Track and chart
  palettes are unchanged. Every text/background pair measures 5.4:1–15.7:1.
- **Delete/manage a track (owner asked for it):** a "Manage track" button on a track's page opens the
  existing node dialog, so rename, recolour, add a child, archive, restore, and delete (TREE-1–3,
  TREE-5) work without going through Settings → Structure. A successful delete returns to Tracks;
  `NodeDialog` gained an optional `onDeleted` for that. Two component tests cover the deleted and the
  refused-with-history cases.
- **Screenshots and README:** `scripts/screenshots.mjs` (`npm run screenshots`) drives the demo in a
  real browser and writes seven PNGs to `docs/screenshots/` (desktop and phone, light and dark). The
  README now has the live and demo links, a screenshots section, the palette, 400 tests, the
  accessibility/e2e coverage, the `screenshots` command, and no "active development" note.
- **Empty states:** all eight screens already had one (checked screen by screen), so nothing needed
  changing.
- **Docs:** `architecture.md` gained "Theme and accessibility (M8)" and "Performance", lost its
  skeleton note, and lists the a11y e2e.
- **Checked:** lint, typecheck, `npm test` (400), `npm run build` (224.7 KB gzipped, budget 250), and
  the full e2e suite (40 checks: demo, PWA, and the 32 axe ones).

**B17 final checklist — where each line is proved.** All green locally on `chore/polish`; the owner
still has to confirm the lines that need a real phone, a real account, or the release itself.

| B17 area               | Evidence                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Access and structure   | `core/services/structure.test.ts`, `auth.test.tsx`, `settings/StructurePage.test.tsx` (3 levels, 4th blocked, delete vs archive, rename, reorder, archive/restore), e2e login/logout |
| Logging and history    | `LogPage.test.tsx`, `HistoryPage.test.tsx`, `core/services/sessions.test.ts`, `demo.spec.ts` (log, edit, delete, undo, roll-ups)                                                     |
| Home                   | `HomePage.test.tsx`, `core/services/dashboard.test.ts`, `logic/dashboardLogic.test.ts` (targets, Monday reset, neglect, streaks, heatmap, deadlines)                                 |
| Progress               | `TasksPage.test.tsx`, `ScoresPage.test.tsx`, `TrackPage.test.tsx`, `core/services/tasks.test.ts`, `scores.test.ts` (nesting, weekly reset, scored completion, syllabus %, chart)     |
| Reports and sharing    | `ReportsPage.test.tsx`, `SharedLinksExport.test.tsx`, `core/services/reports.test.ts`, `shares.test.ts` (periods, print layout, both copy formats, notes off, revoked/expired)       |
| Demo, app              | `demo.spec.ts` (zero `/api` calls, reload resets), `pwa.spec.ts` (manifest, service worker, offline)                                                                                 |
| Claude                 | `server/tests/mcp*.test.ts` through the real SDK; the connector itself was re-made after R3 and works (owner, 2026-10-09)                                                            |
| Quality and operations | CI green on each PR, keep-alive workflow ran (R1 note), 6 production builds in October (≤ 8), README + `v1.0.0` tag with R4                                                          |

Still owner-only: installing the app on the owner's phone after R4, a fresh Claude connector on the
production URL, and the sign-up + confirmation email on the live site.

**Preview checklist:** Check `/api/health` (done); sign in/out (done); test sign-up and email
confirmation with a throwaway `+test` address and delete that account afterward; confirm the
authenticated app can read `/api/nodes`; test the MCP link with MCP Inspector; verify `/r/<slug>` is
`noindex`, `/.well-known/*` is 404, wrong methods return 405, and the service worker never caches
`/api`, `/mcp`, or `/auth`. Account creation and test writes touch the shared Supabase project, so
get the owner's OK first.

**2026-10-24: PR #30 (Vercel API ESM module-resolution fix) merged into `develop`** (squash commit
`9fc9713`). The change replaces the in-place esbuild bundle with explicit `.js` extensions on relative
imports, so Vercel's Node ESM function resolves its imports after compilation. `npm run format:check`,
`npm run lint`, `npm run typecheck`, `npm test` (395 tests), and `npm run build` pass; CI and e2e are
green. The Vercel preview returned `{"ok":true,"version":"0.1.0"}` for `GET /api/health`, 405 for
`POST /api/health`, and the expected 401 for unauthenticated `GET /api/nodes`. `vercel build --yes`
also produced the API function output, but printed TypeScript diagnostics even though the project's
typecheck and CI passed. It could not pull three preview secrets and wrote placeholders to a local
file; that generated file was removed. This session made no intentional production release.

**2026-10-24: PR #29 (the Vercel move) merged into `develop`** (owner's OK; squash commit `f51cb89`,
with follow-up notes in `054b7ba`). The repository is linked to a Vercel project named `streakwise`,
and the PR #30 preview deployed successfully. One manual CLI production deployment was made from
`develop` during that session (see the 2026-10-25 note above); it was not an approved R4 release and
its API was broken until the repair. The owner also deleted `APP_PASSCODE`/`MCP_SECRET` from `.env`
(verified above).

**Open question:** None blocking. Supabase's URL configuration still needs the Vercel addresses added
(owner step 1 above), and the owner has not yet decided on R4.

**PR #29 implementation details (historical):**

- One deployed function: `api/server.ts` (Vercel Function, web `Request`/`Response` via the
  `fetch` handler). Vercel's docs recommend a single shared function with rewrites for framework-less
  projects, so fluid compute can reuse warm instances across routes.
- `server/functions/_lib/router.ts`: the route table with exactly the old `config.path` patterns and
  method lists; extracts `:id`/`:secret`/`:slug` params, 405s wrong methods with `Allow`, and answers
  the same plain 404 for unknown `/api`, `/auth`, `/mcp` paths (never the SPA shell).
- The per-route handler files now export only `create…Handler(getDeps)` factories (no Netlify
  default export, no `config`, no `@netlify/functions` import); `health`/`well-known` are named
  functions. `server/functions/_lib/api.ts` defines `RequestHandler` + `HandlerContext { ip, params }`.
- Folder renamed `netlify/` → `server/` (git rename), tests included; `netlify.toml` and
  `scripts/netlify-ignore.sh` deleted; `scripts/vercel-ignore.sh` added (same docs-only skip rule,
  using `VERCEL_GIT_PREVIOUS_SHA`).
- `vercel.json`: framework null, build `npm run build`, output `dist`, dev `npm run dev:vite`,
  regions `["sin1"]` (Singapore, same region as Supabase), `maxDuration` 30 for `api/server.ts`,
  ignoreCommand, rewrites (4 API prefixes → `/api/server`, then SPA fallback `/(.*)` → `/index.html`),
  and the same security headers (CSP unchanged, `/r/*` noindex, `/sw.js` no-cache, manifest
  content-type, `assets/*` immutable).
- `build/security-headers.ts` is now only the single source of header rules + conversion for
  vercel.json patterns; its test asserts vercel.json matches it exactly (replaces the old
  `dist/_headers` emission and the `NETLIFY=true` gate).
- Dependencies: `@netlify/functions` removed, `@vercel/functions` added (3.10.1; `ipAddress(request)`
  fills the handler `ip` for rate limiting).
- Docs updated for Vercel: CLAUDE.md, README, SETUP.md (hosting parts; `APP_PASSCODE`/`MCP_SECRET`
  dropped from its guides), SPEC (§A4, §B8, §B12, §B14.1, G6, ACCT-1, MCP-2, OPS-4, D8 note, D20 added),
  architecture.md (diagram, folders, dispatch note, environments table).
- Tests: 395 unit/component pass locally (7 new router tests pin params, 405s, 404s, no SPA
  fallthrough); lint, typecheck, prettier, and the production build are green.

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

- Is the new palette right for v1.0.0? Warm paper, sand, deep teal, and mint — easy to warm up or
  cool down before R4.
- Say yes/no to R4 once the checklist passes (merge `develop` → `main`, then deploy production from
  `main`).
- Should the Netlify entries stay in Supabase's URL configuration until R4, or be removed with the
  Netlify project?

## Decisions made during the build

- M8: the final palette is warm paper and sand neutrals with deep teal for actions, pale mint for
  highlights, and brick red for destructive actions; dark mode swaps the same roles on a near-black
  green background. Track and score-chart colours stay separate (`--series-*`), so a theme change
  never re-colours someone's data.
- M8: contrast is enforced by axe-core in the e2e suite (all 8 screens × light/dark × phone/desktop)
  rather than by eye or by unit tests, because it measures the real computed colours.
- M8: a track is managed from its own page ("Manage track" → the existing `NodeDialog`), so the
  destructive actions live where the track is; `onDeleted` lets the page leave the node that no
  longer exists. Settings → Structure keeps the whole-tree view.
- M8: README screenshots come from the demo through `scripts/screenshots.mjs`, so they can be
  regenerated after any UI change instead of going stale.
- Vercel (2026-10-25): the auth forms read their values from `FormData` at submit time (uncontrolled
  inputs), so browser/password-manager autofill works on the first click; submit buttons are disabled
  only while a request is in flight, and an empty submit shows a message instead of doing nothing.
- Vercel (2026-10-25): `vercel promote` re-runs the ignored-build step for the promoted commit, so a
  git deployment whose diff is docs-only gets cancelled and the alias stays put. To repair or release
  production, deploy explicitly with `vercel deploy --prod` from the intended commit.
- Vercel (2026-10-25): production serves `develop` only as the repair of the accidental deploy; the
  release rule is unchanged — R4 merges `develop` → `main` and deploys from `main`.
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
