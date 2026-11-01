import type { ReactNode } from "react";
import "@rallix/ui/fonts.css";
import "@rallix/ui/tokens.css";
import "@rallix/ui/components.css";

/** Every page reads the session or database per request, so nothing may be prerendered at build time. */
export const dynamic = "force-dynamic";

export const metadata = { title: "Rallix", description: "Table tennis club management" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
