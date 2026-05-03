import { describe, expect, it } from "vitest";
import { matchMoneylinePairs, matchStraightBetPairs, normalizeTeamName } from "./matching";
import type { ReviewedBet } from "./types";

const baseBet = {
  league: "NBA",
  marketType: "moneyline" as const,
  placedAt: "2026-05-02T07:40:00.000Z",
  eventStartAt: "2026-05-03T23:30:00.000Z",
  homeTeam: "CLE Cavaliers",
  awayTeam: "TOR Raptors",
  currency: "USD" as const,
  oddsDecimal: 1.5,
  stakeAmount: 100,
  payoutAmount: 150,
  winAmount: 50,
  confidence: 0.9
};

describe("matching", () => {
  it("normalizes sportsbook team abbreviations to canonical names", () => {
    expect(normalizeTeamName("CLE Cavaliers")).toBe("cleveland cavaliers");
    expect(normalizeTeamName("Toronto Raptors")).toBe("toronto raptors");
  });

  it("creates the best opposite-side pair and leaves extras unmatched", () => {
    const bets: ReviewedBet[] = [
      {
        ...baseBet,
        id: "mbk-1",
        sourceFile: "mbk.png",
        siteCode: "MBK",
        siteName: "MyBookie",
        ticketId: "294422281",
        betType: "bonus",
        selectedTeam: "Toronto Raptors",
        stakeAmount: 0,
        payoutAmount: 374.4,
        winAmount: 374.4
      },
      {
        ...baseBet,
        id: "tsb-1",
        sourceFile: "tsb.png",
        siteCode: "TSB",
        siteName: "theScore Bet",
        ticketId: "zXK",
        betType: "cash",
        selectedTeam: "CLE Cavaliers",
        currency: "CAD",
        stakeAmount: 380,
        payoutAmount: 511.03,
        winAmount: 131.03
      },
      {
        ...baseBet,
        id: "tsb-extra",
        sourceFile: "tsb-extra.png",
        siteCode: "TSB",
        siteName: "theScore Bet",
        ticketId: "extra",
        betType: "cash",
        selectedTeam: "CLE Cavaliers",
        currency: "CAD",
        stakeAmount: 25,
        payoutAmount: 33.5,
        winAmount: 8.5
      }
    ];

    const result = matchMoneylinePairs(bets);

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].betIds.sort()).toEqual(["mbk-1", "tsb-1"]);
    expect(result.unmatched.map((bet) => bet.id)).toEqual(["tsb-extra"]);
  });

  it("pairs exact opposite spread lines and rejects different lines", () => {
    const bets: ReviewedBet[] = [
      {
        ...baseBet,
        id: "spread-a",
        sourceFile: "a.png",
        siteCode: "MBK",
        siteName: "MyBookie",
        ticketId: "spread-a",
        marketType: "spread",
        marketLine: 8,
        betType: "cash",
        selectedTeam: "Toronto Raptors"
      },
      {
        ...baseBet,
        id: "spread-b",
        sourceFile: "b.png",
        siteCode: "TSB",
        siteName: "theScore Bet",
        ticketId: "spread-b",
        marketType: "spread",
        marketLine: -8,
        betType: "cash",
        selectedTeam: "CLE Cavaliers"
      },
      {
        ...baseBet,
        id: "spread-different-line",
        sourceFile: "c.png",
        siteCode: "TSB",
        siteName: "theScore Bet",
        ticketId: "spread-c",
        marketType: "spread",
        marketLine: -7.5,
        betType: "cash",
        selectedTeam: "CLE Cavaliers"
      }
    ];

    const result = matchStraightBetPairs(bets);

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].betIds.sort()).toEqual(["spread-a", "spread-b"]);
    expect(result.unmatched.map((bet) => bet.id)).toEqual(["spread-different-line"]);
  });

  it("pairs exact-line opposite totals and rejects same-side totals", () => {
    const bets: ReviewedBet[] = [
      {
        ...baseBet,
        id: "over",
        sourceFile: "over.png",
        siteCode: "MBK",
        siteName: "MyBookie",
        ticketId: "over",
        marketType: "total",
        marketLine: 205.5,
        totalSide: "over",
        betType: "cash",
        selectedTeam: ""
      },
      {
        ...baseBet,
        id: "under",
        sourceFile: "under.png",
        siteCode: "TSB",
        siteName: "theScore Bet",
        ticketId: "under",
        marketType: "total",
        marketLine: 205.5,
        totalSide: "under",
        betType: "cash",
        selectedTeam: ""
      },
      {
        ...baseBet,
        id: "under-extra",
        sourceFile: "under-extra.png",
        siteCode: "ALT",
        siteName: "Alt Book",
        ticketId: "under-extra",
        marketType: "total",
        marketLine: 205.5,
        totalSide: "under",
        betType: "cash",
        selectedTeam: ""
      }
    ];

    const result = matchStraightBetPairs(bets);

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].betIds.sort()).toEqual(["over", "under"]);
    expect(result.unmatched.map((bet) => bet.id)).toEqual(["under-extra"]);
  });
});
