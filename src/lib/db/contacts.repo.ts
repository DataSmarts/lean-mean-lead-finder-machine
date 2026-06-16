import { and, count, eq, isNull, sql } from "drizzle-orm";

import { wrapDbError } from "@/lib/errors/db-error";

import type { AppDatabase } from "./client";
import { contacts } from "./schema";

export type Contact = typeof contacts.$inferSelect;

export type NewContact = Omit<typeof contacts.$inferInsert, "id" | "createdAt">;

export function makeContactsRepo(db: AppDatabase) {
  return {
    // Idempotent upsert by (run_id, business_id, source, email).
    // contacts has no updated_at — the unique target is the 4-col index (§6.4).
    // Note: null email rows are always distinct (PostgreSQL NULLS DISTINCT behaviour).
    async upsertRaw(data: NewContact): Promise<Contact> {
      try {
        const [row] = await db
          .insert(contacts)
          .values(data)
          .onConflictDoUpdate({
            target: [contacts.runId, contacts.businessId, contacts.source, contacts.email],
            // Partial index predicate — must match the WHERE clause on contacts_run_business_source_email_uidx.
            targetWhere: sql`${contacts.kind} = 'person'`,
            set: {
              fullName: data.fullName,
              firstName: data.firstName,
              lastName: data.lastName,
              title: data.title,
              emailConfidence: data.emailConfidence,
              emailVerification: data.emailVerification,
              seniority: data.seniority,
              department: data.department,
              phone: data.phone,
              linkedinUrl: data.linkedinUrl,
              instagramUrl: data.instagramUrl,
              twitterUrl: data.twitterUrl,
              facebookUrl: data.facebookUrl,
              mergedIntoId: data.mergedIntoId,
              fieldSources: data.fieldSources,
              raw: data.raw,
            },
          })
          .returning();
        if (!row) throw new Error("Upsert returned no row");
        return row;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to upsert contact", {
          runId: data.runId,
          businessId: data.businessId,
        });
      }
    },

    async deleteRawNullEmailBySource(params: {
      runId: string;
      businessId: string;
      source: NewContact["source"];
    }): Promise<void> {
      try {
        await db
          .delete(contacts)
          .where(
            and(
              eq(contacts.runId, params.runId),
              eq(contacts.businessId, params.businessId),
              eq(contacts.source, params.source),
              eq(contacts.kind, "person"),
              isNull(contacts.email),
            ),
          );
      } catch (cause) {
        throw wrapDbError(cause, "Failed to delete null-email raw contacts", params);
      }
    },

    async findByRunAndBusiness(runId: string, businessId: string): Promise<Contact[]> {
      try {
        return await db
          .select()
          .from(contacts)
          .where(and(eq(contacts.runId, runId), eq(contacts.businessId, businessId)));
      } catch (cause) {
        throw wrapDbError(cause, "Failed to find contacts", { runId, businessId });
      }
    },

    // Returns merged contacts for a run — the canonical view for the leads dashboard.
    async findMerged(runId: string): Promise<Contact[]> {
      try {
        return await db
          .select()
          .from(contacts)
          .where(and(eq(contacts.runId, runId), eq(contacts.kind, "merged")));
      } catch (cause) {
        throw wrapDbError(cause, "Failed to find merged contacts", { runId });
      }
    },

    // Case-insensitive email lookup using the §6.4 functional index on lower(email).
    async findByEmail(runId: string, email: string): Promise<Contact[]> {
      try {
        return await db
          .select()
          .from(contacts)
          .where(and(eq(contacts.runId, runId), sql`lower(${contacts.email}) = lower(${email})`));
      } catch (cause) {
        throw wrapDbError(cause, "Failed to find contacts by email", { runId });
      }
    },

    // Insert a kind='merged' row directly (no conflict target — merged rows are managed by
    // delete-then-insert in the enrich transaction, so there is never an existing row to update).
    async insertMerged(data: NewContact): Promise<Contact> {
      try {
        const [row] = await db.insert(contacts).values(data).returning();
        if (!row) throw new Error("Insert returned no row");
        return row;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to insert merged contact", {
          runId: data.runId,
          businessId: data.businessId,
        });
      }
    },

    // Count of kind='merged' contacts for a run — used by finalize to set contactsFound.
    async countMerged(runId: string): Promise<number> {
      try {
        const [row] = await db
          .select({ count: count() })
          .from(contacts)
          .where(and(eq(contacts.runId, runId), eq(contacts.kind, "merged")));
        return row?.count ?? 0;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to count merged contacts", { runId });
      }
    },
  };
}
