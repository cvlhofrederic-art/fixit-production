# Guide de troubleshooting — Vitfix.io

Référence rapide pour diagnostiquer et corriger les problèmes courants en développement et en production.

---

## 1. Problèmes d'installation

### Node.js version incorrecte

**Symptôme :** `npm ci` échoue avec des erreurs de compatibilité, ou des modules natifs ne compilent pas.

**Cause :** Le projet requiert Node.js 20+. Une version antérieure provoque des incompatibilités avec les dépendances (React 19, Next.js 16, etc.).

**Fix :**
```bash
node -v  # Doit afficher v20.x ou supérieur
nvm install 20 && nvm use 20  # Si nvm installé
```

### npm ci échoue

**Symptôme :** Erreur `npm ERR! could not resolve dependency tree` ou `npm ERR! peer dep missing`.

**Cause :** Le lockfile (`package-lock.json`) est désynchronisé, ou `npm install` a été utilisé à la place de `npm ci`.

**Fix :**
```bash
rm -rf node_modules
npm ci  # Toujours npm ci, jamais npm install
```

Si le lockfile est cassé (après un merge conflictuel) :
```bash
rm package-lock.json node_modules -rf
npm install  # Régénère le lockfile
npm ci       # Vérifie qu'il est propre
```

### Dépendances manquantes au runtime

**Symptôme :** `Error: Cannot find module 'xxx'` au démarrage.

**Cause :** Le module n'est pas dans `node_modules`, souvent après un pull sans `npm ci`.

**Fix :** Relancer `npm ci` après chaque `git pull` qui modifie `package.json`.

---

## 2. Variables d'environnement

### Variable manquante

**Symptôme :** Erreur au démarrage ou crash API : `TypeError: Cannot read properties of undefined`.

**Cause :** Le fichier `.env.local` n'existe pas ou il manque une variable requise.

**Fix :**
```bash
cp .env.example .env.local
# Remplir les valeurs obligatoires (voir DEVELOPER_ONBOARDING.md §3)
```

Variables strictement requises pour le dev local :
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (mettre `http://localhost:3000`)
- `GROQ_API_KEY`, `ADMIN_EMAIL`, `CRON_SECRET`, `RESEND_API_KEY`

### Mauvais format de clé

**Symptôme :** `401 Unauthorized` ou `Invalid API key` sur Supabase/Groq/Stripe.

**Cause :** Copier-coller avec espaces ou retours à la ligne invisibles.

**Fix :** Ouvrir `.env.local`, vérifier qu'il n'y a pas d'espace avant/après le `=` ni de guillemets inutiles. Format correct : `GROQ_API_KEY=gsk_abc123` (pas de quotes).

### Confusion server vs client

**Symptôme :** Variable accessible côté serveur mais `undefined` côté client (ou inversement).

**Cause :** Seules les variables préfixées `NEXT_PUBLIC_` sont exposées au navigateur. `SUPABASE_SERVICE_ROLE_KEY` (sans préfixe) n'existe pas côté client, c'est voulu.

**Fix :** Ne jamais exposer les clés serveur au client. Si une variable doit être lue dans un composant React, elle doit commencer par `NEXT_PUBLIC_`.

---

## 3. Base de données (Supabase)

### Connexion refusée

**Symptôme :** `FetchError: request failed` ou health check `database: unhealthy`.

**Cause :** Supabase local non démarré, ou clés cloud invalides.

**Fix (local) :**
```bash
supabase start   # Requiert Docker
supabase status  # Copier API URL et anon key dans .env.local
```

**Fix (cloud) :** Vérifier le status sur https://status.supabase.com. Vérifier les clés dans le dashboard Supabase > Settings > API.

### RLS bloque les requêtes

**Symptôme :** La requête retourne un tableau vide `[]` alors que les données existent dans la table.

**Cause :** Row Level Security (RLS) filtre les lignes. Le client browser (`lib/supabase.ts`) respecte les politiques RLS. Si l'utilisateur n'est pas authentifié ou n'a pas les droits, les lignes sont invisibles.

