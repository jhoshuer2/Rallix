"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel, Pill } from "@rallix/ui";
import { decideApplication } from "../lib/application-actions";

type A = { id: string; name: string; level: string; message: string | null; ago: string };

/** Admin: people waiting to join. Approve creates the member; decline sends a polite email. */
export function Applications({ items }: { items: A[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>();
  async function decide(id: string, yes: boolean) {
    setBusy(id); setMsg(undefined);
    const r = await decideApplication(id, yes);
    setBusy(null);
    if (!r.ok) return setMsg(r.error);
    router.refresh();
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((a) => (
        <Panel key={a.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <strong style={{ fontSize: 17 }}>{a.name}</strong><Pill tone="warning">{a.level}</Pill>
          </div>
          <p className="rx-muted" style={{ margin: "4px 0 0", fontSize: 13 }}>Applied {a.ago}</p>
          {a.message ? <p style={{ margin: "10px 0 0" }}>“{a.message}”</p> : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
            <Button variant="ghost" disabled={busy === a.id} onClick={() => decide(a.id, false)} aria-label={`Decline ${a.name}`}>Decline</Button>
            <Button disabled={busy === a.id} onClick={() => decide(a.id, true)} aria-label={`Approve ${a.name}`}>Approve</Button>
          </div>
        </Panel>
      ))}
      {msg ? <p role="alert" className="rx-error">{msg}</p> : null}
    </div>
  );
}
