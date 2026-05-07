# SLOs — Service Level Objectives

Source of truth for the targets we hold ourselves to. Not aspirational —
breaches trigger an incident per [docs/oncall.md](oncall.md).

## Scope

The targets below cover **Client / Artisan / BTP Pro** flows on `vitfix.io`
in FR (Marseille / PACA) and PT (Porto / Tamega e Sousa). Dormant rôles
(Syndic, Copro, Conciergerie, Gestionnaire) are explicitly out of scope.

## Targets

| Indicator | Target | Window | How we measure |
|---|---|---|---|
| **Availability** (HTTP success) | ≥ **99.5 %** | rolling 30 days | UptimeRobot probes against `/api/health` + Sentry transaction success rate |
| **Error rate** (HTTP 5xx / total) | < **0.5 %** | rolling 24 h | Sentry transactions filtered on `http.status_code >= 500` over `http.method = *` |
| **API p95 latency** | < **3 000 ms** | rolling 1 h | Sentry transaction `transaction.duration` for `app/api/**` |
| **Critical agent latency** (`/api/fixy-ai`, `/api/devis*`) p95 | < **5 000 ms** | rolling 1 h | same, filtered |
| **Cron reliability** | **100 %** runs/day | daily | `cron_heartbeats` table — alert if expected cron has no row at +30 min from schedule |
| **Stripe webhook delivery** | ≥ **99 %** | rolling 24 h | `stripe_webhook_events` table — alert on delivery rate dip OR > 0 events idle > 24 h |
| **Circuit breaker uptime** (Groq) | ≥ **99 %** time CLOSED | rolling 24 h | `logger.circuitState()` events to Sentry |
| **Background job completion** | ≥ **98 %** | rolling 24 h | `background_jobs.status = 'completed'` ratio |

## Error budget

| Indicator | Budget per 30 days |
|---|---|
| Availability 99.5 % | 3 h 36 min downtime |
| Error rate 0.5 % | 0.5 % of all requests can be 5xx |
| API p95 latency 3 s | breaches counted per-hour, max 12 breach-hours / month |

When a budget is **exhausted**, no non-critical deploys ship until the
budget recovers (week-long lookback). Hot-fixes and security patches
always ship — see deployment-playbook.md.

## Why these numbers (and not 99.9 %)

We're pre-Series A with a single small Cloudflare Workers deploy + one
Supabase project. 99.9 % availability would require multi-region
read-replicas, a circuit-broken Stripe path, and 24/7 on-call — not
justified before product-market fit. The 99.5 % target gives us **3 h
36 min budget per month**, which matches what UptimeRobot has historically
reported (~99.6 % on rolling 30 days as of writing).

We will revisit these numbers post-Series A when traffic and team allow
real on-call rotations. Until then: alert thresholds tight (page on
breach) but error budget realistic.

## Alert mapping

Each row above maps to an alert in
[monitoring/sentry-alerts.json](../monitoring/sentry-alerts.json) and a
runbook section in [docs/incident-runbook.md](incident-runbook.md).
Adding a new alert requires: (a) SLO entry here, (b) manifest entry,
(c) runbook entry.
