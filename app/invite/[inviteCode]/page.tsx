import { dynamicImport } from "@/components/ui/dynamic-import";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { Metadata } from "next";

// Dynamically import the InviteLeaguePage component
const InviteLeaguePage = dynamicImport(() => import("@/components/InviteLeaguePage"));

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function generateMetadata({
  params,
}: {
  params: { inviteCode: string };
}): Promise<Metadata> {
  const inviteInfo = await convex.query(api.leagues.getInviteInfo, {
    inviteCode: params.inviteCode,
  });

  if (!inviteInfo) {
    return {
      title: "Invalid Invite",
      description: "This invite link is invalid or has expired.",
    };
  }

  return {
    title: `You're invited to join ${inviteInfo.name}`,
    description: `Accept this invite to join the "${inviteInfo.name}" music league and start competing with ${inviteInfo.memberCount} other members.`,
  };
}

export default function InvitePage() {
  return <InviteLeaguePage />;
}