import type { Metadata, Viewport } from "next";
import PwaRegistration from "@/components/PwaRegistration";
import "@fontsource-variable/ibm-plex-sans/wght.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portflow - Portfolio Dashboard",
  description:
    "Track your investments across Indian stocks, US ETFs, crypto, and UAE markets in real-time.",
  keywords: ["portfolio", "investment", "tracker", "stocks", "crypto", "ETF"],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Portflow",
  },
};

export const viewport: Viewport = {
  themeColor: "#14202d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
