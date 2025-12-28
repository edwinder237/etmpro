/**
 * Cloudflare Turnstile Server-Side Verification
 *
 * This utility verifies Turnstile tokens on the server side.
 * The secret key should be stored in TURNSTILE_SECRET_KEY environment variable.
 */

interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
}

interface VerifyResult {
  success: boolean;
  error?: string;
}

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verify a Turnstile token server-side
 * @param token - The cf-turnstile-response token from the client
 * @param remoteIp - Optional: The user's IP address for additional validation
 * @returns Promise with success status and optional error message
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string
): Promise<VerifyResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    console.error("TURNSTILE_SECRET_KEY environment variable is not set");
    // In development without a key, we can optionally allow requests through
    if (process.env.NODE_ENV === "development") {
      console.warn("Turnstile verification skipped in development mode");
      return { success: true };
    }
    return { success: false, error: "Turnstile not configured" };
  }

  if (!token) {
    return { success: false, error: "Missing Turnstile token" };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      return { success: false, error: "Turnstile verification request failed" };
    }

    const data = (await response.json()) as TurnstileVerifyResponse;

    if (data.success) {
      return { success: true };
    }

    // Map error codes to user-friendly messages
    const errorCodes = data["error-codes"] ?? [];
    const errorMessage = mapTurnstileError(errorCodes);

    return { success: false, error: errorMessage };
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return { success: false, error: "Turnstile verification failed" };
  }
}

/**
 * Map Turnstile error codes to user-friendly messages
 */
function mapTurnstileError(errorCodes: string[]): string {
  const errorMap: Record<string, string> = {
    "missing-input-secret": "Configuration error",
    "invalid-input-secret": "Configuration error",
    "missing-input-response": "Please complete the challenge",
    "invalid-input-response": "Invalid challenge response",
    "bad-request": "Invalid request",
    "timeout-or-duplicate": "Challenge expired, please try again",
    "internal-error": "Verification service error",
  };

  for (const code of errorCodes) {
    if (errorMap[code]) {
      return errorMap[code];
    }
  }

  return "Verification failed";
}

/**
 * Middleware helper to extract and verify Turnstile token from request
 * @param request - The incoming request object
 * @returns Promise with verification result
 */
interface RequestBody {
  "cf-turnstile-response"?: string;
  turnstileToken?: string;
}

export async function verifyTurnstileFromRequest(
  request: Request
): Promise<VerifyResult> {
  try {
    // Try to get token from header first
    const headerToken = request.headers.get("cf-turnstile-response");
    if (headerToken) {
      const ip = request.headers.get("cf-connecting-ip") ??
                 request.headers.get("x-forwarded-for")?.split(",")[0];
      return verifyTurnstileToken(headerToken, ip ?? undefined);
    }

    // Try to get from body (for POST requests)
    const contentType = request.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const body = (await request.clone().json()) as RequestBody;
      const token = body["cf-turnstile-response"] ?? body.turnstileToken;
      if (token) {
        const ip = request.headers.get("cf-connecting-ip") ??
                   request.headers.get("x-forwarded-for")?.split(",")[0];
        return verifyTurnstileToken(token, ip ?? undefined);
      }
    }

    return { success: false, error: "Missing Turnstile token" };
  } catch (error) {
    console.error("Error extracting Turnstile token:", error);
    return { success: false, error: "Invalid request format" };
  }
}
