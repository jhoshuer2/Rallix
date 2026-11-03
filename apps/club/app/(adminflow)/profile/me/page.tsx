import Link from "next/link";
import { BackButton, PageShell, Panel } from "@rallix/ui";
import { ArrivalSettings } from "../../../../components/ArrivalSettings";
import { ContactForm } from "../../../../components/ContactForm";
import { EmailPrefs } from "../../../../components/EmailPrefs";
import { PhotoUploader } from "../../../../components/PhotoUploader";
import { ownEmailOptOut, ownPhone } from "../../../../lib/contact";
import { getArrivalSettings } from "../../../../lib/arrival-queries";
import { inClub, requireRole } from "../../../../lib/context";
import { myPhoto } from "../../../../lib/media-queries";

export const dynamic = "force-dynamic";

/** The admin's own settings: picture, contact details, email and check-in alerts. */
export default async function MyProfile() {
  const ctx = await requireRole("admin");
  return (
    <PageShell back={<BackButton href="/profile" linkAs={Link} />} title="Your profile">
      <Panel title="Your picture"><PhotoUploader kind="me" name={ctx.user.name} current={await myPhoto()} label="Profile picture" shape="person" /></Panel>
      <Panel title="At the court"><ArrivalSettings initial={await inClub(ctx, (tx) => getArrivalSettings(tx, ctx.club.membershipId))} vapidKey={process.env.VAPID_PUBLIC_KEY ?? null} /></Panel>
      <Panel title="Contact details"><ContactForm email={ctx.user.email} phone={await ownPhone(ctx.user.id)} /></Panel>
      <Panel title="Email"><EmailPrefs optedOut={await ownEmailOptOut(ctx.user.id)} /></Panel>
    </PageShell>
  );
}
