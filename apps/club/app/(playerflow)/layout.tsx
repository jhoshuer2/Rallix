import type { ReactNode } from "react";
import { Screen } from "@rallix/ui";
import { requireClub } from "../../lib/context";

export default async function PlayerFlowLayout({ children }: { children: ReactNode }) {
  await requireClub();
  return <Screen tone="canvas">{children}</Screen>;
}
