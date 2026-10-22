# Comment ranker sur Google en octobre 2026 — appliqué aux nouvelles pages Vitfix du district de Porto

Date : 19/10/2026. Périmètre : `vitfix.io/pt/` (pt-PT). Quatre services dans les 18 concelhos du district de Porto : trabalhos em altura (trabalhos verticais, acesso por corda), renovação de fachadas (prédios e moradias), limpeza de telhados, impermeabilização de telhados, coberturas e terraços.

Comment lire ce guide :

- Chaque règle vient d'une page Google officielle lue le 19/10/2026 : documentation et blog Search Central, aides Google (Business Profile, Search Console, Maps), Search Quality Rater Guidelines (QRG), web.dev, Search Status Dashboard, blog.google. Le lien suit la règle.
- « maj » donne la date « Last updated » affichée par la page. Les pages d'aide `support.google.com` n'en affichent pas. Les QRG lues sont la version du 11/09/2025.
- **Déduction** signale une application à Vitfix que Google n'écrit pas lui-même.
- **Règle interne** signale une règle du projet (CLAUDE.md, `docs/seo/journal-pt.md`). Elle ne vient pas de Google.
- Les extraits exacts des pages ne sont pas recopiés ici : les règles sont résumées en français, et le lien mène au texte d'origine.

---

## 1. Ce que Google récompense en 2026 (en une page)

1. **Des pages faites pour des gens, pas pour le classement.** Les systèmes de Google privilégient le contenu « people-first ». Google donne des signaux d'alerte : produire beaucoup de contenus sur beaucoup de sujets en espérant que certains se classent, automatiser massivement, résumer ce que disent les autres, écrire pour atteindre un nombre de mots, changer une date sans vraie mise à jour, ajouter ou supprimer beaucoup de pages pour paraître « frais » ([Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), maj 05/10/2026).

2. **Apporter plus que les pages déjà en tête.** Question d'auto-évaluation de Google : la page apporte-t-elle une valeur substantielle par rapport aux autres résultats ? ([Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), maj 05/10/2026). Google demande un contenu « non-commodity » : un point de vue fondé sur l'expertise ou l'expérience directe, pas un savoir commun que n'importe qui, ou un modèle d'IA, produirait. Son exemple de contenu banal est un titre du genre « 7 conseils pour un premier achat immobilier » ([Optimizing your website for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), maj 10/07/2026).

3. **De l'effort, de l'exactitude, une relecture humaine.** Le contenu principal est jugé sur l'effort humain, l'originalité, la compétence et l'exactitude. Générer des pages depuis des flux, ou produire en masse du texte par IA sans supervision, vaut « peu ou pas d'effort ». Citer ses sources ne remplace pas l'effort ([Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), maj 05/10/2026). Tout contenu produit avec l'IA doit être vérifié à la main avant publication, y compris title, meta description, données structurées et textes alt ([Using generative AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content), maj 01/10/2026). Utiliser l'IA ne donne ni bonus ni pénalité en soi ([billet du 08/02/2023](https://developers.google.com/search/blog/2023/02/google-search-and-ai-content)).

4. **La confiance avant tout.** Dans l'E-E-A-T, la confiance est l'élément le plus important. L'E-E-A-T n'est pas en soi un facteur de classement. Il doit être évident pour le visiteur qui a créé le contenu, et inventer des profils d'auteurs est une tromperie ([Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), maj 05/10/2026). Les évaluateurs cherchent qui est responsable du site et jugent la réputation sur des sources indépendantes ([QRG § 2.5.2 et 3.3](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf), version du 11/09/2025).

5. **Moins de pages, mais des pages fortes.** Créer un contenu séparé pour chaque façon de formuler une recherche, y compris les requêtes « fan-out » de l'IA, surtout pour manipuler le classement, enfreint la politique « scaled content abuse ». Un grand nombre de pages ne rend un site ni meilleur ni plus pertinent. Inutile de couvrir toutes les variantes de longue traîne : les systèmes comprennent les synonymes ([Optimizing your website for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), maj 10/07/2026). En général, Google n'affiche pas plus de deux pages d'un même site dans les premiers résultats ([A guide to Google Search ranking systems](https://developers.google.com/search/docs/appearance/ranking-systems-guide), maj 10/12/2025).

6. **Les mots des clients, aux bons endroits, sans bourrage.** Employer les mots que les gens tapent, dans le titre, le titre principal, le texte alt et le texte des liens ([Google Search Essentials](https://developers.google.com/search/docs/essentials), maj 10/12/2025). La longueur ne compte pas pour le classement. La répétition excessive fatigue le lecteur et le bourrage de mots-clés est du spam. Les mots-clés dans le domaine ou l'URL n'ont presque pas d'effet ([SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), maj 10/12/2025).

7. **Être trouvé, indexé, et unique.** Google découvre surtout les pages par des liens depuis des pages déjà explorées ([SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), maj 10/12/2025). L'indexation n'est pas garantie : une qualité faible est une cause courante de non-indexation. Google regroupe les pages au contenu similaire et n'en garde qu'une comme canonique ([In-depth guide to how Google Search works](https://developers.google.com/search/docs/fundamentals/how-search-works), maj 18/12/2025).

8. **Le site est jugé aussi dans son ensemble, et sur la durée.** Les systèmes travaillent page par page, mais ils utilisent aussi des signaux à l'échelle du site ([Ranking systems guide](https://developers.google.com/search/docs/appearance/ranking-systems-guide), maj 10/12/2025). Le « helpful content system » fait partie des systèmes de base depuis mars 2024 (même page). Après des améliorations, il peut falloir plusieurs mois pour que Google le constate. Des core updates plus petites, non annoncées, peuvent aussi faire remonter un site amélioré ([Google Search's core updates and your website](https://developers.google.com/search/docs/appearance/core-updates), maj 10/12/2025).

9. **En local : pertinence, distance, notoriété.** Les résultats locaux reposent surtout sur ces trois facteurs. Une fiche Business Profile complète et exacte a plus de chances d'apparaître. On ne peut pas payer pour un meilleur classement local ([Tips to improve your local ranking on Google](https://support.google.com/business/answer/7091?hl=en), page non datée).

10. **Une expérience de page correcte, sans viser la perfection.** Les Core Web Vitals sont utilisés par les systèmes de classement. Les autres aspects de l'expérience de page n'aident pas directement, mais vont dans le sens de ce que Google récompense. Viser un score parfait pour le seul SEO n'est peut-être pas un bon usage du temps ([Understanding page experience](https://developers.google.com/search/docs/appearance/page-experience), maj 22/09/2026).

---

## 2. Le risque n°1 : doorways, contenu à l'échelle, villes en liste

Le projet décline 4 services sur 18 concelhos, soit 72 pages possibles. Il arrive sur un site où 910 des 1 503 URL du sitemap PT étaient « explorées, actuellement non indexées » au 09/10/2026 (**règle interne** : chiffres du journal SEO PT). C'est exactement le terrain que visent trois politiques anti-spam.

### 2.1 Ce que disent les textes

- **Doorway abuse** ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies), maj 28/08/2026). Des pages créées pour se classer sur des requêtes précises et proches, qui mènent à des pages intermédiaires moins utiles que la destination finale. Trois exemples de Google touchent directement le projet :
  - plusieurs domaines ou pages qui ciblent des régions ou des villes et canalisent les visiteurs vers une seule page ;
  - des pages générées pour canaliser les visiteurs vers la partie réellement utile du site ;
  - des pages très semblables, plus proches de résultats de recherche que d'une arborescence claire et navigable.
- **Scaled content abuse** (même page). Produire beaucoup de pages surtout pour manipuler le classement, et non pour aider les gens. Peu importe que le contenu soit produit par automatisation, par des humains ou par les deux ([billet de mars 2024](https://developers.google.com/search/blog/2024/03/core-update-spam-policies)). Exemples cités : générer beaucoup de pages par IA sans valeur ajoutée ; générer des pages à partir de flux, de résultats de recherche ou d'autres contenus, y compris par synonymes ou traduction automatique, quand cela apporte peu ; assembler des contenus sans valeur ajoutée. Si un tel contenu est déjà hébergé, Google demande de l'exclure de la recherche. Depuis le 15/05/2026, la définition du spam couvre aussi la manipulation des réponses d'IA générative de Google Search.
- **Keyword stuffing** (même page). Google cite explicitement les blocs de texte qui listent les villes et les régions sur lesquelles la page veut se classer, ainsi que la répétition peu naturelle de mots. Pour l'action manuelle correspondante, Google demande de vérifier aussi les balises title et les textes alt ([Aide Search Console – Manual Actions report](https://support.google.com/webmasters/answer/9044175?hl=en), page non datée).
- **Ce que regardent les évaluateurs** ([QRG § 4.6.5 et 4.6.6](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf), version du 11/09/2025). Le contenu à l'échelle se juge par la valeur apportée face aux pages similaires du web, quelle que soit la méthode de production. La note la plus basse s'applique quand l'évaluateur le soupçonne fortement après avoir regardé plusieurs pages du site. Parmi les exemples notés au plus bas : des pages créées en remplissant un modèle générique où seuls des noms changent, sans édition manuelle. Le « rechercher-remplacer » est décrit comme une copie à altération minime (la section vise la copie d'autres sites). Ces notes ne servent pas directement au classement ([Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), maj 05/10/2026), mais elles montrent ce que les systèmes doivent écarter.
- **Regroupement des quasi-doublons** ([What is canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization), maj 20/08/2026). Des pages au contenu principal très proche sont regroupées. Une seule est choisie comme canonique et affichée. Le contenu dupliqué n'est pas du spam en soi.

### 2.2 Ce qui fait basculer nos pages

**Déduction** à partir des textes de 2.1. Une série de pages Vitfix devient à risque si :

- elle décline un même texte sur 18 concelhos en ne changeant que le nom de la ville, le H1 et le title ;
- la page concelho n'a d'utile que le bouton d'appel, WhatsApp ou un lien « ver o serviço » vers la page générale ;
- elle crée des URL séparées pour des synonymes : *limpeza* et *lavagem de telhados* ; *trabalhos verticais*, *acesso por corda* et *alpinismo industrial* ; *impermeabilização de coberturas* et *de telhados* ;
- un paragraphe ou un pied de page énumère les concelhos ou les freguesias (« Fazemos … em Amarante, Baião, Felgueiras… ») ;
- les pages d'un même service partagent les mêmes phrases, la même FAQ et les mêmes photos ;
- elle affiche une adresse ou un « bureau » Vitfix dans un concelho où il n'y a pas de local. Les QRG jugent trompeur le fait de prétendre à un local qui n'existe pas (§ 4.5.3), et la politique « scam and fraud » vise les fausses informations sur une entreprise ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies), maj 28/08/2026) ;
- elle vise un concelho où Vitfix n'intervient pas réellement ;
- elle s'appuie sur des domaines du type *impermeabilizacao-porto.pt* redirigés vers vitfix.io (cas cité tel quel dans l'exemple de Google) ;
- elle sort d'un prompt d'IA dont les seules variables sont le service et le concelho, ou d'une traduction de pages françaises sans adaptation ;
- elle republie dans un nouveau dossier un gabarit jugé faible ailleurs sur le site. Google traite le contournement par sous-dossiers, sous-domaines ou nouveaux sites comme un motif de mesures plus larges ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies), maj 28/08/2026).

