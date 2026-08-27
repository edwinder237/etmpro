import { NextResponse } from "next/server";
import { tasksCollection } from "~/server/db";
import { auth } from "@clerk/nextjs/server";

/** Archived top-level tasks, most recently archived first. */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tasks = await tasksCollection
      .find({ userId, parentTaskId: null as unknown as undefined, archivedAt: { $ne: null as unknown as undefined } })
      .sort({ archivedAt: -1 })
      .toArray();

    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json({ error: "Failed to fetch archived tasks" }, { status: 500 });
  }
}

/** Permanently delete every archived task, and the subtasks hanging off them. */
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const archived = await tasksCollection
      .find({ userId, archivedAt: { $ne: null as unknown as undefined } }, { projection: { _id: 1 } })
      .toArray();
    const ids = archived.map(t => t._id);

    if (ids.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    // Subtasks live only inside their parent, so they go with it.
    await tasksCollection.deleteMany({ userId, parentTaskId: { $in: ids } });
    // Soft-linked tasks are independent — unlink rather than delete.
    await tasksCollection.updateMany(
      { userId, linkedParentId: { $in: ids } },
      { $unset: { linkedParentId: "" }, $set: { updatedAt: new Date() } }
    );
    const result = await tasksCollection.deleteMany({ userId, _id: { $in: ids } });

    return NextResponse.json({ deleted: result.deletedCount });
  } catch {
    return NextResponse.json({ error: "Failed to delete archived tasks" }, { status: 500 });
  }
}
