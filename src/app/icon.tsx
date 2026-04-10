import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
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
            width: 420,
            height: 420,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            borderRadius: 120,
            background: "#0f172a",
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 52,
              right: 52,
              width: 34,
              height: 34,
              borderRadius: 999,
              background: "#ff444f",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              color: "#ffffff",
              fontSize: 158,
              fontWeight: 800,
              letterSpacing: -12,
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
