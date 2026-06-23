import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

interface GeocodingResult {
  results?: Array<{ latitude: number; longitude: number; name: string; timezone: string }>;
}

interface WeatherResult {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
  };
}

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30; // requests per window
const RATE_WINDOW = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  // Clean up expired entries
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

const weatherQuerySchema = z.object({
  city: z.string().min(1, "City is required").max(100, "City name too long"),
});

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = weatherQuerySchema.safeParse({
      city: req.nextUrl.searchParams.get("city"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { city } = parsed.data;

    // Use only the city name (before comma) for geocoding
    const searchName = (city.split(",")[0] ?? city).trim();

    // Geocode the city name to coordinates
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchName)}&count=1`,
      { signal: AbortSignal.timeout(10000) }
    );
    const geoData = (await geoRes.json()) as GeocodingResult;

    if (!geoData.results?.length) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    const first = geoData.results[0];
    if (!first) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    // Verify the result is relevant — normalize accents and compare case-insensitively
    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const searchNorm = normalize(searchName);
    const resultNorm = normalize(first.name);
    if (!resultNorm.includes(searchNorm) && !searchNorm.includes(resultNorm)) {
      return NextResponse.json({ error: `City "${searchName}" not found` }, { status: 404 });
    }

    const { latitude, longitude, name, timezone } = first;

    // Fetch current weather + hourly forecast for today
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code&hourly=temperature_2m,weather_code&timezone=${encodeURIComponent(timezone)}&forecast_days=1`,
      { signal: AbortSignal.timeout(10000) }
    );
    const weatherData = (await weatherRes.json()) as WeatherResult;

    // Build hourly forecast (remaining hours of today)
    // Use city's timezone to determine current hour, not server timezone
    const currentHour = parseInt(
      new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: timezone }),
      10
    );
    const hourly = weatherData.hourly.time
      .map((time, i) => {
        // time is like "2026-06-20T14:00" — extract hour directly from string
        const hour = parseInt(time.slice(11, 13), 10);
        return {
          hour,
          time: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour >= 12 ? "PM" : "AM"}`,
          temp: Math.round(weatherData.hourly.temperature_2m[i] ?? 0),
          weatherCode: weatherData.hourly.weather_code[i] ?? 0,
        };
      })
      .filter((h) => h.hour > currentHour);

    return NextResponse.json(
      {
        temp: Math.round(weatherData.current.temperature_2m),
        feelsLike: Math.round(weatherData.current.apparent_temperature),
        weatherCode: weatherData.current.weather_code,
        city: name,
        hourly,
      },
      {
        headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" },
      }
    );
  } catch (err) {
    console.error("Weather API error:", err);
    return NextResponse.json({ error: "Failed to fetch weather data" }, { status: 500 });
  }
}
