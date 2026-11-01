import type { NextConfig } from "next";

const config: NextConfig = { transpilePackages: ["@rallix/ui", "@rallix/db", "@rallix/stats", "@rallix/payments", "@rallix/config"] };
export default config;
