import { convertToUsd, roundUsd } from "./ledger";
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

      const result = resultForBet(bet, score, winningTeam);
      if (!result) {
        continue;
      }

      const stakeUsd = convertToUsd(bet.stakeAmount, bet.currency, fxRate);
      const payoutUsd = convertToUsd(bet.payoutAmount, bet.currency, fxRate);
      entries.push({
        pairId: pair.id,
        betId: bet.id,
        settledAt,
        siteCode: bet.siteCode,
        selectedTeam: bet.selectedTeam,
        winningTeam,
        result,
        stakeUsd,
        payoutUsd,
        netUsd: netUsdForResult(bet, result, stakeUsd, payoutUsd, fxRate),
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

function resultForBet(bet: ReviewedBet, score: ScoreEvent, winningTeam: string): CleanLedgerEntry["result"] | null {
  if (bet.marketType === "moneyline") {
    return normalizeTeamName(winningTeam) === normalizeTeamName(bet.selectedTeam) ? "win" : "loss";
  }

  if (bet.marketType === "spread") {
    if (bet.marketLine == null) {
      return null;
    }

    const selectedScore = scoreForTeam(score, bet.selectedTeam);
    const opponentScore = opponentScoreForTeam(score, bet.selectedTeam);
    if (selectedScore == null || opponentScore == null) {
      return null;
    }

    const adjustedMargin = selectedScore + bet.marketLine - opponentScore;
    if (isPush(adjustedMargin)) {
      return "push";
    }

    return adjustedMargin > 0 ? "win" : "loss";
  }

  if (bet.marketType === "total") {
    if (bet.marketLine == null || !bet.totalSide) {
      return null;
    }

    const totalScore = score.scores.reduce((sum, teamScore) => sum + teamScore.score, 0);
    const margin = totalScore - bet.marketLine;
    if (isPush(margin)) {
      return "push";
    }

    return bet.totalSide === "over" ? (margin > 0 ? "win" : "loss") : margin < 0 ? "win" : "loss";
  }

  return null;
}

function scoreForTeam(score: ScoreEvent, team: string): number | null {
  return score.scores.find((teamScore) => normalizeTeamName(teamScore.name) === normalizeTeamName(team))?.score ?? null;
}

function opponentScoreForTeam(score: ScoreEvent, team: string): number | null {
  return score.scores.find((teamScore) => normalizeTeamName(teamScore.name) !== normalizeTeamName(team))?.score ?? null;
}

function netUsdForResult(
  bet: ReviewedBet,
  result: CleanLedgerEntry["result"],
  stakeUsd: number,
  payoutUsd: number,
  fxRate: number
): number {
  if (result === "push") {
    return 0;
  }

  if (result === "loss") {
    return bet.betType === "bonus" ? 0 : -stakeUsd;
  }

  if (bet.betType === "bonus") {
    return convertToUsd(bet.winAmount, bet.currency, fxRate);
  }

  return roundUsd(payoutUsd - stakeUsd);
}

function isPush(value: number): boolean {
  return Math.abs(value) < 0.0001;
}
