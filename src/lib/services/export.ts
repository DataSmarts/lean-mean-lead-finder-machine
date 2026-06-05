import { toCsv } from "@/lib/csv/serialize";
import type { LeadRow } from "@/lib/db/leads.repo";

// --- Column definitions -------------------------------------------------------

interface Column {
  readonly header: string;
  readonly cell: (row: LeadRow) => string | null;
}

// Serializes fieldSources jsonb to a deterministic "key:source;…" string.
function serializeFieldSources(
  fieldSources: Record<string, "ai" | "hunter"> | null | undefined,
): string | null {
  if (!fieldSources) return null;
  const keys = Object.keys(fieldSources).sort();
  if (keys.length === 0) return null;
  return keys.map((k) => `${k}:${fieldSources[k]}`).join(";");
}

// One row per merged contact (kind='merged'). Column order is the product spec.
export const MERGED_COLUMNS: ReadonlyArray<Column> = [
  { header: "Business", cell: (r) => r.business.name },
  { header: "Website", cell: (r) => r.business.websiteUri },
  { header: "Address", cell: (r) => r.business.formattedAddress },
  { header: "Niche", cell: (r) => r.run.niche },
  { header: "City", cell: (r) => r.run.city },
  { header: "Person", cell: (r) => r.contact.fullName },
  { header: "Title", cell: (r) => r.contact.title },
  { header: "Email", cell: (r) => r.contact.email },
  {
    header: "Email Confidence",
    cell: (r) => (r.contact.emailConfidence !== null ? String(r.contact.emailConfidence) : null),
  },
  { header: "Email Verification", cell: (r) => r.contact.emailVerification },
  { header: "Source", cell: (r) => r.contact.source },
  {
    header: "Field Sources",
    cell: (r) =>
      serializeFieldSources(r.contact.fieldSources as Record<string, "ai" | "hunter"> | null),
  },
  { header: "Seniority", cell: (r) => r.contact.seniority },
  { header: "Department", cell: (r) => r.contact.department },
  { header: "Phone", cell: (r) => r.contact.phone },
  { header: "LinkedIn", cell: (r) => r.contact.linkedinUrl },
  { header: "Instagram", cell: (r) => r.contact.instagramUrl },
  { header: "Twitter", cell: (r) => r.contact.twitterUrl },
  { header: "Facebook", cell: (r) => r.contact.facebookUrl },
  { header: "Run ID", cell: (r) => r.run.id },
  { header: "Created At", cell: (r) => r.contact.createdAt.toISOString() },
];

// One row per raw (kind='person') source contact. Used for ?raw=1 exports.
export const RAW_COLUMNS: ReadonlyArray<Column> = [
  { header: "Business", cell: (r) => r.business.name },
  { header: "Source", cell: (r) => r.contact.source },
  { header: "Person", cell: (r) => r.contact.fullName },
  { header: "Title", cell: (r) => r.contact.title },
  { header: "Email", cell: (r) => r.contact.email },
  {
    header: "Email Confidence",
    cell: (r) => (r.contact.emailConfidence !== null ? String(r.contact.emailConfidence) : null),
  },
  { header: "Email Verification", cell: (r) => r.contact.emailVerification },
  { header: "Seniority", cell: (r) => r.contact.seniority },
  { header: "Department", cell: (r) => r.contact.department },
  { header: "Phone", cell: (r) => r.contact.phone },
  { header: "LinkedIn", cell: (r) => r.contact.linkedinUrl },
  { header: "Instagram", cell: (r) => r.contact.instagramUrl },
  { header: "Twitter", cell: (r) => r.contact.twitterUrl },
  { header: "Facebook", cell: (r) => r.contact.facebookUrl },
  { header: "Created At", cell: (r) => r.contact.createdAt.toISOString() },
];

// --- CSV builders -------------------------------------------------------------

function buildCsv(columns: ReadonlyArray<Column>, rows: LeadRow[]): string {
  const header = columns.map((c) => c.header);
  const dataRows = rows.map((r) => columns.map((c) => c.cell(r)));
  return toCsv(header, dataRows);
}

export function mergedToCsv(rows: LeadRow[]): string {
  return buildCsv(MERGED_COLUMNS, rows);
}

export function rawToCsv(rows: LeadRow[]): string {
  return buildCsv(RAW_COLUMNS, rows);
}
