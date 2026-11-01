import { Skeleton } from "@rallix/ui";

/** Same shape as the loaded Home so nothing jumps: greeting, highlights, hero, standing, one carousel. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading your home">
      <Skeleton w={160} h={30} className="rx-skel--mt" />
      <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} w={72} h={72} round />)}</div>
      <Skeleton h={250} />
      <div style={{ margin: "32px 0 12px" }}><Skeleton w={140} h={22} /></div>
      <Skeleton h={88} />
      <div style={{ margin: "32px 0 12px" }}><Skeleton w={120} h={22} /></div>
      <div style={{ display: "flex", gap: 12 }}><Skeleton w="62%" h={190} /><Skeleton w="62%" h={190} /></div>
    </div>
  );
}
