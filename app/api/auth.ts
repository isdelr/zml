import { NextResponse } from "next/server";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";

// A tiny endpoint to touch auth and keep session cookies fresh.
export async function GET() {
  // Calling this ensures auth is read/validated server-side
  await isAuthenticatedNextjs();
  return new NextResponse(null, { status: 204 });
}