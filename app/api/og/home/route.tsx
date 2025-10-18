import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

export async function GET() {
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
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "48px",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              backgroundColor: "#6366f1",
              borderRadius: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "48px",
            }}
          >
            🎵
          </div>
          <span
            style={{
              fontSize: "80px",
              fontWeight: "900",
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              backgroundClip: "text",
              color: "transparent",
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
              fontSize: "64px",
              fontWeight: "900",
              color: "white",
              marginBottom: "24px",
              lineHeight: 1.2,
            }}
          >
            Challenge Your Friends&apos;
            <br />
            Musical Tastes
          </h1>
          <p
            style={{
              fontSize: "36px",
              color: "#94a3b8",
              marginBottom: "48px",
              lineHeight: 1.4,
            }}
          >
            Create leagues, set themed rounds, and vote for the best tracks
          </p>

          {/* Features */}
          <div
            style={{
              display: "flex",
              gap: "24px",
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
                padding: "16px 28px",
                borderRadius: "16px",
                border: "1px solid rgba(99, 102, 241, 0.2)",
              }}
            >
              <span style={{ fontSize: "32px" }}>🏆</span>
              <span
                style={{
                  fontSize: "28px",
                  fontWeight: "600",
                  color: "#e0e7ff",
                }}
              >
                Compete
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                backgroundColor: "rgba(99, 102, 241, 0.1)",
                padding: "16px 28px",
                borderRadius: "16px",
                border: "1px solid rgba(99, 102, 241, 0.2)",
              }}
            >
              <span style={{ fontSize: "32px" }}>🗳️</span>
              <span
                style={{
                  fontSize: "28px",
                  fontWeight: "600",
                  color: "#e0e7ff",
                }}
              >
                Vote
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                backgroundColor: "rgba(99, 102, 241, 0.1)",
                padding: "16px 28px",
                borderRadius: "16px",
                border: "1px solid rgba(99, 102, 241, 0.2)",
              }}
            >
              <span style={{ fontSize: "32px" }}>🎧</span>
              <span
                style={{
                  fontSize: "28px",
                  fontWeight: "600",
                  color: "#e0e7ff",
                }}
              >
                Discover
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

