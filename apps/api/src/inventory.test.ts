import { describe, expect, it } from "vitest";
import { projectInventory } from "./inventory.js";

const base = { id: "recorded", correlationId: "flow-1", eventType: "CONTRIBUTION_RECORDED" as const, status: "PENDING" as const, tokenAmount: 5, occurredAt: new Date("2026-07-16T12:00:00Z") };
describe("inventory ledger projection", () => {
  it("keeps a new contribution pending", () => expect(projectInventory([base]).totals).toEqual({ total: 5, verified: 0, pending: 5, rejected: 0 }));
  it("projects approval without changing the original event", () => {
    const approval = { ...base, id: "approved", eventType: "CONTRIBUTION_VERIFIED" as const, status: "VERIFIED" as const, occurredAt: new Date("2026-07-16T12:01:00Z") };
    const result = projectInventory([base, approval]);
    expect(result.totals).toEqual({ total: 5, verified: 5, pending: 0, rejected: 0 });
    expect(base.status).toBe("PENDING");
  });
  it("projects rejection out of counted inventory", () => {
    const rejection = { ...base, id: "rejected", eventType: "CONTRIBUTION_REJECTED" as const, status: "REJECTED" as const, occurredAt: new Date("2026-07-16T12:01:00Z") };
    expect(projectInventory([base, rejection]).totals).toEqual({ total: 5, verified: 0, pending: 0, rejected: 5 });
  });
});
