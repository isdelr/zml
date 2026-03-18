"use client";

import * as Sentry from "@sentry/nextjs";
import { getClientObservabilityConfig } from "@/lib/observability/client";

const config = getClientObservabilityConfig();

if (config.enabled && config.dsn) {
  Sentry.init({
    dsn: config.dsn,
    enabled: config.enabled,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    integrations(defaultIntegrations) {
      return defaultIntegrations;
    },
    beforeSend(event) {
      event.tags = {
        ...event.tags,
        runtime: "browser",
      };
      return event;
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
