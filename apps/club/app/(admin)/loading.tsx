import { Skeleton } from "@rallix/ui";

/** Generic admin tab shape: band with title, one big card, a row of tiles, a carousel. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading">
      <div className="rx-band"><Skeleton w={190} h={32} /></div>
      <div className="rx-canvas">
        <Skeleton h={170} />
        <div style={{ display: "flex", gap: 8, margin: "16px 0" }}><Skeleton h={56} /><Skeleton h={56} /></div>
        <div style={{ margin: "32px 0 12px" }}><Skeleton w={140} h={22} /></div>
        <div style={{ display: "flex", gap: 12 }}><Skeleton w="62%" h={190} /><Skeleton w="62%" h={190} /></div>
      </div>
    </div>
  );
}
