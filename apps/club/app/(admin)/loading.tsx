import { Skeleton } from "@rallix/ui";

/** Generic admin tab shape: white app bar, a large title, one big card, a carousel. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading">
      <div className="rx-top rx-top--light"><Skeleton h={40} /></div>
      <div className="rx-canvas">
        <div style={{ margin: "8px 0 20px" }}><Skeleton w={220} h={36} /></div>
        <Skeleton h={170} />
        <div style={{ display: "flex", gap: 12, margin: "40px 0 0" }}><Skeleton w="62%" h={200} /><Skeleton w="62%" h={200} /></div>
      </div>
    </div>
  );
}
