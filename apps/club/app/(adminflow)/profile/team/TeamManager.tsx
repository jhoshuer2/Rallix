"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CheckRow, EmptyState, ListGroup, ListRow, Photo, Pill, Sheet, Switch } from "@rallix/ui";
import { PERMISSIONS, type Permission } from "../../../../lib/permissions";
import { removeAdmin, saveAdmin } from "../../../../lib/team-actions";
import type { TeamMember } from "../../../../lib/team";

const titleOf = (k: string) => PERMISSIONS.find((p) => p.key === k)?.title ?? k;

export function TeamManager({ admins, others, meId, canEdit }: { admins: TeamMember[]; others: TeamMember[]; meId: string; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<null | { mode: "add" } | { mode: "edit"; member: TeamMember }>(null);
  const [who, setWho] = useState<string>("");
  const [perms, setPerms] = useState<Permission[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const close = () => { setOpen(null); setWho(""); setPerms([]); setMsg(undefined); };
  const toggle = (k: Permission, on: boolean) => setPerms((p) => (on ? [...new Set([...p, k])] : p.filter((x) => x !== k)));
  const target = open?.mode === "edit" ? open.member.id : who;

  async function save() {
    if (!target) return setMsg("Choose who to make an admin.");
    setBusy(true); setMsg(undefined);
    const r = await saveAdmin(target, perms);
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    close(); router.refresh();
  }
  async function remove(id: string) {
    setBusy(true); setMsg(undefined);
    const r = await removeAdmin(id);
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    close(); router.refresh();
  }

  return (
    <>
      <p className="rx-muted" style={{ margin: "0 0 12px" }}>{canEdit ? "Choose what each admin looks after. They only see those areas of the app." : "These are the people who run the club. Only the club owner can change the team."}</p>
      <ListGroup label="Admins">
        {admins.map((a) => {
          const mine = a.id === meId;
          const edit = canEdit && !a.isOwner;
          return <ListRow key={a.id} media={<Photo src={a.photo} name={a.name} alt="" />} title={mine ? `${a.name} (you)` : a.name}
            subtitle={a.isOwner ? "Owner · looks after everything" : a.permissions.length ? a.permissions.map(titleOf).join(" · ") : "No responsibilities yet"}
            trailing={a.isOwner ? <Pill tone="success">Owner</Pill> : undefined} onClick={edit ? () => { setOpen({ mode: "edit", member: a }); setPerms(a.permissions); } : undefined} />;
        })}
      </ListGroup>
      {canEdit ? (
        others.length ? <div style={{ marginTop: 16 }}><Button block onClick={() => { setOpen({ mode: "add" }); setPerms([]); }}>Add an admin</Button></div>
          : <EmptyState compact title="No one to add yet" hint="Members of your club can be made admins. Invite players first." />
      ) : null}

      <Sheet open={open !== null} onClose={close} title={open?.mode === "edit" ? open.member.name : "Add an admin"}>
        {open?.mode === "add" ? (
          <div style={{ marginBottom: 12 }}>
            <p className="rx-label">Who</p>
            <ListGroup bare label="Members">
              {others.map((m) => <CheckRow key={m.id} media={<Photo src={m.photo} name={m.name} alt="" />} title={m.name} checked={who === m.id} onChange={(v) => setWho(v ? m.id : "")} />)}
            </ListGroup>
          </div>
        ) : null}
        <p className="rx-label">Looks after</p>
        <div style={{ display: "grid", gap: 14, marginBottom: 16 }}>
          {PERMISSIONS.map((p) => (
            <div key={p.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div><strong style={{ display: "block", fontWeight: 600 }}>{p.title}</strong><span className="rx-muted" style={{ fontSize: 13 }}>{p.hint}</span></div>
              <Switch label={p.title} checked={perms.includes(p.key)} onChange={(on) => toggle(p.key, on)} />
            </div>
          ))}
        </div>
        {msg ? <p role="alert" className="rx-error">{msg}</p> : null}
        <Button block disabled={busy} onClick={save}>{busy ? "Saving…" : open?.mode === "edit" ? "Save" : "Make admin"}</Button>
        {open?.mode === "edit" ? <div style={{ marginTop: 8 }}><Button variant="ghost" block disabled={busy} onClick={() => remove(open.member.id)}>Remove as admin</Button></div> : null}
      </Sheet>
    </>
  );
}
