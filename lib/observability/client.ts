import { getObservabilityBaseConfig } from "@/lib/observability/shared";

export function getClientObservabilityConfig() {
  return getObservabilityBaseConfig({
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_APP_RELEASE: process.env.NEXT_PUBLIC_APP_RELEASE,
    NEXT_PUBLIC_DISABLE_OBSERVABILITY: process.env.NEXT_PUBLIC_DISABLE_OBSERVABILITY,
    NODE_ENV: process.env.NODE_ENV,
    SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    SENTRY_DSN: undefined,
    APP_RELEASE: undefined,
  });
}
