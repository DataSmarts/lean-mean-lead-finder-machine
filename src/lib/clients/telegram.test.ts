import { describe, expect, it, vi } from "vitest";

import { TelegramApiError } from "@/lib/errors/telegram-error";

import type { HttpClient } from "./http";
import { createTelegramClient } from "./telegram";

function fakeHttp(body: unknown): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue(body);
  return { http: { request }, request };
}

const BOT_TOKEN = "1234567890:test-token";

describe("createTelegramClient.sendMessage", () => {
  it("returns the messageId from a successful response", async () => {
    const { http } = fakeHttp({ ok: true, result: { message_id: 42 } });
    const client = createTelegramClient({ http, botToken: BOT_TOKEN });

    expect(await client.sendMessage({ chatId: "999", text: "Hello" })).toEqual({ messageId: 42 });
  });

  it("posts to the sendMessage endpoint with the correct body", async () => {
    const { http, request } = fakeHttp({ ok: true, result: { message_id: 1 } });
    const client = createTelegramClient({ http, botToken: BOT_TOKEN });

    await client.sendMessage({ chatId: 123, text: "Hi" });

    const [url, init] = request.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({ chat_id: 123, text: "Hi" });
  });

  it("includes reply_markup when provided", async () => {
    const { http, request } = fakeHttp({ ok: true, result: { message_id: 1 } });
    const client = createTelegramClient({ http, botToken: BOT_TOKEN });
    const replyMarkup = { inline_keyboard: [[{ text: "Yes", callback_data: "approve:tok" }]] };

    await client.sendMessage({ chatId: "1", text: "Approve?", replyMarkup });

    const body = JSON.parse((request.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.reply_markup).toEqual(replyMarkup);
  });

  it("omits reply_markup when not provided", async () => {
    const { http, request } = fakeHttp({ ok: true, result: { message_id: 1 } });
    const client = createTelegramClient({ http, botToken: BOT_TOKEN });

    await client.sendMessage({ chatId: "1", text: "Hi" });

    const body = JSON.parse((request.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.reply_markup).toBeUndefined();
  });

  it("throws TelegramApiError when ok is false", async () => {
    const { http } = fakeHttp({ ok: false, error_code: 400, description: "Bad Request" });
    const client = createTelegramClient({ http, botToken: BOT_TOKEN });

    await expect(client.sendMessage({ chatId: "1", text: "Hi" })).rejects.toBeInstanceOf(
      TelegramApiError,
    );
  });

  it("TelegramApiError carries the method and error_code in context", async () => {
    const { http } = fakeHttp({ ok: false, error_code: 400, description: "Bad Request" });
    const client = createTelegramClient({ http, botToken: BOT_TOKEN });

    const err = await client.sendMessage({ chatId: "1", text: "Hi" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TelegramApiError);
    const apiErr = err as TelegramApiError;
    expect(apiErr.context).toMatchObject({ method: "sendMessage", errorCode: 400 });
  });
});

describe("createTelegramClient.editMessageText", () => {
  it("resolves without error on success", async () => {
    const { http } = fakeHttp({ ok: true, result: true });
    const client = createTelegramClient({ http, botToken: BOT_TOKEN });

    await expect(
      client.editMessageText({ chatId: 123, messageId: 42, text: "✅ Approved" }),
    ).resolves.toBeUndefined();
  });

  it("posts to editMessageText with chat_id and message_id", async () => {
    const { http, request } = fakeHttp({ ok: true, result: true });
    const client = createTelegramClient({ http, botToken: BOT_TOKEN });

    await client.editMessageText({ chatId: 123, messageId: 42, text: "Done" });

    const [url, init] = request.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("editMessageText");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ chat_id: 123, message_id: 42, text: "Done" });
  });

  it("throws TelegramApiError when ok is false", async () => {
    const { http } = fakeHttp({ ok: false, error_code: 400, description: "Message not modified" });
    const client = createTelegramClient({ http, botToken: BOT_TOKEN });

    await expect(
      client.editMessageText({ chatId: 1, messageId: 1, text: "x" }),
    ).rejects.toBeInstanceOf(TelegramApiError);
  });
});

describe("createTelegramClient.answerCallbackQuery", () => {
  it("resolves without error on success", async () => {
    const { http } = fakeHttp({ ok: true, result: true });
    const client = createTelegramClient({ http, botToken: BOT_TOKEN });

    await expect(client.answerCallbackQuery({ callbackQueryId: "cbq-1" })).resolves.toBeUndefined();
  });

  it("sends callback_query_id in the body", async () => {
    const { http, request } = fakeHttp({ ok: true, result: true });
    const client = createTelegramClient({ http, botToken: BOT_TOKEN });

    await client.answerCallbackQuery({ callbackQueryId: "cbq-1", text: "OK" });

    const body = JSON.parse((request.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ callback_query_id: "cbq-1", text: "OK" });
  });

  it("omits text when not provided", async () => {
    const { http, request } = fakeHttp({ ok: true, result: true });
    const client = createTelegramClient({ http, botToken: BOT_TOKEN });

    await client.answerCallbackQuery({ callbackQueryId: "cbq-1" });

    const body = JSON.parse((request.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.text).toBeUndefined();
  });
});
