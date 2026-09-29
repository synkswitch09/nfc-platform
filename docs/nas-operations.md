# NAS operations runbook

## Deployment

1. Place the repository and a private `.env` on encrypted NAS storage. Never add `.env` to Git.
2. Set independent `POSTGRES_PASSWORD`, `SESSION_SECRET` and `ACTIVATION_PEPPER` values, the public HTTPS `APP_URL`, and any Stripe, email and OAuth credentials.
3. Terminate TLS at the NAS reverse proxy. Expose only HTTPS publicly; keep PostgreSQL on loopback and set `TRUST_PROXY=true` only when the proxy overwrites forwarded headers and direct port 3000 access is blocked.
4. Run `docker compose pull && docker compose up -d --build`. The app applies committed migrations before starting.
5. Check `docker compose ps`, `curl --fail https://your-domain.example/api/health`, sign-in, product media and one non-sensitive test tag.

## Backups

Run `scripts/backup.sh /encrypted/off-device/backups` on a schedule. It captures the PostgreSQL database and the product-media volume, creates checksums, and prints the verification command. Copy backups off the NAS and encrypt them at rest.

Run `scripts/verify-backup.sh /path/to/backup` after every backup. At least monthly, restore the newest set into a separate staging deployment and test login, an order, an image and a tag. Archive the result and restore duration.

`scripts/restore.sh` replaces live data and therefore requires `CONFIRM_RESTORE=yes`. Stop public traffic first, keep the failed deployment intact for investigation, and verify the restored application before reopening traffic.

## Monitoring and incidents

Monitor container restarts, `/api/health`, disk capacity, PostgreSQL connections, HTTP 5xx/429 rates, failed Stripe webhooks, failed logins/activations and backup age. Send alerts to a channel that is independent of the NAS.

On suspected credential exposure, rotate the affected provider key and application secrets, revoke sessions, preserve logs, and inspect `Admin > Audit log`. Rotating `ACTIVATION_PEPPER` invalidates every unclaimed code, so plan a replacement batch before doing so.
