import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { tasksCollection, userSettingsCollection } from "~/server/db";
import {
  loadMyndlistCredentials,
  callMyndlist,
  flattenChecklist,
  publicStep,
  saveStepsToMyndlist,
  type MyndlistChecklist,
} from "~/server/myndlist";

// GET/PATCH/DELETE /api/myndlist/checklists/[id] — one reusable checklist.
//
// PATCH takes the edited flat step list and merges it into the checklist as it
// is in Myndlist (saveStepsToMyndlist), so sections, notes and optional flags
// that this app doesn't show survive the edit.

const patchSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  steps: z
    .array(
      z.object({
        // The Myndlist item id for steps that came from Myndlist; absent for new ones.
        id: z.string().max(200).optional(),
        text: z.string().max(5000),
        optional: z.boolean().optional(),
      })
    )
    .max(500)
    .optional(),
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
        steps: flat.steps.map(publicStep),
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

    const result =
      steps !== undefined
        ? await saveStepsToMyndlist(
            creds,
            id,
            steps.map((s) => ({ sourceItemId: s.id, text: s.text, optional: s.optional })),
            name !== undefined ? { title: name } : {}
          )
        : await callMyndlist<{ checklist: MyndlistChecklist }>(creds, `/checklists/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify({ title: name }),
          });
    if (result.outcome !== "ok") {
      const message = result.outcome === "http-error" ? result.message : "Couldn't reach Myndlist.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const flat = flattenChecklist(result.data.checklist);
    return NextResponse.json({
      template: {
        id: flat.id,
        name: flat.name,
        steps: flat.steps.map(publicStep),
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
