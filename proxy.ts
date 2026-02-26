import { getToken } from "@convex-dev/better-auth/utils";
import { NextRequest, NextResponse } from "next/server";

const convexSiteUrl =
  process.env.CONVEX_SITE_URL ??
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  "http://localhost:3211";

const PUBLIC_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/signin$/,
  /^\/invite\/.+$/,
  /^\/api\/auth\/session$/,
  /^\/api\/auth(?:\/.*)?$/,
  /^\/manifest\.(?:webmanifest|json|js)$/,
  /^\/robots\.txt$/,
  /^\/offline\.html$/,
  /^\/serwist(?:\/.*)?$/,
  /^\/icons(?:\/.*)?$/,
  /^\/api\/health$/,
];

const isPublicRoute = (pathname: string) =>
  PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));

export async function proxy(request: NextRequest) {
  if (isPublicRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const { token } = await getToken(convexSiteUrl, request.headers);
  if (token) {
    return NextResponse.next();
  }

  const signinUrl = new URL("/signin", request.url);
  signinUrl.searchParams.set(
    "redirect_url",
    request.nextUrl.pathname + request.nextUrl.search,
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
