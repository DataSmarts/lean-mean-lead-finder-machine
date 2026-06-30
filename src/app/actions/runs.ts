"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createLeadRunTrigger } from "@/lib/clients/trigger";
import { getDb } from "@/lib/db/client";
import { makePresetsRepo } from "@/lib/db/presets.repo";
import { createDashboardRunLaunchService } from "@/lib/services/dashboard-run-launch";
import { createRunService } from "@/lib/services/run";
import { parseCreateRunFormData } from "@/lib/validation/runs";

export interface CreateRunState {
  readonly error?: string;
}

export async function createRun(
  _prevState: CreateRunState,
  formData: FormData,
): Promise<CreateRunState> {
  const parsed = parseCreateRunFormData(formData);
  if (!parsed.success) {
    if (parsed.error.flatten().fieldErrors.presetName) {
      return { error: "A preset name is required when saving as preset." };
    }
    return { error: "Invalid input. Please check all required fields." };
  }

  const db = getDb();
  const launchService = createDashboardRunLaunchService({
    presetsRepo: makePresetsRepo(db),
    runService: createRunService({ db, trigger: createLeadRunTrigger() }),
  });
  const { saveAsPreset, presetName, ...runInput } = parsed.data;
  const run = await launchService.launch({
    ...runInput,
    presetName: saveAsPreset ? presetName : undefined,
  });

  revalidatePath("/runs");

  // redirect() throws a control-flow signal — must stay outside any try/catch.
  redirect(`/runs/${run.id}`);
}
