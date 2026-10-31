import Link from "next/link";
import { BackButton } from "@rallix/ui";
import { Payments } from "./Payments";

export default function PaymentsPage() {
  return (
    <>
      <div style={{ marginBottom: 16 }}><BackButton href="/membership" linkAs={Link} /></div>
      <Payments />
    </>
  );
}
