import { convertToUsd, settleBetNetUsd } from "./ledger";
import { gameKeyForBet, normalizeTeamName } from "./matching";
import type { CleanLedgerEntry, MatchedPair, ReviewedBet, ScoreEvent } from "./types";

export function settleMatchedPairs(
  pairs: MatchedPair[],
  bets: ReviewedBet[],
  scores: ScoreEvent[],
  fxRatesByDate: Record<string, number>,
  settledAt = new Date().toISOString()
): CleanLedgerEntry[] {
  const betsById = new Map(bets.map((bet) => [bet.id, bet]));
  const entries: CleanLedgerEntry[] = [];

  for (const pair of pairs) {
    const pairBets = pair.betIds.map((id) => betsById.get(id)).filter(Boolean) as ReviewedBet[];
    if (pairBets.length !== 2) {
      continue;
    }

    const score = findScoreForPair(pair, pairBets[0], scores);
    if (!score || !score.completed) {
      continue;
    }

    const winningTeam = winningTeamFromScore(score);
    if (!winningTeam) {
      continue;
    }

    for (const bet of pairBets) {
      const placedDate = bet.placedAt.slice(0, 10);
      const fxRate = bet.currency === "CAD" ? fxRatesByDate[placedDate] : 1;
      if (!fxRate) {
        continue;
      }

      const result = normalizeTeamName(winningTeam) === normalizeTeamName(bet.selectedTeam) ? "win" : "loss";
      entries.push({
        pairId: pair.id,
        betId: bet.id,
        settledAt,
        siteCode: bet.siteCode,
        selectedTeam: bet.selectedTeam,
        winningTeam,
        result,
        stakeUsd: convertToUsd(bet.stakeAmount, bet.currency, fxRate),
        payoutUsd: convertToUsd(bet.payoutAmount, bet.currency, fxRate),
        netUsd: settleBetNetUsd(bet, winningTeam, bet.selectedTeam, fxRate),
        currency: bet.currency,
        fxRate
      });
    }
  }

  return entries;
}

function findScoreForPair(pair: MatchedPair, bet: ReviewedBet, scores: ScoreEvent[]): ScoreEvent | undefined {
  if (pair.oddsApiEventId) {
    const byId = scores.find((score) => score.id === pair.oddsApiEventId);
    if (byId) {
      return byId;
    }
  }

  return scores.find((score) => {
    const fakeBet = {
      league: score.league,
      eventStartAt: score.commenceTime,
      homeTeam: score.homeTeam,
      awayTeam: score.awayTeam,
      oddsApiEventId: null
    };
    return gameKeyForBet(fakeBet) === gameKeyForBet(bet);
  });
}

function winningTeamFromScore(score: ScoreEvent): string | null {
  if (score.scores.length < 2) {
    return null;
  }

  const [first, second] = score.scores;
  if (first.score === second.score) {
    return null;
  }

  return first.score > second.score ? first.name : second.name;
}
