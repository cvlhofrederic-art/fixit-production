# Audit Contenu — Vitfix.io

**Date :** 13 avril 2026
**Scope :** Pages légales (FR/PT/EN), fichiers i18n (5 locales), pages publiques FR/PT/EN, dashboards (pro, syndic, copro, client)
**Contexte :** EN/NL/ES sont destinées au SEO uniquement pour clients étrangers au Portugal.

---

## Cartographie du périmètre audité

| Zone | Fichiers analysés | Langues |
|------|-------------------|---------|
| Pages légales | 12 pages (mentions, CGU, privacy, cookies) | FR, PT, EN |
| Traductions i18n | 5 fichiers JSON (fr, pt, en, nl, es) + config | FR, PT, EN, NL, ES |
| Pages FR publiques | ~47 pages (services, urgences, villes, blog, spécialités) | FR |
| Pages PT publiques | ~34 pages (serviços, urgência, cidade, blog, preços) | PT |
| Pages EN publiques | ~9 pages (landing, services, legal) | EN |
| Dashboards | pro, syndic, copropriétaire, mobile, components | FR, PT |
| Composants partagés | Footer, données SEO, PDF | FR, PT, EN |

---

## Findings

### Sévérités
- **P0** : Bloquant juridique, données incorrectes affichées aux utilisateurs
- **P1** : Risque légal ou contenu trompeur, corrigible facilement
- **P2** : Incohérence visible par les utilisateurs
- **P3** : Qualité, bonnes pratiques

