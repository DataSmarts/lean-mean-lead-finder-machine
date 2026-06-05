import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CreateRunInput } from "@/lib/services/run";
import { createRunService } from "@/lib/services/run";

const { redirectMock, revalidatePathMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("@/lib/services/run", () => ({ createRunService: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/db/presets.repo", () => ({ makePresetsRepo: vi.fn() }));

import { tasks } from "@trigger.dev/sdk";

import { makePresetsRepo } from "@/lib/db/presets.repo";

import { createRun } from "./runs";

function formWith(fields: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) fd.set(key, value);
  }
  return fd;
}

const validFields = {
  city: "Houston",
  country: "United States",
  niche: "family law attorney",
  maxResults: "50",
};

function setupService(runId = "run-1") {
  const create = vi.fn().mockResolvedValue({ id: runId, status: "queued" });
  vi.mocked(createRunService).mockReturnValue({ create } as unknown as ReturnType<
    typeof createRunService
  >);
  return { create };
}

function setupPresets(presetId = "preset-1") {
  const upsertByName = vi.fn().mockResolvedValue({ id: presetId });
  vi.mocked(makePresetsRepo).mockReturnValue({ upsertByName } as unknown as ReturnType<
    typeof makePresetsRepo
  >);
  return { upsertByName };
}

beforeEach(() => {
  redirectMock.mockClear();
  revalidatePathMock.mockClear();
  vi.mocked(tasks.trigger).mockClear();
});

describe("createRun action", () => {
  it("returns an error and does not create or trigger when city is missing", async () => {
    const { create } = setupService();
    const result = await createRun(
      {},
      formWith({ country: "United States", niche: "x", maxResults: "50" }),
    );

    expect(result.error).toBeDefined();
    expect(create).not.toHaveBeenCalled();
    expect(tasks.trigger).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns an error when niche is missing", async () => {
    const { create } = setupService();
    const result = await createRun(
      {},
      formWith({ city: "Houston", country: "US", maxResults: "50" }),
    );

    expect(result.error).toBeDefined();
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a run with triggerSource:'dashboard'", async () => {
    const { create } = setupService();
    setupPresets();

    await createRun({}, formWith(validFields));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining<Partial<CreateRunInput>>({ triggerSource: "dashboard" }),
    );
  });

  it("triggers leadRun.orchestrate with the new run id", async () => {
    setupService("run-xyz");
    setupPresets();

    await createRun({}, formWith(validFields));

    expect(tasks.trigger).toHaveBeenCalledWith("leadRun.orchestrate", { runId: "run-xyz" });
  });

  it("calls revalidatePath('/runs') after creating", async () => {
    setupService();
    setupPresets();

    await createRun({}, formWith(validFields));

    expect(revalidatePathMock).toHaveBeenCalledWith("/runs");
  });

  it("redirects to /runs/:id after creating", async () => {
    setupService("run-42");
    setupPresets();

    await createRun({}, formWith(validFields));

    expect(redirectMock).toHaveBeenCalledWith("/runs/run-42");
  });

  it("coerces maxResults from the FormData string to a number", async () => {
    const { create } = setupService();
    setupPresets();

    await createRun({}, formWith({ ...validFields, maxResults: "75" }));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining<Partial<CreateRunInput>>({ maxResults: 75 }),
    );
  });

  it("defaults maxResults to 120 when omitted", async () => {
    const { create } = setupService();
    setupPresets();
    const { maxResults: _omit, ...fieldsWithoutMax } = validFields;

    await createRun({}, formWith(fieldsWithoutMax));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining<Partial<CreateRunInput>>({ maxResults: 120 }),
    );
  });

  it("does not call upsertByName when saveAsPreset is not set", async () => {
    const { create } = setupService();
    const { upsertByName } = setupPresets();

    await createRun({}, formWith(validFields));

    expect(upsertByName).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining<Partial<CreateRunInput>>({ presetId: null }),
    );
  });

  it("upserts a preset and forwards presetId when saveAsPreset is true", async () => {
    const { create } = setupService();
    const { upsertByName } = setupPresets("preset-abc");

    await createRun(
      {},
      formWith({ ...validFields, saveAsPreset: "true", presetName: "My Preset" }),
    );

    expect(upsertByName).toHaveBeenCalledWith(expect.objectContaining({ name: "My Preset" }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining<Partial<CreateRunInput>>({ presetId: "preset-abc" }),
    );
  });

  it("returns an error when saveAsPreset is true but presetName is missing", async () => {
    const { create } = setupService();

    const result = await createRun({}, formWith({ ...validFields, saveAsPreset: "true" }));

    expect(result.error).toBeDefined();
    expect(create).not.toHaveBeenCalled();
  });
});
