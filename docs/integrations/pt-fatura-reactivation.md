# Réactivation émission fatura PT — checklist post-certification

> **Précondition** : Vitfix a obtenu sa **certificação AT** au titre du Decreto-Lei 28/2019 (numéro de certification attribué par l'AT). Sans ce numéro réel, ne PAS exécuter cette procédure — c'est un délit fiscal.

## Process de certification AT (résumé)

1. **Préparer le dossier de demande** (~1 mois)
   - Manuel utilisateur du logiciel
   - Description technique du module fiscal (ATCUD, hash, signature)
   - Spécification SAF-T (PT) générée
   - Plan de tests fiscaux

2. **Soumettre à l'AT via Portal das Finanças** (1 semaine de revue initiale)
   - Login Portal das Finanças → Outras Obrigações → Pedido de certificação

3. **Tests + audit AT** (~3-4 mois)
   - L'AT fait tourner Vitfix sur des cas de test contrôlés
   - Vérifie l'inviolabilité du hash chain
   - Vérifie la conformité SAF-T XML
   - Demande corrections éventuelles

4. **Numéro de certification attribué** (~1 mois après audit OK)
   - Format : `nº XXXX/AT`
   - À insérer en footer de chaque fatura

5. **Audit annuel** (3-5k€/an)
   - Vérification que le code n'a pas dérivé du standard certifié
   - Toute modification du module fiscal doit être notifiée

**Coût total estimé** : 5-10k€ initial + 3-5k€/an. Délai : 6 mois minimum.

## Code à réactiver

### Migration SQL

Créer `supabase/migrations/XXX_pt_proforma_reactivation.sql` :

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Migration XXX — Réactiver émission fatura PT (post-certification AT n.º YYYY)
-- ══════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS pt_fiscal_documents_block_insert ON pt_fiscal_documents;
DROP FUNCTION IF EXISTS public.block_pt_fiscal_emission();

-- Enregistrer le numéro de certification dans une config table
CREATE TABLE IF NOT EXISTS pt_fiscal_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cert_number TEXT NOT NULL,
  certified_at DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pt_fiscal_settings (id, cert_number, certified_at)
VALUES (1, 'XXXX/AT', '2026-XX-XX')
ON CONFLICT (id) DO UPDATE SET
  cert_number = EXCLUDED.cert_number,
  certified_at = EXCLUDED.certified_at,
  active = TRUE,
  updated_at = NOW();
```

### Code applicatif

1. **`app/api/portugal-fiscal/register-document/route.ts`** :
   - Restaurer le code original via `git show {commit-hash-pré-PT-V1}:app/api/portugal-fiscal/register-document/route.ts > [...].ts`
   - Adapter le `certNumber` pour qu'il soit lu depuis `pt_fiscal_settings.cert_number` (plus jamais hardcodé)

2. **`app/api/portugal-fiscal/saft-export/route.ts`** : idem, restaurer + lire cert depuis DB.

3. **`components/DevisFactureForm.tsx`** : restaurer l'appel à `/api/portugal-fiscal/register-document`.

4. **`lib/pdf/devis-pdf-v3.ts`** :
   - Retirer le bloc watermark "PRÓ-FORMA — NÃO É FATURA" (lignes ajoutées en PT-V1)
   - Restaurer le titre original (`'Fatura'` au lieu de `'Pró-forma'` pour PT)
   - Le bloc QR/cert (déjà présent) prend automatiquement le relais quand `ptFiscalData !== null`

### Tests à passer

- [ ] Émettre une fatura PT de bout en bout → ATCUD reçu, QR code dans PDF, cert number = celui de la DB
- [ ] Vérifier hash chain via vue `v_factures_chain_check` (PT-existant)
- [ ] Export SAF-T mensuel → XML valide schema XSD AT (Portaria 321-A/2007)
- [ ] Communicação manual de séries via Portal das Finanças → cert reconnu
- [ ] Tester annulation fatura → status='cancelled' + nota de crédito émise

### Checklist conformité

- [ ] Numéro de cert AT renseigné dans `pt_fiscal_settings`
- [ ] Manuel utilisateur publié (page `/pt/manual`)
- [ ] DPIA RGPD mis à jour pour traitement données fiscales PT
- [ ] Audit annuel programmé dans calendrier
- [ ] Process de notification AT pour changements code modul fiscal documenté

## Décision à formaliser

Si Vitfix décide de NE PAS poursuivre la certification AT, supprimer définitivement :
- Tables `pt_fiscal_*`
- Fonctions PG `block_pt_fiscal_emission`
- Routes `app/api/portugal-fiscal/*`
- `docs/integrations/pt-fatura-*`
- Toutes références dans `lib/pdf/devis-pdf-v3.ts`

Garder uniquement le mode pro-forma + intégration Moloni/InvoiceXpress (cf. `pt-fatura-providers.md`).
