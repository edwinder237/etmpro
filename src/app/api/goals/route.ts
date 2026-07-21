import { type NextRequest, NextResponse } from "next/server";
import { goalsCollection, tasksCollection } from "~/server/db";
import type { Goal } from "~/server/db/schema";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

const weekKeyRegex = /^\d{4}-\d{2}-\d{2}$/;
const monthKeyRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
const yearKeyRegex = /^\d{4}$/;
const dateKeyRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

type GoalPeriod = "week" | "month" | "year" | "custom";

// Weeks start on Sunday (weekStartsOn: 0 everywhere in the app)
function isSundayKey(key: string): boolean {
  const [y = 0, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}

// The period type a goal of `periodType` may link up to, or null if none.
function expectedParentType(periodType: GoalPeriod): GoalPeriod | null {
  if (periodType === "week") return "month";
  if (periodType === "month") return "year";
  return null;
}

// Boolean form of the period-key rules, for the PUT "move" path.
function isValidKeyForType(periodType: GoalPeriod, periodKey: string): boolean {
  if (periodType === "week") return weekKeyRegex.test(periodKey) && isSundayKey(periodKey);
  if (periodType === "month") return monthKeyRegex.test(periodKey);
  if (periodType === "year") return yearKeyRegex.test(periodKey);
  return dateKeyRegex.test(periodKey);
}

function validatePeriodKey(
  periodType: GoalPeriod,
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
  } else if (periodType === "month") {
    if (!monthKeyRegex.test(periodKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periodKey"],
        message: "periodKey must be in YYYY-MM format for monthly goals",
      });
    }
  } else if (periodType === "year") {
    if (!yearKeyRegex.test(periodKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periodKey"],
        message: "periodKey must be in YYYY format for yearly goals",
      });
    }
  } else if (!dateKeyRegex.test(periodKey)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["periodKey"],
      message: "periodKey must be in YYYY-MM-DD format for custom goals",
    });
  }
}

const createGoalSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200, "Title too long"),
    note: z.string().max(1000, "Note too long").optional(),
    periodType: z.enum(["week", "month", "year", "custom"]),
    periodKey: z.string(),
    startDate: z.string().regex(dateKeyRegex).optional(),
    endDate: z.string().regex(dateKeyRegex).optional(),
    parentGoalId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    validatePeriodKey(data.periodType, data.periodKey, ctx);
    if (data.periodType === "custom") {
      if (!data.startDate || !data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["startDate"],
          message: "Custom goals require a start and end date",
        });
      } else if (data.endDate < data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "End date must be on or after the start date",
        });
      }
    }
    if (data.parentGoalId !== undefined && expectedParentType(data.periodType) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentGoalId"],
        message: "Only weekly and monthly goals can link to a parent goal",
      });
    }
  });

const updateGoalSchema = z.object({
  _id: z.string().min(1, "Goal ID is required"),
  title: z.string().min(1).max(200).optional(),
  note: z.string().max(1000).nullable().optional(),
  status: z.enum(["active", "achieved", "dropped"]).optional(),
  pinned: z.boolean().optional(),
  periodType: z.enum(["week", "month", "year", "custom"]).optional(),
  periodKey: z.string().optional(),
  startDate: z.string().regex(dateKeyRegex).optional(),
  endDate: z.string().regex(dateKeyRegex).optional(),
  parentGoalId: z.string().nullable().optional(),
});

async function findParentGoal(
  parentGoalId: string,
  userId: string,
  periodType: GoalPeriod
) {
  if (!ObjectId.isValid(parentGoalId)) return null;
  return goalsCollection.findOne({
    _id: new ObjectId(parentGoalId),
    userId,
    periodType,
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
      const parentType = expectedParentType(body.periodType);
      const parent = parentType
        ? await findParentGoal(body.parentGoalId, userId, parentType)
        : null;
      if (!parent) {
        return NextResponse.json(
          { error: `Parent goal not found or is not a ${parentType ?? "valid"} goal` },
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
      startDate: body.periodType === "custom" ? body.startDate : undefined,
      endDate: body.periodType === "custom" ? body.endDate : undefined,
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

    const { _id, note, parentGoalId, periodType, periodKey, startDate, endDate, ...restUpdateData } = parseResult.data;

    if (!ObjectId.isValid(_id)) {
      return NextResponse.json({ error: "Invalid goal ID format" }, { status: 400 });
    }
    const oid = new ObjectId(_id);

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

    // Move a goal to a different period (Week/Month/Year/Custom). This resets
    // its parent link and unlinks any children, since the hierarchy may no
    // longer hold.
    const isMoving = periodType !== undefined;
    if (isMoving) {
      if (!periodKey || !isValidKeyForType(periodType, periodKey)) {
        return NextResponse.json(
          { error: `Invalid periodKey for a ${periodType} goal` },
          { status: 400 }
        );
      }
      updateOperation.$set.periodType = periodType;
      updateOperation.$set.periodKey = periodKey;
      if (periodType === "custom") {
        if (!startDate || !endDate || endDate < startDate) {
          return NextResponse.json(
            { error: "Custom goals require an ordered start and end date" },
            { status: 400 }
          );
        }
        updateOperation.$set.startDate = startDate;
        updateOperation.$set.endDate = endDate;
      } else {
        unset.startDate = "";
        unset.endDate = "";
      }
      // Drop this goal's own parent link and detach its children.
      unset.parentGoalId = "";
      await goalsCollection.updateMany(
        { parentGoalId: oid, userId },
        { $unset: { parentGoalId: "" }, $set: { updatedAt: new Date() } }
      );
    }

    // Custom-goal date range edits (not a period move); keep periodKey pinned to the start date.
    if (!isMoving && (startDate !== undefined || endDate !== undefined)) {
      const goal = await goalsCollection.findOne({ _id: new ObjectId(_id), userId });
      if (!goal) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      if (goal.periodType !== "custom") {
        return NextResponse.json(
          { error: "Only custom goals have an editable date range" },
          { status: 400 }
        );
      }
      const nextStart = startDate ?? goal.startDate;
      const nextEnd = endDate ?? goal.endDate;
      if (!nextStart || !nextEnd || nextEnd < nextStart) {
        return NextResponse.json(
          { error: "End date must be on or after the start date" },
          { status: 400 }
        );
      }
      updateOperation.$set.startDate = nextStart;
      updateOperation.$set.endDate = nextEnd;
      updateOperation.$set.periodKey = nextStart;
    }

    if (!isMoving && parentGoalId === null) {
      unset.parentGoalId = "";
    } else if (!isMoving && parentGoalId != null) {
      const goal = await goalsCollection.findOne({ _id: oid, userId });
      if (!goal) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      const parentType = expectedParentType(goal.periodType);
      if (!parentType) {
        return NextResponse.json(
          { error: "Only weekly and monthly goals can link to a parent goal" },
          { status: 400 }
        );
      }
      const parent = await findParentGoal(parentGoalId, userId, parentType);
      if (!parent) {
        return NextResponse.json(
          { error: `Parent goal not found or is not a ${parentType} goal` },
          { status: 400 }
        );
      }
      updateOperation.$set.parentGoalId = parent._id;
    }

    if (Object.keys(unset).length > 0) {
      updateOperation.$unset = unset;
    }

    const result = await goalsCollection.updateOne(
      { _id: oid, userId },
      updateOperation
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const updated = await goalsCollection.findOne({ _id: oid, userId });
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
