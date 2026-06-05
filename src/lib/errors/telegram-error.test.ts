import { describe, expect, it } from "vitest";

import { TelegramApiError } from "./telegram-error";

describe("TelegramApiError", () => {
  it("sets the correct error code", () => {
    const error = new TelegramApiError("something went wrong");
    expect(error.code).toBe("TELEGRAM_API_ERROR");
  });

  it("is not retryable", () => {
    const error = new TelegramApiError("something went wrong");
    expect(error.retryable).toBe(false);
  });

  it("sets name to the class name", () => {
    const error = new TelegramApiError("something went wrong");
    expect(error.name).toBe("TelegramApiError");
  });

  it("carries context when provided", () => {
    const error = new TelegramApiError("method failed", { context: { method: "sendMessage" } });
    expect(error.context).toMatchObject({ method: "sendMessage" });
  });

  it("is an instance of Error", () => {
    expect(new TelegramApiError("test")).toBeInstanceOf(Error);
  });
});
