import { describe, expect, it, vi } from "vitest";
import { RealtimeEngine } from "./realtime.js";

describe("RealtimeEngine", () => {
  it("consumes connection tickets once", () => { const engine = new RealtimeEngine(); const { ticket } = engine.issueTicket("user-1", 1000); expect(engine.consumeTicket(ticket, 1001)).toBe("user-1"); expect(engine.consumeTicket(ticket, 1002)).toBeNull(); });
  it("rejects expired tickets", () => { const engine = new RealtimeEngine(); const { ticket } = engine.issueTicket("user-1", 1000); expect(engine.consumeTicket(ticket, 31_001)).toBeNull(); });
  it("delivers only user-scoped events and unsubscribes", () => { const engine = new RealtimeEngine(); const listener = vi.fn(); const unsubscribe = engine.subscribe("user-1", listener); engine.publish({ type: "inventory.updated", userId: "user-2", correlationId: "x" }); engine.publish({ type: "inventory.updated", userId: "user-1", correlationId: "y" }); unsubscribe(); engine.publish({ type: "inventory.updated", userId: "user-1", correlationId: "z" }); expect(listener).toHaveBeenCalledTimes(1); expect(listener.mock.calls[0]?.[0]).toMatchObject({ correlationId: "y" }); });
});
