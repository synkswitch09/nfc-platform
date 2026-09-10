import { z } from "zod";

export const appEnvironments = ["development", "staging", "production"] as const;
export type AppEnvironment = (typeof appEnvironments)[number];

const blankToUndefined = (value: unknown) => typeof value === "string" && value.trim() === "" ? undefined : value;
const optionalString = z.preprocess(blankToUndefined, z.string().trim().min(1).optional());
const optionalUrl = z.preprocess(blankToUndefined, z.string().url().optional());
const booleanString = z.enum(["true", "false"]).default("false").transform(value => value === "true");

const runtimeConfigSchema = z.object({
  APP_ENV: z.enum(appEnvironments).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: optionalString,
  DATABASE_EXPECTED_NAME: optionalString,
  SESSION_SECRET: optionalString,
  ACTIVATION_PEPPER: optionalString,
  TRUST_PROXY: booleanString,
  STORAGE_PROVIDER: z.enum(["local", "azure-blob"]).default("local"),
  STORAGE_ENVIRONMENT: z.enum(appEnvironments).optional(),
  UPLOAD_DIR: z.string().trim().min(1).default("./data/uploads"),
  AZURE_STORAGE_CONTAINER_URL: optionalUrl,
  AZURE_STORAGE_SAS_TOKEN: optionalString,
  EMAIL_MODE: z.enum(["mock", "sandbox", "live"]).default("mock"),
  EMAIL_WEBHOOK_URL: optionalUrl,
  EMAIL_WEBHOOK_SECRET: optionalString,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  APPLE_CLIENT_ID: optionalString,
  APPLE_CLIENT_SECRET: optionalString,
  ENABLE_TEST_CHECKOUT: booleanString,
  ANALYTICS_ID: optionalString,
  LOG_LEVEL: z.enum(["info", "warn", "error"]).default("info"),
  DEV_ADMIN_EMAIL: optionalString,
  DEV_ADMIN_PASSWORD: optionalString,
  STAGING_ADMIN_EMAIL: optionalString,
  STAGING_ADMIN_PASSWORD: optionalString,
}).superRefine((value, context) => {
  const issue = (path: string, message: string) => context.addIssue({ code: "custom", path: [path], message });
  const paired = (first: string | undefined, second: string | undefined, firstName: string, secondName: string) => {
    if (Boolean(first) !== Boolean(second)) issue(first ? secondName : firstName, `${firstName} and ${secondName} must be configured together`);
  };

  paired(value.GOOGLE_CLIENT_ID, value.GOOGLE_CLIENT_SECRET, "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
  paired(value.APPLE_CLIENT_ID, value.APPLE_CLIENT_SECRET, "APPLE_CLIENT_ID", "APPLE_CLIENT_SECRET");
  paired(value.DEV_ADMIN_EMAIL, value.DEV_ADMIN_PASSWORD, "DEV_ADMIN_EMAIL", "DEV_ADMIN_PASSWORD");
  paired(value.STAGING_ADMIN_EMAIL, value.STAGING_ADMIN_PASSWORD, "STAGING_ADMIN_EMAIL", "STAGING_ADMIN_PASSWORD");

  if (value.DATABASE_URL) {
    try {
      const url = new URL(value.DATABASE_URL);
      if (!["postgres:", "postgresql:"].includes(url.protocol)) issue("DATABASE_URL", "DATABASE_URL must use PostgreSQL");
      const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
      if (value.DATABASE_EXPECTED_NAME && databaseName !== value.DATABASE_EXPECTED_NAME) issue("DATABASE_URL", "DATABASE_URL database does not match DATABASE_EXPECTED_NAME");
      if (value.APP_ENV !== "development" && !["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "")) issue("DATABASE_URL", "DATABASE_URL must require TLS outside development");
    } catch {
      issue("DATABASE_URL", "DATABASE_URL must be a valid PostgreSQL URL");
    }
  }

  if (value.APP_ENV !== "development") {
    for (const [name, field] of [["DATABASE_URL", value.DATABASE_URL], ["DATABASE_EXPECTED_NAME", value.DATABASE_EXPECTED_NAME], ["SESSION_SECRET", value.SESSION_SECRET], ["ACTIVATION_PEPPER", value.ACTIVATION_PEPPER]] as const) {
      if (!field) issue(name, `${name} is required in staging and production`);
    }
    if (!value.APP_URL.startsWith("https://") || new URL(value.APP_URL).hostname === "localhost") issue("APP_URL", "APP_URL must be a public HTTPS URL in staging and production");
    if (value.SESSION_SECRET && value.SESSION_SECRET.length < 32) issue("SESSION_SECRET", "SESSION_SECRET must contain at least 32 characters");
    if (value.ACTIVATION_PEPPER && value.ACTIVATION_PEPPER.length < 32) issue("ACTIVATION_PEPPER", "ACTIVATION_PEPPER must contain at least 32 characters");
    if (value.STORAGE_PROVIDER !== "azure-blob") issue("STORAGE_PROVIDER", "A durable storage provider is required in staging and production");
    if (value.STORAGE_ENVIRONMENT !== value.APP_ENV) issue("STORAGE_ENVIRONMENT", "STORAGE_ENVIRONMENT must match APP_ENV");
    if (!value.AZURE_STORAGE_CONTAINER_URL) issue("AZURE_STORAGE_CONTAINER_URL", "AZURE_STORAGE_CONTAINER_URL is required for Azure Blob storage");
    if (value.AZURE_STORAGE_CONTAINER_URL) {
      const containerUrl = new URL(value.AZURE_STORAGE_CONTAINER_URL);
      const container = containerUrl.pathname.split("/").filter(Boolean).at(-1) ?? "";
      if (containerUrl.search) issue("AZURE_STORAGE_CONTAINER_URL", "Keep credentials out of AZURE_STORAGE_CONTAINER_URL");
      if (!container.endsWith(`-${value.APP_ENV}`)) issue("AZURE_STORAGE_CONTAINER_URL", "The Blob container name must end with the APP_ENV name");
    }
    if (!value.AZURE_STORAGE_SAS_TOKEN) issue("AZURE_STORAGE_SAS_TOKEN", "AZURE_STORAGE_SAS_TOKEN is required for Azure Blob storage");
    if (value.EMAIL_MODE === "mock") issue("EMAIL_MODE", "Staging and production require an isolated sandbox or live email provider");
    if (!value.EMAIL_WEBHOOK_URL) issue("EMAIL_WEBHOOK_URL", "EMAIL_WEBHOOK_URL is required outside development");
    if (!value.EMAIL_WEBHOOK_SECRET) issue("EMAIL_WEBHOOK_SECRET", "EMAIL_WEBHOOK_SECRET is required outside development");
    if (value.ENABLE_TEST_CHECKOUT) issue("ENABLE_TEST_CHECKOUT", "Test checkout is restricted to development");
    if (value.DEV_ADMIN_EMAIL || value.DEV_ADMIN_PASSWORD) issue("DEV_ADMIN_EMAIL", "Development administrator credentials are forbidden outside development");
  }

  if (value.APP_ENV === "staging") {
    if (!value.STRIPE_SECRET_KEY?.startsWith("sk_test_")) issue("STRIPE_SECRET_KEY", "Staging requires a Stripe test secret key");
    if (!value.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_")) issue("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "Staging requires a Stripe test publishable key");
    if (!value.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) issue("STRIPE_WEBHOOK_SECRET", "Staging requires its own Stripe webhook secret");
    if (value.EMAIL_MODE !== "sandbox") issue("EMAIL_MODE", "Staging email must use sandbox mode");
  }

  if (value.APP_ENV === "production") {
    if (!value.STRIPE_SECRET_KEY?.startsWith("sk_live_")) issue("STRIPE_SECRET_KEY", "Production requires a Stripe live secret key");
    if (!value.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_")) issue("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "Production requires a Stripe live publishable key");
    if (!value.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) issue("STRIPE_WEBHOOK_SECRET", "Production requires its own Stripe webhook secret");
    if (value.EMAIL_MODE !== "live") issue("EMAIL_MODE", "Production email must use live mode");
    if (value.STAGING_ADMIN_EMAIL || value.STAGING_ADMIN_PASSWORD) issue("STAGING_ADMIN_EMAIL", "Staging administrator credentials are forbidden in production");
  }
});

export type RuntimeConfig = {
  appEnv: AppEnvironment;
  appUrl: string;
  databaseUrl?: string;
  databaseExpectedName?: string;
  sessionSecret?: string;
  activationPepper?: string;
  trustProxy: boolean;
  storage: { provider: "local" | "azure-blob"; environment?: AppEnvironment; uploadDir: string; containerUrl?: string; sasToken?: string };
  email: { mode: "mock" | "sandbox" | "live"; webhookUrl?: string; webhookSecret?: string };
  stripe: { secretKey?: string; webhookSecret?: string; publishableKey?: string; testCheckout: boolean };
  analyticsId?: string;
  logLevel: "info" | "warn" | "error";
};

export function parseRuntimeConfig(environment: Record<string, string | undefined>): RuntimeConfig {
  if (environment.NODE_ENV === "production" && !environment.APP_ENV && environment.NEXT_PHASE !== "phase-production-build") throw new Error("Invalid runtime configuration: APP_ENV must be explicit when NODE_ENV=production");
  const parsed = runtimeConfigSchema.safeParse(environment);
  if (!parsed.success) {
    const details = parsed.error.issues.map(item => `${item.path.join(".")}: ${item.message}`).join("; ");
    throw new Error(`Invalid runtime configuration: ${details}`);
  }
  const value = parsed.data;
  return {
    appEnv: value.APP_ENV,
    appUrl: value.APP_URL.replace(/\/$/, ""),
    databaseUrl: value.DATABASE_URL,
    databaseExpectedName: value.DATABASE_EXPECTED_NAME,
    sessionSecret: value.SESSION_SECRET,
    activationPepper: value.ACTIVATION_PEPPER,
    trustProxy: value.TRUST_PROXY,
    storage: { provider: value.STORAGE_PROVIDER, environment: value.STORAGE_ENVIRONMENT, uploadDir: value.UPLOAD_DIR, containerUrl: value.AZURE_STORAGE_CONTAINER_URL, sasToken: value.AZURE_STORAGE_SAS_TOKEN },
    email: { mode: value.EMAIL_MODE, webhookUrl: value.EMAIL_WEBHOOK_URL, webhookSecret: value.EMAIL_WEBHOOK_SECRET },
    stripe: { secretKey: value.STRIPE_SECRET_KEY, webhookSecret: value.STRIPE_WEBHOOK_SECRET, publishableKey: value.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, testCheckout: value.ENABLE_TEST_CHECKOUT },
    analyticsId: value.ANALYTICS_ID,
    logLevel: value.LOG_LEVEL,
  };
}

export function getRuntimeConfig() { return parseRuntimeConfig(process.env); }

export function currentAppEnvironment(environment: Record<string, string | undefined> = process.env): AppEnvironment {
  return appEnvironments.includes(environment.APP_ENV as AppEnvironment) ? environment.APP_ENV as AppEnvironment : "development";
}

export function searchEnginePolicy(environment: AppEnvironment) {
  return environment === "production"
    ? { index: true, follow: true, noarchive: false }
    : { index: false, follow: false, noarchive: true };
}

export function oauthCallbackUrl(provider: "google" | "apple", config: Pick<RuntimeConfig, "appUrl"> = getRuntimeConfig()) {
  return `${config.appUrl}/api/auth/oauth/${provider}/callback`;
}

export function publicTagUrl(publicTagId: string, config: Pick<RuntimeConfig, "appUrl"> = getRuntimeConfig()) {
  return `${config.appUrl}/t/${publicTagId}`;
}
