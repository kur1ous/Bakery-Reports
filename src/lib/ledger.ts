import type { Currency, BetType } from "./types";
import { normalizeTeamName } from "./matching";

export interface SettlementAmounts {
  betType: BetType;
  currency: Currency;
  stakeAmount: number;
  payoutAmount: number;
  winAmount: number;
}

export function roundUsd(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function convertToUsd(amount: number, currency: Currency, cadToUsdRate: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Amount must be a non-negative finite number.");
  }

  if (currency === "USD") {
    return roundUsd(amount);
  }

  if (!Number.isFinite(cadToUsdRate) || cadToUsdRate <= 0) {
    throw new Error("CAD to USD rate must be a positive finite number.");
  }

  return roundUsd(amount * cadToUsdRate);
}

export function settleBetNetUsd(
  bet: SettlementAmounts,
  winningTeam: string,
  selectedTeam: string,
  cadToUsdRate: number
): number {
  const didWin = canonicalTeam(winningTeam) === canonicalTeam(selectedTeam);

  if (!didWin) {
    return bet.betType === "bonus" ? 0 : -convertToUsd(bet.stakeAmount, bet.currency, cadToUsdRate);
  }

  if (bet.betType === "bonus") {
    return convertToUsd(bet.winAmount, bet.currency, cadToUsdRate);
  }

  return roundUsd(
    convertToUsd(bet.payoutAmount, bet.currency, cadToUsdRate) -
      convertToUsd(bet.stakeAmount, bet.currency, cadToUsdRate)
  );
}

function canonicalTeam(value: string): string {
  return normalizeTeamName(value);
}
