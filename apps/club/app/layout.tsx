import type { Viewport } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@rallix/ui";
import { RegisterSW } from "../components/RegisterSW";
import { SyncBanner } from "../components/SyncBanner";
import "@rallix/ui/fonts.css";
import "@rallix/ui/tokens.css";
import "@rallix/ui/components.css";

/** Every page reads the session or database per request, so nothing may be prerendered at build time. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rallix", description: "Table tennis club management",
  appleWebApp: { capable: true, title: "Rallix", statusBarStyle: "default" as const },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#1b6fe0", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><ToastProvider><SyncBanner />{children}<RegisterSW /></ToastProvider></body>
    </html>
  );
}
