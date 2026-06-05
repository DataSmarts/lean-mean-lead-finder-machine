import { z } from "zod";

export type CronFrequency = "hourly" | "daily" | "weekly" | "custom";

// Maps a friendly frequency name to a cron expression.
export function frequencyToCron(frequency: Exclude<CronFrequency, "custom">): string {
  switch (frequency) {
    case "hourly":
      return "0 * * * *";
    case "daily":
      return "0 9 * * *";
    case "weekly":
      return "0 9 * * 1";
  }
}

// Light structural check: 5 whitespace-separated fields.
const CRON_FIELD_PATTERN = /^(\S+\s+){4}\S+$/;

export const presetFormSchema = z
  .object({
    // Present when editing an existing preset.
    id: z.string().uuid().optional(),
    name: z.string().min(1, "Name is required"),
    neighborhood: z.string().min(1).optional(),
    city: z.string().min(1, "City is required"),
    country: z.string().min(1, "Country is required"),
    niche: z.string().min(1, "Niche is required"),
    maxResults: z.coerce.number().int().positive().default(120),
    isActive: z.boolean().default(false),
    frequency: z.enum(["hourly", "daily", "weekly", "custom"]).optional(),
    customCron: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.frequency !== "custom") return;
    if (!data.customCron) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom cron expression is required",
        path: ["customCron"],
      });
      return;
    }
    if (!CRON_FIELD_PATTERN.test(data.customCron.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a valid 5-field cron expression (e.g. 0 9 * * 1)",
        path: ["customCron"],
      });
    }
  })
  .transform(({ frequency, customCron, ...rest }) => {
    let cron: string | null = null;
    if (frequency && frequency !== "custom") {
      cron = frequencyToCron(frequency);
    } else if (frequency === "custom" && customCron) {
      cron = customCron.trim();
    }
    return { ...rest, cron };
  });

export type PresetFormData = z.infer<typeof presetFormSchema>;
