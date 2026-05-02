import { NextRequest } from "next/server";
import { verifyAppPassword } from "@/lib/auth";
import { extractBetsWithGemini } from "@/lib/gemini";
import { reviewedBetId } from "@/lib/ids";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authError = verifyAppPassword(request);
  if (authError) {
    return authError;
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((item): item is File => item instanceof File);

  if (files.length === 0) {
    return Response.json({ error: "Upload at least one screenshot." }, { status: 400 });
  }

  try {
    const batches = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        return extractBetsWithGemini({
          sourceFile: file.name,
          mimeType: file.type || "image/png",
          base64
        });
      })
    );

    const bets = batches.flatMap((batch) =>
      batch.bets.map((bet, index) => ({
        ...bet,
        id: reviewedBetId(bet, index)
      }))
    );

    return Response.json({ batches, bets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
