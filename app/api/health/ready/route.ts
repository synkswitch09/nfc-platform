import { NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { readinessResult } from "@/lib/health";

export async function GET() {
  const result = await readinessResult(getRuntimeConfig().appEnv, () => db.$queryRaw`SELECT 1`);
  return NextResponse.json(result.payload, { status: result.httpStatus });
}
