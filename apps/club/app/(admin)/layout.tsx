import type { ReactNode } from "react";
import { Screen } from "@rallix/ui";
import { AdminNav } from "../../components/AdminShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Screen>
      {children}
      <AdminNav />
    </Screen>
  );
}
