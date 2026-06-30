import { z } from "zod";

import { DEFAULT_MAX_RESULTS } from "@/lib/config/defaults";
import { RUN_STATUS_VALUES } from "@/lib/domain/enums";

// Boundary validation for starting a run from JSON payloads.
export const createRunSchema = z.object({
  neighborhood: z.string().min(1).optional(),
  city: z.string().min(1),
  country: z.string().min(1),
  niche: z.string().min(1),
  maxResults: z.number().int().positive().default(DEFAULT_MAX_RESULTS),
});

export type CreateRunRequest = z.infer<typeof createRunSchema>;

const optionalFormStringSchema = z.preprocess(
  (value: unknown) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const formMaxResultsSchema = z.preprocess(
  (value: unknown) => (value === "" ? undefined : value),
  z.coerce.number().int().positive().default(DEFAULT_MAX_RESULTS),
);

export const createRunFormSchema = z
  .object({
    neighborhood: optionalFormStringSchema,
    city: z.string().min(1),
    country: z.string().min(1),
    niche: z.string().min(1),
    maxResults: formMaxResultsSchema,
    saveAsPreset: z.boolean().default(false),
    presetName: optionalFormStringSchema,
  })
  .refine(
    (data) => !data.saveAsPreset || (data.presetName !== undefined && data.presetName.length > 0),
    { message: "presetName is required when saveAsPreset is true", path: ["presetName"] },
  );

export type CreateRunFormInput = z.infer<typeof createRunFormSchema>;

function formString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.length > 0 ? value : undefined;
}

export function parseCreateRunFormData(
  formData: FormData,
): ReturnType<typeof createRunFormSchema.safeParse> {
  return createRunFormSchema.safeParse({
    neighborhood: formString(formData.get("neighborhood")),
    city: formString(formData.get("city")),
    country: formString(formData.get("country")),
    niche: formString(formData.get("niche")),
    maxResults: formString(formData.get("maxResults")),
    saveAsPreset: formData.get("saveAsPreset") === "true",
    presetName: formString(formData.get("presetName")),
  });
}

// Query params for the runs list page. Unknown status values fall back to undefined
// (no filter) so a hand-typed ?status=bogus never causes a 500.
export const runsListQuerySchema = z.object({
  status: z.enum(RUN_STATUS_VALUES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});

export type RunsListQuery = z.infer<typeof runsListQuerySchema>;
