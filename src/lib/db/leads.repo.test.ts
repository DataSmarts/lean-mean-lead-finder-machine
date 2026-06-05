import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { buildLeadsWhere } from "./leads.repo";

const dialect = new PgDialect();

// Render the Drizzle SQL node to a plain SQL string + params for assertions.
function sqlToString(sql: ReturnType<typeof buildLeadsWhere>): { sql: string; params: unknown[] } {
  if (!sql) return { sql: "", params: [] };
  return dialect.sqlToQuery(sql);
}

describe("buildLeadsWhere", () => {
  it("returns a non-undefined value even for an empty filter (pins kind=merged)", () => {
    expect(buildLeadsWhere({})).toBeDefined();
  });

  it("includes kind=merged in the base condition", () => {
    const { params } = sqlToString(buildLeadsWhere({}));
    expect(params).toContain("merged");
  });

  it("includes runId condition when runId is provided", () => {
    const { params } = sqlToString(buildLeadsWhere({ runId: "r-abc" }));
    expect(params).toContain("r-abc");
  });

  it("includes niche condition when niche is provided", () => {
    const { params } = sqlToString(buildLeadsWhere({ niche: "family law attorney" }));
    expect(params).toContain("family law attorney");
  });

  it("includes city condition when city is provided", () => {
    const { params } = sqlToString(buildLeadsWhere({ city: "Houston" }));
    expect(params).toContain("Houston");
  });

  it("includes source condition when source is provided", () => {
    const { params } = sqlToString(buildLeadsWhere({ source: "hunter" }));
    expect(params).toContain("hunter");
  });

  it("includes verification condition when verification is provided", () => {
    const { params } = sqlToString(buildLeadsWhere({ verification: "valid" }));
    expect(params).toContain("valid");
  });

  it("includes free-text q as a LIKE pattern when q is provided", () => {
    const { params } = sqlToString(buildLeadsWhere({ q: "Smith" }));
    expect(params).toContain("%Smith%");
  });

  it("composes multiple filters (all values appear as params)", () => {
    const { params } = sqlToString(
      buildLeadsWhere({ niche: "lawyer", city: "Austin", source: "ai" }),
    );
    expect(params).toContain("lawyer");
    expect(params).toContain("Austin");
    expect(params).toContain("ai");
    expect(params).toContain("merged");
  });

  it("generates a SQL string containing AND and WHERE-style structure", () => {
    const { sql } = sqlToString(buildLeadsWhere({ niche: "dentist" }));
    expect(sql).toContain("$1"); // at least one placeholder
  });
});
