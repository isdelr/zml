import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export const runtime = "edge";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const leagueId = searchParams.get("leagueId");

    if (!leagueId) {
      return new Response("Missing leagueId parameter", { status: 400 });
    }

    const leagueMetadata = await convex.query(api.leagues.getLeagueMetadata, {
      id: leagueId as Id<"leagues">,
    });

    if (!leagueMetadata) {
      return new Response("Invalid league ID", { status: 404 });
    }

    const memberText = `${leagueMetadata.memberCount} ${leagueMetadata.memberCount === 1 ? "Member" : "Members"}`;

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
            backgroundColor: "#1A1926",
            backgroundImage:
              "radial-gradient(circle at 25px 25px, rgba(99, 102, 241, 0.15) 2%, transparent 0%), radial-gradient(circle at 75px 75px, rgba(139, 92, 246, 0.15) 2%, transparent 0%)",
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
              backgroundColor: "rgba(99, 102, 241, 0.1)",
              border: "2px solid rgba(99, 102, 241, 0.3)",
              borderRadius: "999px",
              padding: "12px 32px",
              marginBottom: "40px",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                backgroundColor: "#6366f1",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}
            >
              🎵
            </div>
            <span
              style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#e0e7ff",
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "32px",
              }}
            >
              <span
                style={{
                  fontSize: "48px",
                }}
              >
                🏆
              </span>
              <span
                style={{
                  fontSize: "48px",
                  fontWeight: "700",
                  color: "#94a3b8",
                }}
              >
                Music League
              </span>
            </div>
            <div
              style={{
                fontSize: "80px",
                fontWeight: "900",
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                backgroundClip: "text",
                color: "transparent",
                marginBottom: "32px",
                lineHeight: 1.1,
              }}
            >
              {leagueMetadata.name}
            </div>
            <p
              style={{
                fontSize: "32px",
                color: "#94a3b8",
                marginBottom: "48px",
                lineHeight: 1.4,
                maxWidth: "800px",
              }}
            >
              {leagueMetadata.description.length > 120
                ? leagueMetadata.description.substring(0, 120) + "..."
                : leagueMetadata.description}
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
                  backgroundColor: "rgba(99, 102, 241, 0.1)",
                  padding: "16px 32px",
                  borderRadius: "16px",
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                }}
              >
                <span style={{ fontSize: "28px" }}>👥</span>
                <span
                  style={{
                    fontSize: "28px",
                    fontWeight: "600",
                    color: "#e0e7ff",
                  }}
                >
                  {memberText}
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
              color: "#64748b",
              fontSize: "24px",
            }}
          >
            <span>Compete • Vote • Discover</span>
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

