"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

type InventoryEvent = { id: string; projectedStatus: string; tokenAmount: number; occurredAt: string; subject: { firstName: string | null; lastName: string | null; email: string } | null; city: { name: string; state: { code: string } } };
type Inventory = { totals: { total: number; verified: number; pending: number; rejected: number }; personalizedTokensPerParticipant: number; events: InventoryEvent[] };

export default function InventoryPage() {
  const [data, setData] = useState<Inventory | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api<Inventory>("/inventory").then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load inventory"));
  useEffect(() => { void load(); }, []);
  useRealtime((event) => { if (event.type === "inventory.updated") void load(); });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    const form = event.currentTarget;
    try {
      await api("/inventory/contributions", { method: "POST", body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), idempotencyKey: crypto.randomUUID() }) });
      setSuccess("Contribution recorded. Five tokens are pending verification."); form.reset(); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to record contribution"); } finally { setBusy(false); }
  }

  return <main className="dashboard">
    <header className="dashboard-nav"><Link className="brand" href="/dashboard">TITAN</Link><div><Link className="text-link" href="/notifications">Notifications</Link><Link className="text-link" href="/verifications">Verification requests</Link><Link className="text-link" href="/dashboard">← Dashboard</Link></div></header>
    <section className="welcome"><div><p className="eyebrow">INVENTORY ENGINE</p><h1>My inventory</h1><p>Every contribution is recorded in a transparent, append-only ledger.</p></div></section>
    <section className="stat-grid"><article className="stat-card accent"><span>Total tokens</span><strong>{data?.totals.total ?? "—"}</strong><small>5 personalized tokens per participant</small></article><article className="stat-card"><span>Verified tokens</span><strong>{data?.totals.verified ?? "—"}</strong><small>Counted toward community progress</small></article><article className="stat-card"><span>Pending verification</span><strong>{data?.totals.pending ?? "—"}</strong><small>Awaiting participant decision</small></article></section>
    <section className="inventory-grid">
      <article className="panel"><p className="eyebrow">ADD A PARTICIPANT</p><h2>Record a contribution</h2><p className="muted">The participant must already belong to your selected TITAN city.</p><form onSubmit={submit}><label>Participant email<input name="participantEmail" type="email" required placeholder="member@example.com" /></label><label>Contribution note (optional)<input name="note" maxLength={200} placeholder="How you connected" /></label>{error && <p className="error" role="alert">{error}</p>}{success && <p className="success" role="status">{success}</p>}<button className="button" disabled={busy}>{busy ? "Recording…" : "Record 5 tokens"}</button></form></article>
      <article className="panel"><p className="eyebrow">LEDGER HISTORY</p><h2>Contribution events</h2>{data?.events.length ? <ul className="ledger-list">{data.events.map((event) => <li key={event.id}><div><strong>{event.subject ? `${event.subject.firstName ?? ""} ${event.subject.lastName ?? ""}`.trim() || event.subject.email : "Participant"}</strong><small>{event.city.name}, {event.city.state.code} · {new Date(event.occurredAt).toLocaleDateString()}</small></div><div className="ledger-amount"><strong>+{event.tokenAmount}</strong><span className={`status ${event.projectedStatus.toLowerCase()}`}>{event.projectedStatus}</span></div></li>)}</ul> : <p className="empty">No contribution events yet. Add your first verified community member.</p>}</article>
    </section>
  </main>;
}
