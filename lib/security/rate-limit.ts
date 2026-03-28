import { getClientIp } from "@/lib/security/client-address";

export type RateLimitPolicy = {
  name: string;
  limit: number;
  windowMs: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  key: string;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type MemoryEntry = {
  count: number;
  resetAt: number;
};

type UpstashPipelineResponse = Array<{
  result?: number | string | null;
  error?: string | null;
}>;

const globalStore = globalThis as typeof globalThis & {
  __zmlRateLimitStore?: Map<string, MemoryEntry>;
};

function getMemoryStore() {
  if (!globalStore.__zmlRateLimitStore) {
    globalStore.__zmlRateLimitStore = new Map<string, MemoryEntry>();
  }

  return globalStore.__zmlRateLimitStore;
}

function getUpstashConfig() {
  const url =
    process.env.RATE_LIMIT_UPSTASH_REST_URL ??
    process.env.UPSTASH_REDIS_REST_URL ??
    null;
  const token =
    process.env.RATE_LIMIT_UPSTASH_REST_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    null;

  if (
    process.env.NODE_ENV === "production" &&
    typeof url === "string" &&
    url.length > 0 &&
    typeof token === "string" &&
    token.length > 0
  ) {
    return { url, token };
  }

  return null;
}

function buildRateLimitKey(input: {
  policy: RateLimitPolicy;
  request: Request;
  userId?: string | null;
  keyParts?: Array<string | null | undefined>;
}) {
  const principal = input.userId?.trim()
    ? `user:${input.userId.trim()}`
    : `ip:${getClientIp(input.request.headers) ?? "unknown"}`;
  const extraKeyParts = (input.keyParts ?? [])
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return ["zml", "rate", input.policy.name, principal, ...extraKeyParts].join(":");
}

function buildDecision(input: {
  key: string;
  count: number;
  limit: number;
  resetAt: number;
}) {
  const remaining = Math.max(0, input.limit - input.count);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((input.resetAt - Date.now()) / 1000),
  );

  return {
    allowed: input.count <= input.limit,
    key: input.key,
    limit: input.limit,
    remaining,
    resetAt: input.resetAt,
    retryAfterSeconds,
  } satisfies RateLimitDecision;
}

function applyMemoryRateLimit(input: {
  key: string;
  policy: RateLimitPolicy;
  nowMs: number;
}): RateLimitDecision {
  const store = getMemoryStore();
  const existing = store.get(input.key);

  if (!existing || existing.resetAt <= input.nowMs) {
    const nextEntry = {
      count: 1,
      resetAt: input.nowMs + input.policy.windowMs,
    };
    store.set(input.key, nextEntry);
    return buildDecision({
      key: input.key,
      count: nextEntry.count,
      limit: input.policy.limit,
      resetAt: nextEntry.resetAt,
    });
  }

  existing.count += 1;
  store.set(input.key, existing);
  return buildDecision({
    key: input.key,
    count: existing.count,
    limit: input.policy.limit,
    resetAt: existing.resetAt,
  });
}

async function applyUpstashRateLimit(input: {
  key: string;
  policy: RateLimitPolicy;
  nowMs: number;
  url: string;
  token: string;
}): Promise<RateLimitDecision> {
  const response = await fetch(`${input.url.replace(/\/+$/u, "")}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", input.key],
      ["PEXPIRE", input.key, `${input.policy.windowMs}`],
      ["PTTL", input.key],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash rate limit request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as UpstashPipelineResponse;
  const count = Number(payload[0]?.result ?? 0);
  const ttlMs = Math.max(0, Number(payload[2]?.result ?? input.policy.windowMs));

  return buildDecision({
    key: input.key,
    count,
    limit: input.policy.limit,
    resetAt: input.nowMs + ttlMs,
  });
}

export async function checkRateLimit(input: {
  request: Request;
  policy: RateLimitPolicy;
  userId?: string | null;
  keyParts?: Array<string | null | undefined>;
  nowMs?: number;
}): Promise<RateLimitDecision> {
  const key = buildRateLimitKey(input);
  const nowMs = input.nowMs ?? Date.now();
  const upstashConfig = getUpstashConfig();

  if (upstashConfig) {
    try {
      return await applyUpstashRateLimit({
        key,
        policy: input.policy,
        nowMs,
        ...upstashConfig,
      });
    } catch (error) {
      console.warn("[rate-limit] Falling back to memory store:", error);
    }
  }

  return applyMemoryRateLimit({
    key,
    policy: input.policy,
    nowMs,
  });
}

export function buildRateLimitHeaders(decision: RateLimitDecision): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", `${decision.limit}`);
  headers.set("X-RateLimit-Remaining", `${decision.remaining}`);
  headers.set("X-RateLimit-Reset", `${Math.ceil(decision.resetAt / 1000)}`);
  headers.set("Retry-After", `${decision.retryAfterSeconds}`);
  return headers;
}

export function createRateLimitResponse(
  decision: RateLimitDecision,
  message = "Too many requests.",
): Response {
  const headers = buildRateLimitHeaders(decision);
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(
    JSON.stringify({
      error: message,
      retryAfterSeconds: decision.retryAfterSeconds,
    }),
    {
      status: 429,
      headers,
    },
  );
}

export function resetMemoryRateLimits() {
  getMemoryStore().clear();
}
