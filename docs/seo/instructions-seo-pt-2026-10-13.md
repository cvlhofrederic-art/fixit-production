# Instructions Claude Code : réindexer et faire ranker les pages PT de vitfix.io

Date : 13/10/2026. Périmètre : `/pt/` uniquement. Ne rien modifier sous `/fr/`, `/en/`, `/es/`, `/nl/` ni dans leurs sitemaps (`/sitemap/2.xml`, `/sitemap/3.xml`). Trois exceptions, nommées en phase 1 : l'index `/sitemap.xml` et les 16 lignes PT de `/sitemap/0.xml` (1.1), les composants partagés qui génèrent des liens sans préfixe de langue (1.3), la règle robots.txt de l'image sociale (1.7).

Fichiers joints à lire avant de commencer :

| Fichier | Rôle |
|---|---|
| `rapport_pt_non_indexees_pour_claude_code.md` | Diagnostic complet (faits mesurés, hypothèses, listes). Version corrigée du 13/10/2026. |
| `pt_non_indexees.csv` | 944 URL PT non indexées + 11 URL annexes, avec priorité P1 / P2 / P3 / technique |
| `pt_sitemap_statut_complet.csv` | 1503 URL du sitemap PT avec statut, données de septembre, priorité (dont 204 `PROTEGER`) |

Situation : au 09/10/2026, 910 des 1503 URL du sitemap PT sont « explorées, actuellement non indexées » et 591 restent indexées (1169 le 24/07). Les pages répondent toutes 200, `index,follow`, canonique propre. Google ne les rejette pas pour un défaut technique : il les juge non nécessaires à l'index. Le travail consiste à rendre chaque URL conservée unique et utile, à supprimer les doublons par redirection, puis à laisser Google réévaluer. Aucune action « rapide » n'existe : Google écrit que la récupération se mesure « sur une période de plusieurs mois ».

## 0. Règles de travail (zéro erreur)

1. Une phase = une branche + une PR + les contrôles de la phase passés + validation du propriétaire avant mise en production. Ne jamais enchaîner deux phases dans une même mise en production.
2. Aucune donnée inventée. Prix, délais, professionnels, avis, chantiers, adresses : uniquement ce que le propriétaire fournit ou ce que la base contient. Si une donnée manque, laisser le bloc absent, ne pas combler.
3. Aucune génération de texte en masse par IA pour remplir des pages. Google classe cela en « scaled content abuse » (politiques anti-spam du 28/08/2026 : « utiliser des outils d'IA générative pour produire de nombreuses pages sans valeur ajoutée »).
4. Ne jamais changer l'URL d'une page `PROTEGER` (colonne `priorite` du CSV complet) sans 301 testée.
5. Ne jamais faire de `noindex` en masse, ne jamais basculer `noindex` puis `index` sur les mêmes URL, ne jamais changer plusieurs fois la structure d'URL : chaque va-et-vient remet le compteur de Google à zéro.
6. Ne pas utiliser « Demander une indexation » en masse (quota journalier, et Google indique « no need to resubmit » pour ce motif). Réservé aux 40 URL stratégiques de la phase 5.
7. Ne jamais créer de nouvelle page métier x ville, de nouvelle ville ou de nouveau métier avant la fin de la phase 3.
8. Toute décision marquée `DECISION PROPRIETAIRE` est bloquante : proposer avec les chiffres, attendre la réponse, ne pas trancher seul.
9. Tout changement doit laisser les pages FR intactes : contrôle automatique en fin de chaque phase (section 7, test T9).
10. Conserver un journal `docs/seo/journal-pt.md` : date, changement, URL concernées, date de mise en production. Il servira à lire les courbes GSC.

## 1. Résultat de l'audit du rapport du 13/10/2026

Vérifié ce jour, à l'identique : compteurs GSC (910 explorées non indexées + 3 noindex dans le sitemap PT, 591 indexées) ; les 5 sitemaps en ligne (27 / 1483 / 1502 / 25 / 1503 URL, 46 URL sans `lastmod`) ; robots.txt (20 groupes d'agents, 24 règles) ; 35 pages rechargées (statut, robots, canonique, hreflang, JSON-LD, mots, liens) ; mesures de doublons reproduites à la décimale (servicos canalizador-ovar et canalizador-aveiro 70,9 % / 69,3 % ; servicos et urgencia 36,4 % / 45,1 % ; canalizador et picheleiro 77,4 %).

Corrections apportées au rapport :

- Section 4 : le rythme de perte ne « s'accélère » pas. Pic de 17 pages par jour du 08 au 19/09, puis 12 et 11 par jour. Il ralentit sans s'arrêter.
- Section 5.4 : « texte propre » 5 à 9 % est mesuré contre tout le modèle (462 pages). Mesuré contre les 22 villes d'un même métier, il vaut 29,7 % (servicos canalizador). Les deux lectures sont vraies : le texte d'un métier est recopié dans ses 22 villes, le socle du modèle dans tous les métiers.
- Section 7.4 et action A6 : retirer `address` et `geo` du `LocalBusiness` était une mauvaise consigne. Google exige `address` sur `LocalBusiness` (doc du 08/09/2026). La consigne correcte est en phase 1, point 1.6.
- Section 7.4 : `FAQPage` et `HowTo` sont présents sur les 1430 pages de grille alors que ces résultats enrichis n'existent plus (HowTo retiré en septembre 2023, FAQ retiré le 07/05/2026).
- Hypothèse H6 : la mention « première détection GSC en mai 2026 » n'était pas vérifiable, retirée.

Rien d'autre à corriger. Les listes d'URL, dates d'exploration et données de septembre des deux CSV sont inchangées.

## 2. Ce que Google applique en 2026 (documentation officielle, lue le 13/10/2026)

### 2.1 Calendrier des mises à jour (tableau de bord officiel)

| Mise à jour | Début | Fin |
|---|---|---|
| December 2025 core update | 11/12/2025 | 29/12/2025 |
| February 2026 Discover core update (EN, États-Unis) | 05/02/2026 | 27/02/2026 |
| March 2026 spam update | 24/03/2026 | 25/03/2026 |
| March 2026 core update | 27/03/2026 | 08/04/2026 |
| May 2026 core update | 21/05/2026 | 02/06/2026 |
| June 2026 spam update | 24/06/2026 | 26/06/2026 |
| August 2026 spam update | 18/08/2026 | 21/08/2026 |
| September 2026 spam update | 24/09/2026 | 08/10/2026 |

