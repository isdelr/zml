import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

const publicRoutes = createRouteMatcher([
  "/",                      // Landing/Home page
  "/signin",                // Sign-in page
  "/invite/(.*)",           // Invite links (e.g., /invite/some-code)
  "/api/auth/session",      // API route for session management
  // "/manifest.js",           // PWA manifest file
  // "/robots.txt",             // SEO robots file
  // "/sw.js",                 // Service Worker for PWA
  // "/workbox-.*",            // Workbox files for PWA
  "/icons/(.*)",            // PWA icons
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

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)", // Match all paths except files and _next
    "/",
    "/(api|trpc)(.*)",
  ],
};