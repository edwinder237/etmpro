import { NextRequest, NextResponse } from "next/server";
import { tasksCollection } from "~/server/db";
import type { Task } from "~/server/db/schema";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";

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

    const filter: any = { userId };
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }
    
    if (quadrant) filter.quadrant = quadrant;
    if (priority) filter.priority = priority;
    if (status) filter.status = status;

    const tasks = await tasksCollection.find(filter).sort({ createdAt: -1 }).toArray();
    
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    const newTask: Task = {
      title: body.title,
      description: body.description,
      quadrant: body.quadrant,
      priority: body.priority,
      status: body.status || "pending",
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId,
    };

    const result = await tasksCollection.insertOne(newTask);
    const insertedTask = await tasksCollection.findOne({ _id: result.insertedId });
    
    return NextResponse.json(insertedTask, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { _id, ...updateData } = body;
    
    if (!_id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const result = await tasksCollection.updateOne(
      { _id: new ObjectId(_id), userId },
      { 
        $set: {
          ...updateData,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const updatedTask = await tasksCollection.findOne({ _id: new ObjectId(_id) });
    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("Error updating task:", error);
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

    const result = await tasksCollection.deleteOne({ _id: new ObjectId(id), userId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}