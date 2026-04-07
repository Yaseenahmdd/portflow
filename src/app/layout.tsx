import type { Metadata, Viewport } from "next";
import { Geist_Mono, Manrope } from "next/font/google";
import PwaRegistration from "@/components/PwaRegistration";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portflow — Portfolio Dashboard",
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
    <html
      lang="en"
      className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
