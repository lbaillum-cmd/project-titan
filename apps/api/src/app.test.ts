import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const app = buildApp();

beforeAll(async () => app.ready());
afterAll(async () => app.close());

describe("TITAN API contract", () => {
  it("reports the consolidated recovery version", async () => {
    const response = await app.inject({ method: "GET", url: "/" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ name: "PROJECT TITAN API", version: "1.1.0-beta.1", status: "running" });
  });

  it("protects inventory data", async () => {
    const response = await app.inject({ method: "GET", url: "/inventory" });
    expect(response.statusCode).toBe(401);
  });

  it("rejects malformed contributions before database access", async () => {
    const token = app.jwt.sign({ email: "member@example.com" }, { sub: "member-1" });
    const response = await app.inject({ method: "POST", url: "/inventory/contributions", headers: { authorization: `Bearer ${token}` }, payload: { participantEmail: "bad", idempotencyKey: "short" } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("Invalid contribution");
  });

  it("protects verification requests", async () => {
    const response = await app.inject({ method: "GET", url: "/verifications/pending" });
    expect(response.statusCode).toBe(401);
  });

  it("protects real-time connection tickets", async () => {
    const response = await app.inject({ method: "POST", url: "/realtime/ticket" });
    expect(response.statusCode).toBe(401);
  });

  it("protects persistent notifications", async () => {
    const response = await app.inject({ method: "GET", url: "/notifications" });
    expect(response.statusCode).toBe(401);
  });

  it("protects administration endpoints", async () => {
    const response = await app.inject({ method: "GET", url: "/admin/overview" });
    expect(response.statusCode).toBe(401);
  });

  it("protects personal analytics", async () => {
    const response = await app.inject({ method: "GET", url: "/analytics/me" });
    expect(response.statusCode).toBe(401);
  });

  it("exposes a database-independent liveness probe", async () => {
    const response = await app.inject({ method: "GET", url: "/health/live" });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("alive");
  });

  it("rejects malformed notification identifiers before database access", async () => {
    const token = app.jwt.sign({ email: "member@example.com" }, { sub: "member-1" });
    const response = await app.inject({ method: "PATCH", url: "/notifications//read", headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(400);
  });

  it("rejects malformed verification decisions before database access", async () => {
    const token = app.jwt.sign({ email: "member@example.com" }, { sub: "member-1" });
    const response = await app.inject({ method: "POST", url: "/verifications/event-1/decision", headers: { authorization: `Bearer ${token}` }, payload: { decision: "MAYBE", idempotencyKey: "short" } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("Invalid verification decision");
  });

  it("protects dashboard data", async () => {
    const response = await app.inject({ method: "GET", url: "/dashboard" });
    expect(response.statusCode).toBe(401);
  });

  it("rejects invalid registration input before database access", async () => {
    const response = await app.inject({ method: "POST", url: "/auth/register", payload: { email: "not-an-email", password: "short" } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("Invalid registration details");
  });
});
