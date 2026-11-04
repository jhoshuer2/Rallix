"use client";
import { useCallback, useEffect, useState } from "react";
import { summarize, type OutboxItem } from "@rallix/stats";
import { Button } from "@rallix/ui";
import { deleteOutbox, listOutbox } from "../lib/offline-store";
import { syncNow } from "../lib/offline-sync";

/** One quiet line while results scored without a signal wait to send. Renders nothing when the outbox is empty. */
export function SyncBanner() {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const refresh = useCallback(async () => { setItems((await listOutbox()).filter((i) => i.state !== "synced")); }, []);

  useEffect(() => {
    void refresh().then(() => syncNow());
    const again = () => { void syncNow(); void refresh(); };
    const tick = setInterval(again, 60_000);
    const vis = () => { if (document.visibilityState === "visible") again(); };
    window.addEventListener("online", again);
    window.addEventListener("rallix-outbox", refresh);
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(tick); window.removeEventListener("online", again); window.removeEventListener("rallix-outbox", refresh); document.removeEventListener("visibilitychange", vis); };
  }, [refresh]);

  const sum = summarize(items);
  if (!sum.label) return null;
  const stuck = items.filter((i) => i.state === "conflict" || i.state === "failed");
  return (
    <div className="rx-syncbar" role="status" aria-live="polite">
      <div className="rx-syncbar__row">
        <span>{sum.label}</span>
        {sum.waiting ? <Button variant="ghost" onClick={() => void syncNow({ force: true })}>Send now</Button> : null}
      </div>
      {stuck.map((i) => (
        <div key={i.clientRef} className="rx-syncbar__item">
          <p><strong>{i.label}</strong>: {i.games.map((g) => `${g.p1}–${g.p2}`).join(", ")}</p>
          <p>{i.state === "conflict" ? `${i.message ?? "This match was recorded another way."} The recorded result stays.` : (i.message ?? "This result could not be sent.")}</p>
          <Button variant="ghost" onClick={async () => { await deleteOutbox(i.clientRef); void refresh(); }}>Discard</Button>
        </div>
      ))}
    </div>
  );
}
