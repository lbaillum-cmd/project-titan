import { describe, expect, it } from "vitest";
import { validateEnvironment } from "./config.js";
describe("environment validation", () => {
  it("provides safe local defaults", () => expect(validateEnvironment({} as NodeJS.ProcessEnv).API_PORT).toBe(4000));
  it("rejects weak production secrets", () => expect(() => validateEnvironment({ NODE_ENV: "production", JWT_SECRET: "weak", DATABASE_URL: "postgresql://db/titan" } as NodeJS.ProcessEnv)).toThrow("Invalid environment configuration"));
  it("requires a production database", () => expect(() => validateEnvironment({ NODE_ENV: "production", JWT_SECRET: "a".repeat(32) } as NodeJS.ProcessEnv)).toThrow("DATABASE_URL is required"));
});
