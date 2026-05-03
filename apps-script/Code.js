const SHEETS = {
  RAW: "Raw Data",
  MATCHED: "Matched Pairs",
  CLEAN: "Clean Bets",
  SITE_CONFIG: "Site Config",
  FX: "FX Rates",
  SETTLEMENT_CACHE: "Settlement Cache"
};

const RAW_HEADERS = [
  "id",
  "sourceFile",
  "siteCode",
  "siteName",
  "ticketId",
  "placedAt",
  "league",
  "marketType",
  "betType",
  "selectedTeam",
  "homeTeam",
  "awayTeam",
  "eventStartAt",
  "oddsDecimal",
  "stakeAmount",
  "payoutAmount",
  "winAmount",
  "currency",
  "confidence",
  "oddsApiEventId",
  "notes",
  "rawJson",
  "ingestedAt",
  "marketLine",
  "totalSide",
  "dateSource"
];

const MATCHED_HEADERS = [
  "pairId",
  "status",
  "gameKey",
  "betAId",
  "betBId",
  "siteA",
  "siteB",
  "selectedA",
  "selectedB",
  "eventStartAt",
  "oddsApiEventId",
  "createdAt",
  "issue",
  "marketType",
  "marketLine"
];

const CLEAN_HEADERS = [
  "ledgerId",
  "pairId",
  "betId",
  "settledAt",
  "siteCode",
  "selectedTeam",
  "winningTeam",
  "result",
  "stakeUsd",
  "payoutUsd",
  "netUsd",
  "currency",
  "fxRate",
  "runningBalanceUsd"
];

const SITE_CONFIG_HEADERS = ["siteCode", "siteName", "defaultCurrency", "stakeKind", "active"];
const FX_HEADERS = ["date", "cadToUsd", "source", "updatedAt"];
const CACHE_HEADERS = ["provider", "eventId", "league", "completed", "homeTeam", "awayTeam", "commenceTime", "scoresJson", "fetchedAt"];

const SPORT_KEYS = {
  NBA: "basketball_nba",
  NFL: "americanfootball_nfl",
  MLB: "baseball_mlb",
  NHL: "icehockey_nhl"
};

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    assertSecret_(payload.secret);

    if (payload.action === "ingestReviewedBets") {
      const result = ingestReviewedBets(payload.bets || []);
      return json_(result);
    }

    return json_({ ok: false, error: "Unknown action." });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function setupWorkbook() {
  ensureSheet_(SHEETS.RAW, RAW_HEADERS);
  ensureSheet_(SHEETS.MATCHED, MATCHED_HEADERS);
  ensureSheet_(SHEETS.CLEAN, CLEAN_HEADERS);
  ensureSheet_(SHEETS.SITE_CONFIG, SITE_CONFIG_HEADERS);
  ensureSheet_(SHEETS.FX, FX_HEADERS);
  ensureSheet_(SHEETS.SETTLEMENT_CACHE, CACHE_HEADERS);
  seedSiteConfig_();
  return { ok: true, sheets: Object.keys(SHEETS).map(function (key) { return SHEETS[key]; }) };
}

function ingestReviewedBets(bets) {
  setupWorkbook();
  if (!Array.isArray(bets) || bets.length === 0) {
    throw new Error("No reviewed bets provided.");
  }

  const rawSheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.RAW);
  const existingIds = new Set(readObjects_(rawSheet).map(function (row) { return row.id; }));
  const now = new Date().toISOString();
  const rows = [];

  bets.forEach(function (bet) {
    validateBet_(bet);
    if (existingIds.has(bet.id)) {
      return;
    }
    rows.push(RAW_HEADERS.map(function (header) {
      if (header === "rawJson") return JSON.stringify(bet);
      if (header === "ingestedAt") return now;
      return bet[header] == null ? "" : bet[header];
    }));
  });

  if (rows.length > 0) {
    rawSheet.getRange(rawSheet.getLastRow() + 1, 1, rows.length, RAW_HEADERS.length).setValues(rows);
  }

  const matchResult = rebuildMatchedPairs();
  return { ok: true, inserted: rows.length, matchedPairs: matchResult.pairs, unmatched: matchResult.unmatched };
}

