"use client";
import { useEffect } from "react";

/**
 * Registers the service worker once. Failure is silent: the app works the same without it.
 * Only a production build asks it to keep the offline scoring files (`?offline=1`); in development it only shows alerts,
 * so a dev server never serves stale code.
 */
export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const url = process.env.NODE_ENV === "production" ? "/sw.js?offline=1" : "/sw.js";
    navigator.serviceWorker.register(url, { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
