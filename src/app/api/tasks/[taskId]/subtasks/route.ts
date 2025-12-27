import { type NextRequest, NextResponse } from "next/server";
import { tasksCollection } from "~/server/db";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await params;

    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    // Verify parent task exists and belongs to user
    // Use { field: null } to match docs where field is null OR doesn't exist
    const parentTask = await tasksCollection.findOne({
      _id: new ObjectId(taskId),
      userId,
      parentTaskId: null as unknown as undefined  // Must be a parent task (not a subtask)
    });

    if (!parentTask) {
      return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
    }

    // Fetch all subtasks for this parent
    const subtasks = await tasksCollection
      .find({
        parentTaskId: new ObjectId(taskId),
        userId
      })
      .sort({ createdAt: 1 })  // Oldest first for subtasks
      .toArray();

    return NextResponse.json(subtasks);
  } catch {
    return NextResponse.json({ error: "Failed to fetch subtasks" }, { status: 500 });
  }
}