function rebuildMatchedPairs() {
  const rawSheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.RAW);
  const matchSheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.MATCHED);
  const bets = readObjects_(rawSheet).filter(isSupportedStraightBet_);
  const used = new Set();
  const pairs = [];
  const now = new Date().toISOString();

  bets.forEach(function (bet) {
    if (used.has(bet.id)) return;

    const matches = bets
      .filter(function (candidate) { return !used.has(candidate.id) && candidate.id !== bet.id; })
      .filter(function (candidate) { return candidate.siteCode !== bet.siteCode; })
      .filter(function (candidate) { return gameKey_(candidate) === gameKey_(bet); })
      .filter(function (candidate) { return isPairMatch_(bet, candidate); })
      .sort(function (a, b) { return Math.abs(Number(bet.payoutAmount) - Number(a.payoutAmount)) - Math.abs(Number(bet.payoutAmount) - Number(b.payoutAmount)); });

    if (matches.length === 0) return;

    const match = matches[0];
    used.add(bet.id);
    used.add(match.id);
    pairs.push({
      pairId: "pair_" + (pairs.length + 1) + "_" + slug_(gameKey_(bet)),
      status: "matched",
      gameKey: gameKey_(bet),
      betAId: bet.id,
      betBId: match.id,
      siteA: bet.siteCode,
      siteB: match.siteCode,
      selectedA: bet.selectedTeam,
      selectedB: match.selectedTeam,
      eventStartAt: bet.eventStartAt,
      oddsApiEventId: bet.oddsApiEventId || match.oddsApiEventId || "",
      createdAt: now,
      issue: "",
      marketType: bet.marketType,
      marketLine: matchedMarketLine_(bet)
    });
  });

  clearBody_(matchSheet);
  if (pairs.length > 0) {
    matchSheet.getRange(2, 1, pairs.length, MATCHED_HEADERS.length).setValues(
      pairs.map(function (pair) {
        return MATCHED_HEADERS.map(function (header) { return pair[header] || ""; });
      })
    );
  }

  return {
    pairs: pairs.length,
    unmatched: bets.filter(function (bet) { return !used.has(bet.id); }).length
  };
}

function isSupportedStraightBet_(bet) {
  if (bet.marketType === "moneyline") {
    return Boolean(bet.selectedTeam);
  }
  if (bet.marketType === "spread") {
    return Boolean(bet.selectedTeam) && bet.marketLine !== "" && bet.marketLine != null;
  }
  return bet.marketType === "total" && bet.marketLine !== "" && bet.marketLine != null && Boolean(bet.totalSide);
}

function isPairMatch_(bet, candidate) {
  if (candidate.marketType !== bet.marketType) return false;

  if (bet.marketType === "moneyline") {
    return normalizeTeamName_(candidate.selectedTeam) !== normalizeTeamName_(bet.selectedTeam);
  }

  if (bet.marketType === "spread") {
    return (
      normalizeTeamName_(candidate.selectedTeam) !== normalizeTeamName_(bet.selectedTeam) &&
      linesEqual_(Number(bet.marketLine) + Number(candidate.marketLine), 0)
    );
  }

  return (
    linesEqual_(Number(bet.marketLine), Number(candidate.marketLine)) &&
    String(bet.totalSide).toLowerCase() !== String(candidate.totalSide).toLowerCase()
  );
}

function matchedMarketLine_(bet) {
  if (bet.marketLine === "" || bet.marketLine == null) return "";
  return bet.marketType === "spread" ? Math.abs(Number(bet.marketLine)) : Number(bet.marketLine);
}

