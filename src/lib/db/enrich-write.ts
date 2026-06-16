import { and, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { NewContact } from "./contacts.repo";
import { makeContactsRepo } from "./contacts.repo";
import {
  type EnrichStatusValue,
  makeRunBusinessesRepo,
  type SourceStatusValue,
} from "./run-businesses.repo";
import { makeRunsRepo } from "./runs.repo";
import * as schema from "./schema";
import { contacts } from "./schema";

// ── PersistEnrichment ────────────────────────────────────────────────────────

export interface RawContactWithIndex {
  readonly contact: NewContact;
  // Index into the mergedContacts array — which merged person this raw row maps to.
  readonly mergedPersonIndex: number;
}

export interface PersistEnrichmentArgs {
  readonly runId: string;
  readonly runBusinessId: string;
  readonly businessId: string;
  readonly rawContacts: readonly RawContactWithIndex[];
  // One entry per merged person; parallel-indexed with mergedPersonIndex above.
  readonly mergedContacts: readonly NewContact[];
  readonly enrichStatus: EnrichStatusValue;
  readonly aiStatus: SourceStatusValue;
  readonly hunterStatus: SourceStatusValue;
  readonly aiError: string | null;
  readonly hunterError: string | null;
  // The enrich_status before this write — used to guard counter bumps against double-counting on retry.
  readonly prevEnrichStatus: EnrichStatusValue;
}

export type PersistEnrichment = (
  args: PersistEnrichmentArgs,
) => Promise<{ newlyTerminal: boolean }>;

// ── PersistReuseEnrichment ───────────────────────────────────────────────────

export interface PersistReuseEnrichmentArgs {
  readonly runId: string;
  readonly runBusinessId: string;
  readonly businessId: string;
  readonly sourceRunId: string;
  readonly prevEnrichStatus: EnrichStatusValue;
}

export type PersistReuseEnrichment = (
  args: PersistReuseEnrichmentArgs,
) => Promise<{ contactsCopied: number }>;

// ── Factory ──────────────────────────────────────────────────────────────────

const TERMINAL_STATUSES: EnrichStatusValue[] = ["enriched", "partial", "failed"];

function rawNullEmailSources(rawContacts: readonly RawContactWithIndex[]): NewContact["source"][] {
  return Array.from(
    new Set(
      rawContacts
        .filter(({ contact }) => contact.email === null)
        .map(({ contact }) => contact.source),
    ),
  );
}

async function deleteMergedContacts(
  tx: Parameters<Parameters<PostgresJsDatabase<typeof schema>["transaction"]>[0]>[0],
  runId: string,
  businessId: string,
): Promise<void> {
  await tx
    .delete(contacts)
    .where(
      and(
        eq(contacts.runId, runId),
        eq(contacts.businessId, businessId),
        eq(contacts.kind, "merged"),
      ),
    );
}

export function createEnrichWriter(db: PostgresJsDatabase<typeof schema>): {
  persist: PersistEnrichment;
  persistReuse: PersistReuseEnrichment;
} {
  const persist: PersistEnrichment = ({
    runId,
    runBusinessId,
    businessId,
    rawContacts,
    mergedContacts,
    enrichStatus,
    aiStatus,
    hunterStatus,
    aiError,
    hunterError,
    prevEnrichStatus,
  }) =>
    db.transaction(async (tx) => {
      const contactsRepo = makeContactsRepo(tx);
      const runBusinessesRepo = makeRunBusinessesRepo(tx);
      const runsRepo = makeRunsRepo(tx);

      for (const source of rawNullEmailSources(rawContacts)) {
        await contactsRepo.deleteRawNullEmailBySource({ runId, businessId, source });
      }

      // 1. Upsert raw person contacts; track which merged-person index each belongs to.
      const upsertedByMergedIndex = new Map<number, string[]>();
      for (const { contact, mergedPersonIndex } of rawContacts) {
        const upserted = await contactsRepo.upsertRaw(contact);
        const ids = upsertedByMergedIndex.get(mergedPersonIndex) ?? [];
        ids.push(upserted.id);
        upsertedByMergedIndex.set(mergedPersonIndex, ids);
      }

      // 2. Delete existing merged rows for this (run, business) — idempotent regen on retry.
      await deleteMergedContacts(tx, runId, businessId);

      // 3. Insert fresh merged rows.
      const mergedRowIds: string[] = [];
      for (const mergedContact of mergedContacts) {
        const inserted = await contactsRepo.insertMerged(mergedContact);
        mergedRowIds.push(inserted.id);
      }

      // 4. Back-link raw rows to their merged row via mergedIntoId.
      for (let i = 0; i < mergedContacts.length; i++) {
        const rawIds = upsertedByMergedIndex.get(i) ?? [];
        if (rawIds.length > 0) {
          await tx
            .update(contacts)
            .set({ mergedIntoId: mergedRowIds[i] })
            .where(inArray(contacts.id, rawIds));
        }
      }

      // 5. Update run_business status.
      await runBusinessesRepo.updateStatus(runBusinessId, {
        enrichStatus,
        aiStatus,
        hunterStatus,
        aiError,
        hunterError,
        enrichedAt: new Date(),
        attempts: undefined, // let the task layer manage attempt count separately
      });

      // 6. Guarded counter bumps — only on first transition to a terminal status.
      const newlyTerminal = !TERMINAL_STATUSES.includes(prevEnrichStatus);
      if (newlyTerminal) {
        if (enrichStatus === "enriched" || enrichStatus === "partial") {
          await runsRepo.incrementCounter(runId, "businessesEnriched");
        } else if (enrichStatus === "failed") {
          await runsRepo.incrementCounter(runId, "businessesFailed");
        }
        if (mergedContacts.length > 0) {
          await runsRepo.incrementCounter(runId, "contactsFound", mergedContacts.length);
        }
      }

      return { newlyTerminal };
    });

  const persistReuse: PersistReuseEnrichment = ({
    runId,
    runBusinessId,
    businessId,
    sourceRunId,
    prevEnrichStatus,
  }) =>
    db.transaction(async (tx) => {
      const contactsRepo = makeContactsRepo(tx);
      const runBusinessesRepo = makeRunBusinessesRepo(tx);
      const runsRepo = makeRunsRepo(tx);

      // Fetch all contacts from the prior run for this business.
      const priorContacts = await contactsRepo.findByRunAndBusiness(sourceRunId, businessId);
      const priorMerged = priorContacts.filter((c) => c.kind === "merged");
      const priorRaw = priorContacts.filter((c) => c.kind === "person");

      await deleteMergedContacts(tx, runId, businessId);
      const nullEmailSources = new Set(
        priorRaw.filter((contact) => contact.email === null).map((contact) => contact.source),
      );
      for (const source of nullEmailSources) {
        await contactsRepo.deleteRawNullEmailBySource({ runId, businessId, source });
      }

      // Insert merged contacts first (raw contacts reference them via mergedIntoId).
      const oldToNewMergedId = new Map<string, string>();
      for (const merged of priorMerged) {
        const { id: _oldId, createdAt: _ca, ...rest } = merged;
        const newMerged = await contactsRepo.insertMerged({
          ...rest,
          runId,
          mergedIntoId: null, // merged rows themselves never point to another row
        });
        oldToNewMergedId.set(merged.id, newMerged.id);
      }

      // Insert raw contacts, remapping mergedIntoId.
      for (const raw of priorRaw) {
        const { id: _id, createdAt: _ca, ...rest } = raw;
        const newMergedId = raw.mergedIntoId
          ? (oldToNewMergedId.get(raw.mergedIntoId) ?? null)
          : null;
        await contactsRepo.upsertRaw({ ...rest, runId, mergedIntoId: newMergedId });
      }

      await runBusinessesRepo.updateStatus(runBusinessId, {
        enrichStatus: "enriched",
        enrichedAt: new Date(),
      });

      const newlyTerminal = !TERMINAL_STATUSES.includes(prevEnrichStatus);
      const mergedCount = priorMerged.length;
      if (newlyTerminal) {
        await runsRepo.incrementCounter(runId, "businessesEnriched");
        if (mergedCount > 0) {
          await runsRepo.incrementCounter(runId, "contactsFound", mergedCount);
        }
      }

      return { contactsCopied: priorContacts.length };
    });

  return { persist, persistReuse };
}
