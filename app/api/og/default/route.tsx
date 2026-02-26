import { ImageResponse } from "next/og";

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
          backgroundColor: "#201E1C",
          backgroundImage:
            "radial-gradient(circle at 25px 25px, rgba(232, 138, 26, 0.12) 2%, transparent 0%), radial-gradient(circle at 75px 75px, rgba(232, 138, 26, 0.08) 2%, transparent 0%)",
          backgroundSize: "100px 100px",
          padding: "40px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              backgroundColor: "#E88A1A",
              borderRadius: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "48px",
              fontWeight: "800",
              color: "white",
              marginBottom: "40px",
            }}
          >
            Z
          </div>
          <div
            style={{
              fontSize: "96px",
              fontWeight: "900",
              background: "linear-gradient(135deg, #E88A1A 0%, #D4740F 100%)",
              backgroundClip: "text",
              color: "transparent",
              marginBottom: "24px",
              letterSpacing: "0.05em",
            }}
          >
            ZML
          </div>
          <p
            style={{
              fontSize: "36px",
              color: "#908A85",
              lineHeight: 1.4,
              maxWidth: "700px",
            }}
          >
            Challenge your friends&apos; musical tastes
          </p>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
