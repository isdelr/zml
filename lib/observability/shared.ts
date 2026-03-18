import { firstNonEmpty } from "@/lib/env";

export type ObservabilityConfig = {
  dsn: string | null;
  enabled: boolean;
  environment: string;
  release: string;
};

export function getObservabilityBaseConfig(env: Record<string, string | undefined>): ObservabilityConfig {
  const dsn = firstNonEmpty(env.SENTRY_DSN, env.NEXT_PUBLIC_SENTRY_DSN) ?? null;
  const environment = firstNonEmpty(env.SENTRY_ENVIRONMENT, env.NODE_ENV, "development")!;
  const release = firstNonEmpty(env.APP_RELEASE, env.NEXT_PUBLIC_APP_RELEASE, "0.1.0")!;

  return {
    dsn,
    enabled: Boolean(dsn) && env.NEXT_PUBLIC_DISABLE_OBSERVABILITY !== "true",
    environment,
    release,
  };
}
