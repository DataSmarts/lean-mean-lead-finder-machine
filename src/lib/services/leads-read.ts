import type { AppDatabase } from "@/lib/db/client";
import type { LeadRow, LeadsListParams, LeadsListResult } from "@/lib/db/leads.repo";
import { makeLeadsRepo } from "@/lib/db/leads.repo";
import type { ContactSourceValue, EmailVerificationValue } from "@/lib/domain/enums";
import { deriveSourceBadges } from "@/lib/leads/source-badge";

// --- Narrow ISP port ----------------------------------------------------------

export interface LeadsReadLeadsRepo {
  list(params: LeadsListParams): Promise<LeadsListResult>;
  runOptions(): Promise<{ id: string; niche: string; city: string }[]>;
}

export interface LeadsReadServiceDeps {
  readonly leadsRepo: LeadsReadLeadsRepo;
}

// --- View models --------------------------------------------------------------

export interface LeadRowView {
  readonly contactId: string;
  readonly runId: string;
  readonly businessName: string;
  readonly website: string | null;
  readonly address: string | null;
  readonly person: string | null;
  readonly title: string | null;
  readonly email: string | null;
  readonly emailConfidence: number | null;
  readonly emailVerification: EmailVerificationValue;
  readonly source: ContactSourceValue;
  readonly sourceBadges: ContactSourceValue[];
  readonly linkedinUrl: string | null;
  readonly instagramUrl: string | null;
  readonly twitterUrl: string | null;
  readonly facebookUrl: string | null;
  readonly niche: string;
  readonly city: string;
}

export interface LeadsPageView {
  readonly rows: LeadRowView[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

// --- Serializer (pure) --------------------------------------------------------

function toLeadRowView(row: LeadRow): LeadRowView {
  const { contact, business, run } = row;
  return {
    contactId: contact.id,
    runId: contact.runId,
    businessName: business.name,
    website: business.websiteUri,
    address: business.formattedAddress,
    person: contact.fullName,
    title: contact.title,
    email: contact.email,
    emailConfidence: contact.emailConfidence,
    emailVerification: contact.emailVerification,
    source: contact.source,
    sourceBadges: deriveSourceBadges(
      contact.fieldSources as Record<string, "ai" | "hunter"> | null,
      contact.source,
    ),
    linkedinUrl: contact.linkedinUrl,
    instagramUrl: contact.instagramUrl,
    twitterUrl: contact.twitterUrl,
    facebookUrl: contact.facebookUrl,
    niche: run.niche,
    city: run.city,
  };
}

// --- Service ------------------------------------------------------------------

export interface LeadsReadService {
  list(params: LeadsListParams): Promise<LeadsPageView>;
  runOptions(): Promise<{ id: string; label: string }[]>;
}

export function createLeadsReadService({ leadsRepo }: LeadsReadServiceDeps): LeadsReadService {
  return {
    async list(params) {
      const result = await leadsRepo.list(params);
      return {
        rows: result.rows.map(toLeadRowView),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      };
    },

    async runOptions() {
      const opts = await leadsRepo.runOptions();
      return opts.map(({ id, niche, city }) => ({ id, label: `${niche} — ${city}` }));
    },
  };
}

// --- Convenience factory (page + route use this) ------------------------------

export function makeLeadsReadService(db: AppDatabase): LeadsReadService {
  return createLeadsReadService({ leadsRepo: makeLeadsRepo(db) });
}
