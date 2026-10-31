import type { ReactNode } from "react";
import "@rallix/ui/fonts.css";
import "@rallix/ui/tokens.css";
import "./console.css";

export const metadata = { title: "Rallix Console", description: "Rallix platform console", robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
