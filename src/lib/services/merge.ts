// Pure — no I/O. Implements the §6.3 identity-match and field-precedence merge rules.

import type { EmailVerificationValue } from "@/lib/domain/enums";

export interface SourceContact {
  readonly source: "ai" | "hunter";
  readonly fullName: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly title: string | null;
  readonly email: string | null;
  readonly emailConfidence: number | null;
  readonly emailVerification: EmailVerificationValue | null;
  readonly seniority: string | null;
  readonly department: string | null;
  readonly phone: string | null;
  readonly linkedinUrl: string | null;
  readonly instagramUrl: string | null;
  readonly twitterUrl: string | null;
  readonly facebookUrl: string | null;
  readonly raw: Record<string, unknown>;
}

export interface MergedPerson {
  // Which source provided the winning email (determines name precedence). `hunter` when no email.
  readonly winningSource: "ai" | "hunter";
  // Contributing raw contacts (1 or 2).
  readonly members: SourceContact[];
  // Merged field values:
  readonly fullName: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly title: string | null;
  readonly email: string | null;
  readonly emailConfidence: number | null;
  readonly emailVerification: EmailVerificationValue | null;
  readonly seniority: string | null;
  readonly department: string | null;
  readonly phone: string | null;
  readonly linkedinUrl: string | null;
  readonly instagramUrl: string | null;
  readonly twitterUrl: string | null;
  readonly facebookUrl: string | null;
  // Field-level provenance — only fields with a non-null merged value appear here.
  readonly fieldSources: Record<string, "ai" | "hunter">;
}

export interface MergeInput {
  readonly ai: SourceContact[];
  readonly hunter: SourceContact[];
}

// §6.3 identity: two contacts are the same person when:
// 1. Both have email and they match case-insensitively, OR
// 2. Both have lastName + firstName and lastName matches + first initials match (email missing).
function sameIdentity(a: SourceContact, b: SourceContact): boolean {
  if (a.email && b.email) {
    return a.email.toLowerCase() === b.email.toLowerCase();
  }
  if (a.lastName && b.lastName && a.firstName && b.firstName) {
    return (
      a.lastName.toLowerCase() === b.lastName.toLowerCase() &&
      a.firstName[0]!.toLowerCase() === b.firstName[0]!.toLowerCase()
    );
  }
  return false;
}

// Group contacts into identity clusters using the sequential-scan approach — safe since
// the input size is small (0–1 AI + 0–5 Hunter contacts).
function groupByIdentity(contacts: SourceContact[]): SourceContact[][] {
  const groups: SourceContact[][] = [];
  for (const contact of contacts) {
    const idx = groups.findIndex((group) => group.some((c) => sameIdentity(c, contact)));
    if (idx >= 0) {
      groups[idx]!.push(contact);
    } else {
      groups.push([contact]);
    }
  }
  return groups;
}

type FieldSource = "ai" | "hunter";

// Pick the first non-null/undefined value from the ordered candidates and record the winning source.
function pick<T>(
  fieldName: string,
  fieldSources: Record<string, FieldSource>,
  ...candidates: Array<{ value: T | null | undefined; source: FieldSource }>
): T | null {
  for (const { value, source } of candidates) {
    if (value != null) {
      fieldSources[fieldName] = source;
      return value;
    }
  }
  return null;
}

