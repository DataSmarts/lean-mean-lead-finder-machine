import { describe, expect, it, vi } from "vitest";

import type { AppDatabase } from "@/lib/db/client";
import { makeRunsRepo } from "@/lib/db/runs.repo";

import { createRunService } from "./run";

vi.mock("@/lib/db/runs.repo", () => ({ makeRunsRepo: vi.fn() }));

const fakeDb = {} as AppDatabase;

function setup() {
  const create = vi.fn(async (data: Record<string, unknown>) => ({ id: "run-1", ...data }));
  vi.mocked(makeRunsRepo).mockReturnValue({
    create,
  } as unknown as ReturnType<typeof makeRunsRepo>);
  return { create, service: createRunService({ db: fakeDb }) };
}

const validInput = {
  triggerSource: "api" as const,
  city: "Houston",
  country: "USA",
  niche: "family law attorney",
  maxResults: 120,
};

describe("createRunService.create", () => {
  it("inserts a run in queued status with the given trigger source", async () => {
    const { create, service } = setup();

    await service.create(validInput);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      status: "queued",
      triggerSource: "api",
      city: "Houston",
      country: "USA",
      niche: "family law attorney",
      maxResults: 120,
    });
  });

  it("generates a non-empty approval token", async () => {
    const { create, service } = setup();

    await service.create(validInput);

    expect(create.mock.calls[0][0].approvalToken).toEqual(expect.any(String));
    expect((create.mock.calls[0][0].approvalToken as string).length).toBeGreaterThan(0);
  });

  it("defaults neighborhood to null when omitted and passes it through when present", async () => {
    const { create, service } = setup();

    await service.create(validInput);
    await service.create({ ...validInput, neighborhood: "Midtown" });

    expect(create.mock.calls[0][0].neighborhood).toBeNull();
    expect(create.mock.calls[1][0].neighborhood).toBe("Midtown");
  });

  it("generates a distinct approval token per run", async () => {
    const { create, service } = setup();

    await service.create(validInput);
    await service.create(validInput);

    expect(create.mock.calls[0][0].approvalToken).not.toBe(create.mock.calls[1][0].approvalToken);
  });

  it("returns the created run", async () => {
    const { service } = setup();

    const run = await service.create(validInput);

    expect(run).toMatchObject({ id: "run-1" });
  });
});
