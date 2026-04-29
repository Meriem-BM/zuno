import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="grain">{children}</body>
    </html>
  );
}
