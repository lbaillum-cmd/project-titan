"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

const roles = ["Business Owner", "Parent", "Teacher", "Student", "Veteran", "Healthcare Professional", "Community Leader", "Volunteer"];
export default function OnboardingPage() {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { await api("/me/community", { method: "PUT", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); router.push("/dashboard"); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save community"); setBusy(false); } }
  return <main className="centered"><section className="form-card wide"><Link className="brand" href="/">TITAN</Link><p className="eyebrow">STEP 2 OF 2</p><h1>Choose your community</h1><p className="muted">Your selection determines the city progress you help build.</p><form onSubmit={submit}><div className="form-row"><label>State<input name="state" defaultValue="Michigan" required /></label><label>State code<input name="stateCode" defaultValue="MI" minLength={2} maxLength={2} required /></label></div><label>City<input name="city" defaultValue="Detroit" required /></label><label>Community role<select name="role" defaultValue="Community Leader">{roles.map(role => <option key={role}>{role}</option>)}</select></label>{error && <p className="error" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy ? "Saving…" : "Enter my dashboard"}</button></form></section></main>;
}
