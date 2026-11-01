import { Skeleton } from "@rallix/ui";

/** Same shape as the loaded Home: blue band with title and story circles, hero card, metrics, one carousel. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading your home">
      <div className="rx-band"><Skeleton w={190} h={32} /><div style={{ display: "flex", gap: 12, marginTop: 16 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} w={72} h={72} round />)}</div></div>
      <div className="rx-canvas">
        <Skeleton h={250} />
        <div style={{ margin: "32px 0 12px" }}><Skeleton w={140} h={22} /></div>
        <div style={{ display: "flex", gap: 12 }}><Skeleton h={88} /><Skeleton h={88} /></div>
        <div style={{ margin: "32px 0 12px" }}><Skeleton w={120} h={22} /></div>
        <div style={{ display: "flex", gap: 12 }}><Skeleton w="62%" h={190} /><Skeleton w="62%" h={190} /></div>
      </div>
    </div>
  );
}
