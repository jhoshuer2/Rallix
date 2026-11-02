/** What a picture is for. Decides the output size and where it is stored. */
export type PhotoKind = "person" | "club-logo" | "club-cover";

export const SPECS: Record<PhotoKind, { width: number; height: number; folder: string }> = {
  person: { width: 640, height: 640, folder: "people" },
  "club-logo": { width: 512, height: 512, folder: "logo" },
  "club-cover": { width: 1600, height: 1000, folder: "cover" },
};

/** Hard limits. The browser shrinks pictures well below these before upload; the server never trusts that. */
export const LIMITS = { maxBytes: 4 * 1024 * 1024, maxInputPixels: 40_000_000, minEdge: 64 } as const;
