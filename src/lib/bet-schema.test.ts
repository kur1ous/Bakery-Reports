import { describe, expect, it } from "vitest";
import { parseExtractedBetBatch } from "./bet-schema";

describe("parseExtractedBetBatch", () => {
  it("accepts a straight moneyline screenshot extraction", () => {
    const result = parseExtractedBetBatch({
      sourceFile: "the-score-open-bets.png",
      extractedAt: "2026-05-02T07:45:00.000Z",
      bets: [
        {
          sourceFile: "the-score-open-bets.png",
          siteCode: "TSB",
          siteName: "theScore Bet",
          ticketId: "zXKHFRsIBu8SzrIMGREumHgAfWU=",
          placedAt: "2026-05-02T07:39:00.000Z",
          league: "NBA",
          marketType: "moneyline",
          betType: "cash",
          selectedTeam: "CLE Cavaliers",
          homeTeam: "CLE Cavaliers",
          awayTeam: "TOR Raptors",
          eventStartAt: "2026-05-03T23:30:00.000Z",
          oddsDecimal: 1.34,
          stakeAmount: 380,
          payoutAmount: 511.03,
          winAmount: 131.03,
          currency: "CAD",
          confidence: 0.94
        }
      ]
    });

    expect(result.bets).toHaveLength(1);
    expect(result.bets[0].marketType).toBe("moneyline");
  });

  it("normalizes common screenshot date strings before validation", () => {
    const result = parseExtractedBetBatch({
      sourceFile: "myb.jpg",
      extractedAt: "2026-05-02T07:45:00.000Z",
      bets: [
        {
          sourceFile: "myb.jpg",
          siteCode: "MBK",
          siteName: "MyBookie",
          ticketId: "294422281",
          placedAt: "2026-05-02",
          league: "NBA",
          marketType: "moneyline",
          betType: "bonus",
          selectedTeam: "Toronto Raptors",
          homeTeam: "Cleveland Cavaliers",
          awayTeam: "Toronto Raptors",
          eventStartAt: "May 3, 2026 at 7:30 PM",
          oddsDecimal: 3.88,
          stakeAmount: 0,
          payoutAmount: 374.4,
          winAmount: 374.4,
          currency: "USD",
          confidence: 0.9
        }
      ]
    });

    expect(result.bets[0].placedAt).toMatch(/^2026-05-02T/);
    expect(result.bets[0].eventStartAt).toBe("2026-05-03T23:30:00.000Z");
  });

  it("rejects non-moneyline markets for v1", () => {
    expect(() =>
      parseExtractedBetBatch({
        sourceFile: "spread.png",
        extractedAt: "2026-05-02T07:45:00.000Z",
        bets: [
          {
            sourceFile: "spread.png",
            siteCode: "MBK",
            siteName: "MyBookie",
            ticketId: "294422281",
            placedAt: "2026-05-02T07:40:00.000Z",
            league: "NBA",
            marketType: "spread",
            betType: "bonus",
            selectedTeam: "Toronto Raptors",
            homeTeam: "Cleveland Cavaliers",
            awayTeam: "Toronto Raptors",
            eventStartAt: "2026-05-03T23:30:00.000Z",
            oddsDecimal: 3.88,
            stakeAmount: 0,
            payoutAmount: 374.4,
            winAmount: 374.4,
            currency: "USD",
            confidence: 0.9
          }
        ]
      })
    ).toThrow(/moneyline/i);
  });
});
