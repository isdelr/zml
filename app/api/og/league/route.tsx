import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";

export const runtime = "edge";

const convex = new ConvexHttpClient(
  (process.env.CONVEX_SELF_HOSTED_URL || process.env.NEXT_PUBLIC_CONVEX_URL)!,
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const leagueId = searchParams.get("leagueId");

    if (!leagueId) {
      return new Response("Missing leagueId parameter", { status: 400 });
    }

    const leagueMetadata = await convex.query(api.leagues.getLeagueMetadata, {
      leagueId: leagueId as Id<"leagues">,
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
                  fontWeight: "700",
                  color: "#E88A1A",
                }}
              >
                #
              </span>
              <span
                style={{
                  fontSize: "48px",
                  fontWeight: "700",
                  color: "#908A85",
                }}
              >
                Music League
              </span>
            </div>
            <div
              style={{
                fontSize: "80px",
                fontWeight: "900",
                background: "linear-gradient(135deg, #E88A1A 0%, #D4740F 100%)",
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
                color: "#908A85",
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
