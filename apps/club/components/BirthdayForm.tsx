"use client";
import { useState } from "react";
import { Button, Switch, useToast } from "@rallix/ui";
import { saveBirthday } from "../lib/birthday-actions";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Month and day only: we never ask for a year and never show an age. Shown to the club by default; the person can switch it off. */
export function BirthdayForm({ month, day, show }: { month: number | null; day: number | null; show: boolean }) {
  const [m, setM] = useState<string>(month ? String(month) : "");
  const [d, setD] = useState<string>(day ? String(day) : "");
  const [visible, setVisible] = useState(show);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save(clear = false) {
    if (!clear && (!m || !d)) return toast.error("Choose a month and a day.");
    setBusy(true);
    const r = await saveBirthday({ month: clear ? null : Number(m), day: clear ? null : Number(d), show: visible });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    if (clear) { setM(""); setD(""); }
    toast.success(clear ? "Birthday removed. Carry on with what you were doing." : visible ? "Birthday saved. Your club can see it when it comes up. Carry on with what you were doing." : "Birthday saved, and hidden from the club. Carry on with what you were doing.");
  }

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <p className="rx-muted" style={{ margin: "0 0 12px" }}>Optional. Only the day and month are used, so your club can celebrate with you. We never show your age.</p>
      <div className="rx-fieldpair">
        <div className="rx-field">
          <label className="rx-label" htmlFor="birth-month">Month</label>
          <div className="rx-input"><select id="birth-month" value={m} onChange={(e) => setM(e.target.value)}><option value="">Month</option>{MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select></div>
        </div>
        <div className="rx-field">
          <label className="rx-label" htmlFor="birth-day">Day</label>
          <div className="rx-input"><select id="birth-day" value={d} onChange={(e) => setD(e.target.value)}><option value="">Day</option>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44, margin: "4px 0 12px" }}>
        <span id="birth-show">Show my birthday to the club</span>
        <Switch label="Show my birthday to the club" checked={visible} onChange={setVisible} />
      </div>
      <Button type="submit" block disabled={busy}>{busy ? "Saving…" : "Save birthday"}</Button>
      {month ? <div style={{ marginTop: 8 }}><Button type="button" variant="ghost" block disabled={busy} onClick={() => void save(true)}>Remove my birthday</Button></div> : null}
    </form>
  );
}
