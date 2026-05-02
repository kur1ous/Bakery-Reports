# Bakery Reports

Private bet screenshot extraction and Google Sheets ledger tooling.

## What It Does

- Upload multiple sportsbook screenshots.
- Extract confirmed straight moneyline bets with Gemini `gemini-2.5-flash`.
- Review and edit extracted rows before writing to Google Sheets.
- Send approved rows to an Apps Script web app.
- Let Apps Script maintain `Raw Data`, `Matched Pairs`, `Clean Bets`, `Site Config`, `FX Rates`, and `Settlement Cache`.
- Settle NBA/NFL/MLB/NHL games from The Odds API and keep a settlement-only USD running ledger.

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required website environment variables:

- `APP_PASSWORD`
- `GEMINI_API_KEY`
- `APPS_SCRIPT_WEBAPP_URL`
- `APPS_SCRIPT_SHARED_SECRET`

The upload APIs reject requests unless the browser sends the correct `APP_PASSWORD`. API keys and Apps Script secrets remain server-side.

## Google Sheets Setup

Use the files in `apps-script/` in a Google Sheet-bound Apps Script project. See `apps-script/README.md`.

The configurable sportsbook registry lives in the Google Sheet tab `Site Config`. The JSON schema and starter example in `config/` document the expected shape.

## Verification

```bash
npm test
npm run build
```
