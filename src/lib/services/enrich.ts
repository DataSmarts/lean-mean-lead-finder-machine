import { DEFAULT_ENRICH_REUSE_DAYS } from "@/lib/config/defaults";
import type { Business } from "@/lib/db/businesses.repo";
import type { NewContact } from "@/lib/db/contacts.repo";
import type {
  PersistEnrichment,
  PersistReuseEnrichment,
  RawContactWithIndex,
} from "@/lib/db/enrich-write";
import type {
  EnrichStatusValue,
  RunBusiness,
  SourceStatusValue,
  StatusUpdate,
} from "@/lib/db/run-businesses.repo";
import { PipelineStateError } from "@/lib/errors";

import type { AiEnrichService } from "./ai-enrich";
import type { HunterEnrichService } from "./hunter-enrich";
import { merge, type MergedPerson, type SourceContact } from "./merge";

export { DEFAULT_ENRICH_REUSE_DAYS };

// Narrow repo ports (ISP).
export interface EnrichRunBusinessesRepo {
  findById(id: string): Promise<RunBusiness | undefined>;
  updateStatus(id: string, update: StatusUpdate): Promise<RunBusiness | undefined>;
  findReusable(
    businessId: string,
    since: Date,
    excludeRunId: string,
  ): Promise<RunBusiness | undefined>;
}

export interface EnrichBusinessesRepo {
  findById(id: string): Promise<Business | undefined>;
}

export interface EnrichServiceDeps {
  readonly runBusinessesRepo: EnrichRunBusinessesRepo;
  readonly businessesRepo: EnrichBusinessesRepo;
  readonly aiEnrichService: AiEnrichService;
  readonly hunterEnrichService: HunterEnrichService;
  readonly persist: PersistEnrichment;
  readonly persistReuse: PersistReuseEnrichment;
  readonly reuseWindowDays?: number;
  // Injected for testing (defaults to Date.now in production).
  readonly now?: () => Date;
}

export interface EnrichResult {
  readonly enrichStatus: EnrichStatusValue;
  readonly aiStatus: SourceStatusValue;
  readonly hunterStatus: SourceStatusValue;
  readonly mergedCount: number;
  readonly reused: boolean;
}

export interface EnrichService {
  enrichBusiness(runBusinessId: string): Promise<EnrichResult>;
}

// Pure: maps per-source outcomes to the overall business enrich_status.
export function rollUpStatus(
  aiStatus: SourceStatusValue,
  hunterStatus: SourceStatusValue,
): EnrichStatusValue {
  const statuses = [aiStatus, hunterStatus];
  const succeeded = statuses.filter((status) => status === "succeeded").length;
  const failed = statuses.filter((status) => status === "failed").length;

  if (succeeded > 0 && failed === 0) return "enriched";
  if (succeeded === 0 && failed > 0) return "failed";
  if (succeeded === 0 && failed === 0) return "skipped";
  return "partial";
}

function extractErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Build NewContact rows for raw person contacts, annotated with their merged-person index.
function buildRawContactsWithIndex(
  groups: MergedPerson[],
  runId: string,
  businessId: string,
): RawContactWithIndex[] {
  const result: RawContactWithIndex[] = [];
  for (let i = 0; i < groups.length; i++) {
    for (const member of groups[i]!.members) {
      result.push({
        mergedPersonIndex: i,
        contact: sourceContactToNewContact(member, runId, businessId),
      });
    }
  }
  return result;
}

function sourceContactToNewContact(
  sc: SourceContact,
  runId: string,
  businessId: string,
): NewContact {
  return {
    runId,
    businessId,
    source: sc.source,
    kind: "person",
    fullName: sc.fullName,
    firstName: sc.firstName,
    lastName: sc.lastName,
    title: sc.title,
    email: sc.email,
    emailConfidence: sc.emailConfidence,
    emailVerification: sc.emailVerification ?? "unverified",
    seniority: sc.seniority,
    department: sc.department,
    phone: sc.phone,
    linkedinUrl: sc.linkedinUrl,
    instagramUrl: sc.instagramUrl,
    twitterUrl: sc.twitterUrl,
    facebookUrl: sc.facebookUrl,
    mergedIntoId: null,
    fieldSources: null,
    raw: sc.raw,
  };
}