Aucune mise à jour en cours au 13/10/2026. Google n'a annoncé aucune nouvelle politique avec ces spam updates (« a normal spam update »). Lecture pour vitfix.io : la chute des indexées commence fin août (après la spam update d'août) et atteint son pic du 08 au 19/09, avant la spam update de septembre. Une spam update agit sur le classement ; ici le symptôme est un retrait d'index (« explorée, actuellement non indexée »), qui relève de la sélection de qualité à l'indexation. Les deux peuvent se cumuler ; aucun des deux n'est démontré. Le plan ci-dessous couvre les deux cas.

### 2.2 Règles qui s'appliquent directement au cas vitfix.io

Citations traduites de l'anglais ; le texte faisant foi est celui des URL de la section 10.

| Règle Google (source, date) | Texte ou sens | Constat sur `/pt/` | Conséquence |
|---|---|---|---|
| Doorway abuse (politiques anti-spam, 28/08/2026) | Exemples cités : « plusieurs pages ciblant des régions ou des villes spécifiques qui renvoient les utilisateurs vers une même page » ; « des pages substantiellement similaires, plus proches de résultats de recherche que d'une hiérarchie navigable » | 3 modèles sur la même grille métier x ville, 88 à 92 % de texte commun, aucune donnée locale, 0 lien vers un professionnel | Réduire à une URL par intention, avec du contenu local réel (phases 2 et 3) |
| Scaled content abuse (idem) | « De nombreuses pages générées dans le but principal de manipuler le classement et non d'aider les utilisateurs », « quelle que soit la méthode de création » | 1430 pages générées depuis un gabarit | Interdit de corriger par génération automatique de variantes (règle 0.3) |
| Keyword stuffing (idem) | Exemple cité : « blocs de texte listant les villes et régions qu'une page cherche à cibler » | Listes de villes sur les hubs (544 et 499 liens) et blocs « villes voisines » sur les pages de grille (à inventorier en phase 0) | Garder des liens utiles et contextuels, pas de listes de 22 villes sur chaque page (phase 4) |
| Contenu utile, people-first (05/10/2026) | Le contenu principal est évalué sur « effort, originalité, talent ou compétence, exactitude » ; « générer automatiquement des pages depuis des flux ou produire de grandes quantités de texte par IA sans supervision représente peu ou pas d'effort » ; question : « le contenu est-il produit en masse ? » | Oui, actuellement | Phase 3 : contenu issu de l'activité réelle |
| Guide IA générative (10/07/2026) | « Créer du contenu séparé pour chaque variation possible d'une recherche » dans le but de manipuler le classement « viole la politique scaled content abuse » ; « une grande quantité de pages ne rend pas un site plus pertinent » ; privilégier le contenu « non-commodity » : point de vue de première main, expérience réelle | urgencia et perto-de-mim sont des variations de requête de servicos ; `picheleiro` est un synonyme de `canalizador` | Consolidation (phase 2), contenu de première main (phase 3) |
| Consolidation des doublons (10/07/2026) | La redirection permanente est « un signal fort » ; à utiliser « pour se débarrasser de pages dupliquées existantes » ; les URL du sitemap sont « suggérées comme canoniques » | Doublons toujours en ligne et dans le sitemap | 301 plutôt que noindex (phase 2) |
| Budget d'exploration (22/07/2026) | « Consolider le contenu dupliqué » ; « ne pas utiliser noindex » pour gérer le crawl ; retourner 404 ou 410 pour les pages supprimées ; éliminer les soft 404 ; sitemaps à jour avec `lastmod` | 5 anciens articles redirigés vers l'index du blog (soft 404 probable) | Phase 1 |
| Sitemaps (08/07/2026) | `lastmod` utilisé seulement s'il est « constamment et vérifiablement exact » ; doit refléter « la dernière modification significative » ; n'inclure que les URL canoniques voulues en résultat ; `priority` et `changefreq` ignorés | `lastmod` figé aux 07, 09 et 11/05/2026 sur 1430 URL ; 4 URL noindex dans le sitemap ; URL PT déclarées en double | Phase 1 |
| Canonicalisation (10/07/2026) | Lier en interne vers l'URL canonique de façon cohérente ; les pages d'un groupe hreflang sont préférées comme canoniques | Liens internes vers `/pesquisar/` sans préfixe et vers `/pt/pesquisar` sans slash | Phase 1 |
| hreflang (21/09/2026) | Réservé aux « variantes localisées du même contenu » ; chaque version doit lister toutes les autres ; « si deux pages ne pointent pas l'une vers l'autre, les balises sont ignorées » | `fr-FR` pointe vers `/fr/services/` (page générique, non réciproque), `x-default` vers `/` qui redirige ; perto-de-mim sans hreflang | Phase 1 : ne garder que ce qui est équivalent et réciproque |
| LocalBusiness (08/09/2026) | `address` obligatoire = « l'emplacement physique de l'entreprise » ; « définir chaque emplacement comme un LocalBusiness » | Un `LocalBusiness` ou `EmergencyService` par page de ville avec adresse et coordonnées du centre-ville, sans établissement local | Phase 1 : un seul nœud entreprise avec l'adresse réelle, `Service` + `areaServed` par page |
| Règles des données structurées (10/07/2026) | « Représentation fidèle du contenu de la page » ; « ne pas baliser du contenu trompeur » ; les avis ne sont recommandés que pour « les sites qui collectent des avis sur d'autres entreprises » ; nouvelle règle du 24/07/2026 sur les avis incitatifs non divulgués | `Offer`, `PriceSpecification`, `openingHoursSpecification` génériques | Phase 1 : ne garder que ce qui est visible et vrai |
| FAQ rich result | Supprimé de Google Search le 07/05/2026 ; documentation retirée le 15/06/2026 | `FAQPage` sur toutes les pages | Retirer (sans effet, et du poids inutile) |
| HowTo rich result | Retiré en septembre 2023 | `HowTo` sur les 462 pages urgencia | Retirer |
| Rapport d'indexation (aide GSC) | « Explorée, actuellement non indexée » : « inutile de resoumettre cette URL » ; l'inspection d'URL ne peut pas tester ce statut | 910 URL | La seule voie est le contenu et la structure |
| Demande d'indexation (aide GSC et doc recrawl, 10/12/2025) | Quota journalier ; « demander plusieurs fois le crawl d'une même URL ne l'accélère pas » ; pour beaucoup d'URL, « soumettre un sitemap avec les pages modifiées marquées par lastmod » | | Phase 5 |
| Spam updates (doc Google) | « Les changements peuvent aider si nos systèmes automatisés apprennent, sur une période de plusieurs mois, que le site respecte les règles » | | Ne pas conclure avant 8 semaines, ne pas « thrasher » |
| Mythes IA (guide du 10/07/2026) | `llms.txt` inutile pour Google ; pas de « chunking » ; pas de schéma spécial pour l'IA ; les données structurées « ne sont pas requises » pour les fonctions IA | | Ne rien ajouter de ce type |

