import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            width: 144,
            height: 144,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            borderRadius: 42,
            background: "#0f172a",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 18,
              right: 18,
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#ff444f",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 4,
              color: "#ffffff",
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: -4,
              lineHeight: 1,
            }}
          >
            <span>P</span>
            <span style={{ color: "#cbd5e1" }}>F</span>
          </div>
        </div>
      </div>
    ),
    size
  );
}