**Fix :** Vérifier que l'utilisateur est connecté. Pour du debug, utiliser `supabaseAdmin` (server-side uniquement) qui bypass le RLS. Consulter les politiques dans `supabase/migrations/`.

### Migration échoue

**Symptôme :** `supabase db reset` échoue avec une erreur SQL.

**Cause :** Une migration contient une erreur de syntaxe ou une dépendance sur un objet inexistant.

**Fix :** Ne jamais modifier une migration existante. Créer une migration corrective :
```bash
supabase migration new fix_nom_descriptif
# Corriger dans le nouveau fichier SQL
supabase db reset
```

---

## 4. Développement local

### npm run dev échoue

**Symptôme :** Erreur au lancement, port déjà utilisé, ou crash immédiat.

**Cause possible 1 :** Port 3000 occupé par un autre processus.
```bash
lsof -i :3000          # Identifier le processus
kill -9 <PID>          # Le terminer
npm run dev
```

**Cause possible 2 :** Variables d'environnement manquantes (voir section 2).

**Cause possible 3 :** `node_modules` corrompu. Supprimer et réinstaller :
```bash
rm -rf node_modules .next
npm ci
npm run dev
```

### Hot reload cassé

**Symptôme :** Les modifications de fichier ne se reflètent pas dans le navigateur.

**Cause :** Le cache `.next` est corrompu, ou un watcher de fichiers a atteint sa limite.

**Fix :**
```bash
rm -rf .next
npm run dev
```

Sur macOS, augmenter la limite de watchers si le problème persiste :
```bash
sudo sysctl -w kern.maxfiles=524288
sudo sysctl -w kern.maxfilesperproc=524288
```

### Port 3000 déjà pris

**Symptôme :** `Error: listen EADDRINUSE :::3000`

**Cause :** Un processus Next.js précédent tourne encore.

**Fix :**
```bash
lsof -ti :3000 | xargs kill -9
npm run dev
```

---

## 5. Tests

### Vitest échoue

**Symptôme :** `npm run test` échoue avec des erreurs d'import ou de module.

**Cause :** Dépendances manquantes ou configuration cassée.

**Fix :**
```bash
npm ci
npm run test
```

Si un test spécifique échoue, le lancer en isolation :
```bash
npx vitest run tests/nom-du-test.test.ts
```

### Navigateur Playwright non installé

**Symptôme :** `Error: browserType.launch: Executable doesn't exist` lors de `npm run test:e2e`.

**Cause :** Les binaires Chromium/Firefox/WebKit n'ont pas été téléchargés.

**Fix :**
```bash
npx playwright install
```

### Timeouts E2E

**Symptôme :** Tests Playwright qui échouent avec `Timeout 30000ms exceeded`.

**Cause :** Le serveur de dev met trop de temps à démarrer (timeout webServer = 120s dans `playwright.config.ts`), ou une page est lente à charger.

**Fix :**
1. Vérifier que `npm run dev` fonctionne et que `http://localhost:3000` répond.
2. Lancer le serveur manuellement avant les tests :
```bash
npm run dev &
npx playwright test
```
3. Pour les tests lents, augmenter le `navigationTimeout` dans `playwright.config.ts` (actuellement 30s).

### Tests flaky (intermittents)

**Symptôme :** Un test passe parfois et échoue parfois.

**Cause :** Dépendance sur le timing, état partagé, ou API externe instable.

**Fix :** En CI, le projet utilise `retries: 2` (voir `playwright.config.ts`). En local, lancer en mode UI pour observer le comportement :
```bash
npm run test:e2e:ui
```

Utiliser `trace: 'on-first-retry'` (déjà configuré) pour capturer les traces des échecs.

---

## 6. Build

### Erreurs TypeScript

**Symptôme :** `npx tsc --noEmit` échoue avec des erreurs de type.

**Cause :** Un type manquant, un import incorrect, ou un `any` interdit.

