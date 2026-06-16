"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createLeadRunTrigger } from "@/lib/clients/trigger";
import { db } from "@/lib/db/client";
import { makePresetsRepo } from "@/lib/db/presets.repo";
import { createDashboardRunLaunchService } from "@/lib/services/dashboard-run-launch";
import { createRunService } from "@/lib/services/run";
import { createRunSchema, saveAsPresetSchema } from "@/lib/validation/runs";

export interface CreateRunState {
  readonly error?: string;
}

export async function createRun(
  _prevState: CreateRunState,
  formData: FormData,
): Promise<CreateRunState> {
  // Build the input object — maxResults comes from FormData as a string, so coerce it.
  const rawMaxResults = formData.get("maxResults");
  const input = {
    neighborhood: (formData.get("neighborhood") as string) || undefined,
    city: formData.get("city"),
    country: formData.get("country"),
    niche: formData.get("niche"),
    maxResults: rawMaxResults ? Number(rawMaxResults) : undefined,
  };

  const parsed = createRunSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input. Please check all required fields." };
  }

  // Optional "save as preset" — validated separately so the error message is targeted.
  const presetRaw = {
    saveAsPreset: formData.get("saveAsPreset") === "true",
    presetName: formData.get("presetName") ?? undefined,
  };
  const presetParsed = saveAsPresetSchema.safeParse(presetRaw);
  if (!presetParsed.success) {
    return { error: "A preset name is required when saving as preset." };
  }

  const launchService = createDashboardRunLaunchService({
    presetsRepo: makePresetsRepo(db),
    runService: createRunService({ db, trigger: createLeadRunTrigger() }),
  });
  const run = await launchService.launch({
    ...parsed.data,
    presetName: presetParsed.data.saveAsPreset ? presetParsed.data.presetName : undefined,
  });

  revalidatePath("/runs");

  // redirect() throws a control-flow signal — must stay outside any try/catch.
  redirect(`/runs/${run.id}`);
}
