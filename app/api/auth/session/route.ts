import { getToken } from "@convex-dev/better-auth/utils";
import { NextResponse } from "next/server";
import { firstNonEmpty } from "@/lib/env";

const convexSiteUrl = firstNonEmpty(
  process.env.CONVEX_SITE_URL,
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  "http://localhost:3211",
)!;

export async function GET(request: Request) {
  try {
    const { token } = await getToken(convexSiteUrl, request.headers);
    const isAuth = Boolean(token);

    return new NextResponse(
      JSON.stringify({
        authenticated: isAuth,
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  } catch (error) {
    console.error("Session check error:", error);
    return new NextResponse(
      JSON.stringify({
        authenticated: false,
        error: "Session check failed",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
