# Streakwise — instructions for Claude Code

## Every session
1. Read this file, docs/PROGRESS.md, and the docs/SPEC.md sections for the current milestone.
2. Tell the owner in 2 lines where we are and what's next.
3. Make small conventional commits and push after every meaningful step; keep docs/PROGRESS.md current.
4. Before stopping: push, update PROGRESS.md (status, next step, deferred items, questions), and tell the
   owner to type /clear and then: "Read CLAUDE.md and docs/PROGRESS.md, then continue."
5. If you must stop unexpectedly, push unfinished work anyway as `chore: WIP …` and note it in PROGRESS.md.

## The owner
- Not technical, on Windows (PowerShell). Explain each step in 1–2 plain sentences; define jargon once.
- Ask before big decisions (stack, scope, data model, anything that costs money or Netlify credits).
- Manual steps: one at a time, exact clicks/commands, then wait for confirmation.
- When the owner pastes an error: fix the smallest thing, explain the cause in one sentence,
  and don't rewrite working code.
- Never ask for secrets in chat. Secrets go only in `.env` (owner edits it) or Netlify. Never print secret values.

## Source of truth
docs/SPEC.md: requirement IDs, MUST/SHOULD/COULD priorities, milestones (§B14.2), definition of done
(§B14.3), cut order (§B14.5). Don't change scope without the owner's OK; record changes in SPEC §B15.

## Commands
- `npm run dev`        app + functions locally (netlify dev, uses the dev database)
- `npm run lint`       ESLint
- `npm run typecheck`  tsc --noEmit
- `npm test`           Vitest (unit, service, component, MCP)
- `npm run test:e2e`   Playwright against /demo
- `npm run build`      production build
Run lint, typecheck, and test before every push.

## Branches and deploys (Netlify free plan: 300 credits/month; ~15 per production deploy)
- Feature branches from `develop`; PRs into `develop` (`gh pr create --base develop`), squash-merged when
  CI is green. Previews are free.
- `main` = production. Merge `develop` → `main` only at release points (SPEC §B14.2) after the owner
  says yes, using a merge commit (`gh pr merge --merge`), never a squash. Max 8 production deploys per
  month; log each one in docs/PROGRESS.md.
- Live-site bugs: fix branch → `develop` → a release the owner approves (counts toward the budget).
- Never force-push `main` or `develop`. Never commit straight to them, except commits that change only
  docs/PROGRESS.md, which may go to `develop`.
- Conventional commits: feat, fix, chore, docs, test, refactor.

## Architecture rules
- The browser never talks to Supabase. UI → DataSource → ApiDataSource (/api functions) or
  DemoDataSource (core services + InMemoryRepository in the browser).
- Business logic lives only in `src/core` (isomorphic, pure where possible, clock injected).
  API handlers and the MCP server are thin wrappers around core services.
- Zod schemas in `src/core/schemas` validate every input on the server.
- Time zone Asia/Karachi; weeks Mon–Sun; durations are integer minutes.
- DB changes only via new numbered files in `supabase/migrations/`; never edit one that was applied.
  Atomic multi-step writes use Postgres functions (RPC).
- For fast-changing APIs (Netlify Functions, MCP SDK, Supabase keys, shadcn/ui, Tailwind), check
  current docs instead of relying on memory.

## Code style
- TypeScript strict, no `any`. Functional React components with hooks.
- Tailwind + shadcn/ui, mobile-first, accessible (labels, keyboard, WCAG AA, visible focus).
- Small focused files, clear names, comments explain "why" not "what".

## Security and privacy
- Never commit secrets; keep `.env.example` current (names only).
- RLS on every table with no public policies; secret key used only server-side.
- No personal data in code, seed, tests, fixtures, or screenshots (use demo data).
- Logs never contain secrets, passcodes, or note text.

## Definition of done
SPEC §B14.3: MUST items work, tests added, CI green, demo still works, docs updated, PR lists IDs,
PROGRESS.md updated.
