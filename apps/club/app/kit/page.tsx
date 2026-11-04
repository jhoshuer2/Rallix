import { isProduction } from "@rallix/config/env";
import { notFound } from "next/navigation";
import { Demo } from "./Demo";
export const metadata = { title: "Rallix UI kit" };
/** The living style guide is for the team: it is hidden in production unless ENABLE_KIT=1. */
export default function Kit() {
  if (isProduction() && process.env.ENABLE_KIT !== "1") notFound();
  return <Demo />;
}
