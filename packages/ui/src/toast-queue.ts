/** Pure rules for the toast queue: no React, easy to test. */
export type ToastTone = "success" | "error" | "info";
export type ToastItem = { id: number; tone: ToastTone; message: string };

export const MAX_TOASTS = 3;
/** How long each kind stays: a failure stays longer, because it asks the person to do something. */
export const toastSeconds = (tone: ToastTone): number => (tone === "error" ? 10 : 6);

/** Add a toast. The same message already showing is not added twice (it keeps its place); only the newest MAX_TOASTS stay. */
export function pushToast(list: ToastItem[], next: Omit<ToastItem, "id">, id: number): ToastItem[] {
  if (list.some((t) => t.tone === next.tone && t.message === next.message)) return list;
  return [...list, { ...next, id }].slice(-MAX_TOASTS);
}

export const dismissToast = (list: ToastItem[], id: number): ToastItem[] => list.filter((t) => t.id !== id);
