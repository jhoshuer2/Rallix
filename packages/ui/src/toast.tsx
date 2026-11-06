"use client";
import { useEffect } from "react";

/**
 * A short message that confirms something happened and says what to do next. It speaks to screen readers (role="status"),
 * closes by itself after `seconds`, can be closed with the button, and never moves when the person prefers reduced motion.
 */
export function Toast({ message, onClose, seconds = 7 }: { message: string; onClose: () => void; seconds?: number }) {
  useEffect(() => { const t = setTimeout(onClose, seconds * 1000); return () => clearTimeout(t); }, [message, seconds, onClose]);
  return (
    <div className="rx-toast" role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" className="rx-toast__close" onClick={onClose} aria-label="Dismiss message">OK</button>
    </div>
  );
}
