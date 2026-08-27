import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./styles/tokens.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://dontbunk.vercel.app"),
  title: "dontbunk — Can I bunk today?",
  description: "Can I bunk today? Check your safe bunk count in seconds.",
  openGraph: {
    title: "Can I bunk today?",
    description: "Check your safe bunk count in seconds.",
    images: ["/og-card.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Can I bunk today?",
    description: "Check your safe bunk count in seconds.",
    images: ["/og-card.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
