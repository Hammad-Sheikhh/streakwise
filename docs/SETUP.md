# SETUP.md — Start Here

This file has two parts:
- **Part 1** is for you, the owner. It's plain English.
- **Part 2** is the step-by-step instructions for Claude Code.

---

# Part 1 — For you (the owner)

## How to start

1. Create an empty folder, e.g. `Documents\study-tracker`, and put `SETUP.md` and `SPEC.md` in it.
2. Open that folder in VS Code and start Claude Code.
3. Type: **"Read SETUP.md and SPEC.md, then follow SETUP.md step by step."**

Claude Code writes all the code and handles GitHub for you. It will stop and ask whenever it needs you.

The whole build takes roughly **10–13 Claude Code sessions**. You can start logging for real after
milestone 2, and Claude can connect to your app after milestone 4. Milestone 4 is the **minimum useful
version**, so if exams or usage limits get in the way, it's fine to pause there and continue later.

## What you'll need to do

Everything else is Claude Code's job.

| When | What you do | Time |
|---|---|---|
| Setup | Approve a few installs; log in to GitHub in your browser | ~10 min |
| Setup | Choose the app's name from Claude Code's suggestions | 2 min |
| Setup | Create free Netlify and Supabase accounts | ~10 min |
| Setup | Create 2 Supabase databases (test + real) and paste their keys into the `.env` file | ~15 min |
| Setup | Connect the repo to Netlify and add the secret settings | ~15 min |
| After milestone 1 | Paste the database setup code into each Supabase database and click Run | ~5 min |
| 4 times (after milestones 2, 4, 6, 8) | Say yes when Claude Code asks to update the live site | 1 min each |
| After milestone 4 | Add the Claude connector, then test it in a chat | ~10 min |
| Anytime (optional) | Try the test links on your phone and report anything odd | — |

## What to say to Claude Code

| You want to… | Say this |
|---|---|
| Start or continue (**always** start a new session this way) | "Read CLAUDE.md and docs/PROGRESS.md, then continue." |
| Begin the next part of the build | "Start the next milestone." |
| Understand something | "Explain what you just did in simple words." |
| Test on your phone | "Give me the test link and what to try." |
| Report a problem | "Something's wrong:" and paste the **whole** error or describe what you saw |
| Undo something | "Undo the last change." or "Go back to how it was before this milestone." |
| Stop for the day | "Save your progress, I'm stopping for today." |
| Check the Netlify budget | "How many live updates have we used this month?" |
| Start fresh after a milestone | Type `/clear`, then the start phrase above |

## Golden rules

1. **Start every session with the start phrase.** docs/PROGRESS.md remembers where you are, so nothing gets lost between sessions.
2. **Type `/clear` after each milestone.** A fresh session works better than one long one.
3. **Never paste secret keys into the chat.** They go only into the `.env` file (in VS Code) or into Netlify's settings.
4. **Only say yes to "update the live site" when you're ready.** Each update uses about 15 of Netlify's 300 free monthly credits.
5. **When something breaks, paste the whole error.** Don't summarise it.

## If something goes wrong

| Problem | What to do |
|---|---|
| You hit your Claude usage limit mid-work | Nothing important is lost, because Claude Code saves its work often. When your limit resets, use the start phrase. |
| "running scripts is disabled on this system" | Tell Claude Code: "Fix the PowerShell script permission." |
| Claude Code seems confused or goes in circles | Type `/clear`, then the start phrase. |
| The live site stopped working | Say: "The live site is down — help me check Netlify credits and whether Supabase is paused." |
| Claude can't reach your app | Say: "The Claude connector isn't working — help me debug it." |
| You think a secret leaked (e.g. you pasted it somewhere public) | Say: "A secret may have leaked — help me replace it." |

---

# Part 2 — For Claude Code

## 2.1 Working agreement

- The owner is a student on **Windows** (PowerShell) who has vibe coded before but is **not technical**.
- **You do all the coding, commits, pushes, PRs, and merges.** The owner only does things that need
  their own accounts, secrets, or approval.
