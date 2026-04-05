# Monitoring & Observabilité — Vitfix.io

> Dernière mise à jour : 5 avril 2026

---

## 1. Vue d'ensemble

La stack de monitoring repose sur cinq composants complémentaires :

| Outil | Rôle | Données collectées |
|-------|------|--------------------|
| **Sentry** | Error tracking + traces | Exceptions JS/API, breadcrumbs, tags agent_type |
| **Langfuse** | Observabilité LLM | Traces des 10 agents IA, tokens, latence, coût |
| **UptimeRobot** | Monitoring externe | Disponibilité site (health, /fr/, /pt/) |
| **Vercel Analytics** | Performance runtime | Logs serverless, durée fonctions, cold starts |
| **Health endpoint** | Auto-diagnostic interne | DB, env vars, uptime, version |

Flux typique d'un incident : UptimeRobot détecte l'indisponibilité, envoie une alerte email. Le health endpoint identifie le composant défaillant. Sentry fournit la stack trace. Les Vercel Logs donnent le contexte d'exécution.

---

## 2. Sentry — Error Tracking

### Configuration

- Sampling rate : **10%** des traces (suffisant pour détecter les patterns, économe en quota)
- Les erreurs (`captureException`) sont envoyées à 100%, seules les traces de performance sont échantillonnées
- SDK : `@sentry/nextjs` intégré côté client et serveur

### Tags automatiques

Le logger (`lib/logger.ts`) enrichit chaque erreur envoyée à Sentry avec :

- `userId` : 8 premiers caractères de l'ID utilisateur
- `tenantId` : 8 premiers caractères de l'ID cabinet
- `module` : nom du module source (ex: `api/missions`, `email-agent`)
- Niveau `fatal` : toujours envoyé, même sans objet Error

### Règles d'alerte recommandées

1. **High error rate** : plus de 5 occurrences du même issue en 5 minutes
2. **Fatal errors** : toute nouvelle issue de niveau `fatal` (notification immédiate)

### Utilisation du logger

```typescript
import { logger } from '@/lib/logger'

// Log simple (info dans Vercel Logs, pas envoyé à Sentry)
logger.info('Mission créée', { missionId: '123' })

// Erreur (envoyée à Sentry avec contexte)
logger.error('Échec création devis', { userId, module: 'devis' }, err)

// Fatal (envoyé à Sentry avec level fatal)
logger.fatal('Base de données inaccessible', { module: 'health' }, err)

// Logger scopé pour un tenant
const log = logger.withTenant('api/missions', userId, cabinetId)
log.info('Mission assignée')
log.error('Échec assignation', { reason: 'quota' }, err)
```

Le niveau `debug` n'est émis qu'en `NODE_ENV=development`.

---

## 3. Langfuse — Observabilité IA

### Agents tracés

Les 10 agents IA sont instrumentés via `lib/langfuse.ts` :

Fixy AI artisan, Fixy Chat, Simulateur travaux, Matériaux AI, Email Agent, Max Syndic, Analyse Devis (x2), Comptable AI, Copro AI.

### Données collectées par trace

- **Input/output** : prompt et réponse complète
- **Tokens** : input + output (pour suivi coût)
- **Latence** : temps de réponse Groq en ms
- **Metadata** : commande vocale (oui/non), action déclenchée, session ID

### Instrumentation

```typescript
import { traceAgent } from '@/lib/langfuse'

const trace = traceAgent({
  agentName: 'fixy-artisan',
  userId: user.id,
  sessionId: sessionId,
})

// Après l'appel LLM
trace.generation({
  model: 'llama-3.3-70b-versatile',
  input: prompt,
  output: response,
  tokensInput: usage.prompt_tokens,
  tokensOutput: usage.completion_tokens,
  latencyMs: elapsed,
  isVoiceCommand: true,
  actionTriggered: 'create_devis',
})

trace.end()
```

