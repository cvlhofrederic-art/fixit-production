# Déclaration Sociale — Scénarios de test manuels

5 scénarios couvrant le module d'aide à la déclaration sociale.

---

## Scénario A — FR BIC Services (cas standard)

Données requises :
- Artisan FR avec `declaration_configuree = true`, `type_activite = 'bic_services'`
- Factures payées dans le trimestre en cours

Vérifications :
- Le CA est calculé depuis les factures (paid_at dans la période)
- Taux affiché : 24,4% (BIC Services)
- Cotisations = CA × 24,4%
- Bouton "Déclarer sur URSSAF" ouvre autoentrepreneur.urssaf.fr
- Bouton "J'ai déclaré" enregistre en DB avec statut 'declare'
- L'historique montre la ligne avec le bon statut

---

## Scénario B — FR avec ACRE actif

Données requises :
- Artisan FR avec `acre_actif = true`, `acre_date_fin` dans le futur

Vérifications :
- Taux réduit de 50% affiché (ex: 12,2% au lieu de 24,4% pour BIC Services)
- Badge ACRE visible sous la carte principale
- Label taux indique "(ACRE -50%)"
- Cotisations = CA × taux réduit

---

## Scénario C — Portugal Prestador de Serviços

Données requises :
- Artisan PT avec `type_activite = 'prestadores_servicos'`
- Factures émises (created_at) dans le trimestre

Vérifications :
- CA calculé depuis created_at (pas paid_at)
- Taux : 21,4% sur 70% du CA (rendimento relevante)
- Minimum 20€/mois (60€/trimestre)
- Bouton "Declarar na Seg. Social" ouvre seg-social.pt
- Liens rapides : Portal das Finanças, Segurança Social, e-Fatura

---

## Scénario D — Artisan non configuré (onboarding)

Données requises :
- Artisan avec `declaration_configuree = false` (ou null)

Vérifications :
- Formulaire de configuration affiché (pas la vue principale)
- Sélection pays FR/PT change les types d'activité disponibles
- FR : 4 types (BIC ventes, BIC services, BNC général, BNC CIPAV)
- PT : 3 types (prestadores, produção, ENI)
- Périodicité visible uniquement pour FR
- ACRE visible uniquement pour FR
- Après sauvegarde, la vue principale s'affiche avec les bonnes données

---

## Scénario E — Alerte deadline + CA zéro

Données requises :
- Date limite dans moins de 15 jours (ou dépassée)
- Aucune facture ni booking dans la période

Vérifications :
- Alerte jaune "X jours restants" si <= 15 jours
- Alerte rouge "Déclaration en retard" si date dépassée
- CA affiché : 0 €, Cotisations : 0 €
- Source affichée : "0 interventions" (fallback bookings)
- Le bouton "J'ai déclaré" fonctionne même avec CA = 0
