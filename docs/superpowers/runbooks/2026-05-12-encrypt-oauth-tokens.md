# Runbook — Encryption OAuth Tokens (Plan B)

> ⚠️ **OBSOLÈTE (2026-06-13, audit P2 — OAUT-3).** Ce runbook décrit le flux
> pgcrypto v1, structurellement mort en prod (PostgREST n'expose pas
> `set_config` ; les fonctions RPC référençaient `token_expiry`, colonne
> inexistante). Le script `scripts/migrate-encrypt-oauth-tokens.ts` a été
> **supprimé** (backfill sans objet : 0 token jamais persisté). Flux actuel :
> chiffrement applicatif AES-256-GCM dans `lib/oauth/tokens.ts`
> (`encryption_version = 2`) + purge DB par
> `supabase/migrations/20260612000008_oauth_cleanup.sql`.
> Conservé pour l'historique — **ne rien exécuter de ce qui suit.**

> Bascule en 4 phases. Phases 1-3 sont du Plan B (déjà commitées). Phase 4 est différée Plan D.

## Pré-requis

### 1. Générer une clé d'encryption forte (32+ chars)

```bash
openssl rand -base64 48
# Exemple de sortie (NE PAS UTILISER, générer la tienne) :
# k7Y...48caractères...XYZ
```

### 2. La stocker dans Wrangler (pour le runtime Cloudflare)

```bash
wrangler secret put OAUTH_TOKENS_ENCRYPTION_KEY
# Coller la clé quand prompté
wrangler secret list  # vérifier
```

### 3. La rendre disponible aux fonctions RPC PG

Les fonctions `set_encrypted_oauth_token` / `get_decrypted_oauth_token` lisent
la clé depuis `app.oauth_encryption_key` via `current_setting()`. Le wrapper TS
fait `SET LOCAL` avant chaque RPC, donc la clé transite par TLS et n'est jamais
stockée en PG.

Aucune configuration PG side requise — la clé vient toujours côté Node/Cloudflare.

### 4. Pour le script backfill : exporter aussi en env

```bash
export OAUTH_TOKENS_ENCRYPTION_KEY="..."
export NEXT_PUBLIC_SUPABASE_URL="https://irluhepekbqgquveaett.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="..."  # depuis Supabase Studio > Settings > API
```

---

## Phase 1 — Application de la migration SQL (additive, non destructive)

```bash
# Via Supabase MCP (avec confirmation user) :
#   mcp__supabase__apply_migration name=encrypt_oauth_tokens query=<contenu du SQL>
# Ou via supabase CLI :
#   supabase db push
```

Le fichier source : `supabase/migrations/20260512_encrypt_oauth_tokens.sql`

Effet : ajoute `access_token_enc bytea`, `refresh_token_enc bytea`,
`encryption_version smallint` à `syndic_oauth_tokens`, + 2 fonctions RPC
SECURITY DEFINER. Aucune donnée n'est modifiée.

### Vérification

```sql
\d syndic_oauth_tokens
-- Doit montrer : access_token, refresh_token (plain, garde de transition),
-- access_token_enc, refresh_token_enc (bytea), encryption_version

\df set_encrypted_oauth_token
\df get_decrypted_oauth_token
-- Doivent exister, owned by postgres, language plpgsql, security definer
```

---

## Phase 2 — Backfill

### Dry run d'abord

```bash
npx tsx scripts/migrate-encrypt-oauth-tokens.ts --dry-run
```

Affiche le nombre de rows à migrer. Si > 0, examiner les `syndic_id` listés.

### Application

```bash
npx tsx scripts/migrate-encrypt-oauth-tokens.ts
```

Sortie typique :
```
[backfill] mode = APPLY
[backfill] N rows à migrer
[backfill] ✓ abcd1234...
[backfill] ✓ ef567890...
[backfill] terminé : N success, 0 failed sur N
```

### Vérification

```sql
SELECT
  count(*) FILTER (WHERE access_token_enc IS NULL AND access_token IS NOT NULL) AS unencrypted_with_plain,
  count(*) FILTER (WHERE access_token_enc IS NOT NULL) AS encrypted
FROM syndic_oauth_tokens;
```

`unencrypted_with_plain` doit être 0. `encrypted` = nombre total de syndics avec
OAuth connecté.

### Test de déchiffrement (sanity check)

```sql
-- Adapter <ton-syndic-uuid> et <la-clé> :
SELECT set_config('app.oauth_encryption_key', '<la-clé>', true);
SELECT * FROM get_decrypted_oauth_token('<ton-syndic-uuid>'::uuid);
```

Doit retourner le token déchiffré (access_token, refresh_token, expires_at).

---

## Phase 3 — Déploiement application

Le code (commits Plan B Tasks 9-11) lit/écrit déjà via le wrapper avec fallback
plain. Aucun risque de régression si plusieurs syndics ont des rows partiellement
backfillées : le code lit l'encrypted en priorité et fallback au plain.

```bash
git push origin claude/exciting-bardeen-ac4a0b
# Merge to main (via PR + CI verts)
# deploy-cloudflare.yml applique le déploiement prod
```

Vérifier que Cloudflare Workers a bien la secret `OAUTH_TOKENS_ENCRYPTION_KEY`
définie (wrangler secret list).

### Monitoring post-déploiement (J+0 à J+7)

- Sentry : aucune erreur `OAUTH_TOKENS_ENCRYPTION_KEY is not set`
- Sentry : aucune erreur `setEncryptedToken failed` / `getDecryptedToken failed`
- Test fonctionnel : connecter un nouveau syndic Gmail, vérifier que les
  colonnes encrypted ET plain sont écrites (dual-write)
- Test fonctionnel : poll d'un syndic existant, vérifier que les emails sont
  bien analysés (déchiffrement OK)

---

## Phase 4 — Drop des colonnes plain (différé Plan D)

À faire **uniquement après** > 7 jours de stabilité prod sans aucune erreur de
déchiffrement. Migration séparée (Plan D) :

```sql
-- supabase/migrations/YYYYMMDD_drop_plain_oauth_tokens.sql
ALTER TABLE syndic_oauth_tokens
  DROP COLUMN access_token,
  DROP COLUMN refresh_token;
```

Avant d'appliquer, retirer le dual-write côté code (callback route) et le
fallback plain côté code (poll + send-response).

---

## Rollback

### Phase 1 (migration appliquée mais pas le code)
Aucune action — les colonnes encrypted sont juste ignorées par l'ancien code.

### Phase 2 (backfill appliqué)
```sql
UPDATE syndic_oauth_tokens
  SET access_token_enc = NULL, refresh_token_enc = NULL
  WHERE access_token_enc IS NOT NULL;
```
(Les plain sont restées intactes pendant le backfill, donc tout fonctionne.)

### Phase 3 (code déployé, problème encryption)
- Revert le code : `git revert <commits Plan B 9-11>`
- Re-déployer
- Le code revient à lire les colonnes plain (toujours présentes)

### Phase 4 (colonnes plain droppées)
**Phase 4 ne peut pas être facilement rollback.** D'où l'attente de 7 jours.
Si nécessaire : restaurer depuis backup point-in-time Supabase (max 7 jours en
arrière selon le plan).

---

## Rotation de la clé d'encryption

Future tâche (hors scope Plan B) : si compromise de la clé, augmenter
`ENCRYPTION_VERSION` à 2 dans `lib/oauth/tokens.ts`, ajouter un script de
re-chiffrement avec ancienne et nouvelle clé.
