import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { userSettingsCollection } from "~/server/db";
import { decrypt } from "~/server/crypto";
import { safeFetch } from "~/server/safe-fetch";
import { buildPaymentsPayload, type FinanceApiResponse } from "~/lib/payments";

// GET /api/payments?date=YYYY-MM-DD — proxies the caller's own CashFold API and
// returns the day's payments grouped by account, plus unassigned items.
//
// The endpoint and key are per-user (encrypted in user settings), not server
// config: a shared server credential would show one account's finances to every
// signed-in user.
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const doc = await userSettingsCollection.findOne({ userId });

    let apiUrl = "";
    let apiKey = "";
    let financeUserId = "";
    if (doc?.financeApiUrlEnc) {
      try { apiUrl = decrypt(doc.financeApiUrlEnc); } catch { /* corrupt/rotated key */ }
    }
    if (doc?.financeApiKeyEnc) {
      try { apiKey = decrypt(doc.financeApiKeyEnc); } catch { /* corrupt/rotated key */ }
    }
    if (doc?.financeUserIdEnc) {
      try { financeUserId = decrypt(doc.financeUserIdEnc); } catch { /* corrupt/rotated key */ }
    }

    if (!apiUrl) {
      return NextResponse.json({ configured: false });
    }

    const date = request.nextUrl.searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }

    // Support a {date} placeholder in the configured URL, otherwise append ?date=.
    // A configured user id always wins, so the URL doesn't have to carry it.
    let u: URL;
    try {
      u = new URL(apiUrl.includes("{date}") ? apiUrl.replaceAll("{date}", date) : apiUrl);
    } catch {
      return NextResponse.json({ error: "Configured API URL is not valid" }, { status: 400 });
    }
    u.searchParams.set("date", date);
    if (financeUserId) u.searchParams.set("userId", financeUserId);
    const url = u.toString();

    // The URL comes from the user, so it goes through the same guard as calendar
    // feeds — otherwise this becomes a proxy into the private network.
    let res: Response;
    try {
      res = await safeFetch(url, {
        headers: apiKey ? { "X-API-Key": apiKey } : undefined,
        cache: "no-store",
      });
    } catch {
      return NextResponse.json({ error: "Could not reach the configured API" }, { status: 400 });
    }

    if (!res.ok) {
      // Echo enough to diagnose without leaking the key: what the upstream said,
      // whether a key was actually attached, and where the request went.
      let upstreamBody = "";
      try { upstreamBody = (await res.text()).slice(0, 300); } catch { /* body may be empty */ }
      console.error("Payments: finance API responded with status", res.status, upstreamBody);
      return NextResponse.json(
        {
          error: "Finance API request failed",
          upstreamStatus: res.status,
          upstreamBody,
          keySent: Boolean(apiKey),
          userIdSent: Boolean(u.searchParams.get("userId")),
          requestedHost: new URL(url).host,
          requestedPath: new URL(url).pathname,
          sentParams: [...new URL(url).searchParams.keys()],
        },
        { status: 502 }
      );
    }

    const data = (await res.json()) as FinanceApiResponse;

    return NextResponse.json(buildPaymentsPayload(data, date));
  } catch (err) {
    console.error("Payments: request failed", err);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}
