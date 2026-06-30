import { beforeEach, describe, expect, it, vi } from "vitest";

const { directDb, drizzleHttpMock, drizzlePgMock, httpDb, neonMock, postgresMock } = vi.hoisted(
  () => {
    const httpDb = { kind: "http-db" };
    const directDb = { kind: "direct-db" };
    return {
      directDb,
      drizzleHttpMock: vi.fn(() => httpDb),
      drizzlePgMock: vi.fn(() => directDb),
      httpDb,
      neonMock: vi.fn(() => "neon-client"),
      postgresMock: vi.fn(() => "postgres-client"),
    };
  },
);

vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));
vi.mock("drizzle-orm/neon-http", () => ({ drizzle: drizzleHttpMock }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: drizzlePgMock }));
vi.mock("postgres", () => ({ default: postgresMock }));

beforeEach(() => {
  vi.resetModules();
  neonMock.mockClear();
  postgresMock.mockClear();
  drizzleHttpMock.mockClear();
  drizzlePgMock.mockClear();
});

describe("DB client lazy factories", () => {
  it("does not initialize either DB client on module import", async () => {
    await import("./client");

    expect(neonMock).not.toHaveBeenCalled();
    expect(postgresMock).not.toHaveBeenCalled();
    expect(drizzleHttpMock).not.toHaveBeenCalled();
    expect(drizzlePgMock).not.toHaveBeenCalled();
  });

  it("initializes the pooled HTTP client once on first getDb call", async () => {
    const { getDb } = await import("./client");

    const first = getDb();
    const second = getDb();

    expect(first).toBe(httpDb);
    expect(second).toBe(httpDb);
    expect(neonMock).toHaveBeenCalledTimes(1);
    expect(drizzleHttpMock).toHaveBeenCalledTimes(1);
    expect(drizzleHttpMock).toHaveBeenCalledWith(
      "neon-client",
      expect.objectContaining({ schema: expect.any(Object) }),
    );
    expect(postgresMock).not.toHaveBeenCalled();
    expect(drizzlePgMock).not.toHaveBeenCalled();
  });

  it("initializes the direct transaction-capable client once on first getDbDirect call", async () => {
    const { getDbDirect } = await import("./client");

    const first = getDbDirect();
    const second = getDbDirect();

    expect(first).toBe(directDb);
    expect(second).toBe(directDb);
    expect(postgresMock).toHaveBeenCalledTimes(1);
    expect(postgresMock).toHaveBeenCalledWith("postgresql://test:test@localhost/test", {
      prepare: false,
    });
    expect(drizzlePgMock).toHaveBeenCalledTimes(1);
    expect(drizzlePgMock).toHaveBeenCalledWith(
      "postgres-client",
      expect.objectContaining({ schema: expect.any(Object) }),
    );
    expect(neonMock).not.toHaveBeenCalled();
    expect(drizzleHttpMock).not.toHaveBeenCalled();
  });
});
