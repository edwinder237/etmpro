import { type NextRequest, NextResponse } from "next/server";
import { verifyTurnstileToken } from "~/lib/turnstile";
import { z } from "zod";

// Validation schema
const contactSchema = z.object({
  email: z.string().email("Invalid email address"),
  message: z.string().min(10, "Message too short").max(5000, "Message too long"),
  "cf-turnstile-response": z.string().min(1, "Turnstile verification required"),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody: unknown = await request.json();
    const parseResult = contactSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { email, message, "cf-turnstile-response": turnstileToken } = parseResult.data;

    // Verify Turnstile token
    const ip = request.headers.get("cf-connecting-ip") ??
               request.headers.get("x-forwarded-for")?.split(",")[0] ??
               request.headers.get("x-real-ip");

    const verification = await verifyTurnstileToken(turnstileToken, ip ?? undefined);

    if (!verification.success) {
      return NextResponse.json(
        { error: verification.error ?? "Bot verification failed" },
        { status: 403 }
      );
    }

    // Here you would typically:
    // 1. Store the message in a database
    // 2. Send an email notification
    // 3. Integrate with a support system

    // For now, we'll just log it (replace with actual implementation)
    console.log("Contact form submission:", { email, message: message.substring(0, 100) + "..." });

    // You could add email sending here using a service like:
    // - Resend
    // - SendGrid
    // - AWS SES
    // - Postmark

    return NextResponse.json(
      { success: true, message: "Message received successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
