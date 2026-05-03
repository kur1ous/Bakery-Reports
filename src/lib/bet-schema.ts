import { z } from "zod";
import type { ExtractedBetBatch, ReviewedBet } from "./types";

export const currencySchema = z.enum(["USD", "CAD"]);
export const leagueSchema = z.enum(["NBA", "NFL", "MLB", "NHL"]);
export const betTypeSchema = z.enum(["cash", "bonus"]);
export const marketTypeSchema = z.enum(["moneyline", "spread", "total"]);
export const totalSideSchema = z.enum(["over", "under"]);
const dateTimeSchema = z.preprocess(normalizeDateTimeInput, z.string().datetime());
const marketLineSchema = z.preprocess(normalizeNumberInput, z.number().finite()).nullable().optional();

export const extractedBetSchema = z.object({
  sourceFile: z.string().min(1),
  siteCode: z.string().trim().min(1).max(16).transform((value) => value.toUpperCase()),
  siteName: z.string().trim().min(1),
  ticketId: z.string().trim().min(1),
  placedAt: dateTimeSchema,
  league: leagueSchema,
  marketType: marketTypeSchema,
  marketLine: marketLineSchema,
  totalSide: totalSideSchema.nullable().optional(),
  betType: betTypeSchema,
  selectedTeam: z.string().trim(),
  homeTeam: z.string().trim().min(1),
  awayTeam: z.string().trim().min(1),
  eventStartAt: dateTimeSchema,
  oddsDecimal: z.number().positive(),
  stakeAmount: z.number().min(0),
  payoutAmount: z.number().min(0),
  winAmount: z.number().min(0),
  currency: currencySchema,
  confidence: z.number().min(0).max(1),
  oddsApiEventId: z.string().trim().min(1).nullable().optional(),
  notes: z.string().nullable().optional()
}).superRefine((bet, context) => {
  if ((bet.marketType === "moneyline" || bet.marketType === "spread") && !bet.selectedTeam) {
    context.addIssue({
      code: "custom",
      path: ["selectedTeam"],
      message: "selectedTeam is required for moneyline and spread bets."
    });
  }

  if ((bet.marketType === "spread" || bet.marketType === "total") && bet.marketLine == null) {
    context.addIssue({
      code: "custom",
      path: ["marketLine"],
      message: "marketLine is required for spread and total bets."
    });
  }

  if (bet.marketType === "total" && !bet.totalSide) {
    context.addIssue({
      code: "custom",
      path: ["totalSide"],
      message: "totalSide is required for total bets."
    });
  }

  if (bet.marketType !== "total" && bet.totalSide) {
    context.addIssue({
      code: "custom",
      path: ["totalSide"],
      message: "totalSide is only allowed for total bets."
    });
  }
});

export const extractedBetBatchSchema = z.object({
  sourceFile: z.string().min(1),
  extractedAt: dateTimeSchema,
  bets: z.array(extractedBetSchema).min(1)
});

export const reviewedBetSchema = extractedBetSchema.extend({
  id: z.string().trim().min(1)
});

export const reviewedBetsSchema = z.array(reviewedBetSchema).min(1);

export function parseExtractedBetBatch(input: unknown): ExtractedBetBatch {
  const parsed = extractedBetBatchSchema.safeParse(input);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid bet extraction. V1 only supports straight moneyline, spread, and total bets. ${details}`);
  }

  return parsed.data;
}

export function parseReviewedBets(input: unknown): ReviewedBet[] {
  const parsed = reviewedBetsSchema.safeParse(input);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid reviewed bets. ${details}`);
  }

  return parsed.data;
}

