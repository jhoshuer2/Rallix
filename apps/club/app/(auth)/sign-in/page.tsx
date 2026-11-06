import { safeNext } from "@rallix/config/safe-input";
import { SignInForm } from "./SignInForm";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; method?: string }> }) {
  const { next, method } = await searchParams;
  return <SignInForm next={safeNext(next)} initialMethod={method === "password" ? "password" : "code"} />;
}
