// app/api/auth/session/route.ts

import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Touch auth server-side to refresh/extend cookies if needed
    const isAuth = await isAuthenticatedNextjs();

    const response = new NextResponse(
      JSON.stringify({
        authenticated: isAuth,
        timestamp: Date.now()
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

    // For PWA, ensure cookies are properly set with extended options
    if (isAuth) {
      // These headers help with PWA session persistence
      response.headers.set("Set-Cookie", `session-active=true; Path=/; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''}`);
    }

    return response;
  } catch (error) {
    console.error("Session check error:", error);
    return new NextResponse(
      JSON.stringify({
        authenticated: false,
        error: "Session check failed"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}