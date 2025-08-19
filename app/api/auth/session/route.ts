import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";

export async function GET() {
  // Touch auth server-side to refresh/extend cookies if needed
  await isAuthenticatedNextjs();
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}