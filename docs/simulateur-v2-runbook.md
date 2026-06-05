# Simulateur V2 — Runbook opérationnel

## Activer V2 progressivement (Phase 5)

```bash
# Test interne d'abord (équipe Vitfix uniquement)
# → Cookie navigateur : vitfix_sim_v2=on

# Puis bascule progressive (palier 24-72 h chacun)
wrangler secret put SIMULATEUR_V2_ROLLOUT  # entrer "10"
# Surveiller Langfuse 24-72 h, puis :
wrangler secret put SIMULATEUR_V2_ROLLOUT  # "25"
# Idem :
wrangler secret put SIMULATEUR_V2_ROLLOUT  # "50"
wrangler secret put SIMULATEUR_V2_ROLLOUT  # "100"
```

## Rollback instantané

```bash
# Option 1 : kill-switch (toutes nouvelles requêtes en V1)
wrangler secret put SIMULATEUR_V2_FORCE_V1  # entrer "true"

# Option 2 : redescente progressive
wrangler secret put SIMULATEUR_V2_ROLLOUT  # "0"
```

Les utilisateurs avec cookie sticky V2 retombent en V1 instantanément (le flag est checké à chaque requête).

## Override admin pour test interne

Dans la console navigateur :

```javascript
document.cookie = "vitfix_sim_v2=on; path=/; max-age=2592000"  // 30 j
// Ou pour forcer V1 :
document.cookie = "vitfix_sim_v2=off; path=/; max-age=2592000"
// Effacer :
document.cookie = "vitfix_sim_v2=; path=/; max-age=0"
```

## Lire les traces Langfuse

Dashboard Langfuse → filter `name:simulateur-travaux`.

Tags à utiliser pour la comparaison V1/V2 :
- `arm:v1` vs `arm:v2`
- `mode:normal` vs `mode:out-of-catalog`
- `mode:none` (V1, pas de mode tracé)

KPI à surveiller pendant les paliers :
- p50/p95 latence par arm
- Distribution `mode` (% out-of-catalog par arm)
- `hallucinationsBlocked` par 1000 requêtes (cible : < 5)
- `unknownPlaceholders` par 1000 requêtes (cible : 0)
- Erreurs (`error:tool_loop_exceeded`, `error:validation_failed`)

## Diagnostic Sentry

Filter : `agent_type:simulateur-v2`

Messages à investiguer en priorité :
- `simulateur-hallucination` : pic ⇒ prompt à renforcer
- `simulateur-v2: tool_loop_exceeded` : LLM tourne en rond ⇒ inspecter la conversation
- `simulateur-v2: validateQuote failed` : invariants cassés ⇒ data integrity issue

## Workflow de mise à jour des prix

Indépendant du runbook V2 — voir `docs/prix-2026-methodology.md` et le workflow `prix-freshness.yml` (Phase 6).

## Dépréciation V1 (post-Phase 5)

Après 30 j à 100 % V2 sans rollback :

```bash
# Supprimer route-v1.ts + lib/prix-travaux.ts + handleV1 import
# PR dédiée, intitulée "chore(simulateur-v2): drop V1 fallback after 30d clean"
```
