import type { ReactNode } from "react";
import { Screen } from "@rallix/ui";
import { PlayerNav } from "../../components/PlayerShell";
import { requireClub } from "../../lib/context";

export default async function PlayerLayout({ children }: { children: ReactNode }) {
  await requireClub();
  return (
    <Screen tone="canvas">
      {children}
      <PlayerNav />
    </Screen>
  );
}
