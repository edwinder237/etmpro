import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { tasksCollection } from "~/server/db";
import type { TaskChecklist, TaskChecklistStep } from "~/server/db/schema";
import { loadMyndlistCredentials, callMyndlist, type MyndlistChecklist } from "~/server/myndlist";

// PATCH  /api/tasks/[taskId]/checklists/[checklistId] — mutate one attached checklist
// DELETE /api/tasks/[taskId]/checklists/[checklistId] — detach it
//
// `setSteps` is the hot path: the client ticks optimistically and coalesces a
// run of ticks into one call, so this accepts a batch rather than one step.

const patchSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("setSteps"),
    steps: z.array(z.object({ id: z.string().min(1), done: z.boolean() })).min(1).max(500),
  }),
  z.object({ op: z.literal("addStep"), text: z.string().min(1).max(5000) }),
  z.object({ op: z.literal("removeStep"), stepId: z.string().min(1) }),
  z.object({ op: z.literal("updateStep"), stepId: z.string().min(1), text: z.string().min(1).max(5000) }),
  z.object({ op: z.literal("reorderSteps"), stepIds: z.array(z.string().min(1)).max(500) }),
  z.object({ op: z.literal("reset") }),
  z.object({ op: z.literal("pushToTemplate") }),
]);

/** Renumbers `order` so it always matches array position after a mutation. */
function renumber(steps: TaskChecklistStep[]): TaskChecklistStep[] {
  return steps.map((s, i) => ({ ...s, order: i }));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; checklistId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { taskId, checklistId } = await params;
    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    const rawBody: unknown = await request.json();
    const parsed = patchSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const task = await tasksCollection.findOne({ _id: new ObjectId(taskId), userId });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const lists = task.checklists ?? [];
    const index = lists.findIndex((c) => c.id === checklistId);
    if (index === -1) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });

    const current = lists[index]!;
    let next: TaskChecklist = current;

    switch (body.op) {
      case "setSteps": {
        const wanted = new Map(body.steps.map((s) => [s.id, s.done]));
        const now = new Date();
        next = {
          ...current,
          steps: current.steps.map((s) => {
            const done = wanted.get(s.id);
            if (done === undefined || done === s.done) return s;
            return { ...s, done, doneAt: done ? now : undefined };
          }),
        };
        break;
      }
      case "addStep":
        next = {
          ...current,
          steps: renumber([
            ...current.steps,
            { id: crypto.randomUUID(), text: body.text.trim(), order: current.steps.length, done: false },
          ]),
        };
        break;
      case "removeStep":
        next = { ...current, steps: renumber(current.steps.filter((s) => s.id !== body.stepId)) };
        break;
      case "updateStep":
        next = {
          ...current,
          steps: current.steps.map((s) => (s.id === body.stepId ? { ...s, text: body.text.trim() } : s)),
        };
        break;
      case "reorderSteps": {
        const byId = new Map(current.steps.map((s) => [s.id, s]));
        const ordered = body.stepIds.map((id) => byId.get(id)).filter((s): s is TaskChecklistStep => Boolean(s));
        // Anything the client didn't mention keeps its place at the end, so a
        // stale client can never silently drop steps.
        const missing = current.steps.filter((s) => !body.stepIds.includes(s.id));
        next = { ...current, steps: renumber([...ordered, ...missing]) };
        break;
      }
      case "reset":
        next = { ...current, steps: current.steps.map((s) => ({ ...s, done: false, doneAt: undefined })) };
        break;
      case "pushToTemplate": {
        // The one place a copy flows backwards, and only on explicit user action.
        if (!current.sourceId) {
          return NextResponse.json({ error: "This checklist is no longer linked to a template." }, { status: 400 });
        }
        const creds = await loadMyndlistCredentials(userId);
        if (!creds.apiUrl || !creds.apiKey) {
          return NextResponse.json({ error: "Myndlist is not connected" }, { status: 400 });
        }
        const result = await callMyndlist<{ checklist: MyndlistChecklist }>(
          creds,
          `/checklists/${encodeURIComponent(current.sourceId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              sections: [
                {
                  title: "Steps",
                  items: [...current.steps]
                    .sort((a, b) => a.order - b.order)
                    .map((s) => ({ text: s.text, done: false })),
                },
              ],
            }),
          }
        );
        if (result.outcome !== "ok") {
          const message = result.outcome === "http-error" ? result.message : "Couldn't reach Myndlist.";
          return NextResponse.json({ error: message }, { status: 502 });
        }
        return NextResponse.json({ checklist: current, pushed: true });
      }
    }

    await tasksCollection.updateOne(
      { _id: new ObjectId(taskId), userId },
      { $set: { [`checklists.${index}`]: next, updatedAt: new Date() } }
    );

    return NextResponse.json({ checklist: next });
  } catch (err) {
    console.error("Checklist patch: request failed", err);
    return NextResponse.json({ error: "Failed to update checklist" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string; checklistId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { taskId, checklistId } = await params;
    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    const task = await tasksCollection.findOne({ _id: new ObjectId(taskId), userId });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const remaining = (task.checklists ?? [])
      .filter((c) => c.id !== checklistId)
      .map((c, i) => ({ ...c, order: i }));

    await tasksCollection.updateOne(
      { _id: new ObjectId(taskId), userId },
      { $set: { checklists: remaining, updatedAt: new Date() } }
    );

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("Checklist detach: request failed", err);
    return NextResponse.json({ error: "Failed to detach checklist" }, { status: 500 });
  }
}
