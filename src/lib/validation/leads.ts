import { z } from "zod";

import { CONTACT_SOURCE_VALUES, EMAIL_VERIFICATION_VALUES } from "@/lib/domain/enums";

// Query params for the consolidated leads list page.
// All optional fields use .catch() so invalid values silently fall back to undefined / the default.
export const leadsListQuerySchema = z.object({
  runId: z.string().optional(),
  niche: z.string().optional(),
  city: z.string().optional(),
  source: z.enum(CONTACT_SOURCE_VALUES).optional().catch(undefined),
  verification: z.enum(EMAIL_VERIFICATION_VALUES).optional().catch(undefined),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});

export type LeadsListQuery = z.infer<typeof leadsListQuerySchema>;

// Query params for the per-run CSV export route (/api/runs/:id/export?raw=1).
// Accepts string "1" / "true" (browser QueryString form) as well as booleans.
export const runExportQuerySchema = z.object({
  raw: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === "1" || v === "true" || v === true)
    .catch(false)
    .default(false),
});

export type RunExportQuery = z.infer<typeof runExportQuerySchema>;
