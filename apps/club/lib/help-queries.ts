import { sql } from "drizzle-orm";
import type { Tx } from "@rallix/db";

export type Request = { id: string; title: string; status: "open" | "investigating" | "resolved" | "closed"; createdAt: Date };

/** The signed-in person's own requests in this club. Nothing else about an issue is exposed. */
export async function myRequests(tx: Tx): Promise<Request[]> {
  const r = await tx.execute(sql`select id, title, status, created_at from app.my_issues()`);
  return (r.rows as Array<{ id: string; title: string; status: Request["status"]; created_at: Date }>).map((x) => ({ id: x.id, title: x.title, status: x.status, createdAt: new Date(x.created_at) }));
}
