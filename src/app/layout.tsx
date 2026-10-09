import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./styles/tokens.css";

// This branch is a standalone vertical slice for the portal-sync feature
// only — the full dontbunk product (calculator, admin panel) lives on
// improved-main. Metadata is deliberately minimal here.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://dontbunk.vercel.app"),
  title: "dontbunk portal sync (test)",
  description: "Syncing attendance from the college portal.",
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

import { Anton, Inter, JetBrains_Mono } from 'next/font/google';

// next/font exposes each face under its own variable; tokens.css maps them onto
// the --font-display / --font-sans / --font-term theme keys the utilities use.
const fontDisplay = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' });
const fontSans = Inter({ subsets: ['latin'], variable: '--font-inter' });
const fontTerm = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${fontDisplay.variable} ${fontSans.variable} ${fontTerm.variable}`}>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