- **Explain as you build:** before each step, say in 1–2 plain sentences what you're doing and why.
  When you must use a technical word, define it once.
- **Ask before big decisions:** changes to the stack, scope, or data model, and anything that costs money
  or Netlify credits. Small implementation choices are yours.
- **Manual steps:** one step at a time, with exact clicks or commands, then wait for the owner to confirm.
- **Never ask the owner to paste secrets into the chat.** Secrets go in `.env` (which the owner edits
  in VS Code) or in Netlify. Never print secret values in the terminal.
- This is a **portfolio project**. Work like a professional developer.
- **docs/SPEC.md is the source of truth** for what to build: requirement IDs, priorities, milestones
  (§B14), and the definition of done (§B14.3).

## 2.2 Session protocol (every session)

**At the start:** read `CLAUDE.md`, `docs/PROGRESS.md`, and the SPEC sections for the current milestone.
Tell the owner in 2 lines where things stand and what's next.

**While working:** make small conventional commits after every meaningful step, and **push the branch
each time**. A sudden stop (usage limit, closed laptop) should lose at most a few minutes of work.
Update PROGRESS.md "Current work" whenever the direction changes.
- Run lint, typecheck, and tests before each push. The one exception: if you have to stop unexpectedly,
  push unfinished work anyway as `chore: WIP …` and say so in PROGRESS.md.

**Before stopping** (milestone done, owner stopping, or a long run):
1. Push everything.
2. Update PROGRESS.md: status, next step, deferred items, open questions.
3. Tell the owner: "Type `/clear`, then say: *Read CLAUDE.md and docs/PROGRESS.md, then continue.*"

**Where PROGRESS.md changes go:** on the current milestone branch. Between milestones (for example,
logging a release), a commit that changes **only** `docs/PROGRESS.md` may go straight to `develop`.
It's the only exception to "never commit straight to `develop`", and it doesn't trigger a Netlify build.

Until Step 4 creates these files, work from SETUP.md and SPEC.md in the project root.

---

## Step 1 — Check the tools

In PowerShell, check each tool. Tell the owner what's missing before installing anything.

| Tool | Check | Install if missing |
|---|---|---|
| Node.js LTS (v20+) | `node -v` | `winget install OpenJS.NodeJS.LTS` |
| Git | `git --version` | `winget install Git.Git` |
| GitHub CLI | `gh --version` | `winget install GitHub.cli` |
| Netlify CLI | `netlify --version` | `npm install -g netlify-cli` |

