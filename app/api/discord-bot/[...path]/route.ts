import { firstNonEmpty } from "@/lib/env";
import { captureServerException } from "@/lib/observability/server";

const ALLOWED_PATHS = new Set([
  "leagues",
  "leaderboard",
  "rounds",
  "upcoming-round",
]);

function getConvexSiteUrl() {
  const convexSiteUrl = firstNonEmpty(
    process.env.CONVEX_SITE_URL,
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
    process.env.CONVEX_SELF_HOSTED_URL,
    process.env.NEXT_PUBLIC_CONVEX_URL,
    "http://localhost:3211",
  );

  return convexSiteUrl!.replace(/\/+$/u, "");
}

function buildUpstreamUrl(pathSegments: string[], request: Request) {
  const [endpoint, ...rest] = pathSegments;
  if (!endpoint || rest.length > 0 || !ALLOWED_PATHS.has(endpoint)) {
    return null;
  }

  const upstreamUrl = new URL(`${getConvexSiteUrl()}/discord-bot/${endpoint}`);
  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;
  return upstreamUrl;
}

async function proxyDiscordBotRequest(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const upstreamUrl = buildUpstreamUrl(path, request);
  if (!upstreamUrl) {
    return new Response(JSON.stringify({ error: "Not found." }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const headers = new Headers();
  for (const headerName of [
    "authorization",
    "x-discord-server-id",
    "x-discord-user-id",
    "content-type",
  ]) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    const contentType = upstreamResponse.headers.get("content-type");
    if (contentType) {
      responseHeaders.set("content-type", contentType);
    }

    return new Response(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    captureServerException(error, {
      tags: {
        route: "/api/discord-bot/[...path]",
      },
      extras: {
        path: path.join("/"),
      },
    });
    return new Response(JSON.stringify({ error: "Upstream request failed." }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyDiscordBotRequest(request, context);
}
