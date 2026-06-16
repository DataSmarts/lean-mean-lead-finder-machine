import { describe, expect, it, vi } from "vitest";

import type { Run } from "@/lib/db/runs.repo";

import type { LeadsExportService } from "./leads-export";
import { createRunExportService } from "./run-export";

function makeRun(): Run {
  return { id: "run-1" } as Run;
}

function setup(run?: Run) {
  const resolvedRun = arguments.length === 0 ? makeRun() : run;
  const runsRepo = {
    findById: vi.fn().mockResolvedValue(resolvedRun),
  };
  const leadsExportService = {
    exportMerged: vi.fn().mockResolvedValue([]),
    exportRaw: vi.fn().mockResolvedValue([]),
  } satisfies LeadsExportService;
  const service = createRunExportService({ runsRepo, leadsExportService });
  return { leadsExportService, runsRepo, service };
}

describe("createRunExportService", () => {
  it("returns not_found when the run does not exist", async () => {
    const { leadsExportService, service } = setup(undefined);

    const result = await service.exportRun({ runId: "missing", raw: false });

    expect(result.status).toBe("not_found");
    expect(leadsExportService.exportMerged).not.toHaveBeenCalled();
    expect(leadsExportService.exportRaw).not.toHaveBeenCalled();
  });

  it("exports merged contacts by default", async () => {
    const { leadsExportService, service } = setup();

    const result = await service.exportRun({ runId: "run-1", raw: false });

    expect(result).toMatchObject({
      status: "ok",
      filename: "run-run-1-merged.csv",
    });
    expect(result.status === "ok" ? result.csv : "").toContain("Field Sources");
    expect(leadsExportService.exportMerged).toHaveBeenCalledWith({ runId: "run-1" });
    expect(leadsExportService.exportRaw).not.toHaveBeenCalled();
  });

  it("exports raw contacts when requested", async () => {
    const { leadsExportService, service } = setup();

    const result = await service.exportRun({ runId: "run-1", raw: true });

    expect(result).toMatchObject({
      status: "ok",
      filename: "run-run-1-raw.csv",
    });
    expect(result.status === "ok" ? result.csv : "").toContain("Source");
    expect(result.status === "ok" ? result.csv : "").not.toContain("Field Sources");
    expect(leadsExportService.exportRaw).toHaveBeenCalledWith("run-1");
    expect(leadsExportService.exportMerged).not.toHaveBeenCalled();
  });
});
