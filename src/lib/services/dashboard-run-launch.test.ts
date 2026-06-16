import { describe, expect, it, vi } from "vitest";

import { createDashboardRunLaunchService } from "./dashboard-run-launch";
import type { RunService } from "./run";

function setup() {
  const presetsRepo = {
    upsertByName: vi.fn().mockResolvedValue({ id: "preset-1" }),
  };
  const runService = {
    createAndTrigger: vi.fn().mockResolvedValue({ id: "run-1" }),
  } as unknown as RunService;
  const service = createDashboardRunLaunchService({ presetsRepo, runService });
  return { presetsRepo, runService, service };
}

const input = {
  city: "Houston",
  country: "USA",
  niche: "family law",
  maxResults: 50,
};

describe("createDashboardRunLaunchService", () => {
  it("launches a dashboard run without saving a preset", async () => {
    const { presetsRepo, runService, service } = setup();

    await service.launch(input);

    expect(presetsRepo.upsertByName).not.toHaveBeenCalled();
    expect(runService.createAndTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ triggerSource: "dashboard", presetId: null }),
    );
  });

  it("saves a preset and launches with the preset id", async () => {
    const { presetsRepo, runService, service } = setup();

    await service.launch({ ...input, presetName: "My Preset" });

    expect(presetsRepo.upsertByName).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My Preset", city: "Houston" }),
    );
    expect(runService.createAndTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ presetId: "preset-1" }),
    );
  });
});