**Fix :** Lire l'erreur attentivement. Les types partagés sont dans `lib/types.ts`. Ne pas utiliser `any` (convention projet). Utiliser `Record<string, unknown>` pour les objets dynamiques.

### Build Next.js échoue

**Symptôme :** `npm run build` échoue.

**Cause fréquente 1 :** Import d'un module serveur dans un composant client.
```
Error: `supabaseAdmin` cannot be imported from a Client Component
```
**Fix :** Utiliser `lib/supabase.ts` (browser) dans les composants client, `lib/supabase-server.ts` uniquement dans les routes API et Server Components.

**Cause fréquente 2 :** Import Capacitor qui casse le SSR.
**Fix :** Toujours importer Capacitor dynamiquement :
```typescript
const { Camera } = await import('@capacitor/camera')
```

**Cause fréquente 3 :** Variable d'environnement absente en build. Vérifier que toutes les `NEXT_PUBLIC_*` sont définies.

### Import manquant

**Symptôme :** `Module not found: Can't resolve 'xxx'`.

**Cause :** Le package n'est pas installé, ou le chemin d'import est faux.

**Fix :** Vérifier le `package.json`. Si le module est listé, relancer `npm ci`. Sinon, l'installer.

---

## 7. Agents IA

### Erreur API Groq

**Symptôme :** L'agent IA retourne une erreur 401 ou 429.

**Cause 401 :** Clé `GROQ_API_KEY` invalide ou expirée.
**Fix :** Régénérer sur https://console.groq.com et mettre à jour `.env.local`.

**Cause 429 :** Rate limit Groq atteint.
**Fix :** Le circuit breaker (`lib/circuit-breaker.ts`) bascule automatiquement sur le modèle 8B. Attendre 30 secondes (le `resetTimeoutMs` par défaut). Si le problème persiste, vérifier les quotas sur le dashboard Groq.

### Circuit breaker ouvert

**Symptôme :** Erreur `Circuit breaker [groq] is OPEN — service temporarily unavailable`.

**Cause :** 5 échecs consécutifs (seuil `failureThreshold: 5`). Le circuit breaker rejette les requêtes pour protéger le système.

**Fix :** Attendre 30 secondes. Le circuit passe en `HALF_OPEN` et reteste. Si Groq est rétabli, le circuit se referme. En cas de panne prolongée, le fallback OpenRouter prend le relais pour l'agent matériaux.

### Rate limiting

**Symptôme :** Réponse HTTP 429 `Too many requests`.

**Cause :** Le rate limiter (`lib/rate-limit.ts`) limite à 20 requêtes par minute par identifiant. En production, c'est géré par Upstash Redis. En local, un fallback en mémoire s'applique.

**Fix :** Attendre 60 secondes (header `Retry-After: 60`). Si le problème est récurrent en dev, les limites sont configurables dans `checkRateLimit()`.

### Langfuse tracing absent

**Symptôme :** Pas de traces dans le dashboard Langfuse.

**Cause :** Variables `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` non définies.

**Fix :** Ajouter ces variables dans `.env.local`. Les traces sont optionnelles en dev local mais requises pour les évaluations CI (`langfuse-eval.yml`).

---

## 8. PDF / Devis

### Font Liberation Sans manquante

**Symptôme :** PDF avec caractères manquants (symbole euro, m², degrés) ou texte en police par défaut.

**Cause :** Les fichiers TTF ne sont pas dans `public/fonts/`.

**Fix :** Vérifier que `public/fonts/` contient les fichiers Liberation Sans TTF. Si absents, les télécharger depuis le repo ou les copier depuis un poste fonctionnel.

### PDF vide ou blanc

**Symptôme :** Le PDF se génère mais ne contient aucun texte.

**Cause possible 1 :** Les données du devis sont `null` ou `undefined` (pas de lignes de devis).
**Cause possible 2 :** La font n'a pas été correctement embarquée dans jsPDF.

**Fix :** Vérifier les données envoyées au générateur. Tester avec `handleTestPdfV2` (download direct) pour isoler le problème. Consulter la console serveur pour les erreurs du logger.

