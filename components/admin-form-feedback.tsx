"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminFieldIssue } from "@/lib/admin-validation-feedback";

const aliases: Record<string, string[]> = {
  validityDays: ["days"], shippingDiscountCapCents: ["shippingCap"], maxShippingWeightGrams: ["maxWeight"], usageLimit: ["limit"],
  weeklyCapacityMinutes: ["weekly"], maxBusinessDays: ["days"],
  flatRateCents: ["flatRate"], freeOverCents: ["freeOver"], estimatedDaysMin: ["minDays"], estimatedDaysMax: ["maxDays"],
  priceCents: ["price"], amountCents: ["amount"], minimumSubtotalCents: ["minimumSubtotal", "minimum", "minimumReward"],
};
type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
function controls(root: HTMLElement) {
  return [...root.querySelectorAll<Control>("input, textarea, select")].filter(input => !(input instanceof HTMLInputElement && input.type === "hidden") && !input.disabled);
}
export function findAdminIssueControl(root: HTMLElement, issue: AdminFieldIssue): Control | undefined {
  const inputs = controls(root);
  const path = issue.path.replace(/^config\./, "");
  const typography = path.match(/^theme\.typography\.([^.]+)\.([^.]+)$/);
  if (typography) return inputs.find(input => input.name === `type-${typography[1]}-${typography[2] === "sizePx" ? "size" : typography[2]}`);
  const exact = inputs.find(input => {
    const local = input.dataset.validationPath ?? input.name;
    const scope = input.closest<HTMLElement>("[data-validation-scope]")?.dataset.validationScope;
    return (scope !== undefined && `${scope}.${local}` === path) || input.dataset.validationPath === issue.path || input.dataset.validationPath === path || input.name === path || (!!issue.field && input.name === issue.field);
  });
  if (exact) return exact;
  const suffix = path.split(".").at(-1) ?? "";
  const candidates = inputs.filter(input => input.name === suffix || aliases[suffix]?.includes(input.name));
  // Never highlight a different row simply because it has the same field name.
  return candidates.length === 1 ? candidates[0] : undefined;
}
function reveal(input: HTMLElement) {
  for (let parent = input.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
  input.focus();
  input.scrollIntoView({ block: "center", behavior: "smooth" });
}
export function useAdminRequest() {
  const feedbackRef = useRef<HTMLElement | null>(null);
  const submittedForm = useRef<HTMLFormElement | null>(null);
  const issueRoot = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const root = feedbackRef.current;
    if (!root) return;
    root.dataset.adminFeedback = "true";
    function capture(event: Event) {
      const target = event.target;
      submittedForm.current = target instanceof Element ? target.closest("form") : null;
    }
    function edited(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
      setIssues(current => current.filter(issue => findAdminIssueControl(issueRoot.current ?? root!, issue) !== target));
    }
    root.addEventListener("input", edited);
    root.addEventListener("change", edited);
    root.addEventListener("submit", capture, true);
    root.addEventListener("click", capture, true);
    return () => { delete root.dataset.adminFeedback; root.removeEventListener("input", edited); root.removeEventListener("change", edited); root.removeEventListener("submit", capture, true); root.removeEventListener("click", capture, true); };
  }, []);
  const [issues, setIssues] = useState<AdminFieldIssue[]>([]);
  async function request(input: RequestInfo | URL, init?: RequestInit) {
    if (!init?.method || init.method.toUpperCase() === "GET") return fetch(input, init);
    const root = submittedForm.current ?? feedbackRef.current;
    issueRoot.current = root;
    setIssues([]);
    if (root) for (const control of controls(root)) {
      if (control.dataset.adminServerError) {
        control.setCustomValidity("");
        delete control.dataset.adminServerError;
        control.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    const response = await fetch(input, init);
    if (!response.ok) {
      const body = await response.clone().json().catch(() => null);
      if (Array.isArray(body?.issues)) {
        const next: AdminFieldIssue[] = body.issues;
        setIssues(next);
        let first: Control | undefined;
        for (const issue of next) {
          const control = root && findAdminIssueControl(root, issue);
          if (!control) continue;
          control.dataset.adminServerError = "true";
          control.setCustomValidity(issue.message);
          control.dispatchEvent(new Event("invalid", { bubbles: false }));
          first ??= control;
        }
        if (first) reveal(first);
        else root?.querySelector<HTMLElement>(".validation-summary")?.focus();
      }
    }
    return response;
  }
  const feedback = issues.length > 0 && <div className="form-error validation-summary" role="alert" tabIndex={-1}>
    <strong>Check these fields before saving:</strong>
    <ul>{issues.map((issue, index) => <li key={`${issue.path}-${index}`}><button type="button" className="text-button" onClick={() => {
      const root = issueRoot.current ?? feedbackRef.current;
      const control = root && findAdminIssueControl(root, issue);
      if (control) reveal(control);
    }}>{issue.message}</button></li>)}</ul>
  </div>;
  return { request, feedbackRef, feedback };
}
