import { describe, expect, it } from "vitest";

import { parseCallbackData, telegramUpdateSchema } from "./telegram";

describe("telegramUpdateSchema", () => {
  const validUpdate = {
    update_id: 1,
    callback_query: {
      id: "cbq-1",
      from: { id: 111, username: "alice" },
      message: { message_id: 42, chat: { id: 9999 } },
      data: "approve:some-token",
    },
  };

  it("parses a valid callback_query update", () => {
    const result = telegramUpdateSchema.safeParse(validUpdate);
    expect(result.success).toBe(true);
  });

  it("parses an update with no callback_query (other update types)", () => {
    const result = telegramUpdateSchema.safeParse({ update_id: 2 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.callback_query).toBeUndefined();
  });

  it("rejects an update with no update_id", () => {
    const result = telegramUpdateSchema.safeParse({ callback_query: validUpdate.callback_query });
    expect(result.success).toBe(false);
  });

  it("parses a user with no username (username is optional)", () => {
    const update = {
      ...validUpdate,
      callback_query: { ...validUpdate.callback_query, from: { id: 111 } },
    };
    const result = telegramUpdateSchema.safeParse(update);
    expect(result.success).toBe(true);
  });
});

describe("parseCallbackData", () => {
  it("parses an approve callback", () => {
    const result = parseCallbackData("approve:abc-123-token");
    expect(result).toEqual({ action: "approve", approvalToken: "abc-123-token" });
  });

  it("parses a reject callback", () => {
    const result = parseCallbackData("reject:abc-123-token");
    expect(result).toEqual({ action: "reject", approvalToken: "abc-123-token" });
  });

  it("returns null for an unrecognised prefix", () => {
    expect(parseCallbackData("unknown:token")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseCallbackData("")).toBeNull();
  });

  it("returns null when there is no colon", () => {
    expect(parseCallbackData("approvetoken")).toBeNull();
  });

  it("preserves a UUID-shaped approval token", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = parseCallbackData(`approve:${uuid}`);
    expect(result?.approvalToken).toBe(uuid);
  });
});