### 2.3 Ce qui rend une page légitime

- **La page est la destination finale.** On y comprend le service, son périmètre, la méthode, les délais et ce qui fait varier le prix, et on peut demander un orçamento sans changer de page (**déduction** de la définition du doorway).
- **Le contenu principal est propre à la page** : chantiers réels avec photos, fourchettes tirées de vrais orçamentos, délai depuis Marco de Canaveses, contraintes locales vécues. Google valorise l'expertise de première main, par exemple celle qui vient d'avoir réellement fourni un service ou visité un lieu ([Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), maj 05/10/2026).
- **Les pages forment une arborescence navigable** (service → district → concelho), reliée au menu et au fil d'Ariane. C'est ce que Google oppose aux doorways ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies), maj 28/08/2026).
- **Le gabarit peut être commun, pas le contenu.** Mise en page, bloc contact et bloc entreprise peuvent se répéter. Texte, photos, cas et FAQ doivent varier (**déduction** de l'exemple de gabarit des QRG).
- **Une personne qui connaît les chantiers relit et signe chaque page** ([Using generative AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content), maj 01/10/2026).
- **Une paraphrase utile est permise.** Les QRG admettent qu'un expert reformule une règle publique en langage clair (§ 4.6.6). Exemple possible : les démarches auprès de la câmara municipal pour un échafaudage, si Vitfix les connaît réellement et ajoute son expérience (délais, coûts, pièges).
- **Fusionner est légitime.** Google cite la consolidation de plusieurs pages en une comme une raison normale de rediriger ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies), maj 28/08/2026).

### 2.4 Seuils pratiques

Google ne donne aucun chiffre pour le nombre maximal de pages ville × service, la part de texte propre à chaque page ou une longueur minimale. « Suffisamment différent » et « substantiellement unique » ne sont pas chiffrés. Les seuils ci-dessous sont donc des **tests de décision** tirés des textes, pas des chiffres Google.

