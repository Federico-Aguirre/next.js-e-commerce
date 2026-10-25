# Operational lifecycle, backup, and recovery

## Scheduled operations

The Cloudflare Worker in `cloudflare/order-alert-cron` runs every 5 minutes and calls
`GET /api/cron/order-alerts`. Despite the legacy route name, it now runs:

- Existing overdue-order alerts.
- Expired checkout reconciliation and one-time stock restoration.
- Retries for purchase-confirmation and fulfillment emails.
- Tracking refresh for paid shipments that are still in transit.
- Flags shipment creations stuck for more than ten minutes, without releasing the lock or risking a duplicate shipping label.

Configure `ALERTS_ENDPOINT_URL` in Cloudflare to the deployed URL ending in
`/api/cron/order-alerts`. Set the same strong random `CRON_SECRET` in the Vercel environment and
Cloudflare Worker secrets. The endpoint rejects requests unless the bearer secret matches. Never
commit either value.

You can run the job manually from a trusted terminal without exposing the secret in source code:

```bash
curl --fail --silent --show-error \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${ALERTS_ENDPOINT_URL}"
```

The response contains counts only. Investigate non-zero `errors`, `deferred`, `failed`, or
`emailRetries.failed` values. A deferred payment is intentionally not treated as unpaid: stock
must remain reserved until the provider can be verified.

## Stock reservation and expiry

- Checkout decrements SKU stock inside the order-creation transaction.
- New reservations expire after 15 minutes. Cleanup waits an additional five-minute grace period.
- Before restoring stock, cleanup claims the order and verifies the payment with its provider.
  Stripe intents are cancelled when safe; Mercado Pago is checked by external reference; PayPal is
  checked for a completed capture.
- An approved payment is reconciled to `PAID` and keeps its stock reservation. Unresolved provider
  states are deferred rather than risking a paid order with restored stock.
- The final transition to `EXPIRED` and stock restoration happen in one database transaction.
  Conditional status updates prevent duplicate restoration by overlapping cron runs.
- `PAYMENT_PROCESSING`, `CANCELLING`, and `EXPIRING` are coordination states. Stale states are
  rechecked after ten minutes and can be recovered by the scheduled job.

If reservations remain deferred for multiple runs, verify the provider credentials, connectivity,
and payment status before manually changing the order or inventory. Do not manually increment stock
unless you have confirmed that the order was not paid and that stock was not already restored.

## Emails and shipping

Email retry rules:

- Retry old `PENDING`/`FAILED` notifications after five minutes.
- Recover `SENDING` notifications that have been stuck for ten minutes.
- Stop automatic retries after eight attempts; inspect the notification's last error and the Brevo
  sender/domain configuration before manually retrying.
- The existing notification record and provider idempotency key prevent the same event from being
  intentionally sent more than once.

Tracking refresh runs for paid `SHIPPED` orders with a Zipnova or Shippo shipment ID. Orders are
throttled by their last update and processed in small batches. Check the order's tracking status,
tracking URL, and shipping error in the dashboard when refreshes fail.

A separate scheduled check flags `CREATING` shipments with no external shipment ID that have been
stuck for ten minutes. The error is surfaced in the dashboard and the cron response. The check does
not release the creation lock automatically, because the carrier may already have created a label
before the application lost its response.

Shipment creation uses a conditional database claim to prevent two administrators from creating the
same shipment at once. An ambiguous network/5xx result or a provider-created label that the database
cannot link leaves the order in `CREATING` with a visible shipping error. Reconcile the shipment in
the provider's dashboard before retrying; only reset `CREATING` after confirming no shipment exists.
Do not blindly purchase a second label.

## Database backup

The repository includes `scripts/db-backup.sh` and `npm run db:backup`. Requirements: PostgreSQL
client tools (`pg_dump`, `pg_restore`), Python 3, and `sha256sum`.

Run from a trusted machine with `DATABASE_URL` set in its protected environment:

```bash
npm run db:backup
```

Optional settings:

- `BACKUP_DIR`: defaults to `$HOME/ecommerce-db-backups`.
- `BACKUP_RETENTION_DAYS`: defaults to 14; set to `0` to disable automatic deletion.

The script creates a custom-format PostgreSQL archive, validates it with `pg_restore --list`,
writes a SHA-256 checksum, uses restrictive file permissions, and removes old archives according to
the retention setting. It does not print the database URL. Backup files contain customer addresses,
emails, and order data: keep them outside the repository, on encrypted storage, and restrict access.

**This script does not by itself create an off-site backup or a cloud schedule.** Vercel's filesystem
is ephemeral, so do not schedule it inside a Vercel request. Enable provider-managed automated
backups/retention for the current Aiven service, verify that restoration is available on the current
plan, and maintain a separate encrypted copy in storage outside the database provider. Schedule the
script on a trusted, always-on host or secured runner only after its environment and destination are
configured. Do not upload raw database dumps to a public repository or ordinary build artifacts.

Example protected environment file for a dedicated backup host (prefer a secret manager when
available):

```bash
mkdir -p "$HOME/.config"
chmod 700 "$HOME/.config"
# Create this file with DATABASE_URL, BACKUP_DIR, and BACKUP_RETENTION_DAYS.
chmod 600 "$HOME/.config/ecommerce-backup.env"
```

Example daily cron entry, adjusted for the actual deployment path and backup destination:

```cron
15 3 * * * /bin/bash -lc 'set -a; source "$HOME/.config/ecommerce-backup.env"; set +a; cd "$HOME/path/to/next.js-e-commerce-main" && npm run db:backup'
```

Monitor the job's exit status and confirm that a new archive and matching `.sha256` file exist.
A backup on the same machine is not a substitute for the separate off-site copy.

## Database recovery

**Restoring replaces objects in the target database. First restore to a separate staging database.**

1. Choose an archive and keep its matching `.sha256` file alongside it.
2. Create an empty PostgreSQL recovery target, preferably in a separate staging service.
3. Set `RESTORE_DATABASE_URL` in a protected environment and set
   `RESTORE_CONFIRM_DATABASE` to the exact target database name.
4. Run the restore with an explicit confirmation:

   ```bash
   npm run db:restore -- "$HOME/ecommerce-db-backups/ecommerce-postgres-YYYYMMDDTHHMMSSZ.dump" --confirm
   ```

   The script verifies the checksum and archive, checks that the confirmation matches the target
   database name, then restores in a single transaction. It refuses to run without a checksum file
   and an explicit target confirmation.

5. Verify Prisma migrations, product/SKU counts, order history, customer delivery details, and the
   dashboard. Run the relevant unit tests and a sandbox checkout/email/shipping smoke test.
6. Only after validation, plan any production recovery: take a fresh backup of the current database,
   pause checkout/order mutations, restore using an approved recovery plan, verify the application,
   and resume traffic. Never test the restore against production.

Keep recovery credentials separate from ordinary application credentials where possible. If a
credential or backup is exposed, restrict access and rotate the affected secret.
