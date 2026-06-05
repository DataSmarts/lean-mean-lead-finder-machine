import { describe, expect, it, vi } from "vitest";

import type { ScheduleOps } from "./preset-schedule";
import { createPresetScheduleService } from "./preset-schedule";

function makeOps(): ScheduleOps {
  return {
    create: vi.fn(async () => ({ id: "sched-new" })),
    update: vi.fn(async () => ({ id: "sched-existing" })),
    activate: vi.fn(async () => ({ id: "sched-existing" })),
    deactivate: vi.fn(async () => ({ id: "sched-existing" })),
    del: vi.fn(async () => {}),
  };
}

describe("createPresetScheduleService.sync", () => {
  it("creates a new schedule when active with cron and no existing scheduleId", async () => {
    const ops = makeOps();
    const service = createPresetScheduleService({ scheduleOps: ops });

    const id = await service.sync({
      id: "p-1",
      scheduleId: null,
      isActive: true,
      cron: "0 9 * * *",
    });

    expect(ops.create).toHaveBeenCalledWith({
      task: "presets.schedule",
      cron: "0 9 * * *",
      externalId: "p-1",
      deduplicationKey: "p-1",
    });
    expect(id).toBe("sched-new");
  });

  it("updates and activates when active with cron and existing scheduleId", async () => {
    const ops = makeOps();
    const service = createPresetScheduleService({ scheduleOps: ops });

    const id = await service.sync({
      id: "p-1",
      scheduleId: "sched-existing",
      isActive: true,
      cron: "0 12 * * *",
    });

    expect(ops.update).toHaveBeenCalledWith("sched-existing", {
      task: "presets.schedule",
      cron: "0 12 * * *",
      externalId: "p-1",
    });
    expect(ops.activate).toHaveBeenCalledWith("sched-existing");
    expect(id).toBe("sched-existing");
  });

  it("deactivates when inactive but has an existing scheduleId", async () => {
    const ops = makeOps();
    const service = createPresetScheduleService({ scheduleOps: ops });

    const id = await service.sync({
      id: "p-1",
      scheduleId: "sched-existing",
      isActive: false,
      cron: "0 9 * * *",
    });

    expect(ops.deactivate).toHaveBeenCalledWith("sched-existing");
    expect(ops.create).not.toHaveBeenCalled();
    expect(id).toBe("sched-existing");
  });

  it("does nothing when inactive with no scheduleId", async () => {
    const ops = makeOps();
    const service = createPresetScheduleService({ scheduleOps: ops });

    const id = await service.sync({ id: "p-1", scheduleId: null, isActive: false, cron: null });

    expect(ops.create).not.toHaveBeenCalled();
    expect(ops.deactivate).not.toHaveBeenCalled();
    expect(id).toBeNull();
  });

  it("does not schedule when active but cron is null (AC #5)", async () => {
    const ops = makeOps();
    const service = createPresetScheduleService({ scheduleOps: ops });

    const id = await service.sync({ id: "p-1", scheduleId: null, isActive: true, cron: null });

    expect(ops.create).not.toHaveBeenCalled();
    expect(id).toBeNull();
  });

  it("deactivates when active but cron becomes null", async () => {
    const ops = makeOps();
    const service = createPresetScheduleService({ scheduleOps: ops });

    const id = await service.sync({
      id: "p-1",
      scheduleId: "sched-existing",
      isActive: true,
      cron: null,
    });

    expect(ops.deactivate).toHaveBeenCalledWith("sched-existing");
    expect(ops.create).not.toHaveBeenCalled();
    expect(id).toBe("sched-existing");
  });
});

describe("createPresetScheduleService.remove", () => {
  it("calls del with the scheduleId", async () => {
    const ops = makeOps();
    const service = createPresetScheduleService({ scheduleOps: ops });

    await service.remove("sched-1");

    expect(ops.del).toHaveBeenCalledWith("sched-1");
  });
});
