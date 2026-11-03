import type { ReactNode } from "react";
import { Screen } from "@rallix/ui";
import { AdminNav } from "../../components/AdminShell";
import { can, inClub, requireRole } from "../../lib/context";
import { pendingApplicationCount } from "../../lib/applications";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await requireRole("admin"); // non-admins are redirected to the player home
  const waiting = can(ctx.club, "members") ? await inClub(ctx, (tx) => pendingApplicationCount(tx, ctx.club.clubId)) : 0;
  const hidden = [can(ctx.club, "members") ? "" : "members", can(ctx.club, "competitions") ? "" : "competition", can(ctx.club, "finance") ? "" : "membership"].filter(Boolean);
  return (
    <Screen tone="canvas">
      {children}
      <AdminNav badges={{ members: waiting }} hidden={hidden} />
    </Screen>
  );
}
