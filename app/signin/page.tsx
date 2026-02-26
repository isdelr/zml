import { dynamicImport } from "@/components/ui/dynamic-import";
import type { Metadata } from "next";
import { Suspense } from "react";

 
const SignInPage = dynamicImport(() => import("@/components/SignInPage"));

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to ZML to create, join, and compete in music leagues with your friends.",
};

export default function SignIn() {
  return (
    <Suspense fallback={null}>
      <SignInPage />
    </Suspense>
  );
}
