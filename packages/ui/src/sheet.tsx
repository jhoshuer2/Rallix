"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons";

/** Bottom sheet on a native <dialog>: focus trap, Escape and backdrop click to close. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="rx-sheetdlg" aria-label={title} onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="rx-sheetdlg__panel">
        <div className="rx-sheetdlg__head">
          <h2 className="rx-title" style={{ fontSize: 18 }}>{title}</h2>
          <button type="button" className="rx-iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" size={20} /></button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
