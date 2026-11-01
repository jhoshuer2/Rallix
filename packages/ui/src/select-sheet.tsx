"use client";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { Sheet } from "./sheet";

export type SelectOption = { value: string; label: string; /** Optional leading visual (icon or badge). Decorative: the label carries the meaning. */ icon?: ReactNode };

/**
 * A dropdown that opens as a bottom sheet (phone-friendly, 44px rows, optional search).
 * Use instead of a native <select> anywhere in the club app. Controlled: pass `value` and `onChange`.
 */
export function SelectSheet({ label, title, value, onChange, options, placeholder = "Choose…", searchable = false, searchPlaceholder = "Search", emptyText = "No matches", id }: {
  label: string; title?: string; value: string; onChange: (value: string) => void; options: SelectOption[];
  placeholder?: string; searchable?: boolean; searchPlaceholder?: string; emptyText?: string; id?: string;
}) {
  const auto = useId();
  const triggerId = id ?? auto;
  const labelId = `${triggerId}-label`;
  const valueId = `${triggerId}-value`;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [options, q]);
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) selectedRef.current?.scrollIntoView({ block: "center" }); }, [open]);
  const close = () => { setOpen(false); setQ(""); };
  const pick = (v: string) => { onChange(v); close(); };

  return (
    <div className="rx-field">
      <span className="rx-label" id={labelId}>{label}</span>
      <button type="button" id={triggerId} className="rx-input rx-pick__trigger" aria-haspopup="dialog" aria-expanded={open} aria-labelledby={`${labelId} ${valueId}`} onClick={() => setOpen(true)}>
        {selected?.icon ? <span className="rx-pick__icon" aria-hidden="true">{selected.icon}</span> : null}
        <span className="rx-pick__value" id={valueId} data-empty={selected ? undefined : "true"}>{selected ? selected.label : placeholder}</span>
        <Icon name="chevron-down" size={20} aria-hidden="true" />
      </button>
      <Sheet open={open} onClose={close} title={title ?? label}>
        {searchable ? (
          <div className="rx-pick__search">
            <Icon name="search" size={20} aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} autoComplete="off" enterKeyHint="search" />
          </div>
        ) : null}
        <div role="radiogroup" aria-label={label} className="rx-pick__list">
          {shown.length === 0 ? <p className="rx-pick__empty" role="status">{emptyText}</p> : null}
          {shown.map((o) => {
            const on = o.value === value;
            return (
              <button key={o.value} type="button" role="radio" aria-checked={on} ref={on ? selectedRef : undefined} className="rx-pick__row" data-selected={on ? "true" : undefined} onClick={() => pick(o.value)}>
                {o.icon ? <span className="rx-pick__icon" aria-hidden="true">{o.icon}</span> : null}
                <span className="rx-pick__label">{o.label}</span>
                {on ? <Icon name="check" size={20} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
