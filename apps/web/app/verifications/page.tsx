"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

type VerificationRequest = { id: string; tokenAmount: number; occurredAt: string; actor: { firstName: string | null; lastName: string | null; email: string }; city: { name: string; state: { code: string } } };
export default function VerificationsPage() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = async () => { try { setRequests((await api<{ requests: VerificationRequest[] }>("/verifications/pending")).requests); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load requests"); } };
  useEffect(() => { void load(); }, []);
  useRealtime((event) => { if (event.type === "verification.requested") void load(); });
  async function decide(id: string, decision: "APPROVE" | "REJECT") { setBusy(id); setError(""); try { await api(`/verifications/${id}/decision`, { method: "POST", body: JSON.stringify({ decision, idempotencyKey: crypto.randomUUID() }) }); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save decision"); } finally { setBusy(""); } }

  return <main className="dashboard">
    <header className="dashboard-nav"><Link className="brand" href="/dashboard">TITAN</Link><div><Link className="text-link" href="/notifications">Notifications</Link><Link className="text-link" href="/inventory">My inventory</Link><Link className="text-link" href="/dashboard">← Dashboard</Link></div></header>
    <section className="welcome"><div><p className="eyebrow">SPRINT 040 · VERIFICATION ENGINE</p><h1>Verification requests</h1><p>Confirm only contributions you recognize. Every decision becomes a permanent ledger event.</p></div></section>
    <section className="verification-list">{error && <p className="error" role="alert">{error}</p>}{requests.length ? requests.map((request) => <article className="panel verification-card" key={request.id}><div><p className="eyebrow">PENDING CONTRIBUTION</p><h2>{`${request.actor.firstName ?? ""} ${request.actor.lastName ?? ""}`.trim() || request.actor.email}</h2><p className="muted">Claims a verified connection with you in {request.city.name}, {request.city.state.code}.</p><small>{new Date(request.occurredAt).toLocaleString()} · {request.tokenAmount} tokens</small></div><div className="decision-actions"><button className="button secondary danger" disabled={busy === request.id} onClick={() => decide(request.id, "REJECT")}>Reject</button><button className="button" disabled={busy === request.id} onClick={() => decide(request.id, "APPROVE")}>{busy === request.id ? "Saving…" : "Verify contribution"}</button></div></article>) : <article className="panel empty-state"><div className="achievement"><span>✓</span><div><strong>You are all caught up</strong><small>No contributions are waiting for your decision.</small></div></div></article>}</section>
  </main>;
}
