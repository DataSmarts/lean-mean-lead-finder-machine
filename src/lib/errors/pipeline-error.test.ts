import { describe, expect, it } from "vitest";

import { AppError } from "./app-error";
import { PipelineStateError } from "./pipeline-error";

describe("PipelineStateError", () => {
  it("uses the pipeline state error code", () => {
    const error = new PipelineStateError("missing run business");
    expect(error.code).toBe("PIPELINE_STATE_ERROR");
  });

  it("is an AppError", () => {
    expect(new PipelineStateError("missing run business")).toBeInstanceOf(AppError);
  });

  it("is not retryable by default", () => {
    expect(new PipelineStateError("missing run business").retryable).toBe(false);
  });

  it("carries context", () => {
    const error = new PipelineStateError("missing run business", {
      context: { runBusinessId: "rb-1" },
    });
    expect(error.context).toMatchObject({ runBusinessId: "rb-1" });
  });
});
