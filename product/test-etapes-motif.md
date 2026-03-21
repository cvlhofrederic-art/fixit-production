# Tests — Étapes par motif d'intervention

## Scénario A — Motif avec étapes template

1. Aller dans Motifs → créer "Remplacement robinetterie"
2. Sauvegarder le motif
3. Réouvrir en cliquant "Modifier" → section "Étapes par défaut" visible
4. Ajouter 4 étapes :
   - Couper l'arrivée d'eau
   - Démonter le robinet existant
   - Poser le nouveau robinet
   - Vérifier l'étanchéité
5. Créer un devis → sélectionner ce motif dans le dropdown

**Vérifications :**
- [ ] 4 étapes copiées dans la section "Étapes de l'intervention"
- [ ] 4 lignes de devis créées (prix 0 à remplir)
- [ ] Section visible entre infos client et tableau prestations
- [ ] Générer PDF → section "DÉTAIL DE L'INTERVENTION" présente

## Scénario B — Modification des étapes sur le devis

1. Sur le devis du scénario A, modifier le texte de l'étape 2
2. Supprimer l'étape 3
3. Ajouter une étape 5 manuellement

**Vérifications :**
- [ ] Template motif INCHANGÉ dans les paramètres
- [ ] Ligne devis correspondante mise à jour (texte modifié)
- [ ] Ligne liée à l'étape 3 supprimée automatiquement
- [ ] Nouvelle ligne ajoutée pour l'étape 5

## Scénario C — Motif sans étapes

1. Créer un devis avec un motif sans étapes

**Vérifications :**
- [ ] Aucune erreur, aucun crash
- [ ] Section "Étapes de l'intervention" absente du devis
- [ ] Comportement identique à avant ce ticket
- [ ] PDF sans section "DÉTAIL DE L'INTERVENTION"

## Scénario D — Changement de motif (futur)

Note : le changement de motif sur un devis existant n'est pas encore implémenté
(le dropdown sélectionne un motif par ligne, pas par devis entier).
Ce scénario sera validé quand le workflow devis-motif sera refactoré.

## Scénario E — Non-régression

**Vérifications :**
- [ ] Devis sans motif fonctionnent comme avant
- [ ] Motifs existants sans étapes fonctionnent comme avant
- [ ] Génération PDF inchangée si pas d'étapes
- [ ] Tous les modals du dashboard s'ouvrent correctement (fix display:flex)
- [ ] Le bouton "Modifier" dans les motifs fonctionne
