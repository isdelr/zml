import { getToken } from "@convex-dev/better-auth/utils";
import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  createRateLimitResponse,
  type RateLimitPolicy,
} from "@/lib/security/rate-limit";

const convexSiteUrl =
  process.env.CONVEX_SITE_URL ??
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  "http://localhost:3211";

const AUTH_RATE_LIMIT_POLICY = {
  name: "auth",
  limit: 20,
  windowMs: 60 * 1000,
} satisfies RateLimitPolicy;

const HIGH_COST_ROUTE_POLICIES: Array<{
  pattern: RegExp;
  policy: RateLimitPolicy;
}> = [
  {
    pattern: /^\/api\/storage\/upload-file$/,
    policy: {
      name: "storage-upload",
      limit: 60,
      windowMs: 10 * 60 * 1000,
    },
  },
  {
    pattern: /^\/api\/submissions\/upload-song-file$/,
    policy: {
      name: "submission-upload",
      limit: 40,
      windowMs: 10 * 60 * 1000,
    },
  },
  {
    pattern: /^\/api\/submissions\/generate-waveform$/,
    policy: {
      name: "waveform-generation",
      limit: 20,
      windowMs: 5 * 60 * 1000,
    },
  },
  {
    pattern: /^\/api\/discord-bot(?:\/.*)?$/,
    policy: {
      name: "discord-bot",
      limit: 120,
      windowMs: 60 * 1000,
    },
  },
  {
    pattern: /^\/api\/admin\/media\/maintenance$/,
    policy: {
      name: "media-maintenance",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    },
  },
];

const SECRET_ROUTE_CONFIGS = [
  {
    pathname: "/api/admin/media/maintenance",
    envVarName: "MEDIA_MAINTENANCE_SECRET",
  },
  {
    pathname: "/api/internal/submissions/process-audio",
    envVarName: "SUBMISSION_PROCESSING_SECRET",
  },
] as const;

const PUBLIC_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/signin$/,
  /^\/invite\/.+$/,
  /^\/api\/auth\/session$/,
  /^\/api\/auth(?:\/.*)?$/,
  /^\/api\/discord-bot(?:\/.*)?$/,
  /^\/api\/media(?:\/.*)?$/,
  /^\/manifest\.(?:webmanifest|json|js)$/,
  /^\/robots\.txt$/,
  /^\/offline\.html$/,
  /^\/serwist(?:\/.*)?$/,
  /^\/icons(?:\/.*)?$/,
  /^\/api\/health$/,
];

const isPublicRoute = (pathname: string) =>
  PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));

const getRateLimitPolicy = (pathname: string) =>
  HIGH_COST_ROUTE_POLICIES.find((entry) => entry.pattern.test(pathname))?.policy ??
  (pathname.startsWith("/api/auth/") ? AUTH_RATE_LIMIT_POLICY : null);

const getSecretRouteConfig = (pathname: string) =>
  SECRET_ROUTE_CONFIGS.find((route) => route.pathname === pathname) ?? null;

function getJwtSubject(token: string | undefined) {
  if (!token) {
    return null;
  }

  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }

  try {
    const normalizedPayload = segments[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(segments[1].length / 4) * 4, "=");
    const payload = JSON.parse(
      atob(normalizedPayload),
    ) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub.length > 0
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

function createUnauthorizedJsonResponse(message: string, status = 401) {
  return NextResponse.json({ error: message }, { status });
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const secretRoute = getSecretRouteConfig(pathname);

  if (secretRoute) {
    const expectedSecret = process.env[secretRoute.envVarName];
    if (!expectedSecret) {
      return createUnauthorizedJsonResponse(
        `${secretRoute.envVarName} is not configured.`,
        500,
      );
    }

    const providedSecret = getBearerToken(request);
    if (providedSecret !== expectedSecret) {
      return createUnauthorizedJsonResponse("Unauthorized.");
    }

    return NextResponse.next();
  }

  let userId: string | null = null;
  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth/")
  ) {
    const { token } = await getToken(convexSiteUrl, request.headers);
    userId = getJwtSubject(token);
  }

  const policy = getRateLimitPolicy(pathname);
  if (policy) {
    const decision = await checkRateLimit({
      request,
      policy,
      userId,
    });
    if (!decision.allowed) {
      return createRateLimitResponse(decision);
    }
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const { token } = await getToken(convexSiteUrl, request.headers);
  if (token) {
    return NextResponse.next();
  }

  const signinUrl = new URL("/signin", request.url);
  signinUrl.searchParams.set(
    "redirect_url",
    pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(signinUrl);
}

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)", // Match all paths except files and _next
    "/",
    "/(api|trpc)(.*)",
  ],
};
