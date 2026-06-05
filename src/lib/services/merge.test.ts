import { describe, expect, it } from "vitest";

import { merge, type MergeInput, type SourceContact } from "./merge";

function makeAi(overrides: Partial<SourceContact> = {}): SourceContact {
  return {
    source: "ai",
    fullName: null,
    firstName: null,
    lastName: null,
    title: null,
    email: null,
    emailConfidence: null,
    emailVerification: null,
    seniority: null,
    department: null,
    phone: null,
    linkedinUrl: null,
    instagramUrl: null,
    twitterUrl: null,
    facebookUrl: null,
    raw: {},
    ...overrides,
  };
}

function makeHunter(overrides: Partial<SourceContact> = {}): SourceContact {
  return makeAi({ source: "hunter", ...overrides });
}

// Two contacts with the same name (no email) — the minimum setup for a merged group.
function samePerson(
  aiOverrides: Partial<SourceContact> = {},
  hunterOverrides: Partial<SourceContact> = {},
) {
  return {
    ai: makeAi({ firstName: "Jane", lastName: "Doe", ...aiOverrides }),
    hunter: makeHunter({ firstName: "Jane", lastName: "Doe", ...hunterOverrides }),
  };
}

const emptyInput: MergeInput = { ai: [], hunter: [] };

describe("merge — empty inputs", () => {
  it("returns empty when both sources are empty", () => {
    expect(merge(emptyInput)).toEqual([]);
  });
});

describe("merge — email identity match", () => {
  it("matches AI and Hunter contacts with the same email (case-insensitive) into one person", () => {
    const ai = makeAi({
      email: "jane@acme.com",
      fullName: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
    });
    const hunter = makeHunter({
      email: "JANE@ACME.COM",
      fullName: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
    });

    const result = merge({ ai: [ai], hunter: [hunter] });

    expect(result).toHaveLength(1);
    expect(result[0]!.members).toHaveLength(2);
  });

  it("produces two separate persons when emails do not match and names differ", () => {
    const ai = makeAi({ email: "alice@acme.com" });
    const hunter = makeHunter({ email: "bob@acme.com" });

    expect(merge({ ai: [ai], hunter: [hunter] })).toHaveLength(2);
  });
});

describe("merge — name+initial identity match", () => {
  it("matches contacts with same last_name + first_initial when email is missing", () => {
    const ai = makeAi({ firstName: "Jane", lastName: "Doe" });
    const hunter = makeHunter({ firstName: "Jane", lastName: "Doe" });

    const result = merge({ ai: [ai], hunter: [hunter] });
    expect(result).toHaveLength(1);
    expect(result[0]!.members).toHaveLength(2);
  });

  it("does not match when last names differ", () => {
    const ai = makeAi({ firstName: "Jane", lastName: "Smith" });
    const hunter = makeHunter({ firstName: "Jane", lastName: "Doe" });

    expect(merge({ ai: [ai], hunter: [hunter] })).toHaveLength(2);
  });

  it("does not match when first initials differ", () => {
    // Alice (A) vs Bob (B): different initials → different people
    const ai = makeAi({ firstName: "Alice", lastName: "Smith" });
    const hunter = makeHunter({ firstName: "Bob", lastName: "Smith" });

    expect(merge({ ai: [ai], hunter: [hunter] })).toHaveLength(2);
  });

  it("matches when first initials match even if full first names differ", () => {
    // Same person — Hunter may store 'J. Doe' while AI finds 'Jane Doe'
    const ai = makeAi({ firstName: "Jane", lastName: "Doe" });
    const hunter = makeHunter({ firstName: "J", lastName: "Doe" });

    expect(merge({ ai: [ai], hunter: [hunter] })).toHaveLength(1);
  });

  it("matches when one has email and the other does not, but names match", () => {
    // AI found no email; Hunter found the same person by domain search
    const ai = makeAi({ firstName: "Jane", lastName: "Doe" });
    const hunter = makeHunter({ firstName: "Jane", lastName: "Doe", email: "jane@acme.com" });

    expect(merge({ ai: [ai], hunter: [hunter] })).toHaveLength(1);
  });
});

