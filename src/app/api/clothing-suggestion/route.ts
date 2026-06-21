import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW = 60_000; // 1 minute

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

const clothingRequestSchema = z.object({
  temp: z.number(),
  feelsLike: z.number(),
  condition: z.string().max(100),
  hourlyForecast: z.array(z.object({
    time: z.string(),
    temp: z.number(),
    condition: z.string().max(100),
  })).max(24).default([]),
  activity: z.string().max(200).default(""),
  apiKey: z.string().min(1, "API key is required").max(200),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = clothingRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { temp, feelsLike, condition, hourlyForecast, activity, apiKey } = parsed.data;

    const forecastSummary = hourlyForecast.length > 0
      ? ` Later today: ${hourlyForecast.map(h => `${h.time}: ${h.temp}°C, ${h.condition}`).join(" | ")}.`
      : "";
    const activityPart = activity
      ? ` The user is planning to: ${activity}.`
      : "";
    const prompt = `Current weather: ${temp}°C (feels like ${feelsLike}°C), ${condition}.${forecastSummary}${activityPart} Give a practical clothing and gear suggestion in 2-3 short sentences. Consider the full day forecast — if rain or snow is expected later, suggest bringing appropriate gear. Be specific about clothing items${activity ? " and tips for that activity in these conditions" : ""}. No intro, just the suggestion.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Gemini API error:", errorText);
      return NextResponse.json({ error: "Failed to get suggestion" }, { status: res.status });
    }

    const data = (await res.json()) as GeminiResponse;
    // Gemini may return multiple parts (thinking + response), get the last text part
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter(p => p.text).map(p => p.text).pop() ?? "";

    return NextResponse.json({ suggestion: text.trim() });
  } catch {
    return NextResponse.json({ error: "Failed to generate suggestion" }, { status: 500 });
  }
}
