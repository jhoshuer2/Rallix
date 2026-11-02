import type { NextConfig } from "next";

/** Public pay links must never be cached, indexed, or leaked through the Referer header. */
const payLinkHeaders = [
  { key: "Cache-Control", value: "no-store, max-age=0" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const config: NextConfig = { async headers() { return [{ source: "/pay/invoice/:path*", headers: payLinkHeaders }, { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] }]; }, transpilePackages: ["@rallix/ui", "@rallix/db", "@rallix/stats", "@rallix/payments", "@rallix/config", "@rallix/mailer", "@rallix/media"], serverExternalPackages: ["sharp", "@aws-sdk/client-s3", "web-push"], experimental: { serverActions: { bodySizeLimit: "5mb" } } };
export default config;
