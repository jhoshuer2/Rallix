import Link from "next/link";
import { BackButton } from "@rallix/ui";
import { Plans } from "./Plans";

export default function Subscriptions() {
  return (
    <>
      <div style={{ marginBottom: 16 }}><BackButton href="/membership" linkAs={Link} /></div>
      <Plans />
    </>
  );
}
