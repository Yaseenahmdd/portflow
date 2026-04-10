import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Portflow",
    short_name: "Portflow",
    description: "Track portfolio performance across markets with a mobile-friendly investment dashboard.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#fff9f7",
    theme_color: "#ff444f",
    orientation: "portrait",
    icons: [
      {
        src: "/icon?size=192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon?size=512",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
