import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { env } from "~/env";

// Shape of the external finance API response (only the fields we consume)
interface FinanceApiItem {
  itemType?: string;
  label?: string;
  amount?: number;
}

interface FinanceApiBreakdownItem {
  label?: string;
  amount?: number;
}

interface FinanceApiAccount {
  id?: string;
  shortName?: string;
  total?: number;
  items?: FinanceApiBreakdownItem[];
}

interface FinanceApiResponse {
  periods?: Array<{ items?: FinanceApiItem[] }>;
  totals?: {
    totalIncome?: number;
    totalExpenses?: number;
    totalDebtPayments?: number;
    finalBalance?: number;
    accountBreakdown?: FinanceApiAccount[];
  };
}

// GET /api/payments?date=YYYY-MM-DD — proxies the external finance API and
// returns the day's payments grouped by account, plus unassigned budget items.
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
      return NextResponse.json({ error: "Finance API request failed" }, { status: 502 });
    }

    const data = (await res.json()) as FinanceApiResponse;
    const totals = data.totals;

    const accounts = (totals?.accountBreakdown ?? [])
      .filter(a => a.id && a.shortName)
      .map(a => ({
        id: a.id!,
        shortName: a.shortName!,
        total: a.total ?? 0,
        items: (a.items ?? [])
          .filter(i => i.label !== undefined && i.amount !== undefined)
          .map(i => ({ label: i.label!, amount: i.amount! })),
      }));

    // Budget items carry no account, so they never appear in accountBreakdown
    const budgets = (data.periods ?? [])
      .flatMap(p => p.items ?? [])
      .filter(i => i.itemType === "BUDGET" && i.label !== undefined && i.amount !== undefined)
      .map(i => ({ label: i.label!, amount: i.amount! }));

    return NextResponse.json({
      configured: true,
      date,
      totalIncome: totals?.totalIncome ?? 0,
      finalBalance: totals?.finalBalance ?? 0,
      accounts,
      budgets,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}
