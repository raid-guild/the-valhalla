import { NextResponse } from "next/server";

const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const AUTH_RATE_LIMIT_MAX_KEYS = 5_000;
const CHAT_MAX_CONCURRENT_REQUESTS = 12;
const CHAT_MAX_CONCURRENT_REQUESTS_PER_MEMBER = 2;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type AuthRateLimitScope = "chat" | "message" | "rpc" | "session" | "verify";
type GlobalBudgetScope = "chat" | "message" | "rpc";

// These counters are an intentional process-local first defense: they reset on
// cold starts and multiply across instances. Horizontally scaled deployments
// should also enforce shared or edge/WAF limits.
const rateLimitEntries = new Map<
  AuthRateLimitScope,
  Map<string, RateLimitEntry>
>();
const globalBudgets = new Map<GlobalBudgetScope, RateLimitEntry>();
const activeChatRequestsByMember = new Map<string, number>();
let activeChatRequests = 0;
let nextCleanupAt = 0;

function cleanupExpiredEntries(now: number) {
  if (now < nextCleanupAt) return;

  for (const entries of rateLimitEntries.values()) {
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(key);
    }
  }

  for (const [scope, entry] of globalBudgets) {
    if (entry.resetAt <= now) globalBudgets.delete(scope);
  }

  nextCleanupAt = now + AUTH_RATE_LIMIT_WINDOW_MS;
}

export function checkAuthRateLimit(
  scope: AuthRateLimitScope,
  identity: string,
  limit: number,
) {
  const now = Date.now();
  cleanupExpiredEntries(now);

  let entries = rateLimitEntries.get(scope);
  if (!entries) {
    entries = new Map<string, RateLimitEntry>();
    rateLimitEntries.set(scope, entries);
  }

  const existing = entries.get(identity);

  if (!existing || existing.resetAt <= now) {
    if (entries.size >= AUTH_RATE_LIMIT_MAX_KEYS) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey !== undefined) entries.delete(oldestKey);
    }

    entries.set(identity, {
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

export function checkAuthGlobalBudget(scope: GlobalBudgetScope, limit: number) {
  const now = Date.now();
  const budget = globalBudgets.get(scope);

  if (!budget || budget.resetAt <= now) {
    globalBudgets.set(scope, {
      count: 1,
      resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (budget.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((budget.resetAt - now) / 1000)),
    };
  }

  budget.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function checkAuthRpcBudget(identity: string) {
  const identityBudget = checkAuthRateLimit("rpc", identity, 5);
  if (!identityBudget.allowed) return identityBudget;

  return checkAuthGlobalBudget("rpc", 120);
}

export function checkChatRateLimit(identity: string) {
  const identityBudget = checkAuthRateLimit("chat", identity, 12);
  if (!identityBudget.allowed) return identityBudget;

  return checkAuthGlobalBudget("chat", 240);
}

export function acquireChatConcurrencySlot(identity: string) {
  const memberRequestCount = activeChatRequestsByMember.get(identity) ?? 0;
  if (
    activeChatRequests >= CHAT_MAX_CONCURRENT_REQUESTS ||
    memberRequestCount >= CHAT_MAX_CONCURRENT_REQUESTS_PER_MEMBER
  ) {
    return null;
  }

  activeChatRequests += 1;
  activeChatRequestsByMember.set(identity, memberRequestCount + 1);
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeChatRequests = Math.max(0, activeChatRequests - 1);

    const remainingMemberRequests =
      (activeChatRequestsByMember.get(identity) ?? 1) - 1;
    if (remainingMemberRequests <= 0) {
      activeChatRequestsByMember.delete(identity);
    } else {
      activeChatRequestsByMember.set(identity, remainingMemberRequests);
    }
  };
}

export function authRateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Please wait and try again." },
    {
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds),
      },
      status: 429,
    },
  );
}