function settleRecentGames() {
  setupWorkbook();
  const rawById = indexBy_(readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.RAW)), "id");
  const pairs = readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.MATCHED)).filter(function (pair) {
    return pair.status !== "settled";
  });

  const leagues = leaguesForOpenPairs_(pairs, rawById);
  if (leagues.length === 0) {
    writeSettlementCache_([]);
    return { ok: true, settledRows: 0, fetchedScores: 0, requestedLeagues: [] };
  }

  const scores = fetchRecentScores_(leagues);
  writeSettlementCache_(scores);

  const cleanSheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.CLEAN);
  const existingLedgerIds = new Set(readObjects_(cleanSheet).map(function (entry) { return entry.ledgerId; }));
  const rows = [];
  const now = new Date().toISOString();

  pairs.forEach(function (pair) {
    const betA = rawById[pair.betAId];
    const betB = rawById[pair.betBId];
    if (!betA || !betB) return;

    const score = findScore_(pair, betA, scores);
    if (!score || !score.completed) return;

    const winningTeam = winningTeam_(score);
    if (!winningTeam) return;

    [betA, betB].forEach(function (bet) {
      const ledgerId = pair.pairId + ":" + bet.id;
      if (existingLedgerIds.has(ledgerId)) return;

      const fxRate = bet.currency === "CAD" ? getOrFetchFxRate_(dateOnly_(bet.placedAt)) : 1;
      const stakeUsd = convertToUsd_(Number(bet.stakeAmount), bet.currency, fxRate);
      const payoutUsd = convertToUsd_(Number(bet.payoutAmount), bet.currency, fxRate);
      const result = resultForBet_(bet, score, winningTeam);
      if (!result) return;
      const netUsd = netUsdForResult_(bet, result, stakeUsd, payoutUsd, fxRate);
      const runningBalance = latestBalance_(cleanSheet, bet.siteCode) + netUsd;

      rows.push([
        ledgerId,
        pair.pairId,
        bet.id,
        now,
        bet.siteCode,
        bet.selectedTeam,
        winningTeam,
        result,
        stakeUsd,
        payoutUsd,
        netUsd,
        bet.currency,
        fxRate,
        roundUsd_(runningBalance)
      ]);
      existingLedgerIds.add(ledgerId);
    });
  });

  if (rows.length > 0) {
    cleanSheet.getRange(cleanSheet.getLastRow() + 1, 1, rows.length, CLEAN_HEADERS.length).setValues(rows);
  }

  markSettledPairs_();
  return { ok: true, settledRows: rows.length, fetchedScores: scores.length, requestedLeagues: leagues };
}

function installDailySettlementTrigger() {
  ScriptApp.newTrigger("settleRecentGames").timeBased().everyDays(1).atHour(8).create();
  return { ok: true };
}

function fetchRecentScores_(leagues) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("THE_ODDS_API_KEY");
  if (!apiKey) {
    throw new Error("Set THE_ODDS_API_KEY in Apps Script properties.");
  }

  const scores = [];
  leagues.forEach(function (league) {
    const url = "https://api.the-odds-api.com/v4/sports/" + SPORT_KEYS[league] + "/scores/?daysFrom=3&dateFormat=iso&apiKey=" + encodeURIComponent(apiKey);
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() >= 300) {
      throw new Error("The Odds API scores request failed for " + league + ": " + response.getContentText());
    }
    const payload = JSON.parse(response.getContentText());
    payload.forEach(function (event) {
      scores.push({
        id: event.id,
        league: league,
        completed: Boolean(event.completed),
        homeTeam: event.home_team,
        awayTeam: event.away_team,
        commenceTime: event.commence_time,
        scores: (event.scores || []).map(function (score) {
          return { name: score.name, score: Number(score.score) };
        })
      });
    });
  });
  return scores;
}

function leaguesForOpenPairs_(pairs, rawById) {
  const leagues = new Set();
  pairs.forEach(function (pair) {
    const betA = rawById[pair.betAId];
    const betB = rawById[pair.betBId];
    [betA, betB].forEach(function (bet) {
      if (bet && SPORT_KEYS[bet.league]) {
        leagues.add(bet.league);
      }
    });
  });
  return Array.from(leagues).sort();
}

function writeSettlementCache_(scores) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.SETTLEMENT_CACHE);
  const now = new Date().toISOString();
  clearBody_(sheet);
  if (scores.length === 0) return;
  sheet.getRange(2, 1, scores.length, CACHE_HEADERS.length).setValues(
    scores.map(function (score) {
      return ["The Odds API", score.id, score.league, score.completed, score.homeTeam, score.awayTeam, score.commenceTime, JSON.stringify(score.scores), now];
    })
  );
}

function findScore_(pair, bet, scores) {
  if (pair.oddsApiEventId) {
    const byId = scores.find(function (score) { return score.id === pair.oddsApiEventId; });
    if (byId) return byId;
  }
  return scores.find(function (score) {
    const scoreBet = {
      league: score.league,
      eventStartAt: score.commenceTime,
      homeTeam: score.homeTeam,
      awayTeam: score.awayTeam,
      oddsApiEventId: ""
    };
    return gameKey_(scoreBet) === gameKey_(bet);
  });
}