### Erreur FormData

**Symptôme :** Erreur lors de l'upload ou de la génération PDF via API.

**Cause :** Le body de la requête n'est pas correctement formaté en `multipart/form-data`, ou le champ attendu est manquant.

**Fix :** Vérifier que le `Content-Type` n'est pas défini manuellement (le navigateur le gère avec la boundary). S'assurer que les champs obligatoires sont présents dans le FormData.

---

## 9. Stripe

### Signature webhook invalide

**Symptôme :** Erreur `Webhook signature verification failed` dans les logs.

**Cause :** Le `STRIPE_WEBHOOK_SECRET` ne correspond pas au secret de l'endpoint webhook configuré dans Stripe.

**Fix :**
1. Stripe Dashboard > Developers > Webhooks.
2. Copier le signing secret de l'endpoint (commence par `whsec_`).
3. Mettre à jour `STRIPE_WEBHOOK_SECRET` dans `.env.local` ou Vercel env vars.

Pour le dev local avec Stripe CLI :
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copier le whsec_xxx affiché dans .env.local
```

### Confusion clés test vs live

**Symptôme :** Paiements qui fonctionnent en dev mais pas en production (ou inversement).

**Cause :** Les clés `sk_test_*` et `sk_live_*` ne sont pas interchangeables. Les Price IDs (`price_*`) sont aussi distincts entre test et live.

**Fix :** Vérifier que l'environnement utilise les bonnes clés. En dev : `sk_test_*` + Price IDs test. En production : `sk_live_*` + Price IDs live. Les variables `STRIPE_PRICE_ARTISAN_PRO`, `STRIPE_PRICE_SYNDIC_ESSENTIAL`, `STRIPE_PRICE_SYNDIC_PREMIUM` doivent correspondre à l'environnement.

### Doublons de paiement

**Symptôme :** Un utilisateur est débité deux fois pour la même action.

**Cause :** Le webhook a été reçu deux fois et traité deux fois.

**Fix :** La table `stripe_webhook_events` assure l'idempotence. Si des doublons apparaissent, vérifier que chaque event Stripe est bien enregistré avec son ID unique avant traitement.

---

## 10. Déploiement

### Build Vercel échoue

**Symptôme :** Le deploy échoue dans le dashboard Vercel.

**Cause fréquente 1 :** Erreur TypeScript. Vercel exécute `next build` qui inclut la vérification des types.
**Fix :** Lancer `npx tsc --noEmit` en local avant de push.

**Cause fréquente 2 :** Dépendance absente (listée en `devDependencies` mais nécessaire au build).
**Fix :** Déplacer la dépendance dans `dependencies` si elle est utilisée au runtime.

### Variables d'environnement non définies sur Vercel

**Symptôme :** L'app fonctionne en local mais crash en production. Health check `environment: unhealthy`.

**Cause :** Les env vars ne sont pas configurées dans Vercel > Settings > Environment Variables.

**Fix :** Configurer chaque variable requise dans le dashboard Vercel. Les variables `NEXT_PUBLIC_*` doivent aussi y être définies (elles sont intégrées au build). Après modification, redéployer.

### Cron jobs ne tournent pas

**Symptôme :** Les tâches planifiées ne s'exécutent pas (pas de sync données, pas de polling emails).

**Cause 1 :** Les crons Vercel ne tournent qu'en production, pas sur les preview deployments.
**Cause 2 :** Le `CRON_SECRET` dans `vercel.json` ne correspond pas à celui dans les env vars.

**Fix :** Vérifier `vercel.json` pour la configuration des crons. Vérifier que `CRON_SECRET` est identique entre le code et les env vars Vercel. Consulter l'historique dans Vercel Dashboard > Project > Crons.

### Rollback rapide

En cas de deploy cassé en production :
1. Vercel Dashboard > Deployments.
2. Trouver le dernier deploy fonctionnel.
3. Cliquer "..." > Promote to Production.

Le rollback est instantané, pas besoin de rebuild.
