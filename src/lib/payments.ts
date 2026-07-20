// Transforms the external finance ledger API response into the shape the
// dashboard's "Payments due" section consumes. Pure function so it can be
// exercised against captured API responses without hitting the network.

export interface FinanceApiItem {
  itemType?: string;
  label?: string;
  amount?: number;
  account?: { id?: string; shortName?: string } | null;
}

export interface FinanceApiBreakdownItem {
  label?: string;
  amount?: number;
}

export interface FinanceApiAccount {
  id?: string;
  shortName?: string;
  total?: number;
  items?: FinanceApiBreakdownItem[];
}

export interface FinanceApiResponse {
  periods?: Array<{ items?: FinanceApiItem[] }>;
  totals?: {
    totalIncome?: number;
    totalExpenses?: number;
    totalDebtPayments?: number;
    finalBalance?: number;
    accountBreakdown?: FinanceApiAccount[];
  };
}

export interface PaymentsPayload {
  configured: true;
  date: string;
  totalIncome: number;
  finalBalance: number;
  accounts: Array<{
    id: string;
    shortName: string;
    total: number;
    items: Array<{ label: string; amount: number }>;
  }>;
  budgets: Array<{ label: string; amount: number }>;
}

export function buildPaymentsPayload(data: FinanceApiResponse, date: string): PaymentsPayload {
  const totals = data.totals;

  const accounts: PaymentsPayload["accounts"] = (totals?.accountBreakdown ?? [])
    .filter(a => a.id && a.shortName)
    .map(a => ({
      id: a.id!,
      shortName: a.shortName!,
      total: a.total ?? 0,
      items: (a.items ?? [])
        .filter(i => i.label !== undefined && i.amount !== undefined)
        .map(i => ({ label: i.label!, amount: i.amount! })),
    }));

  const knownAccountIds = new Set(accounts.map(a => a.id));

  // Every negative-amount period item is a payment due. Keying on the amount
  // sign (rather than an itemType whitelist) keeps one-offs, budgets, and any
  // future item types visible. Positive items (income) are excluded, and items
  // whose account already appears in accountBreakdown are skipped to avoid
  // double counting.
  const syntheticAccounts = new Map<string, PaymentsPayload["accounts"][number]>();
  const unassigned: PaymentsPayload["budgets"] = [];

  for (const item of (data.periods ?? []).flatMap(p => p.items ?? [])) {
    if (item.label === undefined || item.amount === undefined) continue;
    if (item.amount >= 0) continue;

    const accountId = item.account?.id;
    if (accountId && knownAccountIds.has(accountId)) continue;

    if (accountId && item.account?.shortName) {
      const group = syntheticAccounts.get(accountId) ?? {
        id: accountId,
        shortName: item.account.shortName,
        total: 0,
        items: [],
      };
      group.total += item.amount;
      group.items.push({ label: item.label, amount: item.amount });
      syntheticAccounts.set(accountId, group);
    } else {
      unassigned.push({ label: item.label, amount: item.amount });
    }
  }

  return {
    configured: true,
    date,
    totalIncome: totals?.totalIncome ?? 0,
    finalBalance: totals?.finalBalance ?? 0,
    accounts: [...accounts, ...syntheticAccounts.values()],
    budgets: unassigned,
  };
}
