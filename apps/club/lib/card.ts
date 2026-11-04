import { appEnv, isProduction } from "@rallix/config/env";
import { signCardToken, verifyCardToken } from "@rallix/config/card-token";

/** Key material for member-card tokens. Production needs BETTER_AUTH_SECRET; development falls back so the card still works. */
function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (isProduction()) throw new Error("BETTER_AUTH_SECRET is required for member cards");
  return "dev-only-member-card-secret-0001";
}
export const issueCard = (club: string, member: string) => signCardToken(secret(), club, member);
export const readCard = (token: unknown) => verifyCardToken(secret(), token);
