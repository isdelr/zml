import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// Define the routes that are publicly accessible.
// All other routes will require authentication.
const isPublicRoute = createRouteMatcher([
  "/",
  "/signin",
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  // If the route is not public and the user is not authenticated,
  // redirect them to the signin page.
  if (!isPublicRoute(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/signin");
  }
});

export const config = {
  // The following matcher runs middleware on all routes
  // except for static files and Next.js-specific assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};