describe("merge — email field precedence (§6.3)", () => {
  // Tests use one side with null email + name match to put both in the same group,
  // then verify which source's email is selected.

  it("uses Hunter email when Hunter has one (AI has no email)", () => {
    const { ai, hunter } = samePerson({}, { email: "hunter@acme.com", emailVerification: "valid" });

    const result = merge({ ai: [ai], hunter: [hunter] });
    expect(result[0]!.email).toBe("hunter@acme.com");
    expect(result[0]!.fieldSources.email).toBe("hunter");
  });

  it("picks the verified Hunter contact when two Hunter contacts share the same email", () => {
    // Hunter domain-search can return duplicate entries; same email → identity match → one person.
    const h1 = makeHunter({
      email: "j@acme.com",
      emailVerification: "accept_all",
      emailConfidence: 60,
    });
    const h2 = makeHunter({ email: "j@acme.com", emailVerification: "valid", emailConfidence: 92 });

    const result = merge({ ai: [], hunter: [h1, h2] });
    expect(result).toHaveLength(1);
    expect(result[0]!.email).toBe("j@acme.com");
    expect(result[0]!.emailVerification).toBe("valid");
    expect(result[0]!.emailConfidence).toBe(92);
  });

  it("uses Hunter email even when confidence is low (AI has no email)", () => {
    // Low-confidence Hunter email is still preferred over having no email at all.
    const { ai, hunter } = samePerson({}, { email: "hunter@acme.com", emailConfidence: 30 });

    const result = merge({ ai: [ai], hunter: [hunter] });
    expect(result[0]!.email).toBe("hunter@acme.com");
  });

  it("falls back to AI email only when Hunter has no email", () => {
    const { ai, hunter } = samePerson({ email: "ai@acme.com" }, {});

    const result = merge({ ai: [ai], hunter: [hunter] });
    expect(result[0]!.email).toBe("ai@acme.com");
    expect(result[0]!.fieldSources.email).toBe("ai");
  });

  it("email is null when neither source has one", () => {
    const result = merge({
      ai: [makeAi({ firstName: "X", lastName: "Y" })],
      hunter: [makeHunter({ firstName: "X", lastName: "Y" })],
    });
    expect(result[0]!.email).toBeNull();
    expect(result[0]!.fieldSources.email).toBeUndefined();
  });
});

describe("merge — Hunter-wins structured fields (§6.3)", () => {
  it("title: Hunter wins over AI", () => {
    const { ai, hunter } = samePerson({ title: "Manager" }, { title: "Chief Executive Officer" });

    const result = merge({ ai: [ai], hunter: [hunter] });
    expect(result[0]!.title).toBe("Chief Executive Officer");
    expect(result[0]!.fieldSources.title).toBe("hunter");
  });

  it("title: AI used when Hunter has none", () => {
    const { ai, hunter } = samePerson({ title: "Manager" }, { title: null });

    const result = merge({ ai: [ai], hunter: [hunter] });
    expect(result[0]!.title).toBe("Manager");
    expect(result[0]!.fieldSources.title).toBe("ai");
  });

  it("seniority: Hunter wins", () => {
    const { ai, hunter } = samePerson({ seniority: "mid" }, { seniority: "executive" });

    expect(merge({ ai: [ai], hunter: [hunter] })[0]!.seniority).toBe("executive");
  });

  it("department: Hunter wins", () => {
    const { ai, hunter } = samePerson({ department: "Operations" }, { department: "executive" });

    expect(merge({ ai: [ai], hunter: [hunter] })[0]!.department).toBe("executive");
  });

  it("emailConfidence and emailVerification: only from Hunter", () => {
    const { ai, hunter } = samePerson(
      {},
      { email: "j@acme.com", emailConfidence: 90, emailVerification: "valid" },
    );

    const result = merge({ ai: [ai], hunter: [hunter] })[0]!;
    expect(result.emailConfidence).toBe(90);
    expect(result.emailVerification).toBe("valid");
    expect(result.fieldSources.email_confidence).toBe("hunter");
    expect(result.fieldSources.email_verification).toBe("hunter");
  });

  it("phone: Hunter only", () => {
    const { ai, hunter } = samePerson({ phone: null }, { phone: "+1-555-0100" });

    expect(merge({ ai: [ai], hunter: [hunter] })[0]!.phone).toBe("+1-555-0100");
    expect(merge({ ai: [ai], hunter: [hunter] })[0]!.fieldSources.phone).toBe("hunter");
  });
});

