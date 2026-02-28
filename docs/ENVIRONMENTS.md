# Configuration des Environnements — Vitfix

## Environnements Vercel

| Environnement | URL | Branch | Auto-deploy |
|---------------|-----|--------|-------------|
| **Production** | `fixit-production.vercel.app` | `main` | `vercel --prod` |
| **Preview** | `*.vercel.app` | PR branches | Automatique |
| **Development** | `localhost:3000` | Local | `npm run dev` |

## Variables d'Environnement Requises

| Variable | Environnement | Description |
|----------|---------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Tous | URL Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tous | Cle publique Supabase (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Serveur uniquement | Cle admin (bypass RLS) — **JAMAIS cote client** |
| `GROQ_API_KEY` | Serveur uniquement | Cle API Groq pour IA |
| `GOOGLE_CLIENT_ID` | Serveur uniquement | OAuth Google (email agent) |
| `GOOGLE_CLIENT_SECRET` | Serveur uniquement | Secret OAuth Google |
| `ADMIN_EMAIL` | Serveur uniquement | Email admin autorise |
| `ADMIN_PASSWORD` | Serveur uniquement | Mot de passe admin |
| `NEXT_PUBLIC_APP_URL` | Tous | URL base de l'app |

## Configuration Vercel

```bash
# Ajouter une variable en prod
vercel env add GROQ_API_KEY production

# Lister les variables
vercel env ls

# Supprimer une variable
vercel env rm GROQ_API_KEY production
```

## Procedure de Rollback

1. **Via Vercel Dashboard** : Deployments -> Promote to Production
2. **Via CLI** : `vercel rollback` (revient au deploiement precedent)
3. **Manuel** : `git revert HEAD && vercel --prod --yes`

## Rotation des Cles

| Cle | Frequence | Procedure |
|-----|-----------|-----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Immediate si compromis / Annuelle | Dashboard Supabase -> Settings -> API |
| `GROQ_API_KEY` | Trimestrielle | Console Groq -> API Keys |
| `GOOGLE_CLIENT_SECRET` | Annuelle | Google Cloud Console -> Credentials |

## Tests Pre-Deploiement

```bash
npm run lint        # ESLint
npx tsc --noEmit    # TypeScript
npm run test        # Vitest (11+ tests)
npm run build       # Next.js build
```
