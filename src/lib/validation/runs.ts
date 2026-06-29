import { z } from "zod";

import { RUN_STATUS_VALUES } from "@/lib/domain/enums";

// Boundary validation for starting a run (dashboard form + POST /api/runs share this).
export const createRunSchema = z.object({
  neighborhood: z.string().min(1).optional(),
  city: z.string().min(1),
  country: z.string().min(1),
  niche: z.string().min(1),
  maxResults: z.number().int().positive().default(120),
});

export type CreateRunRequest = z.infer<typeof createRunSchema>;

// Query params for the runs list page. Unknown status values fall back to undefined
// (no filter) so a hand-typed ?status=bogus never causes a 500.
export const runsListQuerySchema = z.object({
  status: z.enum(RUN_STATUS_VALUES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});

export type RunsListQuery = z.infer<typeof runsListQuerySchema>;

// Form-only: controls whether the new-run form saves a preset alongside the run.
// Kept separate from createRunSchema (which is the API-shared boundary validator).
export const saveAsPresetSchema = z
  .object({
    saveAsPreset: z.boolean().default(false),
    presetName: z.string().min(1).optional(),
  })
  .refine(
    (data) => !data.saveAsPreset || (data.presetName !== undefined && data.presetName.length > 0),
    { message: "presetName is required when saveAsPreset is true", path: ["presetName"] },
  );

export type SaveAsPresetData = z.infer<typeof saveAsPresetSchema>;
