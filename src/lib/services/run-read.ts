import type { Business } from "@/lib/db/businesses.repo";
import type { AppDatabase } from "@/lib/db/client";
import type { Contact } from "@/lib/db/contacts.repo";
import { makeContactsRepo } from "@/lib/db/contacts.repo";
import type { RunBusiness } from "@/lib/db/run-businesses.repo";
import { makeRunBusinessesRepo } from "@/lib/db/run-businesses.repo";
import type { Run } from "@/lib/db/runs.repo";
import { makeRunsRepo } from "@/lib/db/runs.repo";
import type { RunStatusValue } from "@/lib/runs/status";

// --- Narrow repo ports (ISP) --------------------------------------------------

export interface RunReadRunsRepo {
  findById(id: string): Promise<Run | undefined>;
}

export interface RunReadRunBusinessesRepo {
  findByRunWithBusiness(runId: string): Promise<{ runBusiness: RunBusiness; business: Business }[]>;
}

export interface RunReadContactsRepo {
  findMerged(runId: string): Promise<Contact[]>;
}

export interface RunReadServiceDeps {
  readonly runsRepo: RunReadRunsRepo;
  readonly runBusinessesRepo: RunReadRunBusinessesRepo;
  readonly contactsRepo: RunReadContactsRepo;
}

// --- View models (ISO-string timestamps; no sensitive/internal fields) ---------

export interface RunView {
  readonly id: string;
  readonly triggerSource: "dashboard" | "schedule" | "api";
  readonly status: RunStatusValue;
  readonly neighborhood: string | null;
  readonly city: string;
  readonly country: string;
  readonly niche: string;
  readonly maxResults: number;
  readonly businessesFound: number;
  readonly businessesEnriched: number;
  readonly businessesFailed: number;
  readonly contactsFound: number;
  readonly approvedAt: string | null;
  readonly approvedBy: string | null;
  readonly rejectedAt: string | null;
  readonly error: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
}

export interface BusinessView {
  readonly id: string;
  readonly googlePlaceId: string;
  readonly name: string;
  readonly websiteUri: string | null;
  readonly websiteDomain: string | null;
  readonly formattedAddress: string | null;
  readonly nationalPhone: string | null;
  readonly internationalPhone: string | null;
  readonly rating: number | null;
  readonly userRatingCount: number | null;
  readonly priceLevel: string | null;
  readonly types: string[];
}

export interface RunBusinessView {
  readonly id: string;
  readonly runId: string;
  readonly businessId: string;
  readonly enrichStatus: string;
  readonly aiStatus: string;
  readonly hunterStatus: string;
  readonly aiError: string | null;
  readonly hunterError: string | null;
  readonly attempts: number;
  readonly enrichedAt: string | null;
}

export interface MergedContactView {
  readonly id: string;
  readonly businessId: string;
  readonly fullName: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly title: string | null;
  readonly email: string | null;
  readonly emailConfidence: number | null;
  readonly emailVerification: string | null;
  readonly seniority: string | null;
  readonly department: string | null;
  readonly phone: string | null;
  readonly linkedinUrl: string | null;
  readonly instagramUrl: string | null;
  readonly twitterUrl: string | null;
  readonly facebookUrl: string | null;
  readonly fieldSources: Record<string, string> | null;
}

export interface RunDetailBusiness {
  readonly runBusiness: RunBusinessView;
  readonly business: BusinessView;
  readonly contacts: MergedContactView[];
}

export interface RunDetailView {
  readonly run: RunView;
  readonly businesses: RunDetailBusiness[];
}

// --- Serializers (pure) -------------------------------------------------------

function toIso(d: Date | null | undefined): string | null {
  return d instanceof Date ? d.toISOString() : null;
}

