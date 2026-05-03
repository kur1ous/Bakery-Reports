export type Currency = "USD" | "CAD";
export type BetType = "cash" | "bonus";
export type MarketType = "moneyline" | "spread" | "total";
export type TotalSide = "over" | "under";
export type DateSource = "explicit" | "relative" | "inferred";
export type League = "NBA" | "NFL" | "MLB" | "NHL";

export interface ExtractedBet {
  sourceFile: string;
  siteCode: string;
  siteName: string;
  ticketId: string;
  placedAt: string;
  league: League;
  marketType: MarketType;
  marketLine?: number | null;
  totalSide?: TotalSide | null;
  betType: BetType;
  selectedTeam: string;
  homeTeam: string;
  awayTeam: string;
  eventStartAt: string;
  dateSource: DateSource;
  oddsDecimal: number;
  stakeAmount: number;
  payoutAmount: number;
  winAmount: number;
  currency: Currency;
  confidence: number;
  oddsApiEventId?: string | null;
  notes?: string | null;
}

export interface ExtractedBetBatch {
  sourceFile: string;
  extractedAt: string;
  bets: ExtractedBet[];
}

export interface ReviewedBet extends ExtractedBet {
  id: string;
}

export interface MatchedPair {
  id: string;
  status: "matched" | "settled";
  gameKey: string;
  marketType?: MarketType;
  marketLine?: number | null;
  betIds: [string, string] | string[];
  createdAt: string;
  oddsApiEventId?: string | null;
}

export interface MatchResult {
  pairs: MatchedPair[];
  unmatched: ReviewedBet[];
}

export interface ScoreEvent {
  id: string;
  league: League;
  completed: boolean;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  scores: Array<{ name: string; score: number }>;
}

export interface CleanLedgerEntry {
  pairId: string;
  betId: string;
  settledAt: string;
  siteCode: string;
  selectedTeam: string;
  winningTeam: string;
  result: "win" | "loss" | "push";
  stakeUsd: number;
  payoutUsd: number;
  netUsd: number;
  currency: Currency;
  fxRate: number;
}
