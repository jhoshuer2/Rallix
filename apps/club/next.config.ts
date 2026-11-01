import type { NextConfig } from "next";

/** Public pay links must never be cached, indexed, or leaked through the Referer header. */
const payLinkHeaders = [
  { key: "Cache-Control", value: "no-store, max-age=0" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const config: NextConfig = { async headers() { return [{ source: "/pay/invoice/:path*", headers: payLinkHeaders }]; }, transpilePackages: ["@rallix/ui", "@rallix/db", "@rallix/stats", "@rallix/payments", "@rallix/config"] };
export default config;
