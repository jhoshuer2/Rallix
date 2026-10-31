import type { ReactNode } from "react";
import { Screen } from "@rallix/ui";
import { PlayerNav } from "../../components/PlayerShell";

export default function PlayerLayout({ children }: { children: ReactNode }) {
  return (
    <Screen>
      {children}
      <PlayerNav />
    </Screen>
  );
}
