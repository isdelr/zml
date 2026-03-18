import * as Sentry from "@sentry/nextjs";
import { getEdgeObservabilityConfig } from "@/lib/observability/server";

const config = getEdgeObservabilityConfig();

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
        runtime: "edge",
      };
      return event;
    },
  });
}
