"use client";
import { useState } from "react";
import { IconBadge, ListGroup, ListRow } from "@rallix/ui";

/** Share a competition with friends. Uses the phone's share sheet when there is one (WhatsApp is right there), otherwise copies the link. */
export function ShareRow({ title, text, path }: { title: string; text: string; path: string }) {
  const [note, setNote] = useState<string>();
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) { await navigator.share({ title, text, url }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`); setNote("Link copied.");
    } catch (e) { if ((e as Error).name !== "AbortError") setNote("Couldn’t share. Copy the page link instead."); }
  }
  return (
    <>
      <ListGroup label="Share"><ListRow media={<IconBadge icon="share" />} title="Share" subtitle="Send this to friends" onClick={() => void share()} /></ListGroup>
      <p role="status" className="rx-muted" style={{ margin: "4px 0 0" }}>{note}</p>
    </>
  );
}
