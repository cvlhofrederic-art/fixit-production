# Portail copropriétaire — spécification des écrans (refonte du 17/10/2026)

Ce document est la référence des huit écrans du portail (`app/coproprietaire/dashboard`). Il est
destiné à qui implémente un écran. Tout ce qui est affiché vient de `EspaceCopro`
(`lib/coproprietaire/types.ts`) ; tous les libellés viennent de `lib/coproprietaire/textes.ts`
(`t = textesCopro(langue)`, FR et PT) ; les composants visuels viennent de
`components/coproprietaire-dashboard/ui.tsx` ; les props d'un écran sont `PropsEcran`
(`components/coproprietaire-dashboard/contrat.ts`).

## Règles pour tous les écrans

- Public : copropriétaires de tout âge, souvent peu à l'aise avec l'informatique, sur téléphone
  comme sur ordinateur. Phrases courtes, mots du quotidien, aucun vocabulaire de cabinet
  (jamais « a_payer », « 2026-T2 », « impayés », « limpezas »).
- Lisibilité : texte courant 16 px (`text-base`), secondaire 14 px (`text-sm`), jamais moins ;
  toute cible cliquable ≥ 44 px (les composants `Bouton`, `ChoixCartes`, `Deplie` le garantissent) ;
  montants principaux en gros et gras (`Montant grand`) ; dates en toutes lettres (`dateLongue`).
- Jamais d'emoji. Icônes : `Icone` (SVG au trait), toujours avec un libellé.
- Une carte cliquable est un `<button>` ou un `<a>` avec un texte d'action explicite
  (« Voir le détail »), jamais un `<div onClick>`.
- États : chaque écran a un état vide (phrase + action, composant `EtatVide`) et des erreurs
  persistantes (`Encadre ton="erreur"`), jamais un simple toast qui s'efface. Les toasts Sonner
  (`import { toast } from 'sonner'`) ne servent qu'en complément d'un message visible.
- Aucune donnée servie n'est écrite dans localStorage ; seules les préférences listées dans
  `CLES_PREFERENCES` (contrat.ts), toujours dans un try/catch.
- Démonstration : quand `espace.source === 'demo'`, les actions qui écrivent (signalement, message,
  vote) sont simulées localement (état React), sans appel réseau, et un `Encadre ton="info"`
  discret le dit si l'action est tentée. Quand `jeton` est null, on est en démonstration visiteur.
- Identité visuelle conservée (navy `#0D1B2E`, or `#C9A84C`, crème `#F7F4EE`, bordure `#E4DDD0`),
  Tailwind 4, classes utilitaires ; pas de `style={{}}` inline sauf largeur de barre de progression.
- Mise en forme : `euros`, `dateLongue`, `dateHeure`, `tailleLisible`, `pourcentage`, `remplir`
  de `lib/coproprietaire/textes.ts`. Statuts en mots : `libelleStatutDemande`, `libelleStatutTravaux`,
  `libelleStatutAppel`, `libelleStatutFacture`, `libelleCategorieContrat`, `libelleTypeAssurance`,
  `libelleStatutContrat`, `libelleMajorite`, `libelleChoixVote`, `libelleStatutAssemblee`,
  `libelleCategorieAnnonce`, `libelleNatureImpaye`.
- Navigation entre écrans : `allerA('demandes')`, `allerA('demandes', 'nouvelle')` (formulaire),
  `allerA('demandes', <id de demande>)`, `allerA('charges')`, `allerA('assemblees')`…
- Après une action réussie qui écrit en base (message, vote, signalement avec jeton) : `await rafraichir()`.
- Chaque écran : `export default function EcranX(props: PropsEcran)`, fichier
  `components/coproprietaire-dashboard/ecrans/EcranX.tsx`, `'use client'`, TypeScript strict (pas de
  `any`), aucune importation de `@/lib/supabase` dans un écran (sauf EcranQuestion pour le jeton, voir
  plus bas — non : le jeton est dans les props).
