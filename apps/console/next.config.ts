import type { NextConfig } from "next";

/** The console is for staff only: never framed, never indexed. */
const headers = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const config: NextConfig = { async headers() { return [{ source: "/:path*", headers }]; }, transpilePackages: ["@rallix/ui", "@rallix/payments", "@rallix/mailer", "@rallix/config"] };
export default config;
