# PII encryption — application-level AES-256-GCM

The most sensitive identifiers stored in Vitfix's database (KBIS extractions,
SIRET, NIF, future IBAN/BIC if we add them) get a side-by-side encrypted
column. Plaintext stays alongside until we have validated dual-write across
100 % of writes — only then do we drop the plaintext.

**Status (2026-05-07): live in production.** Migration 103 applied,
`PII_ENCRYPTION_KEY` posted as a Cloudflare worker secret, dual-write wired
in `kyc-orchestrate` (Phase 15), backfill route deployed (Phase 19).

## Volume context — why so few rows are encrypted

`profiles_artisan` is split into two populations:

- **Catalogue rows** — artisans imported from external sources (scraping,
  open data) who have **never created an account**. They have no SIRET / NIF
  / KBIS because no KYC ever ran. As of 2026-05-07: 757 / 761 rows.
- **Active rows** — artisans who self-registered and completed KYC. These
  are the only rows with PII to encrypt. As of 2026-05-07: 4 / 761 rows.

So when `/api/admin/pii-backfill` reports `encrypted: 4`, that is the full
backfill — not a partial result. The new dual-write at registration time
takes care of every future signup automatically; the backfill route exists
for the rare case of a schema rotation or a bulk re-encryption.

**The `nif` plain column doesn't exist** in `profiles_artisan` either —
the schema never ships a column nobody uses. When the first PT artisan
signs up and provides a NIF, add the plain column in a follow-up migration
(`ALTER TABLE profiles_artisan ADD COLUMN nif TEXT`) so the dual-write has
something to mirror. Until then, the helper writes `nif_encrypted` directly
from the route payload (encrypted-only PT NIF storage works fine).

## Why application-level, not `pgcrypto`

`pgcrypto` is installed (migration 039) and `pgp_sym_encrypt(text, key)`
works. We deliberately don't use it for PII because the symmetric key would
need to be passed in via SQL — exposing it in server logs, EXPLAIN output,
and Postgres extensions like `pg_stat_statements`. AES-256-GCM via the Web
Crypto API ([lib/pii-crypto.ts](../lib/pii-crypto.ts)) keeps the key off
the database — it lives only in the runtime secret store.

## Architecture

| Plain column | Encrypted column | Type | Migration |
|---|---|---|---|
| `profiles_artisan.siret` | `profiles_artisan.siret_encrypted` | BYTEA | 103 |
| `profiles_artisan.nif` | `profiles_artisan.nif_encrypted` | BYTEA | 103 |
| `profiles_artisan.kbis_extracted` | `profiles_artisan.kbis_extracted_encrypted` | BYTEA | 103 |
| `pt_fiscal_documents.issuer_nif` | `pt_fiscal_documents.issuer_nif_encrypted` | BYTEA | 103 |
| `pt_fiscal_documents.client_nif` | `pt_fiscal_documents.client_nif_encrypted` | BYTEA | 103 |

Both `profiles_artisan` and `pt_fiscal_documents` carry a
`pii_encryption_version` int:

| Version | Meaning |
|---|---|
| 0 | Plaintext only (pre-rollout state). |
| 1 | Dual-write: plaintext + AES-256-GCM ciphertext. |
| 2+ | Future rotations (see "Rotation"). |

`paiement_modes` (JSONB column on profiles_artisan, contains IBAN/BIC) is
**deferred** — encrypting nested JSON paths needs structural awareness on
the read side and the dual-write story is fragile. Tackle in a follow-up
once the simpler columns are validated.

## Wire format

```
encryptPII(plaintext) =>
  base64(
    nonce(12 bytes) | ciphertext(n bytes) | auth_tag(16 bytes)
  )
```

The 12-byte nonce is generated fresh per call. AES-GCM never gets the same
`(key, nonce)` pair twice for identical plaintext, which would be
catastrophic — the helper enforces this by always calling
`crypto.getRandomValues()`. The auth tag is appended by Web Crypto and
travels with the ciphertext; tampering one byte makes `decryptPII` throw.

## Activation procedure

1. **Generate the key** (locally, never logged):
   ```bash
   openssl rand -base64 32
   # → e.g. "C8u4...AAA="  (44 chars)
   ```

