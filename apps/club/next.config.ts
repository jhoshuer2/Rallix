import type { NextConfig } from "next";

/** Public pay links must never be cached, indexed, or leaked through the Referer header. */
const payLinkHeaders = [
  { key: "Cache-Control", value: "no-store, max-age=0" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

/** Sent on every page. The camera is only for the door-card scanner and location only for the arrival check-in; both stay on this site. */
const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const config: NextConfig = { async headers() { return [{ source: "/:path*", headers: baseHeaders }, { source: "/((?!pay/invoice).*)", headers: [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] }, { source: "/pay/invoice/:path*", headers: payLinkHeaders }, { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] }]; }, transpilePackages: ["@rallix/ui", "@rallix/db", "@rallix/stats", "@rallix/payments", "@rallix/config", "@rallix/mailer", "@rallix/media"], serverExternalPackages: ["sharp", "@aws-sdk/client-s3", "web-push"], experimental: { serverActions: { bodySizeLimit: "5mb" } } };
export default config;
