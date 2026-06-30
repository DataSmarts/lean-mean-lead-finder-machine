import type { RunStatusValue } from "@/lib/domain/enums";

interface BuildRunsHrefParams {
  readonly page: number;
  readonly status?: RunStatusValue;
}

export function buildRunsHref({ page, status }: BuildRunsHrefParams): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));

  const queryString = params.toString();
  return `/runs${queryString ? `?${queryString}` : ""}`;
}
