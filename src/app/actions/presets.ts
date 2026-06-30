"use server";

import { schedules } from "@trigger.dev/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createLeadRunTrigger } from "@/lib/clients/trigger";
import { getDb } from "@/lib/db/client";
import { makePresetsRepo } from "@/lib/db/presets.repo";
import { createPresetManagementService } from "@/lib/services/preset-management";
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

function makePresetManagementService() {
  const db = getDb();
  return createPresetManagementService({
    presetsRepo: makePresetsRepo(db),
    scheduleService,
    runService: createRunService({ db, trigger: createLeadRunTrigger() }),
  });
}

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

  const result = await makePresetManagementService().save(parsed.data);
  if (result.status === "not_found") {
    return { error: "Preset not found." };
  }

  revalidatePath("/presets");
  return {};
}

export async function togglePresetActive(presetId: string): Promise<PresetActionState> {
  const result = await makePresetManagementService().toggleActive(presetId);
  if (result.status === "not_found") return { error: "Preset not found." };
  if (result.status === "failed") return { error: "Failed to update preset." };

  revalidatePath("/presets");
  return {};
}

export async function deletePreset(presetId: string): Promise<PresetActionState> {
  const result = await makePresetManagementService().delete(presetId);
  if (result.status === "not_found") return { error: "Preset not found." };

  revalidatePath("/presets");
  return {};
}

export async function runPresetNow(presetId: string): Promise<PresetActionState> {
  const result = await makePresetManagementService().runNow(presetId);
  if (result.status === "not_found") return { error: "Preset not found." };

  // redirect() throws a control-flow signal — must stay outside any try/catch.
  redirect(`/runs/${result.runId}`);
}
