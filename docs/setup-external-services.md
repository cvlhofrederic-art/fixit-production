# Setup Services Externes — Guide Rapide

> URL actuelle : `https://fixit-production.vercel.app`
> URL future (après migration Cloudflare) : `https://vitfix.io`

---

## 1. UptimeRobot (2 min)

1. Aller sur https://uptimerobot.com → Sign Up (gratuit, 50 monitors)
2. Dashboard → **+ Add New Monitor** ×3 :

| Nom | Type | URL | Interval |
|-----|------|-----|----------|
| Vitfix Health | Keyword | `https://fixit-production.vercel.app/api/health` | 5 min |
| Vitfix FR | HTTP(s) | `https://fixit-production.vercel.app/fr/` | 5 min |
| Vitfix PT | HTTP(s) | `https://fixit-production.vercel.app/pt/` | 5 min |

- Pour le monitor Health : Keyword Type = **Exists**, Keyword = `healthy`
- **My Settings** → ajouter Alert Contact (ton email)
- Associer l'alert contact aux 3 monitors

**Alternative script :** `UPTIMEROBOT_API_KEY=ur_xxx bash scripts/setup-monitoring.sh`

---

## 2. Sentry Alert Rule (2 min)

1. Aller sur https://sentry.io → ton projet fixit
2. **Alerts** → **Create Alert** → **Issues**
3. Configurer :
   - When: `An issue is seen more than 5 times in 5 minutes`
   - Then: `Send a notification to [ton email]`
   - Name: `High error rate`
4. **Save Rule**

Second alert (optionnel) :
   - When: `A new issue is created`
   - Filter: `The issue's level is equal to fatal`
   - Then: `Send a notification to [ton email]`
   - Name: `Fatal errors`

---

## 3. Vercel Notifications (1 min)

1. Aller sur https://vercel.com → Project fixit-production
2. **Settings** → **Notifications**
3. Activer :
   - [x] Deployment Failed → Email
   - [x] Domain Configuration → Email
   - [x] Usage Alert → Email (si dispo sur ton plan)

---

## 4. Supabase Budget Alert (1 min)

1. Aller sur https://supabase.com/dashboard
2. **Organization** → **Billing** → **Cost Control**
3. Activer **Spend Cap** ou configurer un **budget alert** (email quand > seuil)

---

## 5. MFA — Vérification (2 min)

Vérifier que le 2FA est activé sur chaque service :

- [ ] **GitHub** : Settings → Password & authentication → Two-factor authentication
- [ ] **Vercel** : Settings → Security → Two-Factor Authentication
- [ ] **Supabase** : Account → Security → Multi-Factor Authentication
- [ ] **Stripe** : Settings → Team & security → Two-step authentication

---

## Après migration Cloudflare

Quand le domaine `vitfix.io` sera actif, mettre à jour :

1. `scripts/setup-monitoring.sh` → changer `SITE_URL`
2. `.github/workflows/post-deploy.yml` → remplacer les URLs Vercel
3. `docs/incident-runbook.md` → mettre à jour les URLs
4. UptimeRobot Dashboard → éditer les 3 monitors avec les nouvelles URLs
5. `security/nuclei-config.yml` → target URL
6. Vérifier les redirections Vercel → Cloudflare