function winningTeam_(score) {
  if (!score.scores || score.scores.length < 2) return null;
  const first = score.scores[0];
  const second = score.scores[1];
  if (first.score === second.score) return null;
  return first.score > second.score ? first.name : second.name;
}

function getOrFetchFxRate_(date) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.FX);
  const rows = readObjects_(sheet);
  const existing = rows.find(function (row) { return String(row.date) === date; });
  if (existing && Number(existing.cadToUsd) > 0) {
    return Number(existing.cadToUsd);
  }

  const url = "https://api.frankfurter.app/" + encodeURIComponent(date) + "?from=CAD&to=USD";
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() >= 300) {
    throw new Error("Could not fetch CAD to USD FX rate for " + date + ". Add it manually in FX Rates.");
  }

  const payload = JSON.parse(response.getContentText());
  const rate = Number(payload.rates && payload.rates.USD);
  if (!rate) {
    throw new Error("FX response did not include CAD to USD for " + date + ".");
  }

  sheet.appendRow([date, rate, "frankfurter.app", new Date().toISOString()]);
  return rate;
}

function resultForBet_(bet, score, winningTeam) {
  if (bet.marketType === "moneyline") {
    return normalizeTeamName_(winningTeam) === normalizeTeamName_(bet.selectedTeam) ? "win" : "loss";
  }

  if (bet.marketType === "spread") {
    if (bet.marketLine === "" || bet.marketLine == null) return null;
    const selectedScore = scoreForTeam_(score, bet.selectedTeam);
    const opponentScore = opponentScoreForTeam_(score, bet.selectedTeam);
    if (selectedScore == null || opponentScore == null) return null;

    const adjustedMargin = selectedScore + Number(bet.marketLine) - opponentScore;
    if (linesEqual_(adjustedMargin, 0)) return "push";
    return adjustedMargin > 0 ? "win" : "loss";
  }

  if (bet.marketType === "total") {
    if (bet.marketLine === "" || bet.marketLine == null || !bet.totalSide) return null;
    const totalScore = score.scores.reduce(function (sum, teamScore) {
      return sum + Number(teamScore.score);
    }, 0);
    const margin = totalScore - Number(bet.marketLine);
    if (linesEqual_(margin, 0)) return "push";
    return String(bet.totalSide).toLowerCase() === "over" ? (margin > 0 ? "win" : "loss") : margin < 0 ? "win" : "loss";
  }

  return null;
}

function scoreForTeam_(score, team) {
  const row = score.scores.find(function (teamScore) {
    return normalizeTeamName_(teamScore.name) === normalizeTeamName_(team);
  });
  return row ? Number(row.score) : null;
}

function opponentScoreForTeam_(score, team) {
  const row = score.scores.find(function (teamScore) {
    return normalizeTeamName_(teamScore.name) !== normalizeTeamName_(team);
  });
  return row ? Number(row.score) : null;
}

function netUsdForResult_(bet, result, stakeUsd, payoutUsd, fxRate) {
  if (result === "push") return 0;
  if (result === "loss") return bet.betType === "bonus" ? 0 : -stakeUsd;
  if (bet.betType === "bonus") return convertToUsd_(Number(bet.winAmount), bet.currency, fxRate);
  return roundUsd_(payoutUsd - stakeUsd);
}

function convertToUsd_(amount, currency, fxRate) {
  return roundUsd_(currency === "CAD" ? amount * fxRate : amount);
}

function linesEqual_(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.0001;
}

function roundUsd_(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function latestBalance_(sheet, siteCode) {
  const rows = readObjects_(sheet).filter(function (row) { return row.siteCode === siteCode; });
  if (rows.length === 0) return 0;
  return Number(rows[rows.length - 1].runningBalanceUsd || 0);
}

function markSettledPairs_() {
  const cleanRows = readObjects_(SpreadsheetApp.getActive().getSheetByName(SHEETS.CLEAN));
  const settledPairIds = new Set(cleanRows.map(function (row) { return row.pairId; }));
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.MATCHED);
  const values = sheet.getDataRange().getValues();
  const statusColumn = MATCHED_HEADERS.indexOf("status") + 1;
  for (let row = 2; row <= values.length; row += 1) {
    const pairId = values[row - 1][0];
    if (settledPairIds.has(pairId)) {
      sheet.getRange(row, statusColumn).setValue("settled");
    }
  }
}

