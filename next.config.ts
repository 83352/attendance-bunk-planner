import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opening the dev server from a phone on the same Wi-Fi
  // (http://<LAN-IP>:3000). Production is unaffected.
  allowedDevOrigins: ['192.168.29.143'],
};

export default nextConfig;
