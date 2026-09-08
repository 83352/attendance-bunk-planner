import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./styles/tokens.css";

const OG_IMAGE_ALT =
  "dontbunk — the pixel percent mark beside the wordmark, over the line 'can i bunk today?'";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://dontbunk.vercel.app"),
  title: "dontbunk — Can I bunk today?",
  description: "Can I bunk today? Check your safe bunk count in seconds.",
  openGraph: {
    title: "Can I bunk today?",
    description: "Check your safe bunk count in seconds.",
    // Declared dimensions let a scraper lay the large card out on first fetch
    // instead of waiting for the image itself. Next only infers these for the
    // `opengraph-image` file convention, not for a path like this one.
    images: [{ url: "/og-card.png", width: 1200, height: 630, alt: OG_IMAGE_ALT }],
    siteName: "dontbunk",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Can I bunk today?",
    description: "Check your safe bunk count in seconds.",
    images: [{ url: "/og-card.png", width: 1200, height: 630, alt: OG_IMAGE_ALT }],
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
