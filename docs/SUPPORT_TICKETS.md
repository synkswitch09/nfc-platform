# Support and requests — phase 3

Customers use Help & requests under their account or the public `/support` entry in the footer. Guests verify a six-digit email code (10-minute expiry, five attempts) before reading any order choices or submitting tickets. The resulting opaque, hashed, store-bound support session expires after 24 hours and can be cleared from the browser. A checkout claim token does not authorise support actions. Account sessions remain store-bound and verified as before.

Tickets may concern an order, general product enquiries, account access or privacy. Optional JPG/PNG/WebP photos retain validation and private access. Guests can see their replies and submit follow-ups without an account; verified accounts see tickets associated with their email, including tickets submitted before account creation. General tickets require no purchase. Changing or cancelling an order still requires a separate team decision, and refunds require finance permission.

## CMS

Settings → Support & requests configures guest access, automatic pauses, the first-response target (default five business days), explicit store holiday dates, and up to five internal alert email recipients. No recipient is guessed or seeded. Empty recipients means the CMS inbox is the internal alert surface. Store timezone controls deadlines, which fall at 17:00 after the configured number of business days, excluding weekends and configured holidays. Add the holidays observed by your business; the application does not automatically maintain a state holiday calendar. New settings affect new tickets. Existing deadlines and holds are preserved.

Support inbox includes status/priority filters, paused orders and overdue-first-response counts, pagination, customer/team message history, private internal notes, public replies and provider status. Only a public team reply records first response; an internal note or automatic acknowledgement does not. Resolved tickets can be reopened with a verified customer follow-up. Public replies are visible in the portal and may additionally be emailed. Separate release reasons are audited, and resolving a held ticket requires explicit release. All active ticket holds must be released to resume work.

## Preparation pause

A verified order/address change or cancellation request automatically places a high-priority hold only on a PAID order whose preparation has not started, whose stock items have not been packed, and whose manufacturing jobs remain unstarted/queued. Starting processing, manufacturing updates, packing and Shippit booking use the same database order lock and check active holds. The order lock serialises ticket admission against starting work: a competing ticket either wins before work starts and pauses it, or is recorded after work starts without promising a pause. Processing, packing and manufacturing updates persist a preparation-start marker; returning a job to queued or unpacking does not erase that marker.

Automatic checkout label preparation continues to run: a label is not a carrier booking or physical packing. A pause does not cancel a label, free stock/capacity, cancel payment or initiate a refund. Already-started orders accept tickets for manual review without an automatic pause. The team must check the inbox before printing downloaded files outside the platform.

## Notifications and delivery

Ticket acknowledgements, replies, pause-release notices and configured internal alerts use the per-store support sender and editable support template from phase 2, with mandatory details preserved. A dedicated durable outbox commits with each ticket mutation. The existing authenticated orders processing job retries this queue independently of refunds, order notices and Shippit label preparation; no new job or secret is required. Rendering/sender snapshots and provider idempotency keys are reused on retries. Provider acceptance does not prove inbox delivery. Internal alerts include a ticket reference and CMS link rather than customer message text. Email replies are not a support intake channel.

The migration preserves existing requests and their messages/replies, backfills identity, records already-processing orders as started and never retroactively creates holds. Existing historical tickets without a first-response deadline remain labelled historical. It adds general/account/privacy topics to stores with an existing topic list without replacing account settings, email designs, sender settings or integrations. No seed, catalog reset or production sample order is needed.

## Validation

Automated coverage checks calendar/timezone handling, hold eligibility, store-bound verified access, attempt limits and code replay, guest/general tickets, private notes, permission checks, concurrent editing, outbox snapshots, booking interlocks and a real PostgreSQL HTTP race between ticket admission and preparation start. Real test messages and orders are confined to the disposable CI environment. Production acceptance uses the CMS and public portal without changing customer orders or sending a test email.
