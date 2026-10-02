# Progress

_Last updated: 2026-10-03 by Claude Code (after #6)_

## Milestones

| #             | Status  | PR  | Notes / deferred items |
| ------------- | ------- | --- | ---------------------- |
| M0 Scaffold   | ✅ done | #1  |                        |
| M1 Foundation | ⏳      |     |                        |
| M2 Logging    | ⏳      |     |                        |
| M3 Dashboard  | ⏳      |     |                        |
| M4 MCP        | ⏳      |     |                        |
| M5 Progress   | ⏳      |     |                        |
| M6 Reports    | ⏳      |     |                        |
| M7 Demo + PWA | ⏳      |     |                        |
| M8 Polish     | ⏳      |     |                        |

## Releases to production (budget: max 8 per month, ~15 of 300 credits each)

| Release | Date       | Includes                                                                                                                                                                   |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0      | 2026-10-03 | M0 scaffold, placeholder page, `/api/health` (#3, #5). 2 production builds: the first failed (test file in `netlify/functions`, fixed in #4). Count both toward the month. |

Production builds this month (Oct 2026): **2** (~30 credits, counted conservatively).

Live site: https://streakwise-ap.netlify.app · Netlify project: `streakwise-ap`

## Database migrations applied

| Migration | dev | prod |
| --------- | --- | ---- |

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
- [ ] Claude custom connector added (after R2)

## Current work / next step

Setup Steps 1–8 are done (R0 live). Blank local dev page fixed in #6 (on `develop`, not yet in
production; it only affects local dev, so it can wait for the next release).

1. SETUP Step 8.7: explain previews vs the `develop` deploy vs the live site to the owner.
2. Then start **M1** (`feat/foundation`), SPEC §B14.2.

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
- **D15 (owner's choice): one Supabase project (`streakwise-dev`, Singapore) for every environment.**
  The owner's free project allowance was already used. Previews and the `develop` deploy touch real
  data, so test features in demo mode first and warn the owner before any test that writes to the
  database. Migrations are run once. Keep-alive covers the only project.
