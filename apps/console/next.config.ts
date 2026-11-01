import type { NextConfig } from "next";

const config: NextConfig = { transpilePackages: ["@rallix/ui", "@rallix/payments", "@rallix/mailer", "@rallix/config"] };
export default config;
