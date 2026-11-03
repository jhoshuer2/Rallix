"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, ListGroup, ListRow, Pill, Segmented, Sheet, TextField } from "@rallix/ui";
import { ALERT_LABEL, KIND_LABEL, KIND_ORDER, itemAlert, type ItemKind, type ItemStatus } from "@rallix/stats";
import { adjustStock, deleteFacilityItem, itemHistory, logMaintenance, saveFacilityItem } from "../../../../lib/facility-actions";
import type { FacilityItem, LogLine } from "../../../../lib/facility-queries";

type Form = { id: string | null; kind: ItemKind; name: string; quantity: string; minQuantity: string; status: ItemStatus; note: string };
const blank = (): Form => ({ id: null, kind: "table", name: "", quantity: "1", minQuantity: "", status: "ok", note: "" });
const KIND_OPTIONS = KIND_ORDER.map((k) => ({ value: k, label: KIND_LABEL[k] === "Other" ? "Other" : KIND_LABEL[k]!.replace(/s$/, "") }));
const CONDITIONS: Array<{ value: ItemStatus; label: string }> = [{ value: "ok", label: "Good" }, { value: "needs_attention", label: "Needs attention" }, { value: "out", label: "Out of service" }];
const when = (d: Date) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

export function FacilitiesManager({ items }: { items: FacilityItem[] }) {
  const router = useRouter();
  const [f, setF] = useState<Form | null>(null);
  const [qty, setQty] = useState(0);
  const [history, setHistory] = useState<LogLine[]>([]);
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const close = () => { setF(null); setMsg(undefined); setLog(""); setHistory([]); };
  const open = async (i: FacilityItem) => {
    setF({ id: i.id, kind: i.kind, name: i.name, quantity: String(i.quantity), minQuantity: i.minQuantity === null ? "" : String(i.minQuantity), status: i.status, note: i.note ?? "" });
    setQty(i.quantity); setHistory(await itemHistory(i.id));
  };
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void | Promise<void>) {
    setBusy(true); setMsg(undefined);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    await after?.(); router.refresh();
  }
  const save = () => f && run(() => saveFacilityItem(f.id, { ...f, quantity: Number(f.quantity), minQuantity: f.minQuantity === "" ? null : Number(f.minQuantity) }), close);
  const step = (d: number) => f?.id && run(() => adjustStock(f.id!, d), async () => { setQty((q) => q + d); setHistory(await itemHistory(f.id!)); });
  const addLog = () => f?.id && run(() => logMaintenance(f.id!, log, f.status), async () => { setLog(""); setHistory(await itemHistory(f.id!)); });
  const detail = (i: FacilityItem) => `${i.kind === "table" && i.quantity === 1 ? "" : `${i.quantity} in stock`}${i.minQuantity !== null && i.kind !== "table" ? ` · warn below ${i.minQuantity}` : ""}` || (i.note ?? "");
  const groups = KIND_ORDER.map((k) => [k, items.filter((i) => i.kind === k)] as const).filter(([, l]) => l.length);

  return (
    <>
      {items.length === 0 ? <EmptyState title="Nothing added yet" hint="List your tables, bats and balls so you can see what needs fixing or topping up."
        action={<Button onClick={() => setF(blank())}>Add an item</Button>} /> : (
        <>
          {groups.map(([k, list]) => (
            <div key={k} className="rx-block">
              <p className="rx-label" style={{ margin: "0 0 8px" }}>{KIND_LABEL[k]}</p>
              <ListGroup label={KIND_LABEL[k]}>
                {list.map((i) => { const a = itemAlert(i); return <ListRow key={i.id} title={i.name} subtitle={detail(i) || undefined} trailing={a ? <Pill tone={a === "low" ? "warning" : "warning"}>{ALERT_LABEL[a]}</Pill> : undefined} onClick={() => void open(i)} />; })}
              </ListGroup>
            </div>
          ))}
          <div style={{ marginTop: 16 }}><Button block onClick={() => setF(blank())}>Add an item</Button></div>
        </>
      )}

      <Sheet open={f !== null} onClose={close} title={f?.id ? f.name || "Item" : "Add an item"}>
        {f ? (
          <div style={{ display: "grid", gap: 12 }}>
            <Segmented label="What is it" scroll value={f.kind} onChange={(v) => set("kind", v)} options={KIND_OPTIONS} />
            <TextField label="Name" maxLength={80} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder={f.kind === "table" ? "Table 1" : f.kind === "ball" ? "Training balls" : "Name"} />
            {f.id ? (
              <div>
                <p className="rx-label" style={{ margin: "0 0 8px" }}>In stock: {qty}</p>
                <div className="rx-fieldpair">
                  <Button variant="ghost" disabled={busy || qty < 1} onClick={() => void step(-1)}>Take one out</Button>
                  <Button variant="ghost" disabled={busy} onClick={() => void step(1)}>Add one</Button>
                </div>
              </div>
            ) : <TextField label="How many" type="number" inputMode="numeric" min={0} value={f.quantity} onChange={(e) => set("quantity", e.target.value)} />}
            {f.kind !== "table" ? <TextField label="Warn me below (optional)" type="number" inputMode="numeric" min={0} value={f.minQuantity} onChange={(e) => set("minQuantity", e.target.value)} /> : null}
            <p className="rx-label" style={{ margin: "4px 0 0" }}>Condition</p>
            <Segmented label="Condition" scroll value={f.status} onChange={(v) => set("status", v)} options={CONDITIONS} />
            <TextField label="Note (optional)" maxLength={280} value={f.note} onChange={(e) => set("note", e.target.value)} />
            {msg ? <p role="alert" className="rx-error" style={{ margin: 0 }}>{msg}</p> : null}
            <Button block disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button>
            {f.id ? (
              <>
                <TextField label="Log upkeep" maxLength={280} value={log} onChange={(e) => setLog(e.target.value)} placeholder="Replaced the net" />
                <Button variant="ghost" block disabled={busy || !log.trim()} onClick={() => void addLog()}>Add to history</Button>
                {history.length ? (
                  <ListGroup bare label="History">
                    {history.map((h) => <ListRow key={h.id} title={h.kind === "stock" ? `${(h.delta ?? 0) > 0 ? "+" : ""}${h.delta} in stock${h.note ? ` · ${h.note}` : ""}` : h.note ?? "Note"} subtitle={`${when(h.at)}${h.by ? ` · ${h.by}` : ""}`} />)}
                  </ListGroup>
                ) : null}
                <Button variant="ghost" block disabled={busy} onClick={() => f.id && void run(() => deleteFacilityItem(f.id!), close)}>Delete item</Button>
              </>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
