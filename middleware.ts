import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

const publicRoutes = createRouteMatcher([
  "/",
  "/signin",
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (publicRoutes(request)) {
    return;
  }

  if (!(await convexAuth.isAuthenticated())) {
    const signinUrl = new URL("/signin", request.url);
    signinUrl.searchParams.set(
      "redirect_url", 
      request.nextUrl.pathname + request.nextUrl.search
    );
    return NextResponse.redirect(signinUrl);
  }
});

// Configure which paths the middleware applies to
export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)", // Match all paths except files with extensions and _next
    "/",                      // Match the root path
    "/(api|trpc)(.*)",        // Match API routes
  ],
};
