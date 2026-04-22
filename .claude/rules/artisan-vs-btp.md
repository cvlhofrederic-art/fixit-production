# Artisan vs BTP Pro — Séparation stricte

**RÈGLE #1 :** Ne JAMAIS modifier le côté BTP Pro (`orgRole === 'pro_societe'`) quand l'utilisateur demande une modif côté Artisan (`orgRole === 'artisan'`), et inversement. Sans demande explicite, la modif s'applique à UN seul côté.

## Matrice des fichiers

| Zone | Artisan | BTP Pro | Partagé (⚠️ conditionner) |
|---|---|---|---|
| Formulaire devis/facture | `components/DevisFactureForm.tsx` | `components/DevisFactureFormBTP.tsx` | — |
| Générateur PDF | `lib/pdf/devis-generator-v2.ts` (V2) | `lib/pdf/devis-pdf-v3.ts` (V3) | `lib/pdf/build-v2-input.ts` |
| Téléchargement PDF | `downloadSavedDevis` avec `useBtpDesign: false` | `downloadSavedDevis` avec `useBtpDesign: true` | `lib/pdf/download-saved-devis.ts` |
| Section Devis | `DevisSection` branche artisan | `DevisSection` branche pro_societe | `components/dashboard/DevisSection.tsx` |
| Section Factures | `FacturesSectionV5` branche artisan | `FacturesSectionV5` branche pro_societe | `components/dashboard/FacturesSection.tsx` |
| Section Prestations | artisan uniquement | BTP n'a pas de Prestations | `components/dashboard/PrestationsSection.tsx` |

## Règles de modification

1. **Fichier 100 % Artisan** (ex: `DevisFactureForm.tsx`) → modifier librement, aucun impact BTP.
2. **Fichier 100 % BTP** (ex: `DevisFactureFormBTP.tsx`, `devis-pdf-v3.ts`) → NE PAS TOUCHER sauf demande explicite BTP.
3. **Fichier partagé** (ex: `FacturesSectionV5`, `DevisSection`, `download-saved-devis.ts`) → conditionner avec `orgRole === 'artisan'` ou `useBtpDesign: false` selon le cible. TOUJOURS vérifier que les deux branches restent cohérentes.

## Pièges connus

- **Layout V5 est partagé** : `isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'`. Toucher V5 sans condition impacte les deux. Exemple : bouton Télécharger ajouté dans `FacturesSectionV5` conditionné par `orgRole === 'artisan'`.
- **`useBtpDesign` flag** : `downloadSavedDevis` route vers V2 (artisan) ou V3 (BTP) selon ce flag. Par défaut `false` → V2.
- **Franchise 293B** : Artisan EI/auto/micro. Adapter les mentions PDF V2 en conséquence (`PRIX U.` au lieu de `PRIX U. TTC`, pas de TVA calculée dans la liste factures, etc.). Le V3 BTP gère sa propre logique.
- **Numérotation** : séquence partagée via RPC `next_doc_number`, par `docType` et `artisan_id`. Pas de différenciation artisan/BTP à ce niveau.

## Check-list avant commit

- [ ] Quel(s) rôle(s) (`orgRole`) la modif impacte-t-elle ?
- [ ] Si fichier partagé, la condition (`orgRole === 'artisan'` / `useBtpDesign`) est-elle présente ?
- [ ] Le préfixe de commit reflète-t-il le scope ? (`feat(artisan):`, `fix(btp):`, `feat(shared):`)
- [ ] En cas de doute, tester les deux côtés (artisan + pro_societe) avant de pousser.

## Préfixes commit

- `feat(artisan):` / `fix(artisan):` — modif dashboard artisan uniquement
- `feat(btp):` / `fix(btp):` — modif dashboard BTP pro uniquement
- `feat(shared):` / `fix(shared):` — modif fichier partagé, impact les deux
