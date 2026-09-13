import { userSettingsCollection } from "~/server/db";
import { decrypt } from "~/server/crypto";
import { safeFetch } from "~/server/safe-fetch";
import type { TaskChecklistStep } from "~/server/db/schema";

// One place that knows how to talk to a user's Myndlist account, so the library
// drawer, the attach picker and the Settings "Test connection" button all
// exercise the same request path. Mirrors src/server/finance.ts deliberately.
//
// Myndlist stores the reusable checklists; the ticked copy lives on the task
// (see TaskChecklist in db/schema.ts) and never travels back here, except when
// the user explicitly pushes edits to the template.

export interface MyndlistCredentials {
  apiUrl: string;
  apiKey: string;
}

/** Shapes returned by the Myndlist REST API (docs/API.md in edwinder237/myndlist). */
export interface MyndlistItem { id: string; text: string; done: boolean }
export interface MyndlistSection { id: string; title: string; collapsed?: boolean; items: MyndlistItem[] }
export interface MyndlistChecklist {
  id: string;
  title: string;
  subtitle?: string;
  sections: MyndlistSection[];
  createdAt?: string;
  updatedAt?: string;
}

/** A Myndlist checklist as this app consumes it: one flat, ordered step list. */
export interface FlatTemplate {
  id: string;
  name: string;
  steps: Array<{ id: string; text: string; done: boolean }>;
  /** Kept so a step can be written back to the right place in Myndlist. */
  lastSectionId: string | null;
}

/**
 * Reads the caller's stored Myndlist credentials. Per-user and encrypted at
 * rest: a shared server credential would show one person's checklists to every
 * signed-in user.
 */
export async function loadMyndlistCredentials(userId: string): Promise<MyndlistCredentials> {
  const doc = await userSettingsCollection.findOne({ userId });
  const read = (enc?: string) => {
    if (!enc) return "";
    try { return decrypt(enc); } catch { return ""; } // corrupt, or encrypted under a rotated key
  };
  return {
    apiUrl: read(doc?.myndlistApiUrlEnc),
    apiKey: read(doc?.myndlistApiKeyEnc),
  };
}

/**
 * Normalises whatever the user pasted into a base ending in /api/v1, so both
 * "https://myndlist.example.com" and ".../api/v1" (with or without a trailing
 * slash) work. Returns null if it isn't a usable absolute URL.
 */
export function normaliseBase(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  let u: URL;
  try { u = new URL(trimmed); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const base = u.toString().replace(/\/+$/, "");
  return base.endsWith("/api/v1") ? base : `${base}/api/v1`;
}

export type MyndlistResult<T> =
  | { outcome: "ok"; data: T }
  | { outcome: "bad-url" }
  | { outcome: "unreachable"; host: string }
  | { outcome: "http-error"; status: number; code: string; message: string }
  | { outcome: "bad-json" };

interface MyndlistErrorBody { error?: { code?: string; message?: string } }

/**
 * Issues one authenticated request. `path` is relative to the /api/v1 base,
 * e.g. "/checklists" or "/checklists/abc/items/xyz".
 */
export async function callMyndlist<T>(
  creds: MyndlistCredentials,
  path: string,
  init?: RequestInit
): Promise<MyndlistResult<T>> {
  const base = normaliseBase(creds.apiUrl);
  if (!base) return { outcome: "bad-url" };

  const url = `${base}${path}`;
  let res: Response;
  try {
    // The base URL comes from the user, so it goes through the same guard as
    // calendar feeds and CashFold — otherwise this is a proxy into the private
    // network. Note this also refuses a Myndlist on localhost, by design.
    res = await safeFetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    let host = "that host";
    try { host = new URL(url).host; } catch { /* base already validated, belt and braces */ }
    return { outcome: "unreachable", host };
  }

  if (!res.ok) {
    let code = "http_error";
    let message = `Myndlist responded with HTTP ${res.status}.`;
    try {
      const body = (await res.json()) as MyndlistErrorBody;
      if (body.error?.code) code = body.error.code;
      if (body.error?.message) message = body.error.message;
    } catch { /* non-JSON error body */ }
    return { outcome: "http-error", status: res.status, code, message };
  }

  try {
    return { outcome: "ok", data: (await res.json()) as T };
  } catch {
    return { outcome: "bad-json" };
  }
}

/**
 * Collapses Myndlist's sections into the single ordered list this app's design
 * shows. Section titles are not displayed here, but nothing is destroyed — they
 * stay intact in Myndlist.
 */
export function flattenChecklist(checklist: MyndlistChecklist): FlatTemplate {
  const sections = checklist.sections ?? [];
  const steps = sections.flatMap((section) =>
    (section.items ?? []).map((item) => ({
      id: item.id,
      text: item.text,
      done: Boolean(item.done),
    }))
  );
  return {
    id: checklist.id,
    name: checklist.title || "Untitled checklist",
    steps,
    lastSectionId: sections.length ? (sections[sections.length - 1]?.id ?? null) : null,
  };
}

/**
 * Deep-copies a template's steps for attachment to a task. Fresh ids, every step
 * unticked: the instance is independent from this moment on, so editing the
 * template later does not rewrite history on tasks that already ran it.
 */
export function copyStepsForAttach(template: FlatTemplate): TaskChecklistStep[] {
  return template.steps.map((step, index) => ({
    id: crypto.randomUUID(),
    text: step.text,
    order: index,
    done: false,
  }));
}
