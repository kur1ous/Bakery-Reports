import type { MatchedPair, MatchResult, ReviewedBet } from "./types";

const TEAM_ALIASES: Record<string, string> = {
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

export function normalizeTeamName(team: string): string {
  const compact = team
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");

  return TEAM_ALIASES[compact] ?? compact;
}

export function gameKeyForBet(bet: Pick<ReviewedBet, "league" | "eventStartAt" | "homeTeam" | "awayTeam" | "oddsApiEventId">): string {
  if (bet.oddsApiEventId) {
    return `${bet.league.toLowerCase()}:event:${bet.oddsApiEventId}`;
  }

  const date = bet.eventStartAt.slice(0, 10);
  const teams = [normalizeTeamName(bet.homeTeam), normalizeTeamName(bet.awayTeam)].sort();
  return `${bet.league.toLowerCase()}:${date}:${slug(teams[0])}:${slug(teams[1])}`;
}

export function matchMoneylinePairs(bets: ReviewedBet[], nowIso = new Date().toISOString()): MatchResult {
  return matchStraightBetPairs(bets.filter((bet) => bet.marketType === "moneyline"), nowIso);
}

export function matchStraightBetPairs(bets: ReviewedBet[], nowIso = new Date().toISOString()): MatchResult {
  const candidates = bets.filter(isSupportedStraightBet);
  const used = new Set<string>();
  const pairs: MatchedPair[] = [];

  for (const bet of candidates) {
    if (used.has(bet.id)) {
      continue;
    }

    const possibleMatches = candidates
      .filter((candidate) => !used.has(candidate.id))
      .filter((candidate) => candidate.id !== bet.id)
      .filter((candidate) => candidate.siteCode !== bet.siteCode)
      .filter((candidate) => gameKeyForBet(candidate) === gameKeyForBet(bet))
      .filter((candidate) => isPairMatch(bet, candidate))
      .sort((a, b) => pairScore(bet, a) - pairScore(bet, b));

    const match = possibleMatches[0];
    if (!match) {
      continue;
    }

    used.add(bet.id);
    used.add(match.id);
    pairs.push({
      id: `pair_${pairs.length + 1}_${slug(gameKeyForBet(bet))}`,
      status: "matched",
      gameKey: gameKeyForBet(bet),
      marketType: bet.marketType,
      marketLine: matchedMarketLine(bet),
      betIds: [bet.id, match.id],
      createdAt: nowIso,
      oddsApiEventId: bet.oddsApiEventId ?? match.oddsApiEventId ?? null
    });
  }

  return {
    pairs,
    unmatched: candidates.filter((bet) => !used.has(bet.id))
  };
}

function isSupportedStraightBet(bet: ReviewedBet): boolean {
  if (bet.marketType === "moneyline") {
    return Boolean(bet.selectedTeam);
  }

  if (bet.marketType === "spread") {
    return Boolean(bet.selectedTeam) && bet.marketLine != null;
  }

  return bet.marketType === "total" && bet.marketLine != null && Boolean(bet.totalSide);
}

function isPairMatch(bet: ReviewedBet, candidate: ReviewedBet): boolean {
  if (candidate.marketType !== bet.marketType) {
    return false;
  }

  if (bet.marketType === "moneyline") {
    return normalizeTeamName(candidate.selectedTeam) !== normalizeTeamName(bet.selectedTeam);
  }

  if (bet.marketType === "spread") {
    return (
      normalizeTeamName(candidate.selectedTeam) !== normalizeTeamName(bet.selectedTeam) &&
      bet.marketLine != null &&
      candidate.marketLine != null &&
      linesEqual(bet.marketLine + candidate.marketLine, 0)
    );
  }

  return (
    bet.marketLine != null &&
    candidate.marketLine != null &&
    linesEqual(bet.marketLine, candidate.marketLine) &&
    bet.totalSide != null &&
    candidate.totalSide != null &&
    bet.totalSide !== candidate.totalSide
  );
}

function matchedMarketLine(bet: ReviewedBet): number | null {
  if (bet.marketLine == null) {
    return null;
  }

  return bet.marketType === "spread" ? Math.abs(bet.marketLine) : bet.marketLine;
}

function linesEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001;
}

function pairScore(a: ReviewedBet, b: ReviewedBet): number {
  return Math.abs(a.payoutAmount - b.payoutAmount);
}

function slug(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}
