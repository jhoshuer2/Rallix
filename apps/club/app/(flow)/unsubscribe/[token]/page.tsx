import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { EntryShell } from "@rallix/ui";
import { users } from "@rallix/db";
import { serviceDb } from "../../../../lib/db";
import { userFromToken } from "../../../../lib/unsubscribe";
import { UnsubscribeButtons } from "./UnsubscribeButtons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Email preferences", robots: { index: false, follow: false, nocache: true } };

const mask = (email: string) => { const [n, d] = email.split("@"); return `${n!.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(6, n!.length - 1)))}@${d}`; };

/** Public (the link is the credential). Shows only a masked address, never names or clubs. Changes nothing until the button is pressed. */
export default async function Unsubscribe({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = userFromToken(token);
  const [u] = userId ? await serviceDb().select({ email: users.email, out: users.emailOptOut }).from(users).where(eq(users.id, userId)) : [];
  if (!u) return <EntryShell title="Link not valid"><p style={{ marginTop: 0 }}>This link isn’t valid. If you want to stop optional emails, sign in and use the switch on your Me page.</p></EntryShell>;
  return (
    <EntryShell title="Email preferences" subtitle={<>For <strong>{mask(u.email)}</strong></>}>
      <UnsubscribeButtons token={token} initiallyOut={u.out} />
      <p className="rx-muted" style={{ fontSize: 13, marginTop: 24 }}>This stops dues reminders and club announcements from every club you belong to. You will still get sign-in codes, and club admins still get invoices from Rallix.</p>
    </EntryShell>
  );
}
