import { eq } from "drizzle-orm";

import { wrapDbError } from "@/lib/errors/db-error";

import type { AppDatabase } from "./client";
import { businesses } from "./schema";
import { withUpdatedAt } from "./timestamp";

export type Business = typeof businesses.$inferSelect;

export type NewBusiness = Omit<typeof businesses.$inferInsert, "id" | "createdAt" | "updatedAt">;

export function makeBusinessesRepo(db: AppDatabase) {
  return {
    async findById(id: string): Promise<Business | undefined> {
      try {
        const rows = await db.select().from(businesses).where(eq(businesses.id, id));
        return rows[0];
      } catch (cause) {
        throw wrapDbError(cause, "Failed to find business", { id });
      }
    },

    async findByPlaceId(googlePlaceId: string): Promise<Business | undefined> {
      try {
        const rows = await db
          .select()
          .from(businesses)
          .where(eq(businesses.googlePlaceId, googlePlaceId));
        return rows[0];
      } catch (cause) {
        throw wrapDbError(cause, "Failed to find business by place ID");
      }
    },

    // Global-dedupe upsert (§6.1): one businesses row per real-world place across all runs.
    async upsertByPlaceId(data: NewBusiness): Promise<Business> {
      try {
        const [row] = await db
          .insert(businesses)
          .values(withUpdatedAt(data))
          .onConflictDoUpdate({
            target: businesses.googlePlaceId,
            set: withUpdatedAt({
              name: data.name,
              websiteUri: data.websiteUri,
              websiteDomain: data.websiteDomain,
              formattedAddress: data.formattedAddress,
              nationalPhone: data.nationalPhone,
              internationalPhone: data.internationalPhone,
              rating: data.rating,
              userRatingCount: data.userRatingCount,
              priceLevel: data.priceLevel,
              types: data.types,
              lastSeenRunId: data.lastSeenRunId,
            }),
          })
          .returning();
        if (!row) throw new Error("Upsert returned no row");
        return row;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to upsert business", {
          googlePlaceId: data.googlePlaceId,
        });
      }
    },
  };
}