| ID | Sév. | Catégorie | Source | Description | Fix suggéré |
|----|------|-----------|--------|-------------|-------------|
| C-01 | **P0** | Prix | `app/pt/torne-se-parceiro/page.tsx:82` | Prix Pro PT = **29€/mois** alors que FR/FAQ pro = **49€/mois HT**. Incohérence tarifaire entre marchés, potentiellement confusant si un utilisateur compare. | Aligner sur le prix officiel. Si la différence est voulue, la documenter. Sinon, corriger l'un des deux. |
| C-02 | **P0** | Légal | `app/fr/mentions-legales/page.tsx:29-30` | Siège social = "France" (trop vague) et SIREN = "En cours d'immatriculation". La loi française (LCEN art. 6) exige l'adresse complète du siège et le numéro SIREN effectif. | Renseigner l'adresse complète et le SIREN dès obtention. |
| C-03 | **P0** | Traduction | `app/pt/privacidade/meus-dados/page.tsx:88,229,235,236` | Page PT données personnelles utilise le mot de confirmation français **"SUPPRIMER"** au lieu du portugais. Prompt = "Tapez SUPPRIMER pour confirmer la suppression définitive". | Remplacer par "ELIMINAR" et adapter les labels en PT-PT. |
| C-04 | **P0** | i18n | EN legal pages (legal, cgu, privacy, cookies) | Les pages EN Terms utilisent `t('cgu.preamble.title')`, `t('cgu.art1.title')` etc., mais EN n'a que **19 clés CGU** (titres de sections) contre **112 en FR/PT**. Les articles complets (art1-art14) s'afficheront comme clés brutes ou vides. | Traduire les ~93 clés CGU manquantes en EN, ou rediriger vers les pages FR/PT avec disclaimer. |
| C-05 | **P1** | Routage | `app/confidentialite/page.tsx`, `app/cookies/page.tsx` | Les pages confidentialité et cookies FR sont à la **racine** (`/confidentialite`, `/cookies`) au lieu de `/fr/confidentialite`. Tous les liens internes pointent vers `/confidentialite` (sans préfixe locale). | Migrer sous `app/fr/confidentialite/` et `app/fr/cookies/`, mettre des redirects. |
| C-06 | **P1** | Légal | `app/fr/cgu/page.tsx` | Pas de section distincte **CGV B2B vs B2C**. Le droit de rétractation 14j (art. L221-18 Code conso) n'est mentionné que via des clés i18n mais pas séparé clairement pour le consommateur. | Ajouter un article spécifique "Droit de rétractation (consommateurs)". |
| C-07 | **P1** | Légal | `app/fr/cgu/page.tsx:7` | Pas de **canonical URL** dans les métadonnées (FR mentions-legales en a un, mais pas CGU). | Ajouter `alternates: { canonical: 'https://vitfix.io/fr/cgu/' }`. |
| C-08 | **P1** | Marque | `capacitor.config.ts:5` | appName = **"Fixit Pro"** au lieu de "Vitfix Pro". Nom de marque incorrect dans l'app mobile native. | Changer en "Vitfix Pro". |
| C-09 | **P1** | Marque | `lib/pdf/devis-pdf-v3.ts:800` | URL dans les PDF = **"https://vitfix.pt"** (domaine inexistant). Le domaine officiel est vitfix.io. | Corriger en "https://vitfix.io". |
| C-10 | **P1** | Marque | `components/dashboard/ComptabiliteSection.tsx:356` | Version PT du disclaimer Léa dit "dados **Fixit**" au lieu de "dados **Vitfix**". | Corriger "Fixit" en "Vitfix". |
| C-11 | **P1** | i18n | EN privacy page | EN privacy n'a que **10 clés** (titres) contre **40 en FR/PT**. La page EN affiche les sections sub-processors, droits RGPD etc. via des clés qui n'existent pas en EN. | Traduire les ~30 clés privacy manquantes ou simplifier la page EN. |
| C-12 | **P1** | i18n | EN cookies page | EN cookies n'a que **13 clés** contre **34 en FR/PT**. Les détails des cookies (table, catégories) manquent en EN. | Traduire les ~21 clés cookies manquantes. |
| C-13 | **P1** | PT-BR | `locales/pt.json` — `home.proFeature1Desc` | Utilise "**você**" (brésilien). En PT-PT, utiliser "si" ou reformuler à la 3e personne. | Reformuler sans "você". |
| C-14 | **P1** | PT-BR | `locales/pt.json` — `proDash.ordres.vous` | Valeur = "**Você**" (brésilien). Le dashboard pro PT devrait utiliser du PT-PT formel. | Remplacer par forme impersonnelle ou "O profissional". |
| C-15 | **P2** | Grammaire PT | `app/pt/simulador-orcamento/SimuladorOrcamentoClient.tsx:52,56,59` | "**segundo tipo de trabalho**", "**segundo dimensão**" — il manque la préposition "a". Correct : "segundo **o** tipo", "segundo **a** dimensão". | Ajouter l'article défini après "segundo". |
| C-16 | **P2** | i18n | `locales/fr.json` — `footer.livroReclamacoes` | Valeur **vide** (""). Clé PT du Livro de Reclamações présente dans le fichier FR mais sans valeur. | Supprimer la clé du FR ou mettre "Livre de réclamations" si pertinent. |
| C-17 | **P2** | i18n | `locales/fr.json` + `locales/pt.json` — `proDash.notifs.ago` | Valeur **vide** ("") dans les deux langues. | Renseigner "il y a" (FR) et "há" (PT). |
| C-18 | **P2** | i18n duplicata | `locales/fr.json` | Clés dupliquées avec variation d'accent : `syndicDash.modules.echeances.*` ET `syndicDash.modules.échéances.*` (3 paires de doublons). | Supprimer les doublons avec accent dans le nom de clé (garder "echeances" sans accent). |
| C-19 | **P2** | i18n asymétrie | FR vs PT | **22 clés FR absentes de PT** (btp.guarantees, btp.sites, conciergerie.*, gestionnaire.buildings, etc.) et **25 clés PT absentes de FR** (mob.modules.*, wallet.autre, trades.metaleiro). | Aligner les deux fichiers. |
| C-20 | **P2** | i18n | EN totale | EN n'a que **1 023 clés** contre **4 148 en FR**. **3 437 clés manquantes.** Acceptable si EN = SEO seulement, mais les dashboards et formulaires EN afficheront des clés brutes si un utilisateur anglophone se connecte. | Documenter que l'interface EN n'est pas supportée pour les dashboards. Ou ajouter un fallback vers PT. |
| C-21 | **P2** | Liens | `app/fr/cgu/page.tsx:176`, `app/page.tsx:578,586`, `app/auth/login/page.tsx:565`, `app/pro/register/page.tsx:1166` | Liens vers `/confidentialite` (sans préfixe locale) au lieu de `/${locale}/confidentialite` ou `/${locale}/privacidade`. Fonctionne grâce au routage racine mais incohérent avec le pattern locale-first. | Utiliser `LocaleLink` ou des chemins localisés. |
| C-22 | **P2** | Légal PT | `app/pt/avisos-legais/page.tsx:78` | Référence à la **CNIL** (www.cnil.fr) dans la page PT avisos-legais. Le Portugal utilise la **CNPD** (www.cnpd.pt). | Remplacer CNIL par CNPD pour la version PT. |
| C-23 | **P2** | Légal PT | `app/pt/termos/page.tsx:158` | Référence à la CNIL dans les CGU PT. Même problème que C-22. | Remplacer par CNPD. |
| C-24 | **P3** | Date | `locales/fr.json` — `cgu.lastUpdate`, `cookies.lastUpdate` | Date = "1er janvier 2026". Vérifier si les CGU ont effectivement été mises à jour à cette date. | Mettre à jour la date lors de chaque modification substantielle. |
| C-25 | **P3** | Marque | Divers fichiers | Brand name utilisé sous 4 formes : "VITFIX" (logo, headers), "Vitfix" (texte courant, mentions), "VitFix" (rare), "vitfix.io" (URL). Globalement cohérent, pas de conflit majeur. | Formaliser dans un guide de marque : VITFIX pour le logo, Vitfix pour le texte. |
| C-26 | **P3** | Hardcoded | `app/pro/faq/page.tsx:28,75,99,146` | FAQ pro contient du contenu **hardcodé** en FR et PT dans le même fichier au lieu d'utiliser les clés i18n. | Migrer vers des clés de traduction. |
| C-27 | **P3** | Cookies | `app/cookies/page.tsx` (toutes langues) | La page cookies ne liste que **2 cookies** (sb-access-token, sb-refresh-token). Il manque : le cookie locale (`locale`), le cookie consent (`vitfix_cookie_consent` en localStorage), et les éventuels cookies analytics. | Compléter la liste des cookies et mécanismes de stockage. |
| C-28 | **P3** | Hardcoded | `app/pt/torne-se-parceiro/page.tsx`, `app/pt/precos/[slug]/page.tsx` | Contenu PT prix et FAQ entièrement hardcodé dans les fichiers TSX (pas de clés i18n). OK pour des pages monolingues, mais rend la maintenance difficile. | Acceptable pour le SEO programmatique PT. Migrer si besoin de multilingue. |

