"use client";
import { useState } from "react";
import { Button } from "@rallix/ui";

/** Demo only: the real flow opens Paystack checkout and confirms via webhook. */
export function PayButton({ amount }: { amount: string }) {
  const [s, setS] = useState<"idle" | "busy" | "done">("idle");
  return (
    <>
      <Button block disabled={s !== "idle"} onClick={() => { setS("busy"); setTimeout(() => setS("done"), 1200); }}>
        {s === "idle" ? `Pay ${amount}` : s === "busy" ? "Opening Paystack…" : "Paid (demo)"}
      </Button>
      <p role="status" className="rx-muted" style={{ margin: "8px 0 0", fontSize: 12 }}>{s === "done" ? "Demo only. No payment was made." : ""}</p>
    </>
  );
}
