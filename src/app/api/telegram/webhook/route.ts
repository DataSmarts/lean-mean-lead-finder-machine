import { wait } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createHttpClient } from "@/lib/clients/http";
import { createTelegramClient } from "@/lib/clients/telegram";
import { db } from "@/lib/db/client";
import { makeRunsRepo } from "@/lib/db/runs.repo";
import { env, webEnv } from "@/lib/env";
import { createApprovalService } from "@/lib/services/approval";
import { parseCallbackData, telegramUpdateSchema } from "@/lib/validation/telegram";

// Next.js must use the Node.js runtime for Trigger.dev SDK (wait.completeToken).
export const runtime = "nodejs";

const http = createHttpClient();

// Not authenticated by the proxy gate — secured by X-Telegram-Bot-Api-Secret-Token instead.
// See src/proxy.ts PUBLIC_API_PATHS.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== webEnv.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = telegramUpdateSchema.safeParse(body);
  if (!parsed.success || !parsed.data.callback_query) {
    return NextResponse.json({}, { status: 200 });
  }

  const cbq = parsed.data.callback_query;
  const telegram = createTelegramClient({ http, botToken: env.TELEGRAM_BOT_TOKEN });

  // Defense-in-depth: only process callbacks from the configured chat.
  if (String(cbq.message.chat.id) !== env.TELEGRAM_CHAT_ID) {
    await telegram.answerCallbackQuery({ callbackQueryId: cbq.id });
    return NextResponse.json({}, { status: 200 });
  }

  const callbackData = parseCallbackData(cbq.data);
  if (!callbackData) {
    await telegram.answerCallbackQuery({ callbackQueryId: cbq.id });
    return NextResponse.json({}, { status: 200 });
  }

  const by = cbq.from.username
    ? `telegram:${cbq.from.username}`
    : `telegram:${String(cbq.from.id)}`;

  const service = createApprovalService({
    runsRepo: makeRunsRepo(db),
    completeWaitpoint: (id, data) => wait.completeToken(id, data).then(() => undefined),
  });

  const outcome = await (callbackData.action === "approve"
    ? service.approve({ approvalToken: callbackData.approvalToken }, by)
    : service.reject({ approvalToken: callbackData.approvalToken }, by));

  if (outcome.status === "applied") {
    const label = callbackData.action === "approve" ? "✅ Approved" : "❌ Rejected";
    await telegram.editMessageText({
      chatId: cbq.message.chat.id,
      messageId: cbq.message.message_id,
      text: label,
    });
    await telegram.answerCallbackQuery({ callbackQueryId: cbq.id, text: label });
  } else {
    await telegram.answerCallbackQuery({ callbackQueryId: cbq.id });
  }

  return NextResponse.json({}, { status: 200 });
}
