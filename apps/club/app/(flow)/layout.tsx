import type { ReactNode } from "react";

/** Entry and public pages draw their own full-screen shell (EntryShell). */
export default function FlowLayout({ children }: { children: ReactNode }) { return <>{children}</>; }