function mergedPersonToNewContact(
  person: MergedPerson,
  runId: string,
  businessId: string,
): NewContact {
  return {
    runId,
    businessId,
    source: person.winningSource,
    kind: "merged",
    fullName: person.fullName,
    firstName: person.firstName,
    lastName: person.lastName,
    title: person.title,
    email: person.email,
    emailConfidence: person.emailConfidence,
    emailVerification: person.emailVerification ?? "unverified",
    seniority: person.seniority,
    department: person.department,
    phone: person.phone,
    linkedinUrl: person.linkedinUrl,
    instagramUrl: person.instagramUrl,
    twitterUrl: person.twitterUrl,
    facebookUrl: person.facebookUrl,
    mergedIntoId: null, // set by the writer after insertion
    fieldSources: person.fieldSources,
    raw: null,
  };
}

export function createEnrichService({
  runBusinessesRepo,
  businessesRepo,
  aiEnrichService,
  hunterEnrichService,
  persist,
  persistReuse,
  reuseWindowDays = DEFAULT_ENRICH_REUSE_DAYS,
  now = () => new Date(),
}: EnrichServiceDeps): EnrichService {
  return {
    async enrichBusiness(runBusinessId) {
      const runBusiness = await runBusinessesRepo.findById(runBusinessId);
      if (!runBusiness) {
        throw new PipelineStateError(`RunBusiness ${runBusinessId} not found`, {
          context: { runBusinessId },
        });
      }
      const business = await businessesRepo.findById(runBusiness.businessId);
      if (!business) {
        throw new PipelineStateError(`Business ${runBusiness.businessId} not found`, {
          context: { businessId: runBusiness.businessId, runBusinessId },
        });
      }

      const since = new Date(now().getTime() - reuseWindowDays * 24 * 60 * 60 * 1000);
      const reusable = await runBusinessesRepo.findReusable(
        runBusiness.businessId,
        since,
        runBusiness.runId,
      );
      if (reusable) {
        await persistReuse({
          runId: runBusiness.runId,
          runBusinessId,
          businessId: runBusiness.businessId,
          sourceRunId: reusable.runId,
          prevEnrichStatus: runBusiness.enrichStatus,
        });
        return {
          enrichStatus: "enriched",
          aiStatus: "skipped",
          hunterStatus: "skipped",
          mergedCount: 0,
          reused: true,
        };
      }

      const skipHunter = !business.websiteDomain;

      // Mark enrichment in-progress before parallel calls (observable progress).
      await runBusinessesRepo.updateStatus(runBusinessId, {
        enrichStatus: "ai_running",
        aiStatus: "running",
        hunterStatus: skipHunter ? "skipped" : "running",
      });

      // Parallel enrichment — one failing never aborts the other (Promise.allSettled).
      const [aiSettled, hunterSettled] = await Promise.allSettled([
        aiEnrichService.enrich({
          businessName: business.name,
          websiteUri: business.websiteUri,
          address: business.formattedAddress,
        }),
        skipHunter
          ? Promise.resolve<SourceContact[]>([])
          : hunterEnrichService.enrich({ websiteDomain: business.websiteDomain! }),
      ]);

      const aiStatus: SourceStatusValue = aiSettled.status === "fulfilled" ? "succeeded" : "failed";
      const aiContacts = aiSettled.status === "fulfilled" ? aiSettled.value : [];
      const aiError =
        aiSettled.status === "rejected" ? extractErrorMessage(aiSettled.reason) : null;

      const hunterStatus: SourceStatusValue = skipHunter
        ? "skipped"
        : hunterSettled.status === "fulfilled"
          ? "succeeded"
          : "failed";
      const hunterContacts =
        !skipHunter && hunterSettled.status === "fulfilled" ? hunterSettled.value : [];
      const hunterError =
        !skipHunter && hunterSettled.status === "rejected"
          ? extractErrorMessage(hunterSettled.reason)
          : null;

      const enrichStatus = rollUpStatus(aiStatus, hunterStatus);
      const mergedPersons = merge({ ai: aiContacts, hunter: hunterContacts });

      const rawContacts = buildRawContactsWithIndex(
        mergedPersons,
        runBusiness.runId,
        runBusiness.businessId,
      );
      const mergedContacts: NewContact[] = mergedPersons.map((p) =>
        mergedPersonToNewContact(p, runBusiness.runId, runBusiness.businessId),
      );

      await persist({
        runId: runBusiness.runId,
        runBusinessId,
        businessId: runBusiness.businessId,
        rawContacts,
        mergedContacts,
        enrichStatus,
        aiStatus,
        hunterStatus,
        aiError,
        hunterError,
        prevEnrichStatus: runBusiness.enrichStatus,
      });

      return {
        enrichStatus,
        aiStatus,
        hunterStatus,
        mergedCount: mergedPersons.length,
        reused: false,
      };
    },
  };
}