### 2.3 Ce que Google ne dit pas

Google ne publie ni seuil de mots, ni seuil de « texte unique », ni délai garanti. Les seuils de la phase 3 (30 % de séquences propres) sont des objectifs de travail internes, mesurables, pas des règles Google. Google ne fournit pas non plus la liste des URL indexées : le statut « indexée déduite » du CSV complet est calculé (1503 - 909 - 3 = 591, égal au compteur GSC).

## 3. Décision de structure (à faire valider avant la phase 2)

Recommandation ferme : **une seule URL par couple métier x ville, le modèle `servicos`**, les deux autres modèles redirigés en 301. Raisons chiffrées : servicos reçoit 312 des 689 clics PT de septembre (urgencia 54, perto-de-mim 109) ; servicos est le modèle le moins rejeté (54 % contre 72 % et 57 %) ; « urgente » et « perto de mim » sont des variations de la même recherche ; Google qualifie de doorway les « pages substantiellement similaires » ciblant des villes, et de scaled content « le contenu séparé pour chaque variation d'une recherche ».

`DECISION PROPRIETAIRE 1` : valider la consolidation (option A) ou demander l'option B (garder les 3 modèles, n'indexer que les couples avec données locales réelles, `noindex,follow` hors sitemap pour les autres). L'option B garde 946 URL faibles en ligne et repose sur `noindex`, que Google déconseille comme outil de gestion ; elle n'est proposée que si une raison métier impose les 3 modèles.

