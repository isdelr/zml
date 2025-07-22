// middleware.ts
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

// Define which routes are publicly accessible. All other routes will require authentication.
// We make invite links public so users can see the invite card before signing in.
// The logic to handle the actual sign-in is within the InviteLeaguePage component.
const isPublicRoute = createRouteMatcher([
  "/", // The marketing landing page
  "/signin", // The sign-in page
  "/invite/(.*)", // Matches any invite link, e.g., /invite/somecode
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  // If the route is public, allow access without any checks.
  if (isPublicRoute(request)) {
    return; // Allows the request to proceed.
  }

  // If the route is protected and the user is not authenticated...
  if (!(await convexAuth.isAuthenticated())) {
    // ...we build a URL to the sign-in page.
    const signinUrl = new URL("/signin", request.url);

    // IMPORTANT: We capture the full path the user was trying to access,
    // including any query parameters (e.g., ?tab=standings).
    const redirectPath = request.nextUrl.pathname + request.nextUrl.search;
    
    // We add this path as a `redirect_url` query parameter to the sign-in URL.
    signinUrl.searchParams.set("redirect_url", redirectPath);
    
    // Finally, we redirect the user to the sign-in page.
    return NextResponse.redirect(signinUrl);
  }
  
  // If the user is authenticated, they can access the protected route.
  return; // Allows the request to proceed.
});

export const config = {
  // This matcher ensures the middleware runs on all routes
  // except for static files and other Next.js internal assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};