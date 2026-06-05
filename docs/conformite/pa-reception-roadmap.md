# PA Réception — Roadmap intégration Plateforme Agréée (FR-V2d, en attente)

> Réforme française e-invoicing : 1er sept 2026 toutes les entreprises FR doivent être capables de **recevoir** des factures électroniques via PA. 1er sept 2027 toutes doivent **émettre**. Vitfix doit fournir cette capacité à ses artisans.

## État actuel

❌ Pas d'intégration PA. Les artisans Vitfix recevant des factures B2B via PA après sept 2026 n'auront aucun moyen de les voir dans leur dashboard.

✅ Format Factur-X émission : déjà géré ([app/api/facturx/generate](../../app/api/facturx/generate/route.ts)) côté V3 BTP.

## Calendrier obligation

- **1 sept 2026** : Recevoir = OBLIGATOIRE pour TOUTES les entreprises FR (y compris TPE/auto-EI)
- **1 sept 2027** : Émettre via PA = OBLIGATOIRE pour TPE/PME

Pour Vitfix : la priorité est **réception** (sept 2026, 4 mois avant la deadline). Émission peut suivre courant 2027.

## Stratégie d'intégration

### Option A — Intégration directe une PA
Choisir UN partenaire (recommandé : **Docaposte** ou **Pennylane**) et brancher Vitfix dessus.

**Avantages** : un seul flux à maintenir, contrôle complet, customisation.
**Inconvénients** : pas de portabilité, dépendance fournisseur, coût ~0.10€/facture reçue.

### Option B — Hub multi-PA (PDP-aggregator)
Utiliser un agrégateur (Esker, Cegid, B2BRouter) qui se connecte à plusieurs PA.

**Avantages** : compatible avec n'importe quelle PA chez l'émetteur, futur-proof.
**Inconvénients** : couche d'intermédiation supplémentaire, coût plus élevé (~0.20€/facture).

**Recommandation** : Option A avec Docaposte (filiale La Poste, fiable, tarifs publics) ou Pennylane (déjà connu de l'écosystème artisan).

## Architecture cible (réception)

```
[Émetteur entreprise]
   ↓ envoie facture via SA PA
[Réseau interopérable PPF + PA]
   ↓
[Docaposte PA — Vitfix.io artisan]
   ↓ webhook https://vitfix.io/api/pa-incoming
[Vitfix API : POST /api/pa-incoming]
   ↓ vérif HMAC, parse Factur-X CII
[DB : table factures_recues]
   ↓
[Notification artisan in-app + email]
   ↓
[UI dashboard /pro/factures-recues]
```

## Modèle de données proposé

```sql
-- Migration future XXX_factures_recues.sql
CREATE TABLE factures_recues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_user_id UUID NOT NULL REFERENCES auth.users(id),
  emetteur_siret TEXT NOT NULL,
  emetteur_name TEXT NOT NULL,
  numero TEXT NOT NULL,                  -- numéro fourni par l'émetteur
  date_emission DATE NOT NULL,
  date_echeance DATE,
  total_ht_cents BIGINT NOT NULL,
  total_tva_cents BIGINT NOT NULL,
  total_ttc_cents BIGINT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('factur-x', 'ubl', 'cii')),
  source_pa TEXT NOT NULL,               -- 'docaposte' / 'pennylane' / etc
  pa_message_id TEXT NOT NULL,           -- identifiant unique PA
  raw_xml TEXT,                          -- pour audit
  pdf_url TEXT,                          -- stocké via Supabase Storage
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','validated','disputed','paid')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_pa, pa_message_id)
);

CREATE INDEX idx_factures_recues_artisan ON factures_recues(artisan_user_id, received_at DESC);

-- RLS
ALTER TABLE factures_recues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "factures_recues_owner_read" ON factures_recues
  FOR SELECT USING (artisan_user_id = auth.uid());
```

## Endpoint webhook attendu

```typescript
// app/api/pa-incoming/route.ts (à créer)
// Configuré côté Docaposte : URL = https://vitfix.io/api/pa-incoming
// HMAC signature : X-PA-Signature header (HMAC-SHA256 sur body avec secret partagé)

POST /api/pa-incoming
Headers:
  X-PA-Signature: <hex hmac>
  Content-Type: multipart/form-data
Body:
  - factur-x.xml   (CII XML)
  - facture.pdf    (PDF/A-3)
  - metadata.json  (artisan SIRET destinataire, message_id, etc.)

→ vérif HMAC
→ parse Factur-X via lib/facturx-parser.ts (à créer, cf. lib/facturx-mapper.ts pattern)
→ INSERT factures_recues
→ notification : Sentry breadcrumb + Resend email à l'artisan
→ 200 OK
```

## Estimation effort

| Tâche | Effort |
|---|---|
| Décision provider PA + signature contrat (Docaposte) | 2 semaines (commercial) |
| Setup compte Docaposte + secret HMAC | 1j |
| Migration `factures_recues` + RLS | 0.5j |
| Endpoint `/api/pa-incoming` (parsing CII + auth HMAC) | 3j |
| `lib/facturx-parser.ts` (CII → DB schema) | 2j |
| UI `/pro/factures-recues` (liste + détail) | 3j |
| Notification + email artisan | 1j |
| Tests : génération XML test, simulation webhook PA, edge cases | 3j |
| Documentation API + onboarding artisan | 1j |
| **Total** | **~3 semaines de dev + 2 semaines commercial** |

## Coût récurrent

- Docaposte : ~0.10€ par facture reçue (tarif estimé, à confirmer)
- Pennylane : tarif intégré dans abonnement existant si artisan déjà client
- Stockage PDF/XML : Supabase Storage, ~0.02€/Go/mois — négligeable
- Pour 1000 artisans × 50 factures reçues/mois en moyenne : ~5000€/mois de frais PA

À répercuter sur l'abonnement artisan ou absorber comme coût d'acquisition.

## Décision à formaliser

1. **Date butoir interne** : déploiement avant **15 août 2026** (2 semaines avant deadline réglementaire)
2. **Provider** : Docaposte ou Pennylane → décision Q2 2026 au plus tard
3. **Modèle économique** : facture reçue = inclus dans abonnement existant ou facturé à l'unité ?
4. **Migration des artisans** : process onboarding leur AS-PA (Adressage Structuré PA) — chaque artisan doit déclarer Vitfix comme leur PA de réception sur le PPF

## Pour passer à l'action immédiate

Créer une issue GitHub `[FR-V2d] Intégration PA réception` avec checkbox tasks ci-dessus, et la programmer dans le sprint Q2 2026.
