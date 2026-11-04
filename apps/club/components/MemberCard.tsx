"use client";
import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import { newCardToken } from "../lib/attendance-actions";

/** The QR a player shows at the door. The code changes every minute, so a screenshot stops working. */
export function MemberCard({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    // Refresh just after each clock minute starts: the token is tied to the minute, so this is when it changes.
    let timer: ReturnType<typeof setTimeout>;
    const next = () => { timer = setTimeout(run, (60 - new Date().getSeconds()) * 1000 + 1000 - new Date().getMilliseconds()); };
    const run = async () => {
      try { const r = await newCardToken(); if (r.ok) { setToken(r.token); setStale(false); } else setStale(true); } catch { setStale(true); }
      next();
    };
    next();
    return () => clearTimeout(timer);
  }, []);
  const cells = useMemo(() => {
    const q = qrcode(0, "M"); q.addData(token); q.make();
    const n = q.getModuleCount(); const out: Array<[number, number]> = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) out.push([r, c]);
    return { n, out };
  }, [token]);
  const pad = 2, size = cells.n + pad * 2;
  return (
    <figure style={{ margin: 0, textAlign: "center" }}>
      <svg role="img" aria-label="Your member card QR code" viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: 280, background: "#fff", borderRadius: 12, display: "block", margin: "0 auto" }} shapeRendering="crispEdges">
        {cells.out.map(([r, c]) => <rect key={`${r}-${c}`} x={c + pad} y={r + pad} width="1" height="1" fill="#141414" />)}
      </svg>
      <figcaption className="rx-muted" style={{ marginTop: 12 }} role="status">{stale ? "Couldn’t refresh. Check your connection." : "Show this at the door. It refreshes every minute."}</figcaption>
    </figure>
  );
}
