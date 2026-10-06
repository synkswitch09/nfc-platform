"use client";

import { useEffect } from "react";

type FieldIssue = { path: string; message: string };

export function showFormIssues(form: HTMLFormElement, issues: FieldIssue[] | undefined) {
  if (!issues?.length) return false;
  let first: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null = null;
  for (const issue of issues) {
    const name = issue.path.split(".").at(-1) ?? "";
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) continue;
    const label = input.closest("label")?.childNodes[0]?.textContent?.trim() || name;
    const message = /^(Too small|Too big|Invalid input|Invalid string)/i.test(issue.message)
      ? `Check ${label.toLowerCase()} and try again.` : issue.message;
    input.setCustomValidity(message);
    first ??= input;
  }
  if (!first) return false;
  form.reportValidity();
  return true;
}

// Native constraint errors are otherwise shown in a browser tooltip, away from
// the field on long checkout and admin forms.
export function FormValidationFeedback() {
  useEffect(() => {
    let nextId = 0;
    function fieldFor(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
      return input.closest<HTMLLabelElement>("label.field") ?? input.closest<HTMLLabelElement>("label") ?? input.parentElement;
    }
    function clear(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
      const field = fieldFor(input);
      const message = field?.querySelector<HTMLElement>(`[data-validation-for="${input.dataset.validationId ?? ""}"]`);
      if (message) {
        input.setAttribute("aria-describedby", (input.getAttribute("aria-describedby") ?? "").split(" ").filter(id => id !== message.id).join(" "));
        message.remove();
      }
      input.removeAttribute("aria-invalid");
      field?.classList.remove("field-invalid");
    }
    function show(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, message: string) {
      const field = fieldFor(input);
      if (!field || !input.form) return;
      if (!input.dataset.validationId) input.dataset.validationId = `field-validation-${++nextId}`;
      let help = field.querySelector<HTMLElement>(`[data-validation-for="${input.dataset.validationId}"]`);
      if (!help) {
        help = document.createElement("small");
        help.id = input.dataset.validationId;
        help.dataset.validationFor = input.dataset.validationId;
        help.className = "form-error field-validation-message";
        field.append(help);
      }
      help.textContent = message;
      field.classList.add("field-invalid");
      input.setAttribute("aria-invalid", "true");
      const describedBy = new Set((input.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean));
      describedBy.add(help.id);
      input.setAttribute("aria-describedby", [...describedBy].join(" "));
    }
    function describe(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
      const label = fieldFor(input)?.querySelector("span.field-label")?.textContent?.trim()
        || input.closest("label")?.childNodes[0]?.textContent?.trim()
        || input.getAttribute("aria-label") || input.name || "This field";
      const name = label.replace(/\s*\(optional\).*/i, "").trim();
      if (input.validity.valueMissing) return input instanceof HTMLSelectElement
        ? `Select ${name.toLowerCase()} to continue.`
        : input instanceof HTMLInputElement && (input.type === "checkbox" || input.type === "radio")
          ? `Choose ${name.toLowerCase()} to continue.`
          : `Enter ${name.toLowerCase()} to continue.`;
      if (input.validity.typeMismatch) return input.type === "email" ? "Enter a valid email address, such as name@example.com." : `Enter a valid ${name.toLowerCase()}.`;
      if (input.validity.patternMismatch) return input.name === "postcode" ? "Check the postcode format for the selected country." : `Check the format of ${name.toLowerCase()}.`;
      if (input.validity.tooShort && !(input instanceof HTMLSelectElement)) return `${name} needs at least ${input.minLength} characters.`;
      if (input.validity.tooLong && !(input instanceof HTMLSelectElement)) return `${name} must be ${input.maxLength} characters or fewer.`;
      if (input.validity.rangeUnderflow || input.validity.rangeOverflow) return `Check the allowed range for ${name.toLowerCase()}.`;
      return input.validationMessage || `Check ${name.toLowerCase()} and try again.`;
    }
    function onInvalid(event: Event) {
      const input = event.target;
      if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) return;
      event.preventDefault();
      show(input, describe(input));
      if (!input.form?.dataset.validationFocusQueued) {
        if (input.form) input.form.dataset.validationFocusQueued = "true";
        window.setTimeout(() => { input.focus(); input.scrollIntoView({ block: "center", behavior: "smooth" }); if (input.form) delete input.form.dataset.validationFocusQueued; }, 0);
      }
    }
    function onEdit(event: Event) {
      const input = event.target;
      if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) return;
      if (input.validity.customError) input.setCustomValidity("");
      if (input.validity.valid) clear(input);
      else if (input.getAttribute("aria-invalid") === "true") show(input, describe(input));
    }
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    return () => { document.removeEventListener("invalid", onInvalid, true); document.removeEventListener("input", onEdit, true); document.removeEventListener("change", onEdit, true); };
  }, []);
  return null;
}
