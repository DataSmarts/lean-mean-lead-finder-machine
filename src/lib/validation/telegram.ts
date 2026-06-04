import { z } from "zod";

const telegramUserSchema = z.object({
  id: z.number(),
  username: z.string().optional(),
});

const telegramChatSchema = z.object({
  id: z.number(),
});

const telegramMessageSchema = z.object({
  message_id: z.number(),
  chat: telegramChatSchema,
});

const telegramCallbackQuerySchema = z.object({
  id: z.string(),
  from: telegramUserSchema,
  message: telegramMessageSchema,
  data: z.string(),
});

// Telegram sends many update types; we only care about callback_query (inline button taps).
export const telegramUpdateSchema = z.object({
  update_id: z.number(),
  callback_query: telegramCallbackQuerySchema.optional(),
});

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
export type TelegramCallbackQuery = z.infer<typeof telegramCallbackQuerySchema>;

export type CallbackAction = "approve" | "reject";

export interface ParsedCallbackData {
  readonly action: CallbackAction;
  readonly approvalToken: string;
}

const CALLBACK_RE = /^(approve|reject):(.+)$/;

// Parses callback_data of the form "approve:<token>" or "reject:<token>".
// Returns null for any other format (graceful ignore).
export function parseCallbackData(data: string): ParsedCallbackData | null {
  const match = CALLBACK_RE.exec(data);
  if (!match) return null;
  return { action: match[1] as CallbackAction, approvalToken: match[2]! };
}
