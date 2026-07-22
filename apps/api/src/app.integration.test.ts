import { prisma } from "@titan/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const integration = process.env.RUN_INTEGRATION === "true" ? describe : describe.skip;
integration("database-backed First Loop", () => {
  const app = buildApp();
  let founderToken = ""; let participantToken = ""; let contributionId = "";
  beforeAll(async () => {
    await app.ready();
    await prisma.adminAuditLog.deleteMany(); await prisma.notification.deleteMany(); await prisma.inventoryEvent.deleteMany(); await prisma.communityMembership.deleteMany(); await prisma.city.deleteMany(); await prisma.state.deleteMany(); await prisma.communityRole.deleteMany(); await prisma.session.deleteMany(); await prisma.profile.deleteMany(); await prisma.user.deleteMany();
  });
  afterAll(async () => app.close());
  async function register(email: string, firstName: string) { const response = await app.inject({ method: "POST", url: "/auth/register", payload: { email, password: "BetaTestPassword1!", firstName, lastName: "Tester" } }); expect(response.statusCode).toBe(201); return response.json().accessToken as string; }
  async function selectCommunity(token: string) { const response = await app.inject({ method: "PUT", url: "/me/community", headers: { authorization: `Bearer ${token}` }, payload: { state: "Michigan", stateCode: "MI", city: "Detroit", role: "Community Leader" } }); expect(response.statusCode).toBe(200); }

  it("registers and onboards two members", async () => { founderToken = await register("founder@beta.test", "Founder"); participantToken = await register("participant@beta.test", "Participant"); await selectCommunity(founderToken); await selectCommunity(participantToken); });
  it("records a five-token contribution", async () => { const response = await app.inject({ method: "POST", url: "/inventory/contributions", headers: { authorization: `Bearer ${founderToken}` }, payload: { participantEmail: "participant@beta.test", idempotencyKey: "beta-contribution-0001" } }); expect(response.statusCode).toBe(201); contributionId = response.json().event.id; });
  it("lets the named participant verify the contribution", async () => { const pending = await app.inject({ method: "GET", url: "/verifications/pending", headers: { authorization: `Bearer ${participantToken}` } }); expect(pending.json().requests).toHaveLength(1); const decision = await app.inject({ method: "POST", url: `/verifications/${contributionId}/decision`, headers: { authorization: `Bearer ${participantToken}` }, payload: { decision: "APPROVE", idempotencyKey: "beta-verification-0001" } }); expect(decision.statusCode).toBe(201); });
  it("projects the founder inventory as verified", async () => { const response = await app.inject({ method: "GET", url: "/inventory", headers: { authorization: `Bearer ${founderToken}` } }); expect(response.json().totals).toMatchObject({ total: 5, verified: 5, pending: 0 }); });
});
