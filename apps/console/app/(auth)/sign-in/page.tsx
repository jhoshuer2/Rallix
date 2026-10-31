import { SignInForm } from "./SignInForm";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  return <SignInForm denied={!!denied} />;
}
