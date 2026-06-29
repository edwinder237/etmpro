import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { userSettingsCollection } from "~/server/db";
import { encrypt, decrypt } from "~/server/crypto";

const updateSettingsSchema = z.object({
  geminiApiKey: z.string().max(200).optional(),
  icalUrls: z.array(z.string().url()).max(10).optional(),
});

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const doc = await userSettingsCollection.findOne({ userId });

    let geminiApiKey = "";
    let icalUrls: string[] = [];

    if (doc?.geminiApiKeyEnc) {
      try { geminiApiKey = decrypt(doc.geminiApiKeyEnc); } catch { /* corrupt/rotated key */ }
    }
    if (doc?.icalUrlsEnc) {
      try { icalUrls = JSON.parse(decrypt(doc.icalUrlsEnc)) as string[]; } catch { /* corrupt/rotated key */ }
    }

    return NextResponse.json(
      { geminiApiKey, icalUrls },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parsed = updateSettingsSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { geminiApiKey, icalUrls } = parsed.data;

    const set: Record<string, unknown> = { updatedAt: new Date() };
    const unset: Record<string, ""> = {};

    if (geminiApiKey !== undefined) {
      if (geminiApiKey.trim()) set.geminiApiKeyEnc = encrypt(geminiApiKey.trim());
      else unset.geminiApiKeyEnc = "";
    }
    if (icalUrls !== undefined) {
      if (icalUrls.length) set.icalUrlsEnc = encrypt(JSON.stringify(icalUrls));
      else unset.icalUrlsEnc = "";
    }

    const update: Record<string, unknown> = {
      $set: set,
      $setOnInsert: { userId, createdAt: new Date() },
    };
    if (Object.keys(unset).length) update.$unset = unset;

    await userSettingsCollection.updateOne({ userId }, update, { upsert: true });

    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
