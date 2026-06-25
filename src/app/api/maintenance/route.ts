import { type NextRequest, NextResponse } from "next/server";
import { maintenanceItemsCollection } from "~/server/db";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  intervalDays: z.number().int().min(1).max(3650),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

const updateSchema = z.object({
  _id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  intervalDays: z.number().int().min(1).max(3650).optional(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const items = await maintenanceItemsCollection
      .find({ userId })
      .sort({ nextDueDate: 1 })
      .toArray();

    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Failed to fetch maintenance items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const now = new Date();
    const result = await maintenanceItemsCollection.insertOne({
      ...parsed.data,
      userId,
      createdAt: now,
      updatedAt: now,
    });

    const newItem = await maintenanceItemsCollection.findOne({ _id: result.insertedId });
    return NextResponse.json(newItem, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create maintenance item" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const { _id, ...updateData } = parsed.data;
    const result = await maintenanceItemsCollection.findOneAndUpdate(
      { _id: new ObjectId(_id), userId },
      { $set: { ...updateData, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to update maintenance item" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await maintenanceItemsCollection.deleteOne({ _id: new ObjectId(id), userId });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete maintenance item" }, { status: 500 });
  }
}

// PATCH — mark as done (resets the timer)
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = z.object({ _id: z.string().min(1) }).safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const item = await maintenanceItemsCollection.findOne({
      _id: new ObjectId(body.data._id),
      userId,
    });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const nextDue = new Date(today);
    nextDue.setDate(nextDue.getDate() + item.intervalDays);
    const nextDueStr = nextDue.toISOString().slice(0, 10);

    const result = await maintenanceItemsCollection.findOneAndUpdate(
      { _id: new ObjectId(body.data._id), userId },
      { $set: { lastCompletedDate: todayStr, nextDueDate: nextDueStr, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to mark item as done" }, { status: 500 });
  }
}
