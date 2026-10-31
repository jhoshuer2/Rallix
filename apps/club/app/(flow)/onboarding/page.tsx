"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BackButton, Button, ChoiceToggle, TextField } from "@rallix/ui";
import Link from "next/link";

export default function Onboarding() {
  const router = useRouter();
  const [club, setClub] = useState("");
  const [owner, setOwner] = useState<"no" | "yes" | undefined>(undefined);
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [tried, setTried] = useState(false);
  const valid = club.trim() && owner && name.trim() && place.trim();

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); setTried(true); if (valid) router.push("/"); }}>
      <div style={{ marginBottom: 16 }}><BackButton href="/welcome" linkAs={Link} /></div>
      <h1 className="rx-title" style={{ marginBottom: 24 }}>Welcome to the app for managing your table tennis club</h1>
      <TextField label="Do you have a name for your club?" placeholder="E.g. Paris Arena" value={club} onChange={(e) => setClub(e.target.value)} error={tried && !club.trim() ? "Enter your club name" : undefined} />
      <ChoiceToggle label="Do you own the club?" value={owner} onChange={setOwner}
        options={[{ value: "no", label: "No", icon: "close" }, { value: "yes", label: "Yes", icon: "thumb" }]} />
      <TextField label="What’s your name" placeholder="Your full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={tried && !name.trim() ? "Enter your name" : undefined} />
      <TextField label="Where are you located" icon="pin" placeholder="E.g. Central Market, Kubwa, FCT, Abuja" value={place} onChange={(e) => setPlace(e.target.value)} error={tried && !place.trim() ? "Enter your location" : undefined} />
      <Button type="submit" variant="surface" block>Continue</Button>
    </form>
  );
}
