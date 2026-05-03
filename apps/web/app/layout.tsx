import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zuno",
  description:
    "Zuno uses a small network of AXL-connected agents to inspect positions, debate rebalances, and produce execution-ready liquidity plans.",
  metadataBase: new URL("https://zuno.dev"),
  openGraph: {
    title: "Zuno",
    description:
      "A terminal-native copilot for Uniswap LPs, built on a small network of AXL-connected agents.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plexMono.variable}>
      <body>{children}</body>
    </html>
  );
}
