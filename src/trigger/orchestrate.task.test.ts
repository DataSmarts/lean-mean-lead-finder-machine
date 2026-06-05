import { describe, expect, it } from "vitest";

import { mapWaitpointResult } from "./orchestrate.task";

describe("mapWaitpointResult", () => {
  it("returns rejected when ok is false (timeout)", () => {
    expect(mapWaitpointResult({ ok: false })).toBe("rejected");
  });

  it("returns rejected when the decision payload is rejected", () => {
    expect(mapWaitpointResult({ ok: true, output: { decision: "rejected", by: "admin" } })).toBe(
      "rejected",
    );
  });

  it("returns approved when the decision payload is approved", () => {
    expect(
      mapWaitpointResult({ ok: true, output: { decision: "approved", by: "telegram:alice" } }),
    ).toBe("approved");
  });
});
