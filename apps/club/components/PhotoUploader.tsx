"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon, Photo, Sheet, clampOffset, cropRect, fitWithin } from "@rallix/ui";
import { removePhoto, uploadPhoto } from "../lib/media-actions";

type Kind = "me" | "member" | "club-logo" | "club-cover" | "competition-cover";
const BOX = { square: { w: 264, h: 264 }, wide: { w: 320, h: 200 } } as const;
const MAX_BYTES = 1.5 * 1024 * 1024;

/**
 * Change or remove a picture. Tap the button, take or choose a photo, drag and zoom to frame it, then "Use photo".
 * The picture is shrunk in the browser first (so uploads stay fast on mobile data) and re-encoded again on the server.
 */
export function PhotoUploader({ kind, membershipId, competitionId, name, current, label, shape }: { kind: Kind; membershipId?: string; competitionId?: string; name: string; current: string | null; label: string; shape: "person" | "club" | "cover" }) {
  const router = useRouter();
  const box = shape === "cover" ? BOX.wide : BOX.square;
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(current);
  const [src, setSrc] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const lib = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  useEffect(() => setUrl(current), [current]);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const reset = () => { setSrc(null); setDims(null); setZoom(1); setOff({ x: 0, y: 0 }); };
  const close = () => { if (busy) return; setOpen(false); reset(); };
  const crop = (z = zoom, o = off) => (dims ? { imgW: dims.w, imgH: dims.h, boxW: box.w, boxH: box.h, zoom: z, offsetX: o.x, offsetY: o.y } : null);
  const move = (z: number, o: { x: number; y: number }) => { const c = crop(z, o); setOff(c ? clampOffset(c) : o); };

  async function choose(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    const u = URL.createObjectURL(file);
    const im = new Image();
    im.src = u;
    try { await im.decode(); } catch { URL.revokeObjectURL(u); return setMsg({ ok: false, text: "We couldn’t open that picture. Please try a JPEG or PNG." }); }
    reset();
    setSrc(u); setDims({ w: im.naturalWidth, h: im.naturalHeight });
  }

  async function send() {
    const c = crop(); const im = imgRef.current;
    if (!c || !im) return;
    setBusy(true); setMsg(null);
    const r = cropRect(c);
    const out = fitWithin(r.sw, r.sh, shape === "cover" ? 1600 : 1024);
    const canvas = document.createElement("canvas");
    canvas.width = out.w; canvas.height = out.h;
    canvas.getContext("2d")!.drawImage(im, r.sx, r.sy, r.sw, r.sh, 0, 0, out.w, out.h);
    let blob: Blob | null = null;
    for (const q of [0.86, 0.72, 0.58]) { blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", q)); if (blob && blob.size <= MAX_BYTES) break; }
    if (!blob) { setBusy(false); return setMsg({ ok: false, text: "We couldn’t prepare that picture. Please try another." }); }
    const fd = new FormData();
    fd.set("kind", kind); if (membershipId) fd.set("membershipId", membershipId); if (competitionId) fd.set("competitionId", competitionId);
    fd.set("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
    const res = await uploadPhoto(fd);
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    setUrl(res.url); setMsg({ ok: true, text: "Picture updated." }); setOpen(false); reset(); router.refresh();
  }

  async function remove() {
    setBusy(true); setMsg(null);
    const res = await removePhoto(kind, membershipId, competitionId);
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    setUrl(null); setMsg({ ok: true, text: "Picture removed." }); setOpen(false); reset(); router.refresh();
  }

  const scale = dims ? Math.max(box.w / dims.w, box.h / dims.h) * Math.max(1, zoom) : 1;
  return (
    <div className={`rx-uploader rx-uploader--${shape}`}>
      <Photo src={url} name={name} kind={shape} alt={url ? `${label}` : `${name}, no picture yet`} className="rx-uploader__pic" />
      <div className="rx-uploader__side">
        <p className="rx-uploader__label">{label}</p>
        <Button variant="ghost" onClick={() => setOpen(true)} aria-haspopup="dialog"><Icon name="camera" size={18} /> {url ? "Change picture" : "Add a picture"}</Button>
        <p role="status" aria-live="polite" className={msg?.ok ? "rx-muted" : "rx-error"} style={{ margin: 0, minHeight: 0 }}>{msg && !open ? msg.text : ""}</p>
      </div>

      <Sheet open={open} onClose={close} title={label}>
        <input ref={lib} type="file" accept="image/*" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={cam} type="file" accept="image/*" capture="user" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
        {!src ? (
          <div className="rx-uploader__choices">
            <Button block onClick={() => cam.current?.click()}><Icon name="camera" size={18} /> Take a photo</Button>
            <Button block variant="ghost" onClick={() => lib.current?.click()}><Icon name="image" size={18} /> Choose from library</Button>
            {url ? <Button block variant="ghost" disabled={busy} onClick={remove}>{busy ? "Removing…" : "Remove picture"}</Button> : null}
            <p className="rx-muted" style={{ fontSize: 13, margin: 0 }}>JPEG, PNG or WebP. We shrink it for you, and remove any location data from the file.</p>
          </div>
        ) : (
          <div className="rx-uploader__crop">
            <div className={`rx-crop${shape === "person" ? " rx-crop--round" : ""}`} style={{ width: box.w, height: box.h }} tabIndex={0} role="group" aria-label="Position your picture. Drag, or use the arrow keys to move it."
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }; }}
              onPointerMove={(e) => { const d = drag.current; if (d) move(zoom, { x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }); }}
              onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
              onKeyDown={(e) => { const k = { ArrowLeft: [12, 0], ArrowRight: [-12, 0], ArrowUp: [0, 12], ArrowDown: [0, -12] }[e.key]; if (k) { e.preventDefault(); move(zoom, { x: off.x + k[0]!, y: off.y + k[1]! }); } }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={src} alt="" draggable={false} className="rx-crop__img" style={{ width: dims!.w * scale, height: dims!.h * scale, transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))` }} />
            </div>
            <label className="rx-crop__zoom"><span>Zoom</span>
              <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => { const z = Number(e.target.value); setZoom(z); move(z, off); }} aria-label="Zoom" />
            </label>
            {msg && !msg.ok ? <p role="alert" className="rx-error" style={{ margin: 0 }}>{msg.text}</p> : null}
            <Button block disabled={busy} onClick={send}>{busy ? "Uploading…" : "Use picture"}</Button>
            <Button block variant="ghost" disabled={busy} onClick={reset}>Choose another</Button>
          </div>
        )}
        {!src && msg && !msg.ok ? <p role="alert" className="rx-error">{msg.text}</p> : null}
      </Sheet>
    </div>
  );
}
