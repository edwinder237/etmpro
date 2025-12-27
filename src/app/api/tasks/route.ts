import { type NextRequest, NextResponse } from "next/server";
import { tasksCollection } from "~/server/db";
import type { Task, TaskQuadrant, TaskPriority, TaskStatus } from "~/server/db/schema";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

// Escape special regex characters to prevent NoSQL injection
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Validation schemas
const taskQuadrantSchema = z.enum(["urgent-important", "important-not-urgent", "urgent-not-important", "not-urgent-not-important"]);
const taskPrioritySchema = z.enum(["high", "medium", "low"]);
const taskStatusSchema = z.enum(["pending", "in-progress", "completed"]);

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
  description: z.string().max(5000, "Description too long").optional(),
  quadrant: taskQuadrantSchema,
  priority: taskPrioritySchema,
  status: taskStatusSchema.optional(),
  dueDate: z.string().datetime().optional(),
  duration: z.number().int().min(1).max(1440).optional(),
  parentTaskId: z.string().optional(),  // For subtask creation
});

const updateTaskSchema = z.object({
  _id: z.string().min(1, "Task ID is required"),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  quadrant: taskQuadrantSchema.optional(),
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional(),
  dueDate: z.string().datetime().nullable().optional(),
  duration: z.number().int().min(1).max(1440).nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const quadrant = searchParams.get("quadrant");
    const priority = searchParams.get("priority");
    const status = searchParams.get("status");

    // Build match filter for parent tasks only (no parentTaskId)
    // In MongoDB, { field: null } matches docs where field is null OR doesn't exist
    const matchFilter: Record<string, unknown> = {
      userId,
      parentTaskId: null
    };

    if (search) {
      const escapedSearch = escapeRegex(search);
      matchFilter.$or = [
        { title: { $regex: escapedSearch, $options: "i" } },
        { description: { $regex: escapedSearch, $options: "i" } }
      ];
    }

    // Validate enum values before using
    if (quadrant && taskQuadrantSchema.safeParse(quadrant).success) {
      matchFilter.quadrant = quadrant as TaskQuadrant;
    }
    if (priority && taskPrioritySchema.safeParse(priority).success) {
      matchFilter.priority = priority as TaskPriority;
    }
    if (status && taskStatusSchema.safeParse(status).success) {
      matchFilter.status = status as TaskStatus;
    }

    // Use aggregation to include subtask counts
    const tasks = await tasksCollection.aggregate([
      { $match: matchFilter },
      {
        $lookup: {
          from: "tasks",
          let: { parentId: "$_id", parentUserId: "$userId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$parentTaskId", "$$parentId"] },
                    { $eq: ["$userId", "$$parentUserId"] }
                  ]
                }
              }
            },
            { $project: { status: 1 } }
          ],
          as: "subtasks"
        }
      },
      {
        $addFields: {
          subtaskCount: { $size: "$subtasks" },
          subtaskCompletedCount: {
            $size: {
              $filter: {
                input: "$subtasks",
                cond: { $eq: ["$$this.status", "completed"] }
              }
            }
          }
        }
      },
      { $project: { subtasks: 0 } },
      { $sort: { createdAt: -1 } }
    ]).toArray();

    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parseResult = createTaskSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const body = parseResult.data;
    let quadrant = body.quadrant;
    let parentTaskId: ObjectId | undefined;

    // Handle subtask creation
    if (body.parentTaskId) {
      if (!ObjectId.isValid(body.parentTaskId)) {
        return NextResponse.json({ error: "Invalid parent task ID" }, { status: 400 });
      }

      // Verify parent task exists, belongs to user, and is not itself a subtask
      // Use { field: null } to match docs where field is null OR doesn't exist
      const parentTask = await tasksCollection.findOne({
        _id: new ObjectId(body.parentTaskId),
        userId,
        parentTaskId: null as unknown as undefined  // Parent must not be a subtask
      });

      if (!parentTask) {
        return NextResponse.json(
          { error: "Parent task not found or is already a subtask" },
          { status: 400 }
        );
      }

      // Inherit quadrant from parent
      quadrant = parentTask.quadrant;
      parentTaskId = new ObjectId(body.parentTaskId);
    }

    const newTask: Task = {
      title: body.title,
      description: body.description,
      quadrant,
      priority: body.priority,
      status: body.status ?? "pending",
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      duration: body.duration,
      parentTaskId,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId,
    };

    const result = await tasksCollection.insertOne(newTask);
    const insertedTask = await tasksCollection.findOne({ _id: result.insertedId });

    return NextResponse.json(insertedTask, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parseResult = updateTaskSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { _id, dueDate, duration, ...restUpdateData } = parseResult.data;

    // Validate ObjectId format
    if (!ObjectId.isValid(_id)) {
      return NextResponse.json({ error: "Invalid task ID format" }, { status: 400 });
    }

    // Build the update operation with only allowed fields
    const updateOperation: { $set: Record<string, unknown>; $unset?: Record<string, "" | true | 1> } = {
      $set: {
        ...restUpdateData,
        updatedAt: new Date()
      }
    };

    // Handle dueDate - if null, unset it; if string, convert to Date
    if (dueDate === null) {
      updateOperation.$unset = { dueDate: "" as const };
    } else if (dueDate) {
      updateOperation.$set.dueDate = new Date(dueDate);
    }

    // Handle duration - if null, unset it; otherwise set it
    if (duration === null) {
      updateOperation.$unset = { ...updateOperation.$unset, duration: "" as const };
    } else if (duration !== undefined) {
      updateOperation.$set.duration = duration;
    }

    const result = await tasksCollection.updateOne(
      { _id: new ObjectId(_id), userId },
      updateOperation
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // If quadrant changed on a parent task, cascade to all subtasks
    if (restUpdateData.quadrant) {
      await tasksCollection.updateMany(
        { parentTaskId: new ObjectId(_id), userId },
        { $set: { quadrant: restUpdateData.quadrant, updatedAt: new Date() } }
      );
    }

    // IDOR fix: Include userId in findOne query
    const updatedTask = await tasksCollection.findOne({ _id: new ObjectId(_id), userId });
    return NextResponse.json(updatedTask);
  } catch {
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
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
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid task ID format" }, { status: 400 });
    }

    // First, delete all subtasks of this task (cascade delete)
    await tasksCollection.deleteMany({
      parentTaskId: new ObjectId(id),
      userId
    });

    // Then delete the task itself
    const result = await tasksCollection.deleteOne({ _id: new ObjectId(id), userId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Task deleted successfully" });
  } catch {
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}