"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

type Notification = { id: string; type: string; title: string; message: string; actionUrl: string | null; readAt: string | null; createdAt: string };
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const load = async () => { try { const data = await api<{ notifications: Notification[]; unreadCount: number }>("/notifications"); setNotifications(data.notifications); setUnreadCount(data.unreadCount); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load notifications"); } };
  useEffect(() => { void load(); }, []);
  useRealtime((event) => { if (event.type === "notification.created") void load(); });
  async function markRead(id: string) { await api(`/notifications/${id}/read`, { method: "PATCH" }); await load(); }
  async function markAllRead() { await api("/notifications/read-all", { method: "POST" }); await load(); }

  return <main className="dashboard">
    <header className="dashboard-nav"><Link className="brand" href="/dashboard">TITAN</Link><div><Link className="text-link" href="/analytics">Analytics</Link><Link className="text-link" href="/admin">Admin</Link><Link className="text-link" href="/inventory">My inventory</Link><Link className="text-link" href="/dashboard">← Dashboard</Link></div></header>
    <section className="welcome"><div><p className="eyebrow">SPRINT 042 · NOTIFICATIONS ENGINE</p><h1>Notifications</h1><p>{unreadCount ? `${unreadCount} update${unreadCount === 1 ? "" : "s"} need your attention.` : "You are up to date."}</p></div>{unreadCount > 0 && <button className="button secondary" onClick={markAllRead}>Mark all read</button>}</section>
    <section className="notification-list">{error && <p className="error" role="alert">{error}</p>}{notifications.length ? notifications.map((notification) => <article className={`notification-item ${notification.readAt ? "read" : "unread"}`} key={notification.id}><span className="notification-indicator" /><div><div className="notification-title"><strong>{notification.title}</strong><small>{new Date(notification.createdAt).toLocaleString()}</small></div><p>{notification.message}</p><div className="notification-actions">{notification.actionUrl && <Link className="text-link" href={notification.actionUrl} onClick={() => !notification.readAt && void markRead(notification.id)}>View action</Link>}{!notification.readAt && <button className="text-button" onClick={() => markRead(notification.id)}>Mark read</button>}</div></div></article>) : <article className="panel empty-state"><div className="achievement"><span>✓</span><div><strong>No notifications yet</strong><small>Important TITAN activity will appear here.</small></div></div></article>}</section>
  </main>;
}
