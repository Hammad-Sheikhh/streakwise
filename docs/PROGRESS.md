# Progress

_Last updated: 2026-10-03 by Claude Code (M2 built, PR open)_

## Milestones

| #             | Status                          | PR  | Notes / deferred items                                                                  |
| ------------- | ------------------------------- | --- | --------------------------------------------------------------------------------------- |
| M0 Scaffold   | ✅ done                         | #1  |                                                                                         |
| M1 Foundation | ✅ done                         | #7  | Repository covers nodes, settings, seed so far; later milestones add their own methods  |
| M2 Logging    | 🔄 PR open, owner check pending | #8  | All MUST + SHOULD done. Deferred: TREE-7 (COULD: drag-and-drop, move to another parent) |
| M3 Dashboard  | ⏳                              |     |                                                                                         |
| M4 MCP        | ⏳                              |     |                                                                                         |
| M5 Progress   | ⏳                              |     |                                                                                         |
| M6 Reports    | ⏳                              |     |                                                                                         |
| M7 Demo + PWA | ⏳                              |     |                                                                                         |
| M8 Polish     | ⏳                              |     |                                                                                         |

## Releases to production (budget: max 8 per month, ~15 of 300 credits each)

| Release | Date       | Includes                                                                                                                                                                   |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0      | 2026-10-03 | M0 scaffold, placeholder page, `/api/health` (#3, #5). 2 production builds: the first failed (test file in `netlify/functions`, fixed in #4). Count both toward the month. |

Production builds this month (Oct 2026): **2** (~30 credits, counted conservatively).

Live site: https://streakwise-ap.netlify.app · Netlify project: `streakwise-ap`

## Database migrations applied

One database for everything (D15), so each migration runs once.

| Migration          | Applied                                                  |
| ------------------ | -------------------------------------------------------- |
| `0001_initial.sql` | ✅ 2026-10-03 (owner, SQL Editor); seeded on first login |

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
- [ ] Try M2 on the deploy preview (writes to the real database; delete test sessions afterwards)
- [ ] Say yes/no to release R1 (first live version)
- [ ] Claude custom connector added (after R2)

## Current work / next step

Setup is done (R0 live; Step 8.7 explained to the owner). Blank local dev page fixed in #6.

**M1 done (PR #7).** Verified against the real database locally and on the preview: keepalive,
login (cookie attributes), seeded tree, settings, `me`, logout; `/login` and `/demo` render.

**M2 built on `feat/logging`** (TREE-1–6, LOG-1–10, HIST-1–4, SET-1): navigation (bottom nav /
sidebar), Log, History, Settings, Settings → Structure; core services, endpoints, tests (161 unit/
component + e2e on /demo). Tested in demo mode and with in-memory tests only. **Not yet checked
against the real database**, because previews share it (D15) and the owner was away.

**Next:**

1. Owner tries the deploy preview (it writes real data; see "Owner's manual steps").
2. Fix anything found, squash-merge the PR into `develop`.
3. Ask the owner about release **R1** (first live version, ~15 credits).
4. Then M3 (`feat/dashboard`).

No new migration was needed for M2. Run future SQL in the SQL Editor the same way:
https://supabase.com/dashboard/project/ckoaxcyyxmdfgukkbuob/sql/new, with the file copied via
`Get-Content <file> -Raw -Encoding UTF8 | Set-Clipboard`.

Note: the live site still runs R0, so the keepalive workflow (on `main`) only starts working at R1.

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
- Bundle after M2: ~194 KB gzipped (budget 250 KB).
- **D15 (owner's choice): one Supabase project (`streakwise-dev`, Singapore) for every environment.**
  The owner's free project allowance was already used. Previews and the `develop` deploy touch real
  data, so test features in demo mode first and warn the owner before any test that writes to the
  database. Migrations are run once. Keep-alive covers the only project.
