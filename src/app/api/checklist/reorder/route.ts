import { type NextRequest, NextResponse } from "next/server";
import { checklistItemsCollection } from "~/server/db";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetTime) rateLimitMap.delete(key);
  }
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const reorderSchema = z.object({
  items: z.array(z.object({
    _id: z.string().min(1),
    sortOrder: z.number().int().min(0),
  })).min(1).max(100),
});

export async function PUT(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const now = new Date();
    await checklistItemsCollection.bulkWrite(
      parsed.data.items.map(({ _id, sortOrder }) => ({
        updateOne: {
          filter: { _id: new ObjectId(_id), userId },
          update: { $set: { sortOrder, updatedAt: now } },
        },
      }))
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Checklist reorder error:", err);
    return NextResponse.json({ error: "Failed to reorder items" }, { status: 500 });
  }
}
