import { type NextRequest, NextResponse } from "next/server";
import { tasksCollection } from "~/server/db";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        sortOrder: z.number().int().min(0),
      })
    )
    .min(1)
    .max(500),
});

// Bulk-assign manual sort positions to tasks within a quadrant.
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parsed = reorderSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const valid = parsed.data.items.filter((it) => ObjectId.isValid(it.id));
    if (valid.length === 0) {
      return NextResponse.json({ error: "No valid task IDs" }, { status: 400 });
    }

    const now = new Date();
    await tasksCollection.bulkWrite(
      valid.map((it) => ({
        updateOne: {
          filter: { _id: new ObjectId(it.id), userId },
          update: { $set: { sortOrder: it.sortOrder, updatedAt: now } },
        },
      }))
    );

    return NextResponse.json({ message: "Reordered" });
  } catch {
    return NextResponse.json({ error: "Failed to reorder tasks" }, { status: 500 });
  }
}
