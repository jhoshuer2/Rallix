import { safeNext } from "@rallix/config/safe-input";
import { SignInForm } from "./SignInForm";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safe = safeNext(next);
  return <SignInForm next={safe} />;
}
