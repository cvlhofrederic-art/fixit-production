# Mon Activité — Scénarios de test manuels

4 scénarios couvrant le bloc résumé en langage naturel.

---

## Scénario A — Artisan actif avec données ce mois

Données requises :
- 3+ bookings `completed` ce mois (avec `price_ttc`)
- 1+ booking `completed` le mois dernier (pour la comparaison %)
- Quelques bookings `confirmed` cette semaine

Vérifications :
- ✅ Phrase principale affiche le montant encaissé avec comparaison %
- ✅ Détails : chantiers terminés, nouveaux clients, agenda
- ✅ Total année affiché
- ✅ Bonne nouvelle si progression vs mois dernier
- ✅ Skeleton visible pendant le chargement

---

## Scénario B — Artisan nouveau (zéro données)

- ✅ Message de bienvenue : "Vos statistiques apparaîtront ici dès votre premier chantier terminé."
- ✅ Aucune erreur JS, aucun NaN, aucun €0 bizarre
- ✅ Aucune division par zéro
- ✅ Sélecteur de période fonctionne sans crash

---

## Scénario C — Changement de période

- ✅ Clic "Ce mois" → données du mois en cours
- ✅ Clic "Mois dernier" → données du mois précédent
- ✅ Clic "Cette année" → total annuel affiché
- ✅ Skeleton visible pendant le rechargement
- ✅ Le label de période change (ex: "mars 2026" → "février 2026")

---

## Scénario D — Page stats existante inchangée

- ✅ Les 4 cards stats (interventions, CA, note, motifs) sont toujours là
- ✅ Le tableau des revenus fonctionne
- ✅ L'export CSV fonctionne
- ✅ Aucune régression visuelle
- ✅ Le bloc "Mon activité" est en haut, avant les cards existantes
