import type { AppEnvironment } from "@/lib/config";

export function livenessPayload(environment: AppEnvironment) {
  return { status: "ok" as const, service: "tapkin-web", environment };
}

export async function readinessResult(environment: AppEnvironment, databaseCheck: () => Promise<unknown>) {
  try {
    await databaseCheck();
    return { httpStatus: 200, payload: { status: "ready" as const, service: "tapkin-web", environment, database: "available" as const } };
  } catch {
    return { httpStatus: 503, payload: { status: "unavailable" as const, service: "tapkin-web", environment, database: "unavailable" as const } };
  }
}