- If `winget` isn't available, guide the owner to the official installer for each tool instead.
- After any install, ask the owner to **close and reopen the VS Code terminal**.
- If PowerShell says "running scripts is disabled", explain it, then run
  `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` (with the owner's OK).
- Check git identity (`git config --global user.name` and `user.email`); set them with the owner if they're empty.
- Run `gh auth status`. If it isn't logged in, ask the owner to run `gh auth login` themselves and choose
  **GitHub.com → HTTPS → Login with a web browser**.

## Step 2 — Choose the app name

Suggest **5 short, memorable names**, each with a one-line reason. It's a study tracker with a
GitHub-style heatmap and a Claude connection. Check that none obviously clashes with a well-known product.
The owner picks one. Use it as the **app name** (e.g. `StudyLoop`) and the **repo name** in kebab-case
(e.g. `studyloop`). Also ask for the owner's **full name** for the MIT license.

## Step 3 — Accounts (owner)

Confirm the owner has these, and walk them through creating any that are missing:
1. **GitHub** (they already have one)
2. **Netlify**, free plan: "Sign up with GitHub"
3. **Supabase**, free plan: "Continue with GitHub"

Don't create the Supabase projects or the Netlify site yet. That happens in Steps 7 and 8.

## Step 4 — Project files

1. Move `SETUP.md` and `SPEC.md` into a `docs/` folder. Replace every `<APP_NAME>` in `docs/SPEC.md` with the chosen name.
2. Create `CLAUDE.md` in the root with exactly the content in **Appendix A**, filling in `<APP_NAME>`.
3. Create `docs/PROGRESS.md` from **Appendix B**.
4. Create `.gitignore` (Node, Vite, `.env`, `.env.*` except `.env.example`, `.netlify`, `playwright-report`,
   `test-results`) and `.gitattributes` (`* text=auto eol=lf`), so Windows line endings don't cause CI noise.

## Step 5 — Create the repository

1. Run `git init -b main`, then make the first commit (`chore: project plan and instructions`).
2. Create a **public** repo:
   `gh repo create <repo-name> --public --source . --remote origin --description "<one-line pitch>"`
3. Push `main`. Then create `develop` from `main` and push it.
4. Explain branches to the owner: `main` is the live site; `develop` is where finished work collects
   before going live.

## Step 6 — Scaffold (milestone M0, branch `chore/scaffold` from `develop`)

Set up a professional foundation with no features yet, just a placeholder page.

**App and tooling**
- Vite + React + TypeScript (strict), Tailwind CSS + shadcn/ui, React Router, TanStack Query,
  Zod, date-fns + date-fns-tz
- Add every other library in the milestone that first needs it: the Supabase client (M1), Recharts (M3/M5),
  the MCP SDK (M4), and `vite-plugin-pwa` (M7)
- ESLint + Prettier (`endOfLine: "lf"`)
- Vitest + React Testing Library, with one sample test
- Playwright installed and configured (the end-to-end tests come in later milestones)
- `.nvmrc` and `engines` pinned to the Node LTS major version
- npm scripts: `dev` (`netlify dev`; it works fully after Step 8 links the site), `build`, `preview`,
  `lint`, `typecheck`, `test`, `test:e2e`, `format`

**Structure:** create the folders from SPEC §B12, plus a sample pure function in `src/core/logic` with a test.

**Backend:** a `health` function in `netlify/functions/` (OPS-1), in the modern function format with `config.path`.

**Config and repo files**
- `netlify.toml`:
  - build command, publish dir, and functions dir
  - `NODE_VERSION`
  - SPA fallback
  - security headers, and `X-Robots-Tag: noindex` for `/r/*`
  - an `ignore` command that skips builds when only docs or Markdown changed (SPEC §B14.1)
- `.env.example` with names only: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `APP_PASSCODE`, `SESSION_SECRET`, `MCP_SECRET`
- `.github/workflows/ci.yml`: on PRs to `develop`/`main` and pushes to them, run lint, typecheck, test, and build
  (Node LTS, npm cache). The end-to-end job is added in M7.
- `.github/pull_request_template.md`: What · Why · Spec IDs · How to test (preview link) · Screenshots · Checklist
- `LICENSE` (MIT, with the owner's full name and the current year)
- `README.md` skeleton: name, one-line pitch, CI badge, "🚧 In development"
- `docs/architecture.md` skeleton

**Then:**
- Commit, push, and open a PR into `develop` (`gh pr create --base develop`).
- Wait for CI (`gh pr checks --watch`). Fix anything until it's green.
- Squash-merge (`gh pr merge --squash --delete-branch`), then update your local `develop`.
- Show the owner the PR on GitHub and explain, in two sentences each, what a PR and CI are.

## Step 7 — Supabase: two databases (owner, with your guidance)

Walk the owner through this one step at a time:

1. Create two projects in the **same region, the one closest to Pakistan** (e.g. Mumbai, if it's listed):
   - `<repo-name>-dev`: for testing and previews
   - `<repo-name>-prod`: for real data

   For each one, they generate a strong database password and **save it somewhere safe**
   (a password manager or a private note). These passwords aren't needed day to day.
2. For each project, show them where to find the **Project URL** and the **secret key**. Check the current
   Supabase docs: newer projects use secret keys (`sb_secret_...`); older ones use the `service_role` key.
   **Warn them that this key is like a master password.**
3. Create a local `.env` from `.env.example`. **The owner pastes the dev project's URL and secret key into it
   themselves.** Local development uses only the dev database.
4. Generate random values for `SESSION_SECRET` and `MCP_SECRET` (at least 32 bytes each) with a Node
   one-liner that **writes straight into `.env` without printing them**. Ask the owner to choose an
   `APP_PASSCODE` and type it into `.env` themselves.
5. Record both projects (names only, no keys) in PROGRESS.md.

## Step 8 — Netlify (owner, with your guidance)

Walk the owner through this one step at a time. If a menu has moved, check the current Netlify docs.

1. In Netlify, import the GitHub repo. The build settings come from `netlify.toml`.
   The **production branch is `main`**.
2. Turn on **branch deploys for `develop`** (free). Keep **deploy previews** on (free), and make sure they
   also cover pull requests against branch-deploy branches, so PRs into `develop` get a preview.
3. Add environment variables, **scoped by deploy context**:

   | Variable | Production | Deploy previews, branch deploys, local development |
   |---|---|---|
   | `SUPABASE_URL` | prod project | dev project |
   | `SUPABASE_SECRET_KEY` | prod project | dev project |
   | `APP_PASSCODE` | the owner's passcode | the owner's passcode |
   | `SESSION_SECRET` | the value from `.env` | the value from `.env` |
   | `MCP_SECRET` | a **new** random value | the value from `.env` |

   - Production values must **never** be used outside the Production context.
   - For the new production `MCP_SECRET`, write a random value into a temporary `.env.production.local` file
     (gitignored by the `.env.*` rule) without printing it. The owner copies it into Netlify, then you
     delete the file.
   - The owner types the passcode and secret values into Netlify themselves.

4. The first deploy of `main` counts as release **R0**. Record it in PROGRESS.md.
   Check `https://<site>.netlify.app/api/health`.
5. Save the production URL as a GitHub repo variable for the keep-alive workflow:
   `gh variable set PROD_URL --body "https://<site>.netlify.app"`
6. Run `netlify link` locally so `npm run dev` works with functions.
7. Explain to the owner, in plain words, the difference between deploy previews, the `develop` branch deploy,
   and the live site, and why only live updates cost credits.

## Step 9 — Build the app (M1 → M8)

Follow the milestones in **SPEC §B14.2**, one milestone per session where possible (SPEC §B14.4).
For each milestone:

1. Start from the latest `develop`. Create the milestone's branch.
2. Tell the owner in 2–3 sentences what this milestone adds.
3. Build the **MUST items first, then SHOULD, then COULD** (only if time allows; cut order is SPEC §B14.5).
   Write tests alongside the code. Keep `DemoDataSource` working.
4. Push and open a PR into `develop` that lists the delivered IDs. Wait for CI and fix it until it's green.
5. Squash-merge and update `develop`. Give the owner the `develop` branch-deploy link and 2–4 things to
   try on their phone (optional for them).
6. **At a release point (R1–R4):** say to the owner:
   *"Ready to update the live site? It uses about 15 of the 300 free monthly credits; we've used N this month."*
   Only when they say yes:
   - Open a PR from `develop` → `main` titled "Release R#: …" and wait for CI.
   - Merge it with a **merge commit** (`gh pr merge --merge`), never a squash, so `main` and `develop` stay in sync.
   - Check `/api/health` on the live site.
   - Log the release in PROGRESS.md (a PROGRESS-only commit to `develop`).
7. Check the definition of done (SPEC §B14.3), update PROGRESS.md, and close the session (§2.2).

**Manual step after M1:** guide the owner to run `supabase/migrations/0001_initial.sql` in the Supabase
**SQL Editor**: first in the **dev** project, then in **prod**. After each run, verify that the tables exist.
Record both runs in PROGRESS.md. Any later migration follows the same steps.

## Step 10 — Connect Claude (after R2)

1. First test the MCP server yourself with MCP Inspector (`npx @modelcontextprotocol/inspector`) against
   the `develop` branch deploy: `https://develop--<site>.netlify.app/mcp/<dev MCP_SECRET>`.
2. Then walk the owner through adding the **production** URL `https://<site>.netlify.app/mcp/<prod MCP_SECRET>`
   to Claude as a **custom connector**. The owner copies it from Settings → Claude connection (SET-4), or from
   Netlify if SET-4 was cut. Check the current Claude help docs for where custom connectors are added;
   don't guess menu paths.
3. Test together in a Claude chat:
   - "What tracks do I have?"
   - "Log 30 minutes of German self-study for today."
   - "How am I doing this week, and what am I neglecting?"

   Confirm the session appears in the app with the "via Claude" badge.
4. Tell the owner: **anyone with this URL can read and change their tracker. Never share it.**
   If it leaks: generate a new `MCP_SECRET` for production in Netlify, release (this uses credits),
   and update the connector URL in Claude.

## Step 11 — Finish (R4)

1. Run through the SPEC §B17 checklist with the owner, and fix anything that fails.
2. README:
   - pitch, live link, and demo link (`/demo`)
   - screenshots in light and dark, mobile and desktop, captured from demo mode with Playwright
   - features, tech stack, and an architecture diagram (Mermaid)
   - how the MCP server works
   - local setup, environment variables (names only), and testing
   - future improvements
3. GitHub repo description and topics: `react`, `typescript`, `vite`, `tailwindcss`, `netlify`, `supabase`, `mcp`, `pwa`.
4. Release R4, then tag it and create a GitHub release: `gh release create v1.0.0 --generate-notes`.
5. Give the owner a 5-line project summary for their portfolio or LinkedIn.

---

## Troubleshooting (for Claude Code)

| Situation | Action |
|---|---|
| CI fails | Read the failing job log with `gh run view --log-failed`, fix the smallest cause, and push. Don't disable checks. |
| Netlify build fails | Ask the owner to open the deploy log and copy the error lines, or use the Netlify CLI. Fix and push. |
| Netlify secret scanning fails the build | A secret value reached the bundle or build output. Find out why and remove it; never just silence the scanner. |
| Netlify credits low | Stop releasing. Tell the owner the remaining budget and when it resets. |
| Supabase **prod** project paused | Guide the owner to restore it from the Supabase dashboard. Then check the keep-alive workflow is running (GitHub disables scheduled workflows in public repos after 60 days without repository activity; re-enable it in the Actions tab). |
| Supabase **dev** project paused | Expected after a week without building, because keep-alive only covers prod. Guide the owner to restore it from the dashboard before testing previews. |
| The owner reports a bug on the live site | Fix it on a branch from `develop`, merge, then propose a release. It needs the owner's yes and counts toward the monthly budget. |
| MCP connector fails | Test with MCP Inspector, check the function logs, and confirm the secret and URL are for the same deploy context. |
| A session ran out mid-task | The next session reads PROGRESS.md, checks `git status` and the branch, and continues. |
| You're unsure about a requirement | Ask the owner. Don't guess on scope. |

---

## Appendix A — CLAUDE.md (create exactly this, with `<APP_NAME>` filled in)

```markdown
# <APP_NAME> — instructions for Claude Code

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
```

## Appendix B — docs/PROGRESS.md (starting content)

```markdown
# Progress

_Last updated: <date> by Claude Code_

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
- [ ] GitHub CLI logged in
- [ ] Netlify account
- [ ] Supabase account
- [ ] Supabase dev project created, keys in `.env`
- [ ] Supabase prod project created
- [ ] Netlify site connected, env vars set per context, branch deploys for `develop` on
- [ ] PROD_URL repo variable set
- [ ] Claude custom connector added (after R2)

## Current work / next step

## Open questions for the owner

## Decisions made during the build
```
