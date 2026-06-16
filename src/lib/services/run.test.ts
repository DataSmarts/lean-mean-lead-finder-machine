import { describe, expect, it, vi } from "vitest";

import type { AppDatabase } from "@/lib/db/client";
import { makeRunsRepo } from "@/lib/db/runs.repo";

import { createRunService } from "./run";

vi.mock("@/lib/db/runs.repo", () => ({ makeRunsRepo: vi.fn() }));

const fakeDb = {} as AppDatabase;

function setup() {
  const create = vi.fn(async (data: Record<string, unknown>) => ({ id: "run-1", ...data }));
  const updateStatus = vi.fn(
    async (id: string, status: string, extra: Record<string, unknown>) => ({
      id,
      status,
      ...extra,
    }),
  );
  vi.mocked(makeRunsRepo).mockReturnValue({
    create,
    updateStatus,
  } as unknown as ReturnType<typeof makeRunsRepo>);
  return { create, updateStatus, service: createRunService({ db: fakeDb }) };
}

function setupWithTrigger() {
  const trigger = { trigger: vi.fn().mockResolvedValue({ triggerRunId: "trig-1" }) };
  const base = setup();
  return { ...base, trigger, service: createRunService({ db: fakeDb, trigger }) };
}

const validInput = {
  triggerSource: "api" as const,
  city: "Houston",
  country: "USA",
  niche: "family law attorney",
  maxResults: 120,
};

const validPreset = {
  id: "preset-1",
  neighborhood: null,
  city: "Houston",
  country: "USA",
  niche: "family law attorney",
  maxResults: 120,
};

describe("createRunService.createFromPreset", () => {
  it("creates a run with triggerSource schedule and the preset id", async () => {
    const { create, service } = setup();

    await service.createFromPreset(validPreset);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      triggerSource: "schedule",
      presetId: "preset-1",
      status: "queued",
    });
  });

  it("snapshots niche, location, and maxResults from the preset", async () => {
    const { create, service } = setup();

    await service.createFromPreset({
      id: "p-2",
      neighborhood: "Midtown",
      city: "NYC",
      country: "USA",
      niche: "dentists",
      maxResults: 50,
    });

    expect(create.mock.calls[0][0]).toMatchObject({
      neighborhood: "Midtown",
      city: "NYC",
      country: "USA",
      niche: "dentists",
      maxResults: 50,
    });
  });

  it("generates a non-empty approval token", async () => {
    const { create, service } = setup();

    await service.createFromPreset(validPreset);

    expect(create.mock.calls[0][0].approvalToken).toEqual(expect.any(String));
    expect((create.mock.calls[0][0].approvalToken as string).length).toBeGreaterThan(0);
  });

  it("returns the created run", async () => {
    const { service } = setup();

    const run = await service.createFromPreset(validPreset);

    expect(run).toMatchObject({ id: "run-1" });
  });
});

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

describe("createRunService launch methods", () => {
  it("persists the Trigger.dev run id after createAndTrigger enqueues orchestration", async () => {
    const { service, trigger, updateStatus } = setupWithTrigger();

    const run = await service.createAndTrigger(validInput);

    expect(trigger.trigger).toHaveBeenCalledWith("run-1");
    expect(updateStatus).toHaveBeenCalledWith("run-1", "queued", { triggerRunId: "trig-1" });
    expect(run).toMatchObject({ triggerRunId: "trig-1" });
  });

  it("marks the run failed when createAndTrigger cannot enqueue orchestration", async () => {
    const trigger = { trigger: vi.fn().mockRejectedValue(new Error("Trigger down")) };
    const { updateStatus } = setup();
    const service = createRunService({ db: fakeDb, trigger });

    await expect(service.createAndTrigger(validInput)).rejects.toThrow("Trigger down");

    expect(updateStatus).toHaveBeenCalledWith(
      "run-1",
      "failed",
      expect.objectContaining({
        error: "Trigger down",
        finishedAt: expect.any(Date),
      }),
    );
  });

  it("launches preset-backed runs through the same trigger path", async () => {
    const { service, trigger, updateStatus } = setupWithTrigger();

    await service.createFromPresetAndTrigger(validPreset);

    expect(trigger.trigger).toHaveBeenCalledWith("run-1");
    expect(updateStatus).toHaveBeenCalledWith("run-1", "queued", { triggerRunId: "trig-1" });
  });
});
