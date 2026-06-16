import { describe, expect, it, vi } from "vitest";

import type { RunExportService } from "@/lib/services/run-export";

vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/services/run-export", () => ({ makeRunExportService: vi.fn() }));

import { makeRunExportService } from "@/lib/services/run-export";

import { GET } from "./route";

function makeParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

function makeRequest(search = ""): Request {
  return new Request(`http://localhost/api/runs/r-1/export${search}`);
}

describe("GET /api/runs/:id/export", () => {
  it("returns 404 when the run does not exist", async () => {
    vi.mocked(makeRunExportService).mockReturnValue({
      exportRun: vi.fn().mockResolvedValue({ status: "not_found" }),
    } as RunExportService);

    const res = await GET(makeRequest(), { params: makeParams("no-such-run") });
    expect(res.status).toBe(404);
  });

  it("returns 200 text/csv for merged export (default)", async () => {
    const exportRun = vi.fn().mockResolvedValue({
      status: "ok",
      csv: "merged csv",
      filename: "run-r-1-merged.csv",
    });
    vi.mocked(makeRunExportService).mockReturnValue({ exportRun } as RunExportService);

    const res = await GET(makeRequest(), { params: makeParams("r-1") });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(exportRun).toHaveBeenCalledWith({ runId: "r-1", raw: false });
  });

  it("calls exportRaw and uses raw columns when ?raw=1", async () => {
    const exportRun = vi.fn().mockResolvedValue({
      status: "ok",
      csv: "raw csv",
      filename: "run-r-1-raw.csv",
    });
    vi.mocked(makeRunExportService).mockReturnValue({ exportRun } as RunExportService);

    const res = await GET(makeRequest("?raw=1"), { params: makeParams("r-1") });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("raw csv");
    expect(exportRun).toHaveBeenCalledWith({ runId: "r-1", raw: true });
  });

  it("sets Content-Disposition as attachment", async () => {
    vi.mocked(makeRunExportService).mockReturnValue({
      exportRun: vi.fn().mockResolvedValue({
        status: "ok",
        csv: "merged csv",
        filename: "run-r-1-merged.csv",
      }),
    } as RunExportService);

    const res = await GET(makeRequest(), { params: makeParams("r-1") });
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment/);
  });
});
