# AGENTS.md

Instructions for agents working in this repository.

## Repository Ownership

- This repository is owned by `kur1ous`.
- When using GitHub tools or making repository changes, only inspect, create branches in, edit files in, or open PRs for repositories owned by `kur1ous`.
- Do not modify repositories under `Hardik-S`, `Fall-2025-CS-3307`, or any other owner unless the user explicitly names that owner in the same request.
- If a request is ambiguous about repository owner, ask for confirmation before taking GitHub write actions.

## Project Summary

Bakery Reports is a private Next.js app for extracting straight moneyline bet data from sportsbook screenshots and writing reviewed results to Google Sheets.

Main flow:

1. User enters the private app password.
2. User uploads one or more screenshots.
3. Server calls Gemini `gemini-2.5-flash` with a strict structured JSON schema.
4. User reviews/edits extracted bets in the browser.
5. Server posts approved rows to an Apps Script web app.
6. Apps Script writes to Google Sheets, matches opposite-side bets, and settles recent games through The Odds API.

## Important Paths

- `src/app/` - Next.js app routes and global styles.
- `src/components/upload-workspace.tsx` - Main upload/review UI.
- `src/lib/bet-schema.ts` - Zod validation and Gemini JSON schema.
- `src/lib/gemini.ts` - Server-side Gemini extraction.
- `src/lib/matching.ts` - Team normalization and moneyline pair matching.
- `src/lib/ledger.ts` - USD conversion and settlement net math.
- `src/lib/settlement.ts` - Score-event settlement helpers.
- `apps-script/Code.js` - Google Apps Script source for the target Sheet.
- `apps-script/README.md` - Manual Google Sheets/App Script setup steps.
- `config/site-registry.schema.json` - Sportsbook registry schema.
- `.env.example` - Required website environment variables.

## Environment Variables

Never commit real secrets. Use `.env.local` for local development.

Required website variables:

- `APP_PASSWORD`
- `GEMINI_API_KEY`
- `APPS_SCRIPT_WEBAPP_URL`
- `APPS_SCRIPT_SHARED_SECRET`

Required Apps Script properties:

- `APPS_SCRIPT_SHARED_SECRET`
- `THE_ODDS_API_KEY`

## Development Commands

Run from the repository root:

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
npm audit --audit-level=moderate
```

Before claiming work is complete, run at least:

```bash
npm test
npm run lint
npm run build
```

Run `npm audit --audit-level=moderate` after dependency changes.

## Implementation Rules

- Keep Gemini, Apps Script, and The Odds API keys server-side only.
- Do not persist uploaded screenshots unless the user explicitly asks for image storage.
- V1 supports straight moneyline bets only.
- Supported leagues for automatic settlement are NBA, NFL, MLB, and NHL.
- The Google Sheet `Site Config` tab is the runtime source of truth for sportsbook codes and currencies.
- Use stored daily CAD-to-USD rates for historical stability. Do not use live formulas that can change old ledger values.
- Settlement ledger behavior:
  - Cash win: `payout_usd - stake_usd`
  - Cash loss: `-stake_usd`
  - Bonus/free-play win: `win_usd`
  - Bonus/free-play loss: `0`
- Pairing should match same-game, opposite-team, different-site moneyline bets and leave ambiguous extras unmatched.

## UI Rules

- Preserve the current single-page workflow: upload, extract, review, submit.
- Keep the header simple; do not re-add dashboard/profile/navigation sections unless requested.
- Use `lucide-react` icons for UI icons.
- Keep the interface private-tool oriented, not a marketing landing page.
- After UI changes, verify in the in-app browser at `http://127.0.0.1:3000/` when a dev server is running.

## Deployment Rules

- Do not push to GitHub unless the user explicitly asks.
- Do not deploy to Vercel unless the user explicitly asks.
- Do not create or update Apps Script deployments unless the user explicitly asks.
- Drafting deployment instructions is fine; executing deployment steps requires explicit user direction.

## Git Hygiene

- Prefer branches prefixed with `codex/`.
- Do not revert user changes unless the user explicitly asks.
- Avoid committing generated build output, `node_modules`, `.next`, local logs, or real `.env` files.
- The repository is expected to ignore local server logs and environment files.
