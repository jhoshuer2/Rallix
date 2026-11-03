"use client";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/** Opens the camera and reports each QR code it reads (once per code). Camera needs HTTPS and the person's permission. */
export function CardScanner({ onToken }: { onToken: (token: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string>();
  useEffect(() => {
    let stop = false, stream: MediaStream | null = null, last = "", raf = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = video.current!; v.srcObject = stream; await v.play();
        const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        let tick = 0;
        const loop = () => {
          if (stop) return;
          if (v.readyState >= 2 && ++tick % 6 === 0) { // about 10 reads a second
            canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (code?.data && code.data !== last) { last = code.data; onToken(code.data); }
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        setErr((e as Error).name === "NotAllowedError" ? "Camera access is blocked. Allow it in your browser settings, or choose the person by name." : "The camera isn’t available here. Choose the person by name instead.");
      }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onToken]);
  return err ? <p role="alert" className="rx-error">{err}</p> : (
    <video ref={video} playsInline muted aria-label="Camera view for scanning a member card" style={{ width: "100%", borderRadius: 12, background: "#000", aspectRatio: "1 / 1", objectFit: "cover" }} />
  );
}