function validateBet_(bet) {
  const required = ["id", "siteCode", "siteName", "ticketId", "placedAt", "league", "marketType", "betType", "homeTeam", "awayTeam", "eventStartAt", "currency"];
  required.forEach(function (field) {
    if (bet[field] == null || bet[field] === "") throw new Error("Missing reviewed bet field: " + field);
  });
  if (["moneyline", "spread", "total"].indexOf(bet.marketType) === -1) throw new Error("Unsupported market type: " + bet.marketType);
  if ((bet.marketType === "moneyline" || bet.marketType === "spread") && !bet.selectedTeam) {
    throw new Error("selectedTeam is required for moneyline and spread bets.");
  }
  if ((bet.marketType === "spread" || bet.marketType === "total") && (bet.marketLine == null || bet.marketLine === "")) {
    throw new Error("marketLine is required for spread and total bets.");
  }
  if (bet.marketType === "total" && ["over", "under"].indexOf(String(bet.totalSide).toLowerCase()) === -1) {
    throw new Error("totalSide must be over or under for total bets.");
  }
  if (bet.marketType !== "total" && bet.totalSide) {
    throw new Error("totalSide is only allowed for total bets.");
  }
  if (bet.dateSource && ["explicit", "relative", "inferred"].indexOf(String(bet.dateSource)) === -1) {
    throw new Error("Unsupported dateSource: " + bet.dateSource);
  }
  if (!SPORT_KEYS[bet.league]) throw new Error("Unsupported league: " + bet.league);
  if (["USD", "CAD"].indexOf(bet.currency) === -1) throw new Error("Unsupported currency: " + bet.currency);
}

function gameKey_(bet) {
  if (bet.oddsApiEventId) return String(bet.league).toLowerCase() + ":event:" + bet.oddsApiEventId;
  const teams = [normalizeTeamName_(bet.homeTeam), normalizeTeamName_(bet.awayTeam)].sort();
  return String(bet.league).toLowerCase() + ":" + dateOnly_(bet.eventStartAt) + ":" + slug_(teams[0]) + ":" + slug_(teams[1]);
}

function normalizeTeamName_(team) {
  const compact = String(team || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const aliases = {
    "cle cavaliers": "cleveland cavaliers",
    "tor raptors": "toronto raptors",
    "min timberwolves": "minnesota timberwolves",
    "ny knicks": "new york knicks",
    "la lakers": "los angeles lakers",
    "la clippers": "los angeles clippers",
    "sf giants": "san francisco giants",
    "tb rays": "tampa bay rays",
    "kc chiefs": "kansas city chiefs",
    "tb buccaneers": "tampa bay buccaneers",
    "gb packers": "green bay packers",
    "ne patriots": "new england patriots",
    "lv raiders": "las vegas raiders",
    "la rams": "los angeles rams",
    "la kings": "los angeles kings",
    "tb lightning": "tampa bay lightning",
    "tor maple leafs": "toronto maple leafs",
    "mtl canadiens": "montreal canadiens",
    "ny rangers": "new york rangers",
    "ny islanders": "new york islanders"
  };
  return aliases[compact] || compact;
}

function dateOnly_(iso) {
  return String(iso).slice(0, 10);
}

function slug_(value) {
  return String(value).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

function ensureSheet_(name, headers) {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsHeaders = headers.some(function (header, index) { return current[index] !== header; });
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function seedSiteConfig_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.SITE_CONFIG);
  if (sheet.getLastRow() > 1) return;
  sheet.appendRow(["MBK", "MyBookie", "USD", "bonus_or_cash", true]);
  sheet.appendRow(["TSB", "theScore Bet", "CAD", "cash", true]);
}

function clearBody_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }
}

function readObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function (header) { return String(header); });
  return values.slice(1).filter(function (row) {
    return row.some(function (cell) { return cell !== ""; });
  }).map(function (row) {
    const object = {};
    headers.forEach(function (header, index) {
      object[header] = row[index];
    });
    return object;
  });
}

function indexBy_(rows, field) {
  return rows.reduce(function (index, row) {
    index[row[field]] = row;
    return index;
  }, {});
}

function assertSecret_(secret) {
  const expected = PropertiesService.getScriptProperties().getProperty("APPS_SCRIPT_SHARED_SECRET");
  if (!expected) throw new Error("Set APPS_SCRIPT_SHARED_SECRET in Apps Script properties.");
  if (secret !== expected) throw new Error("Invalid shared secret.");
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
