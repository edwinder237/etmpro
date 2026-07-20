import { type NextRequest, NextResponse } from "next/server";
import { goalsCollection, tasksCollection } from "~/server/db";
import type { Goal } from "~/server/db/schema";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

const weekKeyRegex = /^\d{4}-\d{2}-\d{2}$/;
const monthKeyRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

// Weeks start on Sunday (weekStartsOn: 0 everywhere in the app)
function isSundayKey(key: string): boolean {
  const [y = 0, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}

function validatePeriodKey(
  periodType: "week" | "month",
  periodKey: string,
  ctx: z.RefinementCtx
) {
  if (periodType === "week") {
    if (!weekKeyRegex.test(periodKey) || !isSundayKey(periodKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periodKey"],
        message: "periodKey must be a Sunday date in YYYY-MM-DD format for weekly goals",
      });
    }
  } else if (!monthKeyRegex.test(periodKey)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["periodKey"],
      message: "periodKey must be in YYYY-MM format for monthly goals",
    });
  }
}

const createGoalSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200, "Title too long"),
    note: z.string().max(1000, "Note too long").optional(),
    periodType: z.enum(["week", "month"]),
    periodKey: z.string(),
    parentGoalId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    validatePeriodKey(data.periodType, data.periodKey, ctx);
    if (data.parentGoalId !== undefined && data.periodType !== "week") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentGoalId"],
        message: "Only weekly goals can link to a monthly goal",
      });
    }
  });

const updateGoalSchema = z.object({
  _id: z.string().min(1, "Goal ID is required"),
  title: z.string().min(1).max(200).optional(),
  note: z.string().max(1000).nullable().optional(),
  status: z.enum(["active", "achieved", "dropped"]).optional(),
  parentGoalId: z.string().nullable().optional(),
});

async function findParentMonthlyGoal(parentGoalId: string, userId: string) {
  if (!ObjectId.isValid(parentGoalId)) return null;
  return goalsCollection.findOne({
    _id: new ObjectId(parentGoalId),
    userId,
    periodType: "month",
  });
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const goals = await goalsCollection
      .find({ userId })
      .sort({ createdAt: 1 })
      .toArray();

    return NextResponse.json(goals);
  } catch {
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parseResult = createGoalSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const body = parseResult.data;

    let parentGoalId: ObjectId | undefined;
    if (body.parentGoalId !== undefined) {
      const parent = await findParentMonthlyGoal(body.parentGoalId, userId);
      if (!parent) {
        return NextResponse.json(
          { error: "Parent goal not found or is not a monthly goal" },
          { status: 400 }
        );
      }
      parentGoalId = parent._id;
    }

    const newGoal: Goal = {
      title: body.title,
      note: body.note,
      periodType: body.periodType,
      periodKey: body.periodKey,
      status: "active",
      parentGoalId,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await goalsCollection.insertOne(newGoal);
    const inserted = await goalsCollection.findOne({ _id: result.insertedId });

    return NextResponse.json(inserted, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parseResult = updateGoalSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { _id, note, parentGoalId, ...restUpdateData } = parseResult.data;

    if (!ObjectId.isValid(_id)) {
      return NextResponse.json({ error: "Invalid goal ID format" }, { status: 400 });
    }

    const updateOperation: { $set: Record<string, unknown>; $unset?: Record<string, ""> } = {
      $set: {
        ...restUpdateData,
        updatedAt: new Date(),
      },
    };
    const unset: Record<string, ""> = {};

    if (note === null) {
      unset.note = "";
    } else if (note !== undefined) {
      updateOperation.$set.note = note;
    }

    if (parentGoalId === null) {
      unset.parentGoalId = "";
    } else if (parentGoalId !== undefined) {
      const goal = await goalsCollection.findOne({ _id: new ObjectId(_id), userId });
      if (!goal) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      if (goal.periodType !== "week") {
        return NextResponse.json(
          { error: "Only weekly goals can link to a monthly goal" },
          { status: 400 }
        );
      }
      const parent = await findParentMonthlyGoal(parentGoalId, userId);
      if (!parent) {
        return NextResponse.json(
          { error: "Parent goal not found or is not a monthly goal" },
          { status: 400 }
        );
      }
      updateOperation.$set.parentGoalId = parent._id;
    }

    if (Object.keys(unset).length > 0) {
      updateOperation.$unset = unset;
    }

    const result = await goalsCollection.updateOne(
      { _id: new ObjectId(_id), userId },
      updateOperation
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const updated = await goalsCollection.findOne({ _id: new ObjectId(_id), userId });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
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
      return NextResponse.json({ error: "Goal ID is required" }, { status: 400 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid goal ID format" }, { status: 400 });
    }

    const oid = new ObjectId(id);

    // Unlink tasks and child weekly goals before deleting
    await tasksCollection.updateMany(
      { goalId: oid, userId },
      { $unset: { goalId: "" }, $set: { updatedAt: new Date() } }
    );
    await goalsCollection.updateMany(
      { parentGoalId: oid, userId },
      { $unset: { parentGoalId: "" }, $set: { updatedAt: new Date() } }
    );

    const result = await goalsCollection.deleteOne({ _id: oid, userId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Goal deleted successfully" });
  } catch {
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}
