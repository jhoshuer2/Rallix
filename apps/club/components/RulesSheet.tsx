"use client";
import { useState } from "react";
import { IconBadge, ListGroup, ListRow, Sheet } from "@rallix/ui";

/** A "Rules" row that opens the full rules in a sheet with a fixed header. */
export function RulesSheet({ rules, name }: { rules: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ListGroup label="Rules"><ListRow media={<IconBadge icon="edit" />} title="Rules" subtitle="How this competition works" onClick={() => setOpen(true)} /></ListGroup>
      <Sheet open={open} onClose={() => setOpen(false)} title={`${name} rules`}><p className="rx-rules">{rules}</p></Sheet>
    </>
  );
}
