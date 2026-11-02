"use client";
import { ActionButton, AttentionTile, Carousel, ClubBanner, EmptyState, HeroMatch, IconBadge, ListGroup, ListRow, MediaCard, MemberCard, MetricCard, MetricGrid, PageShell, Panel, Photo, Pill, ResultCard, SectionTitle, SelectSheet, Skeleton, Stories, TileLink, type StoryItem } from "@rallix/ui";
import { useState } from "react";

const a = { name: "Ada Obi" }, b = { name: "Tunde Bello" };
const stories: StoryItem[] = [
  { id: "1", live: true, caption: "Ada v Tunde", title: "League night", subtitle: "Group A", a, b, score: "1–0" },
  { id: "2", caption: "Ada 3–1 Tunde", title: "League night", subtitle: "Group A · 28 Oct", a, b, score: "3–1" },
];

/** Living style guide: every token and card kind with placeholders only (no data, no uploads). */
export function Demo() {
  const [v, setV] = useState("");
  return (
    <PageShell title="UI kit" band={<Stories items={stories} />}>
      <HeroMatch competition="League night" whenLabel="Sat, 7 Nov, 15:00" startsAt={new Date(Date.now() + 3 * 86400000)} a={a} b={b} href="#" cta="Match details" />
      <SectionTitle title="Cards" href="#" />
      <h3 className="rx-panel__title">MetricCard</h3>
      <MetricGrid><MetricCard label="Club rank" value="#7" hint="Rating 1150" /><MetricCard label="Win rate" value="50%" tone="good" hint="Streak: 2 wins" /></MetricGrid>
      <h3 className="rx-panel__title" style={{ marginTop: 24 }}>EmptyState</h3>
      <Panel><div id="kit-empty"><EmptyState title="No competitions yet" hint="Create your first one in a minute." action={<a className="rx-btn" href="#">Create a competition</a>} /></div></Panel>
      <h3 className="rx-panel__title" style={{ marginTop: 24 }}>ListRow</h3>
      <ListGroup>
        <ListRow media={<Photo name="Ada Obi" alt="" />} title="Ada Obi" subtitle="Rating 1300" trailing="#1" />
        <ListRow media={<IconBadge icon="wallet" />} title="Payments" subtitle="Dues, receipts and history" href="#" />
        <ListRow media={<Photo name="Tunde Bello" alt="" />} title="Tunde Bello" subtitle="Group A · 28 Oct" trailing="Won 3–1" tone="good" />
        <ListRow title="Upcoming match" subtitle="Sat, 7 Nov" trailing={<Pill tone="live">Live</Pill>} />
      </ListGroup>
      <h3 className="rx-panel__title" style={{ marginTop: 24 }}>MediaCard and ResultCard (carousel)</h3>
      <Carousel label="Examples">
        <MediaCard name="Paris Arena Group Stage" detail="28 Aug – 16 Oct" tag="Active" href="#" />
        <ResultCard a={a} b={b} scoreA={3} scoreB={1} winner="a" competition="League night" when="28 Oct" href="#" />
      </Carousel>
      <h3 className="rx-panel__title" style={{ marginTop: 24 }}>TileLink, ActionButton, AttentionTile</h3>
      <div className="rx-tilegrid"><TileLink icon="wallet" label="Payments" href="#" /><TileLink icon="tag" label="Plans" href="#" /></div>
      <div className="rx-actions"><ActionButton icon="trophy" label="New event" href="#" /><ActionButton icon="members" label="Invite" href="#" /></div>
      <div className="rx-attn-row"><AttentionTile count={4} label="unpaid dues" href="#" /><AttentionTile label="Start a competition" tone="go" href="#" /></div>
      <h3 className="rx-panel__title" style={{ marginTop: 24 }}>MemberCard</h3>
      <div className="rx-mgrid"><MemberCard rank={1} name="Ada Obi" rating={1300} href="#" /><MemberCard rank={2} name="Tunde Bello" rating={1275} href="#" /></div>
      <h3 className="rx-panel__title" style={{ marginTop: 24 }}>ClubBanner</h3>
      <ClubBanner name="Lagos Spin Club" figure="₦18,000" figureLabel="Revenue, last 30 days" members={7} />
      <Panel title="Panel and controls"><SelectSheet label="Bank" value={v} onChange={setV} options={["Access Bank","GTBank","Zenith Bank","First Bank","UBA","Fidelity Bank","Union Bank","Sterling Bank","Stanbic IBTC","Wema Bank","Polaris Bank","Kuda","Opay","Moniepoint","Palmpay","Providus","Keystone","Ecobank","Heritage","Jaiz"].map((n, i) => ({ value: String(i + 1), label: n }))} searchable placeholder="Choose your bank" />
        <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Pill>Neutral</Pill><Pill tone="success">Success</Pill><Pill tone="warning">Warning</Pill><Pill tone="live">Live</Pill></p></Panel>
      <SectionTitle title="Loading" />
      <div style={{ display: "flex", gap: 12 }}><Skeleton h={80} /><Skeleton h={80} /></div>
    </PageShell>
  );
}
