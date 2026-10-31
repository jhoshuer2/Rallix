import type { NextConfig } from "next";

const config: NextConfig = { transpilePackages: ["@rallix/ui", "@rallix/db", "@rallix/stats"] };
export default config;
