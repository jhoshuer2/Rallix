import { AppHeader } from "@rallix/ui";
import { admin, club } from "../lib/mock";

export function ClubHeader() {
  return <AppHeader clubName={club.name} clubLogo={club.logo} userName={admin.name} userPhoto={admin.photo} />;
}
