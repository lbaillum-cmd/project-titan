type Timestamped = { occurredAt: Date };

export function utcDay(date: Date) { return date.toISOString().slice(0, 10); }

export function buildDailySeries<T extends Timestamped>(events: T[], days: number, now = new Date()) {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(utcDay(event.occurredAt), (counts.get(utcDay(event.occurredAt)) ?? 0) + 1);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - index - 1)));
    const day = utcDay(date);
    return { day, count: counts.get(day) ?? 0 };
  });
}

export function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}
