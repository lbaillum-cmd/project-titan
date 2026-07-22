import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { prisma } from "@titan/database";
import bcrypt from "bcryptjs";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { projectInventory } from "./inventory.js";
import { realtime } from "./realtime.js";
import { buildDailySeries, percentage } from "./analytics.js";

const registerSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(10),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});
const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});
const communitySchema = z.object({
  state: z.string().trim().min(2).max(80),
  stateCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  city: z.string().trim().min(2).max(80),
  role: z.string().trim().min(2).max(80),
});
const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(300).optional(),
});
const contributionSchema = z.object({
  participantEmail: z.string().email().transform((value) => value.toLowerCase()),
  idempotencyKey: z.string().trim().min(16).max(120),
  note: z.string().trim().max(200).optional(),
});
const verificationDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  idempotencyKey: z.string().trim().min(16).max(120),
  reason: z.string().trim().max(200).optional(),
});
const accountStatusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]), reason: z.string().trim().min(3).max(200) });

type JwtUser = { sub: string; email: string };
const refreshTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  app.register(cors, { origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true });
  app.register(cookie);
  app.register(jwt, { secret: process.env.JWT_SECRET ?? "local-development-secret-change-me" });
  app.register(helmet, { contentSecurityPolicy: false });
  app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  app.register(websocket);

  const authenticate = async (request: FastifyRequest) => request.jwtVerify<JwtUser>();
  const authorizeAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request);
    const operator = await prisma.user.findUnique({ where: { id: request.user.sub }, select: { role: true, status: true } });
    if (!operator || operator.role !== "ADMIN" || operator.status !== "ACTIVE") return reply.status(403).send({ error: "Administrator access required" });
  };
  const accessTokenFor = (user: { id: string; email: string }) =>
    app.jwt.sign({ email: user.email }, { sub: user.id, expiresIn: "15m" });

  async function createSession(user: { id: string; email: string }, reply: FastifyReply) {
    const token = randomBytes(48).toString("base64url");
    await prisma.session.create({
      data: { userId: user.id, refreshTokenHash: refreshTokenHash(token), expiresAt: new Date(Date.now() + 30 * 86_400_000) },
    });
    reply.setCookie("titan_refresh", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/auth",
      maxAge: 30 * 86_400,
    });
    return accessTokenFor(user);
  }

  app.get("/", async () => ({ name: "PROJECT TITAN API", version: "1.1.0-beta.1", status: "running" }));
  app.get("/health/live", async () => ({ status: "alive", timestamp: new Date().toISOString() }));
  app.get("/health/ready", async (_request, reply) => {
    try { await prisma.$queryRaw`SELECT 1`; return { status: "ready", database: "connected", timestamp: new Date().toISOString() }; }
    catch { return reply.status(503).send({ status: "not-ready", database: "offline", timestamp: new Date().toISOString() }); }
  });
  app.get("/health", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "healthy", api: "online", database: "connected", timestamp: new Date().toISOString() };
    } catch {
      return reply.status(503).send({ status: "degraded", api: "online", database: "offline", timestamp: new Date().toISOString() });
    }
  });

  app.post("/auth/register", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid registration details", details: parsed.error.flatten() });
    const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (exists) return reply.status(409).send({ error: "An account already exists for this email" });
    const user = await prisma.user.create({
      data: { ...parsed.data, passwordHash: await bcrypt.hash(parsed.data.password, 12), profile: { create: {} } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const accessToken = await createSession(user, reply);
    return reply.status(201).send({ accessToken, user });
  });

  app.post("/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid email or password" });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash)))
      return reply.status(401).send({ error: "Invalid email or password" });
    if (user.status === "SUSPENDED") return reply.status(403).send({ error: "This account is suspended" });
    const accessToken = await createSession(user, reply);
    return { accessToken, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } };
  });

  app.post("/auth/refresh", async (request, reply) => {
    const token = request.cookies.titan_refresh;
    if (!token) return reply.status(401).send({ error: "Refresh token required" });
    const session = await prisma.session.findUnique({ where: { refreshTokenHash: refreshTokenHash(token) }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return reply.status(401).send({ error: "Session expired" });
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return { accessToken: await createSession(session.user, reply) };
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies.titan_refresh;
    if (token) await prisma.session.updateMany({ where: { refreshTokenHash: refreshTokenHash(token), revokedAt: null }, data: { revokedAt: new Date() } });
    reply.clearCookie("titan_refresh", { path: "/auth" });
    return reply.status(204).send();
  });

  app.get("/me", { preHandler: authenticate }, async (request) => {
    const userId = request.user.sub;
    return prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, profile: true, membership: { include: { state: true, city: true, role: true } } },
    });
  });

  app.patch("/me/profile", { preHandler: authenticate }, async (request, reply) => {
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid profile", details: parsed.error.flatten() });
    return prisma.user.update({
      where: { id: request.user.sub },
      data: { firstName: parsed.data.firstName, lastName: parsed.data.lastName, profile: { upsert: { create: { bio: parsed.data.bio }, update: { bio: parsed.data.bio } } } },
      select: { id: true, email: true, firstName: true, lastName: true, profile: true },
    });
  });

  app.put("/me/community", { preHandler: authenticate }, async (request, reply) => {
    const parsed = communitySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid community selection", details: parsed.error.flatten() });
    const state = await prisma.state.upsert({ where: { code: parsed.data.stateCode }, update: { name: parsed.data.state }, create: { name: parsed.data.state, code: parsed.data.stateCode } });
    const city = await prisma.city.upsert({ where: { stateId_name: { stateId: state.id, name: parsed.data.city } }, update: {}, create: { stateId: state.id, name: parsed.data.city } });
    const role = await prisma.communityRole.upsert({ where: { name: parsed.data.role }, update: {}, create: { name: parsed.data.role } });
    const membership = await prisma.communityMembership.upsert({
      where: { userId: request.user.sub },
      update: { stateId: state.id, cityId: city.id, roleId: role.id },
      create: { userId: request.user.sub, stateId: state.id, cityId: city.id, roleId: role.id },
      include: { state: true, city: true, role: true },
    });
    realtime.publish({ type: "community.progress.updated", userId: request.user.sub, cityId: city.id });
    return membership;
  });

  app.post("/realtime/ticket", { preHandler: authenticate }, async (request) => realtime.issueTicket(request.user.sub));
  app.get("/realtime", { websocket: true }, (socket, request) => {
    const query = z.object({ ticket: z.string().min(1) }).safeParse(request.query);
    const userId = query.success ? realtime.consumeTicket(query.data.ticket) : null;
    if (!userId) { socket.close(1008, "Invalid or expired ticket"); return; }
    socket.send(JSON.stringify({ type: "connection.ready", connectedAt: new Date().toISOString() }));
    const unsubscribe = realtime.subscribe(userId, (event) => socket.readyState === socket.OPEN && socket.send(JSON.stringify(event)));
    socket.on("close", unsubscribe);
  });

  async function notify(data: { userId: string; type: "CONTRIBUTION_RECEIVED" | "CONTRIBUTION_VERIFIED" | "CONTRIBUTION_REJECTED" | "COMMUNITY_PROGRESS" | "SYSTEM"; title: string; message: string; actionUrl?: string }) {
    const notification = await prisma.notification.create({ data });
    realtime.publish({ type: "notification.created", userId: data.userId, notificationId: notification.id });
    return notification;
  }

  app.get("/notifications", { preHandler: authenticate }, async (request) => {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where: { userId: request.user.sub }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.notification.count({ where: { userId: request.user.sub, readAt: null } }),
    ]);
    return { notifications, unreadCount };
  });

  app.patch("/notifications/:notificationId/read", { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ notificationId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid notification" });
    const result = await prisma.notification.updateMany({ where: { id: params.data.notificationId, userId: request.user.sub }, data: { readAt: new Date() } });
    if (!result.count) return reply.status(404).send({ error: "Notification not found" });
    return reply.status(204).send();
  });

  app.post("/notifications/read-all", { preHandler: authenticate }, async (request) => {
    const result = await prisma.notification.updateMany({ where: { userId: request.user.sub, readAt: null }, data: { readAt: new Date() } });
    return { updated: result.count };
  });

  app.get("/admin/overview", { preHandler: authorizeAdmin }, async () => {
    const [users, activeUsers, suspendedUsers, communities, pendingVerifications, inventoryEvents, unreadNotifications] = await Promise.all([
      prisma.user.count(), prisma.user.count({ where: { status: "ACTIVE" } }), prisma.user.count({ where: { status: "SUSPENDED" } }),
      prisma.city.count(), prisma.inventoryEvent.count({ where: { eventType: "CONTRIBUTION_RECORDED", status: "PENDING" } }),
      prisma.inventoryEvent.count(), prisma.notification.count({ where: { readAt: null } }),
    ]);
    return { users, activeUsers, suspendedUsers, communities, pendingVerifications, inventoryEvents, unreadNotifications };
  });

  app.get("/admin/users", { preHandler: authorizeAdmin }, async () => ({ users: await prisma.user.findMany({
    orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, createdAt: true, membership: { include: { city: true, state: true, role: true } } },
  }) }));

  app.get("/admin/disputes", { preHandler: authorizeAdmin }, async () => ({ disputes: await prisma.inventoryEvent.findMany({
    where: { eventType: "CONTRIBUTION_REJECTED" }, orderBy: { occurredAt: "desc" }, take: 100,
    include: { actor: { select: { email: true } }, subject: { select: { email: true } }, city: { include: { state: true } } },
  }) }));

  app.get("/admin/audit-log", { preHandler: authorizeAdmin }, async () => ({ auditLog: await prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { email: true } } } }) }));

  app.get("/admin/analytics", { preHandler: authorizeAdmin }, async () => {
    const since = new Date(Date.now() - 29 * 86_400_000);
    const [users, onboarded, communities, recorded, verified, rejected, inventoryEvents, memberships] = await Promise.all([
      prisma.user.count(), prisma.communityMembership.count(), prisma.city.count(),
      prisma.inventoryEvent.count({ where: { eventType: "CONTRIBUTION_RECORDED" } }),
      prisma.inventoryEvent.count({ where: { eventType: "CONTRIBUTION_VERIFIED" } }),
      prisma.inventoryEvent.count({ where: { eventType: "CONTRIBUTION_REJECTED" } }),
      prisma.inventoryEvent.findMany({ where: { occurredAt: { gte: since } }, select: { occurredAt: true } }),
      prisma.communityMembership.findMany({ where: { joinedAt: { gte: since } }, select: { joinedAt: true } }),
    ]);
    return {
      summary: { users, onboarded, communities, recordedContributions: recorded, verifiedContributions: verified, rejectedContributions: rejected, onboardingRate: percentage(onboarded, users), verificationRate: percentage(verified, recorded), rejectionRate: percentage(rejected, recorded), verifiedTokens: verified * 5 },
      trends: { inventoryEvents: buildDailySeries(inventoryEvents, 30), newMemberships: buildDailySeries(memberships.map((item) => ({ occurredAt: item.joinedAt })), 30) },
      generatedAt: new Date().toISOString(),
    };
  });

  app.get("/analytics/me", { preHandler: authenticate }, async (request) => {
    const recorded = await prisma.inventoryEvent.findMany({ where: { actorUserId: request.user.sub, eventType: "CONTRIBUTION_RECORDED" } });
    const ledger = await prisma.inventoryEvent.findMany({ where: { correlationId: { in: recorded.map((event) => event.correlationId) } }, orderBy: { occurredAt: "asc" } });
    const projection = projectInventory(ledger);
    return { inventory: { ...projection.totals, participants: projection.contributions.length, verificationRate: percentage(projection.totals.verified, projection.totals.total) }, trend: buildDailySeries(recorded, 30), generatedAt: new Date().toISOString() };
  });

  app.patch("/admin/users/:userId/status", { preHandler: authorizeAdmin }, async (request, reply) => {
    const params = z.object({ userId: z.string().min(1) }).safeParse(request.params);
    const parsed = accountStatusSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return reply.status(400).send({ error: "Invalid account status change" });
    if (params.data.userId === request.user.sub && parsed.data.status === "SUSPENDED") return reply.status(409).send({ error: "Administrators cannot suspend their own account" });
    const target = await prisma.user.findUnique({ where: { id: params.data.userId }, select: { id: true, email: true } });
    if (!target) return reply.status(404).send({ error: "User not found" });
    const [user] = await prisma.$transaction([
      prisma.user.update({ where: { id: target.id }, data: { status: parsed.data.status }, select: { id: true, email: true, status: true } }),
      prisma.adminAuditLog.create({ data: { actorUserId: request.user.sub, action: "USER_STATUS_CHANGED", targetType: "User", targetId: target.id, metadata: { fromEmail: target.email, toStatus: parsed.data.status, reason: parsed.data.reason } } }),
      ...(parsed.data.status === "SUSPENDED" ? [prisma.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } })] : []),
    ]);
    return { user };
  });

  app.post("/inventory/contributions", { preHandler: authenticate }, async (request, reply) => {
    const parsed = contributionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid contribution", details: parsed.error.flatten() });
    const actor = await prisma.user.findUnique({ where: { id: request.user.sub }, include: { membership: true } });
    if (!actor?.membership) return reply.status(409).send({ error: "Complete community selection first", code: "ONBOARDING_REQUIRED" });
    if (actor.email === parsed.data.participantEmail) return reply.status(400).send({ error: "You cannot add yourself to your inventory" });
    const subject = await prisma.user.findUnique({ where: { email: parsed.data.participantEmail }, include: { membership: true } });
    if (!subject?.membership || subject.membership.cityId !== actor.membership.cityId)
      return reply.status(404).send({ error: "Participant must be a TITAN member in your selected city" });
    const existing = await prisma.inventoryEvent.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
    if (existing) return reply.status(200).send({ event: existing, duplicate: true });
    const priorContribution = await prisma.inventoryEvent.findFirst({
      where: { actorUserId: actor.id, subjectUserId: subject.id, eventType: "CONTRIBUTION_RECORDED", status: { in: ["PENDING", "VERIFIED"] } },
    });
    if (priorContribution) return reply.status(409).send({ error: "This participant is already in your inventory" });
    const event = await prisma.inventoryEvent.create({
      data: {
        eventType: "CONTRIBUTION_RECORDED", status: "PENDING", tokenAmount: 5,
        actorUserId: actor.id, subjectUserId: subject.id, cityId: actor.membership.cityId,
        idempotencyKey: parsed.data.idempotencyKey, correlationId: randomBytes(16).toString("hex"),
        metadata: parsed.data.note ? { note: parsed.data.note } : undefined,
      },
    });
    realtime.publish({ type: "inventory.updated", userId: actor.id, correlationId: event.correlationId });
    realtime.publish({ type: "verification.requested", userId: subject.id, contributionId: event.id });
    await notify({ userId: subject.id, type: "CONTRIBUTION_RECEIVED", title: "Contribution awaiting verification", message: `${actor.firstName ?? "A TITAN member"} added you to their inventory.`, actionUrl: "/verifications" });
    return reply.status(201).send({ event, duplicate: false });
  });

  app.get("/inventory", { preHandler: authenticate }, async (request) => {
    const recorded = await prisma.inventoryEvent.findMany({ where: { actorUserId: request.user.sub, eventType: "CONTRIBUTION_RECORDED" }, select: { correlationId: true } });
    const events = await prisma.inventoryEvent.findMany({
      where: { correlationId: { in: recorded.map((event) => event.correlationId) } }, orderBy: { occurredAt: "desc" },
      include: { subject: { select: { firstName: true, lastName: true, email: true } }, city: { select: { name: true, state: { select: { code: true } } } } },
    });
    const projection = projectInventory(events);
    return { totals: projection.totals, personalizedTokensPerParticipant: 5, events: projection.contributions };
  });

  app.get("/verifications/pending", { preHandler: authenticate }, async (request) => {
    const candidates = await prisma.inventoryEvent.findMany({
      where: { subjectUserId: request.user.sub, eventType: "CONTRIBUTION_RECORDED" },
      include: { actor: { select: { firstName: true, lastName: true, email: true } }, city: { select: { name: true, state: { select: { code: true } } } } },
      orderBy: { occurredAt: "desc" },
    });
    const decisions = await prisma.inventoryEvent.findMany({ where: { correlationId: { in: candidates.map((event) => event.correlationId) }, eventType: { not: "CONTRIBUTION_RECORDED" } }, select: { correlationId: true } });
    const decided = new Set(decisions.map((event) => event.correlationId));
    return { requests: candidates.filter((event) => !decided.has(event.correlationId)) };
  });

  app.post("/verifications/:eventId/decision", { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ eventId: z.string().min(1) }).safeParse(request.params);
    const parsed = verificationDecisionSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return reply.status(400).send({ error: "Invalid verification decision" });
    const contribution = await prisma.inventoryEvent.findUnique({ where: { id: params.data.eventId } });
    if (!contribution || contribution.eventType !== "CONTRIBUTION_RECORDED" || contribution.subjectUserId !== request.user.sub)
      return reply.status(404).send({ error: "Pending verification request not found" });
    const existingKey = await prisma.inventoryEvent.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
    if (existingKey) return reply.status(200).send({ event: existingKey, duplicate: true });
    const priorDecision = await prisma.inventoryEvent.findFirst({ where: { correlationId: contribution.correlationId, eventType: { not: "CONTRIBUTION_RECORDED" } } });
    if (priorDecision) return reply.status(409).send({ error: "This contribution has already been decided" });
    const approved = parsed.data.decision === "APPROVE";
    const event = await prisma.inventoryEvent.create({ data: {
      eventType: approved ? "CONTRIBUTION_VERIFIED" : "CONTRIBUTION_REJECTED",
      status: approved ? "VERIFIED" : "REJECTED", tokenAmount: contribution.tokenAmount,
      actorUserId: request.user.sub, subjectUserId: contribution.subjectUserId, cityId: contribution.cityId,
      idempotencyKey: parsed.data.idempotencyKey, correlationId: contribution.correlationId,
      metadata: parsed.data.reason ? { reason: parsed.data.reason } : undefined,
    } });
    realtime.publish({ type: "inventory.updated", userId: contribution.actorUserId, correlationId: contribution.correlationId });
    realtime.publish({ type: "verification.resolved", userId: contribution.actorUserId, correlationId: contribution.correlationId, decision: approved ? "VERIFIED" : "REJECTED" });
    await notify({ userId: contribution.actorUserId, type: approved ? "CONTRIBUTION_VERIFIED" : "CONTRIBUTION_REJECTED", title: approved ? "Contribution verified" : "Contribution rejected", message: approved ? "Five personalized tokens are now verified in your inventory." : "A participant did not verify this contribution.", actionUrl: "/inventory" });
    return reply.status(201).send({ event, duplicate: false });
  });

  app.get("/dashboard", { preHandler: authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.sub }, include: { membership: { include: { state: true, city: true, role: true } } } });
    if (!user) return reply.status(404).send({ error: "User not found" });
    if (!user.membership) return reply.status(409).send({ error: "Complete community selection first", code: "ONBOARDING_REQUIRED" });
    const [communityMembers, recordedInventoryEvents] = await Promise.all([
      prisma.communityMembership.count({ where: { cityId: user.membership.cityId } }),
      prisma.inventoryEvent.findMany({ where: { actorUserId: user.id, eventType: "CONTRIBUTION_RECORDED" } }),
    ]);
    const inventoryEvents = await prisma.inventoryEvent.findMany({ where: { correlationId: { in: recordedInventoryEvents.map((event) => event.correlationId) } } });
    const cityTarget = 200;
    const communityProgress = Math.min(100, Math.round((communityMembers / cityTarget) * 100));
    return {
      user: { firstName: user.firstName ?? "Member", role: user.membership.role.name },
      community: { city: user.membership.city.name, state: user.membership.state.name, members: communityMembers, target: cityTarget, progress: communityProgress },
      stateProgress: { completedCities: 0, targetCities: 10, progress: 0 },
      titanScore: 50,
      inventory: (() => { const projected = projectInventory(inventoryEvents); return { totalTokens: projected.totals.total, verifiedTokens: projected.totals.verified, pendingTokens: projected.totals.pending, participants: projected.contributions.length }; })(),
      rank: communityMembers,
      nextMission: { title: "Invite one verified community member", description: `Help ${user.membership.city.name} move closer to its first 200 verified participants.`, reward: 100 },
      activity: [{ id: "welcome", text: `You joined ${user.membership.city.name} as ${user.membership.role.name}.`, occurredAt: user.membership.joinedAt }],
      achievements: [{ id: "first-step", name: "First Step", earned: true }],
    };
  });

  app.addHook("onClose", async () => prisma.$disconnect());
  return app;
}
