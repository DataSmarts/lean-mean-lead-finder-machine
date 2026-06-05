import type { OpenRouterClient } from "@/lib/clients/openrouter";

import type { SourceContact } from "./merge";

export interface AiEnrichService {
  enrich(params: {
    businessName: string;
    websiteUri: string | null;
    address: string | null;
  }): Promise<SourceContact[]>;
}

export interface AiEnrichServiceDeps {
  readonly openRouterClient: OpenRouterClient;
}

export function createAiEnrichService({ openRouterClient }: AiEnrichServiceDeps): AiEnrichService {
  return {
    async enrich({ businessName, websiteUri, address }) {
      const contact = await openRouterClient.researchLead({ businessName, websiteUri, address });
      if (!contact) return [];
      return [
        {
          source: "ai" as const,
          fullName: contact.fullName,
          firstName: contact.firstName,
          lastName: contact.lastName,
          title: contact.title,
          email: contact.email,
          // AI does not provide structured email metadata.
          emailConfidence: null,
          emailVerification: null,
          seniority: null,
          department: null,
          phone: null,
          linkedinUrl: contact.linkedinUrl,
          instagramUrl: contact.instagramUrl,
          twitterUrl: contact.twitterUrl,
          facebookUrl: contact.facebookUrl,
          raw: contact as unknown as Record<string, unknown>,
        },
      ];
    },
  };
}
