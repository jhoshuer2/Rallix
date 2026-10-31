import type { ReactNode } from "react";
import { Screen } from "@rallix/ui";

export default function PlayerFlowLayout({ children }: { children: ReactNode }) {
  return <Screen>{children}</Screen>;
}
