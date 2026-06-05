import { describe, expect, it, vi } from "vitest";

import { HttpError } from "@/lib/errors/http-error";
import { HunterQuotaExhaustedError, HunterRateLimitError } from "@/lib/errors/hunter-error";

import type { HttpClient } from "./http";
import { createHunterClient } from "./hunter";

function makeHttp(overrides: Partial<HttpClient> = {}): HttpClient {
  return {
    request: vi.fn().mockResolvedValue({
      data: { organization: "Acme Corp", pattern: "{first}.{last}@acme.com", emails: [] },
    }),
    ...overrides,
  };
}

const validEmailResponse = {
  data: {
    organization: "Acme Corp",
    pattern: "{first}@acme.com",
    emails: [
      {
        value: "jane.doe@acme.com",
        type: "personal",
        confidence: 92,
        first_name: "Jane",
        last_name: "Doe",
        position: "CEO",
        seniority: "executive",
        department: "executive",
        linkedin: "https://linkedin.com/in/janedoe",
        twitter: null,
        phone_number: "+1-555-0100",
        verification: { status: "valid" },
      },
    ],
  },
};

describe("createHunterClient.domainSearch", () => {
  it("maps a full email response to HunterEmail correctly", async () => {
    const http = makeHttp({ request: vi.fn().mockResolvedValue(validEmailResponse) });
    const client = createHunterClient({ http, apiKey: "key", limit: 5 });

    const result = await client.domainSearch("acme.com");

    expect(result.organization).toBe("Acme Corp");
    expect(result.pattern).toBe("{first}@acme.com");
    expect(result.emails).toHaveLength(1);
    const email = result.emails[0]!;
    expect(email.value).toBe("jane.doe@acme.com");
    expect(email.firstName).toBe("Jane");
    expect(email.lastName).toBe("Doe");
    expect(email.confidence).toBe(92);
    expect(email.verificationStatus).toBe("valid");
    expect(email.phoneNumber).toBe("+1-555-0100");
    expect(email.linkedin).toBe("https://linkedin.com/in/janedoe");
    expect(email.twitter).toBeNull();
  });

  it("treats an empty emails array as a valid (non-error) result", async () => {
    const http = makeHttp({
      request: vi.fn().mockResolvedValue({
        data: { organization: null, pattern: null, emails: [] },
      }),
    });
    const client = createHunterClient({ http, apiKey: "key" });

    const result = await client.domainSearch("obscure.io");
    expect(result.emails).toHaveLength(0);
  });

  it("passes maxRetries:0 to http so http does not auto-retry on 429", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: { emails: [] } });
    const http = makeHttp({ request: mockRequest });
    const client = createHunterClient({ http, apiKey: "key" });

    await client.domainSearch("acme.com");

    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining("domain-search"),
      expect.anything(),
      expect.objectContaining({ maxRetries: 0 }),
    );
  });

  it("retries on 403 (rate limit) and eventually throws HunterRateLimitError", async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const rateLimitError = new HttpError("forbidden", { status: 403 });
    const http = makeHttp({ request: vi.fn().mockRejectedValue(rateLimitError) });
    const client = createHunterClient({
      http,
      apiKey: "key",
      sleep: sleepMock,
      random: () => 0,
    });

    await expect(client.domainSearch("acme.com")).rejects.toBeInstanceOf(HunterRateLimitError);
    // 1 initial attempt + 3 retries = 4 total calls
    expect((http.request as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(4);
    expect(sleepMock).toHaveBeenCalledTimes(3);
  });

  it("throws HunterRateLimitError (retryable=true) after max retries", async () => {
    const http = makeHttp({
      request: vi.fn().mockRejectedValue(new HttpError("forbidden", { status: 403 })),
    });
    const client = createHunterClient({
      http,
      apiKey: "key",
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    const err = await client.domainSearch("acme.com").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HunterRateLimitError);
    expect((err as HunterRateLimitError).retryable).toBe(true);
  });

  it("succeeds on 403 then ok (retry recovers)", async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const request = vi
      .fn()
      .mockRejectedValueOnce(new HttpError("forbidden", { status: 403 }))
      .mockResolvedValueOnce({ data: { organization: "Acme", pattern: null, emails: [] } });
    const client = createHunterClient({
      http: makeHttp({ request }),
      apiKey: "key",
      sleep: sleepMock,
      random: () => 0,
    });

    const result = await client.domainSearch("acme.com");
    expect(result.organization).toBe("Acme");
    expect(request).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledTimes(1);
  });

  it("throws HunterQuotaExhaustedError (retryable=false) on 429", async () => {
    const http = makeHttp({
      request: vi.fn().mockRejectedValue(new HttpError("too many requests", { status: 429 })),
    });
    const client = createHunterClient({ http, apiKey: "key" });

    const err = await client.domainSearch("acme.com").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HunterQuotaExhaustedError);
    expect((err as HunterQuotaExhaustedError).retryable).toBe(false);
    // Does NOT retry on 429
    expect((http.request as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("re-throws non-403/429 HttpErrors unchanged", async () => {
    const serverErr = new HttpError("internal server error", { status: 500 });
    const http = makeHttp({ request: vi.fn().mockRejectedValue(serverErr) });
    const client = createHunterClient({ http, apiKey: "key" });

    await expect(client.domainSearch("acme.com")).rejects.toBe(serverErr);
  });
});