- Tests : `tests/components/coproprietaire/<ecran>.test.tsx`, Vitest + @testing-library/react
  (`render`, `screen`, `fireEvent`, `waitFor`), données `espaceDemo()` (`lib/coproprietaire/demo.ts`)
  et `textesCopro('fr')`. Simuler `fetch` par `vi.stubGlobal('fetch', vi.fn(...))` pour les routes ;
  simuler `sonner` par `vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))`.
  Tester : le rendu avec les données de démo (ce qui est vu en premier), l'état vide (espace sans
  données), une action (clic → appel ou simulation), un état d'erreur. Lancer seulement
  `npx vitest run tests/components/coproprietaire/<ecran>.test.tsx` (pas de tsc global, pas de build).

## Navigation (shell, hors écrans)

Ordre et libellés (`t.menu`) : Accueil · Mes demandes · Charges & paiements · Documents ·
Assemblées & votes · Annonces · Mes informations · Poser une question. Sous-titres : `t.sousTitres`.
Le bouton « Signaler un problème » (`t.commun.signalerProbleme`) est dans l'en-tête de tous les
écrans : il appelle `allerA('demandes', 'nouvelle')`. Rôle locataire (`espace.profil.role === 'locataire'`) :
pas de Charges & paiements ni d'Assemblées & votes.

## 1. Accueil — `EcranAccueil`

En premier (au-dessus de la ligne de flottaison, mobile compris) : salutation
« {t.commun.bonjour} {prénom} » + « {immeuble} · bâtiment D · lot 12 ». Puis, pour un propriétaire,
la carte « ce que je dois » calculée sur `finances.appels` : prochain appel non soldé (statut
a_payer / partiellement_paye / en_retard, non annulé) trié par échéance ; si son échéance est passée
ou son statut en_retard → carte rouge `t.accueil.enRetard` ; sinon carte or `t.accueil.aRegler`
(montant = `resteAPayer`, date = échéance) ; aucun reste à payer mais des appels → carte verte
`t.accueil.aJour` ; aucun appel → carte grise `t.accueil.aucunAppel` (jamais « 0 € »). Bouton
`t.accueil.voirCommentPayer` → `allerA('charges')`. Puis bouton plein navy
`t.commun.signalerProbleme` → `allerA('demandes', 'nouvelle')`. Puis « Vos demandes en cours (n) » :
les deux plus récentes non terminées/annulées (type, statut en mots via `libelleStatutDemande`), lien
`t.accueil.voirToutesDemandes` → `allerA('demandes')` ; vide → `t.accueil.aucuneDemande`.
Ensuite : « Prochaine assemblée » (seulement si une AG `convoquee` existe) : date `dateHeure`, lieu,
« {n} résolution(s) sur {total} attendent votre vote » (résolutions sans `monVote`), bouton
`t.accueil.voter` → `allerA('assemblees')` ; « Travaux dans l'immeuble (n) » : missions
`interventions.immeuble` en cours (acceptee / en_cours), 3 au plus, type — zone — prestataire —
statut (`libelleStatutTravaux`), lien → `allerA('demandes', 'travaux')` ; vide → `t.accueil.aucunTravaux`.
« Dernières annonces » : 2, titre + date + badge Urgent/Important, lien → `allerA('annonces')`.
Supprimé : tantièmes, notifications, échéances inventées.
Locataire : pas de carte financière ni d'assemblée ; commence par « Signaler un problème » et ses demandes.

## 2. Mes demandes — `EcranDemandes` (+ `FormulaireSignalement.tsx`, `DetailDemande.tsx` dans le même dossier)

- Provenance d’une demande : `origine` = `portail` (déposée depuis le compte, identité prise sur la fiche) ou `public` (formulaire sans compte / QR code, avec l’e-mail du compte). Une demande `public` porte dans son détail la mention « déposée sans connexion… signalez-le à votre syndic » : un dépôt public avec l’e-mail d’un copropriétaire n’est jamais présenté comme émanant de son compte. Colonne absente (migration 20261017 non appliquée) → provenance inconnue, sans mention.

En premier : bouton pleine largeur `t.demandes.nouvelleDemande`. Deux onglets (44 px, `aria-selected`) :
`t.demandes.ongletMesDemandes` / `t.demandes.ongletTravaux` ; `cible === 'travaux'` ouvre le second,
`cible === 'nouvelle'` ouvre le formulaire, `cible === <id>` ouvre le détail de cette demande.
Préférence d'onglet : `CLES_PREFERENCES.ongletDemandes`.

