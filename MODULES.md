# MODULES — État et réactivation

Document de référence pour la migration Vercel → Cloudflare (avril 2026).
Les modules dormants ne sont **pas supprimés** : leur code reste dans le repo
et peut être réactivé en basculant un feature flag.

Mise à jour : 2026-04-22

---

## État actuel

| Module | Statut | Cible migration Cloudflare |
|---|---|---|
| Client (particulier) | ✅ actif | oui |
| Artisan (auto-entrepreneur) | ✅ actif | oui |
| BTP Pro (société BTP) | ✅ actif | oui |
| Syndic | 🔒 dormant | non (réactivation future) |
| Copropriétaire | 🔒 dormant | non (réactivation future) |
| Conciergerie | 🔒 dormant | non (réactivation future) |
| Gestionnaire Immo | 🔒 dormant | non (réactivation future) |

---

## Architecture de désactivation

Chaque module dormant est gardé par un feature flag lu depuis les variables
d'environnement. La désactivation se fait à **trois niveaux** :

1. **URL (proxy Next 16)** — Les routes UI retournent `404`, les routes API
   retournent `410 Gone`. Voir [proxy.ts](proxy.ts) (gate en tête de `proxy()`).
2. **Authentification (login)** — Les rôles dormants (`syndic`, `pro_conciergerie`,
   `pro_gestionnaire`) sont signés out avec un message explicite. Voir
   [app/auth/login/page.tsx](app/auth/login/page.tsx).
3. **Rendu (dashboards)** — Les sections dormantes sont gardées par un test
   `MODULE_*_ENABLED` côté rendu, les imports dynamiques sont conservés pour
   permettre une réactivation immédiate. Voir
   [app/pro/dashboard/page.tsx](app/pro/dashboard/page.tsx) (Conciergerie, Gestionnaire).

Les flags sont déclarés dans [lib/features.ts](lib/features.ts).

---

## Flags

| Env var | Défaut prod | Portée |
|---|---|---|
| `MODULE_SYNDIC_ENABLED` | `false` | Routes `/syndic`, `/api/syndic/*` |
| `MODULE_COPRO_ENABLED` | `false` | Routes `/coproprietaire`, `/api/coproprietaire/*`, `/api/copro-ai/*` |
| `MODULE_CONCIERGERIE_ENABLED` | `false` | Sections Conciergerie dans `/pro/dashboard` |
| `MODULE_GESTIONNAIRE_ENABLED` | `false` | Sections Gestionnaire dans `/pro/dashboard` |

Variantes publiques (`NEXT_PUBLIC_MODULE_*_ENABLED`) disponibles pour masquer
des liens UI uniquement — jamais pour protéger des données.

---

## Exception : `/api/syndic/notify-artisan`

Cette route reste **active** même si `MODULE_SYNDIC_ENABLED=false`. Elle est
appelée par le dashboard artisan / BTP pour gérer ses propres notifications
(pas une API purement syndic malgré son préfixe). Exception codée dans
[proxy.ts](proxy.ts).

---

## Procédures de réactivation

### Module Syndic

1. Ajouter dans Cloudflare (via `wrangler`) :
   ```
   wrangler pages secret put MODULE_SYNDIC_ENABLED
   # valeur : true
   ```
2. Vérifier les routes `/syndic/*` et `/api/syndic/*` (22 routes) — lancer
   `npm run dev` avec `MODULE_SYNDIC_ENABLED=true` dans `.env.local`.
3. Re-déployer.

### Module Copropriétaire

1. `wrangler pages secret put MODULE_COPRO_ENABLED` → `true`.
2. Vérifier `/coproprietaire/*`, `/api/coproprietaire/*`, `/api/copro-ai/*`.
3. Re-déployer.

### Module Conciergerie

1. `wrangler pages secret put MODULE_CONCIERGERIE_ENABLED` → `true`.
2. Les 8 sections redeviennent rendues dans `/pro/dashboard` (Propriétés,
   Accès & Clés, Channel Manager, Tarification, Check-in/out, Livret
   d'accueil, Planning ménage, RevPAR).
3. Débloquer le rôle `pro_conciergerie` dans [app/auth/login/page.tsx](app/auth/login/page.tsx)
   (retirer l'entrée de `DORMANT_ROLES`).
4. Re-déployer.

### Module Gestionnaire Immo

1. `wrangler pages secret put MODULE_GESTIONNAIRE_ENABLED` → `true`.
2. Les 3 sections redeviennent rendues dans `/pro/dashboard` (Immeubles,
   Ordres de mission, Contrats).
3. Débloquer le rôle `pro_gestionnaire` dans [app/auth/login/page.tsx](app/auth/login/page.tsx).
4. Re-déployer.

---

## Développement local

Pour travailler sur un module dormant sans le réactiver en prod, ajouter
dans `.env.local` :

```
MODULE_SYNDIC_ENABLED=true
MODULE_COPRO_ENABLED=true
MODULE_CONCIERGERIE_ENABLED=true
MODULE_GESTIONNAIRE_ENABLED=true
```

Les flags `NEXT_PUBLIC_*` peuvent être nécessaires pour afficher les liens
de navigation côté client.

---

## Tests de régression

Avant chaque déploiement, vérifier manuellement :

- [ ] `/fr/syndic/login` → 404 (pas 500)
- [ ] `/api/syndic/documents` → 410 Gone avec JSON `{error:"gone",module:"syndic"}`
- [ ] `/api/syndic/notify-artisan` → toujours accessible (200 ou 401)
- [ ] `/fr/coproprietaire` → 404
- [ ] `/api/copro-ai/chat` → 410 Gone
- [ ] Login avec un compte `syndic` / `pro_conciergerie` / `pro_gestionnaire`
      → déconnexion + message "Ce module est temporairement désactivé"
- [ ] Login avec un compte `pro_societe` → `/pro/dashboard` sans les tuiles
      Conciergerie / Gestionnaire dans la sidebar
- [ ] Login avec un compte `artisan` → `/artisan/dashboard` fonctionnel
