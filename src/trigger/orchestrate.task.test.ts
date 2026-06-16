import { describe, expect, it } from "vitest";

import { mapWaitpointResult, shouldSendApprovalPrompt } from "./orchestrate.task";

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

describe("shouldSendApprovalPrompt", () => {
  it("sends when no Telegram approval message has been recorded", () => {
    expect(shouldSendApprovalPrompt({ approvalMessageId: null })).toBe(true);
  });

  it("skips when a Telegram approval message was already recorded", () => {
    expect(shouldSendApprovalPrompt({ approvalMessageId: 123 })).toBe(false);
  });
});
