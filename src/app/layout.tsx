import type { Metadata, Viewport } from "next";
import PwaRegistration from "@/components/PwaRegistration";
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
  themeColor: "#ff444f",
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
