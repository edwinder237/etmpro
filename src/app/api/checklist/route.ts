import { type NextRequest, NextResponse } from "next/server";
import { checklistItemsCollection } from "~/server/db";
import type { ChecklistItem } from "~/server/db/schema";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

const createChecklistSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  frequency: z.enum(["daily", "weekly"]),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
});

const updateChecklistSchema = z.object({
  _id: z.string().min(1, "Checklist item ID is required"),
  title: z.string().min(1).max(200).optional(),
  frequency: z.enum(["daily", "weekly"]).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const toggleCompletionSchema = z.object({
  _id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
});

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await checklistItemsCollection
      .find({ userId })
      .sort({ sortOrder: 1, createdAt: 1 })
      .toArray();

    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Failed to fetch checklist items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parseResult = createChecklistSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const body = parseResult.data;

    // Get count for sortOrder
    const count = await checklistItemsCollection.countDocuments({ userId });

    const newItem: ChecklistItem = {
      title: body.title,
      frequency: body.frequency,
      daysOfWeek: body.frequency === "weekly" ? (body.daysOfWeek ?? []) : undefined,
      completedDates: [],
      sortOrder: count,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await checklistItemsCollection.insertOne(newItem);
    const inserted = await checklistItemsCollection.findOne({ _id: result.insertedId });

    return NextResponse.json(inserted, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create checklist item" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parseResult = updateChecklistSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { _id, daysOfWeek, ...restUpdateData } = parseResult.data;

    if (!ObjectId.isValid(_id)) {
      return NextResponse.json({ error: "Invalid checklist item ID format" }, { status: 400 });
    }

    const updateOperation: { $set: Record<string, unknown>; $unset?: Record<string, "" | true | 1> } = {
      $set: {
        ...restUpdateData,
        updatedAt: new Date(),
      },
    };

    if (daysOfWeek === null) {
      updateOperation.$unset = { daysOfWeek: "" as const };
    } else if (daysOfWeek !== undefined) {
      updateOperation.$set.daysOfWeek = daysOfWeek;
    }

    const result = await checklistItemsCollection.updateOne(
      { _id: new ObjectId(_id), userId },
      updateOperation
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    const updated = await checklistItemsCollection.findOne({ _id: new ObjectId(_id), userId });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update checklist item" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Checklist item ID is required" }, { status: 400 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid checklist item ID format" }, { status: 400 });
    }

    const result = await checklistItemsCollection.deleteOne({ _id: new ObjectId(id), userId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Checklist item deleted successfully" });
  } catch {
    return NextResponse.json({ error: "Failed to delete checklist item" }, { status: 500 });
  }
}

// Toggle completion for a specific date
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parseResult = toggleCompletionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { _id, date } = parseResult.data;

    if (!ObjectId.isValid(_id)) {
      return NextResponse.json({ error: "Invalid checklist item ID format" }, { status: 400 });
    }

    const item = await checklistItemsCollection.findOne({ _id: new ObjectId(_id), userId });

    if (!item) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    const isCompleted = item.completedDates.includes(date);

    if (isCompleted) {
      await checklistItemsCollection.updateOne(
        { _id: new ObjectId(_id), userId },
        { $pull: { completedDates: date }, $set: { updatedAt: new Date() } }
      );
    } else {
      await checklistItemsCollection.updateOne(
        { _id: new ObjectId(_id), userId },
        { $addToSet: { completedDates: date }, $set: { updatedAt: new Date() } }
      );
    }

    return NextResponse.json({ completed: !isCompleted });
  } catch {
    return NextResponse.json({ error: "Failed to toggle completion" }, { status: 500 });
  }
}
