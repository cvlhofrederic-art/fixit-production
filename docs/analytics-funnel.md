# Analytics & funnel reference — PostHog

The app captures product events into two destinations:

1. **Internal `analytics_events` table** via `/api/analytics/track` (the
   pre-existing pipeline in [lib/analytics.ts](../lib/analytics.ts)).
2. **PostHog** via the client wrapper ([lib/posthog/client.ts](../lib/posthog/client.ts))
   and the server wrapper ([lib/posthog/server.ts](../lib/posthog/server.ts)).

Both writes are gated behind the same GDPR consent
(`localStorage.vitfix_cookie_consent.performance === true`) and behave as
no-ops when the consent flag is off or when no PostHog key is wired.

## Activation

Add three secrets / vars:

```
wrangler secret put NEXT_PUBLIC_POSTHOG_KEY     # publishable key (phc_…)
wrangler secret put POSTHOG_API_KEY             # server-only key (or reuse the public one)
# NEXT_PUBLIC_POSTHOG_HOST is already inlined in wrangler.toml
```

Without those secrets the SDK never loads, the bridge never fires, and
`/api/analytics/track` keeps working alone.

## Event catalogue

### Captured client-side (via `trackEvent` in `lib/analytics.ts`)

| Event | Where | Properties |
|---|---|---|
| `page_view` | every nav (router hook) | `referrer` |
| `signup_started` | client + artisan signup forms | `role`, `client_type` |
| `signup_completed` | post-signup confirmation | `role` |
| `profile_completed` | post-onboarding (KBIS + ID uploaded) | `role` |
| `booking_created` | client booking flow | `service`, `city` |
| `search_performed` | search input submit | `query`, `locale` |
| `feature_used` | misc dashboard actions | `feature_name` |
| `error_occurred` | client error boundaries | `code`, `message` |

These continue to be captured exactly as before — the PostHog bridge in
`lib/analytics.ts` fans them out without touching call-sites.

### Captured server-side (via `captureServer` in `lib/posthog/server.ts`)

| Event | Route | distinctId | Properties |
|---|---|---|---|
| `devis_created` | [app/api/devis/sync/route.ts](../app/api/devis/sync/route.ts) | `artisanId` | `numero`, `status`, `total_ht_cents` |
| `facture_created` | same route, `docType=facture` | `artisanId` | same |
| `devis_accepted` | [app/api/devis-sign/route.ts](../app/api/devis-sign/route.ts) | client `user.id` | `booking_id`, `doc_number` |
| `checkout_completed` | [app/api/stripe/webhook/route.ts](../app/api/stripe/webhook/route.ts) | Stripe metadata `userId` | `plan_id`, `amount_total`, `currency` |
| `subscription_started` | same | userId | `plan_id` |
| `subscription_canceled` | same | userId | `previous_plan_id` |

Server-side captures use the Supabase user id as the distinct ID, which
is the same id `posthog.identify()` posts client-side after `SIGNED_IN`.
That keeps the same person across both channels.

## Person identification

`PostHogProvider` ([components/common/PostHogProvider.tsx](../components/common/PostHogProvider.tsx))
hooks Supabase auth:

```ts
identify(user.id, {
  email: user.email,
  role: user.app_metadata.role,        // client | artisan | pro_societe | …
  locale,                              // fr | pt | en | nl | es
  signed_up_at: user.created_at,
})
```

`person_profiles: 'identified_only'` in the SDK config means anonymous
visitors don't generate person rows — useful to keep the MAU count
honest while still firing events for funnel analysis.

## Reference queries (PostHog SQL)

### D7 retention by role

```sql
SELECT
  role AS cohort,
  COUNT(DISTINCT person_id) AS cohort_size,
  COUNT(DISTINCT CASE
    WHEN day_diff BETWEEN 1 AND 7 THEN person_id
  END) AS retained_d7,
  ROUND(
    COUNT(DISTINCT CASE WHEN day_diff BETWEEN 1 AND 7 THEN person_id END)::float
    / NULLIF(COUNT(DISTINCT person_id), 0) * 100,
    1
  ) AS retention_d7_pct
FROM (
  SELECT
    e.person_id,
    properties.role AS role,
    DATE_DIFF('day', toDate(p.created_at), toDate(e.timestamp)) AS day_diff
  FROM events e
  JOIN persons p USING (person_id)
  WHERE event = 'session_started'
)
GROUP BY role
```

Replace `BETWEEN 1 AND 7` with `BETWEEN 1 AND 30` for D30 retention.

### Activation funnel (signup → first devis → first checkout)

```sql
WITH steps AS (
  SELECT person_id, MIN(timestamp) AS t
  FROM events
  WHERE event = 'signup_completed'
  GROUP BY person_id
), step2 AS (
  SELECT person_id, MIN(timestamp) AS t
  FROM events
  WHERE event = 'devis_created'
  GROUP BY person_id
), step3 AS (
  SELECT person_id, MIN(timestamp) AS t
  FROM events
  WHERE event = 'checkout_completed'
  GROUP BY person_id
)
SELECT
  COUNT(*) AS signups,
  COUNT(step2.person_id) AS reached_devis,
  COUNT(step3.person_id) AS reached_checkout,
  ROUND(COUNT(step2.person_id)::float / NULLIF(COUNT(*), 0) * 100, 1) AS pct_to_devis,
  ROUND(COUNT(step3.person_id)::float / NULLIF(COUNT(*), 0) * 100, 1) AS pct_to_checkout
FROM steps
LEFT JOIN step2 USING (person_id)
LEFT JOIN step3 USING (person_id)
```

### MRR signal cross-check vs `subscription_metrics` table

The Stripe webhook + `subscription_metrics` table (migration 100) is the
authoritative source for MRR. PostHog `subscription_started` /
`subscription_canceled` events are useful for **timing**: time-from-signup
to first paid plan, churn cohort by signup week, etc. They should never
be trusted alone for the MRR number — webhooks dedupe but PostHog can be
opted-out of.

## Operational

- The PostHog SDK never blocks a request: every server `captureServer`
  call is `void`-fired and swallows its own errors.
- Client init is lazy (first `trackEvent` triggers `posthog.init`). Pages
  with no analytics never download the SDK.
- Consent flips are picked up within 5 s thanks to the polling in
  `PostHogProvider`. A user revoking consent will trigger
  `opt_out_capturing()` on the running client.

## Tests

| File | Covers |
|---|---|
| [tests/lib/posthog-client.test.ts](../tests/lib/posthog-client.test.ts) | consent gate, lazy init, identify/reset/optIn/optOut wiring |
| [tests/lib/posthog-server.test.ts](../tests/lib/posthog-server.test.ts) | env-key fallback, capture forwarding, never-throw guarantee, flush |
