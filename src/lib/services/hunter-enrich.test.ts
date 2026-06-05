import { describe, expect, it, vi } from "vitest";

import type { HunterClient, HunterDomainSearchResult } from "@/lib/clients/hunter";

import { createHunterEnrichService } from "./hunter-enrich";

function makeHunterClient(result: HunterDomainSearchResult): HunterClient {
  return { domainSearch: vi.fn().mockResolvedValue(result) };
}

const fullEmail = {
  value: "jane.doe@acme.com",
  type: "personal" as const,
  confidence: 92,
  firstName: "Jane",
  lastName: "Doe",
  position: "CEO",
  seniority: "executive",
  department: "executive",
  linkedin: "https://linkedin.com/in/janedoe",
  twitter: null,
  phoneNumber: "+1-555-0100",
  verificationStatus: "valid" as const,
};

describe("createHunterEnrichService.enrich", () => {
  it("converts Hunter emails to SourceContacts with source=hunter", async () => {
    const service = createHunterEnrichService({
      hunterClient: makeHunterClient({ organization: "Acme", pattern: null, emails: [fullEmail] }),
    });

    const contacts = await service.enrich({ websiteDomain: "acme.com" });

    expect(contacts).toHaveLength(1);
    const c = contacts[0]!;
    expect(c.source).toBe("hunter");
    expect(c.email).toBe("jane.doe@acme.com");
    expect(c.firstName).toBe("Jane");
    expect(c.lastName).toBe("Doe");
    expect(c.title).toBe("CEO");
    expect(c.emailConfidence).toBe(92);
    expect(c.emailVerification).toBe("valid");
    expect(c.phone).toBe("+1-555-0100");
    expect(c.linkedinUrl).toBe("https://linkedin.com/in/janedoe");
    expect(c.twitterUrl).toBeNull();
    expect(c.instagramUrl).toBeNull();
    expect(c.facebookUrl).toBeNull();
  });

  it("returns empty array when Hunter finds no emails", async () => {
    const service = createHunterEnrichService({
      hunterClient: makeHunterClient({ organization: null, pattern: null, emails: [] }),
    });

    expect(await service.enrich({ websiteDomain: "obscure.io" })).toHaveLength(0);
  });

  it("builds fullName from firstName + lastName", async () => {
    const service = createHunterEnrichService({
      hunterClient: makeHunterClient({
        organization: null,
        pattern: null,
        emails: [{ ...fullEmail, firstName: "John", lastName: "Smith" }],
      }),
    });

    const [contact] = await service.enrich({ websiteDomain: "acme.com" });
    expect(contact!.fullName).toBe("John Smith");
  });

  it("propagates errors from the Hunter client", async () => {
    const err = new Error("rate limited");
    const service = createHunterEnrichService({
      hunterClient: { domainSearch: vi.fn().mockRejectedValue(err) },
    });

    await expect(service.enrich({ websiteDomain: "acme.com" })).rejects.toBe(err);
  });
});
