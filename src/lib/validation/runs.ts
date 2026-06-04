import { z } from "zod";

// Boundary validation for starting a run (dashboard form + POST /api/runs share this).
export const createRunSchema = z.object({
  neighborhood: z.string().min(1).optional(),
  city: z.string().min(1),
  country: z.string().min(1),
  niche: z.string().min(1),
  maxResults: z.number().int().positive().default(120),
});

export type CreateRunRequest = z.infer<typeof createRunSchema>;
