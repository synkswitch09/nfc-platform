import { NextResponse } from "next/server";
import type { z } from "zod";
import { validationIssues } from "@/lib/validation-issues";
export { validationIssues, type AdminFieldIssue } from "@/lib/validation-issues";

export function jsonValidationError(error: z.ZodError) {
  const issues = validationIssues(error);
  return NextResponse.json({ error: issues.map(issue => issue.message).join("\n"), issues }, { status: 400 });
}
export function jsonFieldError(path: string, message: string, status = 400) {
  return NextResponse.json({ error: message, issues: [{ path, message }] }, { status });
}
