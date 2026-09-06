import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opening the dev server from a phone on the same Wi-Fi
  // (http://<LAN-IP>:3000). Production is unaffected.
  allowedDevOrigins: ['192.168.29.143'],
  // Stop advertising the framework in responses.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Blocks this site from being framed by another origin (clickjacking).
          // frame-ancestors is the modern replacement for X-Frame-Options; both
          // are set since older browsers only understand the header form.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
