import { NextRequest } from "next/server";
import { verifyAppPassword } from "@/lib/auth";
import { parseReviewedBets } from "@/lib/bet-schema";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authError = verifyAppPassword(request);
  if (authError) {
    return authError;
  }

  const webAppUrl = process.env.APPS_SCRIPT_WEBAPP_URL;
  const sharedSecret = process.env.APPS_SCRIPT_SHARED_SECRET;

  if (!webAppUrl || !sharedSecret) {
    return Response.json(
      { error: "APPS_SCRIPT_WEBAPP_URL and APPS_SCRIPT_SHARED_SECRET must be configured." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const bets = parseReviewedBets(body.bets);
    const response = await fetch(webAppUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: sharedSecret,
        action: "ingestReviewedBets",
        bets
      })
    });

    const text = await response.text();
    let payload: unknown = text;
    try {
      payload = JSON.parse(text);
    } catch {
      // Apps Script can return plain text for deployment/auth errors.
    }

    if (!response.ok) {
      return Response.json({ error: "Apps Script submission failed.", details: payload }, { status: 502 });
    }

    return Response.json({ ok: true, appsScript: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Submit failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
