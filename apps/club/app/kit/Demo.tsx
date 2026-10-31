"use client";
import { useState } from "react";
import { AppHeader, BottomNav, Button, Card, ChoiceToggle, Chip, Count, IconButton, PlayerRow, RankCard, RankGrid,
  Screen, Segmented, SectionHeader, StatGrid, Switch, TextField, Title, clubAdminNav } from "@rallix/ui";

export function Demo() {
  const [own, setOwn] = useState<"no" | "yes" | undefined>("yes");
  const [period, setPeriod] = useState("monthly");
  const [on, setOn] = useState(true);
  const [picked, setPicked] = useState(true);
  return (
    <Screen>
      <AppHeader clubName="Paris Arena" userName="Innocent Amos" />
      <Title>Members <Count>100</Count></Title>
      <div style={{ height: 16 }} />
      <TextField label="Do you have a name for your club?" placeholder="E.g. Paris Arena" />
      <TextField label="Where are you located" icon="pin" placeholder="E.g. Central Market, Kubwa, FCT, Abuja" error="Enter your location" />
      <ChoiceToggle label="Do you own the club?" value={own} onChange={setOwn}
        options={[{ value: "no", label: "No", icon: "close" }, { value: "yes", label: "Yes", icon: "thumb" }]} />
      <SectionHeader title="Subscription" linkLabel="View all" href="#" />
      <Segmented label="Billing period" value={period} onChange={setPeriod}
        options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]} />
      <div style={{ height: 12 }} />
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Monthly</span><Switch label="Monthly plan enabled" checked={on} onChange={setOn} />
        </div>
        <p className="rx-title" style={{ fontSize: 32 }}>₦6,000</p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Chip tone="active">Active</Chip><Chip tone="dark">Senior</Chip><Chip tone="warn">Intermediate</Chip>
        </div>
      </Card>
      <div style={{ height: 12 }} />
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Button ball>Resume</Button><Button variant="ghost">Edit Price</Button><IconButton icon="plus" label="New member" />
      </div>
      <SectionHeader title="Players" />
      <PlayerRow rank={1} name="Jide Taiwo" checked={picked} onChange={setPicked} />
      <SectionHeader title="Leaderboard" />
      <RankGrid>
        <RankCard rank={1} name="Jide Taiwo" points={100} />
        <RankCard rank={2} name="Pastor" points={80} />
      </RankGrid>
      <SectionHeader title="Overview" />
      <StatGrid stats={[{ label: "Current Rank", value: "10" }, { label: "Titles Won", value: "2" }, { label: "Won / Lost", value: "40 / 12" }, { label: "Total Earned", value: "₦200,000" }]} />
      <BottomNav items={clubAdminNav("/kit#")} current="members" />
    </Screen>
  );
}
