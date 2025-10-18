import { dynamicImport } from "@/components/ui/dynamic-import";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";

const InviteLeaguePage = dynamicImport(
  () => import("@/components/InviteLeaguePage"),
);
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
      openGraph: {
        title: "ZML | Invalid Invite",
        description: "This invite link is invalid or has expired.",
        type: "website",
      },
      twitter: {
        card: "summary",
        title: "ZML | Invalid Invite",
        description: "This invite link is invalid or has expired.",
      },
    };
  }

  const title = `You're invited to join ${inviteInfo.name}`;
  const description = `Accept this invite to join the "${inviteInfo.name}" music league and start competing with ${inviteInfo.activeMemberCount} other ${inviteInfo.activeMemberCount === 1 ? "member" : "members"}.`;
  const url = `https://zml.app/invite/${params.inviteCode}`;
  const ogImageUrl = `/api/og/invite?inviteCode=${params.inviteCode}`;

  return {
    title,
    description,
    openGraph: {
      title: `ZML | ${title}`,
      description,
      type: "website",
      url,
      siteName: "ZML",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `Join ${inviteInfo.name} on ZML`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `ZML | ${title}`,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function InvitePage() {
  return <InviteLeaguePage />;
}
