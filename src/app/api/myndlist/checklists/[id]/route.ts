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

// GET/PATCH/DELETE /api/myndlist/checklists/[id] — one reusable checklist.
//
// PATCH replaces the whole step list, because this app presents a flattened
// view and reordering across sections has no granular equivalent in the
// Myndlist API (its own docs point at the replace-all route for that).

const patchSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  steps: z.array(z.object({ text: z.string().max(5000) })).max(500).optional(),
  blockCompletion: z.boolean().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const creds = await loadMyndlistCredentials(userId);
    if (!creds.apiUrl || !creds.apiKey) {
      return NextResponse.json({ error: "Myndlist is not connected" }, { status: 400 });
    }

    const result = await callMyndlist<{ checklist: MyndlistChecklist }>(
      creds,
      `/checklists/${encodeURIComponent(id)}`
    );
    if (result.outcome !== "ok") {
      const message = result.outcome === "http-error" ? result.message : "Couldn't reach Myndlist.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const flat = flattenChecklist(result.data.checklist);
    const settings = await userSettingsCollection.findOne({ userId });
    return NextResponse.json({
      template: {
        id: flat.id,
        name: flat.name,
        steps: flat.steps.map((s) => ({ id: s.id, text: s.text })),
        stepCount: flat.steps.length,
        blockCompletion: settings?.checklistGates?.[flat.id] ?? false,
      },
    });
  } catch (err) {
    console.error("Myndlist get: request failed", err);
    return NextResponse.json({ error: "Failed to load checklist" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const rawBody: unknown = await request.json();
    const parsed = patchSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, steps, blockCompletion } = parsed.data;

    // The gate lives here, not in Myndlist, which has no field for it.
    if (blockCompletion !== undefined) {
      await userSettingsCollection.updateOne(
        { userId },
        {
          $set: { [`checklistGates.${id}`]: blockCompletion, updatedAt: new Date() },
          $setOnInsert: { userId, createdAt: new Date() },
        },
        { upsert: true }
      );
    }

    if (name === undefined && steps === undefined) {
      return NextResponse.json({ ok: true });
    }

    const creds = await loadMyndlistCredentials(userId);
    if (!creds.apiUrl || !creds.apiKey) {
      return NextResponse.json({ error: "Myndlist is not connected" }, { status: 400 });
    }

    const body: Record<string, unknown> = {};
    if (name !== undefined) body.title = name;
    if (steps !== undefined) {
      body.sections = [
        { title: "Steps", items: steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text, done: false })) },
      ];
    }

    const result = await callMyndlist<{ checklist: MyndlistChecklist }>(
      creds,
      `/checklists/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) }
    );
    if (result.outcome !== "ok") {
      const message = result.outcome === "http-error" ? result.message : "Couldn't reach Myndlist.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const flat = flattenChecklist(result.data.checklist);
    return NextResponse.json({
      template: {
        id: flat.id,
        name: flat.name,
        steps: flat.steps.map((s) => ({ id: s.id, text: s.text })),
        stepCount: flat.steps.length,
        blockCompletion: blockCompletion ?? false,
      },
    });
  } catch (err) {
    console.error("Myndlist patch: request failed", err);
    return NextResponse.json({ error: "Failed to save checklist" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const creds = await loadMyndlistCredentials(userId);
    if (!creds.apiUrl || !creds.apiKey) {
      return NextResponse.json({ error: "Myndlist is not connected" }, { status: 400 });
    }

    const result = await callMyndlist<{ deleted: boolean }>(
      creds,
      `/checklists/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (result.outcome !== "ok") {
      const message = result.outcome === "http-error" ? result.message : "Couldn't reach Myndlist.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    // Attached copies deliberately survive: a checklist you ran last month should
    // still read as it did. They just lose their link back to the template.
    await tasksCollection.updateMany(
      { userId, "checklists.sourceId": id },
      { $set: { "checklists.$[c].sourceId": null, updatedAt: new Date() } },
      { arrayFilters: [{ "c.sourceId": id }] }
    );
    await userSettingsCollection.updateOne({ userId }, { $unset: { [`checklistGates.${id}`]: "" } });

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("Myndlist delete: request failed", err);
    return NextResponse.json({ error: "Failed to delete checklist" }, { status: 500 });
  }
}
