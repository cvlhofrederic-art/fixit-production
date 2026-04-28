# Sentry Alerts — Simulateur V2

## Alert : Hallucinations bloquées en pic

**Dashboard Sentry → Alerts → Create Alert Rule**

- **Type** : Issue Alert
- **Condition** : Number of events with tag `agent_type:simulateur-v2` AND message matches `simulateur-hallucination` is more than `5` in 1 minute
- **Action** : Send notification to #vitfix-alerts (Slack) + email cvlho.frederic@gmail.com
- **Cooldown** : 10 minutes

## Alert : Tool loop exceeded

- **Condition** : Message matches `simulateur-v2: tool_loop_exceeded` more than `1` in 5 minutes
- **Action** : Email + Slack (priorité haute)

## Alert : validateQuote failed

- **Condition** : Message matches `simulateur-v2: validateQuote failed` more than `2` in 10 minutes
- **Action** : Email
