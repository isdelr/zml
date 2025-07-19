import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// All routes except the landing page and the sign-in page are protected.
const isProtectedRoute = createRouteMatcher([
  "/active-rounds(.*)",
  "/bookmarked(.*)",
  "/explore(.*)",
  "/leagues/(.*)",
  "/my-submissions(.*)",
  "/server(.*)",
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
    // Redirect unauthenticated users from protected pages to the sign-in page.
    return nextjsMiddlewareRedirect(request, "/signin");
  }
});

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};