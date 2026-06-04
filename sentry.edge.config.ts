import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/observability/scrub";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  beforeSend: scrubEvent,
});
