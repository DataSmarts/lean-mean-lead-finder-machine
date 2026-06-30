import { describe, expect, it, vi } from "vitest";

import type { Run } from "@/lib/db/runs.repo";

import type { RunExportLeadsRepo } from "./run-export";
import { createRunExportService } from "./run-export";

function makeRun(): Run {
  return { id: "run-1" } as Run;
}

function setup(run?: Run) {
  const resolvedRun = arguments.length === 0 ? makeRun() : run;
  const runsRepo = {
    findById: vi.fn().mockResolvedValue(resolvedRun),
  };
  const leadsRepo = {
    exportMerged: vi.fn().mockResolvedValue([]),
    exportRaw: vi.fn().mockResolvedValue([]),
  } satisfies RunExportLeadsRepo;
  const service = createRunExportService({ runsRepo, leadsRepo });
  return { leadsRepo, runsRepo, service };
}

describe("createRunExportService", () => {
  it("returns not_found when the run does not exist", async () => {
    const { leadsRepo, service } = setup(undefined);

    const result = await service.exportRun({ runId: "missing", raw: false });

    expect(result.status).toBe("not_found");
    expect(leadsRepo.exportMerged).not.toHaveBeenCalled();
    expect(leadsRepo.exportRaw).not.toHaveBeenCalled();
  });

  it("exports merged contacts by default", async () => {
    const { leadsRepo, service } = setup();

    const result = await service.exportRun({ runId: "run-1", raw: false });

    expect(result).toMatchObject({
      status: "ok",
      filename: "run-run-1-merged.csv",
    });
    expect(result.status === "ok" ? result.csv : "").toContain("Field Sources");
    expect(leadsRepo.exportMerged).toHaveBeenCalledWith({ runId: "run-1" });
    expect(leadsRepo.exportRaw).not.toHaveBeenCalled();
  });

  it("exports raw contacts when requested", async () => {
    const { leadsRepo, service } = setup();

    const result = await service.exportRun({ runId: "run-1", raw: true });

    expect(result).toMatchObject({
      status: "ok",
      filename: "run-run-1-raw.csv",
    });
    expect(result.status === "ok" ? result.csv : "").toContain("Source");
    expect(result.status === "ok" ? result.csv : "").not.toContain("Field Sources");
    expect(leadsRepo.exportRaw).toHaveBeenCalledWith("run-1");
    expect(leadsRepo.exportMerged).not.toHaveBeenCalled();
  });
});