Liste de mes demandes (`interventions.mesDemandes`, déjà triée) : carte = type en gras, première
ligne de la description, « envoyée le … » (`t.demandes.envoyeeLe`), badge de statut en mots
(`libelleStatutDemande(statut, prestataire, t)` ; couleurs : en_attente bleu, acceptee or, en_cours
ambre, terminee vert, annulee gris), frise `Frise` 4 étapes `t.demandes.etapes` (reçue › prise en
charge › en cours › terminée ; étape courante selon le statut ; annulée : pas de frise, badge gris
seul), « Passage prévu le … » en gras si `intervention?.datePrevue`, bouton `t.commun.voirDetail`.
État vide : `t.demandes.aucuneDemande` + bouton signaler.

Détail d'une demande (`DetailDemande`) : bouton retour, statut, « Prestataire : … » si connu,
passage prévu, description complète, localisation (`t.demandes.partiesCommunes` + zone, ou
`t.demandes.monLogement`), FIL D'ÉCHANGES (`t.demandes.fil`) en bulles : `deMoi` à droite
(`t.demandes.vous`), sinon à gauche (`t.demandes.syndic` + nom du cabinet si `espace.syndic.nom`),
date `dateHeure` ; champ `t.demandes.ecrireAuSyndic` (textarea, placeholder
`t.demandes.messagePlaceholder`) + bouton envoyer : `envoyerMessageDemande(jeton, id, texte)`
(`lib/coproprietaire/api.ts`) puis `rafraichir()` ; succès → `Encadre succes` `t.demandes.messageEnvoye`
+ le message apparaît ; échec → `Encadre erreur` `t.demandes.messageErreur`, texte conservé. En démo
(jeton null ou `espace.source === 'demo'`) : ajout local. Si `intervention` : compte rendu
(`t.demandes.compteRendu` : travail effectué, matériaux, problèmes, recommandations, durée, date),
« Coût pour la copropriété : 420 € TTC (devis) · facturé 420 € » (seulement si montants non null),
documents du prestataire (type traduit `t.demandes.typesDocument`, référence, montant, date).
Mention : le prestataire se joint par le syndic (pas de coordonnées).

Onglet « Travaux dans l'immeuble » (`interventions.immeuble`) : cartes « {type} — {zone ou bâtiment}
— {statut en mots via libelleStatutTravaux} depuis le {dateCreation} — {prestataire ou
« prestataire à désigner »} » ; `Deplie` `t.commun.voirDetail` : description, dates, « Coût pour la
copropriété » (montants non null seulement, jamais de quote-part calculée), compte rendu, documents.
Les miennes portent un badge or « ma demande ». Jamais d'étage/lot d'autrui (déjà vides). État vide :
`t.demandes.aucunTravaux`. Annulées : non affichées.

Formulaire (`FormulaireSignalement`) : quatre questions en cartes radio (`ChoixCartes`) :
1. `t.demandes.ouProbleme` : `dansMonLogement` (avec `{lieu}` = « bât. D, 4e étage, lot 12 ») /
   `dansPartiesCommunes` → si parties communes, select `t.demandes.zone` (`ZONES_COMMUNES[langue]`,
   + `t.demandes.autreZone`).
2. `t.demandes.typeProbleme` : select `TYPES_PROBLEME[langue]` (sans pictogramme).
3. `t.demandes.decrivez` : textarea, aide `descriptionMinimum`, compteur `descriptionEncore` tant que
   < `DESCRIPTION_MIN_SIGNALEMENT` (`lib/copro-signalement.ts`).
4. `t.demandes.urgent` : `urgenceNon` (priorite normale) / `urgenceGenant` (normale, mais mention
   « sous 48 h » dans la description ? NON : priorite 'normale') / `urgenceUrgent` (priorite 'urgente').
   `planifiee` n'est plus proposé.
