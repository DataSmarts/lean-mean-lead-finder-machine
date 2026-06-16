import { describe, expect, it, vi } from "vitest";

import { AiOutputParseError } from "@/lib/errors/ai-error";

import type { HttpClient } from "./http";
import { createOpenRouterClient } from "./openrouter";

function makeResponse(fields: Record<string, string>) {
  return {
    choices: [{ message: { content: JSON.stringify(fields) } }],
  };
}

const validFields = {
  full_name: "Jane Doe",
  first_name: "Jane",
  last_name: "Doe",
  title: "CEO",
  email: "jane@acme.com",
  linkedin_url: "https://linkedin.com/in/janedoe",
  instagram_url: "NA",
  twitter_url: "NA",
  facebook_url: "NA",
};

function makeHttp(overrides: Partial<HttpClient> = {}): HttpClient {
  return {
    request: vi.fn().mockResolvedValue(makeResponse(validFields)),
    ...overrides,
  };
}

const params = {
  businessName: "Acme Corp",
  websiteUri: "https://acme.com",
  address: "123 Main St",
};

describe("createOpenRouterClient.researchLead", () => {
  it("maps a valid response to OpenRouterContact", async () => {
    const client = createOpenRouterClient({ http: makeHttp(), apiKey: "key", model: "test-model" });

    const result = await client.researchLead(params);

    expect(result).not.toBeNull();
    expect(result!.fullName).toBe("Jane Doe");
    expect(result!.firstName).toBe("Jane");
    expect(result!.lastName).toBe("Doe");
    expect(result!.title).toBe("CEO");
    expect(result!.email).toBe("jane@acme.com");
    expect(result!.linkedinUrl).toBe("https://linkedin.com/in/janedoe");
  });

  it('normalizes "NA" fields to null at the client boundary', async () => {
    const client = createOpenRouterClient({ http: makeHttp(), apiKey: "key", model: "test-model" });

    const result = await client.researchLead(params);

    expect(result!.instagramUrl).toBeNull();
    expect(result!.twitterUrl).toBeNull();
    expect(result!.facebookUrl).toBeNull();
  });

  it('returns null when all name fields are "NA" (no person found)', async () => {
    const allNa = Object.fromEntries(Object.keys(validFields).map((k) => [k, "NA"]));
    const http = makeHttp({ request: vi.fn().mockResolvedValue(makeResponse(allNa)) });
    const client = createOpenRouterClient({ http, apiKey: "key", model: "test-model" });

    const result = await client.researchLead(params);
    expect(result).toBeNull();
  });

  it("sends Authorization header with Bearer token", async () => {
    const mockRequest = vi.fn().mockResolvedValue(makeResponse(validFields));
    const client = createOpenRouterClient({
      http: makeHttp({ request: mockRequest }),
      apiKey: "secret-key",
      model: "test-model",
    });

    await client.researchLead(params);

    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining("openrouter.ai"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer secret-key" }),
      }),
      expect.anything(),
    );
  });

  it("sends response_format with json_schema type", async () => {
    const mockRequest = vi.fn().mockResolvedValue(makeResponse(validFields));
    const client = createOpenRouterClient({
      http: makeHttp({ request: mockRequest }),
      apiKey: "key",
      model: "my-model",
    });

    await client.researchLead(params);

    const body = JSON.parse(
      (mockRequest.mock.calls[0] as Parameters<HttpClient["request"]>)[1]?.body as string,
    );
    expect(body.model).toBe("my-model");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
  });

  it("retries on invalid JSON and eventually throws AiOutputParseError", async () => {
    const mockRequest = vi
      .fn()
      .mockResolvedValue({ choices: [{ message: { content: "not json" } }] });
    const client = createOpenRouterClient({
      http: makeHttp({ request: mockRequest }),
      apiKey: "key",
      model: "m",
    });

    await expect(client.researchLead(params)).rejects.toBeInstanceOf(AiOutputParseError);
    // 1 initial + 2 retries = 3 total API calls
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it("retries on schema validation failure and eventually throws AiOutputParseError", async () => {
    const badPayload = { choices: [{ message: { content: JSON.stringify({ wrong: "shape" }) } }] };
    const mockRequest = vi.fn().mockResolvedValue(badPayload);
    const client = createOpenRouterClient({
      http: makeHttp({ request: mockRequest }),
      apiKey: "key",
      model: "m",
    });

    await expect(client.researchLead(params)).rejects.toBeInstanceOf(AiOutputParseError);
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it("wraps invalid completion envelopes in AiOutputParseError", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ choices: [] });
    const client = createOpenRouterClient({
      http: makeHttp({ request: mockRequest }),
      apiKey: "key",
      model: "m",
    });

    await expect(client.researchLead(params)).rejects.toBeInstanceOf(AiOutputParseError);
  });

  it("recovers if the second call returns valid JSON", async () => {
    const mockRequest = vi
      .fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: "bad json" } }] })
      .mockResolvedValueOnce(makeResponse(validFields));
    const client = createOpenRouterClient({
      http: makeHttp({ request: mockRequest }),
      apiKey: "key",
      model: "m",
    });

    const result = await client.researchLead(params);
    expect(result!.fullName).toBe("Jane Doe");
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
});
