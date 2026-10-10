# Phase 2: store email templates

Each store has its own editor at **Admin → Content → Email templates**. Standard designs are active immediately. No new environment variables or credentials are needed; existing store senders and provider credentials remain in use.

Choose a notification and edit its subject, inbox preview, accent colour and ordered heading/text/image/button/divider blocks. Images use the CMS media library and validated PNG/JPEG/WebP uploads (5 MB). Copy the listed `{{dynamic.field}}` placeholders into text. Desktop/mobile previews use synthetic customer/order/account data and the current store's branding in a sandboxed iframe.

**Save draft** retains work without changing live messages. **Publish template** activates the reviewed design for subsequent emails. **Restore standard live template** restores the built-in design. Per-template revisions reject stale saves and retain unrelated settings. Publishing/restoring requires `content.publish`; drafts and tests require `content.write`; content readers can inspect/preview. Writes are store-scoped and audited.

**Send test to my email** sends only to the signed-in editor, using example data. Production uses the real provider; staging its existing Mailtrap sandbox; development the private mock outbox. Limit: six tests per store/editor per hour. Provider acceptance does not prove inbox delivery. Example links and reward codes are not valid. Deployment does not automatically send production test emails.

Validated JSON export/import loads drafts without publishing. It does not accept arbitrary HTML/scripts. Files must match the selected notification. Uploaded images are environment-specific: upload production copies before publishing if necessary. Tapkin and Kosykin are configured independently.

Covered notifications: verification, password reset, security, team invitations, payment, shipping, delivery, dispatch estimates, refunds, support, next-purchase rewards, loyalty points earned, operations/print attachments, and other notifications. Sender categories are preserved. This phase does not launch marketing campaigns or change consent.

Mandatory codes, secure links, transaction facts, tracking references, reward conditions and ticket-only support instructions are appended independently of editable content. Dynamic values and text are HTML-escaped, subjects use one line, and links permit HTTPS (HTTP only on loopback for development). Uploaded media resolves against the current store domain. Messages include a plain-text alternative and retain existing 3MF attachments.

Durable order notifications save subject/body/sender in `OrderNotification.emailSnapshot` under their worker lease before provider submission. Retries reuse that snapshot and their existing idempotency key. Later CMS edits do not rewrite a retry. Migration `20261010000000_email_templates_snapshot` adds an optional JSON column; old rows receive a snapshot on dispatch. Shippit queues delivery notices only when every expected parcel is delivered and the order successfully transitions; manual delivery notices apply only to non-Shippit orders.

Validation covers renderer safety, dynamic fields, draft/publication boundaries, store scope, roles, concurrency, fixed test recipients, snapshots, provider HTML/text/attachments, and the HTTP E2E journey extended with CMS preview/draft/publish/mock-test/reset.

Deployment note: Docker Hub returned repeated HTTP 429 errors when resolving the Node base image. The Dockerfile now uses Docker’s official ECR Public mirror, pinned to the exact `node:24-alpine` index digest already built in the successful staging validation (`sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1`). The mirror manifest was downloaded and its SHA-256 matched byte-for-byte. This changes the download registry, not the tested runtime version. Future Node updates must review and update both pinned FROM references.

The disposable CI PostgreSQL 17 Alpine image also uses the official ECR mirror at the identical previously validated digest (`sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`). This does not modify Azure databases. Buildx uses Google’s managed Docker Hub cache for the standard Moby BuildKit image, pinned to the manifest verified in that cache (`sha256:cec9f139f45e93c5c69c60f8b07cfad9f43f4ef6b6a6cd917527fea5ff2e3dea`). The container driver and provenance attestations remain enabled. No new cloud accounts, secrets or permissions are required.
