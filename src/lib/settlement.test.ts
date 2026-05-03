import { describe, expect, it } from "vitest";
import { settleMatchedPairs } from "./settlement";
import type { MatchedPair, ReviewedBet, ScoreEvent } from "./types";

describe("settleMatchedPairs", () => {
  it("creates running ledger entries when a matched game has a final score", () => {
    const bets: ReviewedBet[] = [
      {
        id: "mbk-1",
        sourceFile: "mbk.png",
        siteCode: "MBK",
        siteName: "MyBookie",
        ticketId: "294422281",
        placedAt: "2026-05-02T07:40:00.000Z",
        league: "NBA",
        marketType: "moneyline",
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
        confidence: 0.94
      },
      {
        id: "tsb-1",
        sourceFile: "tsb.png",
        siteCode: "TSB",
        siteName: "theScore Bet",
        ticketId: "zXK",
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
    ];
    const pair: MatchedPair = {
      id: "pair-1",
      status: "matched",
      gameKey: "nba:2026-05-03:cleveland-cavaliers:toronto-raptors",
      betIds: ["mbk-1", "tsb-1"],
      createdAt: "2026-05-02T08:00:00.000Z"
    };
    const score: ScoreEvent = {
      id: "odds-api-event",
      league: "NBA",
      completed: true,
      homeTeam: "Cleveland Cavaliers",
      awayTeam: "Toronto Raptors",
      commenceTime: "2026-05-03T23:30:00.000Z",
      scores: [
        { name: "Cleveland Cavaliers", score: 104 },
        { name: "Toronto Raptors", score: 99 }
      ]
    };

    const entries = settleMatchedPairs([pair], bets, [score], { "2026-05-02": 280 / 380 });

    expect(entries).toHaveLength(2);
    expect(entries.find((entry) => entry.betId === "tsb-1")?.netUsd).toBeCloseTo(96.55, 2);
    expect(entries.find((entry) => entry.betId === "mbk-1")?.netUsd).toBe(0);
  });

  it("settles spread wins, losses, and pushes from final scores", () => {
    const bets: ReviewedBet[] = [
      {
        id: "raptors-plus-5",
        sourceFile: "spread-a.png",
        siteCode: "MBK",
        siteName: "MyBookie",
        ticketId: "spread-a",
        placedAt: "2026-05-02T07:40:00.000Z",
        league: "NBA",
        marketType: "spread",
        marketLine: 5,
        betType: "cash",
        selectedTeam: "Toronto Raptors",
        homeTeam: "Cleveland Cavaliers",
        awayTeam: "Toronto Raptors",
        eventStartAt: "2026-05-03T23:30:00.000Z",
        oddsDecimal: 1.91,
        stakeAmount: 100,
        payoutAmount: 191,
        winAmount: 91,
        currency: "USD",
        confidence: 0.94
      },
      {
        id: "cavs-minus-5",
        sourceFile: "spread-b.png",
        siteCode: "TSB",
        siteName: "theScore Bet",
        ticketId: "spread-b",
        placedAt: "2026-05-02T07:40:00.000Z",
        league: "NBA",
        marketType: "spread",
        marketLine: -5,
        betType: "cash",
        selectedTeam: "CLE Cavaliers",
        homeTeam: "CLE Cavaliers",
        awayTeam: "TOR Raptors",
        eventStartAt: "2026-05-03T23:30:00.000Z",
        oddsDecimal: 1.91,
        stakeAmount: 100,
        payoutAmount: 191,
        winAmount: 91,
        currency: "USD",
        confidence: 0.94
      }
    ];
    const pair: MatchedPair = {
      id: "spread-pair",
      status: "matched",
      gameKey: "nba:2026-05-03:cleveland-cavaliers:toronto-raptors",
      marketType: "spread",
      marketLine: 5,
      betIds: ["raptors-plus-5", "cavs-minus-5"],
      createdAt: "2026-05-02T08:00:00.000Z"
    };
    const score: ScoreEvent = {
      id: "odds-api-event",
      league: "NBA",
      completed: true,
      homeTeam: "Cleveland Cavaliers",
      awayTeam: "Toronto Raptors",
      commenceTime: "2026-05-03T23:30:00.000Z",
      scores: [
        { name: "Cleveland Cavaliers", score: 104 },
        { name: "Toronto Raptors", score: 99 }
      ]
    };

    const entries = settleMatchedPairs([pair], bets, [score], { "2026-05-02": 1 });

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.result)).toEqual(["push", "push"]);
    expect(entries.map((entry) => entry.netUsd)).toEqual([0, 0]);
  });

  it("settles total over and under bets from combined final scores", () => {
    const bets: ReviewedBet[] = [
      {
        id: "over-205",
        sourceFile: "total-a.png",
        siteCode: "MBK",
        siteName: "MyBookie",
        ticketId: "total-a",
        placedAt: "2026-05-02T07:40:00.000Z",
        league: "NBA",
        marketType: "total",
        marketLine: 205.5,
        totalSide: "over",
        betType: "cash",
        selectedTeam: "",
        homeTeam: "Cleveland Cavaliers",
        awayTeam: "Toronto Raptors",
        eventStartAt: "2026-05-03T23:30:00.000Z",
        oddsDecimal: 1.91,
        stakeAmount: 100,
        payoutAmount: 191,
        winAmount: 91,
        currency: "USD",
        confidence: 0.94
      },
      {
        id: "under-205",
        sourceFile: "total-b.png",
        siteCode: "TSB",
        siteName: "theScore Bet",
        ticketId: "total-b",
        placedAt: "2026-05-02T07:40:00.000Z",
        league: "NBA",
        marketType: "total",
        marketLine: 205.5,
        totalSide: "under",
        betType: "cash",
        selectedTeam: "",
        homeTeam: "CLE Cavaliers",
        awayTeam: "TOR Raptors",
        eventStartAt: "2026-05-03T23:30:00.000Z",
        oddsDecimal: 1.91,
        stakeAmount: 100,
        payoutAmount: 191,
        winAmount: 91,
        currency: "USD",
        confidence: 0.94
      }
    ];
    const pair: MatchedPair = {
      id: "total-pair",
      status: "matched",
      gameKey: "nba:2026-05-03:cleveland-cavaliers:toronto-raptors",
      marketType: "total",
      marketLine: 205.5,
      betIds: ["over-205", "under-205"],
      createdAt: "2026-05-02T08:00:00.000Z"
    };
    const score: ScoreEvent = {
      id: "odds-api-event",
      league: "NBA",
      completed: true,
      homeTeam: "Cleveland Cavaliers",
      awayTeam: "Toronto Raptors",
      commenceTime: "2026-05-03T23:30:00.000Z",
      scores: [
        { name: "Cleveland Cavaliers", score: 104 },
        { name: "Toronto Raptors", score: 103 }
      ]
    };

    const entries = settleMatchedPairs([pair], bets, [score], { "2026-05-02": 1 });

    expect(entries.find((entry) => entry.betId === "over-205")?.result).toBe("win");
    expect(entries.find((entry) => entry.betId === "over-205")?.netUsd).toBe(91);
    expect(entries.find((entry) => entry.betId === "under-205")?.result).toBe("loss");
    expect(entries.find((entry) => entry.betId === "under-205")?.netUsd).toBe(-100);
  });
});
