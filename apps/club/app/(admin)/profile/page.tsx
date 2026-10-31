import { Avatar, Card, SectionHeader } from "@rallix/ui";
import { admin, club } from "../../../lib/mock";
import { InviteLink } from "./InviteLink";

export default function Profile() {
  return (
    <>
      <h1 className="rx-title" style={{ marginBottom: 16 }}>Profile</h1>
      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Avatar src={admin.photo} name={admin.name} large />
          <div><strong>{admin.name}</strong><br /><span>Club admin · {club.name}</span></div>
        </div>
      </Card>
      <SectionHeader title="Invite players" />
      <InviteLink clubName={club.name} />
    </>
  );
}
