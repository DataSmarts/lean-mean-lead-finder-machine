export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

// Spreads `updatedAt` onto `values` using the provided clock (default: system).
// Call on every repo write — updated_at is repo-owned, never a DB trigger (§6.4).
export function withUpdatedAt<T extends object>(
  values: T,
  clock: Clock = systemClock,
): T & { updatedAt: Date } {
  return { ...values, updatedAt: clock.now() };
}
