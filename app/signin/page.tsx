import type { Metadata } from "next";
import SignInPage from "@/components/SignInPage";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to ZML to create, join, and compete in music leagues with your friends.",
};

export default function SignIn() {
  return <SignInPage />;
}
