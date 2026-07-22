import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing">
      <nav className="topbar"><Link className="brand" href="/">TITAN</Link><Link className="text-link" href="/login">Sign in</Link></nav>
      <section className="landing-copy">
        <p className="eyebrow">THE WORLDWIDE SWAP &amp; TRADE</p>
        <h1>Build communities.<br /><span>Build progress.</span></h1>
        <p className="subtitle">Join verified people, strengthen your community, and watch every meaningful contribution move your city forward.</p>
        <div className="actions"><Link className="button" href="/register">Join TITAN</Link><Link className="button secondary" href="/login">I have an account</Link></div>
      </section>
      <section className="principles"><article><strong>50</strong><span>States</span></article><article><strong>200</strong><span>People complete a city</span></article><article><strong>Live</strong><span>Community progress</span></article></section>
    </main>
  );
}