export function toRunView(run: Run): RunView {
  return {
    id: run.id,
    triggerSource: run.triggerSource,
    status: run.status as RunStatusValue,
    neighborhood: run.neighborhood,
    city: run.city,
    country: run.country,
    niche: run.niche,
    maxResults: run.maxResults,
    businessesFound: run.businessesFound,
    businessesEnriched: run.businessesEnriched,
    businessesFailed: run.businessesFailed,
    contactsFound: run.contactsFound,
    approvedAt: toIso(run.approvedAt),
    approvedBy: run.approvedBy,
    rejectedAt: toIso(run.rejectedAt),
    error: run.error,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    startedAt: toIso(run.startedAt),
    finishedAt: toIso(run.finishedAt),
  };
}

function toBusinessView(b: Business): BusinessView {
  return {
    id: b.id,
    googlePlaceId: b.googlePlaceId,
    name: b.name,
    websiteUri: b.websiteUri,
    websiteDomain: b.websiteDomain,
    formattedAddress: b.formattedAddress,
    nationalPhone: b.nationalPhone,
    internationalPhone: b.internationalPhone,
    rating: b.rating,
    userRatingCount: b.userRatingCount,
    priceLevel: b.priceLevel,
    types: b.types,
  };
}

function toRunBusinessView(rb: RunBusiness): RunBusinessView {
  return {
    id: rb.id,
    runId: rb.runId,
    businessId: rb.businessId,
    enrichStatus: rb.enrichStatus,
    aiStatus: rb.aiStatus,
    hunterStatus: rb.hunterStatus,
    aiError: rb.aiError,
    hunterError: rb.hunterError,
    attempts: rb.attempts,
    enrichedAt: toIso(rb.enrichedAt),
  };
}

function toMergedContactView(c: Contact): MergedContactView {
  return {
    id: c.id,
    businessId: c.businessId,
    fullName: c.fullName,
    firstName: c.firstName,
    lastName: c.lastName,
    title: c.title,
    email: c.email,
    emailConfidence: c.emailConfidence,
    emailVerification: c.emailVerification,
    seniority: c.seniority,
    department: c.department,
    phone: c.phone,
    linkedinUrl: c.linkedinUrl,
    instagramUrl: c.instagramUrl,
    twitterUrl: c.twitterUrl,
    facebookUrl: c.facebookUrl,
    fieldSources: c.fieldSources as Record<string, string> | null,
  };
}

// --- Service ------------------------------------------------------------------

export interface RunReadService {
  getDetail(runId: string): Promise<RunDetailView | null>;
}

export function createRunReadService({
  runsRepo,
  runBusinessesRepo,
  contactsRepo,
}: RunReadServiceDeps): RunReadService {
  return {
    async getDetail(runId) {
      const run = await runsRepo.findById(runId);
      if (!run) return null;

      // One call each; no N+1 — contacts are fetched for the whole run, then grouped.
      const [rbWithBiz, mergedContacts] = await Promise.all([
        runBusinessesRepo.findByRunWithBusiness(runId),
        contactsRepo.findMerged(runId),
      ]);

      const contactsByBusiness = new Map<string, MergedContactView[]>();
      for (const contact of mergedContacts) {
        const existing = contactsByBusiness.get(contact.businessId) ?? [];
        existing.push(toMergedContactView(contact));
        contactsByBusiness.set(contact.businessId, existing);
      }

      const businesses: RunDetailBusiness[] = rbWithBiz.map(({ runBusiness, business }) => ({
        runBusiness: toRunBusinessView(runBusiness),
        business: toBusinessView(business),
        contacts: contactsByBusiness.get(business.id) ?? [],
      }));

      return { run: toRunView(run), businesses };
    },
  };
}

// --- Convenience factory (route + page use this) ------------------------------

export function makeRunReadService(db: AppDatabase): RunReadService {
  return createRunReadService({
    runsRepo: makeRunsRepo(db),
    runBusinessesRepo: makeRunBusinessesRepo(db),
    contactsRepo: makeContactsRepo(db),
  });
}
