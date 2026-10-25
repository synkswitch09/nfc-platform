import type { z } from "zod";

export type AdminFieldIssue = { path: string; message: string; field?: string };
export function validationIssues(error: z.ZodError): AdminFieldIssue[] {
  return error.issues.flatMap(issue => {
    // Union wrappers otherwise discard the path of the actual nested field.
    if (issue.code === "invalid_union") {
      const nested = issue.errors.find(branch => branch.some(item => item.path.length > issue.path.length));
      if (nested) return validationIssues({ issues: nested } as z.ZodError);
    }
    const path = issue.path.map(String).join(".");
    const label = issue.path.map(part => typeof part === "number" ? `#${part + 1}` : String(part).replace(/([a-z])([A-Z])/g, "$1 $2")).join(" → ") || "Settings";
    let correction = "Check this value and try again.";
    if (issue.code === "too_small" || issue.code === "too_big") {
      const min = issue.code === "too_small";
      const amount = min ? issue.minimum : issue.maximum;
      const unit = issue.origin === "string" ? " characters" : issue.origin === "array" ? " items" : "";
      correction = `${min ? "Use at least" : "Use no more than"} ${amount}${unit}.`;
    } else if (issue.code === "invalid_format") {
      correction = issue.format === "email" ? "Enter a valid email address." : issue.format === "url" ? "Enter a valid full URL, for example https://example.com." : "Check the required format.";
    } else if (issue.code === "invalid_type") correction = issue.expected === "number" ? "Enter a valid number." : issue.expected === "int" ? "Enter a whole number." : "Enter or select a valid value.";
    else if (issue.code === "invalid_value") correction = "Select one of the available options.";
    else if (issue.code === "custom") correction = issue.message;
    const field = String(issue.path.at(-1) ?? "");
    if (issue.code === "invalid_format" && issue.format === "regex") {
      if (/colou?r|hex/i.test(field)) correction = "Use a six-digit colour such as #243247, or clear an optional override to inherit.";
      else if (/slug/.test(field)) correction = "Use lowercase letters and numbers separated by single hyphens.";
      else if (field === "ga4MeasurementId") correction = "Enter the Google Analytics measurement ID beginning with G-.";
      else if (/^meta.*Id$/.test(field)) correction = "Enter the numeric Meta identifier, or clear it when the integration is off.";
      else if (/country/i.test(field)) correction = "Use a two-letter country code, such as AU.";
      else if (field === "currency") correction = "Use a three-letter currency code, such as AUD.";
    }
    if (issue.message && !/^(Invalid|Too (small|big)|Unrecognized)/i.test(issue.message)) correction = issue.message;
    return [{ path, message: `${label}: ${correction}` }];
  });
}
