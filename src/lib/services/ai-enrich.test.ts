import { describe, expect, it, vi } from "vitest";

import type { OpenRouterClient, OpenRouterContact } from "@/lib/clients/openrouter";

import { createAiEnrichService } from "./ai-enrich";

function makeClient(result: OpenRouterContact | null): OpenRouterClient {
  return { researchLead: vi.fn().mockResolvedValue(result) };
}

const fullContact: OpenRouterContact = {
  fullName: "Jane Doe",
  firstName: "Jane",
  lastName: "Doe",
  title: "CEO",
  email: "jane@acme.com",
  linkedinUrl: "https://linkedin.com/in/janedoe",
  instagramUrl: "https://instagram.com/janedoe",
  twitterUrl: null,
  facebookUrl: null,
};

describe("createAiEnrichService.enrich", () => {
  it("maps an OpenRouterContact to a SourceContact with source=ai", async () => {
    const service = createAiEnrichService({ openRouterClient: makeClient(fullContact) });

    const contacts = await service.enrich({
      businessName: "Acme Corp",
      websiteUri: "https://acme.com",
      address: "123 Main St",
    });

    expect(contacts).toHaveLength(1);
    const c = contacts[0]!;
    expect(c.source).toBe("ai");
    expect(c.fullName).toBe("Jane Doe");
    expect(c.email).toBe("jane@acme.com");
    expect(c.linkedinUrl).toBe("https://linkedin.com/in/janedoe");
    expect(c.instagramUrl).toBe("https://instagram.com/janedoe");
    // AI never provides these
    expect(c.emailConfidence).toBeNull();
    expect(c.emailVerification).toBeNull();
    expect(c.phone).toBeNull();
    expect(c.seniority).toBeNull();
    expect(c.department).toBeNull();
  });

  it("returns empty array when the AI client returns null", async () => {
    const service = createAiEnrichService({ openRouterClient: makeClient(null) });

    const contacts = await service.enrich({
      businessName: "Unknown Inc",
      websiteUri: null,
      address: null,
    });

    expect(contacts).toHaveLength(0);
  });

  it("propagates errors from the OpenRouter client", async () => {
    const err = new Error("parse failed");
    const service = createAiEnrichService({
      openRouterClient: { researchLead: vi.fn().mockRejectedValue(err) },
    });

    await expect(
      service.enrich({ businessName: "X", websiteUri: null, address: null }),
    ).rejects.toBe(err);
  });
});
