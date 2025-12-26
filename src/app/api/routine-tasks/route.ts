import { type NextRequest, NextResponse } from "next/server";
import { routineTasksCollection } from "~/server/db";
import type { RoutineTask, TaskQuadrant, TaskPriority } from "~/server/db/schema";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

// Validation schemas
const taskQuadrantSchema = z.enum(["urgent-important", "important-not-urgent", "urgent-not-important", "not-urgent-not-important"]);
const taskPrioritySchema = z.enum(["high", "medium", "low"]);

const createRoutineTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
  description: z.string().max(5000, "Description too long").optional(),
  quadrant: taskQuadrantSchema,
  priority: taskPrioritySchema,
  duration: z.number().int().min(1).max(1440).optional(),
});

const updateRoutineTaskSchema = z.object({
  _id: z.string().min(1, "Routine task ID is required"),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  quadrant: taskQuadrantSchema.optional(),
  priority: taskPrioritySchema.optional(),
  duration: z.number().int().min(1).max(1440).nullable().optional(),
});

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch routine tasks sorted by usage count (most used first), then by recency
    const routineTasks = await routineTasksCollection
      .find({ userId })
      .sort({ usageCount: -1, lastUsedAt: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json(routineTasks);
  } catch {
    return NextResponse.json({ error: "Failed to fetch routine tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parseResult = createRoutineTaskSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const body = parseResult.data;

    const newRoutineTask: RoutineTask = {
      title: body.title,
      description: body.description,
      quadrant: body.quadrant,
      priority: body.priority,
      duration: body.duration,
      userId,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await routineTasksCollection.insertOne(newRoutineTask);
    const insertedRoutineTask = await routineTasksCollection.findOne({ _id: result.insertedId });

    return NextResponse.json(insertedRoutineTask, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create routine task" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parseResult = updateRoutineTaskSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { _id, duration, ...restUpdateData } = parseResult.data;

    // Validate ObjectId format
    if (!ObjectId.isValid(_id)) {
      return NextResponse.json({ error: "Invalid routine task ID format" }, { status: 400 });
    }

    // Build the update operation
    const updateOperation: { $set: Record<string, unknown>; $unset?: Record<string, "" | true | 1> } = {
      $set: {
        ...restUpdateData,
        updatedAt: new Date()
      }
    };

    // Handle duration - if null, unset it; otherwise set it
    if (duration === null) {
      updateOperation.$unset = { duration: "" as const };
    } else if (duration !== undefined) {
      updateOperation.$set.duration = duration;
    }

    const result = await routineTasksCollection.updateOne(
      { _id: new ObjectId(_id), userId },
      updateOperation
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Routine task not found" }, { status: 404 });
    }

    const updatedRoutineTask = await routineTasksCollection.findOne({ _id: new ObjectId(_id), userId });
    return NextResponse.json(updatedRoutineTask);
  } catch {
    return NextResponse.json({ error: "Failed to update routine task" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Routine task ID is required" }, { status: 400 });
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid routine task ID format" }, { status: 400 });
    }

    const result = await routineTasksCollection.deleteOne({ _id: new ObjectId(id), userId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Routine task not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Routine task deleted successfully" });
  } catch {
    return NextResponse.json({ error: "Failed to delete routine task" }, { status: 500 });
  }
}

// Endpoint to increment usage count when a routine task is used
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Routine task ID is required" }, { status: 400 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid routine task ID format" }, { status: 400 });
    }

    const result = await routineTasksCollection.updateOne(
      { _id: new ObjectId(id), userId },
      {
        $inc: { usageCount: 1 },
        $set: { lastUsedAt: new Date(), updatedAt: new Date() }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Routine task not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Usage count incremented" });
  } catch {
    return NextResponse.json({ error: "Failed to update usage count" }, { status: 500 });
  }
}
