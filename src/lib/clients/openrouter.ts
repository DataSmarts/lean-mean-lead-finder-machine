import { z } from "zod";

import { AiOutputParseError } from "@/lib/errors/ai-error";

import type { HttpClient } from "./http";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Retry parse failures (model non-determinism) up to this many additional times.
const MAX_PARSE_RETRIES = 2;

// JSON schema for the structured-output response. `strict: true` + `additionalProperties: false`
// is required per OpenRouter's structured-output docs.
const LEAD_CONTACT_SCHEMA = {
  type: "object",
  properties: {
    full_name: { type: "string" },
    first_name: { type: "string" },
    last_name: { type: "string" },
    title: { type: "string" },
    email: { type: "string" },
    linkedin_url: { type: "string" },
    instagram_url: { type: "string" },
    twitter_url: { type: "string" },
    facebook_url: { type: "string" },
  },
  required: [
    "full_name",
    "first_name",
    "last_name",
    "title",
    "email",
    "linkedin_url",
    "instagram_url",
    "twitter_url",
    "facebook_url",
  ],
  additionalProperties: false,
} as const;

// Raw shape returned by the model (before "NA" normalization).
const leadRawSchema = z.object({
  full_name: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  title: z.string(),
  email: z.string(),
  linkedin_url: z.string(),
  instagram_url: z.string(),
  twitter_url: z.string(),
  facebook_url: z.string(),
});

const completionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() }),
      }),
    )
    .min(1),
});

// "NA" is the sentinel the model is instructed to return for unknown fields.
function normalizeNa(value: string): string | null {
  return value === "NA" ? null : value;
}

export interface OpenRouterContact {
  readonly fullName: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly title: string | null;
  readonly email: string | null;
  readonly linkedinUrl: string | null;
  readonly instagramUrl: string | null;
  readonly twitterUrl: string | null;
  readonly facebookUrl: string | null;
}

export interface ResearchLeadParams {
  readonly businessName: string;
  readonly websiteUri: string | null;
  readonly address: string | null;
}

export interface OpenRouterClientDeps {
  readonly http: HttpClient;
  readonly apiKey: string;
  readonly model: string;
}

export interface OpenRouterClient {
  // Returns null when the model cannot identify any contact (all fields are "NA").
  researchLead(params: ResearchLeadParams): Promise<OpenRouterContact | null>;
}

const SYSTEM_PROMPT =
  "You are a business lead researcher. Given a business name, website URL, and physical address, " +
  "identify the most likely executive or decision-maker contact. Return their information in the JSON " +
  'format provided. For any field you cannot determine with confidence, use the exact string "NA".';

function buildUserMessage({ businessName, websiteUri, address }: ResearchLeadParams): string {
  return (
    `Business: ${businessName}\n` +
    `Website: ${websiteUri ?? "Not available"}\n` +
    `Address: ${address ?? "Not available"}`
  );
}

export function createOpenRouterClient({
  http,
  apiKey,
  model,
}: OpenRouterClientDeps): OpenRouterClient {
  async function callCompletion(params: ResearchLeadParams): Promise<string> {
    const body = {
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(params) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lead_contact",
          strict: true,
          schema: LEAD_CONTACT_SCHEMA,
        },
      },
    };
    const raw = await http.request<unknown>(
      OPENROUTER_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      { context: { businessName: params.businessName } },
    );
    const parsed = completionResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AiOutputParseError("OpenRouter response envelope failed schema validation", {
        cause: parsed.error,
        context: { businessName: params.businessName },
      });
    }
    return parsed.data.choices[0]!.message.content;
  }

  function parseContent(content: string, businessName: string): OpenRouterContact | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (cause) {
      throw new AiOutputParseError("OpenRouter returned invalid JSON", {
        cause,
        context: { businessName },
      });
    }
    const validatedResult = leadRawSchema.safeParse(parsed);
    if (!validatedResult.success) {
      throw new AiOutputParseError("OpenRouter content failed schema validation", {
        cause: validatedResult.error,
        context: { businessName },
      });
    }
    const validated = validatedResult.data;
    const contact: OpenRouterContact = {
      fullName: normalizeNa(validated.full_name),
      firstName: normalizeNa(validated.first_name),
      lastName: normalizeNa(validated.last_name),
      title: normalizeNa(validated.title),
      email: normalizeNa(validated.email),
      linkedinUrl: normalizeNa(validated.linkedin_url),
      instagramUrl: normalizeNa(validated.instagram_url),
      twitterUrl: normalizeNa(validated.twitter_url),
      facebookUrl: normalizeNa(validated.facebook_url),
    };
    // If the model found no person at all, return null.
    if (!contact.fullName && !contact.firstName && !contact.lastName) return null;
    return contact;
  }

  async function researchLeadWithRetry(
    params: ResearchLeadParams,
    attempt: number,
  ): Promise<OpenRouterContact | null> {
    const content = await callCompletion(params);
    try {
      return parseContent(content, params.businessName);
    } catch (cause) {
      if (attempt < MAX_PARSE_RETRIES) {
        return researchLeadWithRetry(params, attempt + 1);
      }
      if (cause instanceof AiOutputParseError) throw cause;
      throw new AiOutputParseError("OpenRouter response failed schema validation after retries", {
        cause,
        context: { businessName: params.businessName },
      });
    }
  }

  return {
    researchLead(params) {
      return researchLeadWithRetry(params, 0);
    },
  };
}
