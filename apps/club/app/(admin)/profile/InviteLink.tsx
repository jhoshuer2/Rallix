"use client";
import { useState } from "react";
import { Button } from "@rallix/ui";

export function InviteLink({ clubName }: { clubName: string }) {
  const url = "https://paris-arena.rallix.app/join/AB12CD";
  const [copied, setCopied] = useState(false);
  const wa = `https://wa.me/?text=${encodeURIComponent(`Join ${clubName} on Rallix: ${url}`)}`;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p className="rx-muted" style={{ margin: 0, wordBreak: "break-all" }}>{url}</p>
      <Button block onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* clipboard unavailable */ } }}>
        {copied ? "Copied" : "Copy invite link"}
      </Button>
      <a className="rx-btn rx-btn--ghost rx-btn--block" href={wa} target="_blank" rel="noreferrer">Share on WhatsApp</a>
    </div>
  );
}
