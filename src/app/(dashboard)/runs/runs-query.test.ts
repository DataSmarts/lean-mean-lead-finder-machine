import { describe, expect, it } from "vitest";

import { buildRunsHref } from "./runs-query";

describe("buildRunsHref", () => {
  it("returns the runs route when status is unset and page is first page", () => {
    expect(buildRunsHref({ page: 1 })).toBe("/runs");
  });

  it("serializes status without first-page pagination", () => {
    expect(buildRunsHref({ status: "completed", page: 1 })).toBe("/runs?status=completed");
  });

  it("serializes pagination without status", () => {
    expect(buildRunsHref({ page: 2 })).toBe("/runs?page=2");
  });

  it("serializes status before pagination", () => {
    expect(buildRunsHref({ status: "awaiting_approval", page: 3 })).toBe(
      "/runs?status=awaiting_approval&page=3",
    );
  });
});