Si les variables `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` sont absentes, `traceAgent` retourne un no-op (pas d'erreur).

### Évaluation nocturne

Le workflow `langfuse-eval.yml` tourne chaque nuit. Si le score qualité global descend sous **0.7**, il crée automatiquement une issue GitHub. Vérifier dans Langfuse Dashboard > Scores pour le détail par agent.

---

## 4. Health Endpoint

**Route** : `GET /api/health`

### Checks effectués

| Check | Méthode | Résultat |
|-------|---------|----------|
| **database** | `SELECT id FROM profiles_artisan LIMIT 1` via Supabase | `healthy` / `unhealthy` + latence en ms |
| **environment** | Vérifie 3 env vars critiques (SUPABASE_URL, SERVICE_ROLE_KEY, ANON_KEY) | `healthy` / `unhealthy` + nombre manquant |

### Réponse type

```json
{
  "status": "healthy",
  "timestamp": "2026-04-05T10:00:00.000Z",
  "uptime_seconds": 86400,
  "version": "0.1.0",
  "checks": {
    "database": { "status": "healthy", "latency_ms": 45 },
    "environment": { "status": "healthy" }
  }
}
```

- **HTTP 200** : tous les checks OK
- **HTTP 503** : au moins un check `unhealthy` (le champ `status` passe à `degraded`)

Le cron Vercel appelle ce endpoint tous les jours à 6h UTC.

---

## 5. UptimeRobot — Monitoring externe

Trois monitors configurés via `scripts/setup-monitoring.sh` (+ un quatrième pour le webhook Stripe) :

| Monitor | Type | URL | Intervalle | Vérification |
|---------|------|-----|------------|-------------|
| Health Check | Keyword | `/api/health` | 5 min | Présence du mot `healthy` |
| Homepage FR | HTTP(s) | `/fr/` | 5 min | HTTP 200 |
| Homepage PT | HTTP(s) | `/pt/` | 5 min | HTTP 200 |
| Stripe Webhook | HTTP(s) | `/api/stripe/webhook` | 10 min | Endpoint joignable |

### Setup

```bash
UPTIMEROBOT_API_KEY=ur_xxxxx bash scripts/setup-monitoring.sh
```

Après exécution : aller dans UptimeRobot Dashboard, ajouter un Alert Contact (email), puis l'associer aux 4 monitors.

---

## 6. Logs — Vercel Runtime

### Format

Tous les logs serveur passent par `lib/logger.ts` qui produit du JSON structuré :

```json
{
  "timestamp": "2026-04-05T10:30:00.000Z",
  "level": "error",
  "message": "Groq API timeout",
  "context": { "module": "fixy-artisan", "userId": "abc12345", "route": "/api/fixy-ai" },
  "error": { "name": "TimeoutError", "message": "Request timed out after 30s" }
}
```

### Niveaux

| Niveau | Destination | Usage |
|--------|------------|-------|
| `debug` | Console (dev only) | Traces de développement, jamais en production |
| `info` | Vercel Logs | Événements normaux (création, modification) |
| `warn` | Vercel Logs | Situations anormales non bloquantes (rate limit, fallback) |
| `error` | Vercel Logs + Sentry | Erreurs applicatives avec stack trace |
| `fatal` | Vercel Logs + Sentry (level fatal) | Pannes critiques (DB down, service indisponible) |

### Logger API

`logger.api(route, method, statusCode, durationMs, context)` produit automatiquement le bon niveau selon le code HTTP : 5xx = error, 4xx = warn, reste = info.

### Consulter les logs

Vercel Dashboard > Project fixit-production > Logs > Runtime Logs. Filtrer par niveau ou par texte libre sur le JSON.

---

## 7. Circuit Breaker — Résilience IA

Implémenté dans `lib/circuit-breaker.ts`. Protège contre les cascades de pannes quand un service externe tombe.

### États

```
CLOSED (normal) → 5 échecs consécutifs → OPEN (rejette immédiatement)
OPEN → après 30s → HALF_OPEN (laisse passer 1 requête de test)
HALF_OPEN → succès → CLOSED / échec → OPEN
```

### Circuits configurés

| Circuit | Seuil d'ouverture | Timeout de reset | Fallback |
|---------|-------------------|------------------|----------|
| **groq** | 5 échecs | 30 secondes | Bascule de Llama 3.3 70B vers Llama 3.1 8B |
| **api-gouv** | 3 échecs | 60 secondes | Données en cache / skip |

### Comportement en production

Quand le circuit Groq s'ouvre, toute requête IA reçoit immédiatement une erreur `Circuit breaker [groq] is OPEN`. Le code appelant doit alors utiliser le modèle 8B de fallback. Après 30 secondes, une requête test passe : si elle réussit, le circuit se referme.

---

## 8. Rate Limiting

Implémenté dans `lib/rate-limit.ts` avec Upstash Redis en production et un fallback en mémoire pour le développement local.

### Configuration par défaut

- **Algorithme** : Sliding window
- **Limite** : 20 requêtes par fenêtre de 60 secondes
- **Préfixe Redis** : `fixit:ratelimit`
- **Analytics** : activées (visible dans le dashboard Upstash)

### Identifiants de rate limit

Chaque endpoint utilise un identifiant spécifique : `upload_${ip}`, `api_${userId}`, etc. Cela permet des limites différenciées par type d'opération.

### Fallback en mémoire

Si Redis est inaccessible, le système bascule automatiquement sur un rate limiter en mémoire (Map JS). Limite de sécurité : 10 000 entrées max pour éviter les fuites mémoire sur Vercel. Nettoyage automatique toutes les 5 minutes.

### Réponse 429

Format standardisé : `{ "error": "Too many requests. Please wait before retrying." }` avec header `Retry-After: 60`.

---

## 9. Cron Jobs

11 jobs configurés dans `vercel.json`. Ils ne tournent qu'en **production** (pas en preview).

| Job | Route | Schedule (UTC) | Fonction |
|-----|-------|----------------|----------|
| Health check | `/api/health` | Tous les jours 6h | Vérifie DB + env vars |
| Email agent poll | `/api/email-agent/poll` | Tous les jours 8h | Relève emails syndic via Gmail API |
| Referral sync | `/api/cron/referral` | Tous les jours 2h | Synchronise les parrainages |
| Tender scan | `/api/tenders/scan` | Lundi 5h | Scan nouveaux appels d'offres |
| DECP sync | `/api/sync/decp-13` | Lundi 7h | Données marchés publics BdR |
| SITADEL sync | `/api/sync/sitadel-13` | Lundi 7h | Permis de construire BdR |
| Mairies sync | `/api/sync/mairies-13` | Lundi 7h30 | Marchés communaux BdR |
| Base GOV PT | `/api/sync/base-gov-pt` | Lundi 8h | Marchés publics Portugal |
| TED Porto | `/api/sync/ted-porto` | Lundi 8h30 | Appels d'offres EU Porto |
| Obras Porto | `/api/sync/obras-porto` | Lundi 9h | Travaux municipaux Porto |
| Scan marchés | `/api/cron/scan-marches` | Lundi 6h | Agrégateur marchés publics |

### Vérifier l'exécution

1. Vercel Dashboard > Project > Crons : historique d'exécution avec statut et durée
2. Vercel Logs : filtrer par `/api/cron/` ou `/api/sync/`
3. Les crons authentifient via `CRON_SECRET` (header `Authorization: Bearer`)

### Pannes courantes

- **Pas d'exécution visible** : les crons ne tournent qu'en production. Vérifier que le deploy est sur la branche main.
- **Timeout (>60s)** : la source externe (DECP, SITADEL) est lente. Paginer les requêtes ou réduire le scope.
- **CRON_SECRET invalide** : le job retourne 401. Comparer la valeur dans Vercel env vars.
- **API externe down** : le cron échoue silencieusement. Aucune alerte native. Voir section 10 pour les seuils recommandés.

---

## 10. Alertes et seuils recommandés

### Sentry

| Règle | Condition | Action |
|-------|-----------|--------|
| High error rate | > 5 events du même issue en 5 min | Email |
| Fatal errors | Nouvelle issue level `fatal` | Email immédiat |
| Unhandled errors | Nouvelle issue `unhandled: true` | Email |

### UptimeRobot

| Monitor | Seuil | Action |
|---------|-------|--------|
| Health Check | Keyword `healthy` absent 2 checks consécutifs | Email + (optionnel) Slack webhook |
| Homepage FR/PT | HTTP != 200 pendant 2 checks | Email |

### Langfuse

| Métrique | Seuil | Action |
|----------|-------|--------|
| Score qualité global | < 0.7 | Issue GitHub auto (via `langfuse-eval.yml`) |
| Latence moyenne agent | > 5 000 ms | Vérifier manuellement dans Langfuse Dashboard |
| Taux d'erreur agent | > 10% sur 24h | Investiguer les traces en erreur |

### Vercel

| Métrique | Seuil | Action |
|----------|-------|--------|
| Deploy failed | Tout échec | Notification email (configurer dans Settings > Notifications) |
| Function duration | > 30s récurrent | Optimiser la route ou augmenter le timeout |
| Cron failure | 3 échecs consécutifs d'un même job | Vérifier logs + source externe |

### Circuit Breaker

| Circuit | Signal d'alerte | Action |
|---------|----------------|--------|
| Groq | Circuit OPEN > 5 minutes | Vérifier https://status.groq.com, le fallback 8B est actif |
| api-gouv | Circuit OPEN > 10 minutes | Vérifier la source, les données en cache restent servies |

### Upstash Redis

| Métrique | Seuil | Action |
|----------|-------|--------|
| Commandes/jour | > 80% du quota free tier | Upgrader ou réduire le trafic |
| Latence Redis | > 100 ms | Vérifier le dashboard Upstash |

---

## 11. Dashboard recommandé

Pas de dashboard unifié pour l'instant. Les métriques sont réparties entre plusieurs outils. Voici où trouver chaque information :

### Santé globale

- **UptimeRobot** : uptime %, temps de réponse, historique d'incidents
- **`/api/health`** : état temps réel de la DB et des env vars
- **Vercel Dashboard > Crons** : statut des 11 jobs planifiés

### Erreurs et performance

- **Sentry** : issues triées par fréquence, filtrer par tag `module` ou `agent_type`
- **Vercel Logs** : logs runtime en temps réel, filtrer par niveau error/warn
- **Vercel Analytics** : Web Vitals (LCP, FID, CLS) si activé

### IA et LLM

- **Langfuse Dashboard** : traces par agent, tokens consommés, latence, scores qualité
- **Langfuse > Sessions** : regroupement par session utilisateur pour débugger un parcours complet
- **Langfuse > Scores** : résultats des évals nocturnes

### Sécurité et rate limiting

- **Upstash Console** : nombre de requêtes rate-limitées, commandes Redis/jour
- **Sentry** : filtrer les erreurs 429 pour détecter des abus
- **Vercel Logs** : chercher `rate-limit` dans les logs warn

### Métriques à surveiller chaque semaine

1. Taux d'erreur Sentry (tendance sur 7 jours)
2. Uptime UptimeRobot (objectif : > 99.5%)
3. Score qualité Langfuse par agent (objectif : > 0.7)
4. Nombre de circuits ouverts dans la semaine
5. Exécution des 11 crons (tous doivent avoir tourné lundi)
6. Latence DB via health endpoint (objectif : < 100 ms)
