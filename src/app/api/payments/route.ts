import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { env } from "~/env";
import { buildPaymentsPayload, type FinanceApiResponse } from "~/lib/payments";

// GET /api/payments?date=YYYY-MM-DD — proxies the external finance API and
// returns the day's payments grouped by account, plus unassigned items.
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!env.FINANCE_API_URL) {
      return NextResponse.json({ configured: false });
    }

    const date = request.nextUrl.searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }

    // Support a {date} placeholder in the configured URL, otherwise append ?date=
    let url: string;
    if (env.FINANCE_API_URL.includes("{date}")) {
      url = env.FINANCE_API_URL.replaceAll("{date}", date);
    } else {
      const u = new URL(env.FINANCE_API_URL);
      u.searchParams.set("date", date);
      url = u.toString();
    }

    const res = await fetch(url, {
      headers: env.FINANCE_API_KEY ? { "X-API-Key": env.FINANCE_API_KEY } : undefined,
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Payments: finance API responded with status", res.status);
      return NextResponse.json(
        { error: "Finance API request failed", upstreamStatus: res.status },
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
