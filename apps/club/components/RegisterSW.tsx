"use client";
import { useEffect } from "react";

/** Registers the alerts service worker once. Failure is silent: the app works the same without it. */
export function RegisterSW() {
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {}); }, []);
  return null;
}
