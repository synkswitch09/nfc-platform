import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://api.stripe.com; frame-src https://checkout.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'" }
      ]
    }];
  }
};

export default nextConfig;
