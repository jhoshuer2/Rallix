"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { dismissToast, pushToast, toastSeconds, type ToastItem, type ToastTone } from "./toast-queue";

type Api = { success: (message: string) => void; error: (message: string) => void; info: (message: string) => void };
const Ctx = createContext<Api | null>(null);

/**
 * One place for "that worked" and "that failed". Mount ONCE near the root so a toast survives moving to another screen.
 * It sits at the TOP, just under the app bar so Back stays tappable (the keyboard is usually still open after tapping Save and would hide a bottom message), is read aloud
 * (success politely, failure assertively), has a 44px OK button, pauses while hovered or focused, and does not animate under reduced motion.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const add = useCallback((tone: ToastTone, message: string) => { setItems((l) => pushToast(l, { tone, message }, next.current++)); }, []);
  const close = useCallback((id: number) => setItems((l) => dismissToast(l, id)), []);
  const api = useMemo<Api>(() => ({ success: (m) => add("success", m), error: (m) => add("error", m), info: (m) => add("info", m) }), [add]);
  // A modal sheet (<dialog>) sits in the browser's top layer, above any z-index. A manual popover joins the top layer too, and opened later it stacks above the sheet.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!el?.showPopover) return;
    try { if (items.length) { if (!el.matches(":popover-open")) el.showPopover(); } else if (el.matches(":popover-open")) el.hidePopover?.(); } catch { /* an older browser: the fixed position below still shows it */ }
  }, [items]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="rx-toasts" ref={box} {...({ popover: "manual" } as Record<string, string>)}>
        {/* One polite and one assertive live region, always present, so screen readers announce each new toast. */}
        <div role="status" aria-live="polite">{items.filter((t) => t.tone !== "error").map((t) => <ToastCard key={t.id} item={t} onClose={close} />)}</div>
        <div role="alert" aria-live="assertive">{items.filter((t) => t.tone === "error").map((t) => <ToastCard key={t.id} item={t} onClose={close} />)}</div>
      </div>
    </Ctx.Provider>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => onClose(item.id), toastSeconds(item.tone) * 1000);
    return () => clearTimeout(t);
  }, [paused, item.id, item.tone, onClose]);
  return (
    <div className={`rx-toast rx-toast--${item.tone}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <span className="rx-toast__icon" aria-hidden="true"><Icon name={item.tone === "error" ? "close" : "check"} size={18} /></span>
      <span className="rx-toast__text">{item.message}</span>
      <button type="button" className="rx-toast__close" onClick={() => onClose(item.id)} aria-label="Dismiss message">OK</button>
    </div>
  );
}

/** `const toast = useToast(); toast.success("Saved.")`. Outside a provider (a test, a story) it does nothing instead of crashing. */
export function useToast(): Api {
  return useContext(Ctx) ?? { success: () => {}, error: () => {}, info: () => {} };
}