describe("merge — social field precedence (§6.3)", () => {
  it("linkedinUrl: prefers AI, falls back to Hunter", () => {
    const { ai, hunter } = samePerson(
      { linkedinUrl: "https://linkedin.com/ai" },
      { linkedinUrl: "https://linkedin.com/hunter" },
    );
    expect(merge({ ai: [ai], hunter: [hunter] })[0]!.linkedinUrl).toBe("https://linkedin.com/ai");
    expect(merge({ ai: [ai], hunter: [hunter] })[0]!.fieldSources.linkedin_url).toBe("ai");
  });

  it("linkedinUrl: uses Hunter when AI has none", () => {
    const { ai, hunter } = samePerson(
      { linkedinUrl: null },
      { linkedinUrl: "https://linkedin.com/hunter" },
    );
    expect(merge({ ai: [ai], hunter: [hunter] })[0]!.linkedinUrl).toBe(
      "https://linkedin.com/hunter",
    );
    expect(merge({ ai: [ai], hunter: [hunter] })[0]!.fieldSources.linkedin_url).toBe("hunter");
  });

  it("twitterUrl: prefers AI, falls back to Hunter", () => {
    const { ai, hunter } = samePerson(
      { twitterUrl: null },
      { twitterUrl: "https://twitter.com/hunter" },
    );
    expect(merge({ ai: [ai], hunter: [hunter] })[0]!.twitterUrl).toBe("https://twitter.com/hunter");
  });

  it("instagramUrl: AI only (no Hunter fallback)", () => {
    const { ai, hunter } = samePerson(
      { instagramUrl: null },
      { instagramUrl: "https://instagram.com/hunter" },
    );
    // Hunter's instagram is ignored; AI has none → null
    expect(merge({ ai: [ai], hunter: [hunter] })[0]!.instagramUrl).toBeNull();
  });

  it("facebookUrl: AI only (no Hunter fallback)", () => {
    const { ai, hunter } = samePerson(
      { facebookUrl: null },
      { facebookUrl: "https://fb.com/hunter" },
    );
    expect(merge({ ai: [ai], hunter: [hunter] })[0]!.facebookUrl).toBeNull();
  });
});

