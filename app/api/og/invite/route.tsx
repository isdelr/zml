import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex/api";

export const runtime = "edge";

const convex = new ConvexHttpClient(
  (process.env.CONVEX_SELF_HOSTED_URL || process.env.NEXT_PUBLIC_CONVEX_URL)!,
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const inviteCode = searchParams.get("inviteCode");

    if (!inviteCode) {
      return new Response("Missing inviteCode parameter", { status: 400 });
    }

    const inviteInfo = await convex.query(api.leagues.getInviteInfo, {
      inviteCode,
    });

    if (!inviteInfo) {
      return new Response("Invalid invite code", { status: 404 });
    }

    const memberText = `${inviteInfo.activeMemberCount} ${inviteInfo.activeMemberCount === 1 ? "Member" : "Members"}`;
    const spectatorText =
      inviteInfo.spectatorCount > 0
        ? ` • ${inviteInfo.spectatorCount} ${inviteInfo.spectatorCount === 1 ? "Spectator" : "Spectators"}`
        : "";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#201E1C",
            backgroundImage:
              "radial-gradient(circle at 25px 25px, rgba(232, 138, 26, 0.12) 2%, transparent 0%), radial-gradient(circle at 75px 75px, rgba(232, 138, 26, 0.08) 2%, transparent 0%)",
            backgroundSize: "100px 100px",
            padding: "40px 80px",
          }}
        >
          {/* Header Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              backgroundColor: "rgba(232, 138, 26, 0.1)",
              border: "2px solid rgba(232, 138, 26, 0.3)",
              borderRadius: "999px",
              padding: "12px 32px",
              marginBottom: "40px",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                backgroundColor: "#E88A1A",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: "800",
                color: "white",
              }}
            >
              Z
            </div>
            <span
              style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#EDE9E5",
                letterSpacing: "0.05em",
              }}
            >
              ZML
            </span>
          </div>

          {/* Main Content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              maxWidth: "900px",
            }}
          >
            <h1
              style={{
                fontSize: "56px",
                fontWeight: "800",
                color: "white",
                marginBottom: "24px",
                lineHeight: 1.2,
              }}
            >
              You&apos;re invited to join
            </h1>
            <div
              style={{
                fontSize: "72px",
                fontWeight: "900",
                background: "linear-gradient(135deg, #E88A1A 0%, #D4740F 100%)",
                backgroundClip: "text",
                color: "transparent",
                marginBottom: "32px",
                lineHeight: 1.1,
              }}
            >
              {inviteInfo.name}
            </div>
            <p
              style={{
                fontSize: "32px",
                color: "#908A85",
                marginBottom: "48px",
                lineHeight: 1.4,
                maxWidth: "800px",
              }}
            >
              {inviteInfo.description.length > 120
                ? inviteInfo.description.substring(0, 120) + "..."
                : inviteInfo.description}
            </p>

            {/* Stats */}
            <div
              style={{
                display: "flex",
                gap: "32px",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  backgroundColor: "rgba(232, 138, 26, 0.1)",
                  padding: "16px 32px",
                  borderRadius: "16px",
                  border: "1px solid rgba(232, 138, 26, 0.2)",
                }}
              >
                <span
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    color: "#E88A1A",
                  }}
                >
                  {"//"}
                </span>
                <span
                  style={{
                    fontSize: "28px",
                    fontWeight: "600",
                    color: "#EDE9E5",
                  }}
                >
                  {memberText}
                  {spectatorText}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  backgroundColor: "rgba(232, 138, 26, 0.1)",
                  padding: "16px 32px",
                  borderRadius: "16px",
                  border: "1px solid rgba(232, 138, 26, 0.2)",
                }}
              >
                <span
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    color: "#E88A1A",
                  }}
                >
                  *
                </span>
                <span
                  style={{
                    fontSize: "28px",
                    fontWeight: "600",
                    color: "#EDE9E5",
                  }}
                >
                  {inviteInfo.creatorName}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              position: "absolute",
              bottom: "40px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              color: "#706B66",
              fontSize: "24px",
            }}
          >
            <span>Challenge your friends&apos; musical tastes</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error("Error generating OG image:", error);
    return new Response("Failed to generate image", { status: 500 });
  }
}
