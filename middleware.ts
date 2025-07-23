 
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

 
 
 
const isPublicRoute = createRouteMatcher([
  "/",  
  "/signin",  
  "/invite/(.*)",  
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
   
  if (isPublicRoute(request)) {
    return;  
  }

   
  if (!(await convexAuth.isAuthenticated())) {
     
    const signinUrl = new URL("/signin", request.url);

     
     
    const redirectPath = request.nextUrl.pathname + request.nextUrl.search;
    
     
    signinUrl.searchParams.set("redirect_url", redirectPath);
    
     
    return NextResponse.redirect(signinUrl);
  }
  
   
  return;  
});

export const config = {
   
   
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};