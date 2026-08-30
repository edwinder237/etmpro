import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { loadFinanceCredentials, callFinanceApi, describeKey } from "~/server/finance";
import { buildPaymentsPayload } from "~/lib/payments";

// POST /api/payments/test — runs one real request against the caller's CashFold
// endpoint and reports what came back in plain language.
//
// Credentials are read from the request body so the Settings drawer can test
// what is typed in the form *before* saving it; any field left out falls back to
// what is already stored. Only the caller's own credentials are ever reachable.
const testSchema = z.object({
  financeApiUrl: z.string().max(500).optional(),
  financeApiKey: z.string().max(200).optional(),
  financeUserId: z.string().max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

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

    const saved = await loadFinanceCredentials(userId);
    const creds = {
      apiUrl: (parsed.data.financeApiUrl ?? saved.apiUrl).trim(),
      apiKey: (parsed.data.financeApiKey ?? saved.apiKey).trim(),
      financeUserId: (parsed.data.financeUserId ?? saved.financeUserId).trim(),
    };
    const date = parsed.data.date ?? todayUtc();

    if (!creds.apiUrl) {
      return NextResponse.json({ ok: false, message: "Add an API endpoint first." });
    }

    const result = await callFinanceApi(creds, date);

    // The key fingerprint is the whole point of this button: a rejected key is
    // almost always a mistyped or truncated paste, and seeing the length and
    // the first six characters settles that in one glance.
    const keyNote = `Sending ${describeKey(creds.apiKey)}.`;

    switch (result.outcome) {
      case "bad-url":
        return NextResponse.json({ ok: false, message: "That endpoint isn't a valid URL." });

      case "unreachable":
        return NextResponse.json({
          ok: false,
          message: `Couldn't reach ${result.url.host}. Check the endpoint is right and publicly reachable.`,
        });

      case "http-error": {
        const where = `${result.url.host}${result.url.pathname}`;
        if (result.status === 401 || result.status === 403) {
          return NextResponse.json({
            ok: false,
            message: `${where} rejected the credentials (HTTP ${result.status}). ${keyNote} If that isn't the key you expect, clear the field and paste it again.`,
          });
        }
        if (result.status === 404) {
          return NextResponse.json({
            ok: false,
            message: `${where} returned 404 — the endpoint path looks wrong.`,
          });
        }
        return NextResponse.json({
          ok: false,
          message: `${where} returned HTTP ${result.status}.${result.body ? ` ${result.body}` : ""}`,
        });
      }

      case "bad-json":
        return NextResponse.json({
          ok: false,
          message: `${result.url.host} answered, but not with JSON. Check the endpoint points at the API and not a web page.`,
        });

      case "ok": {
        const payload = buildPaymentsPayload(result.data, date);
        const accounts = payload.accounts.length;
        const items = payload.accounts.reduce((n, a) => n + a.items.length, 0) + payload.budgets.length;
        const found = accounts === 0 && items === 0
          ? `nothing due on ${date}`
          : `${accounts} account${accounts === 1 ? "" : "s"} and ${items} item${items === 1 ? "" : "s"} for ${date}`;
        return NextResponse.json({
          ok: true,
          message: `Connected to ${result.url.host} — ${found}.`,
        });
      }
    }
  } catch (err) {
    console.error("Payments test: request failed", err);
    return NextResponse.json({ error: "Test failed to run" }, { status: 500 });
  }
}
