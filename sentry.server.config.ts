import * as Sentry from "@sentry/nextjs";
import { getServerObservabilityConfig } from "@/lib/observability/server";

const config = getServerObservabilityConfig();

if (config.enabled && config.dsn) {
  Sentry.init({
    dsn: config.dsn,
    enabled: config.enabled,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      event.tags = {
        ...event.tags,
        runtime: "nodejs",
      };
      return event;
    },
  });
}
