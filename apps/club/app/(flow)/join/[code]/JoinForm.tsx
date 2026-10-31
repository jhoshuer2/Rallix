"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ChoiceToggle, TextField } from "@rallix/ui";

export function JoinForm({ code }: { code: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [level, setLevel] = useState<"junior" | "intermediate" | undefined>(undefined);
  const [tried, setTried] = useState(false);
  const phoneOk = /^(\+?234|0)\d{10}$/.test(phone.replace(/\s/g, ""));
  const ok = name.trim() && phoneOk && level;
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); setTried(true); if (ok) router.push("/play"); }}>
      <p className="rx-chip rx-chip--light" style={{ marginBottom: 12 }}>Invite {code}</p>
      <h1 className="rx-title" style={{ marginBottom: 8 }}>Join Paris Arena</h1>
      <p className="rx-muted" style={{ marginBottom: 24 }}>Finish your player profile to see your competitions, stats and ranking.</p>
      <TextField label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={tried && !name.trim() ? "Enter your name" : undefined} />
      <TextField label="Phone number" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} error={tried && !phoneOk ? "Enter a valid Nigerian phone number" : undefined} />
      <ChoiceToggle label="Your level" value={level} onChange={setLevel} options={[{ value: "junior", label: "Junior" }, { value: "intermediate", label: "Intermediate" }]} />
      {tried && !level ? <p className="rx-error" role="alert" style={{ marginTop: -16, marginBottom: 16 }}>Choose your level</p> : null}
      <Button type="submit" variant="surface" block>Join club</Button>
    </form>
  );
}
