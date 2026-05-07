# On-call playbook

Companion to [docs/slos.md](slos.md) and
[docs/incident-runbook.md](incident-runbook.md).

## Coverage

| Period | Primary | Backup |
|---|---|---|
| Monday – Friday business hours (FR/PT) | `@elgato_fofo` (lead dev) | — |
| Nights, weekends, holidays | best-effort, no SLA | — |

This is a **pre-Series-A solo-dev rotation**. The structured policy
below exists so the first hire doesn't need to reverse-engineer process
from chat logs. All SLA numbers below assume best-effort; the team will
re-publish a real rotation post-hire.

## Severity levels

| Severity | Examples | Acknowledge | Mitigate |
|---|---|---|---|
| **P1** — production down or major data loss | `/api/health` 503 > 5 min, Stripe webhook signature failure spike, mass cancel detected (audit alert) | < 30 min | < 4 h |
| **P2** — degraded user-visible behaviour | API p95 > 3 s sustained, cron didn't run, circuit breaker OPEN > 5 min | < 4 h | next business day |
| **P3** — internal noise, no user impact | repeated `warn` log, low-priority Sentry issue | next business day | best-effort |

## Channels

| Channel | Used for |
|---|---|
| **Sentry alerts → email** + Slack `#vitfix-alerts` (to be created) | All P1 / P2. Email primary, Slack mirror so the second pair of eyes can ack. |
| **GitHub issue** with `incident` label | Post-mortem, due within 5 business days of any P1 |
| **Cloudflare Workers logs** (`wrangler tail`) | Real-time triage |
| **Supabase dashboard logs** | DB-side triage |

PagerDuty is intentionally **not** wired yet — see
[docs/slos.md](slos.md) "Why these numbers (and not 99.9 %)".

## Alert → runbook map

| Alert (key in `monitoring/sentry-alerts.json`) | Severity | First action |
|---|---|---|
| `availability_drop` | P1 | curl `/api/health` → if 503, [incident-runbook.md §A](incident-runbook.md) |
| `error_rate_spike` | P1 | Sentry → top issue → revert if last deploy < 30 min |
| `latency_p95_breach` | P2 | Sentry transactions → slow span → check Supabase / Groq |
| `cron_missing_heartbeat` | P2 | `wrangler tail`, check `background_jobs`, kick the cron manually |
| `stripe_webhook_signature_fail` | P1 | suspicious; check Stripe dashboard webhook log |
| `stripe_webhook_stale_events` | P2 | `stripe_webhook_events` rows idle > 24 h, replay or open Stripe support |
| `circuit_breaker_open` (Groq) | P2 | check Groq status, wait, consider toggling Sentry sample-rate |
| `audit_mass_cancel` | P1 | freeze writes if confirmed; [incident-runbook.md §F](incident-runbook.md) |
| `audit_hash_chain_break` | P1 | freeze devis writes; engineering required |

## Post-mortem requirements

For any P1, within 5 business days:

1. GitHub issue with `incident` label.
2. Timeline (UTC) — first user impact, detection, ack, mitigation, full
   recovery.
3. Root cause (5 whys minimum).
4. Detection gap analysis: was the right alert firing? At the right
   threshold? If not, propose a manifest delta.
5. At least one **action item** with owner + due date, tracked in the
   project board.
6. Decision: was the SLO budget consumed? If yes, freeze non-critical
   deploys until next budget window.

## Tooling links

- Sentry org: `vitfix` (set `SENTRY_ORG`/`SENTRY_PROJECT` in env)
- Cloudflare Workers dashboard: `vitfix-frontend` worker
- Supabase project: `irluhepekbqgquveaett` (region eu-west-1)
- Stripe webhooks dashboard: account `vitfix.io`
- UptimeRobot: monitor against `https://vitfix.io/api/health`

## Escalation if primary unreachable

Only relevant once the rotation has > 1 person. For now: incidents wait
until primary returns (best-effort). Document the wait in the
post-mortem.
