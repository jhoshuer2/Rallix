import { ListGroup, ListRow, Pill, SectionTitle } from "@rallix/ui";
import type { Request } from "../lib/help-queries";

const LABEL = { open: "Received", investigating: "Looking into it", resolved: "Resolved", closed: "Closed" } as const;
const day = (d: Date) => d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });

/** Only shown once the person has sent something. */
export function MyRequests({ items }: { items: Request[] }) {
  if (!items.length) return null;
  return (
    <>
      <SectionTitle title="Your requests" />
      <ListGroup label="Your requests">
        {items.map((r) => <ListRow key={r.id} title={r.title} subtitle={day(r.createdAt)} trailing={<Pill tone={r.status === "resolved" || r.status === "closed" ? "success" : "neutral"}>{LABEL[r.status]}</Pill>} />)}
      </ListGroup>
    </>
  );
}
