import type { ExtractedBet } from "./types";

export function reviewedBetId(bet: ExtractedBet, index: number): string {
  const raw = [
    bet.siteCode,
    bet.ticketId,
    bet.selectedTeam,
    bet.eventStartAt,
    bet.sourceFile,
    index.toString()
  ].join("|");

  return `bet_${hashString(raw)}`;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}
