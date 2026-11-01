import { Skeleton } from "@rallix/ui";

/** Same shape as the loaded Home: blue hero block, white story strip, canvas with a number row and a carousel. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading your home">
      <div className="rx-top rx-top--blue"><Skeleton w={190} h={34} /><div style={{ marginTop: 20 }}><Skeleton h={200} /></div></div>
      <div className="rx-storiesbar"><div style={{ display: "flex", gap: 12 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} w={72} h={72} round />)}</div></div>
      <div className="rx-canvas">
        <Skeleton w={160} h={28} />
        <div style={{ display: "flex", gap: 12, margin: "16px 0 40px" }}><Skeleton h={96} /><Skeleton h={96} /></div>
        <div style={{ display: "flex", gap: 12 }}><Skeleton w="62%" h={200} /><Skeleton w="62%" h={200} /></div>
      </div>
    </div>
  );
}
