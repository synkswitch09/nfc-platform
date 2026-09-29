# Order preparation and Ready to ship

The production queue at Admin → Manufacturing advances each 3D job through printing, post processing, QA, optional assembly, packing and ready. Failed work needs a reason before it can be queued again. Work is scoped to the active store and an order that is paid or processing.

At Admin → Orders → order, record the number of units packed on each saved order line. The line retains its purchase name, SKU, options, personalisation and production requirements even when the catalogue changes. Printed lines require ready jobs for the requested quantity. Lines requiring NFC need one ready, unclaimed tag of the purchased variant per packed unit; enter public tag IDs. A mistaken assignment can be removed on this form while the order remains open. Other store and other variant tags are rejected. Standard products without NFC or 3D printing only need packing.

The transition from PROCESSING to READY_TO_SHIP checks every line in the database transaction. Missing historical production data, unfinished printing, incomplete quantities and missing or disabled NFC tags block the transition with a reason shown in Admin. A store administrator may record an exception with a reason of at least ten characters; the original issues and reason are audited. Shipping labels remain subject to the existing ready state and shipping provider setup; this block does not buy postage or print a carrier label automatically.

Deploy `20260924150000_order_item_packing` before the updated app. It adds `packedQuantity` and `packedAt` to OrderItem, defaulting existing rows to unpacked. Existing orders without the new production snapshot require a documented manager exception. Do not backfill requirements from the current catalogue. No seed, reset or live order operation is needed to deploy this code.

Verification in this workspace: lint, typecheck, 263 unit tests and production build passed. PostgreSQL concurrency, migration deployment, Docker, NFC hardware, carrier purchase and visual E2E have not been run against a real environment.
