"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@rallix/ui";
import { validateRules } from "@rallix/stats";
import { MatchRulesPicker, type MatchRulesValue } from "../../../../components/MatchRulesPicker";
import { saveClubMatchRules } from "../../../../lib/match-rules-actions";

export function MatchRulesForm({ initial }: { initial: MatchRulesValue }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const c = validateRules(v);
    if (!c.ok) return toast.error(c.error);
    setBusy(true);
    const r = await saveClubMatchRules(v);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Match rules saved. New competitions will use them.");
    router.refresh();
  }
  return (
    <form noValidate onSubmit={save}>
      <MatchRulesPicker value={v} onChange={setV} />
      <div style={{ height: 16 }} />
      <Button type="submit" block disabled={busy}>{busy ? "Saving…" : "Save match rules"}</Button>
    </form>
  );
}
