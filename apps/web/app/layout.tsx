import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zuno, a terminal-native copilot for Uniswap LPs",
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
    <html
      lang="en"
      className={`${fraunces.variable} ${geist.variable} ${jetbrains.variable}`}
    >
      <body className="grain">{children}</body>
    </html>
  );
}
