type LedgerEvent = {
  id: string;
  correlationId: string;
  eventType: "CONTRIBUTION_RECORDED" | "CONTRIBUTION_VERIFIED" | "CONTRIBUTION_REJECTED" | "REVERSAL_RECORDED";
  status: "PENDING" | "VERIFIED" | "REJECTED" | "REVERSED";
  tokenAmount: number;
  occurredAt: Date;
};

export function projectInventory<T extends LedgerEvent>(events: T[]) {
  const streams = new Map<string, T[]>();
  for (const event of events) streams.set(event.correlationId, [...(streams.get(event.correlationId) ?? []), event]);
  const contributions = [...streams.values()].flatMap((stream) => {
    const ordered = [...stream].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    const recorded = ordered.find((event) => event.eventType === "CONTRIBUTION_RECORDED");
    if (!recorded) return [];
    const decision = [...ordered].reverse().find((event) => event.eventType !== "CONTRIBUTION_RECORDED");
    return [{ ...recorded, projectedStatus: decision?.status ?? recorded.status, decisionEventId: decision?.id ?? null }];
  });
  return {
    contributions,
    totals: contributions.reduce((totals, item) => {
      totals.total += item.tokenAmount;
      if (item.projectedStatus === "VERIFIED") totals.verified += item.tokenAmount;
      if (item.projectedStatus === "PENDING") totals.pending += item.tokenAmount;
      if (item.projectedStatus === "REJECTED") totals.rejected += item.tokenAmount;
      return totals;
    }, { total: 0, verified: 0, pending: 0, rejected: 0 }),
  };
}
