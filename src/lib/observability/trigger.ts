import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "./scrub";

let sentryInitialized = false;

function ensureSentry(): void {
  if (sentryInitialized || !process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
    beforeSend: scrubEvent,
  });
  sentryInitialized = true;
}

export async function captureTriggerFailure(params: {
  readonly taskId: string;
  readonly payload: unknown;
  readonly error: unknown;
  readonly runId?: string;
}): Promise<void> {
  ensureSentry();
  Sentry.withScope((scope) => {
    scope.setTag("trigger.task_id", params.taskId);
    if (params.runId) scope.setTag("trigger.run_id", params.runId);
    scope.setContext("trigger", {
      taskId: params.taskId,
      runId: params.runId,
      payload: params.payload,
    });
    Sentry.captureException(params.error);
  });
  await Sentry.flush(2_000);
}
