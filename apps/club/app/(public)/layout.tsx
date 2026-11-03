import type { ReactNode } from "react";
import { Screen } from "@rallix/ui";

/** Pages anyone can open: a club's public page, and the invite link. No session is needed to read them. */
export default function PublicLayout({ children }: { children: ReactNode }) { return <Screen tone="canvas">{children}</Screen>; }
