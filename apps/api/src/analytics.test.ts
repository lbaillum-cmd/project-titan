import { describe, expect, it } from "vitest";
import { buildDailySeries, percentage, utcDay } from "./analytics.js";

describe("analytics calculations", () => {
  it("uses stable UTC day buckets", () => expect(utcDay(new Date("2026-07-16T23:59:59Z"))).toBe("2026-07-16"));
  it("fills missing trend days with zero", () => expect(buildDailySeries([{ occurredAt: new Date("2026-07-15T12:00:00Z") }], 3, new Date("2026-07-16T18:00:00Z"))).toEqual([{ day: "2026-07-14", count: 0 }, { day: "2026-07-15", count: 1 }, { day: "2026-07-16", count: 0 }]));
  it("returns a safe, rounded percentage", () => { expect(percentage(2, 3)).toBe(66.7); expect(percentage(2, 0)).toBe(0); });
});