function buildMergedPerson(members: SourceContact[]): MergedPerson {
  const aiContacts = members.filter((m) => m.source === "ai");
  const hunterContacts = members.filter((m) => m.source === "hunter");

  // Best Hunter contact: prefer valid verification or confidence ≥ 80; take first otherwise.
  const hunterWithEmail =
    hunterContacts
      .filter((m) => m.email != null)
      .sort((a, b) => {
        const aScore =
          (a.emailVerification === "valid" ? 2 : 0) + ((a.emailConfidence ?? 0) >= 80 ? 1 : 0);
        const bScore =
          (b.emailVerification === "valid" ? 2 : 0) + ((b.emailConfidence ?? 0) >= 80 ? 1 : 0);
        return bScore - aScore;
      })[0] ?? null;

  const primaryHunter = hunterWithEmail ?? hunterContacts[0] ?? null;
  const primaryAi = aiContacts.find((m) => m.email != null) ?? aiContacts[0] ?? null;

  // §6.3 email precedence: Hunter if available (any), AI only as fallback.
  const fieldSources: Record<string, FieldSource> = {};
  let email: string | null = null;
  let winningSource: FieldSource = "hunter";

  if (hunterWithEmail) {
    email = hunterWithEmail.email;
    winningSource = "hunter";
    fieldSources.email = "hunter";
  } else if (primaryAi?.email) {
    email = primaryAi.email;
    winningSource = "ai";
    fieldSources.email = "ai";
  }

  // §6.3 email metadata: only from Hunter (structured, verified).
  const emailConfidence = hunterWithEmail?.emailConfidence ?? null;
  if (emailConfidence != null) fieldSources.email_confidence = "hunter";
  const emailVerification = hunterWithEmail?.emailVerification ?? null;
  if (emailVerification != null) fieldSources.email_verification = "hunter";

  // §6.3 name: prefer the source that provided the winning email; tie → Hunter.
  const primaryNameSource = winningSource === "hunter" ? primaryHunter : primaryAi;
  const fallbackNameSource = winningSource === "hunter" ? primaryAi : primaryHunter;

  const fullName = pick(
    "full_name",
    fieldSources,
    { value: primaryNameSource?.fullName, source: winningSource },
    { value: fallbackNameSource?.fullName, source: winningSource === "hunter" ? "ai" : "hunter" },
  );
  const firstName = pick(
    "first_name",
    fieldSources,
    { value: primaryNameSource?.firstName, source: winningSource },
    { value: fallbackNameSource?.firstName, source: winningSource === "hunter" ? "ai" : "hunter" },
  );
  const lastName = pick(
    "last_name",
    fieldSources,
    { value: primaryNameSource?.lastName, source: winningSource },
    { value: fallbackNameSource?.lastName, source: winningSource === "hunter" ? "ai" : "hunter" },
  );

  // §6.3 structured fields: Hunter wins.
  const title = pick(
    "title",
    fieldSources,
    { value: primaryHunter?.title, source: "hunter" },
    { value: primaryAi?.title, source: "ai" },
  );
  const seniority = pick(
    "seniority",
    fieldSources,
    { value: primaryHunter?.seniority, source: "hunter" },
    { value: primaryAi?.seniority, source: "ai" },
  );
  const department = pick(
    "department",
    fieldSources,
    { value: primaryHunter?.department, source: "hunter" },
    { value: primaryAi?.department, source: "ai" },
  );
  // Phone: Hunter only (AI does not provide phone).
  const phone = pick("phone", fieldSources, { value: primaryHunter?.phone, source: "hunter" });

  // §6.3 social: prefer AI; fall back to Hunter for linkedin/twitter. instagram/facebook: AI only.
  const linkedinUrl = pick(
    "linkedin_url",
    fieldSources,
    { value: primaryAi?.linkedinUrl, source: "ai" },
    { value: primaryHunter?.linkedinUrl, source: "hunter" },
  );
  const twitterUrl = pick(
    "twitter_url",
    fieldSources,
    { value: primaryAi?.twitterUrl, source: "ai" },
    { value: primaryHunter?.twitterUrl, source: "hunter" },
  );
  const instagramUrl = pick("instagram_url", fieldSources, {
    value: primaryAi?.instagramUrl,
    source: "ai",
  });
  const facebookUrl = pick("facebook_url", fieldSources, {
    value: primaryAi?.facebookUrl,
    source: "ai",
  });

  return {
    winningSource,
    members,
    fullName,
    firstName,
    lastName,
    title,
    email,
    emailConfidence,
    emailVerification,
    seniority,
    department,
    phone,
    linkedinUrl,
    instagramUrl,
    twitterUrl,
    facebookUrl,
    fieldSources,
  };
}

// §6.3 merge entry point. Groups all contacts by identity, then applies precedence rules.
export function merge({ ai, hunter }: MergeInput): MergedPerson[] {
  return groupByIdentity([...ai, ...hunter]).map(buildMergedPerson);
}