---

## Top Risques

1. **C-01 (P0)** — Incohérence tarifaire 29€ vs 49€ entre marchés. Un professionnel ou investisseur qui compare les deux pages verra un prix différent sans explication.
2. **C-02 (P0)** — Mentions légales incomplètes (SIREN manquant, adresse incomplète). Risque d'amende LCEN.
3. **C-03 (P0)** — Page RGPD PT avec texte français. Utilisateur portugais incapable de supprimer ses données car le prompt de confirmation est en français.
4. **C-04 (P0)** — Pages légales EN avec contenu manquant. Un utilisateur anglophone ne peut pas lire les CGU complètes.
5. **C-22/C-23 (P2)** — Référence CNIL dans les pages légales PT alors que l'autorité compétente au Portugal est la CNPD.

---

## Plan de remédiation

### Phase 1 — P0 (immédiat)
1. **C-01** : Valider le prix Pro par marché et corriger les incohérences
2. **C-02** : Compléter les mentions légales (adresse, SIREN) ou ajouter "en cours" visible
3. **C-03** : Traduire "SUPPRIMER" en "ELIMINAR" dans la page mes-dados PT
4. **C-04** : Traduire les clés CGU/privacy/cookies EN ou ajouter un fallback

### Phase 2 — P1 (cette semaine)
5. **C-05** : Migrer confidentialité/cookies sous /fr/ avec redirects
6. **C-06** : Ajouter section droit de rétractation B2C dans les CGU
7. **C-07** : Ajouter canonical URL aux CGU FR
8. **C-08** : Corriger appName Capacitor "Fixit Pro" → "Vitfix Pro"
9. **C-09** : Corriger URL PDF "vitfix.pt" → "vitfix.io"
10. **C-10** : Corriger "Fixit" → "Vitfix" dans ComptabiliteSection
11. **C-13/C-14** : Corriger les "você" brésiliens dans pt.json
12. **C-22/C-23** : Remplacer CNIL par CNPD dans les pages légales PT

### Phase 3 — P2/P3 (prochaine itération)
13. **C-15** : Corriger grammaire "segundo dimensão" → "segundo a dimensão"
14. **C-16/C-17** : Remplir les clés i18n vides
15. **C-18** : Supprimer les clés dupliquées avec accents
16. **C-19** : Aligner clés FR↔PT
17. **C-20** : Documenter la limitation EN pour les dashboards
18. **C-21** : Normaliser les liens vers les pages légales avec LocaleLink
19. **C-24-C-28** : Nettoyage et bonnes pratiques

---

## Questions ouvertes

1. **C-01** : Le prix de 29€/mois PT est-il intentionnel (tarif local) ou un oubli ? Le FAQ pro (`app/pro/faq/page.tsx`) liste 49€ pour le PT aussi, ce qui contredit la page torne-se-parceiro.
2. **C-02** : La société Vitfix SAS est-elle immatriculée ? Si oui, mettre à jour SIREN et TVA. Sinon, ajouter une mention "en cours d'immatriculation" conforme.
3. **C-04/C-11/C-12** : L'objectif pour EN est-il purement SEO (landing pages) ou les utilisateurs EN doivent-ils pouvoir naviguer les pages légales complètes ?
4. **C-22** : Les pages légales PT doivent-elles référencer le droit français (siège social) ou le droit portugais (marché local) ? Double référence potentiellement nécessaire.
