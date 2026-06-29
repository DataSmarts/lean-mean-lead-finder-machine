import { and, count, desc, eq, getTableColumns, ilike, or, type SQL } from "drizzle-orm";

import type { ContactSourceValue, EmailVerificationValue } from "@/lib/domain/enums";
import { wrapDbError } from "@/lib/errors/db-error";

import type { Business } from "./businesses.repo";
import type { AppDatabase } from "./client";
import type { Contact } from "./contacts.repo";
import type { Run } from "./runs.repo";
import { businesses, contacts, runs } from "./schema";

// --- Types --------------------------------------------------------------------

export interface LeadsFilter {
  runId?: string;
  niche?: string;
  city?: string;
  // Filters on the merged row's winning `source` column (not any-contributing-source).
  source?: ContactSourceValue;
  verification?: EmailVerificationValue;
  // Free-text match across contact.fullName, contact.email, business.name.
  q?: string;
}

export interface LeadsListParams extends LeadsFilter {
  page: number;
  pageSize?: number;
}

// Flat joined shape returned from every leads query: one row = one merged contact.
export interface LeadRow {
  contact: Contact;
  business: Business;
  run: Run;
}

export interface LeadsListResult {
  rows: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
}

// --- WHERE builder (exported for unit testing) --------------------------------

// Builds the shared WHERE condition for leads queries.
// Always pins kind='merged'; conditionally adds each filter.
// Returned value may be passed directly to .where() — Drizzle ignores undefined.
export function buildLeadsWhere(f: LeadsFilter): SQL | undefined {
  const parts: SQL[] = [eq(contacts.kind, "merged")];

  if (f.runId) parts.push(eq(contacts.runId, f.runId));
  if (f.niche) parts.push(eq(runs.niche, f.niche));
  if (f.city) parts.push(eq(runs.city, f.city));
  if (f.source) parts.push(eq(contacts.source, f.source));
  if (f.verification) parts.push(eq(contacts.emailVerification, f.verification));
  if (f.q) {
    const pattern = `%${f.q}%`;
    parts.push(
      or(
        ilike(businesses.name, pattern),
        ilike(contacts.email, pattern),
        ilike(contacts.fullName, pattern),
      )!,
    );
  }

  return and(...parts);
}

// --- Query helpers ------------------------------------------------------------

function joinLeads(db: AppDatabase) {
  return db
    .select({
      contact: getTableColumns(contacts),
      business: getTableColumns(businesses),
      run: getTableColumns(runs),
    })
    .from(contacts)
    .innerJoin(businesses, eq(contacts.businessId, businesses.id))
    .innerJoin(runs, eq(contacts.runId, runs.id));
}

// --- Repo factory -------------------------------------------------------------

export function makeLeadsRepo(db: AppDatabase) {
  return {
    // Paginated list of merged contacts with composed filters.
    // Runs list + count in parallel; both use the same WHERE predicate.
    async list({ page, pageSize = 20, ...filter }: LeadsListParams): Promise<LeadsListResult> {
      const offset = (page - 1) * pageSize;
      const where = buildLeadsWhere(filter);
      try {
        const [rows, [countRow]] = await Promise.all([
          joinLeads(db)
            .where(where)
            .orderBy(desc(contacts.createdAt))
            .limit(pageSize)
            .offset(offset),
          db
            .select({ total: count() })
            .from(contacts)
            .innerJoin(businesses, eq(contacts.businessId, businesses.id))
            .innerJoin(runs, eq(contacts.runId, runs.id))
            .where(where),
        ]);
        return {
          rows: rows as LeadRow[],
          total: countRow?.total ?? 0,
          page,
          pageSize,
        };
      } catch (cause) {
        throw wrapDbError(cause, "Failed to list leads", { page, pageSize, ...filter });
      }
    },

    // Unbounded export of merged contacts honoring the given filter.
    // Per-run export passes { runId } as the filter.
    async exportMerged(filter: LeadsFilter): Promise<LeadRow[]> {
      const where = buildLeadsWhere(filter);
      try {
        const rows = await joinLeads(db).where(where).orderBy(desc(contacts.createdAt));
        return rows as LeadRow[];
      } catch (cause) {
        throw wrapDbError(cause, "Failed to export merged leads", { ...filter });
      }
    },

    // Unbounded export of raw (kind='person') contacts for a single run.
    // Used by /api/runs/:id/export?raw=1.
    async exportRaw(runId: string): Promise<LeadRow[]> {
      try {
        const rows = await db
          .select({
            contact: getTableColumns(contacts),
            business: getTableColumns(businesses),
            run: getTableColumns(runs),
          })
          .from(contacts)
          .innerJoin(businesses, eq(contacts.businessId, businesses.id))
          .innerJoin(runs, eq(contacts.runId, runs.id))
          .where(and(eq(contacts.kind, "person"), eq(contacts.runId, runId)))
          .orderBy(desc(contacts.createdAt));
        return rows as LeadRow[];
      } catch (cause) {
        throw wrapDbError(cause, "Failed to export raw contacts", { runId });
      }
    },

    // Lightweight run list for the leads filter dropdown.
    async runOptions(): Promise<{ id: string; niche: string; city: string }[]> {
      try {
        return await db
          .select({ id: runs.id, niche: runs.niche, city: runs.city })
          .from(runs)
          .orderBy(desc(runs.createdAt));
      } catch (cause) {
        throw wrapDbError(cause, "Failed to load run options");
      }
    },
  };
}
