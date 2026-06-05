// RFC-4180 CSV serializer with formula-injection guard.
// No imports — this module is intentionally dependency-free.

// Leading characters that spreadsheets (Excel, Sheets) interpret as formula syntax.
const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

// Prefix risky leading characters with a single-quote so spreadsheets treat the cell as text.
export function guardFormula(value: string): string {
  return FORMULA_PREFIX_RE.test(value) ? `'${value}` : value;
}

// RFC-4180: a field must be enclosed in double-quotes if it contains a comma, double-quote,
// CR, or LF. Embedded double-quotes are escaped by doubling them.
const NEEDS_QUOTING_RE = /[,"\r\n]/;

export function escapeField(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const guarded = guardFormula(value);
  if (!NEEDS_QUOTING_RE.test(guarded)) return guarded;
  return `"${guarded.replace(/"/g, '""')}"`;
}

// Joins escaped fields with commas.
export function toCsvRow(fields: ReadonlyArray<string | null | undefined>): string {
  return fields.map(escapeField).join(",");
}

// Produces a complete RFC-4180 CSV string: header row + data rows, each terminated with CRLF.
export function toCsv(
  header: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string | null | undefined>>,
): string {
  const lines: string[] = [toCsvRow(header)];
  for (const row of rows) {
    lines.push(toCsvRow(row));
  }
  return lines.map((l) => `${l}\r\n`).join("");
}
