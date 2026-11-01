import type { ReactNode } from "react";
import "@rallix/ui/fonts.css";
import "@rallix/ui/tokens.css";
import "./console.css";

/** Every page reads the session or database per request, so nothing may be prerendered at build time. */
export const dynamic = "force-dynamic";

export const metadata = { title: "Rallix Console", description: "Rallix platform console", robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
