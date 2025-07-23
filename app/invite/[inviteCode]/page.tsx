import { dynamicImport } from "@/components/ui/dynamic-import";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { Metadata } from "next";

 
const InviteLeaguePage = dynamicImport(() => import("@/components/InviteLeaguePage"));

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function generateMetadata(
  props: {
    params: Promise<{ inviteCode: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
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