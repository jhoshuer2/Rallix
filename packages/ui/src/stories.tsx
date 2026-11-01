"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { Photo } from "./premium";

export type StoryItem = {
  id: string; live?: boolean; caption: string; title: string; subtitle: string;
  a: { name: string; photo?: string | null }; b: { name: string; photo?: string | null }; score?: string; href?: string; cta?: string;
};

const SEEN_KEY = "rx-seen-stories";
const DURATION = 5000;
const readSeen = (): string[] => { try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"); return Array.isArray(v) ? v.slice(-200) : []; } catch { return []; } };
const writeSeen = (ids: string[]) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200))); } catch { /* private window: seen state just won't persist */ } };

/**
 * Instagram-style highlights: a row of ringed circles that opens a full-screen viewer.
 * Ring = unseen (rust to yellow), muted = seen, LIVE tag for a live match. Works without localStorage.
 */
export function Stories({ items, label = "Highlights" }: { items: StoryItem[]; label?: string }) {
  const [seen, setSeen] = useState<string[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { setSeen(readSeen()); }, []);
  // Give focus back to the ring that opened the viewer, but only after the modal dialog is gone (the page is inert while it is open).
  const wasOpen = useRef(false);
  useEffect(() => { if (open !== null) wasOpen.current = true; else if (wasOpen.current) { wasOpen.current = false; opener.current?.focus(); } }, [open]);
  const markSeen = useCallback((id: string) => setSeen((s) => { if (s.includes(id)) return s; const n = [...s, id]; writeSeen(n); return n; }), []);
  if (items.length === 0) return null;
  return (
    <>
      <div className="rx-stories" role="list" aria-label={label}>
        {items.map((it, i) => {
          const isSeen = seen.includes(it.id);
          return (
            <div className="rx-story" role="listitem" key={it.id}>
              <button type="button" className={`rx-story__ring${isSeen && !it.live ? " is-seen" : ""}`} aria-label={`${it.live ? "Live: " : ""}${it.caption}. Open highlight`}
                onClick={(e) => { opener.current = e.currentTarget; setOpen(i); }}>
                <span className="rx-story__faces" aria-hidden="true"><Photo src={it.a.photo} name={it.a.name} alt="" className="rx-story__face" /><Photo src={it.b.photo} name={it.b.name} alt="" className="rx-story__face" /></span>
                {it.live ? <span className="rx-story__live">Live</span> : null}
              </button>
              <span className="rx-story__cap">{it.caption}</span>
            </div>
          );
        })}
      </div>
      {open !== null ? <StoryViewer items={items} start={open} onSeen={markSeen} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function StoryViewer({ items, start, onSeen, onClose }: { items: StoryItem[]; start: number; onSeen: (id: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(start);
  const [held, setHeld] = useState(false);
  const [reduced, setReduced] = useState(false);
  const it = items[i]!;
  useEffect(() => { ref.current?.showModal(); setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  useEffect(() => { onSeen(it.id); }, [it.id, onSeen]);
  const next = useCallback(() => setI((n) => { if (n + 1 >= items.length) { onClose(); return n; } return n + 1; }), [items.length, onClose]);
  const prev = useCallback(() => setI((n) => Math.max(0, n - 1)), []);
  useEffect(() => {
    if (reduced || held) return;
    const t = setTimeout(next, DURATION);
    return () => clearTimeout(t);
  }, [i, held, reduced, next]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") next(); else if (e.key === "ArrowLeft") prev(); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);
  return (
    <dialog ref={ref} className="rx-viewer" aria-label="Highlights" onClose={onClose} onCancel={onClose} onPointerDown={() => setHeld(true)} onPointerUp={() => setHeld(false)} onPointerLeave={() => setHeld(false)} onPointerCancel={() => setHeld(false)}>
      <div className="rx-viewer__bars" aria-hidden="true">
        {items.map((s, n) => (
          <span key={s.id} className="rx-viewer__bar"><span className={`rx-viewer__fill${n < i ? " is-done" : ""}${n === i && !reduced ? " is-run" : ""}${n === i && reduced ? " is-done" : ""}`} style={n === i && !reduced ? { animationDuration: `${DURATION}ms`, animationPlayState: held ? "paused" : "running" } : undefined} /></span>
        ))}
      </div>
      <button type="button" className="rx-iconbtn rx-viewer__close" aria-label="Close highlights" onClick={onClose}><Icon name="close" size={22} /></button>
      <div className="rx-viewer__slide">
        {it.live ? <span className="rx-livetag"><span className="rx-livetag__dot" aria-hidden="true" />Live</span> : null}
        <p className="rx-viewer__comp">{it.title}</p>
        <div className="rx-viewer__stage">
          <div className="rx-viewer__side"><Photo src={it.a.photo} name={it.a.name} alt="" className="rx-viewer__face" /><span>{it.a.name}</span></div>
          <span className="rx-viewer__score">{it.score ?? "VS"}</span>
          <div className="rx-viewer__side"><Photo src={it.b.photo} name={it.b.name} alt="" className="rx-viewer__face" /><span>{it.b.name}</span></div>
        </div>
        <p className="rx-viewer__sub" aria-live="polite">{it.live ? "Live now. " : ""}{it.subtitle}</p>
        {it.href ? <a href={it.href} className="rx-btn">{it.cta ?? "View match"}</a> : null}
      </div>
      <button type="button" className="rx-viewer__zone rx-viewer__zone--prev" aria-label="Previous highlight" onClick={prev} disabled={i === 0} />
      <button type="button" className="rx-viewer__zone rx-viewer__zone--next" aria-label={i + 1 >= items.length ? "Close highlights" : "Next highlight"} onClick={next} />
    </dialog>
  );
}
