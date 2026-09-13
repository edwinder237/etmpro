import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { describeKey } from "~/server/crypto";
import { loadMyndlistCredentials, callMyndlist, normaliseBase } from "~/server/myndlist";

// POST /api/myndlist/test — runs one real request against the caller's Myndlist
// endpoint and reports what came back in plain language.
//
// Credentials come from the request body so Settings can test what is typed in
// the form before saving it; any field left out falls back to what is stored.
const testSchema = z.object({
  myndlistApiUrl: z.string().max(500).optional(),
  myndlistApiKey: z.string().max(200).optional(),
});

interface MeResponse { user?: { name?: string; email?: string } }

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json().catch(() => ({}));
    const parsed = testSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }

    const saved = await loadMyndlistCredentials(userId);
    const creds = {
      apiUrl: (parsed.data.myndlistApiUrl ?? saved.apiUrl).trim(),
      apiKey: (parsed.data.myndlistApiKey ?? saved.apiKey).trim(),
    };

    if (!creds.apiUrl) {
      return NextResponse.json({ ok: false, message: "Add your Myndlist URL first." });
    }
    if (!creds.apiKey) {
      return NextResponse.json({ ok: false, message: "Add a Myndlist API key first." });
    }

    const result = await callMyndlist<MeResponse>(creds, "/me");

    // The key fingerprint is the point of this button: a rejected key is almost
    // always a mistyped or truncated paste, and the length plus first six
    // characters settle that in one glance.
    const keyNote = `Sending ${describeKey(creds.apiKey)}.`;
    const base = normaliseBase(creds.apiUrl) ?? creds.apiUrl;

    switch (result.outcome) {
      case "bad-url":
        return NextResponse.json({ ok: false, message: "That isn't a valid URL. It should look like https://your-myndlist.vercel.app" });

      case "unreachable":
        return NextResponse.json({
          ok: false,
          message: `Couldn't reach ${result.host}. Check the URL is right and publicly reachable — a Myndlist running on localhost can't be used here.`,
        });

      case "http-error": {
        if (result.status === 401) {
          return NextResponse.json({
            ok: false,
            message: `${base} rejected the key (HTTP 401). ${keyNote} If that isn't the key you expect, clear the field and paste it again.`,
          });
        }
        if (result.status === 404) {
          return NextResponse.json({
            ok: false,
            message: `${base} returned 404 — check the URL points at your Myndlist deployment.`,
          });
        }
        return NextResponse.json({ ok: false, message: `${base} returned HTTP ${result.status}. ${result.message}` });
      }

      case "bad-json":
        return NextResponse.json({
          ok: false,
          message: `${base} answered, but not with JSON. Check the URL points at Myndlist and not another site.`,
        });

      case "ok": {
        const who = result.data.user?.name ?? result.data.user?.email ?? "your account";
        return NextResponse.json({ ok: true, message: `Connected to Myndlist as ${who}.` });
      }
    }
  } catch (err) {
    console.error("Myndlist test: request failed", err);
    return NextResponse.json({ error: "Test failed to run" }, { status: 500 });
  }
}
