import { redirect } from "next/navigation";
import { getCtx } from "../../../lib/context";

export default async function Suspended() {
  const ctx = await getCtx();
  if (!ctx) redirect("/sign-in");
  if (ctx.club) redirect("/");
  return (
    <main style={{ paddingTop: 48 }}>
      <h1 className="rx-title" style={{ marginBottom: 16 }}>Club unavailable</h1>
      {ctx.blocked.length === 0 ? <p>You’re not part of any club yet.</p> : (
        <>
          <p style={{ marginBottom: 16 }}>{ctx.blocked.map((b) => b.name).join(", ")} {ctx.blocked.length === 1 ? "is" : "are"} currently {ctx.blocked[0]!.status}. Your data is safe. Please ask your club admin to contact Rallix support.</p>
        </>
      )}
      <a className="rx-btn rx-btn--surface" href="/sign-out">Sign out</a>
    </main>
  );
}
