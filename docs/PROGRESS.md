# Progress

_Last updated: 2026-10-03 by Claude Code_

## Milestones
| # | Status | PR | Notes / deferred items |
|---|---|---|---|
| M0 Scaffold | ⏳ not started | | |
| M1 Foundation | ⏳ | | |
| M2 Logging | ⏳ | | |
| M3 Dashboard | ⏳ | | |
| M4 MCP | ⏳ | | |
| M5 Progress | ⏳ | | |
| M6 Reports | ⏳ | | |
| M7 Demo + PWA | ⏳ | | |
| M8 Polish | ⏳ | | |

## Releases to production (budget: max 8 per month, ~15 of 300 credits each)
| Release | Date | Includes |
|---|---|---|

## Database migrations applied
| Migration | dev | prod |
|---|---|---|

## Owner's manual steps
- [x] GitHub CLI logged in
- [ ] Netlify account
- [ ] Supabase account
- [ ] Supabase dev project created, keys in `.env`
- [ ] Supabase prod project created
- [ ] Netlify site connected, env vars set per context, branch deploys for `develop` on
- [ ] PROD_URL repo variable set
- [ ] Claude custom connector added (after R2)

## Current work / next step
Setup in progress (SETUP.md Part 2). Steps 1–4 done. Next: Step 5 (create the GitHub repo), then
Step 6 (M0 scaffold).

## Open questions for the owner

## Decisions made during the build
- App name: **Streakwise** (repo `streakwise`), public repo, MIT license under "Hammad Sheikh".
- Netlify CLI installed globally; npm skipped its optional postinstall scripts (new npm allow-scripts
  policy). Check `netlify dev` works in Step 8.
