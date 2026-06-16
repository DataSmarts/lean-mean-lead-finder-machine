import { describe, expect, it, vi } from "vitest";

import type { Preset } from "@/lib/db/presets.repo";

import { createPresetManagementService } from "./preset-management";
import type { PresetScheduleService } from "./preset-schedule";
import type { RunService } from "./run";

function preset(overrides: Partial<Preset> = {}): Preset {
  return {
    id: "preset-1",
    name: "Family Law Houston",
    neighborhood: null,
    city: "Houston",
    country: "USA",
    niche: "family law",
    maxResults: 120,
    isActive: true,
    cron: "0 9 * * *",
    scheduleId: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function setup() {
  const repo = {
    create: vi.fn().mockResolvedValue(preset()),
    delete: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(preset()),
    update: vi.fn().mockResolvedValue(preset({ scheduleId: "sched-1" })),
  };
  const scheduleService: PresetScheduleService = {
    remove: vi.fn().mockResolvedValue(undefined),
    sync: vi.fn().mockResolvedValue("sched-1"),
  };
  const runService = {
    createFromPresetAndTrigger: vi.fn().mockResolvedValue({ id: "run-1" }),
  } as unknown as RunService;
  const service = createPresetManagementService({
    presetsRepo: repo,
    scheduleService,
    runService,
  });
  return { repo, scheduleService, runService, service };
}

describe("createPresetManagementService", () => {
  it("creates a preset and persists a new schedule id", async () => {
    const { repo, scheduleService, service } = setup();

    await service.save({
      name: "Dentists",
      city: "Austin",
      country: "USA",
      niche: "dentist",
      maxResults: 50,
      isActive: true,
      cron: "0 9 * * *",
    });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Dentists" }));
    expect(scheduleService.sync).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith("preset-1", { scheduleId: "sched-1" });
  });

  it("returns not_found when saving an unknown existing preset", async () => {
    const { repo, service } = setup();
    repo.findById.mockResolvedValue(undefined);

    await expect(
      service.save({
        id: "00000000-0000-0000-0000-000000000000",
        name: "Missing",
        city: "Austin",
        country: "USA",
        niche: "dentist",
        maxResults: 50,
        isActive: true,
        cron: null,
      }),
    ).resolves.toEqual({ status: "not_found" });
  });

  it("launches a preset-backed run", async () => {
    const { runService, service } = setup();

    await expect(service.runNow("preset-1")).resolves.toEqual({ status: "ok", runId: "run-1" });
    expect(runService.createFromPresetAndTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ id: "preset-1" }),
    );
  });
});
