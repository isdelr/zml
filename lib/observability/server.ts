import "server-only";

import * as Sentry from "@sentry/nextjs";
import { getObservabilityBaseConfig } from "@/lib/observability/shared";

export function getServerObservabilityConfig() {
  return getObservabilityBaseConfig(process.env);
}

export function getEdgeObservabilityConfig() {
  return getObservabilityBaseConfig(process.env);
}

type CaptureServerExceptionOptions = {
  tags?: Record<string, string>;
  extras?: Record<string, unknown>;
  level?: Sentry.SeverityLevel;
};

export function captureServerException(
  error: unknown,
  options: CaptureServerExceptionOptions = {},
) {
  const { tags, extras, level = "error" } = options;
  Sentry.withScope((scope) => {
    scope.setLevel(level);
    if (tags) {
      Object.entries(tags).forEach(([key, value]) => scope.setTag(key, value));
    }
    if (extras) {
      Object.entries(extras).forEach(([key, value]) => scope.setExtra(key, value));
    }
    Sentry.captureException(error);
  });
}
