import { redirect } from "next/navigation";
import { EntryShell } from "@rallix/ui";
import { getCtx } from "../../../lib/context";

export default async function Suspended() {
  const ctx = await getCtx();
  if (!ctx) redirect("/sign-in");
  if (ctx.club) redirect("/");
  return (
    <EntryShell title="Club unavailable">
      {ctx.blocked.length === 0 ? <p style={{ marginTop: 0 }}>You’re not part of any club yet.</p> : (
        <p style={{ marginTop: 0 }}>{ctx.blocked.map((b) => b.name).join(", ")} {ctx.blocked.length === 1 ? "is" : "are"} currently {ctx.blocked[0]!.status}. Your data is safe. Please ask your club admin to contact Rallix support.</p>
      )}
      <a className="rx-btn rx-btn--ghost rx-btn--block" href="/sign-out">Sign out</a>
    </EntryShell>
  );
}
