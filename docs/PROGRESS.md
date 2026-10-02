# Progress

_Last updated: 2026-10-03 by Claude Code (M1 in progress)_

## Milestones

| #             | Status  | PR  | Notes / deferred items                                                                 |
| ------------- | ------- | --- | -------------------------------------------------------------------------------------- |
| M0 Scaffold   | ✅ done | #1  |                                                                                        |
| M1 Foundation | 🚧      | #7  | Repository covers nodes, settings, seed so far; later milestones add their own methods |
| M2 Logging    | ⏳      |     |                                                                                        |
| M3 Dashboard  | ⏳      |     |                                                                                        |
| M4 MCP        | ⏳      |     |                                                                                        |
| M5 Progress   | ⏳      |     |                                                                                        |
| M6 Reports    | ⏳      |     |                                                                                        |
| M7 Demo + PWA | ⏳      |     |                                                                                        |
| M8 Polish     | ⏳      |     |                                                                                        |

## Releases to production (budget: max 8 per month, ~15 of 300 credits each)

| Release | Date       | Includes                                                                                                                                                                   |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0      | 2026-10-03 | M0 scaffold, placeholder page, `/api/health` (#3, #5). 2 production builds: the first failed (test file in `netlify/functions`, fixed in #4). Count both toward the month. |

Production builds this month (Oct 2026): **2** (~30 credits, counted conservatively).

Live site: https://streakwise-ap.netlify.app · Netlify project: `streakwise-ap`

## Database migrations applied

One database for everything (D15), so each migration runs once.

| Migration          | Applied              |
| ------------------ | -------------------- |
| `0001_initial.sql` | ⏳ waiting for owner |

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
- [ ] Run `supabase/migrations/0001_initial.sql` in the Supabase SQL Editor (M1)
- [ ] Claude custom connector added (after R2)

## Current work / next step

Setup is done (R0 live; Step 8.7 explained to the owner). Blank local dev page fixed in #6.

**M1 (`feat/foundation`, PR #7)**: code complete and green locally (schema, RLS, RPCs, repositories,
core skeleton, auth API with lockout, keepalive + workflow, seed, DataSources, login page, demo
skeleton). Remaining:

1. Owner runs `0001_initial.sql` in the Supabase SQL Editor (link:
   https://supabase.com/dashboard/project/ckoaxcyyxmdfgukkbuob/sql/new). The SQL is copied to the
   clipboard with `Get-Content supabase/migrations/0001_initial.sql -Raw | Set-Clipboard`.
2. Verify with `npm run dev`: `/api/keepalive` (read only), then a real login. Tell the owner first:
   the first login writes the seed into the real database (D15), which is intended.
3. Check the PR #7 preview (log in there too), then squash-merge into `develop`.
4. Then M2 (`feat/logging`).

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
- Functions import core code with relative paths (`../../src/core/...`), not the `@/` alias.
- Bundle after M1: ~150 KB gzipped (Zod is a large part). Budget is 250 KB; consider `zod/mini` in the
  browser if it gets tight.
- **D15 (owner's choice): one Supabase project (`streakwise-dev`, Singapore) for every environment.**
  The owner's free project allowance was already used. Previews and the `develop` deploy touch real
  data, so test features in demo mode first and warn the owner before any test that writes to the
  database. Migrations are run once. Keep-alive covers the only project.
