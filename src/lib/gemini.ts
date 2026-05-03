import { GoogleGenAI } from "@google/genai";
import { geminiExtractionJsonSchema, parseExtractedBetBatch } from "./bet-schema";
import type { ExtractedBetBatch } from "./types";

const EXTRACTION_PROMPT = `Extract confirmed open straight bets from this sportsbook screenshot.

Rules:
- Return only bets that are confirmed/accepted/open in the screenshot.
- V1 supports only straight moneyline, spread, and total bets for NBA, NFL, MLB, and NHL. Ignore parlays, props, promos, and navigation odds.
- Set marketType to "moneyline", "spread", or "total".
- For spread bets, set selectedTeam to the spread side and marketLine to the signed line from that side, e.g. Toronto +8 = 8 and Cleveland -8 = -8.
- For total bets, set totalSide to "over" or "under", marketLine to the points total, and selectedTeam to an empty string.
- For moneyline bets, set marketLine and totalSide to null.
- Preserve the sportsbook ticket ID if visible.
- Use decimal odds. If odds are American, convert them to decimal.
- Use CAD or USD based on the sportsbook/account display and any visible currency context.
- For free play/bonus bets, set betType to "bonus", stakeAmount to the real-money risk visible in the ticket, and winAmount to the amount credited if it wins.
- For cash bets, set betType to "cash", stakeAmount to the cash stake, payoutAmount to total potential payout, and winAmount to payout minus stake.
- Convert all dates to ISO 8601. If timezone is ambiguous, use America/Toronto.
- Set dateSource to "explicit" when the screenshot shows a calendar date, "relative" when it says Today/Tomorrow/etc., and "inferred" when you must infer the date from context.
- For relative event dates such as Today or Tomorrow, use the screenshot capture date if visible in the image. If the actual calendar date is not visible, make the best ISO estimate and add a notes warning that the event date must be confirmed before matching.
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
