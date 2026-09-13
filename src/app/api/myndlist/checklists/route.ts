import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { tasksCollection, userSettingsCollection } from "~/server/db";
import {
  loadMyndlistCredentials,
  callMyndlist,
  flattenChecklist,
  type MyndlistChecklist,
} from "~/server/myndlist";

// GET  /api/myndlist/checklists — the caller's reusable checklists, flattened.
// POST /api/myndlist/checklists — create one.
//
// A thin, authenticated proxy: the Myndlist key never reaches the browser.

const createSchema = z.object({
  name: z.string().min(1).max(500),
  steps: z.array(z.string().max(5000)).max(500).optional(),
});

/**
 * How many times each template is currently attached across the user's tasks.
 * Derived rather than stored — there is no write path to keep in sync, and at
 * this scale one aggregation is cheaper than the bookkeeping would be.
 */
async function usageBySourceId(userId: string): Promise<Record<string, number>> {
  const rows = await tasksCollection
    .aggregate<{ _id: string; count: number }>([
      { $match: { userId, checklists: { $type: "array" } } },
      { $unwind: "$checklists" },
      { $match: { "checklists.sourceId": { $ne: null } } },
      { $group: { _id: "$checklists.sourceId", count: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const creds = await loadMyndlistCredentials(userId);
    // Not configured is a normal state, not an error: the whole feature simply
    // renders empty until the user connects Myndlist in Settings.
    if (!creds.apiUrl || !creds.apiKey) {
      return NextResponse.json({ configured: false, templates: [] });
    }

    const q = request.nextUrl.searchParams.get("q")?.trim();
    const path = q ? `/checklists?q=${encodeURIComponent(q)}` : "/checklists";
    const result = await callMyndlist<{ checklists: MyndlistChecklist[] }>(creds, path);

    if (result.outcome !== "ok") {
      const message =
        result.outcome === "http-error"
          ? result.message
          : "Couldn't reach Myndlist. Check the connection in Settings → Integrations.";
      return NextResponse.json({ configured: true, error: message }, { status: 502 });
    }

    const [usage, settings] = await Promise.all([
      usageBySourceId(userId),
      userSettingsCollection.findOne({ userId }),
    ]);
    const gates = settings?.checklistGates ?? {};

    const templates = (result.data.checklists ?? []).map((raw) => {
      const flat = flattenChecklist(raw);
      return {
        id: flat.id,
        name: flat.name,
        steps: flat.steps.map((s) => ({ id: s.id, text: s.text })),
        stepCount: flat.steps.length,
        usageCount: usage[flat.id] ?? 0,
        blockCompletion: gates[flat.id] ?? false,
        updatedAt: raw.updatedAt,
      };
    });

    return NextResponse.json(
      { configured: true, templates },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Myndlist list: request failed", err);
    return NextResponse.json({ error: "Failed to load checklists" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parsed = createSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const creds = await loadMyndlistCredentials(userId);
    if (!creds.apiUrl || !creds.apiKey) {
      return NextResponse.json({ error: "Connect Myndlist in Settings → Integrations first." }, { status: 400 });
    }

    const steps = (parsed.data.steps ?? []).filter((t) => t.trim());
    const result = await callMyndlist<{ checklist: MyndlistChecklist }>(creds, "/checklists", {
      method: "POST",
      body: JSON.stringify({
        title: parsed.data.name,
        // One section holds every step: this app presents checklists flat, and a
        // single section is where new steps get appended.
        sections: [{ title: "Steps", items: steps.map((text) => ({ text, done: false })) }],
      }),
    });

    if (result.outcome !== "ok") {
      const message = result.outcome === "http-error" ? result.message : "Couldn't reach Myndlist.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const flat = flattenChecklist(result.data.checklist);
    return NextResponse.json(
      {
        template: {
          id: flat.id,
          name: flat.name,
          steps: flat.steps.map((s) => ({ id: s.id, text: s.text })),
          stepCount: flat.steps.length,
          usageCount: 0,
          blockCompletion: false,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Myndlist create: request failed", err);
    return NextResponse.json({ error: "Failed to create checklist" }, { status: 500 });
  }
}
