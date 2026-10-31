import Link from "next/link";

/** Splash. "TABLE CLUB" in the source frames is a placeholder; Rallix wordmark goes here. */
export default function Welcome() {
  return (
    <main className="rx-splash">
      <div className="rx-splash__logo"><span className="rx-title">Rallix</span><span className="rx-ball rx-splash__ball" aria-hidden="true" /></div>
      <p>Run your table tennis club.</p>
      <Link className="rx-btn rx-btn--surface" href="/onboarding">Get started</Link>
      <small>©copyright 2026</small>
    </main>
  );
}