export const geminiExtractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sourceFile", "extractedAt", "bets"],
  properties: {
    sourceFile: { type: "string" },
    extractedAt: { type: "string", description: "ISO 8601 timestamp for extraction time." },
    bets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "sourceFile",
          "siteCode",
          "siteName",
          "ticketId",
          "placedAt",
          "league",
          "marketType",
          "betType",
          "selectedTeam",
          "homeTeam",
          "awayTeam",
          "eventStartAt",
          "oddsDecimal",
          "stakeAmount",
          "payoutAmount",
          "winAmount",
          "currency",
          "confidence"
        ],
        properties: {
          sourceFile: { type: "string" },
          siteCode: { type: "string", description: "Short sportsbook code, e.g. MBK or TSB." },
          siteName: { type: "string" },
          ticketId: { type: "string" },
          placedAt: { type: "string", description: "ISO 8601 timestamp. Infer timezone from screenshot when visible." },
          league: { type: "string", enum: ["NBA", "NFL", "MLB", "NHL"] },
          marketType: { type: "string", enum: ["moneyline", "spread", "total"] },
          marketLine: {
            type: ["number", "null"],
            description: "Spread line for spread bets, or total points line for over/under bets. Null for moneyline."
          },
          totalSide: {
            type: ["string", "null"],
            enum: ["over", "under", null],
            description: "Use over or under for total bets. Null for moneyline and spread."
          },
          betType: { type: "string", enum: ["cash", "bonus"] },
          selectedTeam: { type: "string" },
          homeTeam: { type: "string" },
          awayTeam: { type: "string" },
          eventStartAt: { type: "string", description: "ISO 8601 game start timestamp." },
          oddsDecimal: { type: "number" },
          stakeAmount: { type: "number" },
          payoutAmount: { type: "number" },
          winAmount: { type: "number" },
          currency: { type: "string", enum: ["USD", "CAD"] },
          confidence: { type: "number" },
          oddsApiEventId: { type: ["string", "null"] },
          notes: { type: ["string", "null"] }
        }
      }
    }
  }
} as const;

function normalizeNumberInput(value: unknown): unknown {
  if (typeof value === "number" || value == null) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().replace(/^[OU]\s*/i, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : value;
}

function normalizeDateTimeInput(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  const normalizedText = trimmed.replace(/\s+at\s+/i, " ");
  const parsedLocalParts = parseLocalDateTimeParts(normalizedText);
  if (parsedLocalParts) {
    return torontoLocalDateTimeToUtcIso(parsedLocalParts);
  }

  const parsed = Date.parse(normalizedText);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toISOString();
}

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function parseLocalDateTimeParts(value: string): LocalDateTimeParts | null {
  const isoMatch = value.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i
  );

  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
      hour: hour24(isoMatch[4] ? Number(isoMatch[4]) : 0, isoMatch[7]),
      minute: isoMatch[5] ? Number(isoMatch[5]) : 0,
      second: isoMatch[6] ? Number(isoMatch[6]) : 0
    };
  }

  const monthMatch = value.match(
    /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i
  );

  if (!monthMatch) {
    return null;
  }

  return {
    year: Number(monthMatch[3]),
    month: monthNumber(monthMatch[1]),
    day: Number(monthMatch[2]),
    hour: hour24(monthMatch[4] ? Number(monthMatch[4]) : 0, monthMatch[7]),
    minute: monthMatch[5] ? Number(monthMatch[5]) : 0,
    second: monthMatch[6] ? Number(monthMatch[6]) : 0
  };
}

function hour24(hour: number, meridiem?: string): number {
  if (!meridiem) {
    return hour;
  }

  const upper = meridiem.toUpperCase();
  if (upper === "AM") {
    return hour === 12 ? 0 : hour;
  }

  return hour === 12 ? 12 : hour + 12;
}

function monthNumber(value: string): number {
  const prefix = value.slice(0, 3).toLowerCase();
  return ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(prefix) + 1;
}

function torontoLocalDateTimeToUtcIso(parts: LocalDateTimeParts): string {
  const initialUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const firstOffset = torontoOffsetMinutes(new Date(initialUtc));
  const adjustedUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - firstOffset * 60_000;
  const secondOffset = torontoOffsetMinutes(new Date(adjustedUtc));

  if (firstOffset !== secondOffset) {
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - secondOffset * 60_000).toISOString();
  }

  return new Date(adjustedUtc).toISOString();
}

function torontoOffsetMinutes(date: Date): number {
  const offsetPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    timeZoneName: "shortOffset"
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  const match = offsetPart?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) {
    return -240;
  }

  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}
