"use client";
import { useRef, type KeyboardEvent } from "react";
import { Icon } from "./icons";

export type ChipOption<T extends string> = { value: T; label: string };

/**
 * A single choice shown as SEPARATE pills that wrap onto as many rows as they need. Use it for choices inside a form
 * (how a match is played, how long it lasts). It never scrolls sideways and is not a tab strip: for switching a VIEW use Segmented.
 * Accessible as a radio group: arrow keys move the choice, the selected pill also shows a check so colour is not the only signal.
 */
export function ChipChoice<T extends string>({ label, options, value, onChange }: { label: string; options: ChipOption<T>[]; value: T; onChange: (v: T) => void }) {
  const box = useRef<HTMLDivElement>(null);
  function key(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    onChange(options[next]!.value);
    box.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
  }
  return (
    <div ref={box} className="rx-chips" role="radiogroup" aria-label={label}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} className="rx-chip" onClick={() => onChange(o.value)} onKeyDown={(e) => key(e, i)}>
            {on ? <Icon name="check" size={16} /> : null}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
