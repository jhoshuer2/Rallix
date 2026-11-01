import { Skeleton } from "@rallix/ui";

/** Generic shape for admin tabs: title, one big block, a row of tiles, a carousel. Keeps the page from jumping. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading">
      <div style={{ margin: "16px 0" }}><Skeleton w={180} h={30} /></div>
      <Skeleton h={170} />
      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}><Skeleton h={56} /><Skeleton h={56} /></div>
      <div style={{ margin: "32px 0 12px" }}><Skeleton w={140} h={22} /></div>
      <div style={{ display: "flex", gap: 12 }}><Skeleton w="62%" h={190} /><Skeleton w="62%" h={190} /></div>
    </div>
  );
}
