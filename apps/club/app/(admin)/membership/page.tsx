import Link from "next/link";
import { PromoCard } from "@rallix/ui";
import { ClubHeader } from "../../../components/Header";
import { Revenue } from "./Revenue";

export default function Membership() {
  return (
    <>
      <ClubHeader />
      <h1 className="rx-title" style={{ marginBottom: 16 }}>Membership</h1>
      <Revenue />
      <PromoCard title="Manage your subscription" cta="Visit" href="/membership/subscriptions" linkAs={Link} />
      <PromoCard title="Manage membership" cta="View" href="/membership/payments" tone="green" linkAs={Link} />
    </>
  );
}
