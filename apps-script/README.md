# Apps Script Setup

1. Create or open the target Google Sheet.
2. Open **Extensions > Apps Script**.
3. Add `Code.js` and `appsscript.json` from this folder.
4. In **Project Settings > Script Properties**, set:
   - `APPS_SCRIPT_SHARED_SECRET`
   - `THE_ODDS_API_KEY`
5. Run `setupWorkbook()` once and approve permissions.
6. Deploy as a web app:
   - Execute as: yourself
   - Who has access: anyone with the deployment URL
7. Copy the web app URL into Vercel as `APPS_SCRIPT_WEBAPP_URL`.
8. Run `installDailySettlementTrigger()` once to install the recent-score settlement job.

The sheet-side source of truth for sportsbook currency is `Site Config`. The initial MBK/TSB rows are examples and can be edited.

Supported straight markets are moneyline, spread, and total. Spread matching requires the same game, different sites, opposite selected teams, and exact opposite signed lines. Total matching requires the same game, different sites, exact same total line, and opposite over/under sides. Pushes settle with `result = push` and `netUsd = 0`.

The settlement trigger only calls The Odds API for leagues that currently have open matched pairs in `Matched Pairs`. If there are no open matched bets, it skips The Odds API entirely for that run.