2. **Stage the secret in Cloudflare**:
   ```bash
   wrangler secret put PII_ENCRYPTION_KEY
   # paste the base64 output from step 1
   ```

3. **Apply migration 103** (uses the same path as migration 100/102):
   ```bash
   supabase db push
   ```
   Or apply via the Supabase SQL editor if `db push` isn't wired yet.

4. **Wire dual-write** in the routes that mutate the columns above. The
   pattern is:

   ```ts
   import { encryptPII, encryptJSON } from '@/lib/pii-crypto'

   await supabase.from('profiles_artisan').upsert({
     // … other fields …
     siret,
     siret_encrypted: await encryptPII(siret),
     pii_encryption_version: 1,
   })
   ```

   For JSONB (`kbis_extracted`):
   ```ts
   const extracted = { denomination, siret, gerant, … }
   await supabase.from('profiles_artisan').upsert({
     kbis_extracted: extracted,
     kbis_extracted_encrypted: await encryptJSON(extracted),
     pii_encryption_version: 1,
   })
   ```

5. **Backfill existing rows** via the admin route shipped in Phase 19:
   ```bash
   # Always dry-run first — count + sample, no writes.
   curl -X POST 'https://vitfix.io/api/admin/pii-backfill?dry_run=true' \
     -H "Authorization: Bearer <super-admin-jwt>"

   # Then the real run (default batch=100, max 500).
   curl -X POST 'https://vitfix.io/api/admin/pii-backfill?dry_run=false' \
     -H "Authorization: Bearer <super-admin-jwt>"

   # Re-run is idempotent — already-encrypted rows are skipped via the
   # `pii_encryption_version = 0` filter. Loop until the response shows
   # `encrypted: 0`.
   ```
   The route lives at [app/api/admin/pii-backfill/route.ts](../app/api/admin/pii-backfill/route.ts)
   and runs inside the worker (no need to expose `PII_ENCRYPTION_KEY`
   to a local shell).

6. **Validate** in Sentry / logs that no `decryptPII` call throws — that
   would indicate a key mismatch. Wait at least 7 days of clean operation
   before the next step.

7. **Cleanup phase**: switch reads to use `_encrypted` exclusively, then
   ship a migration that drops the plaintext columns. Run before each
   prod deploy: `SELECT count(*) FROM profiles_artisan WHERE pii_encryption_version = 0` — must be 0.

## Rotation

To rotate the key (suspected compromise, scheduled annual rotation):

1. Generate a new key, set as `PII_ENCRYPTION_KEY_V2` (do not overwrite v1
   yet).
2. Add `lib/pii-crypto.ts` support for reading both keys: try v2 first on
   decrypt, fall back to v1.
3. Run a backfill script that re-encrypts every row with v2 and bumps
   `pii_encryption_version` to 2.
4. Once 100 % of rows are at v2, drop v1 from the runtime secret store and
   from the helper.

Document each rotation in this file (date, reason, completion check).

## Operational notes

- `encryptPII("")` is allowed and roundtrips. We do **not** treat empty
  string as null — the route layer should pass null to skip encryption.
- `decryptPII` is intentionally strict: tampered or short input throws.
  Wrap in try/catch at every read site.
- The helper caches the key as a non-extractable `CryptoKey` after the
  first call. Restarting a Worker (or invoking `_resetForTests`) clears
  the cache. There is no decrypt-once API — every call goes through Web
  Crypto's KMS-equivalent.
- Test coverage: [tests/lib/pii-crypto.test.ts](../tests/lib/pii-crypto.test.ts)
  covers roundtrip, nonce uniqueness, missing key, wrong-length key,
  tampering, short payloads, empty input, JSON roundtrip.

## Threat model

- **DB dump leak** (eg. lost backup, rogue admin) → ciphertext columns
  are useless without the key.
- **Live SQL access** (eg. compromised psql) → still useful **once
  cleanup phase is done**; until then plaintext mirror is readable.
- **Worker compromise** (eg. malicious deploy) → key in memory, ciphertext
  decryptable. Mitigation is out of scope of this layer (audit logs +
  deployment access controls handle it).
- **Side-channel timing** → AES-GCM via Web Crypto runs in constant time
  on supported runtimes. Not a known attack vector at our scale.

This file is the source of truth for the encryption decision. Update it
whenever the rollout state changes.
