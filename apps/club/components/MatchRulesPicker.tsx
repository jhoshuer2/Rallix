"use client";
import { useState } from "react";
import { Segmented, TextField } from "@rallix/ui";
import { BEST_OF_CHOICES, RULE_PRESETS, presetKey, tieNote, validateRules } from "@rallix/stats";

export type MatchRulesValue = { bestOf: number; points: number; winBy: 1 | 2; cap: number | null };

/** The plain-words summary of a choice, also used under the picker: how a match is won, what a game is, what happens one short of the target. */
export function rulesSentence(v: MatchRulesValue): string {
  const need = Math.floor(v.bestOf / 2) + 1;
  const match = v.bestOf === 1 ? "A match is one game." : `A match is won by the first to win ${need} games.`;
  return `${match} A game goes to ${v.points}. ${tieNote({ points: v.points, winBy: v.winBy, cap: v.cap })}`;
}

/** Choose how a match is played: a quick preset, or every part. Controlled: the parent keeps the value and checks it with `validateRules` on save. */
export function MatchRulesPicker({ value, onChange }: { value: MatchRulesValue; onChange: (v: MatchRulesValue) => void }) {
  const key = presetKey(value.bestOf, { points: value.points, winBy: value.winBy, cap: value.cap });
  const [custom, setCustom] = useState(key === "custom");
  const shown = custom ? "custom" : key;
  const check = validateRules(value);
  return (
    <div className="rx-matchrules">
      <Segmented
        label="Match format"
        scroll
        value={shown}
        onChange={(k) => {
          if (k === "custom") return setCustom(true);
          const p = RULE_PRESETS.find((x) => x.key === k)!;
          setCustom(false);
          onChange({ bestOf: p.bestOf, points: p.rules.points, winBy: p.rules.winBy, cap: p.rules.cap });
        }}
        options={[...RULE_PRESETS.map((p) => ({ value: p.key, label: p.label })), { value: "custom", label: "Custom" }]}
      />
      {custom ? (
        <div style={{ display: "grid", gap: 4, marginTop: 12 }}>
          <p className="rx-label" style={{ margin: "4px 0" }}>Games in a match</p>
          <Segmented label="Games in a match" value={String(value.bestOf)} onChange={(v) => onChange({ ...value, bestOf: Number(v) })} options={BEST_OF_CHOICES.map((n) => ({ value: String(n), label: n === 1 ? "1 game" : `Best of ${n}` }))} scroll />
          <TextField label="Points to win a game" type="number" inputMode="numeric" min={5} max={30} value={String(value.points)} onChange={(e) => { const n = Number(e.target.value); onChange({ ...value, points: Number.isFinite(n) ? n : 0, cap: null }); }} />
          <p className="rx-label" style={{ margin: "4px 0" }}>When both players are one point short ({value.points - 1}–{value.points - 1})</p>
          <Segmented label="At the tie" value={String(value.winBy)} onChange={(v) => onChange({ ...value, winBy: v === "1" ? 1 : 2, cap: v === "1" ? null : value.cap })} options={[{ value: "2", label: "Win by two points" }, { value: "1", label: "Next point wins" }]} />
          {value.winBy === 2 ? (
            <TextField label="Stop at (optional)" type="number" inputMode="numeric" placeholder="No limit" value={value.cap === null ? "" : String(value.cap)} onChange={(e) => onChange({ ...value, cap: e.target.value === "" ? null : Number(e.target.value) })} />
          ) : null}
        </div>
      ) : null}
      <p className="rx-muted" role="status" style={{ margin: "12px 0 0" }}>{check.ok ? rulesSentence(value) : check.error}</p>
    </div>
  );
}
