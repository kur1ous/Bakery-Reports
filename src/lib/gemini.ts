import { GoogleGenAI } from "@google/genai";
import { geminiExtractionJsonSchema, parseExtractedBetBatch } from "./bet-schema";
import type { ExtractedBetBatch } from "./types";

const EXTRACTION_PROMPT = `Extract confirmed open straight moneyline bets from this sportsbook screenshot.

Rules:
- Return only bets that are confirmed/accepted/open in the screenshot.
- V1 supports only straight moneyline bets for NBA, NFL, MLB, and NHL. Ignore spreads, totals, parlays, props, promos, and navigation odds.
- Preserve the sportsbook ticket ID if visible.
- Use decimal odds. If odds are American, convert them to decimal.
- Use CAD or USD based on the sportsbook/account display and any visible currency context.
- For free play/bonus bets, set betType to "bonus", stakeAmount to the real-money risk visible in the ticket, and winAmount to the amount credited if it wins.
- For cash bets, set betType to "cash", stakeAmount to the cash stake, payoutAmount to total potential payout, and winAmount to payout minus stake.
- Convert all dates to ISO 8601. If timezone is ambiguous, use America/Toronto.
- If a team is abbreviated in the screenshot, keep the visible text; downstream matching normalizes common aliases.
- If no supported bet is visible, return an empty bets array.`;

export async function extractBetsWithGemini(input: {
  sourceFile: string;
  mimeType: string;
  base64: string;
}): Promise<ExtractedBetBatch> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        inlineData: {
          mimeType: input.mimeType,
          data: input.base64
        }
      },
      {
        text: `${EXTRACTION_PROMPT}\n\nsourceFile: ${input.sourceFile}`
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: geminiExtractionJsonSchema
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty extraction response.");
  }

  const parsed = parseExtractedBetBatch(JSON.parse(text));
  return {
    ...parsed,
    sourceFile: parsed.sourceFile || input.sourceFile,
    bets: parsed.bets.map((bet) => ({ ...bet, sourceFile: bet.sourceFile || input.sourceFile }))
  };
}
