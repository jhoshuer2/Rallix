import type { ReactNode } from "react";
import { Screen } from "@rallix/ui";
import { AdminNav } from "../../components/AdminShell";
import { inClub, requireRole } from "../../lib/context";
import { pendingApplicationCount } from "../../lib/applications";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await requireRole("admin"); // non-admins are redirected to the player home
  const waiting = await inClub(ctx, (tx) => pendingApplicationCount(tx, ctx.club.clubId));
  return (
    <Screen tone="canvas">
      {children}
      <AdminNav badges={{ members: waiting }} />
    </Screen>
  );
}
