import type { NextRequest } from "next/server";

export function verifyAppPassword(request: NextRequest): Response | null {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return Response.json({ error: "APP_PASSWORD is not configured." }, { status: 500 });
  }

  const supplied = request.headers.get("x-app-password");
  if (supplied !== expected) {
    return Response.json({ error: "Invalid app password." }, { status: 401 });
  }

  return null;
}
