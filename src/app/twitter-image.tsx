import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const size = { width: 1200, height: 675 };
export const contentType = "image/png";
export const alt = "BrainCoder — 123+ free dev tools, all in your browser";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #581c87 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: 136,
            height: 136,
            borderRadius: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
          }}
        >
          <svg width="82" height="82" viewBox="0 0 32 32" fill="none">
            <path
              d="M17.5 5 L8 18.5 h5.5 L14.5 27 24 13.5 h-5.5 L17.5 5z"
              fill="#fff"
            />
          </svg>
        </div>
        <div
          style={{
            fontSize: 70,
            fontWeight: 800,
            marginTop: 30,
            letterSpacing: -1,
            display: "flex",
          }}
        >
          Brain<span style={{ color: "#a5b4fc" }}>Coder</span>
        </div>
        <div style={{ fontSize: 38, marginTop: 16, opacity: 0.92, textAlign: "center" }}>
          123+ free developer tools — no uploads, no sign-up
        </div>
      </div>
    ),
    size,
  );
}