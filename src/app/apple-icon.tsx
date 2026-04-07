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
          background: "#fff9f7",
          color: "#171717",
          fontSize: 72,
          fontWeight: 800,
          letterSpacing: -4,
        }}
      >
        <div
          style={{
            width: 142,
            height: 142,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 42,
            background: "#ff444f",
            color: "#ffffff",
          }}
        >
          P
        </div>
      </div>
    ),
    size
  );
}
