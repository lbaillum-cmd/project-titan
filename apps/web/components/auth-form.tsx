"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, saveToken } from "@/lib/api";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api<{ accessToken: string }>(`/auth/${mode}`, { method: "POST", body: JSON.stringify(data) });
      saveToken(result.accessToken); router.push(mode === "register" ? "/onboarding" : "/dashboard");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to continue"); setBusy(false); }
  }
  const isRegister = mode === "register";
  return <main className="centered"><section className="form-card"><Link className="brand" href="/">TITAN</Link><p className="eyebrow">{isRegister ? "STEP 1 OF 2" : "WELCOME BACK"}</p><h1>{isRegister ? "Create your account" : "Sign in"}</h1><p className="muted">{isRegister ? "Start building meaningful community progress." : "Continue your TITAN journey."}</p><form onSubmit={submit}>{isRegister && <div className="form-row"><label>First name<input required name="firstName" autoComplete="given-name" /></label><label>Last name<input required name="lastName" autoComplete="family-name" /></label></div>}<label>Email<input required name="email" type="email" autoComplete="email" /></label><label>Password<input required name="password" type="password" minLength={isRegister ? 10 : 1} autoComplete={isRegister ? "new-password" : "current-password"} /></label>{error && <p className="error" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}</button></form><p className="switch">{isRegister ? "Already a member?" : "New to TITAN?"} <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link></p></section></main>;
}
