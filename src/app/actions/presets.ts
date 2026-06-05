"use server";

import { schedules, tasks } from "@trigger.dev/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { makePresetsRepo } from "@/lib/db/presets.repo";
import type { ScheduleOps } from "@/lib/services/preset-schedule";
import { createPresetScheduleService } from "@/lib/services/preset-schedule";
import { createRunService } from "@/lib/services/run";
import { presetFormSchema } from "@/lib/validation/presets";

export interface PresetActionState {
  readonly error?: string;
}

// Wire Trigger.dev SDK into the schedule ops abstraction.
const scheduleOps: ScheduleOps = {
  create: (params) => schedules.create(params),
  update: (id, params) => schedules.update(id, params),
  activate: (id) => schedules.activate(id),
  deactivate: (id) => schedules.deactivate(id),
  del: async (id) => {
    await schedules.del(id);
  },
};

const scheduleService = createPresetScheduleService({ scheduleOps });

export async function savePreset(
  _prevState: PresetActionState,
  formData: FormData,
): Promise<PresetActionState> {
  const rawId = formData.get("id");
  const input = {
    id: rawId ? String(rawId) : undefined,
    name: formData.get("name"),
    neighborhood: formData.get("neighborhood") || undefined,
    city: formData.get("city"),
    country: formData.get("country"),
    niche: formData.get("niche"),
    maxResults: formData.get("maxResults"),
    isActive: formData.get("isActive") === "true",
    frequency: formData.get("frequency") || undefined,
    customCron: formData.get("customCron") || undefined,
  };

  const parsed = presetFormSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "Invalid input. Please check all fields." };
  }

  const { id, ...presetData } = parsed.data;
  const presetsRepo = makePresetsRepo(db);

  let preset = id ? await presetsRepo.findById(id) : undefined;
  if (id && !preset) {
    return { error: "Preset not found." };
  }

  if (preset) {
    preset = (await presetsRepo.update(preset.id, presetData)) ?? preset;
  } else {
    preset = await presetsRepo.create(presetData);
  }

  const newScheduleId = await scheduleService.sync({
    id: preset.id,
    scheduleId: preset.scheduleId ?? null,
    isActive: preset.isActive,
    cron: preset.cron ?? null,
  });

  if (newScheduleId !== (preset.scheduleId ?? null)) {
    await presetsRepo.update(preset.id, { scheduleId: newScheduleId ?? undefined });
  }

  revalidatePath("/presets");
  return {};
}

export async function togglePresetActive(presetId: string): Promise<PresetActionState> {
  const presetsRepo = makePresetsRepo(db);
  const preset = await presetsRepo.findById(presetId);
  if (!preset) return { error: "Preset not found." };

  const updated = await presetsRepo.update(presetId, { isActive: !preset.isActive });
  if (!updated) return { error: "Failed to update preset." };

  const newScheduleId = await scheduleService.sync({
    id: updated.id,
    scheduleId: updated.scheduleId ?? null,
    isActive: updated.isActive,
    cron: updated.cron ?? null,
  });

  if (newScheduleId !== (updated.scheduleId ?? null)) {
    await presetsRepo.update(updated.id, { scheduleId: newScheduleId ?? undefined });
  }

  revalidatePath("/presets");
  return {};
}

export async function deletePreset(presetId: string): Promise<PresetActionState> {
  const presetsRepo = makePresetsRepo(db);
  const preset = await presetsRepo.findById(presetId);
  if (!preset) return { error: "Preset not found." };

  if (preset.scheduleId) {
    await scheduleService.remove(preset.scheduleId);
  }

  await presetsRepo.delete(presetId);
  revalidatePath("/presets");
  return {};
}

export async function runPresetNow(presetId: string): Promise<PresetActionState> {
  const presetsRepo = makePresetsRepo(db);
  const preset = await presetsRepo.findById(presetId);
  if (!preset) return { error: "Preset not found." };

  const run = await createRunService({ db }).createFromPreset(preset);
  await tasks.trigger("leadRun.orchestrate", { runId: run.id });

  // redirect() throws a control-flow signal — must stay outside any try/catch.
  redirect(`/runs/${run.id}`);
}
