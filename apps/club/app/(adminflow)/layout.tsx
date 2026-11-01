import type { ReactNode } from "react";
import { Screen } from "@rallix/ui";
import { requireRole } from "../../lib/context";

/** Admin detail screens (no tab bar). Scorers may open competition screens, so the role check lives in each page. */
export default async function AdminFlowLayout({ children }: { children: ReactNode }) {
  await requireRole("admin", "scorer");
  return <Screen tone="canvas">{children}</Screen>;
}
