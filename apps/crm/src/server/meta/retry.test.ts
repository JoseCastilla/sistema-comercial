import { describe, expect, it } from "vitest";

import { MAX_ATTEMPTS, nextAttemptAt } from "./retry";

describe("reintentos del envío", () => {
  const now = new Date("2026-09-12T15:00:00Z");

  it("espera 5 s, 30 s, 2 min y 10 min tras cada fallo", () => {
    expect(nextAttemptAt(1, now)!.getTime() - now.getTime()).toBe(5_000);
    expect(nextAttemptAt(2, now)!.getTime() - now.getTime()).toBe(30_000);
    expect(nextAttemptAt(3, now)!.getTime() - now.getTime()).toBe(120_000);
    expect(nextAttemptAt(4, now)!.getTime() - now.getTime()).toBe(600_000);
  });

  it("al quinto fallo ya no reintenta", () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(nextAttemptAt(5, now)).toBeNull();
    expect(nextAttemptAt(9, now)).toBeNull();
  });
});
