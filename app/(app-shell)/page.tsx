import { redirect } from "next/navigation";
import { ExplorePage } from "@/components/ExplorePage";
import { isServerAuthenticated } from "@/lib/auth-server";

export default async function HomePage() {
  let userIsAuthenticated = false;
  try {
    userIsAuthenticated = await isServerAuthenticated();
  } catch {
    // Auth service unavailable, treat as unauthenticated.
  }

  if (!userIsAuthenticated) {
    redirect("/signin");
  }

  return <ExplorePage />;
}
