import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { email: string };
    user: { sub: string; email: string };
  }
}
