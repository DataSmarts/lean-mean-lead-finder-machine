import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import type { TelegramClient } from "@/lib/clients/telegram";
import { createTelegramClient } from "@/lib/clients/telegram";
import type { ApprovalService } from "@/lib/services/approval";
import { createApprovalService } from "@/lib/services/approval";

import { POST } from "./route";

vi.mock("@/lib/services/approval", () => ({ createApprovalService: vi.fn() }));
vi.mock("@/lib/clients/telegram", () => ({ createTelegramClient: vi.fn() }));
vi.mock("@trigger.dev/sdk", () => ({
  wait: { completeToken: vi.fn().mockResolvedValue({ success: true }) },
}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/db/runs.repo", () => ({ makeRunsRepo: vi.fn() }));

function request(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return {
    json: async () => body,
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

const VALID_SECRET = "test-webhook-secret"; // matches vitest.config.ts env

const callbackQuery = {
  id: "cbq-1",
  from: { id: 111, username: "alice" },
  message: { message_id: 42, chat: { id: 987654321 } }, // matches TELEGRAM_CHAT_ID in vitest env
  data: "approve:some-approval-token",
};

const validUpdate = { update_id: 1, callback_query: callbackQuery };

function setupService(outcome: Awaited<ReturnType<ApprovalService["approve"]>>) {
  const approve = vi.fn().mockResolvedValue(outcome);
  const reject = vi.fn().mockResolvedValue(outcome);
  vi.mocked(createApprovalService).mockReturnValue({ approve, reject });
  return { approve, reject };
}

function setupTelegram() {
  const editMessageText = vi.fn().mockResolvedValue(undefined);
  const answerCallbackQuery = vi.fn().mockResolvedValue(undefined);
  const sendMessage = vi.fn().mockResolvedValue({ messageId: 1 });
  vi.mocked(createTelegramClient).mockReturnValue({
    editMessageText,
    answerCallbackQuery,
    sendMessage,
  } as unknown as TelegramClient);
  return { editMessageText, answerCallbackQuery };
}

describe("POST /api/telegram/webhook", () => {
  it("returns 401 when the secret header is missing", async () => {
    const res = await POST(request(validUpdate));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the secret header is wrong", async () => {
    const res = await POST(request(validUpdate, { "x-telegram-bot-api-secret-token": "bad" }));
    expect(res.status).toBe(401);
  });

  it("returns 200 for a non-callback update (e.g. a plain message)", async () => {
    const res = await POST(
      request({ update_id: 1 }, { "x-telegram-bot-api-secret-token": VALID_SECRET }),
    );
    expect(res.status).toBe(200);
  });

  it("returns 200 and answers the callback on an unrecognised callback_data prefix", async () => {
    setupTelegram();
    const { answerCallbackQuery } = setupTelegram();
    const update = {
      ...validUpdate,
      callback_query: { ...callbackQuery, data: "unknown:token" },
    };

    const res = await POST(request(update, { "x-telegram-bot-api-secret-token": VALID_SECRET }));

    expect(res.status).toBe(200);
    expect(answerCallbackQuery).toHaveBeenCalledWith({ callbackQueryId: "cbq-1" });
  });

  it("returns 200 and calls approve, editMessageText, answerCallbackQuery on applied approve", async () => {
    const { approve } = setupService({ status: "applied" });
    const { editMessageText, answerCallbackQuery } = setupTelegram();

    const res = await POST(
      request(validUpdate, { "x-telegram-bot-api-secret-token": VALID_SECRET }),
    );

    expect(res.status).toBe(200);
    expect(approve).toHaveBeenCalledWith(
      { approvalToken: "some-approval-token" },
      "telegram:alice",
    );
    expect(editMessageText).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: 987654321, messageId: 42 }),
    );
    expect(answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({ callbackQueryId: "cbq-1" }),
    );
  });

  it("calls reject service when the callback_data is reject:token", async () => {
    const { reject } = setupService({ status: "applied" });
    setupTelegram();
    const update = {
      ...validUpdate,
      callback_query: { ...callbackQuery, data: "reject:some-approval-token" },
    };

    await POST(request(update, { "x-telegram-bot-api-secret-token": VALID_SECRET }));

    expect(reject).toHaveBeenCalledWith({ approvalToken: "some-approval-token" }, "telegram:alice");
  });

  it("only answers the callback without editing when outcome is already_handled", async () => {
    setupService({ status: "already_handled" });
    const { editMessageText, answerCallbackQuery } = setupTelegram();

    const res = await POST(
      request(validUpdate, { "x-telegram-bot-api-secret-token": VALID_SECRET }),
    );

    expect(res.status).toBe(200);
    expect(editMessageText).not.toHaveBeenCalled();
    expect(answerCallbackQuery).toHaveBeenCalledWith({ callbackQueryId: "cbq-1" });
  });

  it("only answers the callback when outcome is not_found", async () => {
    setupService({ status: "not_found" });
    const { editMessageText, answerCallbackQuery } = setupTelegram();

    await POST(request(validUpdate, { "x-telegram-bot-api-secret-token": VALID_SECRET }));

    expect(editMessageText).not.toHaveBeenCalled();
    expect(answerCallbackQuery).toHaveBeenCalledWith({ callbackQueryId: "cbq-1" });
  });

  it("uses telegram:id as the by value when username is absent", async () => {
    const { approve } = setupService({ status: "applied" });
    setupTelegram();
    const update = {
      ...validUpdate,
      callback_query: { ...callbackQuery, from: { id: 999 } },
    };

    await POST(request(update, { "x-telegram-bot-api-secret-token": VALID_SECRET }));

    expect(approve).toHaveBeenCalledWith(expect.anything(), "telegram:999");
  });

  it("ignores callbacks from a different chat and answers the callback", async () => {
    const { approve } = setupService({ status: "applied" });
    const { answerCallbackQuery } = setupTelegram();
    const update = {
      ...validUpdate,
      callback_query: { ...callbackQuery, message: { message_id: 1, chat: { id: 11111 } } },
    };

    await POST(request(update, { "x-telegram-bot-api-secret-token": VALID_SECRET }));

    expect(approve).not.toHaveBeenCalled();
    expect(answerCallbackQuery).toHaveBeenCalledWith({ callbackQueryId: "cbq-1" });
  });
});
