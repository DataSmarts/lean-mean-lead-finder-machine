import type { HunterClient } from "@/lib/clients/hunter";

import type { SourceContact } from "./merge";

export interface HunterEnrichService {
  enrich(params: { websiteDomain: string }): Promise<SourceContact[]>;
}

export interface HunterEnrichServiceDeps {
  readonly hunterClient: HunterClient;
}

export function createHunterEnrichService({
  hunterClient,
}: HunterEnrichServiceDeps): HunterEnrichService {
  return {
    async enrich({ websiteDomain }) {
      const { emails } = await hunterClient.domainSearch(websiteDomain);
      return emails.map((e) => ({
        source: "hunter" as const,
        fullName:
          e.firstName && e.lastName
            ? `${e.firstName} ${e.lastName}`
            : (e.firstName ?? e.lastName ?? null),
        firstName: e.firstName,
        lastName: e.lastName,
        title: e.position,
        email: e.value,
        emailConfidence: e.confidence,
        emailVerification: e.verificationStatus,
        seniority: e.seniority,
        department: e.department,
        phone: e.phoneNumber,
        linkedinUrl: e.linkedin,
        instagramUrl: null,
        twitterUrl: e.twitter,
        facebookUrl: null,
        raw: e as unknown as Record<string, unknown>,
      }));
    },
  };
}
