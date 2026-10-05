# Succursale « Administrateur Judiciaire »

Logiciel du syndic judiciaire / administrateur provisoire de copropriété (loi du 10 juillet 1965, décret du
17 mars 1967), séparé du logiciel Syndic. Il reprend à l'identique la maquette
**« VitFix Syndic Judiciaire » v0.13.1** (application React autonome de 76 écrans).

- Route : `/administrateur-judiciaire` (et `/fr/…`, `/pt/…` par réécriture). Navigation interne par ancre (`#cockpit`, `#mandats`…).
- Accès : réservé aux comptes **syndic** (`role` = `syndic` ou `syndic_*` dans `app_metadata`) et au `super_admin`
  (`middleware.ts`). Non connecté → connexion syndic (`/syndic/login`, qui ramène ensuite au tableau de bord syndic :
  rouvrir l'adresse de la succursale) ; autre rôle → `/auth/login`, qui renvoie vers son propre espace.
  Tests : `tests/administrateur-judiciaire/acces-middleware.test.ts`.
- Activation : `lib/administrateur-judiciaire/flag.ts` — `ADMINISTRATEUR_JUDICIAIRE_LIVE = true` : la route est
  servie en production (derrière la connexion ci-dessus). Le repasser à `false` la retire (404 en production,
  accessible en développement) sans supprimer de code.
- Jamais indexée (`robots` noindex + en-tête `X-Robots-Tag`).
- Données : base locale du navigateur (IndexedDB via Dexie, base `vitfix-administrateur-judiciaire`), mode
  **démonstration** (date figée au 04/06/2026, jeu de données de démo) ou **données réelles** (date du jour, base vide).
  Aucune donnée n'est envoyée au serveur à ce stade.

## Isolement (« ne pas mélanger »)

Tout le code vit sous quatre racines et n'importe rien du logiciel Syndic :

| Racine | Contenu |
|---|---|
| `app/administrateur-judiciaire/` | layout (garde, noindex, CSS) et page |
| `components/administrateur-judiciaire/` | application cliente : `shell/`, `ui/` (primitives), `modules/<section>/` (76 écrans), `data/` (démo), `styles/aj.css` |
| `lib/administrateur-judiciaire/` | `mode.ts`, `store.ts`, `selection.ts`, `db/` (Dexie), `domain/` (délais légaux, fondements, actes, Fixy, imports…) |
| `tests/administrateur-judiciaire/` | tests vitest (oracle, correctifs, base locale) |

Points de contact avec le reste du site (additifs) : `components/common/ConditionalLayout.tsx` (pas d'en-tête/pied
public), `next.config.ts` (réécritures `/fr` `/pt`, en-têtes noindex), dépendances `dexie` et `fake-indexeddb` (dev).

La feuille de style de la maquette est **scopée sous `#aj-root`** et commence par une neutralisation
(`all: revert`) des styles globaux du site (reset Tailwind, `globals.css`) : la maquette reposait sur les styles
par défaut du navigateur.

## Mettre à jour le design (nouvelle version de la maquette)

1. Régénérer polices, avatars et CSS :
   `node scripts/administrateur-judiciaire/extraire-maquette.mjs "<chemin>/VitFix Syndic Judiciaire vX.html"`
2. Porter les écrans modifiés (le code de la maquette est compilé : le décompiler, cf. outils de vérification).
3. Vérifier la fidélité (captures, interactions, scénarios) puis relancer les tests.

## Vérification

La fidélité a été contrôlée automatiquement contre la maquette d'origine :

- **Rendu** : 76 écrans capturés (Playwright, 1440 px et 390 px) et comparés au pixel, au texte et à la structure DOM
  près — 76/76 identiques (écart 0,00 %) dans les deux largeurs.
- **Interactions** : chaque élément cliquable de chaque écran (816 clics, contexte neuf à chaque clic) — même modale,
  mêmes notifications, même navigation, même écran résultant.
- **Données réelles** : scénario complet (bascule en mode réel, création de copropriété, import de la liste des
  copropriétaires, import d'un relevé bancaire avec rapprochement, ajout de prestataire, fiches 360, restauration
  de la démo) — 23 captures identiques.
- **Logique métier** : tests « oracle » — les fonctions de la maquette d'origine ont été exécutées sur des milliers
  de cas ; leurs résultats sont figés dans `tests/administrateur-judiciaire/fixtures/*.json` et rejoués sur le code
  porté (délais légaux, fondements, actes, Fixy, imports CSV, base locale).

Lancer les tests : `npx vitest run tests/administrateur-judiciaire`. Les tests de dates importent
`./fuseau-paris` (fuseau de référence Europe/Paris, indépendant du poste).

### Rejouer la comparaison avec la maquette

Outils dans `scripts/administrateur-judiciaire/verification/` (Playwright, `npx playwright install chromium` une fois) :

```bash
node scripts/administrateur-judiciaire/verification/serve-maquette.mjs "<chemin>/VitFix Syndic Judiciaire v0_13_1.html"
```

Puis, avec le site en développement sur `http://localhost:3001` (utiliser `localhost`, pas `127.0.0.1`) :

| Commande | Rôle |
|---|---|
| `capture.mjs <url> <dossier> ["routes"] [390]` | capture pleine page + texte + structure DOM de chaque écran (`routes.json`) |
| `compare.mjs <réf> <candidat>` | écart pixels, texte et DOM par écran (images de différence dans `<candidat>/_diff`) |
| `explore.mjs <url> <dossier> ["routes"] [max-clics]` | clique chaque élément interactif sur une page neuve et enregistre l'effet |
| `compare-interactions.mjs <réf> <candidat>` | compare les explorations clic par clic |
| `scenario.mjs <scenario.json> <dossier>` | joue un scénario identique sur les deux applications (`URL_MAQUETTE`, `URL_PORTAGE`) — ex. `scenario-donnees-reelles.json` |

Sous Windows, le serveur de développement Turbopack échoue sur les polices Google du site : lancer
`next dev --webpack` ; le CSP du site interdit alors `eval` en développement, d'où l'option `bypassCSP` des outils.
Les écarts attendus après les correctifs listés plus bas n'apparaissent que dans des cas d'erreur (non couverts
par ces outils).

## Écarts volontaires avec la maquette

La maquette est reproduite fidèlement, y compris ses simulations (toasts « Simulation »), ses chiffres de démonstration
codés en dur et ses onglets non branchés. Seuls des **défauts fonctionnels invisibles en usage normal** ont été
corrigés, chacun avec un test de régression (`tests/administrateur-judiciaire/correctifs-*.test.ts(x)`) :

| Domaine | Défaut de la maquette | Correctif |
|---|---|---|
| Modales | Le focus sautait sur « Fermer » à chaque frappe (saisie au clavier impossible dans les formulaires rapides) | Focus pris seulement à l'ouverture ; piège Tab recalculé à chaque Tab |
| Modales | Deux modales empilées : Échap fermait les deux et la page restait bloquée sans défilement | Pile de modales : Échap ferme celle du dessus ; verrou de défilement compté |
| Formulaires rapides | Double clic sur « Enregistrer » = double écriture | Garde de soumission par formulaire |
| Navigation | `#constructor`, `#__proto__`… faisaient planter l'écran | Registre sans prototype |
| Base locale | Imports concurrents en double ; démo partielle définitive si le chargement était interrompu ; écritures de relevé invisibles après interruption | Sérialisation, transaction unique, état resynchronisé |
| Dates | Années > 9999 (ordonnance, durée, prorogation, avis de mutation) : exception pendant le rendu | Bornes de saisie ; mêmes messages d'erreur existants |
| Fixy | Réponse impossible (TypeError) pour une copropriété sans mandat ; double création de mandat ; dictée vocale non nettoyée | Garde, verrou, nettoyage |
| Écrans | Doubles clics (import, imputation, étape de recouvrement) ; échec d'écriture silencieux (prestataires) ; identifiant de mission en collision | Verrous, toast « Enregistrement impossible », identifiant unique |
| Accessibilité clavier | Éléments cliquables utilisables seulement à la souris : lignes de liste et liens « Voir tout → » / « Voir les ordonnances → » du tableau de bord, jours du calendrier de réservation | Rôle, `tabIndex` et activation par Entrée ou Espace (attributs seulement, voir ci-dessous) |

Changements visibles uniquement dans ces cas d'erreur : Échap ne ferme plus que la modale du dessus ; un toast
« Enregistrement impossible » en cas d'échec d'écriture d'un prestataire.

### Attributs DOM ajoutés (accessibilité, règle SonarCloud S1082)

Ces attributs n'existent pas dans la maquette ; balises, classes, textes et styles sont inchangés
(tests : `tests/administrateur-judiciaire/correctifs-clavier.test.tsx`).

| Élément | Attributs ajoutés |
|---|---|
| Tableau de bord : lignes « Échéances prioritaires » et « État des mandats » (`.list-row`) ; lignes de liste de l'écran générique | `role="button"`, `tabindex="0"` |
| Tableau de bord : liens « Voir tout → » et « Voir les ordonnances → » (`<a>` sans `href`) | `role="link"`, `tabindex="0"` |
| Réservation des espaces communs : jours du mois (`.day`, déjà `role="button"`) | `tabindex="0"` |
| Planning : cases vides de la grille (`.week-cell`), raccourci à la souris du bouton « Ajouter » (même formulaire) | `aria-hidden="true"` |
| Fond des modales (`.modal-backdrop`) et panneau de la palette de commandes (`.cmdk-panel`) | `role="presentation"` |

Effet sur la comparaison avec la maquette (section « Vérification ») :

- `capture.mjs` / `compare.mjs` comparent les pixels, le texte et la structure (balises et classes) : ces attributs
  n'y entrent pas.
- `explore.mjs` clique les éléments de son sélecteur (`button`, `[role="button"]`, `.list-row`…) : la liste est la
  même, les `role="button"` ajoutés portant sur des `.list-row` déjà explorées ; `role="link"`, `role="presentation"`
  et `aria-hidden` sont hors sélecteur.
- Une comparaison du DOM attribut par attribut relèverait ces attributs : écart attendu.

Changement visible au clavier seulement : ces éléments entrent dans l'ordre de tabulation et affichent l'anneau de
focus de la maquette (`:focus-visible`) ; Entrée ou Espace a l'effet du clic. Rien ne change à la souris.

### Changements demandés par le propriétaire du produit

| Écran | Changement | Référence |
|---|---|---|
| Fixy | Deux onglets, comme Tempo : « Assistant » (ouvert par défaut) = page d'accueil de Fixy, agent secrétaire, reprise de la maquette `VitFix_Syndic_Judiciaire_13_M1` (conversation « Fixy — Assistant du mandat », réponses de démonstration comme Tempo, Max et Léa) ; « Tableau » = l'écran Fixy de la v0.13.1 (veille, demande, courriel, ordonnance, notes, données réelles), inchangé. Une fois ouvert, le Tableau reste monté (masqué sous l'onglet Assistant) : comme celui de Tempo, il garde son état d'un onglet à l'autre. Statut de l'écran inchangé : « Données réelles ». | Demande de Frédéric, octobre 2026 ; `tests/administrateur-judiciaire/fixy-onglets.test.tsx` |

Effet sur la comparaison avec la maquette v0.13.1 : l'écran `fixy` diffère (puces, onglet Assistant ouvert par
défaut). Son onglet Tableau, une fois la barre des puces retirée et son conteneur déballé, est identique à l'écran
`fixy` de la v0.13.1 (pixels, texte et structure, en mode démo comme en mode réel). Dans le scénario
`scenario-donnees-reelles.json`, l'étape `{"clic":"Tableau"}` qui suit `{"aller":"fixy"}` ouvre le Tableau du portage
et échoue côté maquette (bouton absent) ; la capture `16-fixy` diffère donc de la seule ligne des puces
(« Assistant », « Tableau »).

## Défauts de la maquette conservés, en attente de décision

Ils changent un comportement visible ; ils ne seront corrigés qu'avec l'accord du propriétaire du produit :

1. En mode réel, plusieurs écrans visent une copropriété de démo par défaut (`VM`, `CV`, `TL`, `LM`) : écran vide tant
   qu'on ne resélectionne pas la copropriété (Banque, Reprise, Dossier juridictionnel…).
2. Deux copropriétés aux mêmes initiales reçoivent le même code.
3. Les règles « accomplies » de démonstration s'appliquent en mode réel aux codes LM/CV/TL/VM.
4. Fixy et Dossier du juge gardent le résultat précédent après une nouvelle analyse / un changement de copropriété.
5. Redressement affiche « NaN % » quand le budget vaut 0.
6. L'import de relevé bancaire n'accepte que l'UTF-8 (exports Windows-1252 fréquents).
7. L'échec de la bascule démo ↔ réel n'est pas signalé.

## Suite prévue

Brancher la succursale sur Supabase (base multi-utilisateurs, droits RLS par cabinet) à la place de la base locale,
puis remplacer les actions « Simulation » par de vraies actions (envoi de courriers, signature, banque…).
Toute migration de la base de production nécessite une validation explicite.
