import { NextResponse } from "next/server";

const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const AUTH_RATE_LIMIT_MAX_KEYS = 5_000;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitEntries = new Map<string, RateLimitEntry>();
let nextCleanupAt = 0;
let rpcBudget: RateLimitEntry | undefined;

function cleanupExpiredEntries(now: number) {
  if (now < nextCleanupAt) return;

  for (const [key, entry] of rateLimitEntries) {
    if (entry.resetAt <= now) rateLimitEntries.delete(key);
  }

  nextCleanupAt = now + AUTH_RATE_LIMIT_WINDOW_MS;
}

export function checkAuthRateLimit(
  scope: "message" | "verify",
  identity: string,
  limit: number,
) {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const key = `${scope}:${identity}`;
  const existing = rateLimitEntries.get(key);

  if (!existing || existing.resetAt <= now) {
    if (rateLimitEntries.size >= AUTH_RATE_LIMIT_MAX_KEYS) {
      const oldestKey = rateLimitEntries.keys().next().value;
      if (oldestKey !== undefined) rateLimitEntries.delete(oldestKey);
    }

    rateLimitEntries.set(key, {
      count: 1,
      resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000),
      ),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function checkAuthRpcBudget(limit: number) {
  const now = Date.now();

  if (!rpcBudget || rpcBudget.resetAt <= now) {
    rpcBudget = {
      count: 1,
      resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS,
    };
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (rpcBudget.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((rpcBudget.resetAt - now) / 1000),
      ),
    };
  }

  rpcBudget.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function authRateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many sign-in attempts. Please wait and try again." },
    {
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds),
      },
      status: 429,
    },
  );
}
