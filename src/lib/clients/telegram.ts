import { z } from "zod";

import { TelegramApiError } from "@/lib/errors/telegram-error";

import type { HttpClient } from "./http";

const TELEGRAM_API_BASE = "https://api.telegram.org";

// Telegram always returns HTTP 200 with ok:false for logical errors.
const telegramResponseSchema = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  error_code: z.number().optional(),
  description: z.string().optional(),
});

const sendMessageResultSchema = z.object({
  message_id: z.number(),
});

export interface InlineKeyboardButton {
  readonly text: string;
  readonly callback_data: string;
}

export interface InlineKeyboardMarkup {
  readonly inline_keyboard: readonly (readonly InlineKeyboardButton[])[];
}

export interface TelegramClientDeps {
  readonly http: HttpClient;
  readonly botToken: string;
}

export interface TelegramClient {
  sendMessage(params: {
    chatId: string | number;
    text: string;
    replyMarkup?: InlineKeyboardMarkup;
  }): Promise<{ messageId: number }>;

  editMessageText(params: {
    chatId: string | number;
    messageId: number;
    text: string;
  }): Promise<void>;

  answerCallbackQuery(params: { callbackQueryId: string; text?: string }): Promise<void>;
}

export function createTelegramClient({ http, botToken }: TelegramClientDeps): TelegramClient {
  // Token is in the URL path, not in context, so it is never logged or sent to Sentry.
  function apiUrl(method: string): string {
    return `${TELEGRAM_API_BASE}/bot${botToken}/${method}`;
  }

  async function callApi<T>(
    method: string,
    body: Record<string, unknown>,
    resultSchema: z.ZodType<T>,
  ): Promise<T> {
    const raw = await http.request<unknown>(
      apiUrl(method),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      { context: { method } },
    );
    const parsedResult = telegramResponseSchema.safeParse(raw);
    if (!parsedResult.success) {
      throw new TelegramApiError(`Telegram ${method} returned an invalid response`, {
        context: { method },
        cause: parsedResult.error,
      });
    }
    const parsed = parsedResult.data;
    if (!parsed.ok) {
      throw new TelegramApiError(
        `Telegram ${method} failed: ${parsed.description ?? "unknown error"}`,
        { context: { method, errorCode: parsed.error_code } },
      );
    }
    const result = resultSchema.safeParse(parsed.result);
    if (!result.success) {
      throw new TelegramApiError(`Telegram ${method} result failed validation`, {
        context: { method },
        cause: result.error,
      });
    }
    return result.data;
  }

  return {
    async sendMessage({ chatId, text, replyMarkup }) {
      const body: Record<string, unknown> = { chat_id: chatId, text };
      if (replyMarkup !== undefined) body.reply_markup = replyMarkup;
      const result = await callApi("sendMessage", body, sendMessageResultSchema);
      return { messageId: result.message_id };
    },

    async editMessageText({ chatId, messageId, text }) {
      await callApi(
        "editMessageText",
        { chat_id: chatId, message_id: messageId, text },
        z.unknown(),
      );
    },

    async answerCallbackQuery({ callbackQueryId, text }) {
      const body: Record<string, unknown> = { callback_query_id: callbackQueryId };
      if (text !== undefined) body.text = text;
      await callApi("answerCallbackQuery", body, z.unknown());
    },
  };
}
