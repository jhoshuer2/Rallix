import type { ReactNode } from "react";
import { Screen } from "@rallix/ui";
import { AdminNav } from "../../components/AdminShell";
import { requireRole } from "../../lib/context";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole("admin"); // non-admins are redirected to the player home
  return (
    <Screen>
      {children}
      <AdminNav />
    </Screen>
  );
}
