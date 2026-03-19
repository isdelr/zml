import SignInPage from "@/components/SignInPage";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to ZML to create, join, and compete in music leagues with your friends.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function readFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await connection();

  const params = await searchParams;

  return (
    <SignInPage
      authError={readFirstSearchParam(params.error)}
      authErrorDescription={readFirstSearchParam(params.error_description)}
      redirectUrl={readFirstSearchParam(params.redirect_url)}
    />
  );
}
