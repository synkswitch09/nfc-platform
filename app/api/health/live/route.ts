import { NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/config";
import { livenessPayload } from "@/lib/health";

export function GET() { return NextResponse.json(livenessPayload(getRuntimeConfig().appEnv)); }