Bouton `t.demandes.envoyerAuSyndic` (désactivé tant qu'incomplet ; `envoiEnCours` pendant l'envoi),
sous-texte `t.demandes.transmisAuSyndic`. Envoi : `construireSignalement({ profile, type, description,
priorite, partieCommune, zone })` + `envoyerSignalementCopro(corps, jeton)` de
`lib/copro-signalement.ts` (`profile` = { prenom, nom, email, telephone, immeuble, batiment, etage,
numLot } de `espace.profil`). Erreurs : `Encadre erreur` persistant au-dessus du bouton
(`erreurInvalide` / `erreurTropDeDemandes` / `erreurServeur` / `erreurReseau`), formulaire intact.
Confirmation PERSISTANTE (pas de minuterie) : `confirmationTitre` ({date} = aujourd'hui en toutes
lettres), `confirmationNumero` ({numero} = 8 premiers caractères de l'id en majuscules), `confirmationSuite`,
boutons `voirMaDemande` (→ liste, après `rafraichir()`) et `autreDemande`. En démo : pas d'envoi, la
demande est ajoutée localement avec le statut en_attente.

## 3. Charges & paiements — `EcranCharges` (propriétaire seulement)

En premier : carte `t.charges.ceQueVousDevez` : même calcul que l'Accueil (`aReglerAvant` /
`aRegler` sans échéance / `aJour` / `retard` + `relanceEnvoyee` si un impayé a `derniereRelanceLe`) ;
sous la carte, bloc `t.charges.commentPayer` : `parVirement`, IBAN (`BoutonCopier`), `reference`
(référence de paiement de l'appel concerné, `BoutonCopier`), `pasDePaiementEnLigne` ; sans IBAN →
`ibanInconnu`. Ensuite `t.charges.vosAppels` en cartes (jamais de tableau) : titre `chargesDu`
({debut}/{fin} en toutes lettres ; si période vide, l'`exercice`), exercice brut en petit,
« {montant} · {regle} : … · {reste} : … », badge statut `libelleStatutAppel` (a_payer ambre,
partiellement_paye ambre, solde vert, en_retard rouge ; annule non affiché), `Deplie` détail (période,
échéance, référence, IBAN). Puis `t.charges.factures` (`finances.factures`) : TTC en gros, description,
`dontTva` en détail, badge `libelleStatutFacture`, bouton `ouvrirPdf` si `pdfDisponible` → GET
`/api/coproprietaire/factures/{id}/pdf` avec `Authorization: Bearer` → `{ url }` → `window.open(url,
'_blank', 'noopener')` ; erreur → `Encadre erreur` sous la facture. Puis `t.charges.retardsDePaiement`
(`finances.impayes`) si non vide : nature en mots, montant, « depuis le … », relances, statut ;
jamais le mot « impayé ». Puis `Deplie` `t.charges.comprendre` : `tantiemesPhrase` (seulement si
`quotePart > 0`), `budgetPhrase` (seulement si `immeuble.budgetAnnuel > 0`), `soldeDu` /
`soldeCredit` si `finances.solde ≠ 0`. État vide (aucun appel) : `t.charges.aucunAppel`.
Trop-perçu : montant positif libellé « remboursé », jamais « -125 € ».

## 4. Documents — `EcranDocuments`

Sections à titres pleins, dans l'ordre, sans filtre ni recherche : `t.documents.reglement` (carte
structurée depuis `immeuble.reglement` : `misAJourLe`, `repartition`, `majorite`, `fondsTravaux`
oui/non, `fondsRoulement` %, texte du règlement dans un `Deplie` `reglementTexte` si `texte`, nom du
PDF si `pdfNom` — pas de lien tant qu'aucun fichier publié ne le porte) ; `t.documents.pv`
(fichiers de catégorie `pv_ag` ou de type pv_assemblee/ata_ag) ; `t.documents.contrats`
(`documents.contrats` : « {libelleCategorieContrat} — {fournisseur} — jusqu'au {fin} », coût ;
`documents.assurances` : « {libelleTypeAssurance} — {assureur} — police n° … — jusqu'au … » ; plus
les fichiers de catégorie assurance/contrat_marche/contrat_entretien/contrat_syndic ou de type
contrat) ; `t.documents.devis` (catégorie devis_approuve ou type devis) ; `t.documents.autres`
(le reste, dont les documents `personnel: true` avec un badge « personnel »). Chaque fichier : une
ligne = nom, `ajouteLe` en toutes lettres, `tailleLisible`, un seul bouton `t.commun.ouvrir`
(`ouvrirDocument(jeton, id)` de `lib/coproprietaire/api.ts` AU CLIC, puis `window.open(url, '_blank',
'noopener')` ; pendant l'appel `ouvertureEnCours` ; erreur → `Encadre erreur` `erreurOuverture`
sous la ligne). En démo (jeton null) : le bouton affiche un `Encadre info` « démonstration ».
Catégories PT traduites via les `libelle*`. État vide global : `aucunDocument` (la section règlement
reste si elle existe). Locataire : règlement seulement.

## 5. Assemblées & votes — `EcranAssemblees` (propriétaire seulement)

En premier : si une AG `convoquee` existe, carte or `t.assemblees.prochaine` : titre, `dateHeure`,
lieu, `resolutionsAttendent` (sans `monVote`), `voterJusquAu` ({date} = `dateLimiteVote(date)` de
`lib/coproprietaire/api.ts` en toutes lettres) ou `voteClos` si `!voteOuvert(date)`, `convocationEnvoyee`
si connue. Puis ordre du jour numéroté, puis résolutions en cartes : « n. titre », description,
`majoriteRequise` (`libelleMajorite`), trois boutons égaux `pour` / `contre` / `abstention`
(`aria-pressed` sur mon vote) → `Modale` de confirmation : `confirmationTitre` ({choix} =
`libelleChoixVote`, {numero}), `confirmationTexte` ({date} limite), `confirmationNote`, boutons
`confirmerVote` (variante or) / `t.commun.annuler` → `voterResolution(jeton, id, choix)` puis
`rafraichir()` ; succès → encart vert `votreVote` + `enregistreLe` + bouton `modifier` ; échec →
`Encadre erreur` `voteErreur` sous la résolution ; vote clos → boutons remplacés par `voteClos`.
En démo : vote simulé localement. Compteurs et résultats (`resultats`, barres pour/contre/abstention
en tantièmes, badge `adoptee` / `rejetee`) seulement pour les AG `en_cours` / `cloturee`.
AG clôturée : `pvTitre` dans un `Deplie` (texte `pv`, si non vide) ; encart d'information sur la
contestation, texte FIXE défini localement dans l'écran (FR/PT), SANS date calculée (la date de
notification du PV n'est pas connue) : « Vous n'êtes pas d'accord avec une décision ? Les
copropriétaires opposants ou défaillants ont deux mois à compter de la notification du procès-verbal
pour la contester par lettre recommandée au syndic (art. 42 de la loi du 10 juillet 1965). » (PT :
art. 1433.º du Código Civil, 60 jours) + bouton `copierModele` (copie un modèle de lettre de
contestation dans le presse-papiers, toast `modeleCopie`). Ne pas utiliser `t.assemblees.contestation`
ni `contestationEcoulee`.
Mention sous l'ordre du jour : « Pour information — la convocation officielle vous est adressée
séparément » (texte local FR/PT). `precedentes` : AG clôturées/annulées sous ce titre. État vide :
`aucune`. Statuts : `libelleStatutAssemblee` ; types : `t.assemblees.types`.

## 6. Annonces — `EcranAnnonces`

Épinglées d'abord (mention `epinglee`), puis les plus récentes ; chaque annonce en carte complète
(jamais tronquée) : badge `urgent` (rouge) ou `important` (ambre) le cas échéant, catégorie en mots
(`libelleCategorieAnnonce`), titre 18 px, texte 16 px (sauts de ligne respectés, `whitespace-pre-line`),
`publieLe`, `t.commun.tousImmeubles` si `immeuble === ''`. Pas de « marquer comme lu » obligatoire ;
préférence facultative `CLES_PREFERENCES.annoncesLues` pour griser les annonces déjà vues (bouton
discret). État vide : `aucune`.

## 7. Mes informations — `EcranInformations`

Carte `votreLot` (ou `votreLogement` pour un locataire) : immeuble · bâtiment · étage · lot ·
`tantiemes` (seulement si `tantiemes > 0`, avec `{pourcentage}` = `pourcentage(quotePart)` si > 0,
sinon sans pourcentage) ; si `autresLots.length > 0`, liste des autres lots (immeuble · bâtiment ·
lot) avec, pour chacun, un bouton `t.informations.changerLot` qui appelle
`allerA('informations', 'lot:' + id)` : le shell interprète cette cible et recharge l'espace sur ce
lot. Carte `coordonnees` : nom, e-mail, téléphone
(`nonRenseigne` si vide), lecture seule, puis `inexact`. Carte `votreSyndic` : `espace.syndic.nom`,
`gestionnaire` ({nom} = `immeuble.gestionnaire`, si non vide), téléphone en lien `tel:`, e-mail en
lien `mailto:`, adresse postale ; vide → `syndicInconnu`. Carte `langue` : deux boutons `francais` /
`portugais` (changement de langue = `document.cookie = 'locale=fr; path=/; max-age=31536000'` puis
`window.location.reload()`). Locataire : `locataireNote`. Bouton pleine largeur `meDeconnecter`
(variante danger) → `Modale` `confirmationDeconnexion` [`meDeconnecter`] [`rester`] →
`seDeconnecter()` de `lib/coproprietaire/etat.ts`. Supprimé : modifier le profil, interrupteurs de
notification, exports factices, « portail signalements ».

## 8. Poser une question — `EcranQuestion` (Fixy)

Titre `t.question.titre`, sous-titre `intro`. À la première ouverture, un `Encadre info` demande
l'accord : « Les informations de votre espace (lot, charges, demandes) sont transmises à l'assistant
pour répondre ; jamais votre IBAN, votre téléphone ni votre e-mail. [J'ai compris] » (texte local
FR/PT), mémorisé dans `CLES_PREFERENCES.accordAssistant` ; tant qu'il n'est pas donné, le champ est
désactivé. Quatre grands boutons-questions `t.question.questions` (cliquer envoie la question).
Conversation en bulles (`MarkdownIA` de `components/common/MarkdownIA.tsx` pour les réponses),
champ `placeholder` 16 px, bouton `envoyer` 44 px, bouton secondaire `nouvelleConversation`.
Appel : POST `/api/copro-ai` avec `Authorization: Bearer {jeton}` (si jeton), corps
`{ messages: [...20 derniers, contenu ≤ 10 000 caractères], stream: true, locale: langue }` ; réponse
SSE (`text/event-stream`, lignes `data: {"text": "..."}` et `data: [DONE]`) : reprendre exactement la
logique de flux de `components/coproprietaire-dashboard/pages/CoproAssistantSection.tsx` (lignes
60-170 : AbortController, lecture `res.body.getReader()`, décodage, accumulation) ; réponse JSON
`{ reply }` sans flux → bulle. Erreur → bulle grise persistante `t.question.erreur` + bouton
`t.commun.reessayer`. En démo (jeton null) : première bulle `t.question.demo`, et les réponses sont
produites LOCALEMENT sans appel réseau à partir de `espace` (fonction `reponseDemo(question, espace, t)`
: combien je dois → prochain appel ; ma demande → dernière demande et son statut ; assemblée →
prochaine AG ; syndic → coordonnées ; sinon phrase d'orientation vers le bon écran).
Jamais de montant inventé : si l'espace n'a pas la donnée, dire qu'elle n'est pas publiée par le syndic.

## Décisions juridiques à respecter (relecture droit du 17/10/2026)

- Le vote en ligne est une intention de vote transmise au syndic, qui la reporte sur le formulaire
  officiel ; modifiable jusqu'à J-3 ; un seul vote par copropriétaire ; avertissement art. 17-1 A al. 3.
- Aucune coordonnée de prestataire ; aucun lot d'un voisin ; aucun montant d'un lot privé d'autrui.
- Locataire : ni finances, ni documents du syndicat, ni assemblées ; demandes et travaux sans montant.
- Les PV, convocations et annonces du portail sont « pour information » : la notification officielle
  passe par le syndic.
