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
          background: "#fff9f7",
          color: "#171717",
          fontSize: 180,
          fontWeight: 800,
          letterSpacing: -10,
        }}
      >
        <div
          style={{
            width: 420,
            height: 420,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 120,
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
