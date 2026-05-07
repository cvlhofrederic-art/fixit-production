# Service-role usage map — API routes

Audit reference for which API routes use `SUPABASE_SERVICE_ROLE_KEY`
and why. Updated whenever a route is migrated to / from the service-role
bypass.

The general rule: **service-role is the exception, not the default**.
A route may use it only when one of these legitimate cases applies:

1. **Cron ingest cross-tenant** — pulling third-party data into shared
   tables (no per-user RLS context).
2. **Token-public access** — anonymous suppliers / buyers reach the
   row via a secret token, not a Supabase session.
3. **Cross-user notifications** — inserting a row in a table where
   the target is *another* user (artisan_notifications insert that
   notifies the seller of a buyer's action).
4. **Health / diagnostic** — read-only system probes that don't expose
   PII.

Routes that mutate user-scoped data flow through `getAuthedClient(token)`
([lib/supabase-clients.ts](../lib/supabase-clients.ts)) and rely on RLS
policies as the enforcer.

## Routes that legitimately use service-role

| Route | Reason | Migration of policy |
|---|---|---|
| `app/api/health/route.ts` | Health probe (read-only `SELECT id LIMIT 1` on `profiles_artisan`) | n/a |
| `app/api/tenders/scan/route.ts` | Cron ingest from data.economie.gouv.fr (BOAMP + mairies + plateformes) | n/a — cross-tenant marches |
| `app/api/sync/decp-13/route.ts` | Cron ingest DECP marchés publics 13 | n/a |
| `app/api/sync/sitadel-13/route.ts` | Cron ingest permis construire 13 | n/a |
| `app/api/sync/mairies-13/route.ts` | Cron scrape MAPA mairies (robots.txt-compliant) | n/a |
| `app/api/sync/base-gov-pt/route.ts` | Cron ingest BASE.gov.pt contratos | n/a |
| `app/api/sync/ted-porto/route.ts` | Cron ingest TED notices UE | n/a |
| `app/api/sync/obras-porto/route.ts` | Cron ingest licenças obras Porto | n/a |
| `app/api/rfq/offer/[token]/route.ts` | Anonymous supplier access via secret token (no Supabase session) | 025 — token-public design |
| `app/api/cron/snapshot-revenue/route.ts` | Cron aggregation of `subscriptions` → `subscription_metrics` (cross-tenant by design) | 100 |
| `app/api/cron/cron-heartbeat/route.ts` | Cron infrastructure write (no user context) | 102 |
| `app/api/stripe/webhook/route.ts` | Stripe webhook events (server-to-server) | n/a |
| `app/api/marketplace-btp/route.ts` GET | Public listing read (would also work via anon, kept admin for paused/deleted access in "Mes annonces") | 027 |
| `app/api/marketplace-btp/[id]/route.ts` GET | Same | 027 |
| `app/api/marketplace-btp/[id]/demande/route.ts` POST/PATCH | `artisan_notifications` insert is cross-user (buyer → seller) so admin-only — but the listing read uses admin too for paused-row access | 027 |
| `app/api/tva/check/route.ts` | `artisan_notifications` insert is cross-user (no INSERT RLS policy on the table — service-role-only by design) | 041 |

## Routes migrated away from service-role

| Route | Migrated in | RLS policy enforcing it |
|---|---|---|
| `app/api/marketplace-btp/route.ts` POST | Phase 3 (commit a8ff66b) | `marketplace_listings_insert` — auth.uid() = user_id |
| `app/api/marketplace-btp/[id]/route.ts` PUT/DELETE | Phase 3 | `marketplace_listings_update` |
| `app/api/marketplace-btp/[id]/demande/route.ts` mutations | Phase 3 | `marketplace_demandes_insert/update` |
| `app/api/tva/settings/route.ts` GET/PATCH | Phase 9 (this commit) | `profiles_artisan_owner_read/update` |
| `app/api/tva/check/route.ts` profile read/update | Phase 9 | same |
| `app/api/rfq/route.ts` GET/POST | Phase 9 | `rfqs_user_policy`, `rfq_items_user_policy`, `offers_user_policy` |

## Audit query

To produce a fresh report of every public-schema RLS policy:

```bash
./scripts/audit-rls.sh > docs/rls-audit.json
```

The output is not versioned — generate it on demand. The script wraps a
`pg_policies` query and is intentionally read-only.

## Adding a new service-role route

Don't, by default. Migrate to `getAuthedClient(token)` first. If service-
role really is required:

1. Add the route to the table above with the legitimate-use category.
2. Document the RLS policy that *would* have covered it had it been
   user-scoped (or note that no such policy is feasible).
3. Cover with a test that verifies auth gating + (where applicable)
   ownership rejection.
