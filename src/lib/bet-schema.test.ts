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
    expect(result.bets[0].dateSource).toBe("explicit");
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

  it("uses the current year for numeric screenshot dates without a year", () => {
    const result = parseExtractedBetBatch({
      sourceFile: "yearless-dates.png",
      extractedAt: "2026-03-31T20:37:00.000Z",
      bets: [
        {
          sourceFile: "yearless-dates.png",
          siteCode: "CBT",
          siteName: "Cloudbet",
          ticketId: "4775768218",
          placedAt: "31/03 16:37",
          league: "NBA",
          marketType: "moneyline",
          betType: "bonus",
          selectedTeam: "TOR Raptors",
          homeTeam: "DET Pistons",
          awayTeam: "TOR Raptors",
          eventStartAt: "03/31 08:00 PM",
          dateSource: "inferred",
          oddsDecimal: 2.4,
          stakeAmount: 75,
          payoutAmount: 180,
          winAmount: 105,
          currency: "USD",
          confidence: 0.85
        }
      ]
    });

    expect(result.bets[0].placedAt).toBe("2026-03-31T20:37:00.000Z");
    expect(result.bets[0].eventStartAt).toBe("2026-04-01T00:00:00.000Z");
    expect(result.bets[0].dateSource).toBe("inferred");
  });

  it("accepts straight spread and total extraction rows with required line fields", () => {
    const result = parseExtractedBetBatch({
      sourceFile: "markets.png",
      extractedAt: "2026-05-02T07:45:00.000Z",
      bets: [
        {
          sourceFile: "markets.png",
          siteCode: "MBK",
          siteName: "MyBookie",
          ticketId: "spread-ticket",
          placedAt: "2026-05-02T07:40:00.000Z",
          league: "NBA",
          marketType: "spread",
          marketLine: 8,
          betType: "cash",
          selectedTeam: "Philadelphia 76ers",
          homeTeam: "Boston Celtics",
          awayTeam: "Philadelphia 76ers",
          eventStartAt: "2026-05-03T23:30:00.000Z",
          oddsDecimal: 1.91,
          stakeAmount: 100,
          payoutAmount: 191,
          winAmount: 91,
          currency: "USD",
          confidence: 0.91
        },
        {
          sourceFile: "markets.png",
          siteCode: "TSB",
          siteName: "theScore Bet",
          ticketId: "total-ticket",
          placedAt: "2026-05-02T07:41:00.000Z",
          league: "NBA",
          marketType: "total",
          marketLine: 205.5,
          totalSide: "under",
          betType: "cash",
          selectedTeam: "",
          homeTeam: "Boston Celtics",
          awayTeam: "Philadelphia 76ers",
          eventStartAt: "2026-05-03T23:30:00.000Z",
          oddsDecimal: 1.91,
          stakeAmount: 100,
          payoutAmount: 191,
          winAmount: 91,
          currency: "CAD",
          confidence: 0.91
        }
      ]
    });

    expect(result.bets.map((bet) => bet.marketType)).toEqual(["spread", "total"]);
    expect(result.bets[1].totalSide).toBe("under");
  });

  it("rejects spread and total rows missing required line fields", () => {
    expect(() =>
      parseExtractedBetBatch({
        sourceFile: "bad-total.png",
        extractedAt: "2026-05-02T07:45:00.000Z",
        bets: [
          {
            sourceFile: "bad-total.png",
            siteCode: "TSB",
            siteName: "theScore Bet",
            ticketId: "bad-total",
            placedAt: "2026-05-02T07:41:00.000Z",
            league: "NBA",
            marketType: "total",
            betType: "cash",
            selectedTeam: "",
            homeTeam: "Boston Celtics",
            awayTeam: "Philadelphia 76ers",
            eventStartAt: "2026-05-03T23:30:00.000Z",
            oddsDecimal: 1.91,
            stakeAmount: 100,
            payoutAmount: 191,
            winAmount: 91,
            currency: "CAD",
            confidence: 0.91
          }
        ]
      })
    ).toThrow(/marketLine|totalSide/i);
  });

  it("accepts relative event date source rows for manual review", () => {
    const result = parseExtractedBetBatch({
      sourceFile: "cloudbet-today.png",
      extractedAt: "2026-04-01T15:15:00.000Z",
      bets: [
        {
          sourceFile: "cloudbet-today.png",
          siteCode: "CBT",
          siteName: "Cloudbet",
          ticketId: "cloudbet-active",
          placedAt: "2026-04-01T15:15:00.000Z",
          league: "NBA",
          marketType: "moneyline",
          betType: "cash",
          selectedTeam: "BOS Celtics",
          homeTeam: "BOS Celtics",
          awayTeam: "MIA Heat",
          eventStartAt: "2026-04-01T23:30:00.000Z",
          dateSource: "relative",
          oddsDecimal: 1.52,
          stakeAmount: 260,
          payoutAmount: 395.2,
          winAmount: 135.2,
          currency: "USD",
          confidence: 0.82,
          notes: "Cloudbet showed Today; confirm event date before matching."
        }
      ]
    });

    expect(result.bets[0].dateSource).toBe("relative");
    expect(result.bets[0].notes).toMatch(/confirm event date/i);
  });

  it("rejects unsupported date source values", () => {
    expect(() =>
      parseExtractedBetBatch({
        sourceFile: "bad-date-source.png",
        extractedAt: "2026-04-01T15:15:00.000Z",
        bets: [
          {
            sourceFile: "bad-date-source.png",
            siteCode: "CBT",
            siteName: "Cloudbet",
            ticketId: "cloudbet-active",
            placedAt: "2026-04-01T15:15:00.000Z",
            league: "NBA",
            marketType: "moneyline",
            betType: "cash",
            selectedTeam: "BOS Celtics",
            homeTeam: "BOS Celtics",
            awayTeam: "MIA Heat",
            eventStartAt: "2026-04-01T23:30:00.000Z",
            dateSource: "today",
            oddsDecimal: 1.52,
            stakeAmount: 260,
            payoutAmount: 395.2,
            winAmount: 135.2,
            currency: "USD",
            confidence: 0.82
          }
        ]
      })
    ).toThrow(/dateSource/i);
  });

  it("rejects unsupported markets for v1", () => {
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
            marketType: "parlay",
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
    ).toThrow(/moneyline, spread, and total/i);
  });
});
