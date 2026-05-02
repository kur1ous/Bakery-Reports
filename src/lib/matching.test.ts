import { describe, expect, it } from "vitest";
import { matchMoneylinePairs, normalizeTeamName } from "./matching";
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
});
