import Link from "next/link";

/** Splash: full blue, condensed wordmark, one white button. */
export default function Welcome() {
  return (
    <main className="rx-splash">
      <div className="rx-splash__logo"><span className="rx-ball" aria-hidden="true" /><span className="rx-splash__word">Rallix</span></div>
      <p className="rx-splash__tag">Run your table tennis club.</p>
      <Link className="rx-btn rx-btn--surface" href="/onboarding">Get started</Link>
      <Link className="rx-splash__link" href="/sign-in?method=password">Returning member? <span>Sign in with password</span></Link>
      <small>©copyright 2026</small>
    </main>
  );
}
