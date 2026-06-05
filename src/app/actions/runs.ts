"use server";

import { tasks } from "@trigger.dev/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { makePresetsRepo } from "@/lib/db/presets.repo";
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
    neighborhood: formData.get("neighborhood") ?? undefined,
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

  let presetId: string | null = null;
  if (presetParsed.data.saveAsPreset && presetParsed.data.presetName) {
    const presetsRepo = makePresetsRepo(db);
    const preset = await presetsRepo.upsertByName({
      name: presetParsed.data.presetName,
      city: parsed.data.city,
      country: parsed.data.country,
      niche: parsed.data.niche,
      neighborhood: parsed.data.neighborhood ?? null,
      maxResults: parsed.data.maxResults,
      isActive: true,
      cron: null,
    });
    presetId = preset.id;
  }

  const run = await createRunService({ db }).create({
    ...parsed.data,
    triggerSource: "dashboard",
    presetId,
  });

  await tasks.trigger("leadRun.orchestrate", { runId: run.id });
  revalidatePath("/runs");

  // redirect() throws a control-flow signal — must stay outside any try/catch.
  redirect(`/runs/${run.id}`);
}
