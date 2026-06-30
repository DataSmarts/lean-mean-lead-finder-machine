import type { LeadsListQuery } from "@/lib/validation/leads";

function setOptionalParam(params: URLSearchParams, name: string, value: string | undefined): void {
  if (value !== undefined && value.length > 0) {
    params.set(name, value);
  }
}

function formatHref(path: string, params: URLSearchParams): string {
  const queryString = params.toString();
  return `${path}${queryString ? `?${queryString}` : ""}`;
}

function buildLeadsSearchParams(query: LeadsListQuery, page?: number): URLSearchParams {
  const params = new URLSearchParams();
  setOptionalParam(params, "runId", query.runId);
  setOptionalParam(params, "niche", query.niche);
  setOptionalParam(params, "city", query.city);
  setOptionalParam(params, "source", query.source);
  setOptionalParam(params, "verification", query.verification);
  setOptionalParam(params, "q", query.q);

  if (page !== undefined && page > 1) {
    params.set("page", String(page));
  }

  return params;
}

export function buildLeadsHref(query: LeadsListQuery, page: number): string {
  return formatHref("/leads", buildLeadsSearchParams(query, page));
}

export function buildLeadsExportHref(query: LeadsListQuery): string {
  return formatHref("/api/leads/export", buildLeadsSearchParams(query));
}

export function hasActiveLeadsFilter(query: LeadsListQuery): boolean {
  return Boolean(
    query.runId || query.niche || query.city || query.source || query.verification || query.q,
  );
}
