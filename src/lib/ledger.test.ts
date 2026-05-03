import { describe, expect, it } from "vitest";
import { convertToUsd, settleBetNetUsd } from "./ledger";

describe("ledger money math", () => {
  it("converts CAD to stable USD using the stored daily FX rate", () => {
    expect(convertToUsd(380, "CAD", 0.7368421053)).toBeCloseTo(280, 2);
    expect(convertToUsd(374.4, "USD", 0.7368421053)).toBe(374.4);
  });

  it("settles cash and bonus/free-play bets with different loss behavior", () => {
    const fxRate = 280 / 380;

    expect(
      settleBetNetUsd(
        { betType: "cash", currency: "CAD", stakeAmount: 380, payoutAmount: 511.03, winAmount: 131.03 },
        "CLE Cavaliers",
        "CLE Cavaliers",
        fxRate
      )
    ).toBeCloseTo(96.55, 2);

    expect(
      settleBetNetUsd(
        { betType: "cash", currency: "CAD", stakeAmount: 380, payoutAmount: 511.03, winAmount: 131.03 },
        "TOR Raptors",
        "CLE Cavaliers",
        fxRate
      )
    ).toBeCloseTo(-280, 2);

    expect(
      settleBetNetUsd(
        { betType: "bonus", currency: "USD", stakeAmount: 0, payoutAmount: 374.4, winAmount: 374.4 },
        "TOR Raptors",
        "TOR Raptors",
        fxRate
      )
    ).toBeCloseTo(374.4, 2);

    expect(
      settleBetNetUsd(
        { betType: "bonus", currency: "USD", stakeAmount: 0, payoutAmount: 374.4, winAmount: 374.4 },
        "CLE Cavaliers",
        "TOR Raptors",
        fxRate
      )
    ).toBe(0);
  });
});
