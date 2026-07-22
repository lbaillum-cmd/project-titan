import { EventEmitter } from "node:events";
import { randomBytes } from "node:crypto";

export type TitanRealtimeEvent =
  | { type: "inventory.updated"; userId: string; correlationId: string }
  | { type: "verification.requested"; userId: string; contributionId: string }
  | { type: "verification.resolved"; userId: string; correlationId: string; decision: "VERIFIED" | "REJECTED" }
  | { type: "community.progress.updated"; userId: string; cityId: string }
  | { type: "notification.created"; userId: string; notificationId: string };

export class RealtimeEngine {
  private readonly emitter = new EventEmitter();
  private readonly tickets = new Map<string, { userId: string; expiresAt: number }>();

  issueTicket(userId: string, now = Date.now()) {
    this.prune(now);
    const ticket = randomBytes(32).toString("base64url");
    this.tickets.set(ticket, { userId, expiresAt: now + 30_000 });
    return { ticket, expiresAt: new Date(now + 30_000).toISOString() };
  }

  consumeTicket(ticket: string, now = Date.now()) {
    const record = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    return record && record.expiresAt > now ? record.userId : null;
  }

  publish(event: TitanRealtimeEvent) { this.emitter.emit(`user:${event.userId}`, event); }
  subscribe(userId: string, listener: (event: TitanRealtimeEvent) => void) {
    const channel = `user:${userId}`;
    this.emitter.on(channel, listener);
    return () => this.emitter.off(channel, listener);
  }

  private prune(now: number) { for (const [ticket, record] of this.tickets) if (record.expiresAt <= now) this.tickets.delete(ticket); }
}

export const realtime = new RealtimeEngine();