describe("merge — name precedence by winning email source (§6.3)", () => {
  it("full_name comes from Hunter when Hunter email wins", () => {
    // AI has no email → Hunter's email wins → Hunter's name is preferred
    const ai = makeAi({ firstName: "Jane", lastName: "Doe", fullName: "Jane AI", email: null });
    const hunter = makeHunter({
      firstName: "Jane",
      lastName: "Doe",
      fullName: "Jane Hunter",
      email: "hunter@acme.com",
    });

    const result = merge({ ai: [ai], hunter: [hunter] })[0]!;
    expect(result.fullName).toBe("Jane Hunter");
    expect(result.fieldSources.full_name).toBe("hunter");
  });

  it("full_name comes from AI when AI email wins (Hunter has no email)", () => {
    const ai = makeAi({
      email: "ai@acme.com",
      fullName: "Jane AI",
      firstName: "Jane",
      lastName: "Doe",
    });
    const hunter = makeHunter({
      email: null,
      fullName: "Jane Hunter",
      firstName: "Jane",
      lastName: "Doe",
    });

    const result = merge({ ai: [ai], hunter: [hunter] })[0]!;
    expect(result.fullName).toBe("Jane AI");
    expect(result.fieldSources.full_name).toBe("ai");
  });

  it("falls back to Hunter name when winning-source name is null", () => {
    // Hunter wins email; Hunter's fullName is available; AI's fullName is null
    const ai = makeAi({ email: null, fullName: null, firstName: "Jane", lastName: "Doe" });
    const hunter = makeHunter({
      email: "hunter@acme.com",
      fullName: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
    });

    const result = merge({ ai: [ai], hunter: [hunter] })[0]!;
    expect(result.fullName).toBe("Jane Doe");
  });
});

describe("merge — null inputs (pre-normalized at client boundary)", () => {
  it("handles a contact where all fields are null", () => {
    const ai = makeAi({ firstName: "Jane", lastName: "Doe" });
    const result = merge({ ai: [ai], hunter: [] });
    expect(result).toHaveLength(1);
    expect(result[0]!.email).toBeNull();
    expect(result[0]!.linkedinUrl).toBeNull();
    expect(result[0]!.fieldSources).not.toHaveProperty("email");
  });
});

describe("merge — single-source persons", () => {
  it("returns one merged person per AI contact when there are no Hunter contacts", () => {
    const ai1 = makeAi({ email: "alice@a.com", fullName: "Alice A" });
    const ai2 = makeAi({ email: "bob@a.com", fullName: "Bob B" });

    const result = merge({ ai: [ai1, ai2], hunter: [] });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.email)).toEqual(
      expect.arrayContaining(["alice@a.com", "bob@a.com"]),
    );
  });

  it("returns one merged person per Hunter contact when there are no AI contacts", () => {
    const h1 = makeHunter({ email: "h1@x.com", fullName: "H One" });
    const h2 = makeHunter({ email: "h2@x.com", fullName: "H Two" });

    const result = merge({ ai: [], hunter: [h1, h2] });
    expect(result).toHaveLength(2);
    // winningSource is hunter since there is no AI
    for (const person of result) {
      expect(person.winningSource).toBe("hunter");
    }
  });
});

describe("merge — fieldSources correctness", () => {
  it("only includes non-null fields in fieldSources", () => {
    const { ai, hunter } = samePerson(
      { title: null, linkedinUrl: "https://li.com/a" },
      { title: null },
    );

    const { fieldSources } = merge({ ai: [ai], hunter: [hunter] })[0]!;
    expect(fieldSources).not.toHaveProperty("title");
    expect(fieldSources).toHaveProperty("linkedin_url", "ai");
  });

  it("records the correct source for each winning field in a full merge", () => {
    const ai = makeAi({
      firstName: "Jane",
      lastName: "Doe",
      email: null,
      linkedinUrl: "https://li.com/ai",
      instagramUrl: "https://ig.com/ai",
    });
    const hunter = makeHunter({
      firstName: "Jane",
      lastName: "Doe",
      email: "j@acme.com",
      emailConfidence: 92,
      emailVerification: "valid",
      title: "CEO",
      phone: "+1-555-0100",
    });

    const { fieldSources } = merge({ ai: [ai], hunter: [hunter] })[0]!;
    expect(fieldSources.email).toBe("hunter");
    expect(fieldSources.email_confidence).toBe("hunter");
    expect(fieldSources.email_verification).toBe("hunter");
    expect(fieldSources.title).toBe("hunter");
    expect(fieldSources.phone).toBe("hunter");
    expect(fieldSources.linkedin_url).toBe("ai");
    expect(fieldSources.instagram_url).toBe("ai");
  });
});
