import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

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
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#101210" },
    { media: "(prefers-color-scheme: light)", color: "#111111" },
  ],
};

// Runs before paint to avoid a flash of the wrong theme.
// Default follows Indian sun time: dark between 19:00 and 06:30 local,
// light otherwise. A saved toggle choice in localStorage always wins.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var theme;
    if (stored === 'light' || stored === 'dark') {
      theme = stored;
    } else {
      var hour = new Date().getHours();
      var minutes = new Date().getMinutes();
      theme = hour >= 19 || hour < 6 || (hour === 6 && minutes < 30) ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
