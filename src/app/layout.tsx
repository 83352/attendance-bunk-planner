import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BUNK//PLANNER — Attendance Bunk Calculator",
  description: "A retro attendance planner for making smarter bunking decisions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
