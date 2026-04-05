# Incident Response Runbook — Vitfix.io

## Contacts & escalation

| Rôle | Contact | Quand |
|------|---------|-------|
| Lead dev | @elgato_fofo | Tout incident |
| Supabase support | support@supabase.io | DB down > 15min |
| Vercel support | Dashboard > Support | Deploy bloqué |
| Stripe support | Dashboard > Help | Paiements échoués |

---

## Incident 1 — Site down (5xx ou timeout)

**Diagnostic :**
```bash
# 1. Vérifier le health check
curl -s https://fixit-production.vercel.app/api/health | jq .

# 2. Vérifier le status des providers
# Vercel : https://www.vercel-status.com
# Supabase : https://status.supabase.com

# 3. Vérifier les logs Vercel
# Dashboard > Project > Logs > Runtime Logs (filtrer par erreur)
```

**Actions :**

| Cause | Action |
|-------|--------|
| Health check `database: unhealthy` | Vérifier Supabase status. Si OK, vérifier `SUPABASE_SERVICE_ROLE_KEY` dans Vercel env vars |
| Health check `environment: unhealthy` | Env vars manquantes — vérifier Vercel > Settings > Environment Variables |
| Vercel 504 Gateway Timeout | Fonction serverless timeout (>60s). Vérifier les logs, identifier la route lente |
| Vercel en panne globale | Attendre. Pas de failover possible (serverless mono-provider) |
| Deploy cassé | Rollback : Vercel Dashboard > Deployments > cliquer "..." sur le deploy précédent > Promote |

**Temps cible :** Diagnostic < 5min, résolution < 30min.

---

## Incident 2 — Base de données inaccessible

**Diagnostic :**
```bash
# Tester la connexion directe
curl -s https://fixit-production.vercel.app/api/health | jq '.checks.database'

# Vérifier Supabase
# Dashboard > Database > Connection Pooler status
# Dashboard > Reports > Database Health
```

**Actions :**

| Cause | Action |
|-------|--------|
| Supabase en maintenance | Attendre (planifié) ou contacter support (non planifié) |
| Connection pool saturé | Dashboard > Database > voir connexions actives. Redémarrer le project si nécessaire |
| Migration cassée | Identifier la migration fautive dans `supabase/migrations/`. Écrire une migration corrective, ne jamais modifier l'existante |
| Données corrompues | Restaurer : Dashboard > Database > Backups > sélectionner snapshot > Restore |

**Temps cible :** Diagnostic < 5min, restore < 1h (RTO actuel ~2h).

---

## Incident 3 — Agents IA non fonctionnels

**Diagnostic :**
```bash
# Tester Groq directement
curl -s https://fixit-production.vercel.app/api/fixy-ai -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"test","userId":"test"}' | head -c 200

# Vérifier Groq status : https://status.groq.com
# Vérifier Langfuse traces : Dashboard > Traces (dernières 15min)
# Vérifier Sentry : filtrer tag agent_type
```

**Actions :**

| Cause | Action |
|-------|--------|
| Groq 429 (rate limit) | Le circuit breaker bascule auto sur 8B. Vérifier `lib/circuit-breaker.ts` état |
| Groq 500/503 | Fallback automatique. Si persistant > 1h, considérer OpenRouter comme provider temporaire |
| `GROQ_API_KEY` invalide | Régénérer sur console.groq.com, mettre à jour dans Vercel env vars, redeploy |
| Réponses incohérentes | Vérifier Langfuse pour le prompt. Comparer avec `ai-eval.yml` baseline |

**Temps cible :** Auto-résolu via circuit breaker. Manuel si > 1h.

---

## Incident 4 — Paiements Stripe échoués

**Diagnostic :**
```bash
# Vérifier les webhooks
# Stripe Dashboard > Developers > Webhooks > voir les événements récents
# Filtrer par status "Failed"

# Vérifier les logs API
# Vercel > Logs > filtrer /api/stripe/webhook
```

**Actions :**

| Cause | Action |
|-------|--------|
| Webhook signature invalide | `STRIPE_WEBHOOK_SECRET` a changé. Recréer le webhook endpoint dans Stripe Dashboard, copier le nouveau secret dans Vercel |
| Webhooks non délivrés | Stripe Dashboard > Webhooks > Retry failed events |
| Checkout échoue | Vérifier `STRIPE_SECRET_KEY` et `STRIPE_PRICE_*` IDs dans Vercel env vars |
| Doublons de paiement | Table `stripe_webhook_events` assure l'idempotence. Vérifier les entrées dupliquées dans Supabase |

**Temps cible :** Diagnostic < 10min, résolution < 30min.

---

## Incident 5 — Fuite de données / compromission

**Actions immédiates (dans l'ordre) :**

1. **Révoquer** les clés compromises (Supabase, Groq, Stripe, etc.)
2. **Régénérer** de nouvelles clés sur chaque dashboard
3. **Mettre à jour** les env vars Vercel + redeploy
4. **Vérifier** les logs d'accès Supabase (Dashboard > Logs > Auth)
5. **Notifier CNIL** sous 72h si données personnelles (RGPD Art. 33)
6. **Notifier** les utilisateurs affectés (RGPD Art. 34)
7. **Documenter** : date, scope, cause, actions prises

**Checklist post-incident :**
- [ ] Toutes les clés tournées
- [ ] TruffleHog scan propre (`npm run scan:secrets`)
- [ ] Audit RLS vérifié (`supabase/migrations/041_rls_complete_audit.sql`)
- [ ] CNIL notifié (si applicable)
- [ ] Post-mortem rédigé

---

## Incident 6 — Cron jobs silencieusement cassés

**Diagnostic :**
```bash
# Vérifier les exécutions récentes
# Vercel Dashboard > Project > Crons > voir historique

# Vérifier les logs
# Vercel > Logs > filtrer par /api/cron/ ou /api/sync/
```

**Actions :**

| Cause | Action |
|-------|--------|
| `CRON_SECRET` invalide | Vérifier que le secret match dans Vercel env vars |
| Timeout (>60s) | La sync de données externe est trop lente. Paginer ou réduire le scope |
| API externe down (DECP, SITADEL) | Les crons échoueront silencieusement. Vérifier les sources manuellement |
| Pas d'exécution visible | Vérifier `vercel.json` — les crons ne tournent qu'en production (pas preview) |

---

## Post-incident

Après chaque incident résolu :

1. **Timeline** : noter les heures exactes (détection, diagnostic, résolution)
2. **Impact** : nombre d'utilisateurs affectés, durée d'indisponibilité
3. **Cause racine** : 5 whys
4. **Actions préventives** : quoi mettre en place pour éviter la récurrence
5. **Stocker** le post-mortem dans `docs/postmortems/YYYY-MM-DD-titre.md`
