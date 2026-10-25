# CMS validation

Admin schema failures return HTTP 400 with `error` and **all** `issues: [{path, message}]`. Use `jsonValidationError` from `lib/admin-validation-feedback.ts` for Zod failures and `jsonFieldError` for a business rule tied to one control. Keep authentication and conflict responses separate. Never include submitted values in errors.

Admin editors use `useAdminRequest` from `components/admin-form-feedback.tsx`: attach `feedbackRef` to the editor root, render `feedback`, and use `request` for explicit save actions. Automatic previews should not focus or validate the editing form. Input names should match the full JSON path, including array indices. Landing sections have `data-validation-scope` for their row index and relative names inside that scope. Do not resolve duplicate controls by guessing from the last path segment.

The shared native validation listener renders accessible inline errors, opens collapsed details, focuses the first invalid field and clears errors as the user edits. Server errors use the same treatment and a clickable summary. The storefront header/footer additionally validate their typed configuration locally and map nested support/typography fields to their form names.

Blank optional inputs stay valid according to their schema; a supplied malformed value still needs correction. Inherited typography uses `null`, not zero. Missing controls from hidden sections preserve the stored value (including optional line height and letter spacing). General store settings do not submit hidden header/footer/home or legacy social links; omitting those fields preserves them. Footer social profiles are edited directly in the footer editor.

Regression checks cover unchanged/blank footer saves, absent typography controls, all nested schema paths, multiple landing sections, integration IDs required only when enabled, email block paths, and general settings that preserve hidden content. Browser checks should also verify focus, details disclosure, highlighting and clearing an error after editing.