| Test | Question à se poser | Si la réponse est non | Fondement |
|---|---|---|---|
| Ville interchangeable | Si l'on remplace le nom du concelho par un autre, la page devient-elle fausse quelque part ? | Pas de contenu propre : ne pas publier | QRG § 4.6.5-4.6.6 (gabarit, rechercher-remplacer) |
| Destination finale | Le visiteur peut-il décider et demander un orçamento sans quitter la page ? | Page d'atterrissage : à compléter | Doorway abuse |
| Comparaison | Peut-on écrire en une phrase ce que la page apporte de plus que les résultats actuels de google.pt sur sa requête ? | Pas d'apport : ne pas publier | Creating helpful content |
| Série | En lisant trois pages du même service côte à côte, les phrases, la FAQ et les photos diffèrent-elles ? | La série paraît produite à l'échelle | QRG § 4.6.5 |
| Preuve locale | La page contient-elle au moins un élément vérifiable propre au concelho (chantier documenté, photo, délai réel, contrainte vécue) ? | Rester sur la page du district | Seuil éditorial Vitfix : choix prudent, pas une règle Google |
| Navigation | La page est-elle liée depuis la page du service et le fil d'Ariane, pas seulement depuis le sitemap ? | Page orpheline ou proche d'une page de résultats | Spam policies ; [Link best practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |
| Indexation | Quelques semaines après publication, Search Console la montre-t-elle indexée avec sa propre URL comme canonique ? | Différencier ou fusionner | [Fix canonicalization issues](https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting) |

Les seuls chiffres que Google donne et qui servent au projet :

- en général, deux résultats au plus d'un même site dans les premiers résultats ([Ranking systems guide](https://developers.google.com/search/docs/appearance/ranking-systems-guide), maj 10/12/2025) ;
- jusqu'à deux semaines de maintien dans un groupe de doublons après correction ([Fix canonicalization issues](https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting), maj 21/08/2026) ;
- 20 zones desservies au plus sur la fiche, environ 2 h de route depuis la base ([Manage your service areas](https://support.google.com/business/answer/9157481?hl=en), page non datée) ;
- au moins une semaine complète après la fin d'une core update avant d'analyser ses effets ([Core updates](https://developers.google.com/search/docs/appearance/core-updates), maj 10/12/2025) ;
- plusieurs mois pour qu'une amélioration, ou une mise en conformité après une spam update, soit constatée ([Core updates](https://developers.google.com/search/docs/appearance/core-updates) ; [Spam updates](https://developers.google.com/search/docs/appearance/spam-updates), maj 10/12/2025).

### 2.5 Ce qu'on risque

- **Action manuelle.** « Thin content with little or no added value » couvre les doorways et le contenu repris ; « Major spam problems » cite le contenu à l'échelle. Une action peut viser un motif d'URL ou tout le site, donc aussi la partie française. Il faut corriger toutes les pages concernées : une correction partielle ne donne pas de retour partiel ([Manual Actions report](https://support.google.com/webmasters/answer/9044175?hl=en), page non datée).
- **Signalements.** Depuis avril 2026, Google peut utiliser un signalement de spam pour décider d'une action manuelle, et transmet son texte au propriétaire du site ([Report spam, phishing, or malware](https://developers.google.com/search/help/report-quality-issues), maj 23/04/2026). **Déduction** : un concurrent du Grand Porto peut signaler une série de pages ville × service.
- **Spam updates.** Quatre en 2026 (mars, juin, août, septembre). Un site touché peut remonter s'il se met en conformité, mais sur plusieurs mois ([Spam updates](https://developers.google.com/search/docs/appearance/spam-updates), maj 10/12/2025).
- **Indexation.** **Déduction** : l'indexation est déjà le point faible du site. Des pages minces ajouteraient des « explorées, non indexées » et pèseraient sur les signaux à l'échelle du site ([How Search Works](https://developers.google.com/search/docs/fundamentals/how-search-works), maj 18/12/2025 ; [Ranking systems guide](https://developers.google.com/search/docs/appearance/ranking-systems-guide), maj 10/12/2025).
- **Contenu de partenaires.** Si des textes viennent d'artisans partenaires ou de rédacteurs externes, la politique « site reputation abuse » s'intéresse à la cohérence avec le site, à la qualité, à l'auteur identifié et à la présence du même texte ailleurs. Dans l'EEE, dont le Portugal, une action manuelle à ce titre n'a plus d'effet depuis le 30/08/2026 : la section concernée peut être classée à part du domaine ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies), maj 28/08/2026 ; [billet du 28/08/2026](https://developers.google.com/search/blog/2026/08/update-site-reputation-policy)).

---

## 3. Local : Business Profile, avis, et rôle des pages du site

### 3.1 Question préalable : Vitfix a-t-il droit à une fiche pour ces services ?

Pour avoir une fiche, une entreprise doit rencontrer ses clients en personne pendant ses heures déclarées. Les agents ou sociétés de génération de leads ne sont pas éligibles, pas plus que les entreprises uniquement en ligne ([Business eligibility and ownership guidelines](https://support.google.com/business/answer/13763036?hl=en), page non datée).

Point à trancher par Frédéric : le CLAUDE.md du dépôt décrit Vitfix comme une « Plateforme mise en relation artisans/clients ». Le cadrage du projet le décrit comme une entreprise de services du bâtiment basée à Marco de Canaveses.

- **Si Vitfix réalise et facture lui-même ces travaux avec sa propre équipe** : une fiche unique en zone desservie. Dans l'EEE, Vitfix relève alors du bloc « supplier unit », réservé aux prestataires directs (Google cite la plomberie). Ce bloc ne demande pas d'autres données que ce que Google explore sur le site ([Supplier unit in Google Search](https://developers.google.com/search/docs/appearance/supplier-unit), maj 18/09/2026).
- **Si Vitfix met surtout en relation avec des artisans tiers** : pas de fiche pour ces services, et le positionnement repose sur les pages du site. Le bloc « aggregator unit » exige un agrément et un flux de données ([Aggregator unit in Google Search](https://developers.google.com/search/docs/appearance/aggregator-unit), maj 19/10/2026). Les pages doivent alors dire clairement qui fait les travaux (**déduction** des QRG § 2.5.2 : il doit être clair qui est responsable du contenu et du service).

### 3.2 Réglages de la fiche

- **Nom.** Le nom réel, utilisé de façon constante, sans service, lieu ni slogan, sous peine de suspension ([Guidelines for representing your business on Google](https://support.google.com/business/answer/3038177?hl=en), page non datée). → « Vitfix », jamais « Vitfix Impermeabilização Porto ».
- **Une seule fiche** pour toute la zone desservie. D'autres fiches seulement pour des implantations distinctes, avec leur propre personnel ([Manage your service areas](https://support.google.com/business/answer/9157481?hl=en), page non datée). Pas de bureau virtuel ; un coworking seulement avec enseigne, accueil des clients et personnel présent ([Guidelines](https://support.google.com/business/answer/3038177?hl=en)).
- **Adresse.** Une entreprise qui ne reçoit pas de clients à son adresse doit la masquer et n'afficher que sa zone. Sans enseigne permanente, elle ne peut pas être déclarée comme établissement ouvert au public ([Manage your service areas](https://support.google.com/business/answer/9157481?hl=en) ; [Manage your business address](https://support.google.com/business/answer/2853879?hl=en), pages non datées).
- **Zone desservie.** Jusqu'à 20 zones (villes, codes postaux ou autres zones), pas de rayon. Pas plus d'environ 2 h de route depuis la base, et aussi précis que possible. Sans zone saisie, Google en choisit une ; une modification peut mettre 48 h à s'afficher (mêmes pages). Les 18 concelhos du district tiennent dans la limite. **À vérifier** : l'entité `#business` du site déclare 22 concelhos dans `areaServed` (Porto, Braga, Aveiro ; journal SEO PT, phase 1). Il faut choisir comment la fiche et le site restent cohérents avec la limite de 20.
- **Catégories.** Elles influent sur le classement local. Une catégorie principale précise, qui décrit le cœur d'activité ; le moins possible de catégories secondaires ; pas une par service ; aucune choisie seulement comme mot-clé. Google déduit aussi des catégories du site web et des mentions ailleurs sur le web, et une modification peut entraîner une nouvelle validation ([Manage your business category](https://support.google.com/business/answer/7249669?hl=en) ; [Guidelines](https://support.google.com/business/answer/3038177?hl=en), pages non datées). Les libellés pt-PT sont à lire dans l'interface.
- **Services.** Pour certaines catégories, la fiche liste des services avec une description et un prix facultatifs. Un service peut être mis en avant quand un internaute local le cherche. Un nom de service qui contient un prix ou un téléphone est refusé ([Manage your services](https://support.google.com/business/answer/9455399?hl=en), page non datée). → Les 4 services sous des noms pt-PT clairs.
- **Description.** Services, mission, histoire. Pas de lien, de promotion ni de prix ([Guidelines](https://support.google.com/business/answer/3038177?hl=en)). Si Google propose une description suggérée par IA, la relire et la corriger ([Manage your Business Profile description](https://support.google.com/business/answer/13682007?hl=en), page non datée).
- **Photos.** Nettes, bien éclairées, sans retouche importante ni excès de filtres ou d'IA. Pour une entreprise de services, au moins trois photos « at work » ([Tips for business-specific photos](https://support.google.com/business/answer/6123536?hl=en), page non datée). Pas de captures d'écran, de banque d'images, de collages ni d'images très retouchées ([Tips for posting media to Maps](https://support.google.com/contributionpolicy/answer/7411351?hl=en), page non datée).
- **Posts.** Visibles sur Search et Maps, archivés après 6 mois sauf période définie. Pas de numéro de téléphone dans le texte : utiliser le bouton d'appel ([Create & manage posts](https://support.google.com/business/answer/7342169?hl=en), page non datée). → Un post par chantier réalisé ou par saison, avec un bouton vers la page du service.
- **Horaires.** Les heures réelles de service aux clients. Une activité qui fonctionne uniquement sur rendez-vous ne devrait pas afficher d'horaires ([Guidelines](https://support.google.com/business/answer/3038177?hl=en)). Le journal SEO PT note que Frédéric confirme un atendimento téléphonique 24 h/7 j (13/10/2026). Reste à trancher ce que la fiche affiche ; le site doit dire la même chose.
- **Téléphone et site.** Le numéro et le site uniques et officiels, sous le contrôle direct de l'entreprise ; un numéro local plutôt qu'un centre d'appels ; pas de numéro surtaxé ([Business eligibility and ownership guidelines](https://support.google.com/business/answer/13763036?hl=en)). → Le même numéro +351 sur la fiche, dans le JSON-LD et sur toutes les pages ; site de la fiche = `vitfix.io/pt/`.
- **Liens d'action** (rendez-vous, réservation). Réservés à certaines entreprises. Ils mènent à une page dédiée qui répond 200, sans CAPTCHA, connexion, limitation de débit, blocage d'IP ni géoblocage ; pas de réseau social, de messagerie ni de raccourcisseur ([Business links policies & guidelines](https://support.google.com/business/answer/13769188?hl=en), page non datée). Une « demande de devis » ne figure pas parmi les types listés : à vérifier dans l'interface.
- **Attributs.** Seulement ceux qui sont vrais. Certains font apparaître la fiche sur des recherches qui portent sur eux ([Manage your business attributes](https://support.google.com/business/answer/9049526?hl=en), page non datée).

### 3.3 Avis

- **Effet.** Plus d'avis et de bonnes notes peuvent améliorer le classement local. La notoriété dépend aussi du nombre de sites qui renvoient vers l'entreprise. Répondre aux avis et ajouter photos et vidéos font partie des conseils de Google ([Tips to improve your local ranking](https://support.google.com/business/answer/7091?hl=en), page non datée).
- **Interdits** ([Maps User Generated Content Policy](https://support.google.com/contributionpolicy/answer/7400114?hl=en), page non datée) : toute contrepartie (argent, remise, cadeau, service gratuit) contre un avis, sa modification ou le retrait d'un avis négatif ; plusieurs comptes ; achat d'avis ; ne solliciter que les clients satisfaits ou décourager les avis négatifs ; pression sur place ; demander un contenu précis, y compris le nom d'un employé ; quotas d'avis pour le personnel ; avis en conflit d'intérêts (salariés, sous-traitants, famille, concurrents).
- **Sanctions.** Suppression des faux avis, blocage temporaire des nouveaux avis, dépublication des avis existants, avertissement public sur la fiche ([Business Profile restrictions for policy violations](https://support.google.com/business/answer/14114287?hl=en), page non datée). Le 16/04/2026, Google a annoncé un dispositif contre les pics d'avis spam : pause des nouveaux avis et bandeau visible des consommateurs ([blog.google, 16/04/2026](https://blog.google/products-and-platforms/products/maps/new-ways-were-protecting-businesses-on-maps/)).
- **Routine de fin de chantier.** Lien ou QR code d'avis sur la facture, l'e-mail de remerciement et le message de fin de chantier, envoyés à tous les clients ([Create a Google link or QR code to request reviews](https://support.google.com/business/answer/16816815?hl=en), page non datée). Réponses personnelles, brèves, non promotionnelles ([Tips to get more reviews](https://support.google.com/business/answer/3474122?hl=en), page non datée). Pour une entreprise de services, le client peut indiquer la prestation réalisée, choisie dans la liste de services ou sur le site ([About reviews for service businesses](https://support.google.com/business/answer/9950987?hl=en), page non datée). Les thèmes que Google tire des avis ne se modifient pas ([Understand business summaries](https://support.google.com/business/answer/6088158?hl=en), page non datée) : ne jamais souffler de mots-clés au client.
- **Sur le site.** Afficher de vrais avis comme contenu, avec leur source. Pas de balisage `Review` ni `AggregateRating` sur Vitfix : une entreprise qui contrôle les avis sur elle-même n'obtient pas d'étoiles sur ses pages LocalBusiness ou Organization, même via un widget Google ou Facebook. Depuis le 24/07/2026, la documentation exclut aussi les avis faux ou incités sans le dire, sur la page comme dans le balisage ([Review snippet](https://developers.google.com/search/docs/appearance/structured-data/review-snippet), maj 08/09/2026).
- **Réputation.** Les QRG traitent beaucoup d'avis détaillés et crédibles comme une preuve de bonne réputation, et demandent d'en lire le contenu. Une petite entreprise locale peu présente en ligne n'est pas jugée de faible qualité pour autant ([QRG § 3.3](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf), version du 11/09/2025).

### 3.4 Rôle des pages du site, pour « perto de mim » et pour chaque concelho

- **« perto de mim » et requêtes sans lieu.** La distance se mesure entre l'entreprise et l'internaute. S'il ne partage pas sa position, Google utilise ce qu'il sait de sa localisation ([Tips to improve your local ranking](https://support.google.com/business/answer/7091?hl=en)). La position fait partie des facteurs de pertinence, et une recherche de réparateurs fait plutôt apparaître des résultats locaux ([How Search Works](https://developers.google.com/search/docs/fundamentals/how-search-works), maj 18/12/2025). Une fiche à zone desservie apparaît, avec ses zones, quand on cherche l'entreprise ou sa catégorie ([Business Profile for service businesses](https://support.google.com/business/answer/10514743?hl=en), page non datée). **Déduction** : sur ces requêtes, la fiche (catégorie, services, zones) et la position de l'internaute pèsent le plus. Une page du site ne rapproche pas la fiche de l'internaute. Les hubs `/pt/perto-de-mim/{metier}/` restent utiles s'ils informent (concelhos réellement desservis, délais, preuves), jamais s'ils simulent une présence physique.
- **Requêtes avec un concelho.** Les QRG demandent de tenir compte du lieu explicite de la requête. Un résultat qui l'ignore, ou trop éloigné, ne répond pas ([QRG § 12.3, 12.4, 13.6](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf), version du 11/09/2025). **Déduction** : c'est la raison d'être d'une page concelho, à condition que Vitfix intervienne vraiment dans ce concelho et que la page parle de ce lieu.
- **Le site nourrit la fiche.** Google remplit les fiches à partir de plusieurs sources, dont le contenu explorable du site officiel ([Understand how Google sources & uses info](https://support.google.com/business/answer/2721884?hl=en), page non datée). Sans réponse du propriétaire sous 4 jours, une modification suggérée peut être publiée si d'autres informations publiques, comme le site, la confirment ([Understand Google updates on your Business Profile](https://support.google.com/business/answer/3480441?hl=en), page non datée). → Horaires, téléphone, zone et services identiques sur la fiche et sur les pages.
- **Signaux pays.** `.io` est un domaine générique. Google s'appuie sur les adresses et téléphones locaux, la langue, la devise, les liens de sites locaux et la fiche Business Profile. Il ignore les balises meta géographiques et déconseille d'adapter le contenu à l'adresse IP ([Managing multi-regional and multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites), maj 10/12/2025).
- **Présence officielle.** La fiche validée porte la présence dans Maps et le panneau de connaissances. Le site s'établit par la validation dans Search Console et des données structurées (Organization, fil d'Ariane) ([Establish your business details with Google](https://developers.google.com/search/docs/appearance/establish-business-details), maj 10/12/2025).
- **Mesure locale.** Le rapport de performances de la fiche donne chaque mois les termes de recherche utilisés ([Business Profile performance](https://support.google.com/business/answer/9918094?hl=en), page non datée).
- **Annonces Local Services.** Le Portugal n'apparaît pas dans le sélecteur de pays de la page d'aide ([Local Services Ads – Spain](https://support.google.com/localservices/answer/6224841?hl=en&co=GENIE.CountryCode%3DES), page non datée). **Déduction** : levier indisponible au Portugal, et de toute façon payant.

---

## 4. Architecture recommandée pour les 4 nouveaux services

### 4.1 Contraintes de départ

- **Règle interne : gel A0.** Aucune nouvelle page PT métier × ville et aucun nouveau métier avant la fin de la phase 3 (CLAUDE.md ; `docs/seo/journal-pt.md`). Une validation de correction tourne dans Search Console sur 914 URL depuis le 14/10/2026, à relire vers le 28/10 (journal). Google conseille de laisser du temps et de comparer des périodes propres ([Core updates](https://developers.google.com/search/docs/appearance/core-updates), maj 10/12/2025). **Déduction** : préparer maintenant le contenu et les preuves (photos, chantiers, prix) ; publier après la clôture de la phase 3 et la lecture de la validation.
- **Recoupements avec l'existant.** La grille PT a déjà `impermeabilizacao-{concelho}` et `telhador-{concelho}` sur les 18 concelhos du district (22 au total). Le texte « Como a VITFIX trabalha » d'impermeabilização couvre déjà membrane liquide, tela asfáltica et poliureia ; celui de telhador cite la limpeza de caleiras ; celui d'isolamento-térmico couvre l'ETICS en façade (`lib/data/pt-metodos.ts`). Google conseille qu'un même contenu ne soit accessible que par une URL, en redirigeant les doublons vers la meilleure page ou, à défaut, par `rel="canonical"` ([SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), maj 10/12/2025 ; [Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), maj 10/07/2026).
- **Nature de Vitfix** : voir 3.1.

### 4.2 Principe

Une page forte par intention et par zone réellement pertinente. Les variantes deviennent des sections, pas des URL ([Optimizing your website for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), maj 10/07/2026). Une seule page Vitfix par requête : plusieurs pages proches ne donnent pas plus de positions, puisque Google limite en général un site à deux résultats ([Ranking systems guide](https://developers.google.com/search/docs/appearance/ranking-systems-guide), maj 10/12/2025).

### 4.3 Proposition service par service

| Service | Ce qui existe | Proposition | Règle |
|---|---|---|---|
| Impermeabilização de telhados, coberturas e terraços | Hub `/pt/perto-de-mim/impermeabilizacao/` et 22 pages `impermeabilizacao-{concelho}` | Pas de série parallèle. Enrichir l'existant avec des sections *telhado*, *cobertura plana*, *terraço e varanda*. Une page « terraços » à part seulement si Vitfix a un contenu vraiment distinct (méthode, prix, cas). Si une nouvelle URL remplace une ancienne, 301 de l'ancienne vers la nouvelle. | Une URL par contenu ; 301 pour retirer un doublon (Starter Guide ; Consolidate duplicate URLs) |
| Limpeza de telhados | `telhador-{concelho}` (réparation et pose ; cite la limpeza de caleiras) | Nouvelle page de service pour le district. Sections selon les couvertures réellement traitées, caleiras, traitement de la mousse, hydrofugation, saison. Liens croisés avec telhador. | Intention différente : légitime si le contenu principal diffère (Consolidate duplicate URLs ; canonicalization) |
| Trabalhos em altura (verticais, acesso por corda) | Aucun métier | Nouvelle page de district. Les synonymes (*trabalhos verticais*, *acesso por corda*, *alpinismo industrial*) vivent dans la même page. Les cas d'usage (fachadas, telhados inaccessibles, caleiras, vidros) deviennent des sections, avec liens vers les pages des services concernés. | Pas une page par formulation (AI optimization guide ; doorway : pages très semblables) |
| Renovação de fachadas (prédios e moradias) | Recoupe `isolamento-termico` (ETICS), `pintor`, `obras-remodelacao` | Nouvelle page de district avec deux parcours : *prédio* (condomínio, assembleia de condóminos) et *moradia*. Deux pages seulement si les étapes, les prix et les cas diffèrent vraiment. Liens vers isolamento-térmico et pintor. | Pages distinctes seulement si contenu distinct (canonicalization ; QRG § 4.6.5) |

### 4.4 Pages concelho : seulement si…

Une page « service + concelho » ne se crée que si **toutes** ces conditions sont remplies :

1. Vitfix intervient réellement dans ce concelho pour ce service, et la fiche le déclare dans sa zone ([QRG § 12.4](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf) ; [Manage your service areas](https://support.google.com/business/answer/9157481?hl=en)).
2. Au moins un chantier documenté dans ce concelho : photos, date, problème, solution (seuil éditorial Vitfix, voir 2.4).
3. Des informations propres : délai réel depuis Marco de Canaveses, contraintes vécues du bâti local, démarches municipales réellement connues ([Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), maj 05/10/2026).
4. Les 7 tests de la section 2.4 passent.
5. Aucune page existante ne couvre déjà la même intention dans ce concelho ; sinon, enrichir ou rediriger ([Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), maj 10/07/2026).

Sinon, la page du district suffit. Elle dit en une phrase factuelle où Vitfix intervient, sans liste de villes ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies), keyword stuffing). Commencer par les concelhos où les preuves existent déjà.

**Règle interne** utile : depuis le lot 0 de la phase 3, les pages `servicos` n'affichent les blocs `#chantiers`, `#prazos`, `#precos`, `#metodo` et `#avaliacoes` que si `data/seo/local-proof.json` contient la donnée. Le même mécanisme convient aux nouvelles pages : pas de donnée, pas de bloc, et pas de page concelho.

### 4.5 Hubs, blog et maillage

- **La page du district sert de hub du service.** Elle ne lie que les pages concelho publiées. Ne pas créer en plus un hub « perto de mim » quasi identique pour le même service (**déduction** : pages très semblables dans la politique doorway, et deux résultats par site au plus).
- **Les hubs existants `/pt/perto-de-mim/{metier}/`** sont à relire sous cet angle : nombreux, presque identiques et calqués sur une requête, ils se rapprocheraient de l'exemple de Google ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies), maj 28/08/2026).
- **Blog.** Des articles d'intention « Know » (prix, saison, choix d'une technique) seulement s'ils reposent sur l'expérience de Vitfix, avec un lien vers la page de service. Les QRG distinguent les intentions Know, Do, Website et Visit-in-person, souvent mêlées ([QRG § 12.7](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf)). Pas de « 5 dicas » de savoir commun ([AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)).
- **Liens.** Chaque page importante reçoit au moins un lien `<a href>` d'une autre page du site, placé en contexte. Ancres descriptives, concises, sans bourrage ; pas de « clique aqui » ; pas de série de liens collés ([Link best practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable), maj 10/12/2025). Pas de pied de page qui croise 4 services × 18 concelhos.
- **Liens entre services voisins** (**déduction**) : limpeza ↔ telhador ; impermeabilização ↔ telhador ; fachadas ↔ isolamento-térmico et pintor ; trabalhos em altura ↔ fachadas et limpeza.
- **Fil d'Ariane.** Visible, et balisé en `BreadcrumbList`, selon un parcours type plutôt qu'un calque de l'URL, par exemple Início > Serviços > Limpeza de telhados > Paredes ([Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb), maj 08/09/2026).
- **URL.** Convention existante : minuscules, tirets, sans accents ([URL structure best practices](https://developers.google.com/search/docs/crawling-indexing/url-structure), maj 10/12/2025). Les mots de l'URL ne font presque pas monter la page ([SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)) : choisir pour la cohérence. **Règle interne** : ne jamais changer deux fois une URL.
- **Liens d'autres sites.** Promotion réelle, bouche-à-oreille, adresse du site sur les carrinhas et les devis ([SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)). Pas d'achat ni d'échange de liens, pas de pages partenaires faites pour le maillage croisé ; un lien payé porte `rel="sponsored"` ou `nofollow` ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies), link spam).

### 4.6 Déploiement par lots

- **Lot 1** : les pages de district (trois nouvelles pages et l'enrichissement d'impermeabilização). Sitemap avec `lastmod` réel, liens depuis les hubs et pages voisines, demande d'indexation pour 3 ou 4 URL seulement ([Ask Google to recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl), maj 10/12/2025).
- **Mesurer** après quelques semaines ([SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)), en évitant de multiplier les modifications pendant ce temps (**déduction** de [Core updates](https://developers.google.com/search/docs/appearance/core-updates)).
- **Lot 2** : les pages concelho qui passent les tests, par petits groupes (**déduction** de [Spam updates](https://developers.google.com/search/docs/appearance/spam-updates) : une erreur se paie pendant des mois).
- **Noter** chaque date de mise en production dans `docs/seo/journal-pt.md` (**règle interne**), et ne pas comparer des périodes qui chevauchent une mise à jour ([Core updates](https://developers.google.com/search/docs/appearance/core-updates)).

---

## 5. Gabarit d'une page de service qui peut ranker

### 5.1 Ordre de la page

Le plus utile se place en haut ; le remplissage abondant, ou placé avant le contenu utile, vaut une note « Low » ([QRG § 5.2.2](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf), version du 11/09/2025). Ordre proposé (**déduction**) :

1. H1 : service + lieu (« Limpeza de telhados em Penafiel »).
2. Bloc de décision, visible sans défiler sur mobile : ce qui est inclus et ce qui ne l'est pas, fourchette de prix et délai si les données existent, bouton d'appel et de demande d'orçamento, une photo de chantier réel.
3. Como trabalhamos : méthode, matériaux, sécurité, signé par la personne qui fait le travail.
4. Chantiers réalisés : photos avant/après, problème trouvé, solution choisie, durée.
5. Prix : ce qui les fait varier, fourchette tirée de vrais orçamentos.
6. Particularités locales vérifiées.
7. Perguntas frequentes, visibles.
8. Qui intervient : bloc entreprise, avis réels, liens Sobre nós et Contacto.
9. Liens vers la page du district, les concelhos voisins publiés et les services liés.

### 5.2 Liste de contrôle

**Contenu**
- [ ] Pas de paragraphe générique (« o telhado é a parte mais importante da casa… ») avant l'information utile ([QRG § 5.2.2](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf)).
- [ ] Pas d'objectif de nombre de mots ; un texte court suffit s'il répond ([SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), maj 10/12/2025).
- [ ] Vocabulaire réel des clients en pt-PT dans le title, le H1, les intertitres, les alt et les ancres, sans répétition ([Search Essentials](https://developers.google.com/search/docs/essentials), maj 10/12/2025).
- [ ] Les variantes de longue traîne (prix, délais, matériaux, saison, prédio ou moradia) deviennent des sections ou des questions ([AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), maj 10/07/2026).
- [ ] Aucune section de savoir commun sans apport (« 5 vantagens de limpar o telhado ») ([AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)).
- [ ] Un outil seulement s'il repose sur de vraies données (par exemple un simulateur de prix au m²). Google compte les outils et calculateurs dans le contenu principal, et cite le travail investi comme preuve d'effort ([Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), maj 05/10/2026).

**Preuves d'expérience**
- [ ] Chantiers réels, datés et situés, avec ce qui a été trouvé et choisi ([Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)).
- [ ] Passages techniques écrits ou relus par la personne qui fait le travail. Les QRG prennent l'exemple d'un conseil de recâblage plus fiable venant d'un électricien qualifié ([QRG § 3.4 et 7.1](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf)).
- [ ] Particularités locales (bâti ancien, littoral, mousses) écrites seulement si l'équipe les a constatées.

**Qui est responsable**
- [ ] Un bloc entreprise court : qui opère, téléphone, zone, liens Sobre nós et Contacto. Les QRG demandent qu'on sache clairement qui est responsable ; ces informations peuvent être ailleurs sur le site, et les usages varient selon le pays ([QRG § 2.5.2, 2.5.3](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf)). Le bloc lui-même est un choix de conception.
- [ ] Signature réelle sur les conseils, avec lien vers une page équipe aux qualifications vérifiables. Aucun profil inventé, aucune photo générée ([Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)).
- [ ] Si des artisans partenaires font les travaux, le dire (**déduction**, voir 3.1).
- [ ] Une seule adresse, la vraie (Marco de Canaveses) ; « zona de intervenção » pour le reste ([QRG § 4.5.3](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf) ; [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies), scam and fraud).
- [ ] Aucune affirmation invérifiable (« a melhor empresa », « nº1 », « especialistas certificados ») : les QRG notent « Low » les affirmations exagérées et jugent l'expertise sur des preuves, pas sur des déclarations ([QRG § 5.2, 5.6](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf)).

**Photos et vidéos**
- [ ] Photos originales de chantiers, nettes, placées près du texte qui s'y rapporte, avec un alt descriptif ; pas de banque d'images ([SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)).
- [ ] Images en `<img src>` (Google n'indexe pas les images de fond CSS), nom de fichier court et descriptif, même URL si l'image est réutilisée. `og:image` = une photo de chantier représentative, sans logo ni texte incrusté ([Google image SEO](https://developers.google.com/search/docs/appearance/google-images), maj 02/03/2026).
- [ ] La même photo n'est jamais présentée comme un chantier différent dans plusieurs concelhos (**déduction** : tromperie).
- [ ] Une vidéo courte en complément si elle existe. Pour viser les résultats vidéo, une page dédiée par vidéo ([Video SEO](https://developers.google.com/search/docs/appearance/video), maj 18/12/2025).

**Prix**
- [ ] Fourchettes tirées de vrais orçamentos, avec ce qui les fait varier. Si la fourchette est calculée automatiquement, expliquer la méthode ([Using generative AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content), maj 01/10/2026).
- [ ] Prix, délais, garanties et techniques validés par Frédéric avant publication (même page).
- [ ] « preços » ou « orçamento » dans le title seulement si la page en donne vraiment (**déduction** de [Title links](https://developers.google.com/search/docs/appearance/title-link)).

**FAQ visible**
- [ ] Questions réelles des clients : prix, délais, saison, garantie, autorisations. Utile comme contenu, mais plus de résultat enrichi FAQ depuis le 07/05/2026 ([Latest documentation updates](https://developers.google.com/search/updates), maj 16/10/2026).
- [ ] Pas de balisage `FAQPage` ([Search gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery), maj 16/10/2026).
- [ ] Un accordéon n'est pas du texte caché ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)). Les sections clés restent ouvertes, avec des ancres stables, pour les liens « Read more » des extraits ([Control your snippets](https://developers.google.com/search/docs/appearance/snippet), maj 20/04/2026).

**Contact**
- [ ] Bouton d'appel en `<a href="tel:+351…">` ; formulaire avec de vrais `<label for>` et un `<button type="submit">` ([web.dev – Build agent-friendly websites](https://web.dev/articles/ai-agent-site-ux), maj 01/04/2026, priorité faible).
- [ ] Pas de fenêtre plein écran à l'arrivée sur mobile ; un bandeau discret ([Avoid intrusive interstitials](https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials), maj 10/12/2025).
- [ ] Aucun script (chat, intention de sortie, fenêtre d'orçamento) qui empêche le retour à Google ([billet du 13/04/2026](https://developers.google.com/search/blog/2026/04/back-button-hijacking)).

**Sécurité**
- [ ] Les passages sur le travail en hauteur, la montée sur un toit ou les produits d'étanchéité touchent à la sécurité physique, catégorie YMYL des QRG ([QRG § 2.3](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf)). Rester exact, déconseiller clairement le bricolage dangereux, ne citer que des règles de sécurité réelles. **Déduction** : la page de devis elle-même n'est probablement pas « clairement YMYL ».

**Langue**
- [ ] Toute la page en pt-PT, interface comprise (boutons, formulaires, erreurs, pied de page). Google détermine la langue par le contenu visible ([Managing multi-regional sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites), maj 10/12/2025). Les évaluateurs jugent selon les usages du pays ([QRG § 0.2](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf)). Vocabulaire validé par un rédacteur ou un artisan portugais.

**Rédaction avec l'IA**
- [ ] Les faits viennent de l'équipe ; l'IA structure et propose un premier jet. Une personne relit tout, y compris title, meta description, JSON-LD et alt ([Using generative AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content), maj 01/10/2026).
- [ ] Pas d'auteur « IA » ([billet du 08/02/2023](https://developers.google.com/search/blog/2023/02/google-search-and-ai-content)). Pas de date « atualizado em » rafraîchie sans changement de fond ([Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)).

**Avant publication** : les 7 tests de la section 2.4.

---

## 6. Technique et données structurées (octobre 2026)

### 6.1 Données structurées

| Type | Statut au 19/10/2026 | Usage pour Vitfix |
|---|---|---|
| BreadcrumbList | Pris en charge. Le fil d'Ariane n'est plus affiché sur mobile depuis le 23/01/2025, toujours sur ordinateur | Garder, avec au moins deux éléments et un parcours type |
| LocalBusiness / Organization | Pris en charge (panneau de connaissances, logo, coordonnées) | Une seule entité, sur l'accueil ou Sobre nós ; sous-types précis en tableau `@type` ; pas d'`additionalType` |
| VideoObject | Pris en charge | Si vidéo de chantier : `name`, `thumbnailUrl`, `uploadDate` requis |
| Image metadata | Pris en charge | Facultatif |
| Service | Absent de la galerie : aucun résultat enrichi | Garder s'il décrit fidèlement la page ; aide à la compréhension |
| FAQPage | Plus affiché depuis le 07/05/2026 ; documentation retirée le 15/06/2026 | Ne pas en ajouter |
| HowTo | Plus affiché ; documentation retirée en septembre 2023 | Ne pas en ajouter |
| QAPage | Réservé aux pages où les utilisateurs répondent à une question | Jamais pour une FAQ maison |
| Review / AggregateRating sur Vitfix | Non éligible (avis contrôlés par l'entreprise) | Ne pas en mettre |

Sources du tableau : [Search gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) (maj 16/10/2026), [Latest documentation updates](https://developers.google.com/search/updates) (maj 16/10/2026), [Breadcrumb](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) (maj 08/09/2026), [billet du 23/01/2025](https://developers.google.com/search/blog/2025/01/simplifying-breadcrumbs), [LocalBusiness](https://developers.google.com/search/docs/appearance/structured-data/local-business) (maj 08/09/2026), [Review snippet](https://developers.google.com/search/docs/appearance/structured-data/review-snippet) (maj 08/09/2026).

Règles générales :

- Le balisage décrit fidèlement le contenu visible. Ne pas baliser de contenu invisible, trompeur ou hors sujet. Un problème de données structurées peut entraîner une action manuelle : la page perd l'éligibilité aux résultats enrichis, sans baisse de son classement web ([General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), maj 10/07/2026). → `areaServed` ne cite que les concelhos nommés et desservis sur la page.
- JSON-LD est le format recommandé ; Google lit aussi le JSON-LD injecté par JavaScript. Google peut utiliser `sameAs` et d'autres données schema.org, mais c'est la documentation Search Central qui fait foi ([Introduction to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data), maj 10/12/2025).
- LocalBusiness : `name` et `address` requis ; `telephone` avec indicatif du pays ; `geo` à 5 décimales au moins ; `priceRange` de moins de 100 caractères ; un objet par établissement physique ([LocalBusiness](https://developers.google.com/search/docs/appearance/structured-data/local-business), maj 08/09/2026).
- Organization : sur l'accueil ou une seule page « à propos », pas sur chaque page. `vatID` est présenté comme un signal de confiance pour les utilisateurs ; `taxID` doit correspondre au pays de l'adresse ([Organization](https://developers.google.com/search/docs/appearance/structured-data/organization), maj 08/09/2026).
- Le nom du site affiché se définit sur la page d'accueil racine (`WebSite`), pas sur un sous-dossier comme `/pt/` ([Site names](https://developers.google.com/search/docs/appearance/site-names), maj 10/12/2025).
- **Règle interne** : le schéma PT actuel (une entité `#business`, pages `Service` + `BreadcrumbList` avec `provider` vers `#business`, aucune LocalBusiness par ville, aucun FAQPage, HowTo ni avis auto-attribué) suit déjà ces règles (CLAUDE.md). Les nouvelles pages reprennent ce modèle.

### 6.2 Titres et extraits

- Title distinct, concis, descriptif. Pas de long gabarit où seul le concelho change. Pas de répétition de mots-clés. Le nom du site une fois, au début ou à la fin. Même langue que le contenu ; le H1 porte la même idée et reste le titre le plus visible. Google peut réécrire un title jugé répétitif ou inexact ([Title links](https://developers.google.com/search/docs/appearance/title-link), maj 10/12/2025). **Règle interne** : gabarit `%s | VITFIX`, 65 caractères au plus (CLAUDE.md).
- Meta description propre à chaque page. Google encourage la génération automatique à partir des données de la page si les descriptions restent lisibles et variées ; une liste de mots-clés a peu de chances d'être affichée ([Control your snippets](https://developers.google.com/search/docs/appearance/snippet), maj 20/04/2026).
- Liens « Read more » dans l'extrait (ajout du 20/04/2026) : contenu visible tout de suite, pas de JavaScript qui impose le défilement ou supprime le fragment `#` au chargement (même page).
- Pas de `nosnippet`, de `max-snippet` restrictif ni de `data-nosnippet` sur les blocs de réponse : ils limitent aussi l'usage du contenu dans AI Overviews et AI Mode ([Robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag), maj 24/03/2026).

### 6.3 Core Web Vitals et expérience de page

- Seuils « bons » : LCP dans les 2,5 premières secondes, INP sous 200 ms, CLS sous 0,1 ([Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals), maj 10/12/2025), mesurés au 75e centile, séparément sur mobile et ordinateur ([web.dev – Web Vitals](https://web.dev/articles/vitals), maj 31/10/2024).
- Le rapport Search Console utilise les données réelles de 28 jours, regroupe les URL similaires et donne au groupe le statut de sa pire métrique ; une URL sans assez de données est omise ([Aide Search Console – Core Web Vitals report](https://support.google.com/webmasters/answer/9205520?hl=en), page non datée). **Déduction** : un défaut du gabarit dégrade tout le groupe, et les nouvelles pages n'auront pas de données tout de suite. Tester le gabarit en laboratoire (PageSpeed Insights, Lighthouse mobile) avant de publier.
- La photo de tête, souvent l'élément LCP, n'est jamais en chargement différé ; elle peut porter `fetchpriority="high"` ([web.dev – Optimize LCP](https://web.dev/articles/optimize-lcp), maj 31/03/2025).
- HTTPS, affichage mobile, absence d'interstitiel intrusif, contenu principal bien distinct : pas d'aide directe au classement, mais Google juge utile de les soigner ([Page experience](https://developers.google.com/search/docs/appearance/page-experience), maj 22/09/2026).

### 6.4 Mobile, JavaScript, taille

- Google indexe la version mobile : même contenu, titres, meta, données structurées et alt que sur ordinateur. Il ne charge pas un contenu qui demande un clic, un glissement ou une saisie ([Mobile-first indexing](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing), maj 10/12/2025). → Galerie, tableau de prix et FAQ dans le HTML initial, ou chargés dès qu'ils deviennent visibles.
- Chargement différé : charger le contenu quand il entre dans l'écran, jamais pour ce qui est visible à l'ouverture ([Fix lazy-loaded content](https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading), maj 10/12/2025).
- Conditions minimales : Googlebot non bloqué, réponse HTTP 200, contenu indexable ([Technical requirements](https://developers.google.com/search/docs/essentials/technical), maj 18/12/2025). Rendu côté serveur conseillé ; pas de `noindex` dans le HTML initial d'une page à indexer ([JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), maj 04/03/2026).
- Googlebot ne lit que les 2 premiers Mo, décompressés, de chaque fichier ; le reste est ignoré ([Googlebot](https://developers.google.com/search/docs/crawling-indexing/googlebot), maj 03/02/2026). → Texte principal et JSON-LD avant les longues listes.

### 6.5 URL, canonicals, sitemaps, découverte

- `rel="canonical"` absolu et auto-référent ; la même URL dans le sitemap et les liens internes ; pas de canoniques contradictoires ; ni robots.txt ni `noindex` pour choisir une canonique ; pas de modification de la canonique en JavaScript ([Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), maj 10/07/2026).
- Sitemap : `priority` et `changefreq` sont ignorés ; `lastmod` n'est utilisé que s'il est exact de façon constante et correspond à une modification significative ; seulement des URL canoniques absolues ([Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), maj 08/07/2026). **Règle interne** : `lastmod` réel via `lib/seo/pt-datas.ts`.
- Découverte : sitemap pour beaucoup d'URL, inspection d'URL pour quelques-unes (quota) ; de quelques jours à quelques semaines ; aucune garantie d'inclusion ([Ask Google to recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl), maj 10/12/2025). L'API Indexing n'est ouverte qu'aux pages JobPosting et BroadcastEvent ([Indexing API](https://developers.google.com/search/apis/indexing-api/v3/quickstart), maj 16/10/2026).
- Statuts : « Explorée, actuellement non indexée » ne demande pas de nouvelle soumission ; « Doublon sans URL canonique sélectionnée » demande un contenu substantiellement différent ([Aide Search Console – Page indexing report](https://support.google.com/webmasters/answer/7440203?hl=en), page non datée).
- hreflang : inutile pour des pages sans équivalent dans une autre langue ; sinon réciproque et auto-référent, codes comme `pt-PT` ([Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions), maj 21/09/2026).

### 6.6 Interdits techniques

- **Cloaking** : aucun bloc servi seulement aux robots, par exemple via une détection d'agent dans le middleware ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies), maj 28/08/2026).
- **Texte caché** : pas de liste de concelhos en `display:none`, hors écran ou couleur du fond ; accordéons et onglets restent permis (même page).
- **Contenu selon l'IP** : Googlebot explore surtout depuis les États-Unis ; pas de remplacement du concelho selon la position du visiteur ([SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) ; [Managing multi-regional sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)).
- **Redirection automatique de langue** : non ; un sélecteur visible ([Managing multi-regional sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)).
- **Détournement du bouton retour** : politique du 13/04/2026, appliquée depuis le 15/06/2026 ([billet du 13/04/2026](https://developers.google.com/search/blog/2026/04/back-button-hijacking)).

---

## 7. Réponses IA (AI Overviews, AI Mode) : ce que Google dit officiellement

- **Pas d'optimisation spéciale.** Les bonnes pratiques SEO valent aussi pour AI Overviews et AI Mode. Pour être lien d'appui, une page doit être indexée et pouvoir s'afficher avec un extrait. Pas besoin de fichiers lisibles par machine, de fichiers texte pour l'IA ni de balisage spécial ([AI features and your website](https://developers.google.com/search/docs/appearance/ai-features), maj 10/12/2025).
- **Une condition en plus depuis 2026.** Le site doit être inclus via le réglage « Search generative AI » de Search Console. Le réglage par défaut est « Inclure ». Il est ouvert à tous les sites depuis le 31/08/2026, se transmet de la propriété parente aux propriétés enfants, et ne sert pas de signal de classement pour le reste de Search ([AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), maj 10/07/2026 ; [Aide – Search generative AI control](https://support.google.com/webmasters/answer/16908024?hl=en), page non datée). → Vérifier le réglage sur la propriété racine et sur `/pt/`.
- **Inutile pour Google Search** : llms.txt (ignoré, sans effet positif ni négatif, précisé le 15/06/2026), balisage ou Markdown « pour l'IA », découpage du texte en petits morceaux, réécriture spéciale pour l'IA, chasse aux variantes de longue traîne, mentions artificielles sur le web ([AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)).
- **Ce qui compte** : un contenu unique et non banal, des sections avec des titres clairs, des images et vidéos de qualité (même page). Les données structurées doivent correspondre au texte visible ([AI features](https://developers.google.com/search/docs/appearance/ai-features)).
- **Interdit** : créer des pages pour chaque requête « fan-out » afin de manipuler les réponses IA. Depuis le 15/05/2026, la manipulation des réponses d'IA générative entre dans la définition du spam ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies), maj 28/08/2026).
- **Entreprises locales** : les réponses génératives peuvent inclure des informations sur des entreprises locales, et Business Profile aide à être visible dans les réponses IA comme dans le reste de la recherche ([AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)).
- **Recherche par image** : appuyer le texte par des images et vidéos de qualité, et tenir la fiche à jour ([billet du 21/05/2025](https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search)). Depuis le 24/09/2026, Search Console a un type « Web: multimodal » (Lens, Circle to Search, image importée) ([billet du 24/09/2026](https://developers.google.com/search/blog/2026/09/web-multimodal-in-sc)). **Déduction** : des photos légendées de cas typiques (musgo em telhas, fissuras em fachadas, terraço com infiltrações) aident la page à servir de source.
- **Mesure** : le rapport « Generative AI performance » ne donne que des impressions, par page, pays, date et appareil ; il peut ne pas s'afficher si le site en a trop peu ([Aide – Generative AI performance report](https://support.google.com/webmasters/answer/16984139?hl=en), page non datée). AI Mode est compté dans le type « Web » du rapport Performances depuis le 16/06/2025 ([Latest documentation updates](https://developers.google.com/search/updates)).

---

## 8. Mesurer : Search Console

### 8.1 Avant de rédiger : trouver les requêtes réelles

1. Travailler sur la propriété racine de vitfix.io. Le filtre requêtes de marque / hors marque n'existe que sur les propriétés de premier niveau ayant assez d'impressions ([Aide – Performance report: Common tasks](https://support.google.com/webmasters/answer/17010961?hl=en), page non datée). Il est ouvert à tous les sites éligibles depuis le 11/03/2026 ([billet du 20/11/2025, mis à jour le 11/03/2026](https://developers.google.com/search/blog/2025/11/search-console-branded-filter)).
2. Rapport Performances, Résultats de recherche : période « 16 derniers mois », pays Portugal, filtre Page contenant `/pt/`.
3. Filtre Requête « Custom (regex) ». La syntaxe est RE2, insensible à la casse par défaut, en correspondance partielle ([Aide – Advanced filtering](https://support.google.com/webmasters/answer/17011165?hl=en), page non datée). Exemple à tester : `(telhad|cobertur|terra[cç]o|impermeab|fachad|pr[eé]dio|altura|vertica|corda|alpinis)`.
4. Exporter. Repérer les requêtes qui ont des impressions mais une position au-delà de 10 (contenu à créer ou renforcer), et les pages à CTR faible (title et description à revoir) ([Aide – Common tasks](https://support.google.com/webmasters/answer/17010961?hl=en)).
5. Limites : filtrer par requête ou par URL tronque les totaux et omet les requêtes anonymisées ([Aide – Advanced filtering](https://support.google.com/webmasters/answer/17011165?hl=en)). Les requêtes rares, fréquentes en local, manqueront. Une expression absente de l'export n'est pas une expression jamais tapée.
6. Recouper avec les termes de recherche mensuels de la fiche Business Profile ([Business Profile performance](https://support.google.com/business/answer/9918094?hl=en)). Les volumes des outils tiers sont des estimations : ces outils n'ont pas accès aux données de Google ([Third-party SEO tools](https://developers.google.com/search/docs/fundamentals/third-party-seo), maj 05/06/2026). Les « Query groups » de Search Console Insights sont réservés aux sites à fort volume ([billet du 27/10/2025](https://developers.google.com/search/blog/2025/10/search-console-query-groups)).
7. Classer chaque expression de la liste de mots-clés par intention : Know, Do, Website, Visit-in-person ([QRG § 12.7](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf)). **Déduction** : Know → section ou article ; Do → page de service avec contact ; une même page peut servir les deux.

### 8.2 Après publication

- **Inspection d'URL** : la page est-elle indexée ? quelle canonique Google a-t-il choisie ? le HTML rendu correspond-il à la page vue par un visiteur ? ([Fix canonicalization issues](https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting), maj 21/08/2026).
- **Rapport Pages** : un statut « Doublon… » demande de différencier ou de fusionner ; « Explorée, actuellement non indexée » ne demande pas de resoumission ([Aide – Page indexing report](https://support.google.com/webmasters/answer/7440203?hl=en)).
- **Rapport Performances** : impressions, clics, CTR et position par page. Attendre au moins une semaine complète après la fin d'une core update, puis comparer avec une semaine antérieure à son début ([Core updates](https://developers.google.com/search/docs/appearance/core-updates), maj 10/12/2025).
- **Generative AI performance** et **filtre multimodal** : quelles pages des 4 services sont montrées au Portugal (voir section 7).
- **Core Web Vitals** et **Actions manuelles** : à relire après chaque lot ([Manual Actions report](https://support.google.com/webmasters/answer/9044175?hl=en)).
- **Délais de lecture** : quelques semaines pour juger un changement ([SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)) ; plusieurs mois pour un effet sur l'ensemble du site ([Core updates](https://developers.google.com/search/docs/appearance/core-updates)).

---

## 9. Calendrier 2025-2026 des mises à jour constatées

### 9.1 Mises à jour de classement

Sources : [historique Ranking du Search Status Dashboard](https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history) et [incidents.json](https://status.search.google.com/incidents.json), lus le 19/10/2026.

| Mise à jour | Début | Fin |
|---|---|---|
| March 2025 core update | 13/03/2025 | durée affichée 13 j 21 h |
| June 2025 core update | 30/06/2025 | durée affichée 16 j 18 h |
| [August 2025 spam update](https://status.search.google.com/incidents/a7Aainy6E9rZsmfq82xt) | 26/08/2025 | 22/09/2025 |
| December 2025 core update | 11/12/2025 | 29/12/2025 |
| [February 2026 Discover core update](https://developers.google.com/search/blog/2026/02/discover-core-update) (anglais, États-Unis) | 05/02/2026 | 27/02/2026 |
| [March 2026 spam update](https://status.search.google.com/incidents/VbnSXAH4SmEcxPtx4YSD) | 24/03/2026 | 25/03/2026 |
| March 2026 core update | 27/03/2026 | 08/04/2026 |
| May 2026 core update | 21/05/2026 | 02/06/2026 |
| [June 2026 spam update](https://status.search.google.com/incidents/YUX1peHev5a4fkxLDiUQ) | 24/06/2026 | 26/06/2026 |
| [August 2026 spam update](https://status.search.google.com/incidents/LEubPCm2octf2uMqCFKE) | 18/08/2026 | 21/08/2026 |
| [September 2026 spam update](https://status.search.google.com/incidents/XhUDXP7A67iHCD2kmbVu) (mondiale, toutes langues) | 24/09/2026 | 08/10/2026 |

Aucun incident en cours sur le [Search Status Dashboard](https://status.search.google.com/) le 19/10/2026 à 10:15 PDT. La dernière core update annoncée s'est terminée le 02/06/2026.

### 9.2 Changements de documentation et de politique

| Date | Changement | Source |
|---|---|---|
| 23/01/2025 | Fil d'Ariane retiré des résultats mobiles ; balisage toujours pris en charge | [Blog](https://developers.google.com/search/blog/2025/01/simplifying-breadcrumbs) |
| 21/05/2025 | Pages « AI features and your website » et « using generative AI content » ; billet sur la réussite dans la recherche IA | [Blog](https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search) |
| 11/06/2025 | Documentation multilingue : retrait du passage sur le blocage des pages traduites automatiquement, aligné sur la politique de mars 2024 | [Changelog](https://developers.google.com/search/updates) |
| 12/06/2025, 08/09/2025, 05/11/2025 | Retrait de plusieurs types de données structurées (Course Info, Claim Review, Estimated Salary, Learning Video, Special Announcement, Vehicle Listing, Practice Problem ; retrait de Book Actions annulé en novembre 2025). Google précise que cela ne change pas le classement | [Blog 06/2025](https://developers.google.com/search/blog/2025/06/simplifying-search-results), [Blog 11/2025](https://developers.google.com/search/blog/2025/11/update-on-our-efforts) |
| 16/06/2025 | Données AI Mode comptées dans le rapport Performances (type Web) | [Changelog](https://developers.google.com/search/updates) |
| 30/06/2025 | Nouveau rapport Search Console Insights | [Blog](https://developers.google.com/search/blog/2025/06/search-console-insights) |
| 11/09/2025 | Version en vigueur des Quality Rater Guidelines | [PDF](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf) |
| 27/10/2025 | Query groups dans Search Console Insights | [Blog](https://developers.google.com/search/blog/2025/10/search-console-query-groups) |
| 20/11/2025 | Filtre requêtes de marque / hors marque (ouvert à tous les sites éligibles le 11/03/2026) | [Blog](https://developers.google.com/search/blog/2025/11/search-console-branded-filter) |
| 04/12/2025 | Configuration du rapport Performances en langage naturel (expérimental) | [Blog](https://developers.google.com/search/blog/2025/12/ai-powered-configuration) |
| 09/12/2025 | La page « core updates » mentionne les core updates plus petites, non annoncées | [Changelog](https://developers.google.com/search/updates) |
| 15-18/12/2025 | JavaScript : pas de `noindex` dans le code initial, canonique cohérente avant et après rendu | [Changelog](https://developers.google.com/search/updates) |
| 02/03/2026 | Image préférée d'une page (`primaryImageOfPage`, `og:image`) | [Google image SEO](https://developers.google.com/search/docs/appearance/google-images) |
| 31/03/2026 | Billet sur Googlebot et la limite de 2 Mo | [Blog](https://developers.google.com/search/blog/2026/03/crawler-blog-post) |
| 13/04/2026 | Nouvelle politique contre le détournement du bouton retour, appliquée depuis le 15/06/2026 | [Blog](https://developers.google.com/search/blog/2026/04/back-button-hijacking) |
| 14 et 23/04/2026 | Les signalements de spam peuvent servir à des actions manuelles | [Report spam](https://developers.google.com/search/help/report-quality-issues) |
| 16/04/2026 | Maps : nouvelles protections contre les pics d'avis spam | [blog.google](https://blog.google/products-and-platforms/products/maps/new-ways-were-protecting-businesses-on-maps/) |
| 20/04/2026 | Liens « Read more » dans les extraits | [Snippets](https://developers.google.com/search/docs/appearance/snippet) |
| 07-08/05/2026 | Fin du résultat enrichi FAQ ; documentation retirée le 15/06/2026 | [Changelog](https://developers.google.com/search/updates) |
| 15/05/2026 | Guide d'optimisation pour l'IA générative ; le spam couvre la manipulation des réponses IA | [Blog](https://developers.google.com/search/blog/2026/05/a-new-resource-for-optimizing) |
| 03/06/2026 | Rapports « Generative AI performance » (ouverts à tous le 31/08/2026) | [Blog](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports) |
| 05/06/2026 | Page sur les outils et conseils SEO tiers | [Third-party SEO](https://developers.google.com/search/docs/fundamentals/third-party-seo) |
| 15/06/2026 | llms.txt ignoré par Google Search | [Changelog](https://developers.google.com/search/updates) |
| 10/07/2026 | Délais de réévaluation des doublons ; guide IA mis à jour | [Changelog](https://developers.google.com/search/updates) |
| 24/07/2026 | Extraits d'avis : pas d'avis faux ou incités non déclarés | [Changelog](https://developers.google.com/search/updates) |
| 28/08/2026 | Politiques anti-spam mises à jour ; « site reputation » adaptée à l'EEE à partir du 30/08 | [Blog](https://developers.google.com/search/blog/2026/08/update-site-reputation-policy) |
| 31/08/2026 | Réglage « Search generative AI » et rapports IA ouverts à tous les sites | [Aide](https://support.google.com/webmasters/answer/16908024?hl=en) |
| 08/09 et 18/09/2026 | Différences régionales ; dans l'EEE, blocs aggregator et supplier étendus aux requêtes d'entreprises locales | [Regional differences](https://developers.google.com/search/docs/appearance/aggregator-features), [Supplier unit](https://developers.google.com/search/docs/appearance/supplier-unit) |
| 22/09/2026 | Page « page experience » mise à jour | [Page experience](https://developers.google.com/search/docs/appearance/page-experience) |
| 24/09/2026 | Type de recherche « Web: multimodal » dans Search Console | [Blog](https://developers.google.com/search/blog/2026/09/web-multimodal-in-sc) |
| 01/10/2026 | Guide sur le contenu IA aligné sur les QRG § 4.6.5 et 4.6.6 | [Using gen AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content) |
| 05/10/2026 | Page « Creating helpful content » mise à jour (section « Main content », faux profils d'auteurs) | [Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| 06/10/2026 | Parcours d'apprentissage vidéo Search Central | [Blog](https://developers.google.com/search/blog/2026/10/seo-learning-paths) |
| 16/10/2026 | Galerie des données structurées mise à jour (FAQ, HowTo, Service absents) | [Search gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) |
| 19/10/2026 | Page « Aggregator unit » mise à jour | [Aggregator unit](https://developers.google.com/search/docs/appearance/aggregator-unit) |

---

## 10. Ce qui n'a pas pu être vérifié

### 10.1 Côté Google

- **Aucun chiffre** sur le nombre maximal de pages ville × service, la part de contenu propre ou la longueur minimale. Les seuils de la section 2.4 sont des tests de décision, pas des règles Google.
- **YMYL** : aucune page Google ne dit si les travaux en hauteur, le nettoyage ou l'étanchéité de toiture sont des sujets YMYL. Le classement proposé en section 5 est une déduction.
- **QRG** : le PDF a été lu en texte extrait, par sections. Les images d'exemples n'ont pas été vues. Rien n'y porte spécifiquement sur les services à domicile ou du bâtiment, ni sur l'évaluation des AI Overviews.
- **Changements non journalisés** : le contenu exact du changement du 05/10/2026 sur « Creating helpful content » n'apparaît pas dans le changelog ; pas d'entrée non plus pour les dates de mise à jour de « page experience » (22/09/2026), des règles générales des données structurées (10/07/2026), de « canonicalization » (20/08/2026) ou de « localized versions » (21/09/2026).
- **Écart entre deux pages** : « AI features and your website » (10/12/2025) ne cite pas d'exigence technique en plus, alors que le guide IA (10/07/2026) exige l'inclusion via le réglage de Search Console. Comme le réglage est sur « Inclure » par défaut, pas de conflit en pratique.
- **Mises à jour 2025** : pour mars et juin 2025, seuls la date de début et la durée affichée ont été lus. Les pages d'incident des spam updates ne disent pas quelles pratiques étaient visées.
- **Business Profile** : pages d'aide non datées ; libellés des catégories et attributs en pt-PT non visibles hors de l'interface ; pas de confirmation qu'un « distrito » compte comme une seule zone ; temps de trajet vers les concelhos les plus éloignés non vérifié face à la limite d'environ 2 h.
- **Local Services Ads** : indisponibilité au Portugal déduite du sélecteur de pays ; l'outil d'éligibilité n'a pas été testé.
- **Agent « Google-BusinessLinkVerification »** cité par la politique des liens : absent des pages sur les robots de Google lues ce jour.
- **Données structurées** : `areaServed` ne figure pas parmi les propriétés LocalBusiness prises en charge par Google ; le type `Service` n'est décrit nulle part par Google (seule preuve : son absence de la galerie) ; les sous-types schema.org (RoofingContractor, GeneralContractor…) n'ont pas été vérifiés sur schema.org, hors des sources Google.
- **pt-PT et pt-BR** : aucune page Google n'en traite. Le vocabulaire relève de la qualité rédactionnelle, à valider par un Portugais.
- **Non consultés** : chaîne YouTube Google Search Central, podcast « Search Off the Record », aide Search Console Insights (ancienne URL en 404), documentation du flux « Local POI Feed », guide communauté sur les avis LSA (page non lisible). La page « How Search Works – Ranking results » sur google.com a été lue mais n'est pas citée : elle n'est pas sur la liste des domaines retenus.
- **Données réelles** : les données Search Console de vitfix.io n'ont pas été consultées pour ce guide ; l'expression régulière de la section 8 est à tester.

### 10.2 Côté Vitfix (à trancher par Frédéric)

1. **Qui fait les travaux** pour ces 4 services : équipe Vitfix ou artisans partenaires ? Cela décide de l'éligibilité à une fiche, du bloc « supplier » ou « aggregator », et de ce que disent les pages (3.1).
2. **État de la fiche Business Profile** : existe-t-elle, est-elle validée, avec quelles catégories, quels services et quelles zones ?
3. **Zones** : 22 concelhos dans `areaServed` du site contre 20 zones au plus sur la fiche.
4. **Horaires** à afficher : rendez-vous seulement, ou atendimento 24 h/7 j comme heures de service.
5. **Adresse** : affichée sur le site alors que la fiche serait en zone desservie, adresse masquée ? Suivre les décisions déjà prises pour l'entité `#business` (adresse réelle, NIF, téléphone).
6. **Données réelles disponibles** par service : chantiers, photos, fourchettes de prix, délais, qualifications (formation au travail en hauteur), assurance, garanties. Sans elles, pas de page concelho.
7. **Calendrier** : publication après la clôture de la phase 3 (gel A0) et la lecture de la validation Search Console en cours.

### 10.3 Observation hors périmètre

Le CLAUDE.md indique que le schéma FR utilise `AggregateRating` et `FAQPage`. Si la note porte sur Vitfix lui-même, ces pages ne sont pas éligibles aux étoiles ([Review snippet](https://developers.google.com/search/docs/appearance/structured-data/review-snippet), maj 08/09/2026). Un problème de données structurées peut entraîner une action manuelle ([General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), maj 10/07/2026), et le résultat enrichi FAQ n'existe plus. À vérifier côté FR, sans toucher aux pages FR dans ce projet.
