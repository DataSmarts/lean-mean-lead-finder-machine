import { describe, expect, it } from "vitest";

import { AiOutputParseError } from "./ai-error";

describe("AiOutputParseError", () => {
  it("is not retryable", () => {
    const err = new AiOutputParseError("parse failed");
    expect(err.retryable).toBe(false);
    expect(err.code).toBe("AI_OUTPUT_PARSE");
    expect(err.message).toBe("parse failed");
  });

  it("is an Error with the right name", () => {
    const err = new AiOutputParseError("msg");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AiOutputParseError");
  });
});
