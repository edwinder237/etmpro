import { userSettingsCollection } from "~/server/db";
import { decrypt } from "~/server/crypto";
import { safeFetch } from "~/server/safe-fetch";
import type { FinanceApiResponse } from "~/lib/payments";

// One place that knows how to talk to a user's CashFold API, so the dashboard
// call and the Settings "Test connection" button exercise identical code. A
// test that builds its request differently from the real one proves nothing.

export interface FinanceCredentials {
  apiUrl: string;
  apiKey: string;
  financeUserId: string;
}

/**
 * Reads the caller's stored CashFold credentials. Values are per-user and
 * encrypted at rest: a shared server credential would show one account's
 * finances to every signed-in user.
 */
export async function loadFinanceCredentials(userId: string): Promise<FinanceCredentials> {
  const doc = await userSettingsCollection.findOne({ userId });
  const read = (enc?: string) => {
    if (!enc) return "";
    try { return decrypt(enc); } catch { return ""; } // corrupt, or encrypted under a rotated key
  };
  return {
    apiUrl: read(doc?.financeApiUrlEnc),
    apiKey: read(doc?.financeApiKeyEnc),
    financeUserId: read(doc?.financeUserIdEnc),
  };
}

/**
 * Builds the outgoing URL. A {date} placeholder is substituted, otherwise the
 * date rides along as a query param. A configured user id always wins, so the
 * stored endpoint doesn't have to carry one.
 */
export function buildFinanceUrl(creds: FinanceCredentials, date: string): URL | null {
  let u: URL;
  try {
    u = new URL(creds.apiUrl.includes("{date}") ? creds.apiUrl.replaceAll("{date}", date) : creds.apiUrl);
  } catch {
    return null;
  }
  u.searchParams.set("date", date);
  if (creds.financeUserId) u.searchParams.set("userId", creds.financeUserId);
  return u;
}

export type FinanceCallResult =
  | { outcome: "ok"; url: URL; data: FinanceApiResponse }
  | { outcome: "bad-url" }
  | { outcome: "unreachable"; url: URL }
  | { outcome: "http-error"; url: URL; status: number; body: string }
  | { outcome: "bad-json"; url: URL };

export async function callFinanceApi(creds: FinanceCredentials, date: string): Promise<FinanceCallResult> {
  const url = buildFinanceUrl(creds, date);
  if (!url) return { outcome: "bad-url" };

  let res: Response;
  try {
    // The endpoint comes from the user, so it goes through the same guard as
    // calendar feeds — otherwise this is a proxy into the private network.
    res = await safeFetch(url.toString(), {
      headers: creds.apiKey ? { "X-API-Key": creds.apiKey } : undefined,
      cache: "no-store",
    });
  } catch {
    return { outcome: "unreachable", url };
  }

  if (!res.ok) {
    let body = "";
    try { body = (await res.text()).slice(0, 300); } catch { /* body may be empty */ }
    return { outcome: "http-error", url, status: res.status, body };
  }

  try {
    return { outcome: "ok", url, data: (await res.json()) as FinanceApiResponse };
  } catch {
    return { outcome: "bad-json", url };
  }
}

/**
 * A masked fingerprint of a key: enough to tell two keys apart by eye without
 * printing the secret. This is what turns "invalid API key" into something
 * actionable — a wrong length or a shifted prefix is visible immediately.
 */
export function describeKey(apiKey: string): string {
  if (!apiKey) return "no key";
  if (apiKey.length < 12) return `${apiKey.length} characters`;
  return `${apiKey.length} characters, ${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`;
}