`DECISION PROPRIETAIRE 2` : les 22 hubs métier actuels (`/pt/perto-de-mim/{metier}/`) deviennent les pages métier du site (recommandé : URL inchangées, 2 sont indexées, Google les connaît) ou sont déplacés vers `/pt/servicos/{metier}/` en 301 (hiérarchie plus propre, mais un changement d'URL de plus pendant la convalescence). Recommandation : garder les URL maintenant, reconsidérer après récupération.

`DECISION PROPRIETAIRE 3` : adresse réelle à publier (siège de VITFIX CONSTRUÇÕES, LDA) et confirmation qu'aucun établissement n'existe dans les 22 villes. Sans cette confirmation, la phase 1.6 ne peut pas être finalisée.

`DECISION PROPRIETAIRE 4` : liste des données réelles disponibles pour la phase 3 (chantiers par ville, fourchettes de prix par métier, professionnels vérifiés actifs par zone, avis réels avec autorisation, délais réels). Fournir sous forme de fichier (CSV ou JSON) ; format proposé en 3.3.

## 4. Phases d'exécution

### Phase 0 : inventaire du code (lecture seule, 1 PR de documentation)

Produire `docs/seo/pt-inventaire.md` avec, pour chacun des points suivants, le chemin exact des fichiers :

- Routes `/pt/servicos/[slug]`, `/pt/urgencia/[slug]`, `/pt/perto-de-mim/[slug]`, `/pt/cidade/[slug]`, `/pt/blog/[slug]`, hubs `/pt/servicos/`, `/pt/urgencia/`, `/pt/perto-de-mim/`, `/pt/cidade/`.
- Source des listes métiers (21 + `picheleiro`) et villes (22) ; source du texte des gabarits (fichiers de traduction, constantes, base) ; champs réellement variables par page (compter : attendu aujourd'hui 2 champs, métier et ville).
- Génération des sitemaps : `/sitemap.xml`, `/sitemap/0.xml` à `/sitemap/3.xml`, `/pt/sitemap.xml` ; origine des `lastmod`.
- Redirections : middleware, `next.config` ou équivalent, serveur ; règle qui envoie les chemins inconnus sans préfixe vers `/pt/` en 200 après redirection.
- Générateur JSON-LD (bloc commun `WebSite` + `Organization` + `HomeAndConstructionBusiness`, blocs par modèle `LocalBusiness`, `EmergencyService`, `Service`, `OfferCatalog`, `Offer`, `PriceSpecification`, `FAQPage`, `HowTo`, `BreadcrumbList`).
- Générateur des balises `title`, `meta description`, `canonical`, `hreflang`, `og:image`.
- Composants de navigation et de maillage : menu, pied de page, « villes voisines », « autres métiers », liens des hubs, liens des pages ville ; tout lien construit sans préfixe de langue (`/pesquisar/`, `/mês`).
- Origine des blocs prix, FAQ, « professionnels », avis ; sont-ils codés en dur ou issus de la base ; y a-t-il des professionnels réels par ville dans la base.
- Vérifier et noter l'état des 9 anciens articles 404 et de `/pt/blog/iva-6-remodelacao-portugal/` (changement de slug sans redirection).

Critère : chaque point répondu avec un chemin de fichier ou « inexistant ». Confirmer ou infirmer les hypothèses H1 à H8 du rapport, section 8, dans le même document.

### Phase 1 : hygiène technique (aucune suppression de page, aucune 301 de grille)

1.1 Sitemaps PT

- Un seul sitemap par URL PT. Les fichiers `/pt/sitemap-*.xml` deviennent la seule source des URL PT : retirer `/sitemap/1.xml` de l'index (1483 URL PT, toutes déjà dans `/pt/sitemap.xml`) et retirer les 16 lignes PT de `/sitemap/0.xml` sans toucher ses 10 lignes FR ni la racine. L'union des sitemaps PT doit rester exactement l'ensemble des URL PT indexables (1503 moins les retraits du point 3, plus les ajouts). Ne pas toucher `/sitemap/2.xml` ni `/sitemap/3.xml`.
- Découper le sitemap PT par modèle : `/pt/sitemap-servicos.xml`, `/pt/sitemap-cidades.xml`, `/pt/sitemap-blog.xml`, `/pt/sitemap-paginas.xml` (et, tant que la phase 2 n'est pas faite, `/pt/sitemap-urgencia.xml`, `/pt/sitemap-perto-de-mim.xml`). Référencer ces fichiers dans l'index `/sitemap.xml`. Dans GSC, soumettre chaque fichier séparément pour suivre l'indexation par modèle sans le plafond de 1000 lignes.
- Retirer du sitemap : `/pt/termos/`, `/pt/avisos-legais/`, `/pt/privacidade/`, `/pt/politica-cookies/` (noindex) et toute URL en redirection. Ajouter `/pt/cidade/`. `/pt/contact/` : voir 1.8.
- `lastmod` = date réelle de dernière modification significative du contenu de chaque page, lue depuis le dépôt ou la base (date du dernier commit touchant le contenu de la page, ou champ `updatedAt`). Jamais la date de build. Si aucune date fiable n'existe pour une page, omettre `lastmod` sur cette page plutôt que d'en mettre une fausse.
- Pas de `changefreq` ni `priority` (ignorés par Google).

1.2 Redirections et 404

- 9 anciens articles (liste dans le rapport, 6.2 ; état en ligne dans la colonne `etat_live_13_10` du CSV) : 301 vers l'article réellement équivalent si un existe (`como-desentupir-canos` -> `cano-entupido-como-resolver` et `sinais-fuga-agua` -> `fuga-agua-como-agir` sont des candidats à confirmer en lisant les deux articles), sinon 410. Supprimer les 5 redirections vers l'index `/pt/blog/`.
- Ajouter la 301 `/pt/blog/iva-6-remodelacao-portugal/` -> `/pt/blog/iva-6-obras-remodelacao-portugal/`.
- `/mês` et les chemins inconnus sans préfixe de langue : ne plus répondre 200 sur `/pt/` après redirection. Les chemins inconnus doivent finir en 404 propre (`noindex` est déjà posé sur la page 404).
- Toute redirection en un seul saut, vers une URL qui répond 200.

1.3 Liens internes

- Tous les liens générés vers `/pesquisar/` et `/pesquisar/?category=...` deviennent `/pt/pesquisar/` (ou sont supprimés si le filtre `category` ne sert pas à l'utilisateur PT). Les valeurs `category` sont des clés françaises (`electricite`, `plomberie`, etc.) sur des pages PT : vérifier l'usage réel, corriger ou retirer.
- Tous les liens internes vers la forme avec slash final (`/pt/pesquisar/`, jamais `/pt/pesquisar`).
- Aucun lien interne vers une URL en 404, 3xx ou `noindex` (hors pied de page juridique).

1.4 `title` et `meta description`

- Une seule mention de la marque. Gabarit cible : `{Métier} em {Ville} | VITFIX`, environ 50 à 60 caractères (aujourd'hui 62 à 105 avec « | VITFIX | VITFIX Portugal »).
- `meta description` propre à la page, 120 à 155 caractères, avec un fait réel de la page (zone couverte, délai réel, type de chantier). Pas de liste de villes.
- Un seul `h1` par page (déjà le cas), sans répétition mécanique « {métier} {ville} » dans chaque `h2` (aujourd'hui 9 à 11 `h2` par page de grille, à relire en phase 3).

1.5 hreflang

- Ne garder, sur une page PT, que des alternates qui pointent vers une page équivalente (même contenu dans une autre langue) et qui renvoient réciproquement vers la page PT. Aujourd'hui aucune page de grille PT n'a d'équivalent FR ou EN : supprimer `fr-FR`, `en` et `x-default` sur ces pages et ne garder que l'auto-référence `pt-PT` (ou aucune balise hreflang, ce qui est équivalent pour Google).
- Sur `/pt/` : garder le groupe des accueils seulement si chaque accueil (`/fr/`, `/en/`, `/es/`, `/nl/`) liste bien `/pt/` en retour ; `x-default` doit pointer vers une URL qui répond 200 (`/` redirige aujourd'hui).
- Blog et pages ville : même règle, aucun alternate vers `/fr/blog/` ou `/fr/` génériques.

1.6 Données structurées (JSON-LD)

- Un seul nœud entreprise pour tout le site : `HomeAndConstructionBusiness` (sous-type de `LocalBusiness`) avec `name`, `legalName`, `address` = adresse réelle du siège (`DECISION PROPRIETAIRE 3`), `telephone`, `url`, `areaServed` = liste des 22 municípios (type `City`), `openingHoursSpecification` uniquement si ce sont les horaires réels de réponse, `priceRange` uniquement si vrai. Ce nœud existe déjà dans le bloc commun : le compléter, et retirer les doublons par page.
- Supprimer sur chaque page de grille et de ville le nœud `LocalBusiness` ou `EmergencyService` par ville avec `address` et `geo` de centre-ville.
- Décrire chaque page métier x ville par un nœud `Service` : `serviceType` (le métier), `provider` (référence `@id` du nœud entreprise), `areaServed` (la ville, type `City`), `url`. Les pages ville : `WebPage` + `BreadcrumbList`, pas de `LocalBusiness`.
- Retirer `FAQPage` (résultat enrichi supprimé le 07/05/2026) et `HowTo` (supprimé en 2023). Les FAQ visibles restent dans le HTML si elles sont réelles et propres à la page.
- `Offer`, `OfferCatalog`, `PriceSpecification` : ne garder que si les prix affichés sur la page sont réels et visibles. Sinon retirer.
- Aucun `aggregateRating` ni `review` auto-attribué (Google ne le recommande que pour les sites qui collectent des avis sur d'autres entreprises) ; les avis réels restent visibles en HTML.
- Garder `BreadcrumbList` (cohérent avec le fil d'Ariane visible), `WebSite` (sans `SearchAction` si `/pt/pesquisar/?q=` doit rester bloqué par robots.txt ; sinon retirer la règle robots, pas les deux), `Organization`.
- Contrôle : Rich Results Test sans erreur ni avertissement sur une page de chaque modèle ; aucune propriété obligatoire manquante.

1.7 robots.txt et images sociales

- `og:image` pointe vers `/api/og/?locale=pt`, bloqué par `Disallow: /api/`. Servir l'image sociale depuis un chemin non bloqué (par exemple `/og/pt.png` ou `/pt/og/{slug}.png`) ou ajouter une règle `Allow: /api/og/` avant `Disallow: /api/`.
- Ne pas changer les autres règles. Vérifier avec l'outil robots.txt de GSC que `/pt/servicos/canalizador-ovar/` est autorisée et `/pt/pro/tarifs/` bloquée (ou débloquée si `DECISION PROPRIETAIRE` : la page est `index` avec canonique propre mais interdite au crawl ; choisir).

1.8 Pages hors sitemap

- `/pt/cidade/` : ajouter au sitemap et au maillage (lien depuis `/pt/` et le pied de page).
- `/pt/contact/` (slug non traduit, 200, index) et `/pt/contacto/` (404) : choisir le slug PT (`/pt/contacto/` recommandé), rediriger l'autre en 301, ajouter au sitemap.
- `/pt/profissional/{slug}/` en `noindex,nofollow` : laisser tel quel en phase 1. Si le propriétaire veut les indexer plus tard, elles devront avoir du contenu réel (zone, services, avis). Sans décision, ne rien faire.

Critères de fin de phase 1 : tests T1 à T6 et T9 de la section 7 passés ; sitemaps soumis dans GSC sans erreur ; journal mis à jour. Attendre 7 jours avant la phase 2 pour lire l'effet des sitemaps (nombre d'URL « découvertes » par fichier).

### Phase 2 : consolidation (après `DECISION PROPRIETAIRE 1`)

2.1 Table de redirection

Générer `data/seo/pt-redirects.csv` (colonnes `source,destination,code`) depuis `pt_sitemap_statut_complet.csv` :

- `/pt/urgencia/{metier}-urgente-{ville}/` -> `/pt/servicos/{metier}-{ville}/`, 301 (462 lignes).
- `/pt/perto-de-mim/{metier}-{ville}/` -> `/pt/servicos/{metier}-{ville}/`, 301 (462 lignes) ; `/pt/perto-de-mim/picheleiro-{ville}/` -> `/pt/servicos/canalizador-{ville}/`, 301 (22 lignes).
- `/pt/perto-de-mim/picheleiro/` -> `/pt/perto-de-mim/canalizador/`, 301.
- Les 21 autres hubs `/pt/perto-de-mim/{metier}/` restent en 200 (`DECISION PROPRIETAIRE 2`).
- Vérifier par script que chaque destination existe, répond 200, est `index` et auto-canonique, et qu'aucune source n'est une destination (pas de chaîne).

2.2 Mise en œuvre

- Redirections côté serveur (middleware ou configuration), 301, un seul saut, sans paramètre perdu.
- Retirer les 947 URL sources (946 pages métier x ville + le hub `picheleiro`) de tous les sitemaps le même jour que la mise en production des 301 ; retirer `/pt/sitemap-urgencia.xml` et `/pt/sitemap-perto-de-mim.xml` de l'index ; garder un sitemap `/pt/sitemap-hubs.xml` pour les 21 hubs métier.
- Mettre à jour tous les liens internes vers les destinations (aucun lien interne vers une URL en 301 : test T3).
- `/pt/urgencia/` devient une page unique du service SOS 24h (zone réelle, délai réel, type d'interventions réelles, numéro) qui lie les pages servicos concernées ; elle ne liste plus 462 liens.
- Sur chaque page servicos conservée, un bloc « Urgência 24h em {Ville} » visible (ancre `#urgencia`) reprenant ce qui était propre au modèle urgencia, si ce service existe réellement pour ce métier.
- Les 21 hubs métier (`/pt/perto-de-mim/{metier}/`) lient les 22 pages ville du métier, avec un contenu propre au métier (voir phase 3).

2.3 Garde-fous

- Les pages `PROTEGER` du modèle servicos ne changent pas d'URL.
- Les pages urgencia et perto-de-mim avec clics (15 et 25 pages P1, 17 et 32 clics ; voir aussi les lignes `PROTEGER` de ces modèles dans le CSV complet) sont redirigées comme les autres ; noter leurs destinations dans le journal pour suivre le report des clics.
- Ne pas supprimer les routes : une source qui ne matche pas la table doit finir en 404 propre, jamais en 200 générique.

Critères de fin de phase 2 : T1 à T6, T8, T9 passés ; `pt_sitemap_statut_complet.csv` recalculé : 0 URL urgencia ou perto-de-mim métier x ville dans les sitemaps ; 947 sources en 301 vers une destination 200 ; journal à jour.

### Phase 3 : contenu réel sur les pages conservées (le cœur du chantier)

Cible : 462 pages servicos, 22 pages ville, 21 hubs métier, 3 hubs de section, 31 pages hors grille non indexées (liste dans le rapport, 5.7). Ordre : d'abord les 93 pages P1 et les 204 `PROTEGER`, puis les hubs et pages ville, puis les P2 par impressions décroissantes, puis les P3.

3.1 Principe

Chaque page conservée doit répondre « oui » aux questions de Google (contenu utile, 05/10/2026) : information originale, de première main, qui ne pourrait pas « être produite facilement par un modèle d'IA générative » (guide IA, 10/07/2026). Pour une entreprise de travaux, la matière première existe : chantiers réalisés, devis émis, délais constatés, communes couvertes, équipes et compétences réelles (par exemple les travaux en cordes), photos de chantier. C'est cela qui va sur les pages, pas des paragraphes génériques.

3.2 Gabarit d'une page `/pt/servicos/{metier}-{ville}/` (blocs, dans l'ordre)

| Bloc | Contenu | Source | Obligatoire pour rester indexable |
|---|---|---|---|
| `h1` + intro | Métier + ville, 2 à 4 phrases propres à ce couple : zone réellement couverte (freguesias), base de départ et temps de route réel, type de demandes réellement reçues dans cette ville | Données propriétaire | Oui |
| Chantiers réalisés dans la ville ou à moins de 15 km | 1 à 5 fiches : type de travaux, surface ou quantité, mois et année, commune, 1 photo si disponible ; pas de nom de client sans accord écrit | Base chantiers / devis / factures | Oui (au moins 1 fiche réelle) |
| Prix | Fourchette réelle du métier (celle des pages `/pt/precos/`), avec 1 à 3 exemples de devis réels anonymisés (surface, montant, mois) ; aucune variation par ville inventée | Devis émis | Oui pour les métiers couverts par `/pt/precos/`, sinon absent |
| Délais et disponibilité | Délai réel de première visite et d'intervention constaté sur les derniers chantiers de la zone ; existence réelle ou non du service urgence 24h pour ce métier | Journal des interventions | Oui |
| Comment VITFIX travaille ce métier | Méthode, matériaux, normes, garanties réellement appliquées ; propre au métier (identique entre villes, c'est accepté : c'est le bloc « métier »), rédigé une fois par un humain | Rédaction propriétaire | Oui |
| Urgência 24h em {Ville} | Repris du modèle urgencia (phase 2), seulement si le service existe pour ce métier | | Non |
| FAQ | 3 à 6 questions réellement posées par des clients de ce métier, réponses propres ; pas de FAQ générée par permutation ville | Rédaction propriétaire | Non |
| Avis | Avis réels, datés, avec autorisation ; sinon rien | Clients | Non |
| Liens | Page ville, hub métier, 2 à 4 métiers réellement liés (par exemple telhador et impermeabilizacao), 2 à 4 villes limitrophes réelles ; pas de liste des 22 villes | Maillage | Oui |

Blocs interdits : listes de villes ou de freguesias en bloc de texte, paragraphes « {métier} em {ville} » répétés avec un synonyme, statistiques non sourcées, professionnels fictifs, « plus de X clients satisfaits » sans source, textes traduits automatiquement du FR.

3.3 Format des données réelles à fournir par le propriétaire (`data/seo/local-proof.json` ou CSV)

Chantier : `{ "cidade": "ovar", "metier": "telhador", "tipo": "lavagem e impermeabilização de telhado", "quantidade": "150 m2", "mes": "2026-09", "freguesia": "", "foto": "", "consentimento_nome": false }`. Prix : `{ "metier": "pintor", "min": 0, "max": 0, "unite": "m2", "exemplos": [ { "mes": "2026-08", "quantidade": "", "montante": 0 } ] }`. Délais : `{ "cidade": "ovar", "visita_dias": 0, "intervencao_dias": 0, "fonte": "últimos 10 pedidos" }`. Un chantier sans `mes` ou sans `tipo` n'est pas utilisé.

3.4 Porte de qualité (mesurée par le script de la section 8, à chaque PR)

- Une page servicos reste indexable (dans le sitemap, `index`) seulement si : au moins 1 chantier réel dans la ville ou à moins de 15 km, le bloc délais renseigné, le bloc méthode du métier présent, et au moins 30 % de séquences de 5 mots propres à la page par rapport aux autres pages servicos (aujourd'hui 9 %). Objectif de travail, pas une règle Google.
- Une page qui ne passe pas la porte : `DECISION PROPRIETAIRE` par lot : soit compléter les données, soit 301 vers la page ville `/pt/cidade/{ville}/` (si le métier n'est pas réellement pratiqué dans cette ville) ou vers le hub métier. Pas de `noindex` pour contourner la porte.
- Les pages ville : au moins 35 % de séquences propres (aujourd'hui 31 à 35 %), avec la liste des chantiers réels de la ville et les métiers réellement pratiqués. Les hubs métier : description réelle du métier, méthode, prix de référence, chantiers récents, liens vers les 22 villes réellement couvertes.
- Les 11 articles de blog non indexés (texte déjà unique, 74 %) : relire, corriger les erreurs factuelles, ajouter auteur réel et date de mise à jour réelle, lier depuis les pages métier concernées. Ne pas réécrire pour « rafraîchir ».

3.5 Pages hors grille (31 URL, rapport 5.7)

- `/pt/especialidades/` (223 mots) : contenu réel ou 301 vers `/pt/servicos/`.
- `/pt/mapa-do-site/` (2173 mots, surtout des liens) : garder, lier depuis le pied de page, ne pas l'enrichir artificiellement.
- `/pt/servicos/` (555 liens) et `/pt/urgencia/` (511 liens) : texte propre d'introduction par groupe de métiers ; liens vers les 21 hubs métier et les 22 villes, pas vers les 462 pages.
- `/pt/perto-de-mim/` : devient le hub des 21 hubs métier, avec un texte réel sur la zone d'intervention.
- `/pt/condominio/`, `/pt/profissionais-verificados/`, `/pt/torne-se-parceiro/`, `/pt/mercados/publicar/`, `/pt/precos/canalizador/` : contenu réel propre (qui, comment, chiffres réels) ou fusion par 301 dans la page la plus proche.
- `/pt/privacidade/` et `/pt/mercados/gerir/` : noindex voulu, hors sitemap, rien d'autre.

Critères de fin de phase 3 (par lot) : porte de qualité passée sur 100 % des pages du lot ; T1 à T9 passés ; `lastmod` mis à jour uniquement sur les pages réellement modifiées ; journal à jour avec la liste des URL du lot.

### Phase 4 : maillage et profondeur

- Profondeur maximale 3 clics depuis `/pt/` pour toute page conservée : `/pt/` -> hub métier ou page ville -> page métier x ville.
- `/pt/` lie les 22 pages ville (aujourd'hui 12) et les 21 hubs métier (menu ou blocs), avec des ancres descriptives.
- Chaque page ville lie tous les métiers réellement pratiqués dans la ville (aujourd'hui `/pt/cidade/ovar/` lie 21 servicos et 6 urgencia).
- Chaque hub métier lie ses 22 pages ville conservées.
- Chaque page métier x ville lie sa page ville, son hub métier, 2 à 4 métiers liés et 2 à 4 villes limitrophes réelles (pas les 22).
- Pied de page : liens vers hubs et villes principales, pas vers les 462 pages ; aucun bloc de texte listant les villes.
- Les fiches professionnelles réelles, si le propriétaire décide de les indexer, deviennent des liens sortants des pages métier x ville (« professionnels vérifiés actifs à {ville} »).

Critères : T7 (profondeur maximale 3, 0 orpheline), T3 (aucun lien vers 3xx ou 404).

### Phase 5 : réindexation et suivi (protocole)

5.1 À chaque mise en production

1. `lastmod` mis à jour sur les seules URL modifiées.
2. GSC > Sitemaps : resoumettre l'index `/sitemap.xml` et vérifier que chaque enfant PT est « lu » sans erreur, avec le bon nombre d'URL découvertes.
3. Noter la date et le périmètre dans `docs/seo/journal-pt.md`.

5.2 Demandes d'indexation manuelles (une seule fois, après la phase 3 pour le premier lot)

- 40 URL maximum, par ordre : `/pt/`, `/pt/servicos/`, `/pt/urgencia/`, `/pt/perto-de-mim/`, les 8 pages ville non indexées, les 20 hubs métier non indexés, puis les premières P1 enrichies.
- Pour chaque URL : URL Inspection > Tester l'URL en ligne > vérifier « indexable » > Demander une indexation. Étaler sur plusieurs jours (quota journalier). Ne jamais redemander pour une URL déjà demandée : Google indique que cela n'accélère rien.
- Pour les centaines d'autres pages : le sitemap avec `lastmod` exact est le seul canal.

5.3 Suivi hebdomadaire (même jour chaque semaine, dans le journal)

- GSC > Pages, filtré par chaque sitemap PT : indexées, « explorée, actuellement non indexée », « découverte, actuellement non indexée », « doublon » (ce dernier statut apparaîtra après la phase 2 : c'est attendu et sain pour les URL redirigées).
- GSC > Performances, pages `/pt/` : clics, impressions, position ; suivi séparé des 204 `PROTEGER` et des 93 P1.
- GSC > rapport « Generative AI performance » (disponible depuis juin 2026) pour voir si les pages PT apparaissent dans AI Overviews et AI Mode.
- Script de la section 8 : recalcul de `pt_sitemap_statut_complet.csv` et des mesures de contenu ; comparaison avec la version du 13/10/2026.

5.4 Lecture des résultats et patience

- Ne pas conclure avant 8 semaines après la fin de la phase 3 sur le premier lot. Google : la récupération après une spam update se fait « sur une période de plusieurs mois » ; les changements de canonicalisation ont un délai de réévaluation (doc du 10/07/2026).
- Pendant cette période : corriger les bugs, continuer les lots de la phase 3, ne pas changer la structure d'URL, ne pas toucher aux redirections, ne pas basculer de `noindex`.
- Signal positif attendu dans l'ordre : hausse des URL « découvertes » par sitemap, baisse des « explorées non indexées » sur `/pt/sitemap-servicos.xml`, retour d'impressions sur les P1, puis clics.
- Si après 8 semaines les pages enrichies restent non indexées alors que la porte de qualité est passée : revoir la porte à la hausse (plus de données réelles par page), réduire encore le nombre de pages (fusion par ville), ne pas revenir aux 3 modèles.

## 5. Interdits (résumé)

- Générer des textes de pages par IA ou par permutation ; traduire automatiquement le FR vers le PT pour remplir.
- Inventer prix, délais, avis, professionnels, chantiers, adresses, horaires.
- `noindex` en masse ; alternance `noindex` / `index` ; changer deux fois une URL.
- Demander l'indexation en masse ou plusieurs fois pour la même URL.
- Mettre dans un sitemap une URL `noindex`, redirigée, en 404 ou non canonique ; `lastmod` non réel.
- Adresse ou coordonnées par ville dans le JSON-LD sans établissement réel ; `aggregateRating` auto-attribué ; balisage de contenu invisible.
- Listes de villes ou de freguesias en bloc de texte ; 22 villes liées depuis chaque page.
- Créer un nouveau domaine ou sous-domaine pour « repartir à zéro » (Google : contournement de politique).
- Ajouter `llms.txt`, « chunking », balisage spécial IA : sans effet pour Google.
- Toucher aux pages et sitemaps FR, EN, ES, NL en dehors des deux exceptions de la phase 1.

## 6. Critères de fin globaux (après la phase 5)

- Sitemaps PT : chaque URL indexable dans exactement 1 sitemap ; 0 URL noindex, 3xx ou 404 ; `lastmod` réel ; tous les enfants lus par GSC sans erreur.
- 0 page de grille en doublon par intention : 1 URL par couple métier x ville réellement pratiqué.
- 100 % des pages conservées passent la porte de qualité (3.4) et répondent 200, `index,follow`, canonique propre, profondeur 3 au plus, 0 orpheline.
- Rich Results Test sans erreur sur une page de chaque modèle ; 0 `FAQPage`, `HowTo`, `LocalBusiness` par ville.
- Indicateurs à 12 semaines (objectifs, non garantis) : part des pages servicos conservées indexées supérieure à 80 % (46 % aujourd'hui) ; clics PT mensuels au moins égaux à septembre 2026 (689 clics dans l'export GSC) ; aucune page `PROTEGER` perdue sans report de clics sur sa destination.

## 7. Tests automatiques (à écrire en phase 0, à lancer à chaque PR et en production)

| Id | Test | Attendu |
|---|---|---|
| T1 | Pour chaque URL des sitemaps PT : requête HTTP | 200, `index` (meta robots et `X-Robots-Tag`), canonique = URL, `Content-Type` HTML |
| T2 | Sitemaps PT | Chaque URL dans exactement 1 fichier ; 0 URL noindex, 3xx, 4xx ; `lastmod` au format ISO et antérieur ou égal à maintenant ; 0 `priority`, 0 `changefreq` ; index `/sitemap.xml` référence tous les enfants PT ; `/sitemap/2.xml` et `/sitemap/3.xml` inchangés (empreinte SHA-256 identique à celle du 13/10/2026) |
| T3 | Crawl interne depuis `/pt/` (liens `a[href]`) | 0 lien vers une URL en 3xx, 4xx, 5xx ; 0 lien sans préfixe de langue (`/pesquisar`, `/mês`) ; 0 lien vers une forme sans slash final quand la forme avec slash existe |
| T4 | hreflang sur chaque page PT | Chaque alternate pointe vers une URL 200 qui liste la page PT en retour ; `x-default` en 200 ; aucune alternate vers une page générique |
| T5 | JSON-LD sur une page de chaque modèle et sur 20 pages tirées au hasard | Valide ; 0 `FAQPage`, 0 `HowTo`, 0 `LocalBusiness` ou `EmergencyService` par ville ; 1 nœud entreprise avec `address` réelle ; `Service` avec `provider` et `areaServed` sur les pages métier x ville ; `BreadcrumbList` cohérent avec le fil d'Ariane visible |
| T6 | `title`, `meta description`, `h1` | Marque une fois ; `title` 35 à 65 caractères ; description 80 à 160 caractères, unique par page ; 1 `h1` |
| T7 | Graphe interne | Profondeur maximale 3 depuis `/pt/` pour les pages conservées ; 0 orpheline ; chaque page ville lie ses pages métier ; chaque hub métier lie ses 22 villes |
| T8 | Table de redirection (phase 2) | Chaque source en 301 vers sa destination en un saut ; destination 200 `index` ; 0 chaîne ; 0 boucle ; aucune URL `PROTEGER` en source sans décision écrite |
| T9 | Non-régression FR | 30 URL FR tirées de `/sitemap/2.xml` avant et après : statut, canonique, `title`, hreflang identiques ; `/sitemap/2.xml` identique |
| T10 | Porte de qualité (phase 3) | Pour chaque page du lot : blocs obligatoires présents (par identifiants de section dans le HTML) ; séquences propres au moins 30 % (servicos) ou 35 % (ville) ; 0 bloc interdit (liste de villes, texte identique à une autre ville au-delà du bloc métier) |
| T11 | robots.txt | `/pt/servicos/canalizador-ovar/` autorisée ; `og:image` de 5 pages tirées au hasard non bloquée ; règles hors PT inchangées |
| T12 | 404 | Un chemin inconnu sous `/pt/` et un chemin inconnu sans préfixe répondent 404 avec `noindex`, sans redirection vers `/pt/` |

## 8. Script de mesure `scripts/seo/pt-audit` (à livrer en phase 0)

Entrée : les sitemaps PT en ligne (ou `pt_sitemap_statut_complet.csv` pour la base du 13/10/2026). Sortie : `reports/seo/pt-audit-{date}.csv`, une ligne par URL, et un résumé par modèle.

Pour chaque URL : statut HTTP, URL finale, `X-Robots-Tag`, meta robots, canonique, `title` et longueur, `meta description` et longueur, nombre de `h1` et `h2`, liste hreflang, types JSON-LD (avec présence de `address` et `geo`), mots du `<main>` (mots alphanumériques en minuscules), nombre de liens internes, liens vers `/pt/profissional/`, liens sans préfixe, `lastmod` du sitemap, date de dernière modification réelle (dépôt ou base).

Mesures de contenu, par modèle (servicos, ville, hubs, blog) : pour chaque page, séquences glissantes de 5 mots du texte de `<main>`, hachées ; `df[h]` = nombre de pages du modèle contenant la séquence ; `propre` = part des séquences avec `df == 1` ; `partage10` = part avec `df >= 10`. Reproduire aussi la mesure « même métier, 22 villes ». Résultats attendus au 13/10/2026 pour contrôler le script : servicos `propre` 9,0 % (indexées) et 9,1 % (non indexées), `partage10` 88 % ; canalizador 22 villes `propre` 29,7 %, `partage10` 67,1 %.

Graphe : liens `a[href]` internes normalisés (slash final, sans paramètres), liens entrants par page, profondeur par parcours en largeur depuis `/pt/`.

Recoupement GSC : exporter chaque semaine le rapport Pages par sitemap (CSV) et le rapport Performances (pages, 28 jours, filtre `/pt/`), les joindre au CSV du script sur `chemin`, et recalculer les colonnes `statut_gsc`, `clics`, `impressions`, `priorite` du fichier `pt_sitemap_statut_complet.csv`.

## 9. Ordre et calendrier indicatif

| Semaine | Phase | Livrable |
|---|---|---|
| 1 | 0 | `docs/seo/pt-inventaire.md`, tests T1 à T12, script d'audit, décisions 1 à 4 posées au propriétaire |
| 1 à 2 | 1 | PR hygiène technique en production ; sitemaps soumis ; 7 jours d'observation |
| 3 | 2 | PR consolidation (après décision 1) ; 947 redirections ; sitemaps mis à jour |
| 3 à 10 | 3 | Lots de contenu réel : lot A = 93 P1 + hubs + pages ville ; lot B = `PROTEGER` ; lots C et suivants = P2 puis P3 par ville |
| 4 à 10 | 4 | Maillage, en parallèle des lots |
| 3 puis chaque semaine | 5 | Journal, sitemaps, suivi GSC ; demandes d'indexation manuelles une seule fois après le lot A |
| 11 à 18 | 5 | Lecture des résultats ; aucune modification de structure |

Si le propriétaire ne peut pas fournir les données réelles de la phase 3 pour une ville ou un métier, la bonne réponse est de réduire le nombre de pages (301 vers la page ville ou le hub), pas de remplir avec du texte.

## 10. Sources (lues le 13/10/2026)

Google, documentation officielle :

- Politiques anti-spam (mise à jour 28/08/2026) : https://developers.google.com/search/docs/essentials/spam-policies
- Créer du contenu utile, fiable, people-first (05/10/2026) : https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Conseils sur le contenu généré par IA (01/10/2026) : https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- Optimiser pour les fonctions d'IA générative (10/07/2026) : https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Consolidation des URL dupliquées (10/07/2026) : https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Créer et envoyer un sitemap (08/07/2026) : https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Optimiser le budget d'exploration (22/07/2026) : https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget
- Demander une nouvelle exploration (10/12/2025) : https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- Données structurées LocalBusiness (08/09/2026) : https://developers.google.com/search/docs/appearance/structured-data/local-business
- Règles générales des données structurées (10/07/2026) : https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- Versions localisées, hreflang (21/09/2026) : https://developers.google.com/search/docs/specialty/international/localized-versions
- Journal des modifications de la documentation (FAQ retiré 07/05/2026, HowTo retiré 14/09/2023, spam et IA 15/05/2026, back button hijacking 13/04/2026, site reputation EEE 28/08/2026) : https://developers.google.com/search/updates
- Historique des mises à jour de classement : https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history
- Aide Search Console, rapport d'indexation des pages : https://support.google.com/webmasters/answer/7440203
- Aide Search Console, outil d'inspection d'URL : https://support.google.com/webmasters/answer/9012289

Presse spécialisée (contexte des spam updates 2026, analyses non officielles) :

- Search Engine Journal, 08/10/2026 : https://www.searchenginejournal.com/google-september-2026-spam-update-complete/592283/
- Search Engine Roundtable, 08/10/2026 : https://seroundtable.com/google-september-2026-spam-update-done-42235.html
- PPC Land, 08/10/2026 : https://ppc.land/googles-spam-update-ends-after-nearly-14-days-violating-sites-risk-demotion/
- Glenn Gabe, GSQi, 31/08/2026 (études de cas, contenu programmatique et IA) : https://gsqi.com/marketing-blog/august-2026-google-spam-update-case-studies/
- WitsCode, 25/08/2026 (reprise des politiques, pages « {métier} in {city} ») : https://witscode.com/blogs/google-august-2026-spam-update
