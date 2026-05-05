# Roadmap conformité — items reportés

> Dernière mise à jour : 5 mai 2026
> Tracker des chantiers de conformité légale qui dépendent d'actions externes (contrats, certifications, décisions commerciales). Pas faisables en code seul.

## Liste actuelle des chantiers

### A. Sentry alerts (FR-V3 — config UI)

**État** : règles documentées dans [sentry-alerts.md](sentry-alerts.md) mais **pas créées** dans le dashboard Sentry.

**Action** :
1. Connexion au dashboard Sentry (org `vitfix-production`)
2. Settings → Alerts → Create Alert
3. Recopier les 7 règles depuis [sentry-alerts.md](sentry-alerts.md)
4. Tester chaque règle en simulant le pattern

**Effort** : 1h.
**Bloqueur** : aucun (action UI manuelle).

---

### B. Décision PT — certification AT vs intégration Moloni

**État** : émission fatura PT désactivée (PT-V1). Devis (orçamento) PT toujours fonctionnel.

**Choix à formaliser** :

| Voie | Effort | Coût | Délai | Avantages |
|---|---|---|---|---|
| **A. Certification AT directe** | 6 mois process | 5-10k€ initial + 3-5k€/an audit | 6 mois | Vitfix devient fournisseur certifié, contrôle total |
| **B. Intégration Moloni API** | ~7j de dev | 0€ Vitfix (artisan paie ~30€/mois Moloni) | 2-3 semaines | Rapide, Moloni gère la conformité |
| **C. Retrait marché PT** | 0 dev | 0€ | immédiat | Concentration FR uniquement |

**Documentation** : [pt-fatura-providers.md](../integrations/pt-fatura-providers.md), [pt-fatura-reactivation.md](../integrations/pt-fatura-reactivation.md).

**Action** : décision commerciale à prendre. Recommandation : **Voie B (Moloni)** si > 10 artisans PT actifs.
**Bloqueur** : décision business.

---

### C. eIDAS — passage signature Avancée (AdES)

**État** : niveau Simple (eIDAS art. 25 §1) + hash chain SHA-256 + HMAC. Probatoirement faible en cas de litige.

**Action requise** :
1. Acquisition certificat de signature de serveur auprès d'un PSCo qualifié français (Universign / Yousign / Docusign EU)
2. Setup TSA qualifiée (UniversignTSA recommandé)
3. Implémentation PAdES-B-LT scellement (3-5j de dev)
4. Workflow client : signature à distance via Universign API

**Documentation** : [eidas-niveau.md](eidas-niveau.md).

**Effort** : ~3 semaines de dev + 1000-2000€ setup + 500-1500€/an.
**Bloqueur** : achat certificat PSCo + budget.

---

### D. PA réception — intégration partenaire (FR-V6 stub déjà en place)

**État** : Table `factures_recues` créée + endpoint `/api/pa-incoming` en stub avec validation HMAC. Variable d'env `PA_INBOUND_SECRET` non définie → endpoint répond 503.

**Action requise** :
1. **Choix PA** : Docaposte recommandé (cf. [pa-reception-roadmap.md](pa-reception-roadmap.md))
2. Signature contrat partenaire PA (~2 semaines commercial)
3. Configuration côté PA : URL = `https://vitfix.io/api/pa-incoming`, secret HMAC partagé
4. `wrangler secret put PA_INBOUND_SECRET`
5. Implémentation parsing Factur-X CII complet (`lib/facturx-parser.ts` à créer)
6. UI artisan : page `/pro/factures-recues` (liste + détail PDF + workflow validation/disputed/paid)
7. Notification artisan via Resend email à chaque réception

**Documentation** : [pa-reception-roadmap.md](pa-reception-roadmap.md).

**Effort restant** : ~3 semaines dev + 2 semaines commercial.
**Bloqueur** : signature contrat PA.
**Deadline réglementaire** : **1er sept 2026** (4 mois).

---

### E. UI legal hold sur formulaire devis/facture

**État** : endpoint `POST /api/document-legal-hold` opérationnel + colonnes DB en place. Compteurs visibles sur `/pro/conformite`. **Pas de bouton UI dans le formulaire devis/facture**.

**Action** : ajouter un toggle « Conserver indéfiniment (litige actif) » dans le détail d'un devis ou d'une facture, qui appelle l'API.

**Effort** : 0.5j.
**Bloqueur** : aucun (UI uniquement).

---

### F. 2FA admin enforcement

**État** : Supabase MFA disponible mais non-enforcé pour les admins. Tout le monde peut se connecter sans MFA.

**Action requise** :
1. Définir une convention « admin » (rôle Supabase `super_admin` via `raw_app_meta_data->>'role'`)
2. Forcer MFA enrollment au premier login admin (page intermédiaire)
3. Vérification à chaque action admin sensible : `aal2` factor required (cf. Supabase MFA `aal` claim)

**Effort** : 1j.
**Bloqueur** : décision sur les rôles admin (qui en a un, qui le gère).

---

### G. Backup export legal

**État** : pas de bouton « Télécharger tous mes documents » côté artisan. En cas de litige ou de migration vers un autre logiciel, l'artisan doit demander manuellement.

**Action** : créer endpoint `/api/legal-export` qui génère un ZIP contenant tous les devis/factures (PDF/A-3) + CSV récapitulatif + audit log JSON.

**Effort** : 2j.
**Bloqueur** : aucun.

---

### H. Tests fonctionnels PG functions

**État** : migrations validées syntaxiquement par le job CI `code-quality.yml` mais pas de tests fonctionnels (pgTAP ou Supabase test).

**Action** : ajouter une suite pgTAP qui :
- Insère un devis daté 12 ans, appelle `anonymize_old_devis()`, vérifie anonymisation
- Insère un devis avec `legal_hold=TRUE`, appelle l'anonymisation, vérifie skip
- Tente `UPDATE devis SET status='draft' WHERE status='signed'` → vérifie reject
- Tente `INSERT INTO pt_fiscal_documents` → vérifie reject

**Effort** : 1j.
**Bloqueur** : aucun.

---

### I. DPA tiers à vérifier (RGPD)

**État** : DPA signés avec Supabase, Cloudflare, Sentry, Stripe, Resend. **À vérifier** : Groq, Tavily, Langfuse.

**Action** : envoyer demande DPA à chacun, archiver dans `docs/conformite/dpa/` avec date de signature.

**Effort** : 0.5j commercial.
**Bloqueur** : réponses fournisseurs.

---

## Priorités suggérées

**Court terme (Q2 2026)** :
1. **D** PA réception (deadline 1er sept 2026 → urgent)
2. **A** Sentry alerts (1h, valeur opérationnelle immédiate)
3. **E** UI legal hold (0.5j, complète FR-V5)
4. **I** DPA tiers (0.5j commercial)

**Moyen terme (Q3 2026)** :
5. **C** eIDAS Avancée (avant émission e-invoicing 2027)
6. **B** Décision PT (Moloni si volume > 10 artisans actifs)
7. **G** Backup export legal

**Long terme** :
8. **F** 2FA admin enforcement
9. **H** Tests pgTAP

## Suivi

Items à archiver/supprimer de cette roadmap dès qu'ils sont réalisés. Les déplacer dans `docs/conformite/changelog.md` à venir.
