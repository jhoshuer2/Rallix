"use client";
import { useEffect, useState } from "react";
import { Button } from "@rallix/ui";
import { createInvite } from "../lib/actions";

export function InviteLink({ clubName, initialCode }: { clubName: string; initialCode: string | null }) {
  const [code, setCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  // window only exists in the browser: read the origin after mount so server rendering never touches it.
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const url = code ? `${origin}/join/${code}` : null;
  async function make() { const r = await createInvite(); if (r.ok) setCode(r.code); else setError(r.error); }
  const wa = url ? `https://wa.me/?text=${encodeURIComponent(`Join ${clubName} on Rallix: ${url}`)}` : "#";
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {url ? <p className="rx-muted" style={{ margin: 0, wordBreak: "break-all" }}>{url}</p> : <p className="rx-muted" style={{ margin: 0 }}>Create a link, then share it in your WhatsApp group. It works for 30 days.</p>}
      {url ? (
        <>
          <Button block onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setError("Could not copy. Select the link and copy it."); } }}>{copied ? "Copied" : "Copy invite link"}</Button>
          <a className="rx-btn rx-btn--ghost rx-btn--block" href={wa} target="_blank" rel="noreferrer">Share on WhatsApp</a>
          <Button variant="ghost" block onClick={make}>Create a new link</Button>
        </>
      ) : <Button block onClick={make}>Create invite link</Button>}
      {error ? <p className="rx-error" role="alert">{error}</p> : null}
    </div>
  );
}
