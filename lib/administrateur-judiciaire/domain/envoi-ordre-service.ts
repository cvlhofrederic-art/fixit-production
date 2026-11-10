import { etatNotificationCourrier, type CourrierSuivi, type EtatNotificationCourrier } from '@/lib/administrateur-judiciaire/domain/courriers'
import { ajouterMois, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { seuilsAtteints, type DecisionAnnuelle } from '@/lib/administrateur-judiciaire/domain/decisions-annuelles-ag'
import {
  controleDeclaratifDemande,
  estRefusee,
  etapeDuStade,
  montantHtOperationDemande,
  prevuDemande,
  verifierSansBloquant,
  type Demande,
  type OptionsControleDeclaratif,
} from '@/lib/administrateur-judiciaire/domain/demandes'
import { creerRattachement, FICHES_PORTEUSES, memeRattachement, type Rattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { MAJORITES_AG, type TypeMajorite } from '@/lib/administrateur-judiciaire/domain/majorites-ag'
import { ROLES_CABINET, type RoleCabinet } from '@/lib/administrateur-judiciaire/domain/roles-cabinet'
import type { ElementAFaire } from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'
import { normaliserTexte } from '@/lib/administrateur-judiciaire/domain/texte'
import {
  SEUIL_VIGILANCE_HT_CENTIMES,
  type AnomalieEntreprise,
  type CodeAnomalieEntreprise,
  type PiecesEntreprise,
} from '@/lib/administrateur-judiciaire/domain/vigilance-entreprises'
import type { DemandeEnvoiOrdre, UrgenceOrdreAJ } from '@/lib/administrateur-judiciaire/ordres-prestataire'
import type { FormeEnvoiCourrier } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Ordres de service : numérotation, visa de sortie, envoi et journal de diffusion (point 44 du bilan 2, partie domaine).
 * Fonctions pures, montants en CENTIMES ENTIERS, dates ISO, heures HH:MM, sans écran ni table. L'état d'envoi d'une
 * demande (SortieOrdreService) est un objet FRÈRE de la Demande (demandes.ts, point 43), lié par demandeId : l'interface
 * Demande n'est pas modifiée. Aucune donnée personnelle : signataire, viseurs, collaborateurs et destinataires sont des
 * identifiants.
 *
 * Gestéam — 🟢 lu :
 * - tranche 34 § Fiche : N° au format <mandat>.<plan>.<n°> (numéro d'ordre de service) ; suivi interne : Signature
 *   (signataire pour le cabinet), Délai (ex. Urgent), Envoi (ex. E-mail), Relance (date), bouton Diffuser ; § Onglet Suivi,
 *   bloc Diffusion : Diffusable, Fax / SMS envoyés, journal horodaté des envois (date, heure, collaborateur, canal,
 *   destinataire) ; critères de recherche Visa de sortie et Référence diffusion. Les listes Délai, Envoi et Signature n'ont
 *   pas été ouvertes (valeurs de Délai et d'Envoi : décision de Hugo du 03/11/2026), le bouton Délégation n'a pas été
 *   cliqué ;
 * - référentiel STATUT_DEMANDE (Gestéam, module Demandes ; demandes.ts) : la demande peut être « Accusé demandé » ou
 *   « Rapport demandé » ;
 * - tranche 40 : référentiel Visa de sortie, 5 valeurs (Demande de visa, Visa refusé, Visa nécessaire, Visa donné, Sortie
 *   libre) ; la tranche en déduit (🔵) un circuit d'approbation avant envoi : sortie libre, ou visa demandé puis donné ou
 *   refusé ;
 * - tranche 20 et tranche 43 § 15 : Visa de sortie et Référence diffusion sont aussi des critères des courriers (le visa
 *   vaut pour tout document de sortie : circuit écrit ici pour être réutilisé) ; l'exécution forcée par huissier suit le
 *   même circuit que les OS (envoi, suivi, facture).
 *
 * VitFix avant ce point : ordres-prestataire.ts (referenceAj libre, urgence, un seul canal, la messagerie VitFix ;
 * StatutOrdreMission suit la réponse du prestataire, gardé tel quel : le silence ne vaut pas acceptation, C. civ. art.
 * 1120) ; CircuitValidationModule.tsx (préparé → vérifié par le juriste → validé et signé par la direction : démonstration
 * sans persistance) ; ROLES_CABINET (roles-cabinet.ts), base du rôle de viseur.
 *
 * Le droit — relevé du 30/10/2026 (Légifrance, textes lus) :
 * - fondement de l'OS (FondementOs) : le syndic, donc l'administrateur provisoire qui reçoit ses pouvoirs (L. 1965 art.
 *   29-1, I), assure l'exécution des délibérations de l'assemblée, administre l'immeuble et, en cas d'urgence, fait
 *   procéder de sa propre initiative aux travaux nécessaires à la sauvegarde (L. 1965 art. 18, I) ; il représente le
 *   syndicat dans les actes civils, si bien que l'OS signé engage le syndicat (🔵) ; après des travaux urgents, il informe
 *   les copropriétaires et convoque immédiatement une assemblée ; en vue de l'ouverture du chantier et de son premier
 *   approvisionnement, il peut demander, sans délibération préalable de l'assemblée mais après avis du conseil syndical
 *   s'il en existe un, une provision d'au plus le tiers du devis estimatif (D. 1967 art. 37) ; un OS peut aussi exécuter
 *   une décision du conseil syndical délégataire, consignée dans un procès-verbal signé par deux membres (L. 1965 art.
 *   21-1, 21-5 ; D. 1967 art. 21-1) : la délégation est décidée par l'assemblée pour un conseil d'au moins trois membres
 *   (L. 1965 art. 21-1), pour un montant maximum fixé par elle (art. 21-2), pour deux ans au plus, renouvelable par
 *   décision expresse (art. 21-3) ; une délégation à une fin déterminée peut aussi être donnée au conseil syndical (art.
 *   25 a) ; les décisions de l'administrateur provisoire sont mentionnées, à leur date, au registre (D. 1967 art. 62-8) ;
 * - exécution d'une résolution : L. 1965 art. 42, al. 3, relu sur Légifrance le 04/11/2026, version en vigueur au
 *   03/11/2026 (en vigueur depuis le 01/06/2020, modifié par l'ordonnance n° 2019-1101 du 30 octobre 2019, art. 37) :
 *   « Sauf urgence, l'exécution par le syndic des travaux décidés par l'assemblée générale en application des articles 25
 *   et 26 de la présente loi est suspendue jusqu'à l'expiration du délai de deux mois mentionné au deuxième alinéa du
 *   présent article. » (le délai de contestation ; le syndic : ici l'administrateur provisoire qui reçoit ses pouvoirs,
 *   L. 1965 art. 29-1, I) : BLOQUANT quand l'intervention prévue (à défaut, l'envoi) tombe dans ce délai, alerte quand la
 *   majorité ou la fin du délai manquent (décision 7) ;
 * - déclencheurs légaux du visa (MotifVisa ; intervention seulement : une demande de devis ne conclut aucun marché) :
 *   seuil de consultation du conseil syndical et seuil de mise en concurrence fixés par l'assemblée, obligatoires « à
 *   partir » de ces montants (L. 1965 art. 21, al. 2 ; sans conditions fixées par l'assemblée, la mise en concurrence
 *   résulte de la demande de plusieurs devis ou d'un devis descriptif soumis à plusieurs entreprises : D. 1967 art. 19-2),
 *   comparés au prévu TTC (décision J6 de Hugo du 30/10/2026 ; seuilsAtteints de decisions-annuelles-ag.ts, lu sans
 *   modification) ; convention à autoriser spécialement par l'assemblée : avec le syndic, ses préposés, son conjoint, le
 *   partenaire lié à lui par un pacte civil de solidarité, son concubin, ses parents ou alliés jusqu'au deuxième degré
 *   inclus, avec une entreprise dont ces personnes sont propriétaires ou associées, qu'elles dirigent ou contrôlent, ou
 *   dont elles sont salariées ou préposées, et, pour un syndic personne morale, avec une entreprise qui détient une
 *   participation dans son capital (D. 1967 art. 39) ; non autorisée, la convention avec une personne ou une entreprise
 *   avec laquelle le syndic a des liens de nature capitalistique ou juridique n'est pas opposable au syndicat (L. 1965 art.
 *   18-1 A, II) : BLOQUANT sans référence de l'autorisation ; avis préalable du conseil syndical quand l'administrateur
 *   provisoire décide au titre des pouvoirs de l'assemblée, sauf urgence, et précision du mode de financement à cette
 *   occasion (D. 1967 art. 62-7, al. 1 ; art. 62-7, al. 3) : BLOQUANT sans avis recueilli au plus tard le jour de la décision
 *   inscrite au registre (à défaut de date saisie, le jour de l'envoi, signalé), alerte sans mode de financement
 *   (application aux OS 🔵) ;
 * - preuve : le contrat est conclu quand l'acceptation parvient à l'offrant (C. civ. art. 1121) ;
 *   hors les cas prévus aux art. 1125 et 1126, la remise d'un écrit électronique est effective lorsque le destinataire,
 *   après avoir pu en prendre connaissance, en a accusé réception (C. civ. art. 1127-4) : le journal distingue l'envoi de
 *   la réception, pour tous les canaux (nature
 *   « reception ») ; le courriel est admis pour une entreprise qui a communiqué son adresse électronique ou accepté ce
 *   moyen (C. civ. art. 1126, 1127, al. 1 ; 🔵 pour l'OS) ; le SMS est un courrier électronique (loi n° 2004-575 du 21
 *   juin 2004, art. 1er, IV) : même contrôle que le courriel (🔵) ;
 * - un OS qui modifie le devis vaut offre nouvelle (C. civ. art. 1118, al. 3) et l'offre est caduque à l'expiration du
 *   délai fixé par son auteur (C. civ. art. 1117, al. 1) (🔵) : après le premier envoi, la sortie et son visa sont figés ;
 *   un devis associé échu avant que l'OS parvienne à l'entreprise est signalé ;
 * - AUCUN TEXTE pour la numérotation, le référentiel des visas, le refus d'envoyer sans visa, le contrôle du signataire
 *   par la liste du cabinet (textes lus sur la signature : décision 8), le délai, la relance, le journal ni la caducité
 *   du devis un an après sa date (J47) : règles de gestion. Aucun texte lu ne fixe la forme ni le canal d'envoi d'un OS
 *   (🔵 : les formes de D. 1967 art. 64 visent les notifications et mises en demeure).
 *
 * Décisions de Hugo du 03/11/2026 (questions « Ordres de service » 1 à 9 ; registre des décisions : J11 à J19) :
 * - 1. N° : séquence PAR MANDAT (plus grand rang du segment mandat + 1, tous plans confondus : rangOsSuivant) ;
 * - 2. listes de la tranche 34 : Délai = UrgenceOrdreAJ (normale, prioritaire, urgence), Envoi = CANAUX_ENVOI_OS ;
 * - 3. relance : elle vise la réponse à l'OS, et AUSSI l'accusé et le rapport quand la demande est « Accusé demandé » ou
 *   « Rapport demandé » : un OS envoyé reste à relancer tant que l'un d'eux manque, date de relance fixée ou non
 *   (attendusOs, relancesOsDues) ;
 * - 4. courriers : le visa des courriers (tranche 20) suit le MÊME circuit que celui des OS ; le circuit est commun aux
 *   pièces de sortie (CircuitVisa, PieceVisee, circuitVisaInitial, appliquerActionVisa, revoirCircuitVisa,
 *   anomaliesCircuitVisa, visaPermetSortie), sans modification des modules de courrier (branchement à faire) ;
 * - 5. L. 1965 art. 21, al. 6 (pas de conseil syndical : mise en concurrence non obligatoire) : le motif « mise en
 *   concurrence » est gardé ;
 * - 6. avis préalable sous administration provisoire (D. 1967 art. 62-7) : « nous constatons l'urgence » : l'urgence qui
 *   dispense de l'avis du conseil syndical est constatée par l'administrateur provisoire lui-même (le collaborateur qui
 *   agit en son nom), dans un constat daté, motivé et attribué (constatUrgence) ; sans constat complet, l'avis reste exigé
 *   pour des travaux décidés au titre des pouvoirs de l'assemblée. Le moment du constat est fixé par J46 (décisions du
 *   06/11/2026, ci-dessous) ;
 * - 7 (J17). L. 1965 art. 42, al. 3 : « oui », compris comme la CONFIRMATION des trois choix du code, compréhension
 *   confirmée par Hugo le 06/11/2026 (ci-dessous) ; le comportement ne change pas : (a) bloquant (la question 7 demandait
 *   « bloquant ou alerte ? » ; registre : « envoi bloqué pendant le délai de contestation ») : execution_suspendue_art42
 *   quand l'intervention prévue (à défaut, l'envoi) tombe au plus tard le dernier jour du délai, sauf urgence retenue
 *   (décision 6) ; un envoi pendant le délai pour une intervention prévue après lui n'est pas bloqué (🔴) ; (b)
 *   l'intervention d'une entreprise qui exécute une résolution des art. 25 ou 26 vaut exécution de « travaux », quel que
 *   soit son objet ; (c) une décision prise à l'unanimité n'est pas suspendue (MAJORITES_SUSPENSIVES : art25 et art26) ;
 *   raison : prise à l'unanimité des voix de tous les copropriétaires, elle n'a ni opposant ni défaillant, or « Les
 *   actions en contestation des décisions des assemblées générales doivent, à peine de déchéance, être introduites par les
 *   copropriétaires opposants ou défaillants dans un délai de deux mois à compter de la notification du procès-verbal
 *   d'assemblée, sans ses annexes. » (L. 1965 art. 42, al. 2, même relecture) : aucune action n'est ouverte pendant le
 *   délai qui borne la suspension ; MAJORITES_AG (majorites-ag.ts) fonde l'unanimité sur L. 1965 art. 26, dernier al. :
 *   cet écart est tranché par la confirmation, l'unanimité n'est pas suspendue ;
 * - 8 (J18). signataire : un COLLABORATEUR du cabinet peut signer l'OS, pas seulement l'administrateur désigné ; décision
 *   rendue sur une question qui citait L. 1965 art. 18, IV (« Seul responsable de sa gestion, il ne peut se faire
 *   substituer. ») et art. 29-1, I (« L'administrateur provisoire exécute personnellement la mission qui lui est
 *   confiée. »), relus sur Légifrance le 04/11/2026 (versions en vigueur au 03/11/2026, modifiées par la loi n° 2024-322
 *   du 9 avril 2024) ; la question ne citait pas la phrase qui suit chacune d'elles, lue le même jour : à l'art. 18, IV,
 *   « L'assemblée générale peut seule autoriser, à la majorité prévue par l'article 25, une délégation de pouvoir à une
 *   fin déterminée. » ; à l'art. 29-1, I, « Il peut toutefois, lorsque le bon déroulement de la mission le requiert, se
 *   faire assister par un tiers désigné par le président du tribunal judiciaire sur sa proposition et rétribué sur sa
 *   rémunération. », le seul concours que cet alinéa prévoit ; lecture de ces textes, à confirmer par Hugo (🔵) : la
 *   signature d'un collaborateur, au nom et sous la responsabilité de l'administrateur provisoire, n'est pas une
 *   substitution, ni une délégation de pouvoir, et le collaborateur n'est pas le tiers qui assiste l'administrateur
 *   provisoire (aucune désignation par le président du tribunal judiciaire n'est demandée ici) : ces points restent des
 *   questions (🔴) ; l'administrateur désigné signe toujours (« pas seulement l'administrateur désigné ») :
 *   administrateurDesigneId, l'administrateur provisoire désigné pour ce mandat par la décision du président du tribunal
 *   judiciaire (L. 1965 art. 29-1, I), fourni par l'appelant, accepté même hors de la liste ; un autre collaborateur signe
 *   s'il figure dans la liste du cabinet (signatairesHabilites, réglage du cabinet fourni par l'appelant ; absente : non
 *   contrôlée ; une liste vide bloque tout autre signataire que l'administrateur désigné, et tout envoi quand il n'est pas
 *   fourni) ; contrôle par la liste du cabinet : règle de gestion, sans texte (signataire_non_habilite : bloquant,
 *   fondement null, plus « à confirmer ») ;
 * - 9 (J19). preuve : l'AR (accusé de réception) FAIT PREUVE de la réception de l'OS ; la réception, distincte de l'envoi
 *   (enregistrerReception ; 🔵 : déduit de « l'AR fait preuve », qui suppose une réception distincte de l'envoi, à
 *   confirmer par Hugo), peut porter son AR (ArReceptionOs : référence, et date de première présentation du pli si elle
 *   est connue, comme la décision J1) ; « AR caduc après 1 an » : précisé par J47 (ci-dessous), c'est le devis qui
 *   devient caduc un an après sa date.
 *
 * Décisions de Hugo du 06/11/2026 (registre des décisions juridiques : J46 et J47, suites de J16 et J19 ; confirmation
 * de J17) :
 * - J17 confirmée : envoi de l'OS bloqué pendant le délai de contestation (L. 1965 art. 42, al. 3), exécution d'une
 *   résolution des art. 25 ou 26 = « travaux », unanimité non suspendue ; la compréhension de la réponse « oui » (décision
 *   7) est confirmée, comportement inchangé ; le cas d'une intervention prévue après la fin du délai reste une question
 *   (🔴, ci-dessous) ;
 * - J46 (date du constat d'urgence, suite de J16) : la règle est VALIDÉE, comportement inchangé. Daté après l'envoi, pour
 *   tous les fondements et tous les délais, le constat bloque celui-ci (constat_urgence_posterieur_envoi), comme une
 *   décision postérieure à l'envoi ; le jour de l'envoi, ce constat n'existe pas encore : sans constat, l'urgence n'est
 *   pas retenue (décision 6), et le message dit ce qui reste dû ; une date illisible fait un constat incomplet, sans
 *   comparaison. Quand le constat tient lieu de l'avis du conseil syndical (intervention au titre des pouvoirs de
 *   l'assemblée, avis non enregistré au plus tard le jour de la décision au registre : borneAvisAj), daté après la
 *   décision et au plus tard le jour de l'envoi, il donne une alerte à confirmer (constat_urgence_posterieur), sans
 *   bloquer l'envoi ; ni pour une demande de devis, ni pour la suspension de L. 1965 art. 42, al. 3, ni pour les autres
 *   fondements, sa date n'est comparée à celle de la décision : seule la borne de l'envoi vaut ;
 * - J47 (« AR caduc après 1 an », suite de J19) : c'est le DEVIS qui devient caduc UN AN APRÈS SA DATE
 *   (MOIS_CADUCITE_DEVIS_OS, 12 mois : règle du cabinet, aucun texte, fondement null). Un OS qui accepte un devis daté de
 *   plus d'un an à la date de l'envoi est refusé (devis_trop_ancien, bloquant : un nouveau devis est nécessaire). Bornes,
 *   choix du code et non de Hugo (🔵 : lecture de « daté de plus d'un an » et de dates.ajouterMois, à confirmer par
 *   Hugo, question ci-dessous) : un devis daté d'un an pile (même quantième) est encore accepté le jour anniversaire ;
 *   sans quantième identique, le dernier jour du mois : le devis du 29 février a un an le 28 février suivant, il est
 *   refusé dès le 1er mars. Le devis associé de la demande (DevisAssocie, demandes.ts) ne porte que son
 *   identifiant et ses montants : sa date (dateDevis) est fournie par l'appelant, comme sa fin de validité
 *   (validiteDevisAu, lue par devisCaducALaReception) ; inconnue, l'OS n'est pas bloqué, alerte date_devis_inconnue.
 *   Contrôlé avant l'envoi (controlerAvantEnvoiOs), d'une intervention seulement (🔵 : une demande de devis n'accepte
 *   aucun devis) ; ni l'OS ni l'AR ne deviennent caducs.
 *
 * 🔵 Déduit (règles de ce module) :
 * - N° (séquence par mandat : décision 1) : attribué une fois puis figé ; un N° hors du format, ou d'un autre segment
 *   mandat que celui de la séquence (segmentMandat), est signalé hors séquence, un N° déjà porté par une autre demande du
 *   mandat (numerosDuMandat) est signalé en double, jamais renuméroté ; corps de la messagerie VitFix : bornes de
 *   ajOrdrePrestataireSchema (lib/validation.ts) sur les champs tirés de la demande, N° (reference_aj) de 50 caractères au
 *   plus, objet requis et de 200 caractères au plus (bloquants au contrôle avant l'envoi, erreur dans
 *   demandeEnvoiDepuisOs) ;
 * - visa : « Sortie libre » sans motif, sinon « Visa nécessaire » ; nécessaire ou refusé → demandé → donné ou refusé ;
 *   un collaborateur peut exiger un visa sur une sortie libre ; la demande soumise au visa, puis visée, est figée par une
 *   empreinte (prévu, entreprise, objet, nature, devis associé) : à la revue, un visa demandé ou donné, ou une sortie
 *   libre, repasse à « Visa nécessaire » quand un motif nouveau apparaît ou que la demande ne correspond plus à
 *   l'empreinte, et le contrôle avant l'envoi le bloque ; seuls « Visa donné » et « Sortie libre » permettent l'envoi ;
 *   aucun événement du visa ne précède la demande, et le premier envoi ne précède pas le dernier événement du visa ;
 * - circuit du visa commun aux pièces de sortie (décision 4) : transitions, horodatage, viseur, refus motivé, empreinte,
 *   revue et contrôle avant la sortie ne dépendent que de la pièce décrite par PieceVisee (désignation, sortie, date,
 *   empreinte et libellé des champs visés), messages compris (« avant l'envoi » pour l'OS, « avant le dépôt » pour le
 *   courrier) ; l'ordre de service y est la demande (visa refusé : « revoir la demande », comme les autres messages du
 *   visa, au lieu de « revoir l'ordre de service » auparavant) ; le gel après la sortie (envoi de l'OS, dépôt du courrier)
 *   et les motifs du visa restent propres à chaque pièce ;
 * - viseur : un rôle de rolesViseurs (Direction par défaut, d'après CircuitValidationModule : « validé et signé par la
 *   direction »), autre que le collaborateur qui a demandé le visa ; le refus est motivé ;
 * - premier envoi : à l'entreprise de la demande, par le canal choisi, après controlerAvantEnvoiOs ; les envois suivants
 *   sont des rediffusions (copie à une fiche porteuse) d'un OS diffusable ; « Diffusable » se règle avant comme après le
 *   premier envoi (marquerDiffusable) ; relance et réception concernent l'entreprise du premier envoi ; horodatages
 *   croissants ; preuve propre au canal : missionId pour la messagerie VitFix, courrierId pour le courrier AR (état de
 *   notification tiré de courriers.ts) ;
 * - preuve de la réception (décision 9) : une réception sans AR reste admise (estRecu, accusé reçu pour la relance,
 *   devisCaducALaReception), marquée « sans preuve » (preuveDeReception, preuveDeDiffusion), sans blocage ; l'AR est
 *   réservé à la réception par courrier AR (avis de réception du pli recommandé, forme d'envoi « AR » de Gestéam ; la
 *   première présentation est une notion postale) : saisi sur une réception par un autre canal, il est refusé ; il est
 *   celui du pli qui a porté l'OS à l'entreprise, comme toute réception par courrier AR, AR saisi ou non : le
 *   courrierId de la réception est celui d'une ligne d'envoi ou de rediffusion de l'OS par courrier AR à la même
 *   entreprise (pas d'une relance, ni d'un pli adressé à une autre fiche), sinon la réception est refusée à la saisie,
 *   motif à l'appui (pliDeLaReception) : l'AR d'un autre pli ne prouve pas la réception de l'OS, et la réception d'un
 *   autre pli n'est pas celle de l'OS ; l'AR porte une référence non vide (numéro du pli recommandé ou pièce
 *   numérisée) ; sa première présentation, quand elle est connue, n'est ni antérieure à l'envoi de ce pli ni
 *   postérieure à la réception ; l'AR saisi est rapproché du courrier lié (CourrierSuivi, courriers.ts) : à la saisie
 *   quand l'appelant le fournit (enregistrerReception : forme « AR » exigée, courrier déposé, première présentation
 *   tirée du courrier quand elle n'est pas saisie ; comme courriers.ts le refuse pour ses propres dates, jamais avant
 *   le dépôt ni après le retrait du pli, et différente de celle du courrier refusée), et à la lecture de la preuve
 *   (preuveDeDiffusion, qui attend le courrier lié de toute ligne par courrier AR) : la ligne ne se réécrivant pas, un
 *   écart apparu après la saisie (courrier non fourni à la saisie, suivi postal complété ou corrigé ensuite) ne lève
 *   rien, il est signalé (preuve « ar_ecart_courrier », message par ecartArCourrier), et une nouvelle réception peut
 *   porter l'AR exact ; une réception par courrier AR sans AR saisi garde la preuve d'avant la décision 9, l'état de
 *   notification du courrier lié, celui qui a porté l'OS (preuveDeDiffusion, qui lit aussi le journal de la sortie ;
 *   preuveDeReception, qui ne lit que la ligne, la dit « sans preuve ») ; écrite sans le contrôle de la saisie (avant
 *   la décision 9) sous un courrier qui n'a pas porté l'OS (OS parti par un autre canal ou sous un autre courrier,
 *   courrier d'une relance ou d'un pli adressé à une autre fiche), elle est « sans preuve », jamais l'état de
 *   notification d'un pli qui n'a pas porté l'OS ; une ligne écrite sans la clé « ar » (avant la décision 9) est lue
 *   sans AR, jamais comme prouvée ; le journal ne se réécrit pas : un AR revenu après une réception déjà enregistrée
 *   s'inscrit sur une nouvelle ligne « reception » (par courrier AR), et preuveReceptionOs donne la preuve de l'OS
 *   lui-même (« ar » dès qu'une réception porte son AR ; il ne lit que les lignes : l'écart d'un AR avec son courrier
 *   lié se lit par preuveDeDiffusion) ; la réception reste datée de sa première ligne (estRecu,
 *   devisCaducALaReception ; la première présentation n'en tient pas lieu : question ouverte) ; l'envoi, la rediffusion
 *   et la relance ne portent pas d'AR ;
 * - date de relance : jamais avant la demande (refusée à la création), ni avant le premier envoi (refusée après l'envoi ;
 *   avant l'envoi, une date antérieure bloque celui-ci) ;
 * - relance (décision 3) : un OS envoyé, ni terminé ni refusé, attend de l'entreprise (attendusOs) : (a) la réponse à l'OS,
 *   toujours, reçue quand la demande la montre : statut « Accepté », stade de l'étape Acceptation ou au-delà (Acceptée,
 *   Programmée, Réalisée, Contestée, Validée ; une proposition n'est pas une réponse), réalisation datée, ou, pour une
 *   demande de devis, le devis associé ; reçue aussi quand le rapport est enregistré (l'entreprise qui remet son rapport
 *   a répondu à l'OS) ; (b) l'accusé de réception, au statut « Accusé demandé », reçu dès la première ligne « reception »
 *   du journal (enregistrerReception) ; (c) le rapport, au statut « Rapport demandé », reçu quand il est enregistré
 *   (enregistrerRapport : daté, au plus tôt le jour du premier envoi, une seule fois) ; le statut étant unique, l'accusé
 *   et le rapport ne sont pas demandés ensemble ; date de relance : celle de la fiche (relanceLe, seul champ Relance de la
 *   tranche 34), la même pour tous les éléments ; sans date (jamais fixée, ou vidée par relancerOs après une relance),
 *   l'OS reste dû : l'élément demande de fixer la prochaine relance (relanceAFixer ; « Fixer la prochaine relance de
 *   l'entreprise », et non « Relancer l'entreprise », qui doublerait le jour même une relance faite), daté de la dernière
 *   relance du journal ou, à défaut, du premier envoi (aucun délai inventé), jusqu'à ce que fixerRelance fixe la suivante ;
 *   aConfirmer reste faux : il signale un repère juridique non confirmé (ElementAFaire, suivi-a-faire.ts), or aucun texte
 *   ne fixe la relance, réglage de gestion ; plusieurs éléments manquants : UN élément de relance par OS (id
 *   demandes:relance_os:<demande>) qui liste ce qui manque (attendus, libellé), car une relance de l'entreprise réclame
 *   tout ce qui manque en une fois (relancerOs : une ligne « relance » à l'entreprise du premier envoi), à une seule date
 *   et par un seul collaborateur, alors qu'un élément par attendu répéterait la même date et la même action ; tout reçu,
 *   plus rien n'est dû, même avec une date fixée ; relance assignée au collaborateur du premier envoi ;
 * - canaux « courriel » et « sms » : bloquant si l'entreprise n'a pas communiqué la coordonnée, alerte si on ne le sait
 *   pas ;
 * - caducité du devis associé : appréciée quand l'OS parvient à l'entreprise ; le jour de l'envoi pour la messagerie, le
 *   courriel et le SMS ; pour le courrier simple ou AR, qui ne parvient pas le jour même, une fin de validité au jour de
 *   l'envoi ou avant est signalée (à confirmer) ; à la réception enregistrée, devisCaducALaReception ;
 * - contrôle déclaratif (point 37) avant l'envoi d'une intervention, avec les gravités de vigilance-entreprises.ts : c'est le
 *   blocage de l'envoi que le point 37 renvoie au 44 ; pièces non fournies : bloquant si l'opération atteint le seuil de
 *   vigilance, si son montant HT est inconnu ou si la décennale est obligatoire, sinon alerte ;
 * - urgence RETENUE (décision 6) : délai « urgence » ou fondement « urgence de sauvegarde », AVEC le constat complet de
 *   l'administrateur provisoire (date valide, motif non vide, collaborateur identifié ; refusé incomplet à la saisie ; un
 *   constat incomplet repris d'ailleurs ne vaut pas constat, alerte ; daté après l'envoi, il bloque celui-ci : J46) ;
 *   elle seule lève l'avis préalable de D. 1967 art. 62-7 et la suspension de L. 1965 art. 42, al. 3 (même constat pour
 *   les deux) ; un constat saisi sans délai « urgence » est signalé (alerte) et ne lève rien ; un délai « prioritaire » ne
 *   vaut pas urgence, même constatée (choix gardé, non contredit par Hugo) ; urgence non retenue : le message ne nomme ce
 *   qui reste dû que lorsque cela s'applique (l'avis pour une intervention au titre des pouvoirs de l'assemblée, la
 *   suspension pour l'exécution d'une résolution votée aux art. 25 ou 26) ;
 * - auteur du constat d'urgence face aux signataires habilités (décisions 6 et 8), interprétation à confirmer par Hugo :
 *   le constat est fait au nom de l'administrateur provisoire, comme la signature de l'OS ; quand l'appelant fournit la
 *   liste du cabinet (signatairesHabilites), un constat dont l'auteur n'y figure pas, et n'est pas l'administrateur
 *   désigné (administrateurDesigneId), est signalé, alerte à confirmer (constat_urgence_auteur_non_habilite), sans
 *   blocage : il ne change pas l'urgence retenue ou non ;
 * - avis préalable sous administration provisoire (D. 1967 art. 62-7), critère proposé, non contredit par Hugo (pas une
 *   décision) : un OS d'entretien courant, ou qui exécute une décision déjà prise, relève des pouvoirs du syndic (sans
 *   avis) ; des travaux décidés au titre des pouvoirs de l'assemblée (fondement decision_aj_pouvoirs_ag) exigent l'avis,
 *   sauf urgence constatée ;
 * - convention liée sous administration provisoire : le « syndic » de D. 1967 art. 39 est l'administrateur provisoire,
 *   ses « préposés » les collaborateurs du cabinet ; la réponse sur le lien (entrepriseLiee) vaut pour l'entreprise de la
 *   demande au moment où elle est saisie (entrepriseLieeDeclareePour) : l'entreprise changée, la réponse est périmée
 *   (bloquant jusqu'à ce qu'elle soit redite, ni motif de visa ni autorisation tirés d'elle) ; l'autorisation spéciale de
 *   l'assemblée vise la convention avec une entreprise : elle vaut pour l'entreprise de la demande au moment où elle est
 *   saisie (autorisationConventionLieePour), que la réponse sur le lien soit alors connue ou non ; pour une autre
 *   entreprise elle ne compte pas (bloquant convention_liee_non_autorisee), et redire la réponse sur le lien pour une autre
 *   entreprise que celle de l'autorisation efface celle-ci ;
 * - date de la décision qui fonde l'OS (decisionLe : résolution, procès-verbal du conseil syndical, registre des
 *   décisions de l'administrateur provisoire, mentionnées « à leur date » : D. 1967 art. 62-8) postérieure à l'envoi :
 *   bloquant, l'OS ne part pas avant la décision qu'il exécute ;
 * - conseil syndical délégataire : alerte à confirmer quand aucune délégation (générale, ou de l'art. 25 a au conseil
 *   syndical) ne figure dans les décisions d'assemblée en vigueur fournies ;
 * - majorité de la résolution exécutée : « art25 » aussi pour une décision de l'art. 25 adoptée au second vote de l'art.
 *   25-1.
 *
 * 🔴 Non établi — questions :
 * - Hugo (suite de la décision 1) : sens du segment <plan> du N° ; N° attribué à la création de la demande, ou
 *   au premier envoi ; rang complété de zéros ?
 * - Hugo (suite de la décision 2) : valeurs de la liste Signature (tranche 34).
 * - Hugo (suite de la décision 6) : critère proposé (entretien courant ou exécution d'une décision déjà prise = pouvoirs du
 *   syndic, sans avis ; travaux décidés au titre des pouvoirs de l'assemblée = avis, sauf urgence constatée) à confirmer ;
 *   un délai « prioritaire » peut-il valoir urgence (non ici) ?
 * - Hugo (suite de la décision 7, J17 confirmée le 06/11/2026) : un envoi pendant le délai de contestation, pour une
 *   intervention prévue après la fin du délai, peut-il partir (oui ici : seule la date de l'intervention prévue, à défaut
 *   celle de l'envoi, est comparée à la fin du délai) ?
 * - Hugo (suite de la décision 8) : l'auteur du constat d'urgence doit-il être un signataire habilité (ici :
 *   interprétation, alerte à confirmer constat_urgence_auteur_non_habilite, sans blocage) ? La lecture des textes cités
 *   (signature d'un collaborateur au nom de l'administrateur provisoire : pas une substitution) est-elle juste ? Les
 *   collaborateurs du cabinet sont-ils des « tiers » au sens de L. 1965 art. 29-1, I (assistance par un tiers désigné par
 *   le président du tribunal judiciaire sur proposition de l'administrateur provisoire, rétribué sur sa rémunération) ?
 *   Si oui, la signature de l'OS par l'un d'eux suppose-t-elle cette désignation (ici : non demandée) ? Est-elle une
 *   « délégation de pouvoir » de L. 1965 art. 18, IV, que seule l'assemblée autorise (ici : non) ? (textes sur
 *   l'habilitation des collaborateurs non lus) Un mandat qui nomme deux administrateurs judiciaires (volet judiciaire :
 *   Associé 1, Associé 2, mandat-judiciaire.ts) : signent-ils tous deux toujours (ici : un seul administrateurDesigneId ;
 *   l'autre signe s'il figure dans la liste du cabinet) ?
 * - Frédéric : quand un visa de gestion est-il nécessaire (seuil, natures, exécution forcée : aucun par défaut) et quels
 *   rôles visent (Direction par défaut ; Juridique ?) ; le rédacteur ou le signataire peut-il viser ; un visa donné
 *   tombe-t-il quand l'OS change (oui ici) ? Pour les courriers (même circuit, décision 4) : quels motifs déclenchent leur
 *   visa, et sur quels champs porte-t-il (empreinte) ?
 * - Frédéric ou Hugo : les seuils de L. 1965 art. 21, al. 2 déclenchent-ils le visa automatiquement (oui ici) ? Sans montant
 *   fixé par l'assemblée, la consultation n'est pas obligatoire : faut-il un seuil par défaut du cabinet
 *   (seuilPrevuTtcCentimes, règle de gestion) ?
 * - Hugo (suite de la décision 5) : les conditions de mise en concurrence fixées par l'assemblée se réduisent-elles à un
 *   nombre de devis (devisExigesParAssemblee) ?
 * - non établi : l'administrateur provisoire investi des pouvoirs de l'assemblée peut-il autoriser lui-même une convention
 *   liée ? (la référence d'une autorisation est exigée ici) Le « syndic » de D. 1967 art. 39 est-il bien l'administrateur
 *   provisoire, et ses « préposés » les collaborateurs du cabinet (oui ici) ?
 * - Frédéric : la fiche entreprise portera-t-elle le lien avec le cabinet ou le syndic ? Sinon entrepriseLiee se déclare à
 *   la main, pour l'entreprise de la demande (alerte tant qu'il est inconnu, bloquant quand l'entreprise a changé depuis
 *   la réponse).
 * - Hugo ou Frédéric : délégation du conseil syndical appréciée sur les décisions fournies (decisionsAgEnVigueur, à la date
 *   de l'envoi), et non à la date de la décision du conseil syndical (decisionLe) : l'appelant doit-il fournir les
 *   décisions en vigueur à cette date ? Le prévu n'est pas comparé au montant maximum alloué au conseil syndical (L. 1965
 *   art. 21-2 : enveloppe_delegation_cs, annuelle et cumulée ; plafond_travaux_cs, par dépense) : quel cumul retenir ?
 * - Hugo, preuve (suite de la décision 9) : la réception distincte de l'envoi convient-elle (ici : oui, déduit de « l'AR
 *   fait preuve ») ? La première présentation d'un AR (décision J1) vaut-elle réception de l'OS au sens de C. civ. art.
 *   1121 (non ici : la réception reste datée de sa première ligne du journal, même quand l'AR revient plus tard) ? Quelle
 *   preuve pour une réception sans AR, par courrier simple, messagerie VitFix, courriel ou SMS (ici : admise, « sans
 *   preuve » ; un AR n'y est pas admis, même un accusé de réception électronique au sens de C. civ. art. 1127-4) ? Quel
 *   délai d'acheminement d'un courrier retenir pour la caducité du devis (jour même ici) ?
 * - Hugo, caducité du devis (suite de J47) : « caduc un an après sa date » et « daté de plus d'un an » divergent le jour
 *   anniversaire : un devis daté d'un an pile est-il encore accepté (oui ici ; avis-appel.ts lit à l'inverse
 *   MOIS_CADUCITE_MANDAT_SEPA : le mandat y est caduc le jour anniversaire) ? Sans quantième identique, le devis du 29
 *   février a-t-il un an le 28 février suivant (oui ici : dates.ajouterMois) ?
 * - vigilance du code du travail (relevée au point 43, non relue le 30/10/2026) : bloquante avant l'envoi par le contrôle
 *   déclaratif, y compris quand les pièces ne sont pas fournies, à confirmer.
 *
 * Branché au point 46 : suivi-a-faire.ts, famille « demandes » et nature « relance_os » (relancesOsDues, lu par
 * depuisDemandes ; attendus et relanceAFixer en plus des champs d'ElementAFaire, dont aConfirmer, toujours faux, garde
 * son sens). Branchements à faire plus tard (fichiers non modifiés) :
 * route /api/administrateur-judiciaire/ordres-prestataire : controlerAvantEnvoiOs avant l'envoi (avec segmentMandat,
 * numerosDuMandat, decisionsAgEnVigueur et finDelaiContestationAg, échéance retenue par finDelaiContestationAg de
 * statut-assemblee.ts, et dateDevis, date du devis associé : J47, sans quoi l'alerte date_devis_inconnue accompagne tout
 * OS qui accepte un devis), corps par demandeEnvoiDepuisOs, puis envoyerOs avec le missionId créé ; enregistrerReception
 * avec l'AR et le courrier AR lié (CourrierSuivi de courriers.ts) quand l'avis de réception revient (décision 9 :
 * référence ; courrier de l'envoi ou de la rediffusion qui a porté l'OS, aussi pour une réception par courrier AR sans
 * AR ; première présentation tirée du courrier), puis devisCaducALaReception et preuveReceptionOs ; preuveDeDiffusion
 * avec la sortie et le courrier lié de toute ligne par courrier AR (« ar_ecart_courrier » : montrer ecartArCourrier) ;
 * signataires (décision 8) : signatairesHabilites tiré du réglage du cabinet, administrateurDesigneId tiré du MANDAT
 * (l'administrateur provisoire que la décision du président du tribunal judiciaire désigne pour ce mandat, L. 1965
 * art. 29-1, I ; volet judiciaire de mandat-judiciaire.ts, Associé 1 et Associé 2, saisis en noms : à rapprocher de
 * l'identifiant du collaborateur), jamais de ce réglage ; enregistrerRapport quand l'entreprise dépose un document
 * « rapport » dans la messagerie VitFix (TypeDocumentPrestataire, lib/syndic/messagerie-pro.ts) ; courriers
 * (décision 4) : courriers.ts
 * (preparerCourrier, controlerDepot), gabarits-courrier.ts et les écrans des courriers porteront un CircuitVisa, décriront
 * le courrier en PieceVisee (sortie : « le dépôt »), appliqueront appliquerActionVisa et revoirCircuitVisa, et refuseront
 * le dépôt tant qu'anomaliesCircuitVisa n'est pas vide ; VISAS_SORTIE, CANAUX_ENVOI_OS et FORME_ENVOI_PAR_CANAL vers
 * referentiels-gesteam-judiciaire.ts ; table de SortieOrdreService et écran (Frédéric).
 */

// ─── Référentiels ─────────────────────────────────────────────────────────────────────────────

export const VISAS_SORTIE = ['Demande de visa', 'Visa refusé', 'Visa nécessaire', 'Visa donné', 'Sortie libre'] as const
export type VisaSortie = (typeof VISAS_SORTIE)[number]

/** Visas qui laissent partir l'ordre de service (🔵). */
export const VISAS_PERMETTANT_ENVOI: ReadonlySet<VisaSortie> = new Set<VisaSortie>(['Visa donné', 'Sortie libre'])

/**
 * Canal d'envoi : valeurs de la liste « Envoi » de la tranche 34 (décision de Hugo du 03/11/2026) ; la messagerie VitFix,
 * puis les formes d'envoi des courriers.
 */
export const CANAUX_ENVOI_OS = ['messagerie_vitfix', 'courriel', 'courrier', 'courrier_ar', 'sms'] as const
export type CanalEnvoiOs = (typeof CANAUX_ENVOI_OS)[number]
const CANAUX: ReadonlySet<string> = new Set(CANAUX_ENVOI_OS)

/** Canaux papier : le pli ne parvient pas à l'entreprise le jour de l'envoi (🔵). */
const CANAUX_PAPIER: ReadonlySet<CanalEnvoiOs> = new Set<CanalEnvoiOs>(['courrier', 'courrier_ar'])

/** Forme d'envoi Gestéam (FORME_ENVOI_COURRIER) de chaque canal hors messagerie VitFix. */
export const FORME_ENVOI_PAR_CANAL: Readonly<Record<Exclude<CanalEnvoiOs, 'messagerie_vitfix'>, FormeEnvoiCourrier>> = {
  courriel: 'Email',
  courrier: 'Normal',
  courrier_ar: 'AR',
  sms: 'SMS',
}

export const NATURES_DIFFUSION = ['envoi', 'rediffusion', 'relance', 'reception'] as const
export type NatureDiffusion = (typeof NATURES_DIFFUSION)[number]

export const ACTIONS_VISA = ['exige', 'demande', 'donne', 'refuse', 'revu'] as const
export type ActionVisa = (typeof ACTIONS_VISA)[number]

export const FONDEMENTS_OS = [
  'execution_resolution_ag',
  'decision_conseil_syndical',
  'administration_courante',
  'urgence_sauvegarde',
  'decision_aj_pouvoirs_ag',
] as const
export type FondementOs = (typeof FONDEMENTS_OS)[number]
const FONDEMENTS: ReadonlySet<string> = new Set(FONDEMENTS_OS)

/** Texte du fondement, et référence attendue (résolution, procès-verbal du conseil syndical, registre des décisions). */
const CADRE_PAR_FONDEMENT: Readonly<Record<FondementOs, { libelle: string; texte: string; referenceAttendue: boolean }>> = {
  execution_resolution_ag: { libelle: "exécution d'une résolution d'assemblée", texte: 'L. 1965 art. 18, I', referenceAttendue: true },
  decision_conseil_syndical: {
    libelle: 'décision du conseil syndical délégataire',
    texte: 'L. 1965 art. 21-1, 21-5 ; D. 1967 art. 21-1',
    referenceAttendue: true,
  },
  administration_courante: { libelle: "administration et entretien de l'immeuble", texte: 'L. 1965 art. 18, I', referenceAttendue: false },
  urgence_sauvegarde: { libelle: 'travaux urgents de sauvegarde', texte: 'L. 1965 art. 18, I ; D. 1967 art. 37', referenceAttendue: false },
  decision_aj_pouvoirs_ag: {
    libelle: "décision de l'administrateur provisoire au titre des pouvoirs de l'assemblée",
    texte: 'L. 1965 art. 29-1, I ; D. 1967 art. 62-7, 62-8',
    referenceAttendue: true,
  },
}

/**
 * Majorités dont les travaux ne s'exécutent pas pendant le délai de contestation (L. 1965 art. 42, al. 3), et leur article ;
 * l'unanimité n'en est pas (décision 7 (c), confirmée par Hugo le 06/11/2026 : ni opposant ni défaillant, donc aucune
 * action de l'al. 2).
 */
const MAJORITES_SUSPENSIVES: ReadonlyMap<TypeMajorite, string> = new Map<TypeMajorite, string>([
  ['art25', 'art. 25'],
  ['art26', 'art. 26'],
])

const DELAIS: ReadonlySet<string> = new Set<UrgenceOrdreAJ>(['normale', 'prioritaire', 'urgence'])
const ROLES: ReadonlySet<string> = new Set(ROLES_CABINET)
const DESTINATAIRES: ReadonlySet<string> = new Set(FICHES_PORTEUSES)

/** Borne de reference_aj (ajOrdrePrestataireSchema, lib/validation.ts). */
export const LONGUEUR_MAX_NUMERO_OS = 50
/** Borne de objet (ajOrdrePrestataireSchema, lib/validation.ts : requis, 200 caractères au plus après suppression des espaces). */
export const LONGUEUR_MAX_OBJET_OS = 200
/** « Plusieurs devis » (D. 1967 art. 19-2) : au moins deux (🔵). */
export const NOMBRE_MIN_DEVIS_CONCURRENCE = 2
/**
 * Durée au-delà de laquelle le devis accepté par l'OS est caduc, comptée de sa date (décision J47 de Hugo du 06/11/2026) :
 * règle du cabinet, aucun texte.
 */
export const MOIS_CADUCITE_DEVIS_OS = 12

const FONDEMENT_CONSULTATION = 'L. 1965 art. 21, al. 2 ; D. 1967 art. 26'
const FONDEMENT_CONCURRENCE = 'L. 1965 art. 21, al. 2 ; D. 1967 art. 19-2'
const FONDEMENT_CONDITIONS_AG = 'L. 1965 art. 21, al. 2'
const FONDEMENT_CONVENTION_LIEE = 'L. 1965 art. 18-1 A, II ; D. 1967 art. 39'
const FONDEMENT_LIEN = 'D. 1967 art. 39 ; L. 1965 art. 18-1 A, II'
const FONDEMENT_AVIS_AJ = 'L. 1965 art. 29-1, I ; D. 1967 art. 62-7'
const FONDEMENT_COURRIEL = 'C. civ. art. 1126, 1127, al. 1'
const FONDEMENT_SMS = 'C. civ. art. 1126, 1127, al. 1 ; loi n° 2004-575 du 21 juin 2004, art. 1er, IV'
const FONDEMENT_SUSPENSION = 'L. 1965 art. 42, al. 3'
const FONDEMENT_DELEGATION_CS = 'L. 1965 art. 21-1, 21-3, 25 a'
const FONDEMENT_CADUCITE = 'C. civ. art. 1117, al. 1 ; art. 1121'
const FONDEMENT_VIGILANCE = 'C. trav. art. L. 8222-1, R. 8222-1, D. 8222-5'
const FONDEMENT_DECENNALE = 'C. ass. art. L. 241-1, L. 243-2'

// ─── Outils ───────────────────────────────────────────────────────────────────────────────────

const euros = (centimes: number): string => formatEurosCentimes(centimes / 100)

const fr = dateIsoVersFr

const texteOuNull = (valeur: string | null | undefined): string | null => {
  const texte = (valeur ?? '').trim()
  return texte === '' ? null : texte
}

/** Valeur saisie, ou valeur actuelle quand le champ n'est pas fourni. */
const garder = <T>(nouveau: T | undefined, actuel: T): T => (nouveau === undefined ? actuel : nouveau)

const messageErreur = (erreur: unknown): string => (erreur instanceof Error ? erreur.message : String(erreur))

function verifierDate(libelle: string, valeur: string | null | undefined): void {
  if (valeur != null && !estDateIsoValide(valeur)) throw new Error(`${libelle} invalide (${valeur}) : AAAA-MM-JJ attendu.`)
}

function verifierNombre(libelle: string, valeur: number | null, minimum: number): void {
  if (valeur !== null && (!Number.isInteger(valeur) || valeur < minimum)) throw new Error(`${libelle} invalide (${valeur}) : entier à partir de ${minimum} attendu.`)
}

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/

function verifierHorodatage(libelle: string, date: string, heure: string): void {
  if (!estDateIsoValide(date)) throw new Error(`${libelle} : date invalide (${date}) : AAAA-MM-JJ attendu.`)
  if (!HEURE.test(heure)) throw new Error(`${libelle} : heure invalide (${heure}) : HH:MM attendu.`)
}

const horodatage = (e: { date: string; heure: string }): string => `${e.date} ${e.heure}`

const horodatageFr = (e: { date: string; heure: string }): string => `${fr(e.date)} ${e.heure}`

// ─── Numérotation <mandat>.<plan>.<rang> ──────────────────────────────────────────────────────

export interface SegmentsNumeroOs {
  /** Code du mandat dans le N° : la séquence est celle du mandat (décision de Hugo du 03/11/2026). */
  mandat: string
  /** Segment <plan> du N° (🔴 sens à confirmer) : il ne découpe pas la séquence. */
  plan: string
}

export interface NumeroOs extends SegmentsNumeroOs {
  rang: number
}

const SEGMENT_NUMERO = /^[^.\s]+$/
const NUMERO_OS = /^([^.\s]+)\.([^.\s]+)\.(\d{1,9})$/

/** N° « mandat.plan.rang » : segments non vides sans point ni espace, rang entier ≥ 1, au plus 50 caractères. */
export function formaterNumeroOs({ mandat, plan, rang }: NumeroOs): string {
  const segments: [string, string][] = [
    ['mandat', mandat],
    ['plan', plan],
  ]
  for (const [libelle, segment] of segments)
    if (!SEGMENT_NUMERO.test(segment)) throw new Error(`Segment « ${libelle} » du N° d'OS invalide (« ${segment} ») : non vide, sans point ni espace.`)
  if (!Number.isInteger(rang) || rang < 1) throw new Error(`Rang du N° d'OS invalide (${rang}) : entier à partir de 1 attendu.`)
  const numero = `${mandat}.${plan}.${rang}`
  if (numero.length > LONGUEUR_MAX_NUMERO_OS)
    throw new Error(`N° d'OS « ${numero} » trop long : ${LONGUEUR_MAX_NUMERO_OS} caractères au plus (reference_aj).`)
  return numero
}

/** Segments d'un N° « mandat.plan.rang » ; null pour un N° libre ou repris d'ailleurs. */
export function lireNumeroOs(numero: string | null): NumeroOs | null {
  const lu = NUMERO_OS.exec((numero ?? '').trim())
  if (!lu) return null
  const rang = Number(lu[3])
  return rang >= 1 ? { mandat: lu[1], plan: lu[2], rang } : null
}

/**
 * Rang suivant dans la séquence du mandat (décision de Hugo du 03/11/2026 : séquence par mandat) : le plus grand rang de
 * ce segment mandat, tous plans confondus, + 1.
 */
export function rangOsSuivant(numeros: readonly (string | null)[], mandat: string): number {
  const rangs = numeros.flatMap((numero) => {
    const lu = lireNumeroOs(numero)
    return lu?.mandat === mandat ? [lu.rang] : []
  })
  return rangs.reduce((plusGrand, rang) => Math.max(plusGrand, rang), 0) + 1
}

/**
 * Numérote la demande (copie) dans la séquence de son mandat. Refusé si un N° est déjà posé (figé), sans mandat, sur une
 * demande terminée, ou si la liste reçue contient une demande d'un autre mandat.
 */
export function numeroterDemande(d: Demande, demandesDuMandat: readonly Demande[], segments: SegmentsNumeroOs): Demande {
  if (d.numero !== null) throw new Error(`Demande ${d.id} : N° d'OS « ${d.numero} » déjà attribué, il est figé.`)
  if (d.mandatId === null) throw new Error(`Demande ${d.id} sans mandat : la séquence des N° d'OS est celle du mandat.`)
  if (d.statut === 'Terminé') throw new Error(`Demande ${d.id} terminée : plus de numérotation.`)
  const etrangere = demandesDuMandat.find((autre) => autre.mandatId !== d.mandatId)
  if (etrangere) throw new Error(`Demande ${etrangere.id} d'un autre mandat dans la séquence du mandat ${d.mandatId}.`)
  const rang = rangOsSuivant(
    demandesDuMandat.map((autre) => autre.numero),
    segments.mandat,
  )
  return { ...d, numero: formaterNumeroOs({ ...segments, rang }) }
}

// ─── Sortie de l'ordre de service ─────────────────────────────────────────────────────────────

export interface EvenementVisa {
  date: string
  heure: string
  collaborateurId: string
  role: RoleCabinet
  action: ActionVisa
  motif: string | null
}

export interface SaisieEvenementVisa {
  date: string
  heure: string
  collaborateurId: string
  role: RoleCabinet
  motif?: string | null
}

/** Ligne du journal de diffusion (tranche 34 : date, heure, collaborateur, canal, destinataire). */
export interface EvenementDiffusion {
  date: string
  heure: string
  collaborateurId: string
  canal: CanalEnvoiOs
  /** Fiche porteuse destinataire ; pour une réception, l'entreprise qui en accuse réception. */
  destinataire: Rattachement
  nature: NatureDiffusion
  /** Référence diffusion (routeur, numéro de pli). */
  referenceDiffusion: string | null
  /** Courrier lié (courriers.ts), exigé pour le courrier AR. */
  courrierId: string | null
  /** Mission syndic_missions créée par la route, exigée pour la messagerie VitFix. */
  missionId: string | null
  /**
   * Réception par courrier AR seulement : son AR, qui en fait preuve (décision 9) ; null sans AR (« sans preuve ») et hors
   * réception. Absent sur les lignes écrites avant la décision 9 : lu comme null, jamais comme une preuve.
   */
  ar?: ArReceptionOs | null
}

/**
 * Accusé de réception (AR) qui fait preuve de la réception de l'OS (décision de Hugo du 03/11/2026 : « l'AR fait preuve ») :
 * l'avis de réception du courrier AR qui a porté l'OS à l'entreprise, envoi ou rediffusion (🔵). Aucune caducité n'est
 * attachée à l'AR : « AR caduc après 1 an » vise le devis, caduc un an après sa date (J47, MOIS_CADUCITE_DEVIS_OS).
 */
export interface ArReceptionOs {
  /** Référence de l'AR : numéro du pli recommandé, ou pièce numérisée (identifiant). */
  reference: string
  /** Première présentation du pli, si elle est connue (comme la décision J1) ; null : inconnue. */
  premierePresentationLe: string | null
}

export interface SaisieDiffusion {
  date: string
  heure: string
  collaborateurId: string
  canal: CanalEnvoiOs
  destinataire: Rattachement
  referenceDiffusion?: string | null
  courrierId?: string | null
  missionId?: string | null
}

export interface SaisieArReception {
  reference: string
  premierePresentationLe?: string | null
}

/**
 * Réception de l'OS : la ligne du journal et, s'il est reçu, l'AR qui la prouve (réception par courrier AR seulement ;
 * absent ou null : « sans preuve »).
 */
export interface SaisieReception extends SaisieDiffusion {
  ar?: SaisieArReception | null
}

export interface JustificatifsOs {
  /** Avis du conseil syndical recueilli le (L. 1965 art. 21, al. 2 ; D. 1967 art. 62-7). */
  avisConseilSyndicalLe: string | null
  /** Mode de financement précisé lors de la consultation par l'administrateur provisoire (D. 1967 art. 62-7, al. 3). */
  modeFinancement: string | null
  /** Nombre de devis demandés, ou d'entreprises consultées sur un devis descriptif (D. 1967 art. 19-2). */
  devisDemandes: number | null
  /**
   * Nombre de devis exigé par les conditions de mise en concurrence fixées par l'assemblée (L. 1965 art. 21, al. 2) ;
   * null : aucune condition fixée, plusieurs devis (D. 1967 art. 19-2).
   */
  devisExigesParAssemblee: number | null
  /**
   * Référence de la résolution qui autorise la convention liée (L. 1965 art. 18-1 A, II ; D. 1967 art. 39) ; elle vaut pour
   * l'entreprise de la demande au moment où elle est saisie (SortieOrdreService.autorisationConventionLieePour).
   */
  autorisationConventionLiee: string | null
}

/**
 * Constat de l'urgence par l'administrateur provisoire lui-même (décision de Hugo du 03/11/2026 : « nous constatons
 * l'urgence ») : daté, motivé, attribué au collaborateur qui agit en son nom.
 */
export interface ConstatUrgence {
  constateLe: string
  /** Pourquoi les travaux ne peuvent pas attendre. */
  motif: string
  /** Collaborateur qui constate l'urgence au nom de l'administrateur provisoire (identifiant). */
  collaborateurId: string
}

/** Rapport de l'entreprise reçu après l'OS (attendu au statut « Rapport demandé »). */
export interface RapportRecu {
  recuLe: string
  /** Document du rapport (messagerie VitFix, pièce jointe) ; null s'il n'est pas lié. */
  documentId: string | null
}

export interface SortieOrdreService extends CircuitVisa<CodeMotifVisa> {
  demandeId: string
  /**
   * Signature : collaborateur qui signe pour le cabinet (décision de Hugo du 03/11/2026 : un collaborateur peut signer,
   * pas seulement l'administrateur désigné ; habilités : ContexteEnvoiOs.administrateurDesigneId et
   * signatairesHabilites) ; valeurs de la liste « Signature » de Gestéam non établies (🔴).
   */
  signataireId: string | null
  /** Délai : liste « Délai » de la tranche 34 = UrgenceOrdreAJ (décision de Hugo du 03/11/2026). */
  delai: UrgenceOrdreAJ
  /** Constat de l'urgence par l'administrateur provisoire ; null : aucun constat. */
  constatUrgence: ConstatUrgence | null
  /** Envoi : canal choisi pour le premier envoi (liste « Envoi » = CANAUX_ENVOI_OS, décision de Hugo du 03/11/2026). */
  canal: CanalEnvoiOs | null
  diffusable: boolean
  relanceLe: string | null
  fondement: FondementOs | null
  /** Résolution, procès-verbal du conseil syndical ou registre des décisions qui fonde l'OS. */
  fondementReference: string | null
  /**
   * Date de la décision qui fonde l'OS : résolution, procès-verbal du conseil syndical, ou mention au registre des
   * décisions de l'administrateur provisoire (D. 1967 art. 62-8).
   */
  decisionLe: string | null
  /** Majorité de la résolution exécutée (L. 1965 art. 42, al. 3) ; null : non renseignée. */
  majoriteResolution: TypeMajorite | null
  /**
   * Convention liée au sens de D. 1967 art. 39 : avec le syndic (ici l'administrateur provisoire), ses préposés, son
   * conjoint, partenaire de PACS ou concubin, ses parents ou alliés jusqu'au deuxième degré, avec une entreprise dont l'une
   * de ces personnes est propriétaire ou associée, qu'elle dirige ou contrôle, ou dont elle est salariée ou préposée, ou,
   * pour un syndic personne morale, avec une entreprise qui détient une participation dans son capital ; null : non
   * renseigné.
   */
  entrepriseLiee: boolean | null
  /**
   * Entreprise (prestataireId de la demande) à laquelle répondait entrepriseLiee quand elle a été saisie : la réponse ne
   * vaut pas pour une autre entreprise (lienEntreprise).
   */
  entrepriseLieeDeclareePour: string | null
  justificatifs: JustificatifsOs
  /**
   * Entreprise (prestataireId de la demande) pour laquelle l'autorisation de l'assemblée (justificatifs.
   * autorisationConventionLiee) a été saisie : elle ne vaut pas pour une autre entreprise (autorisationConvention) ; null
   * sans autorisation.
   */
  autorisationConventionLieePour: string | null
  /** Rapport de l'entreprise reçu (enregistrerRapport) ; null : non reçu. */
  rapportRecu: RapportRecu | null
  /** Journal de diffusion, en ajout seul. */
  journal: EvenementDiffusion[]
}

export interface SaisieSortieOs {
  signataireId?: string | null
  delai?: UrgenceOrdreAJ
  /** Constat complet (date, motif et collaborateur non vides) ou null pour l'effacer ; incomplet : refusé. */
  constatUrgence?: ConstatUrgence | null
  canal?: CanalEnvoiOs | null
  diffusable?: boolean
  relanceLe?: string | null
  fondement?: FondementOs | null
  fondementReference?: string | null
  decisionLe?: string | null
  majoriteResolution?: TypeMajorite | null
  entrepriseLiee?: boolean | null
  justificatifs?: Partial<JustificatifsOs>
}

/** Champs modifiables avant l'envoi (la date de relance passe par fixerRelance). */
export type ChangementsSortieOs = Omit<SaisieSortieOs, 'relanceLe'>

const JUSTIFICATIFS_VIDES: JustificatifsOs = {
  avisConseilSyndicalLe: null,
  modeFinancement: null,
  devisDemandes: null,
  devisExigesParAssemblee: null,
  autorisationConventionLiee: null,
}

function verifierSortie(s: SortieOrdreService): void {
  if (!DELAIS.has(s.delai)) throw new Error(`Délai inconnu : « ${s.delai} » (normale, prioritaire ou urgence).`)
  if (s.canal !== null && !CANAUX.has(s.canal)) throw new Error(`Canal d'envoi inconnu : « ${s.canal} ».`)
  if (s.fondement !== null && !FONDEMENTS.has(s.fondement)) throw new Error(`Fondement de l'OS inconnu : « ${s.fondement} ».`)
  if (s.majoriteResolution !== null && !Object.hasOwn(MAJORITES_AG, s.majoriteResolution))
    throw new Error(`Majorité de la résolution inconnue : « ${s.majoriteResolution} » (${Object.keys(MAJORITES_AG).join(', ')}).`)
  verifierDate('Date de relance', s.relanceLe)
  verifierDate('Date de la décision', s.decisionLe)
  verifierDate('Avis du conseil syndical', s.justificatifs.avisConseilSyndicalLe)
  verifierNombre('Nombre de devis demandés', s.justificatifs.devisDemandes, 0)
  verifierNombre("Nombre de devis exigé par l'assemblée", s.justificatifs.devisExigesParAssemblee, 1)
}

function appliquerJustificatifs(actuels: JustificatifsOs, j: Partial<JustificatifsOs>): JustificatifsOs {
  return {
    avisConseilSyndicalLe: garder(j.avisConseilSyndicalLe, actuels.avisConseilSyndicalLe),
    modeFinancement: texteOuNull(garder(j.modeFinancement, actuels.modeFinancement)),
    devisDemandes: garder(j.devisDemandes, actuels.devisDemandes),
    devisExigesParAssemblee: garder(j.devisExigesParAssemblee, actuels.devisExigesParAssemblee),
    autorisationConventionLiee: texteOuNull(garder(j.autorisationConventionLiee, actuels.autorisationConventionLiee)),
  }
}

/** La réponse sur le lien a été saisie pour une autre entreprise que celle de la demande (entreprise changée depuis). */
const lienPerime = (d: Pick<Demande, 'prestataireId'>, c: Pick<SortieOrdreService, 'entrepriseLiee' | 'entrepriseLieeDeclareePour'>): boolean =>
  c.entrepriseLiee !== null && c.entrepriseLieeDeclareePour !== d.prestataireId

type AutorisationSaisie = Pick<SortieOrdreService, 'justificatifs' | 'autorisationConventionLieePour'>

/** Une autorisation de l'assemblée est saisie, mais pour une autre entreprise que `prestataireId` (ou sans entreprise). */
const autorisationPourAutre = (s: AutorisationSaisie, prestataireId: string | null): boolean =>
  s.justificatifs.autorisationConventionLiee !== null && s.autorisationConventionLieePour !== prestataireId

/**
 * Réponse sur le lien (D. 1967 art. 39) saisie : elle vaut pour l'entreprise de la demande à ce moment. Redite alors que
 * l'autorisation de l'assemblée a été saisie pour une autre entreprise, elle efface celle-ci, qui visait la convention avec
 * cette autre entreprise, que la réponse précédente ait été connue ou non (sauf autorisation saisie avec la réponse).
 */
function appliquerLien(s: SortieOrdreService, saisie: SaisieSortieOs, prestataireId: string | null): SortieOrdreService {
  if (saisie.entrepriseLiee === undefined) return s
  const lien: SortieOrdreService = { ...s, entrepriseLiee: saisie.entrepriseLiee, entrepriseLieeDeclareePour: prestataireId }
  if (!autorisationPourAutre(s, prestataireId)) return lien
  return { ...lien, justificatifs: { ...s.justificatifs, autorisationConventionLiee: null }, autorisationConventionLieePour: null }
}

/** Éléments du constat d'urgence et leur présence (décision de Hugo du 03/11/2026 : daté, motivé, attribué). */
const ELEMENTS_CONSTAT: readonly (readonly [string, (c: ConstatUrgence) => boolean])[] = [
  ['date', (c) => estDateIsoValide(c.constateLe)],
  ['motif', (c) => texteOuNull(c.motif) !== null],
  ['collaborateur', (c) => texteOuNull(c.collaborateurId) !== null],
]

/** Éléments manquants du constat (tous, sans constat). */
const manquesConstat = (c: ConstatUrgence | null): string[] =>
  ELEMENTS_CONSTAT.filter(([, present]) => c === null || !present(c)).map(([nom]) => nom)

const constatComplet = (c: ConstatUrgence | null): c is ConstatUrgence => manquesConstat(c).length === 0

/** Constat saisi (motif et collaborateur sans espaces superflus) ; null l'efface ; incomplet : refusé. */
function lireConstatUrgence(c: ConstatUrgence | null): ConstatUrgence | null {
  if (c === null) return null
  if (!estDateIsoValide(c.constateLe)) throw new Error(`Constat d'urgence : date invalide (${c.constateLe}) : AAAA-MM-JJ attendu.`)
  const motif = texteOuNull(c.motif)
  if (motif === null) throw new Error("Constat d'urgence : motif obligatoire (pourquoi les travaux ne peuvent pas attendre).")
  const collaborateurId = texteOuNull(c.collaborateurId)
  if (collaborateurId === null)
    throw new Error("Constat d'urgence : identifiant du collaborateur qui constate l'urgence au nom de l'administrateur provisoire attendu.")
  return { constateLe: c.constateLe, motif, collaborateurId }
}

/** Entreprise de l'autorisation : celle de la demande quand l'autorisation est saisie, aucune quand elle est effacée. */
function entrepriseDeLAutorisation(actuelle: string | null, saisie: SaisieSortieOs, autorisation: string | null, prestataireId: string | null): string | null {
  if (saisie.justificatifs?.autorisationConventionLiee === undefined) return actuelle
  return autorisation === null ? null : prestataireId
}

function appliquerSaisie(base: SortieOrdreService, saisie: SaisieSortieOs, prestataireId: string | null): SortieOrdreService {
  const s = appliquerLien(base, saisie, prestataireId)
  const justificatifs = appliquerJustificatifs(s.justificatifs, saisie.justificatifs ?? {})
  const suite: SortieOrdreService = {
    ...s,
    signataireId: texteOuNull(garder(saisie.signataireId, s.signataireId)),
    delai: garder(saisie.delai, s.delai),
    constatUrgence: saisie.constatUrgence === undefined ? s.constatUrgence : lireConstatUrgence(saisie.constatUrgence),
    canal: garder(saisie.canal, s.canal),
    diffusable: garder(saisie.diffusable, s.diffusable),
    relanceLe: garder(saisie.relanceLe, s.relanceLe),
    fondement: garder(saisie.fondement, s.fondement),
    fondementReference: texteOuNull(garder(saisie.fondementReference, s.fondementReference)),
    decisionLe: garder(saisie.decisionLe, s.decisionLe),
    majoriteResolution: garder(saisie.majoriteResolution, s.majoriteResolution),
    justificatifs,
    autorisationConventionLieePour: entrepriseDeLAutorisation(
      s.autorisationConventionLieePour,
      saisie,
      justificatifs.autorisationConventionLiee,
      prestataireId,
    ),
  }
  verifierSortie(suite)
  return suite
}

function verifierLien(d: Demande, s: SortieOrdreService): void {
  if (s.demandeId !== d.id) throw new Error(`Sortie de l'OS ${s.demandeId} reçue pour une autre demande (${d.id}).`)
}

/**
 * Réponse sur le lien (D. 1967 art. 39) pour l'entreprise ACTUELLE de la demande ; null : non renseignée, ou donnée pour
 * une autre entreprise (périmée).
 */
export const lienEntreprise = (
  d: Pick<Demande, 'prestataireId'>,
  c: Pick<SortieOrdreService, 'entrepriseLiee' | 'entrepriseLieeDeclareePour'>,
): boolean | null => (lienPerime(d, c) ? null : c.entrepriseLiee)

/**
 * Autorisation de l'assemblée (L. 1965 art. 18-1 A, II ; D. 1967 art. 39) pour l'entreprise ACTUELLE de la demande ; null :
 * non saisie, ou saisie pour une autre entreprise.
 */
export const autorisationConvention = (d: Pick<Demande, 'prestataireId'>, s: AutorisationSaisie): string | null =>
  autorisationPourAutre(s, d.prestataireId) ? null : s.justificatifs.autorisationConventionLiee

/** Premier envoi du journal ; null si l'OS n'est jamais parti. */
export const premierEnvoi = (s: SortieOrdreService): EvenementDiffusion | null => s.journal.find((e) => e.nature === 'envoi') ?? null

export const estEnvoye = (s: SortieOrdreService): boolean => premierEnvoi(s) !== null

/**
 * L'entreprise a accusé réception de l'OS : le contrat se forme quand l'acceptation parvient (C. civ. art. 1121) ; pour un
 * écrit électronique hors des cas des art. 1125 et 1126, la remise est effective à l'accusé de réception (art. 1127-4).
 */
export const estRecu = (s: SortieOrdreService): boolean => s.journal.some((e) => e.nature === 'reception')

function verifierNonEnvoye(s: SortieOrdreService, action: string): void {
  const envoi = premierEnvoi(s)
  if (envoi)
    throw new Error(
      `OS ${s.demandeId} déjà envoyé le ${horodatageFr(envoi)} : impossible de ${action} (preuve figée ; une modification vaut offre nouvelle, établir un nouvel ordre de service).`,
    )
}

// ─── Motifs du visa ───────────────────────────────────────────────────────────────────────────

export type CodeMotifVisa =
  | 'seuil_cabinet'
  | 'prevu_inconnu'
  | 'nature_soumise'
  | 'execution_forcee'
  | 'consultation_conseil_syndical'
  | 'mise_en_concurrence'
  | 'convention_liee'
  | 'avis_conseil_syndical_aj'

export interface MotifVisa {
  code: CodeMotifVisa
  message: string
  /** Texte qui fonde le motif ; null pour une règle de gestion du cabinet. */
  fondement: string | null
  aConfirmer: boolean
}

/** Règles de gestion du visa (paramètres du cabinet). */
export interface ReglesVisaOs {
  /** Prévu TTC à partir duquel (inclus) le visa est nécessaire ; null : aucun seuil. */
  seuilPrevuTtcCentimes: number | null
  /** Natures soumises au visa (comparées sans casse ni accents). */
  naturesSoumises: ReadonlySet<string>
  executionForceeSoumise: boolean
  rolesViseurs: ReadonlySet<RoleCabinet>
}

/** Aucun visa de gestion par défaut ; viseur : la Direction (🔵, 🔴 à Frédéric). */
export const REGLES_VISA_PAR_DEFAUT: ReglesVisaOs = Object.freeze({
  seuilPrevuTtcCentimes: null,
  naturesSoumises: new Set<string>(),
  executionForceeSoumise: false,
  rolesViseurs: new Set<RoleCabinet>(['Direction']),
})

export interface OptionsVisa {
  regles?: ReglesVisaOs
  /** Décisions d'assemblée en vigueur à la date de l'envoi (decisionsEnVigueur) : seuils de L. 1965 art. 21, al. 2. */
  decisionsAgEnVigueur?: readonly DecisionAnnuelle[]
}

/** Ce que la sortie dit du cadre de l'OS. */
export type CadreVisa = Pick<SortieOrdreService, 'fondement' | 'constatUrgence' | 'entrepriseLiee' | 'entrepriseLieeDeclareePour' | 'delai'>

/** Urgence demandée : délai « urgence » ou fondement « urgence de sauvegarde » (un délai « prioritaire » n'en est pas une). */
const urgenceDemandee = (c: Pick<SortieOrdreService, 'delai' | 'fondement'>): boolean => c.delai === 'urgence' || c.fondement === 'urgence_sauvegarde'

/** Urgence retenue : demandée, et constatée par l'administrateur provisoire (constat complet ; décision de Hugo du 03/11/2026). */
const urgenceConstatee = (c: Pick<SortieOrdreService, 'delai' | 'fondement' | 'constatUrgence'>): boolean =>
  urgenceDemandee(c) && constatComplet(c.constatUrgence)

const motif = (code: CodeMotifVisa, message: string, fondement: string | null = null, aConfirmer = false): MotifVisa => ({
  code,
  message,
  fondement,
  aConfirmer,
})

const motifPrevuInconnu = (): MotifVisa =>
  motif('prevu_inconnu', 'Prévu inconnu (ni prix ni devis associé) : les seuils du visa ne peuvent pas être appréciés.')

function motifsDeGestion(d: Demande, regles: ReglesVisaOs): MotifVisa[] {
  const motifs: MotifVisa[] = []
  const prevu = prevuDemande(d)
  const seuil = regles.seuilPrevuTtcCentimes
  if (seuil !== null && prevu === null) motifs.push(motifPrevuInconnu())
  else if (seuil !== null && prevu !== null && prevu >= seuil)
    motifs.push(motif('seuil_cabinet', `Prévu de ${euros(prevu)} TTC, au moins égal au seuil du cabinet (${euros(seuil)}) : règle de gestion.`))
  const natures = new Set([...regles.naturesSoumises].map(normaliserTexte))
  if (natures.has(normaliserTexte(d.nature))) motifs.push(motif('nature_soumise', `Nature « ${d.nature} » soumise au visa : règle de gestion.`))
  if (d.executionForcee && regles.executionForceeSoumise) motifs.push(motif('execution_forcee', 'Exécution forcée soumise au visa : règle de gestion.'))
  return motifs
}

/** Seuils de L. 1965 art. 21, al. 2, comparés au prévu TTC (décision J6) ; prévu inconnu face à un seuil décidé : motif. */
function motifsSeuilsArt21(prevu: number | null, decisions: readonly DecisionAnnuelle[] | undefined): MotifVisa[] {
  if (!decisions) return []
  const atteints = seuilsAtteints(prevu ?? 0, decisions)
  if (prevu === null) return atteints.consultationCs === null && atteints.miseEnConcurrence === null ? [] : [motifPrevuInconnu()]
  const motifs: MotifVisa[] = []
  if (atteints.consultationCs)
    motifs.push(
      motif(
        'consultation_conseil_syndical',
        `Prévu de ${euros(prevu)} TTC : consultation du conseil syndical obligatoire à partir du seuil fixé par l'assemblée (montant égal compris).`,
        FONDEMENT_CONSULTATION,
      ),
    )
  if (atteints.miseEnConcurrence)
    motifs.push(
      motif(
        'mise_en_concurrence',
        `Prévu de ${euros(prevu)} TTC : mise en concurrence obligatoire à partir du seuil fixé par l'assemblée (montant égal compris).`,
        FONDEMENT_CONCURRENCE,
      ),
    )
  return motifs
}

function motifsLegaux(d: Demande, cadre: CadreVisa, decisions: readonly DecisionAnnuelle[] | undefined): MotifVisa[] {
  if (d.type !== 'intervention') return []
  const motifs = motifsSeuilsArt21(prevuDemande(d), decisions)
  if (lienEntreprise(d, cadre) === true)
    motifs.push(
      motif(
        'convention_liee',
        "Convention liée (D. 1967 art. 39 : avec le syndic, l'un de ses préposés ou de ses proches, ou une entreprise où l'un d'eux a une part, une fonction de direction ou de contrôle, ou un emploi) : à autoriser spécialement par l'assemblée ; sans autorisation, la convention avec une entreprise liée au syndic n'est pas opposable au syndicat.",
        FONDEMENT_CONVENTION_LIEE,
      ),
    )
  if (cadre.fondement === 'decision_aj_pouvoirs_ag' && !urgenceConstatee(cadre))
    motifs.push(
      motif(
        'avis_conseil_syndical_aj',
        "Décision de l'administrateur provisoire au titre des pouvoirs de l'assemblée : avis préalable du conseil syndical, sauf urgence constatée par l'administrateur provisoire (délai « urgence » et constat daté, motivé et attribué).",
        FONDEMENT_AVIS_AJ,
        true,
      ),
    )
  return motifs
}

/** Motifs du visa : règles de gestion du cabinet et déclencheurs légaux (intervention seulement), sans doublon. */
export function motifsVisa(d: Demande, cadre: CadreVisa, options: OptionsVisa = {}): MotifVisa[] {
  const tous = [...motifsDeGestion(d, options.regles ?? REGLES_VISA_PAR_DEFAUT), ...motifsLegaux(d, cadre, options.decisionsAgEnVigueur)]
  return [...new Map(tous.map((m) => [m.code, m])).values()]
}

/**
 * Sortie de l'OS d'une demande ouverte : visa initial « Visa nécessaire » s'il y a un motif, sinon « Sortie libre ». Une
 * date de relance antérieure à la demande est refusée.
 */
export function creerSortieOs(d: Demande, saisie: SaisieSortieOs = {}, options: OptionsVisa = {}): SortieOrdreService {
  if (d.statut === 'Terminé' || estRefusee(d)) throw new Error(`Demande ${d.id} terminée ou refusée : aucun ordre de service à préparer.`)
  const vierge: SortieOrdreService = {
    demandeId: d.id,
    signataireId: null,
    delai: 'normale',
    constatUrgence: null,
    canal: null,
    diffusable: true,
    relanceLe: null,
    fondement: null,
    fondementReference: null,
    decisionLe: null,
    majoriteResolution: null,
    entrepriseLiee: null,
    entrepriseLieeDeclareePour: null,
    justificatifs: JUSTIFICATIFS_VIDES,
    autorisationConventionLieePour: null,
    rapportRecu: null,
    ...circuitVisaInitial<CodeMotifVisa>([]),
    journal: [],
  }
  const s = appliquerSaisie(vierge, saisie, d.prestataireId)
  if (s.relanceLe !== null && s.relanceLe < d.demandeLe)
    throw new Error(`Date de relance (${fr(s.relanceLe)}) antérieure à la demande du ${fr(d.demandeLe)}.`)
  return { ...s, ...circuitVisaInitial(motifsVisa(d, s, options).map((m) => m.code)) }
}

/**
 * Modifie la sortie (copie) avant le premier envoi ; le visa n'est pas touché (revoirVisa ; le contrôle avant l'envoi le
 * voit). La réponse sur le lien (entrepriseLiee) vaut pour l'entreprise actuelle de la demande `d`.
 */
export function modifierSortieOs(s: SortieOrdreService, d: Demande, changements: ChangementsSortieOs): SortieOrdreService {
  verifierLien(d, s)
  verifierNonEnvoye(s, 'modifier la sortie')
  return appliquerSaisie(s, changements, d.prestataireId)
}

/** « Diffusable » (copie) : se règle avant comme après le premier envoi ; un OS non diffusable ne part pas et n'est pas rediffusé. */
export const marquerDiffusable = (s: SortieOrdreService, diffusable: boolean): SortieOrdreService => ({ ...s, diffusable })

// ─── Circuit du visa (commun aux pièces de sortie) ────────────────────────────────────────────

/**
 * Visa d'une pièce de sortie : l'ordre de service ici ; le courrier (tranche 20) suit le MÊME circuit (décision de Hugo du
 * 03/11/2026, branchement à faire). M : codes des motifs propres à la pièce.
 */
export interface CircuitVisa<M extends string = string> {
  visa: VisaSortie
  /** Motifs relevés à la création ou à la dernière revue : le visa donné porte sur eux. */
  motifsVisa: M[]
  /** Empreinte de la pièce soumise au visa (visa demandé), puis visée (visa donné) ; null sinon. */
  empreinteVisee: string | null
  historiqueVisa: EvenementVisa[]
}

/** La pièce soumise au visa, telle que le circuit la voit. */
export interface PieceVisee {
  /** Désignation avec son article, pour les messages (« la demande », « le courrier »). */
  designation: string
  /** Sortie de la pièce avec son article, pour les messages (« l'envoi » de l'OS, « le dépôt » du courrier). */
  sortie: string
  /** Date de la pièce : aucun événement du visa ne la précède. */
  datee: string
  /** Empreinte actuelle des champs visés : un visa demandé ou donné tombe quand elle change. */
  empreinte: string
  /** Champs visés, pour les messages (« prévu, entreprise, objet, nature ou devis associé »). */
  champsVises: string
}

/** Rôles habilités à viser (rolesViseurs des règles du visa). */
export type ReglesViseurs = Pick<ReglesVisaOs, 'rolesViseurs'>

export type CodeAnomalieVisa = 'visa_manquant' | 'visa_a_revoir' | 'visa_devenu_necessaire'

/** Ce qui retient la pièce au contrôle avant sa sortie (toujours bloquant). */
export interface AnomalieVisa {
  code: CodeAnomalieVisa
  message: string
}

const TRANSITIONS_VISA: Readonly<Record<ActionVisa, { depuis: ReadonlySet<VisaSortie>; vers: VisaSortie }>> = {
  exige: { depuis: new Set<VisaSortie>(['Sortie libre']), vers: 'Visa nécessaire' },
  demande: { depuis: new Set<VisaSortie>(['Visa nécessaire', 'Visa refusé']), vers: 'Demande de visa' },
  donne: { depuis: new Set<VisaSortie>(['Demande de visa']), vers: 'Visa donné' },
  refuse: { depuis: new Set<VisaSortie>(['Demande de visa']), vers: 'Visa refusé' },
  revu: { depuis: new Set<VisaSortie>(['Sortie libre', 'Demande de visa', 'Visa donné']), vers: 'Visa nécessaire' },
}

const ACTIONS_DU_VISEUR: ReadonlySet<ActionVisa> = new Set<ActionVisa>(['donne', 'refuse'])

/** Actions qui figent l'empreinte de la pièce soumise au visa (demande), puis visée (donne). */
const ACTIONS_EMPREINTE: ReadonlySet<ActionVisa> = new Set<ActionVisa>(['demande', 'donne'])

/** Préposition « à » devant la désignation, contractée devant « le » et « les » (« à la demande », « au courrier »). */
const CONTRACTIONS: readonly (readonly [string, string])[] = [
  ['les ', 'aux '],
  ['le ', 'au '],
]

function precedeDeA(designation: string): string {
  const contraction = CONTRACTIONS.find(([article]) => designation.startsWith(article))
  return contraction ? `${contraction[1]}${designation.slice(contraction[0].length)}` : `à ${designation}`
}

const majuscule = (texte: string): string => texte.charAt(0).toUpperCase() + texte.slice(1)

/** Articles retirés devant un nom (« l'envoi » → « envoi », « le dépôt » → « dépôt »). */
const ARTICLES: readonly string[] = ["l'", 'l’', 'le ', 'la ', 'les ']

function sansArticle(groupe: string): string {
  const article = ARTICLES.find((a) => groupe.startsWith(a))
  return article ? groupe.slice(article.length) : groupe
}

/** Circuit initial d'une pièce : « Visa nécessaire » s'il y a un motif, sinon « Sortie libre ». */
export const circuitVisaInitial = <M extends string>(motifs: readonly M[]): CircuitVisa<M> => ({
  visa: motifs.length > 0 ? 'Visa nécessaire' : 'Sortie libre',
  motifsVisa: [...motifs],
  empreinteVisee: null,
  historiqueVisa: [],
})

/** Seuls « Visa donné » et « Sortie libre » laissent sortir la pièce. */
export const visaPermetSortie = (c: Pick<CircuitVisa, 'visa'>): boolean => VISAS_PERMETTANT_ENVOI.has(c.visa)

/** Visas qui portent l'empreinte figée de la pièce (soumise au visa, puis visée). */
const VISAS_A_EMPREINTE: ReadonlySet<VisaSortie> = new Set<VisaSortie>(['Demande de visa', 'Visa donné'])

/** Visa demandé ou donné sur une pièce qui ne correspond plus à l'empreinte figée. */
const pieceChangeeDepuisVisa = (c: CircuitVisa, piece: PieceVisee): boolean => VISAS_A_EMPREINTE.has(c.visa) && c.empreinteVisee !== piece.empreinte

function evenementVisa(c: CircuitVisa, piece: PieceVisee, action: ActionVisa, saisie: SaisieEvenementVisa): EvenementVisa {
  verifierHorodatage('Visa', saisie.date, saisie.heure)
  const collaborateurId = saisie.collaborateurId.trim()
  if (!collaborateurId) throw new Error('Visa : identifiant du collaborateur attendu.')
  if (!ROLES.has(saisie.role)) throw new Error(`Rôle inconnu : « ${saisie.role} » (${ROLES_CABINET.join(', ')}).`)
  if (saisie.date < piece.datee)
    throw new Error(`Visa : horodatage (${horodatageFr(saisie)}) antérieur ${precedeDeA(piece.designation)} du ${fr(piece.datee)}.`)
  const dernier = c.historiqueVisa.at(-1)
  if (dernier && horodatage(saisie) < horodatage(dernier))
    throw new Error(`Visa : horodatage (${horodatageFr(saisie)}) antérieur au dernier événement du visa (${horodatageFr(dernier)}).`)
  return { date: saisie.date, heure: saisie.heure, collaborateurId, role: saisie.role, action, motif: texteOuNull(saisie.motif) }
}

function verifierViseur(c: CircuitVisa, viseur: EvenementVisa, regles: ReglesViseurs): void {
  if (!regles.rolesViseurs.has(viseur.role))
    throw new Error(`Rôle « ${viseur.role} » non habilité à viser (viseurs : ${[...regles.rolesViseurs].join(', ')}).`)
  const demande = c.historiqueVisa.findLast((e) => e.action === 'demande')
  if (demande?.collaborateurId === viseur.collaborateurId) throw new Error('Le visa est donné ou refusé par un autre collaborateur que celui qui l’a demandé.')
}

/**
 * Action du visa sur une pièce de sortie (copie) : transition permise, horodatage jamais antérieur à la pièce ni au dernier
 * événement, viseur habilité et autre que le demandeur, refus motivé ; « demande » et « donne » figent l'empreinte de la
 * pièce. Le gel après la sortie (envoi de l'OS, dépôt du courrier) est contrôlé par l'appelant.
 */
export function appliquerActionVisa<C extends CircuitVisa>(
  c: C,
  piece: PieceVisee,
  action: ActionVisa,
  saisie: SaisieEvenementVisa,
  regles: ReglesViseurs = REGLES_VISA_PAR_DEFAUT,
  motifs: C['motifsVisa'] = c.motifsVisa,
): C {
  const evenement = evenementVisa(c, piece, action, saisie)
  const transition = TRANSITIONS_VISA[action]
  if (!transition.depuis.has(c.visa))
    throw new Error(`Visa « ${c.visa} » : action « ${action} » impossible (attendu : ${[...transition.depuis].join(', ')}).`)
  if (ACTIONS_DU_VISEUR.has(action)) verifierViseur(c, evenement, regles)
  if (action === 'refuse' && evenement.motif === null) throw new Error('Refus de visa : motif obligatoire.')
  return {
    ...c,
    visa: transition.vers,
    motifsVisa: motifs,
    empreinteVisee: ACTIONS_EMPREINTE.has(action) ? piece.empreinte : null,
    historiqueVisa: [...c.historiqueVisa, evenement],
  }
}

/**
 * Revue du visa d'une pièce (copie) : une sortie libre qui reçoit un motif, ou un visa demandé ou donné quand un motif
 * nouveau apparaît ou que la pièce ne correspond plus à l'empreinte figée, repasse à « Visa nécessaire » (action
 * « revu ») ; sinon seuls les motifs relevés (`codes`) sont mis à jour.
 */
export function revoirCircuitVisa<C extends CircuitVisa>(c: C, piece: PieceVisee, codes: C['motifsVisa'], saisie: SaisieEvenementVisa): C {
  const vises = new Set<string>(c.motifsVisa)
  const nouveau = codes.some((code) => !vises.has(code))
  const aRevoir = c.visa === 'Sortie libre' ? codes.length > 0 : nouveau || pieceChangeeDepuisVisa(c, piece)
  if (aRevoir && TRANSITIONS_VISA.revu.depuis.has(c.visa)) return appliquerActionVisa(c, piece, 'revu', saisie, REGLES_VISA_PAR_DEFAUT, codes)
  return { ...c, motifsVisa: codes }
}

/**
 * Visa manquant : messages nommés d'après la pièce et sa sortie (pour l'OS, « avant l'envoi », « envoi impossible »,
 * « revoir la demande » : l'OS est la demande, comme dans les autres messages du visa).
 */
const MESSAGE_VISA_MANQUANT: ReadonlyMap<VisaSortie, (piece: PieceVisee) => string> = new Map<VisaSortie, (piece: PieceVisee) => string>([
  ['Visa nécessaire', (piece) => `Visa nécessaire non demandé : demander le visa avant ${piece.sortie}.`],
  ['Demande de visa', (piece) => `Visa demandé, en attente du viseur : ${sansArticle(piece.sortie)} impossible.`],
  ['Visa refusé', (piece) => `Visa refusé : revoir ${piece.designation}, puis demander de nouveau le visa.`],
])

const motifDuRefus = (c: CircuitVisa): string => {
  const refus = c.historiqueVisa.findLast((e) => e.action === 'refuse')
  return refus?.motif ? ` Motif du refus : ${refus.motif}` : ''
}

/**
 * Contrôle du visa avant la sortie de la pièce (bloquants) : visa manquant (nécessaire, demandé ou refusé), pièce changée
 * depuis le visa, ou motif nouveau (`motifs` : ceux relevés au moment du contrôle) sur une sortie libre ou un visa donné.
 */
export function anomaliesCircuitVisa(c: CircuitVisa, piece: PieceVisee, motifs: readonly { code: string; message: string }[]): AnomalieVisa[] {
  const manquant = MESSAGE_VISA_MANQUANT.get(c.visa)
  if (manquant) return [{ code: 'visa_manquant', message: `${manquant(piece)}${motifDuRefus(c)}` }]
  if (pieceChangeeDepuisVisa(c, piece))
    return [{ code: 'visa_a_revoir', message: `${majuscule(piece.designation)} a changé depuis le visa (${piece.champsVises}) : revoir le visa.` }]
  const vises = new Set<string>(c.motifsVisa)
  const nouveaux = motifs.filter((m) => !vises.has(m.code)).map((m) => m.message)
  if (nouveaux.length === 0) return []
  if (c.visa === 'Sortie libre')
    return [{ code: 'visa_devenu_necessaire', message: `Sortie libre, mais un visa est désormais nécessaire (revoir le visa) : ${nouveaux.join(' ')}` }]
  return [{ code: 'visa_a_revoir', message: `Visa donné avant un motif nouveau (revoir le visa) : ${nouveaux.join(' ')}` }]
}

// ─── Visa de l'ordre de service ───────────────────────────────────────────────────────────────

/** Champs de la demande sur lesquels porte le visa (🔵). */
const CHAMPS_VISES: readonly ((d: Demande) => unknown)[] = [
  prevuDemande,
  (d) => d.prestataireId,
  (d) => d.objet,
  (d) => d.nature,
  (d) => d.devisAssocie?.devisId ?? null,
]

/** Empreinte de la demande sur les champs visés (prévu, entreprise, objet, nature, devis associé). */
export const empreinteDemande = (d: Demande): string => JSON.stringify(CHAMPS_VISES.map((champ) => champ(d)))

/** L'ordre de service est la demande (un seul objet, tranche 14) : sa date et l'empreinte de ses champs visés. */
const pieceOs = (d: Demande): PieceVisee => ({
  designation: 'la demande',
  sortie: "l'envoi",
  datee: d.demandeLe,
  empreinte: empreinteDemande(d),
  champsVises: 'prévu, entreprise, objet, nature ou devis associé',
})

function changerVisa(s: SortieOrdreService, d: Demande, action: ActionVisa, saisie: SaisieEvenementVisa, regles: ReglesVisaOs = REGLES_VISA_PAR_DEFAUT): SortieOrdreService {
  verifierLien(d, s)
  verifierNonEnvoye(s, 'changer le visa')
  return appliquerActionVisa(s, pieceOs(d), action, saisie, regles)
}

/** Un collaborateur exige un visa sur une sortie libre. */
export const exigerVisa = (s: SortieOrdreService, d: Demande, saisie: SaisieEvenementVisa): SortieOrdreService => changerVisa(s, d, 'exige', saisie)

/** Demande de visa (visa nécessaire, ou nouvelle demande après un refus) : l'empreinte de la demande soumise est figée. */
export const demanderVisa = (s: SortieOrdreService, d: Demande, saisie: SaisieEvenementVisa): SortieOrdreService => changerVisa(s, d, 'demande', saisie)

/** Visa donné par un viseur (rôle de rolesViseurs, autre que le demandeur) : l'empreinte de la demande visée est figée. */
export const donnerVisa = (s: SortieOrdreService, d: Demande, saisie: SaisieEvenementVisa, regles: ReglesVisaOs = REGLES_VISA_PAR_DEFAUT): SortieOrdreService =>
  changerVisa(s, d, 'donne', saisie, regles)

/** Visa refusé par un viseur, avec un motif. */
export const refuserVisa = (s: SortieOrdreService, d: Demande, saisie: SaisieEvenementVisa, regles: ReglesVisaOs = REGLES_VISA_PAR_DEFAUT): SortieOrdreService =>
  changerVisa(s, d, 'refuse', saisie, regles)

/**
 * Revue du visa de l'OS avant l'envoi (copie), sur les motifs relevés à ce moment (revoirCircuitVisa). Après le premier
 * envoi : refusé (offre nouvelle, nouvel OS).
 */
export function revoirVisa(s: SortieOrdreService, d: Demande, saisie: SaisieEvenementVisa, options: OptionsVisa = {}): SortieOrdreService {
  verifierLien(d, s)
  verifierNonEnvoye(s, 'revoir le visa')
  return revoirCircuitVisa(
    s,
    pieceOs(d),
    motifsVisa(d, s, options).map((m) => m.code),
    saisie,
  )
}

// ─── Contrôle avant l'envoi ───────────────────────────────────────────────────────────────────

export type CodeAnomalieEnvoiOs =
  | 'demande_close'
  | 'numero_absent'
  | 'numero_hors_sequence'
  | 'numero_en_double'
  | 'numero_trop_long'
  | 'entreprise_absente'
  | 'signataire_absent'
  | 'signataire_non_habilite'
  | 'canal_absent'
  | 'non_diffusable'
  | 'relance_avant_envoi'
  | 'decision_posterieure_envoi'
  | 'objet_absent'
  | 'objet_trop_long'
  | 'sans_compte_vitfix'
  | 'courriel_non_communique'
  | 'courriel_a_verifier'
  | 'sms_non_communique'
  | 'sms_a_verifier'
  | 'urgence_non_constatee'
  | 'constat_urgence_sans_urgence'
  | 'constat_urgence_posterieur'
  | 'constat_urgence_posterieur_envoi'
  | 'constat_urgence_auteur_non_habilite'
  | CodeAnomalieVisa
  | 'lien_entreprise_perime'
  | 'lien_entreprise_non_renseigne'
  | 'convention_liee_non_autorisee'
  | 'avis_conseil_syndical_aj_absent'
  | 'date_decision_non_renseignee'
  | 'mode_financement_non_precise'
  | 'avis_conseil_syndical_non_enregistre'
  | 'mise_en_concurrence_non_justifiee'
  | 'fondement_non_renseigne'
  | 'fondement_sans_reference'
  | 'urgence_suites'
  | 'delegation_cs_absente'
  | 'majorite_resolution_non_renseignee'
  | 'delai_contestation_inconnu'
  | 'execution_suspendue_art42'
  | 'devis_caduc'
  | 'devis_trop_ancien'
  | 'date_devis_inconnue'
  | 'controle_declaratif_non_fait'
  | 'controle_declaratif_impossible'

export interface AnomalieEnvoiOs {
  /** Code du point 44, ou code du contrôle déclaratif de l'entreprise (vigilance-entreprises.ts). */
  code: CodeAnomalieEnvoiOs | CodeAnomalieEntreprise
  gravite: 'bloquant' | 'alerte'
  message: string
  /** Texte qui fonde l'anomalie ; null pour une règle de gestion. */
  fondement: string | null
  aConfirmer: boolean
}

export interface ContexteEnvoiOs extends OptionsVisa {
  /** Date de l'envoi. */
  date: string
  /** Pièces de l'entreprise pour le contrôle déclaratif (intervention). */
  pieces?: PiecesEntreprise
  controle?: Partial<Omit<OptionsControleDeclaratif, 'moment' | 'date'>>
  /** Le prestataire a un compte VitFix (canal messagerie). */
  prestataireAvecCompteVitfix?: boolean
  /** L'entreprise a communiqué son adresse électronique (canal courriel) ; null ou absent : on ne sait pas. */
  courrielCommunique?: boolean | null
  /** L'entreprise a communiqué un numéro pour recevoir des SMS (canal sms) ; null ou absent : on ne sait pas. */
  smsCommunique?: boolean | null
  /**
   * Collaborateurs habilités par le cabinet à signer un OS (décision de Hugo du 03/11/2026 : un collaborateur peut signer,
   * pas seulement l'administrateur désigné) : réglage du cabinet, fourni par l'appelant ; absent : non contrôlé. Fournie,
   * la liste vaut pour tout signataire autre que l'administrateur désigné (administrateurDesigneId) : vide, elle ne laisse
   * signer que lui, et bloque tout envoi quand il n'est pas fourni.
   */
  signatairesHabilites?: ReadonlySet<string>
  /**
   * Collaborateur du cabinet qui est l'administrateur provisoire désigné pour ce mandat par la décision du président du
   * tribunal judiciaire (L. 1965 art. 29-1, I), fourni par l'appelant depuis le mandat, jamais depuis le réglage du
   * cabinet : un administrateur du cabinet qui n'est pas désigné pour ce mandat n'y signe que s'il figure dans
   * signatairesHabilites. Il signe toujours, même hors de signatairesHabilites (décision 8 : « pas seulement
   * l'administrateur désigné »), et constate l'urgence sans alerte (décision 6) ; absent : seule la liste compte.
   */
  administrateurDesigneId?: string | null
  /** Fin de validité du devis associé, fixée par l'entreprise. */
  validiteDevisAu?: string | null
  /**
   * Date du devis associé (décision J47 : caduc un an après elle, MOIS_CADUCITE_DEVIS_OS) ; null ou absent : inconnue,
   * alerte date_devis_inconnue sans blocage.
   */
  dateDevis?: string | null
  /** Segment mandat de la séquence des N° (SegmentsNumeroOs.mandat) ; absent : non contrôlé. */
  segmentMandat?: string
  /** N° des autres demandes du mandat (doublons) ; absent : non contrôlé. */
  numerosDuMandat?: readonly Pick<Demande, 'id' | 'numero'>[]
  /**
   * Fin du délai de contestation de l'assemblée dont la résolution est exécutée (échéance retenue par finDelaiContestationAg,
   * statut-assemblee.ts) ; null ou absent : non calculée.
   */
  finDelaiContestationAg?: string | null
}

type Gravite = AnomalieEnvoiOs['gravite']

const anomalie = (
  code: AnomalieEnvoiOs['code'],
  gravite: Gravite,
  message: string,
  fondement: string | null = null,
  aConfirmer = false,
): AnomalieEnvoiOs => ({ code, gravite, message, fondement, aConfirmer })

function anomaliesNumero(d: Demande, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  const numero = d.numero
  if (numero === null)
    return [anomalie('numero_absent', 'bloquant', "N° d'ordre de service absent : numéroter la demande dans la séquence du mandat avant l'envoi.")]
  const anomalies: AnomalieEnvoiOs[] = []
  const lu = lireNumeroOs(numero)
  if (lu === null)
    anomalies.push(
      anomalie('numero_hors_sequence', 'alerte', `N° « ${numero} » hors du format <mandat>.<plan>.<rang> : repris d'ailleurs, il reste hors de la séquence du mandat.`),
    )
  else if (contexte.segmentMandat !== undefined && lu.mandat !== contexte.segmentMandat)
    anomalies.push(
      anomalie('numero_hors_sequence', 'alerte', `N° « ${numero} » du segment mandat « ${lu.mandat} » : hors de la séquence du mandat (« ${contexte.segmentMandat} »).`),
    )
  const doublon = contexte.numerosDuMandat?.find((autre) => autre.id !== d.id && autre.numero?.trim() === numero)
  if (doublon) anomalies.push(anomalie('numero_en_double', 'alerte', `N° « ${numero} » déjà porté par la demande ${doublon.id} du mandat.`))
  return anomalies
}

/** Champ du corps de la route tiré de la demande, borné par ajOrdrePrestataireSchema (lib/validation.ts). */
interface ChampCorpsMessagerie {
  /** Nom du champ dans le corps. */
  champ: 'reference_aj' | 'objet'
  libelle: string
  lire: (d: Demande) => string | null
  /** Longueur maximale, après suppression des espaces de début et de fin (comme le schéma). */
  max: number
  /** Champ requis : vide, la route refuse le corps ; null : facultatif (ou contrôlé ailleurs, comme le N° : numero_absent). */
  absent: { code: CodeAnomalieEnvoiOs; conseil: string } | null
  tropLong: { code: CodeAnomalieEnvoiOs; conseil: string }
}

const CHAMPS_CORPS_MESSAGERIE: readonly ChampCorpsMessagerie[] = [
  {
    champ: 'reference_aj',
    libelle: "N° d'OS",
    lire: (d) => d.numero,
    max: LONGUEUR_MAX_NUMERO_OS,
    absent: null,
    tropLong: { code: 'numero_trop_long', conseil: 'choisir un autre canal ou un N° plus court' },
  },
  {
    champ: 'objet',
    libelle: 'Objet',
    lire: (d) => d.objet,
    max: LONGUEUR_MAX_OBJET_OS,
    absent: { code: 'objet_absent', conseil: "saisir l'objet de la demande" },
    tropLong: { code: 'objet_trop_long', conseil: "choisir un autre canal ou raccourcir l'objet de la demande" },
  },
]

interface ChampRefuse {
  code: CodeAnomalieEnvoiOs
  /** Constat, sans conseil. */
  constat: string
  conseil: string
}

/** Champs de la demande que la route refuserait dans le corps de la messagerie VitFix (vides et requis, ou trop longs). */
function champsRefusesParLaRoute(d: Demande): ChampRefuse[] {
  return CHAMPS_CORPS_MESSAGERIE.flatMap(({ champ, libelle, lire, max, absent, tropLong }): ChampRefuse[] => {
    const longueur = (lire(d) ?? '').trim().length
    if (longueur === 0 && absent) return [{ ...absent, constat: `${libelle} absent : la messagerie VitFix l'exige (${champ})` }]
    if (longueur <= max) return []
    return [{ ...tropLong, constat: `${libelle} de ${longueur} caractères : la messagerie VitFix en accepte ${max} au plus (${champ})` }]
  })
}

/** Corps de la messagerie VitFix : bloquant pour chaque champ que la route refuserait. */
function anomaliesCorpsMessagerie(d: Demande, canal: CanalEnvoiOs | null): AnomalieEnvoiOs[] {
  if (canal !== 'messagerie_vitfix') return []
  return champsRefusesParLaRoute(d).map(({ code, constat, conseil }) => anomalie(code, 'bloquant', `${constat} ; ${conseil}.`))
}

function anomaliesDemande(d: Demande, canal: CanalEnvoiOs | null, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  const anomalies: AnomalieEnvoiOs[] = []
  if (d.statut === 'Terminé' || estRefusee(d)) anomalies.push(anomalie('demande_close', 'bloquant', `Demande ${d.id} terminée ou refusée : aucun ordre de service à envoyer.`))
  anomalies.push(...anomaliesNumero(d, contexte), ...anomaliesCorpsMessagerie(d, canal))
  if (d.prestataireId === null) anomalies.push(anomalie('entreprise_absente', 'bloquant', "Entreprise absente : choisir le destinataire de l'ordre de service."))
  return anomalies
}

/** Coordonnée électronique exigée par un canal (C. civ. art. 1126, 1127, al. 1). */
interface ControleCoordonnee {
  communiquee: (contexte: ContexteEnvoiOs) => boolean | null | undefined
  absente: { code: CodeAnomalieEnvoiOs; message: string }
  aVerifier: { code: CodeAnomalieEnvoiOs; message: string }
  fondement: string
}

const COORDONNEE_PAR_CANAL: ReadonlyMap<CanalEnvoiOs, ControleCoordonnee> = new Map<CanalEnvoiOs, ControleCoordonnee>([
  [
    'courriel',
    {
      communiquee: (contexte) => contexte.courrielCommunique,
      absente: { code: 'courriel_non_communique', message: "L'entreprise n'a pas communiqué d'adresse électronique : envoi par courriel impossible." },
      aVerifier: { code: 'courriel_a_verifier', message: "Vérifier que l'entreprise a communiqué son adresse électronique avant l'envoi par courriel." },
      fondement: FONDEMENT_COURRIEL,
    },
  ],
  [
    'sms',
    {
      communiquee: (contexte) => contexte.smsCommunique,
      absente: { code: 'sms_non_communique', message: "L'entreprise n'a pas communiqué de numéro pour recevoir des SMS : envoi par SMS impossible." },
      aVerifier: { code: 'sms_a_verifier', message: "Vérifier que l'entreprise a communiqué un numéro pour recevoir des SMS avant l'envoi par SMS." },
      fondement: FONDEMENT_SMS,
    },
  ],
])

function anomaliesCanal(canal: CanalEnvoiOs | null, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  if (canal === 'messagerie_vitfix' && contexte.prestataireAvecCompteVitfix === false)
    return [anomalie('sans_compte_vitfix', 'bloquant', "Prestataire sans compte VitFix : choisir un autre canal (courriel, courrier).")]
  const controle = canal === null ? undefined : COORDONNEE_PAR_CANAL.get(canal)
  if (!controle) return []
  const communiquee = controle.communiquee(contexte)
  if (communiquee === true) return []
  if (communiquee === false) return [anomalie(controle.absente.code, 'bloquant', controle.absente.message, controle.fondement, true)]
  return [anomalie(controle.aVerifier.code, 'alerte', controle.aVerifier.message, controle.fondement, true)]
}

/**
 * Jour où l'avis doit être recueilli : celui de la décision au registre (D. 1967 art. 62-8), au plus tard celui de l'envoi
 * (une décision datée après l'envoi bloque celui-ci : decision_posterieure_envoi).
 */
const borneAvisAj = (s: SortieOrdreService, date: string): string => (s.decisionLe !== null && s.decisionLe < date ? s.decisionLe : date)

/** Avis du conseil syndical enregistré au plus tard le jour de la décision au registre (borneAvisAj). */
function avisRecueilliATemps(s: SortieOrdreService, date: string): boolean {
  const avisLe = s.justificatifs.avisConseilSyndicalLe
  return avisLe !== null && avisLe <= borneAvisAj(s, date)
}

/** L'avis préalable de D. 1967 art. 62-7 vaut pour cet OS : intervention décidée au titre des pouvoirs de l'assemblée. */
const avisAjApplicable = (d: Pick<Demande, 'type'>, s: Pick<SortieOrdreService, 'fondement'>): boolean =>
  d.type === 'intervention' && s.fondement === 'decision_aj_pouvoirs_ag'

/**
 * Ce que l'urgence non retenue laisse dû, seulement quand cela s'applique : l'avis préalable (D. 1967 art. 62-7) pour une
 * intervention au titre des pouvoirs de l'assemblée, la suspension (L. 1965 art. 42, al. 3) pour l'exécution d'une
 * résolution votée à la majorité de l'art. 25 ou 26 ; null sinon.
 */
function consequenceSansUrgence(d: Demande, s: SortieOrdreService): string | null {
  if (avisAjApplicable(d, s)) return "l'avis préalable du conseil syndical reste exigé (D. 1967 art. 62-7)"
  const article = s.majoriteResolution === null ? undefined : MAJORITES_SUSPENSIVES.get(s.majoriteResolution)
  if (d.type !== 'intervention' || s.fondement !== 'execution_resolution_ag' || article === undefined) return null
  return `l'exécution des travaux votés à la majorité de l'${article} reste suspendue pendant le délai de contestation (L. 1965 art. 42, al. 3)`
}

function urgenceNonRetenue(d: Demande, s: SortieOrdreService): string {
  const consequence = consequenceSansUrgence(d, s)
  return consequence === null ? "l'urgence n'est pas retenue" : `l'urgence n'est pas retenue : ${consequence}`
}

/**
 * Constat lisible daté après l'envoi : le jour de l'envoi, il n'existe pas encore et ne dispense de rien (décision J46 de
 * Hugo du 06/11/2026, tous fondements et tous délais : constat_urgence_posterieur_envoi, bloquant).
 */
const constatApresEnvoi = (c: ConstatUrgence | null, date: string): c is ConstatUrgence =>
  c !== null && estDateIsoValide(c.constateLe) && c.constateLe > date

/**
 * Constat qui tient lieu de l'avis du conseil syndical (intervention au titre des pouvoirs de l'assemblée, avis non
 * enregistré à temps) daté après la décision au registre (borneAvisAj), au plus tard le jour de l'envoi : alerte à
 * confirmer (décision J46 de Hugo du 06/11/2026). Daté après l'envoi, il bloque celui-ci
 * (anomaliesChronologie) ; ailleurs, sa date n'est comparée qu'à celle de l'envoi.
 */
function constatTardif(d: Demande, s: SortieOrdreService, constat: ConstatUrgence, date: string): AnomalieEnvoiOs[] {
  if (!avisAjApplicable(d, s) || avisRecueilliATemps(s, date)) return []
  // constat complet (date lisible) ; borne < constat ≤ envoi : la borne précède l'envoi, c'est la décision au registre
  const borne = borneAvisAj(s, date)
  if (constat.constateLe <= borne || constat.constateLe > date) return []
  return [
    anomalie(
      'constat_urgence_posterieur',
      'alerte',
      `Urgence constatée le ${fr(constat.constateLe)}, après la décision au registre du ${fr(borne)} : le constat tient lieu de l'avis préalable du conseil syndical, qui précède la décision ; à confirmer : un constat postérieur en dispense-t-il ? Sinon, enregistrer l'avis s'il a été recueilli au plus tard ce jour-là, ou corriger la date du constat.`,
      FONDEMENT_AVIS_AJ,
      true,
    ),
  ]
}

/**
 * Urgence (décision de Hugo du 03/11/2026) : retenue avec le délai « urgence » (ou le fondement « urgence de sauvegarde »)
 * ET le constat complet de l'administrateur provisoire ; un constat sans délai « urgence » ne lève rien.
 */
function anomaliesUrgence(d: Demande, s: SortieOrdreService, date: string): AnomalieEnvoiOs[] {
  const demandee = urgenceDemandee(s)
  const constat = s.constatUrgence
  if (demandee && !constatComplet(constat))
    return [
      anomalie(
        'urgence_non_constatee',
        'alerte',
        `Urgence sans constat complet de l'administrateur provisoire (manque : ${manquesConstat(constat).join(', ')}) : dater, motiver et attribuer le constat ; sans lui, ${urgenceNonRetenue(d, s)}.`,
        'L. 1965 art. 18, I',
      ),
    ]
  if (!demandee && constat !== null)
    return [
      anomalie(
        'constat_urgence_sans_urgence',
        'alerte',
        `Urgence constatée avec le délai « ${s.delai} » : ${urgenceNonRetenue(d, s)} ; choisir le délai « urgence » ou effacer le constat.`,
        null,
        true,
      ),
    ]
  return constat === null ? [] : constatTardif(d, s, constat, date)
}

/**
 * Collaborateur hors des signataires habilités (décision 8) : ni l'administrateur désigné (administrateurDesigneId), qui
 * signe toujours, ni un collaborateur de la liste du cabinet (signatairesHabilites) ; liste non fournie : non contrôlé.
 */
function horsDesHabilites(collaborateurId: string, contexte: ContexteEnvoiOs): boolean {
  const habilites = contexte.signatairesHabilites
  if (habilites === undefined || collaborateurId === texteOuNull(contexte.administrateurDesigneId)) return false
  return !habilites.has(collaborateurId)
}

/**
 * Signataire de l'OS (décision de Hugo du 03/11/2026 : un collaborateur peut signer, pas seulement l'administrateur
 * désigné ; décision rendue sur L. 1965 art. 18, IV et art. 29-1, I, lus comme ne faisant pas de cette signature une
 * substitution, 🔵) : absent, bloquant ; ni administrateur désigné ni dans la liste du cabinet (horsDesHabilites ; liste
 * non fournie : non contrôlé), bloquant ; le contrôle par la liste du cabinet est une règle de gestion, sans texte
 * (fondement null).
 */
function anomaliesSignataire(s: SortieOrdreService, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  if (s.signataireId === null) return [anomalie('signataire_absent', 'bloquant', 'Signataire pour le cabinet absent.')]
  if (!horsDesHabilites(s.signataireId, contexte)) return []
  return [
    anomalie(
      'signataire_non_habilite',
      'bloquant',
      `Signataire ${s.signataireId} hors des collaborateurs habilités par le cabinet à signer un OS (réglage du cabinet) : choisir un collaborateur habilité, ou l'ajouter à la liste du cabinet.`,
    ),
  ]
}

/**
 * Auteur du constat d'urgence hors des signataires habilités (interprétation des décisions 6 et 8, à confirmer : il agit
 * au nom de l'administrateur provisoire, comme le signataire) : alerte à confirmer, sans blocage ni effet sur l'urgence.
 */
function anomaliesAuteurConstat(s: SortieOrdreService, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  const auteur = texteOuNull(s.constatUrgence?.collaborateurId)
  if (auteur === null || !horsDesHabilites(auteur, contexte)) return []
  return [
    anomalie(
      'constat_urgence_auteur_non_habilite',
      'alerte',
      `Urgence constatée par ${auteur}, hors des collaborateurs habilités par le cabinet à signer un OS : à confirmer (interprétation des décisions 6 et 8) : l'auteur du constat, qui agit au nom de l'administrateur provisoire comme le signataire, doit-il être un signataire habilité ? Ce signalement ne change pas l'urgence retenue.`,
      null,
      true,
    ),
  ]
}

function anomaliesSortie(d: Demande, s: SortieOrdreService, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  const anomalies = anomaliesSignataire(s, contexte)
  if (s.canal === null) anomalies.push(anomalie('canal_absent', 'bloquant', "Canal d'envoi absent (messagerie VitFix, courriel, courrier…)."))
  if (!s.diffusable) anomalies.push(anomalie('non_diffusable', 'bloquant', 'Ordre de service non diffusable : cocher « Diffusable » pour l’envoyer.'))
  return [
    ...anomalies,
    ...anomaliesChronologie(d, s, contexte.date),
    ...anomaliesUrgence(d, s, contexte.date),
    ...anomaliesAuteurConstat(s, contexte),
    ...anomaliesCanal(s.canal, contexte),
  ]
}

/**
 * Dates de la sortie face à l'envoi : relance antérieure ; décision qui fonde l'OS (résolution, procès-verbal du conseil
 * syndical, registre des décisions de l'administrateur provisoire, mentionnées à leur date : D. 1967 art. 62-8)
 * postérieure ; constat d'urgence postérieur (le jour de l'envoi, il n'existe pas encore : décision 6, sans constat,
 * l'urgence n'est pas retenue).
 */
function anomaliesChronologie(d: Demande, s: SortieOrdreService, date: string): AnomalieEnvoiOs[] {
  const anomalies: AnomalieEnvoiOs[] = []
  if (s.relanceLe !== null && s.relanceLe < date)
    anomalies.push(anomalie('relance_avant_envoi', 'bloquant', `Date de relance (${fr(s.relanceLe)}) antérieure à l'envoi du ${fr(date)} : la reporter (fixerRelance).`))
  if (s.decisionLe !== null && s.decisionLe > date)
    anomalies.push(
      anomalie(
        'decision_posterieure_envoi',
        'bloquant',
        `Décision qui fonde l'ordre de service datée du ${fr(s.decisionLe)}, après l'envoi du ${fr(date)} : l'OS ne part pas avant la décision qui le fonde ; corriger la date de la décision, ou attendre qu'elle soit prise.`,
        s.fondement === null ? null : CADRE_PAR_FONDEMENT[s.fondement].texte,
      ),
    )
  const constat = s.constatUrgence
  if (constatApresEnvoi(constat, date))
    anomalies.push(
      anomalie(
        'constat_urgence_posterieur_envoi',
        'bloquant',
        `Urgence constatée le ${fr(constat.constateLe)}, après l'envoi du ${fr(date)} : le jour de l'envoi, ce constat n'existe pas encore, ${urgenceNonRetenue(d, s)} ; corriger la date du constat (au plus tard le jour de l'envoi) ou l'effacer.`,
      ),
    )
  return anomalies
}

/** Visa de l'OS avant l'envoi : le contrôle commun aux pièces de sortie (anomaliesCircuitVisa), bloquant. */
const anomaliesVisa = (d: Demande, s: SortieOrdreService, motifs: readonly MotifVisa[]): AnomalieEnvoiOs[] =>
  anomaliesCircuitVisa(s, pieceOs(d), motifs).map((a) => anomalie(a.code, 'bloquant', a.message))

function anomaliesConvention(d: Demande, s: SortieOrdreService, codes: ReadonlySet<CodeMotifVisa>): AnomalieEnvoiOs[] {
  if (lienPerime(d, s))
    return [
      anomalie(
        'lien_entreprise_perime',
        'bloquant',
        `Lien avec le syndic déclaré pour l'entreprise ${s.entrepriseLieeDeclareePour ?? '(aucune)'}, alors que l'ordre de service part à ${d.prestataireId ?? '(aucune)'} : redire si la convention avec cette entreprise est liée (modifierSortieOs).`,
        FONDEMENT_LIEN,
      ),
    ]
  if (s.entrepriseLiee === null)
    return [
      anomalie(
        'lien_entreprise_non_renseigne',
        'alerte',
        "Dire si la convention est passée avec le syndic, ses préposés, son conjoint, le partenaire lié à lui par un pacte civil de solidarité, son concubin, ses parents ou alliés jusqu'au deuxième degré inclus, ou avec une entreprise dont ces personnes sont propriétaires ou détiennent une participation dans son capital, dans laquelle elles exercent des fonctions de direction ou de contrôle, ou dont elles sont salariées ou préposées ; ou, pour un syndic personne morale, avec une entreprise qui détient une participation dans son capital.",
        FONDEMENT_LIEN,
        true,
      ),
    ]
  if (!codes.has('convention_liee') || autorisationConvention(d, s) !== null) return []
  const message = autorisationPourAutre(s, d.prestataireId)
    ? `Autorisation de l'assemblée (« ${s.justificatifs.autorisationConventionLiee} ») saisie pour l'entreprise ${s.autorisationConventionLieePour ?? '(aucune)'}, alors que l'ordre de service part à ${d.prestataireId ?? '(aucune)'} : elle ne vaut pas pour la convention avec cette entreprise, inopposable au syndicat sans autorisation spéciale de l'assemblée ; saisir la résolution qui l'autorise.`
    : "Convention liée sans autorisation spéciale de l'assemblée : inopposable au syndicat ; saisir la résolution qui l'autorise."
  return [anomalie('convention_liee_non_autorisee', 'bloquant', message, FONDEMENT_CONVENTION_LIEE)]
}

/** Consultation du conseil syndical par l'administrateur provisoire (D. 1967 art. 62-7, al. 1 et 3 ; art. 62-8). */
function anomaliesAvisAj(s: SortieOrdreService, date: string): AnomalieEnvoiOs[] {
  const anomalies: AnomalieEnvoiOs[] = []
  if (!avisRecueilliATemps(s, date))
    anomalies.push(
      anomalie(
        'avis_conseil_syndical_aj_absent',
        'bloquant',
        "Avis du conseil syndical non recueilli avant la décision de l'administrateur provisoire (ou urgence non constatée : délai « urgence » et constat de l'administrateur provisoire, daté, motivé et attribué).",
        FONDEMENT_AVIS_AJ,
        true,
      ),
    )
  if (s.decisionLe === null)
    anomalies.push(
      anomalie(
        'date_decision_non_renseignee',
        'alerte',
        "Date de la décision au registre non saisie : l'avis du conseil syndical est comparé à la date de l'envoi, alors qu'il doit précéder la décision.",
        'D. 1967 art. 62-7, 62-8',
        true,
      ),
    )
  if (s.justificatifs.modeFinancement === null)
    anomalies.push(
      anomalie('mode_financement_non_precise', 'alerte', 'Mode de financement de la décision non précisé lors de la consultation du conseil syndical.', 'D. 1967 art. 62-7, al. 3', true),
    )
  return anomalies
}

function anomaliesMiseEnConcurrence(s: SortieOrdreService): AnomalieEnvoiOs[] {
  const { devisDemandes, devisExigesParAssemblee } = s.justificatifs
  const demandes = devisDemandes ?? 0
  if (devisExigesParAssemblee !== null)
    return demandes >= devisExigesParAssemblee
      ? []
      : [
          anomalie(
            'mise_en_concurrence_non_justifiee',
            'alerte',
            `Mise en concurrence obligatoire à partir du seuil fixé par l'assemblée : ${devisExigesParAssemblee} devis à demander selon ses conditions ; nombre de devis demandés : ${demandes}.`,
            FONDEMENT_CONDITIONS_AG,
            true,
          ),
        ]
  if (demandes >= NOMBRE_MIN_DEVIS_CONCURRENCE) return []
  return [
    anomalie(
      'mise_en_concurrence_non_justifiee',
      'alerte',
      `Mise en concurrence obligatoire à partir du seuil fixé par l'assemblée : sans conditions fixées par elle, demander plusieurs devis (au moins ${NOMBRE_MIN_DEVIS_CONCURRENCE}) ou soumettre un devis descriptif à plusieurs entreprises ; nombre de devis demandés : ${demandes}.`,
      FONDEMENT_CONCURRENCE,
      true,
    ),
  ]
}

function anomaliesConseilSyndical(s: SortieOrdreService, codes: ReadonlySet<CodeMotifVisa>, date: string): AnomalieEnvoiOs[] {
  const anomalies = codes.has('avis_conseil_syndical_aj') ? anomaliesAvisAj(s, date) : []
  const avisLe = s.justificatifs.avisConseilSyndicalLe
  if (codes.has('consultation_conseil_syndical') && (avisLe === null || avisLe > date))
    anomalies.push(
      anomalie(
        'avis_conseil_syndical_non_enregistre',
        'alerte',
        "Consultation du conseil syndical obligatoire à partir du seuil fixé par l'assemblée : avis non enregistré.",
        FONDEMENT_CONSULTATION,
        true,
      ),
    )
  if (codes.has('mise_en_concurrence')) anomalies.push(...anomaliesMiseEnConcurrence(s))
  return anomalies
}

const delegueAuConseilSyndical = (decision: DecisionAnnuelle): boolean =>
  decision.type === 'delegation_generale_cs' || (decision.type === 'delegation_art25a' && decision.delegataire === 'conseil_syndical')

/** Délégation de pouvoirs au conseil syndical dans les décisions d'assemblée fournies (absentes : non contrôlé). */
function anomaliesDelegationCs(decisions: readonly DecisionAnnuelle[] | undefined): AnomalieEnvoiOs[] {
  if (!decisions || decisions.some(delegueAuConseilSyndical)) return []
  return [
    anomalie(
      'delegation_cs_absente',
      'alerte',
      "Aucune délégation de pouvoirs au conseil syndical dans les décisions d'assemblée en vigueur fournies (délégation générale de deux ans au plus, renouvelable par décision expresse, ou délégation de l'art. 25 a) : vérifier qu'elle était en vigueur à la date de la décision du conseil syndical.",
      FONDEMENT_DELEGATION_CS,
      true,
    ),
  ]
}

/** Suspension de l'exécution des travaux votés aux art. 25 et 26 pendant le délai de contestation, sauf urgence. */
function anomaliesSuspensionArt42(d: Demande, s: SortieOrdreService, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  if (s.majoriteResolution === null)
    return [
      anomalie(
        'majorite_resolution_non_renseignee',
        'alerte',
        "Majorité de la résolution exécutée non renseignée : sauf urgence, les travaux votés aux art. 25 et 26 ne s'exécutent pas avant la fin du délai de contestation.",
        FONDEMENT_SUSPENSION,
        true,
      ),
    ]
  const article = MAJORITES_SUSPENSIVES.get(s.majoriteResolution)
  if (article === undefined || urgenceConstatee(s)) return []
  const fin = contexte.finDelaiContestationAg ?? null
  if (fin === null)
    return [
      anomalie(
        'delai_contestation_inconnu',
        'alerte',
        `Résolution votée à la majorité de l'${article} : fin du délai de contestation non calculée, vérifier que l'intervention ne tombe pas pendant la suspension de l'exécution.`,
        FONDEMENT_SUSPENSION,
        true,
      ),
    ]
  const execution = d.prevuLe ?? contexte.date
  if (execution > fin) return []
  return [
    anomalie(
      'execution_suspendue_art42',
      'bloquant',
      `Travaux votés à la majorité de l'${article} : exécution suspendue jusqu'à la fin du délai de contestation (${fr(fin)} inclus), sauf urgence constatée ; intervention au ${fr(execution)}.`,
      FONDEMENT_SUSPENSION,
      true,
    ),
  ]
}

function anomaliesFondement(d: Demande, s: SortieOrdreService, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  if (s.fondement === null)
    return [anomalie('fondement_non_renseigne', 'alerte', "Fondement de l'OS non renseigné (résolution, conseil syndical, entretien, urgence…).", null, true)]
  const cadre = CADRE_PAR_FONDEMENT[s.fondement]
  const anomalies: AnomalieEnvoiOs[] = []
  if (cadre.referenceAttendue && s.fondementReference === null)
    anomalies.push(anomalie('fondement_sans_reference', 'alerte', `OS en ${cadre.libelle} : référence de la décision à saisir.`, cadre.texte))
  if (s.fondement === 'urgence_sauvegarde')
    anomalies.push(
      anomalie(
        'urgence_suites',
        'alerte',
        "Travaux urgents de sa propre initiative : informer les copropriétaires et convoquer immédiatement une assemblée ; en vue de l'ouverture du chantier et de son premier approvisionnement, provision d'au plus le tiers du devis estimatif, sans délibération préalable de l'assemblée mais après avis du conseil syndical s'il en existe un.",
        'D. 1967 art. 37',
      ),
    )
  if (s.fondement === 'decision_conseil_syndical') anomalies.push(...anomaliesDelegationCs(contexte.decisionsAgEnVigueur))
  if (s.fondement === 'execution_resolution_ag') anomalies.push(...anomaliesSuspensionArt42(d, s, contexte))
  return anomalies
}

/** Cadre légal du marché (intervention seulement) : convention liée, conseil syndical, mise en concurrence, fondement. */
function anomaliesCadreLegal(d: Demande, s: SortieOrdreService, motifs: readonly MotifVisa[], contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  if (d.type !== 'intervention') return []
  const codes = new Set(motifs.map((m) => m.code))
  return [...anomaliesConvention(d, s, codes), ...anomaliesConseilSyndical(s, codes, contexte.date), ...anomaliesFondement(d, s, contexte)]
}

/** Devis associé échu avant que l'OS parvienne à l'entreprise (le jour même, sauf courrier : dès le jour de l'envoi). */
function anomaliesDevisAssocie(d: Demande, s: SortieOrdreService, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  const validiteAu = contexte.validiteDevisAu ?? null
  if (d.devisAssocie === null || validiteAu === null) return []
  const papier = s.canal !== null && CANAUX_PAPIER.has(s.canal)
  if (papier && validiteAu <= contexte.date)
    return [
      anomalie(
        'devis_caduc',
        'alerte',
        `Devis associé valable jusqu'au ${fr(validiteAu)} : un courrier posté le ${fr(contexte.date)} ne parvient pas à l'entreprise avant l'échéance ; le devis sera caduc à la réception, l'OS vaudra offre nouvelle, à faire accepter par l'entreprise.`,
        FONDEMENT_CADUCITE,
        true,
      ),
    ]
  if (validiteAu >= contexte.date) return []
  return [
    anomalie(
      'devis_caduc',
      'alerte',
      `Devis associé valable jusqu'au ${fr(validiteAu)} : échu avant que l'OS parvienne à l'entreprise, il ne forme plus le contrat ; l'OS vaut offre nouvelle, à faire accepter par l'entreprise.`,
      FONDEMENT_CADUCITE,
    ),
  ]
}

/**
 * Ancienneté du devis accepté par l'OS (décision J47 de Hugo du 06/11/2026) : le devis devient caduc un an après sa date
 * (MOIS_CADUCITE_DEVIS_OS, règle du cabinet, fondement null) ; daté de plus d'un an à la date de l'envoi, l'OS est refusé
 * (bloquant : un nouveau devis est nécessaire). Bornes (🔵 : lecture de « daté de plus d'un an » et de dates.ajouterMois,
 * à confirmer par Hugo) : un devis daté d'un an pile (même quantième) est encore accepté le jour anniversaire ; sans
 * quantième identique, le dernier jour du mois : le devis du 29 février a un an le 28 février suivant. Date du devis
 * inconnue : alerte, sans blocage. Intervention seulement : une demande de devis n'accepte aucun devis (🔵).
 */
function anomaliesAncienneteDevis(d: Demande, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  if (d.type !== 'intervention' || d.devisAssocie === null) return []
  const devisLe = contexte.dateDevis ?? null
  if (devisLe === null)
    return [
      anomalie(
        'date_devis_inconnue',
        'alerte',
        `Date du devis inconnue : l'ancienneté du devis associé n'est pas contrôlée ; un devis daté de plus de ${MOIS_CADUCITE_DEVIS_OS} mois à l'envoi ne peut plus être accepté par l'OS (un nouveau devis est nécessaire) : renseigner la date du devis.`,
      ),
    ]
  const valableJusquAu = ajouterMois(devisLe, MOIS_CADUCITE_DEVIS_OS)
  if (contexte.date <= valableJusquAu) return []
  return [
    anomalie(
      'devis_trop_ancien',
      'bloquant',
      `Devis associé du ${fr(devisLe)}, daté de plus de ${MOIS_CADUCITE_DEVIS_OS} mois à l'envoi du ${fr(contexte.date)} (caduc après le ${fr(valableJusquAu)}, règle du cabinet) : il ne peut plus être accepté par l'OS ; un nouveau devis est nécessaire.`,
    ),
  ]
}

const depuisAnomalieEntreprise = (a: AnomalieEntreprise): AnomalieEnvoiOs => anomalie(a.code, a.gravite, a.message, a.fondement, a.aConfirmer)

/** Pourquoi l'absence des pièces de l'entreprise bloque l'envoi (point 37 : vigilance, décennale) ; null : simple alerte. */
function blocageSansPieces(d: Demande, contexte: ContexteEnvoiOs): { raison: string; fondement: string } | null {
  if (contexte.controle?.decennaleObligatoire === true) return { raison: "les travaux sont soumis à l'assurance décennale obligatoire", fondement: FONDEMENT_DECENNALE }
  let montant: number | null
  try {
    montant = montantHtOperationDemande(d, contexte.controle?.montantHtOperationCentimes)
  } catch (erreur) {
    return { raison: `le montant HT de l'opération n'est pas établi (${messageErreur(erreur)})`, fondement: FONDEMENT_VIGILANCE }
  }
  if (montant === null) return { raison: "le montant HT de l'opération est inconnu (seuil de vigilance non appréciable)", fondement: FONDEMENT_VIGILANCE }
  if (montant >= SEUIL_VIGILANCE_HT_CENTIMES)
    return { raison: `l'opération de ${euros(montant)} HT atteint le seuil de vigilance (${euros(SEUIL_VIGILANCE_HT_CENTIMES)} HT)`, fondement: FONDEMENT_VIGILANCE }
  return null
}

/** Contrôle déclaratif de l'entreprise avant l'OS (point 37, via demandes.ts) ; une saisie impossible bloque l'envoi. */
function anomaliesControleDeclaratif(d: Demande, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  if (d.type !== 'intervention' || d.prestataireId === null) return []
  if (!contexte.pieces) {
    const blocage = blocageSansPieces(d, contexte)
    if (blocage)
      return [
        anomalie(
          'controle_declaratif_non_fait',
          'bloquant',
          `Contrôle déclaratif de l'entreprise non fait alors que ${blocage.raison} : fournir ses pièces (vigilance, décennale) avant l'envoi.`,
          blocage.fondement,
          true,
        ),
      ]
    return [anomalie('controle_declaratif_non_fait', 'alerte', "Contrôle déclaratif de l'entreprise non fait : fournir ses pièces (vigilance, décennale) avant l'envoi.")]
  }
  const options: OptionsControleDeclaratif = {
    ...contexte.controle,
    moment: 'ordre_de_service',
    date: contexte.date,
    decennaleObligatoire: contexte.controle?.decennaleObligatoire ?? null,
  }
  try {
    return controleDeclaratifDemande(d, contexte.pieces, options).map(depuisAnomalieEntreprise)
  } catch (erreur) {
    return [anomalie('controle_declaratif_impossible', 'bloquant', `Contrôle déclaratif impossible : ${messageErreur(erreur)}`)]
  }
}

/**
 * Contrôle avant l'envoi de l'OS : bloquants (l'envoi est refusé) et alertes. La route « envoyer » devra l'appeler avant
 * de créer la mission (branchement à faire).
 */
export function controlerAvantEnvoiOs(d: Demande, s: SortieOrdreService, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  verifierLien(d, s)
  if (!estDateIsoValide(contexte.date)) throw new Error(`Date de l'envoi invalide (${contexte.date}) : AAAA-MM-JJ attendu.`)
  verifierDate('Fin de validité du devis associé', contexte.validiteDevisAu)
  verifierDate('Date du devis associé', contexte.dateDevis)
  verifierDate('Fin du délai de contestation', contexte.finDelaiContestationAg)
  const motifs = motifsVisa(d, s, contexte)
  return [
    ...anomaliesDemande(d, s.canal, contexte),
    ...anomaliesSortie(d, s, contexte),
    ...anomaliesVisa(d, s, motifs),
    ...anomaliesCadreLegal(d, s, motifs, contexte),
    ...anomaliesDevisAssocie(d, s, contexte),
    ...anomaliesAncienneteDevis(d, contexte),
    ...anomaliesControleDeclaratif(d, contexte),
  ]
}

// ─── Envoi, journal de diffusion et relance ───────────────────────────────────────────────────

type PieceDePreuve = 'missionId' | 'courrierId'

/** Pièce qui prouve l'envoi selon le canal (🔵). */
const PREUVE_PAR_CANAL: ReadonlyMap<CanalEnvoiOs, PieceDePreuve> = new Map<CanalEnvoiOs, PieceDePreuve>([
  ['messagerie_vitfix', 'missionId'],
  ['courrier_ar', 'courrierId'],
])

function evenementDiffusion(s: SortieOrdreService, saisie: SaisieDiffusion, nature: NatureDiffusion): EvenementDiffusion {
  verifierHorodatage('Diffusion', saisie.date, saisie.heure)
  const collaborateurId = saisie.collaborateurId.trim()
  if (!collaborateurId) throw new Error('Diffusion : identifiant du collaborateur attendu.')
  if (!CANAUX.has(saisie.canal)) throw new Error(`Canal d'envoi inconnu : « ${saisie.canal} ».`)
  if (!DESTINATAIRES.has(saisie.destinataire.type))
    throw new Error(`Destinataire « ${saisie.destinataire.type} » : une fiche porteuse est attendue (${FICHES_PORTEUSES.join(', ')}).`)
  const evenement: EvenementDiffusion = {
    date: saisie.date,
    heure: saisie.heure,
    collaborateurId,
    canal: saisie.canal,
    destinataire: creerRattachement(saisie.destinataire.type, saisie.destinataire.id),
    nature,
    referenceDiffusion: texteOuNull(saisie.referenceDiffusion),
    courrierId: texteOuNull(saisie.courrierId),
    missionId: texteOuNull(saisie.missionId),
    ar: null,
  }
  const preuve = PREUVE_PAR_CANAL.get(evenement.canal)
  if (preuve && evenement[preuve] === null) throw new Error(`Diffusion par « ${evenement.canal} » : ${preuve} attendu (preuve de l'envoi).`)
  const dernier = s.journal.at(-1)
  if (dernier && horodatage(evenement) < horodatage(dernier))
    throw new Error(`Diffusion du ${horodatageFr(evenement)} antérieure à la dernière ligne du journal (${horodatageFr(dernier)}).`)
  return evenement
}

const ajouter = (s: SortieOrdreService, evenement: EvenementDiffusion): SortieOrdreService => ({ ...s, journal: [...s.journal, evenement] })

function verifierPremierEnvoi(d: Demande, s: SortieOrdreService, evenement: EvenementDiffusion, contexte: Omit<ContexteEnvoiOs, 'date'>): void {
  verifierSansBloquant(controlerAvantEnvoiOs(d, s, { ...contexte, date: evenement.date }), `OS ${d.numero ?? d.id} non envoyé`)
  if (evenement.destinataire.type !== 'Entreprise' || evenement.destinataire.id !== d.prestataireId)
    throw new Error(`Premier envoi : l'ordre de service part à l'entreprise de la demande (${d.prestataireId}).`)
  if (evenement.canal !== s.canal) throw new Error(`Premier envoi par « ${evenement.canal} » : le canal choisi est « ${s.canal ?? 'aucun'} ».`)
  const dernierVisa = s.historiqueVisa.at(-1)
  if (dernierVisa && horodatage(evenement) < horodatage(dernierVisa))
    throw new Error(
      `Premier envoi du ${horodatageFr(evenement)} antérieur au dernier événement du visa (${dernierVisa.action}, ${horodatageFr(dernierVisa)}) : le journal de preuve ne montre pas un OS parti avant son visa.`,
    )
}

function verifierRediffusion(d: Demande, s: SortieOrdreService): void {
  if (!s.diffusable) throw new Error(`OS ${d.numero ?? d.id} non diffusable : rediffusion impossible.`)
}

/**
 * Envoie l'OS (copie de la sortie, journal complété) : le premier envoi passe le contrôle avant l'envoi (contexte
 * obligatoire : pièces de l'entreprise, compte VitFix…) et part à l'entreprise par le canal choisi, jamais avant le dernier
 * événement du visa ; les suivants sont des rediffusions (copie, autre canal) d'un OS diffusable.
 */
export function envoyerOs(d: Demande, s: SortieOrdreService, saisie: SaisieDiffusion, contexte: Omit<ContexteEnvoiOs, 'date'>): SortieOrdreService {
  verifierLien(d, s)
  const dejaEnvoye = estEnvoye(s)
  const evenement = evenementDiffusion(s, saisie, dejaEnvoye ? 'rediffusion' : 'envoi')
  if (evenement.date < d.demandeLe)
    throw new Error(`Envoi du ${fr(evenement.date)} antérieur à la demande du ${fr(d.demandeLe)}.`)
  if (dejaEnvoye) verifierRediffusion(d, s)
  else verifierPremierEnvoi(d, s, evenement, contexte)
  return ajouter(s, evenement)
}

/** Ligne adressée à l'entreprise du premier envoi (relance, réception). */
function evenementVersEntreprise(s: SortieOrdreService, saisie: SaisieDiffusion, nature: NatureDiffusion, action: string): EvenementDiffusion {
  const envoi = premierEnvoi(s)
  if (!envoi) throw new Error(`${action} impossible : ordre de service jamais envoyé.`)
  const evenement = evenementDiffusion(s, saisie, nature)
  if (evenement.destinataire.type !== 'Entreprise' || evenement.destinataire.id !== envoi.destinataire.id)
    throw new Error(`${action} : elle concerne l'entreprise du premier envoi (${envoi.destinataire.id}).`)
  return evenement
}

/**
 * Relance de l'entreprise (journal « relance ») ; la date de relance est vidée : tant qu'un élément manque, l'OS reste
 * dans les relances dues, prochaine relance à fixer (relanceAFixer), jusqu'à ce que la suivante soit fixée (fixerRelance).
 */
export function relancerOs(s: SortieOrdreService, saisie: SaisieDiffusion): SortieOrdreService {
  const evenement = evenementVersEntreprise(s, saisie, 'relance', 'Relance')
  return { ...ajouter(s, evenement), relanceLe: null }
}

/** Courrier lié d'une ligne par courrier AR : envoyé en forme « AR » (FORME_ENVOI_PAR_CANAL, courriers.ts). */
function verifierCourrierAr(courrier: CourrierSuivi): void {
  if (courrier.formeEnvoi !== FORME_ENVOI_PAR_CANAL.courrier_ar)
    throw new Error(`Courrier lié envoyé en « ${courrier.formeEnvoi} » : un courrier en AR est attendu pour ce canal.`)
}

/**
 * Écart entre un AR et le courrier lié (courriers.ts) : courrier jamais déposé ; première présentation de l'AR, quand
 * elle est connue, antérieure au dépôt, différente de celle du courrier (décision J1) ou postérieure au retrait du pli,
 * comme courriers.ts le refuse pour ses propres dates (🔵) ; une date inconnue d'un côté ne se compare pas. Null : cohérents.
 */
function ecartDuCourrier(ar: ArReceptionOs, courrier: CourrierSuivi): string | null {
  if (!courrier.dateDepot) return "courrier lié jamais déposé : l'AR n'est pas celui d'un pli parti"
  const presentation = ar.premierePresentationLe
  if (presentation === null) return null
  const avant = `première présentation de l'AR (${fr(presentation)})`
  if (presentation < courrier.dateDepot) return `${avant} antérieure au dépôt du courrier lié (${fr(courrier.dateDepot)})`
  const duCourrier = courrier.datePremierePresentation ?? null
  if (duCourrier !== null && presentation !== duCourrier) return `${avant} différente de celle du courrier lié (${fr(duCourrier)})`
  const retrait = courrier.dateAccuseReception
  if (retrait && presentation > retrait) return `${avant} postérieure au retrait du pli (${fr(retrait)})`
  return null
}

/** Natures du journal qui portent l'OS lui-même : le premier envoi et les rediffusions (pas la relance). */
const NATURES_PORTANT_OS: ReadonlySet<NatureDiffusion> = new Set<NatureDiffusion>(['envoi', 'rediffusion'])

/**
 * Pli qui a porté l'OS à l'entreprise de la réception (🔵 : l'AR prouve la réception du pli qu'il accompagne, et une
 * réception par courrier AR, AR saisi ou non, est celle de ce pli) : ligne d'envoi ou de rediffusion par courrier AR,
 * même courrier (courrierId), même destinataire ; undefined : aucun.
 */
const pliPortantOs = (s: SortieOrdreService, reception: EvenementDiffusion): EvenementDiffusion | undefined =>
  s.journal.find(
    (e) =>
      NATURES_PORTANT_OS.has(e.nature) && e.canal === 'courrier_ar' && e.courrierId === reception.courrierId && memeRattachement(e.destinataire, reception.destinataire),
  )

/** Première présentation de l'AR, si elle est connue : ni antérieure à l'envoi du pli, ni postérieure à la réception (🔵). */
function verifierBornesPresentation(presentation: string | null, reception: EvenementDiffusion, pli: EvenementDiffusion): void {
  if (presentation === null) return
  if (presentation < pli.date)
    throw new Error(`Première présentation de l'AR (${fr(presentation)}) antérieure à l'envoi de l'OS par le courrier ${pli.courrierId} (${fr(pli.date)}).`)
  if (presentation > reception.date)
    throw new Error(`Première présentation de l'AR (${fr(presentation)}) après la réception du ${fr(reception.date)}.`)
}

/**
 * Pli d'une réception par courrier AR, AR saisi ou non : le courrier AR qui a porté l'OS à l'entreprise (pliPortantOs),
 * sinon refusé, motif à l'appui : l'AR d'un autre pli ne prouve pas la réception de l'OS, et la réception d'un autre pli
 * n'est pas celle de l'OS (🔵).
 */
function pliDeLaReception(s: SortieOrdreService, reception: EvenementDiffusion, avecAr: boolean): EvenementDiffusion {
  const pli = pliPortantOs(s, reception)
  if (pli) return pli
  const refus = avecAr ? `AR du courrier ${reception.courrierId} refusé` : `Réception par le courrier ${reception.courrierId} refusée`
  const motif = avecAr ? "l'AR d'un autre pli ne prouve pas la réception de l'OS" : "la réception d'un autre pli n'est pas celle de l'OS"
  throw new Error(
    `${refus} : ce courrier n'a pas porté l'OS à l'entreprise (ni envoi ni rediffusion de l'OS par courrier AR à ${reception.destinataire.id} sous ce courrier) ; ${motif}.`,
  )
}

/**
 * AR saisi avec une réception par courrier AR (décision 9 ; 🔵 : avis de réception du pli recommandé), celle du pli qui
 * a porté l'OS (pli, pliDeLaReception) : référence non vide ; première présentation saisie, sinon tirée du courrier lié
 * quand il est fourni ; en écart avec ce courrier (ecartDuCourrier), refusé ; bornée par l'envoi du pli et la réception
 * (verifierBornesPresentation) ; null sans AR.
 */
function lireArReception(
  ar: SaisieArReception | null,
  reception: EvenementDiffusion,
  pli: EvenementDiffusion,
  courrier: CourrierSuivi | undefined,
): ArReceptionOs | null {
  if (ar === null) return null
  const reference = texteOuNull(ar.reference)
  if (reference === null) throw new Error("AR de la réception : référence attendue (numéro du pli recommandé ou pièce numérisée).")
  const saisie = ar.premierePresentationLe ?? null
  verifierDate("Première présentation de l'AR", saisie)
  const lu: ArReceptionOs = { reference, premierePresentationLe: saisie ?? courrier?.datePremierePresentation ?? null }
  const ecart = courrier ? ecartDuCourrier(lu, courrier) : null
  if (ecart !== null) throw new Error(`AR de la réception refusé : ${ecart} ; corriger l'AR saisi ou le suivi du courrier (courriers.ts).`)
  verifierBornesPresentation(lu.premierePresentationLe, reception, pli)
  return lu
}

/** Courrier lié fourni avec la réception : seulement pour une réception par courrier AR, envoyé en forme « AR ». */
function verifierCourrierDeReception(reception: EvenementDiffusion, courrier: CourrierSuivi): void {
  if (reception.canal !== 'courrier_ar') throw new Error(`Courrier lié : réservé à une réception par courrier AR (ici « ${reception.canal} »).`)
  verifierCourrierAr(courrier)
}

/**
 * Accusé de réception de l'entreprise (journal « reception »), distinct de l'envoi : le contrat se forme quand
 * l'acceptation parvient (C. civ. art. 1121) ; pour un écrit électronique hors des cas des art. 1125 et 1126, la remise
 * est effective à l'accusé de réception (art. 1127-4). Toute réception par courrier AR, AR saisi ou non, est celle du
 * pli qui a porté l'OS à l'entreprise (envoi ou rediffusion par courrier AR, même courrierId), sinon refusée
 * (pliDeLaReception) ; elle peut porter son AR, qui en fait preuve (décision de Hugo du 03/11/2026), rapproché du
 * courrier lié quand il est fourni (courrier : forme « AR » exigée, déposé, première présentation tirée de lui ou comparée
 * à lui) ; l'AR saisi sur une réception par un autre canal est refusé ; sans AR, la réception est admise, « sans preuve »
 * (preuveDeReception). Le journal ne se réécrit pas : un AR revenu après une réception déjà enregistrée passe par une
 * nouvelle ligne (preuveReceptionOs), la réception restant datée de la première. Puis devisCaducALaReception.
 */
export function enregistrerReception(s: SortieOrdreService, saisie: SaisieReception, courrier?: CourrierSuivi): SortieOrdreService {
  const reception = evenementVersEntreprise(s, saisie, 'reception', 'Réception')
  if (courrier) verifierCourrierDeReception(reception, courrier)
  const ar = saisie.ar ?? null
  if (reception.canal !== 'courrier_ar') {
    if (ar !== null)
      throw new Error(
        `AR saisi sur une réception par « ${reception.canal} » : l'AR est l'avis de réception du courrier AR ; par ce canal, la réception est admise sans AR (« sans preuve »).`,
      )
    return ajouter(s, { ...reception, ar: null })
  }
  const pli = pliDeLaReception(s, reception, ar !== null)
  return ajouter(s, { ...reception, ar: lireArReception(ar, reception, pli, courrier) })
}

/**
 * Devis associé échu avant la réception enregistrée de l'OS : l'offre est caduque à l'expiration du délai fixé par son
 * auteur (C. civ. art. 1117, al. 1) et le contrat se forme quand l'acceptation parvient (art. 1121).
 */
export function devisCaducALaReception(d: Demande, s: SortieOrdreService, validiteDevisAu: string | null): AnomalieEnvoiOs[] {
  verifierLien(d, s)
  verifierDate('Fin de validité du devis associé', validiteDevisAu)
  const reception = s.journal.find((e) => e.nature === 'reception')
  if (d.devisAssocie === null || validiteDevisAu === null || !reception || reception.date <= validiteDevisAu) return []
  return [
    anomalie(
      'devis_caduc',
      'alerte',
      `Réception de l'OS le ${fr(reception.date)}, après la fin de validité du devis associé (${fr(validiteDevisAu)}) : le contrat ne s'est pas formé sur le devis ; l'OS vaut offre nouvelle, à faire accepter par l'entreprise.`,
      FONDEMENT_CADUCITE,
      true,
    ),
  ]
}

/**
 * Date de relance (copie) ; null l'efface. Après le premier envoi, une date antérieure à celui-ci est refusée ; avant,
 * elle bloque l'envoi (relance_avant_envoi).
 */
export function fixerRelance(s: SortieOrdreService, date: string | null): SortieOrdreService {
  if (date === null) return { ...s, relanceLe: null }
  verifierDate('Date de relance', date)
  const envoi = premierEnvoi(s)
  if (envoi && date < envoi.date)
    throw new Error(`Date de relance (${fr(date)}) antérieure au premier envoi (${fr(envoi.date)}).`)
  return { ...s, relanceLe: date }
}

// ─── Ce que l'entreprise doit faire parvenir (relance : décision de Hugo du 03/11/2026) ───────

/** La relance vise la réponse à l'OS, et aussi l'accusé et le rapport quand ils sont demandés. */
export const ATTENDUS_OS = ['reponse', 'accuse', 'rapport'] as const
export type AttenduOs = (typeof ATTENDUS_OS)[number]

interface RegleAttendu {
  libelle: string
  /** L'élément est attendu de cette demande. */
  attendu: (d: Demande) => boolean
  /** L'élément est reçu. */
  recu: (d: Demande, s: SortieOrdreService) => boolean
}

/**
 * Réponse de l'entreprise (🔵) : visible sur la demande (statut « Accepté », stade de l'étape Acceptation ou au-delà, une
 * proposition n'en étant pas une, réalisation datée, ou, pour une demande de devis, le devis associé), ou rapport reçu
 * (l'entreprise qui remet son rapport a répondu à l'OS).
 */
const reponseRecue = (d: Demande, s: SortieOrdreService): boolean =>
  d.statut === 'Accepté' ||
  etapeDuStade(d.stade) !== 'Demandée' ||
  d.realiseeLe !== null ||
  (d.type === 'devis' && d.devisAssocie !== null) ||
  s.rapportRecu !== null

const REGLES_ATTENDUS: Readonly<Record<AttenduOs, RegleAttendu>> = {
  reponse: { libelle: "réponse à l'ordre de service", attendu: () => true, recu: reponseRecue },
  accuse: { libelle: 'accusé de réception', attendu: (d) => d.statut === 'Accusé demandé', recu: (_d, s) => estRecu(s) },
  rapport: { libelle: 'rapport', attendu: (d) => d.statut === 'Rapport demandé', recu: (_d, s) => s.rapportRecu !== null },
}

/**
 * Éléments encore attendus de l'entreprise (dans l'ordre d'ATTENDUS_OS) pour un OS envoyé, ni terminé ni refusé ; aucun
 * sinon. La réponse est toujours attendue (reçue : reponseRecue, rapport reçu compris) ; l'accusé au statut « Accusé
 * demandé » (reçu : ligne « reception » du journal) ; le rapport au statut « Rapport demandé » (reçu : enregistrerRapport).
 */
export function attendusOs(d: Demande, s: SortieOrdreService): AttenduOs[] {
  verifierLien(d, s)
  if (!estEnvoye(s) || d.statut === 'Terminé' || estRefusee(d)) return []
  return ATTENDUS_OS.filter((element) => REGLES_ATTENDUS[element].attendu(d) && !REGLES_ATTENDUS[element].recu(d, s))
}

export interface SaisieRapport {
  recuLe: string
  documentId?: string | null
}

/** Rapport de l'entreprise reçu (copie) : sur un OS envoyé, au plus tôt le jour du premier envoi, une seule fois (🔵). */
export function enregistrerRapport(d: Demande, s: SortieOrdreService, saisie: SaisieRapport): SortieOrdreService {
  verifierLien(d, s)
  verifierDate('Date de réception du rapport', saisie.recuLe)
  const envoi = premierEnvoi(s)
  if (!envoi) throw new Error(`Rapport impossible : ordre de service ${d.numero ?? d.id} jamais envoyé.`)
  if (saisie.recuLe < envoi.date) throw new Error(`Rapport reçu le ${fr(saisie.recuLe)}, avant le premier envoi de l'OS (${fr(envoi.date)}).`)
  if (s.rapportRecu) throw new Error(`Rapport de l'OS ${d.numero ?? d.id} déjà enregistré (reçu le ${fr(s.rapportRecu.recuLe)}).`)
  return { ...s, rapportRecu: { recuLe: saisie.recuLe, documentId: texteOuNull(saisie.documentId) } }
}

/** Preuve d'une réception (décision 9) : son AR, ou « sans preuve ». */
export type PreuveReception = 'ar' | 'sans_preuve'

/**
 * Preuve d'une réception portée par sa ligne (décision de Hugo du 03/11/2026 : l'AR fait preuve) : « ar » quand elle porte
 * son AR, sinon « sans_preuve » (ligne sans la clé « ar », écrite avant la décision 9, comprise) : la réception reste
 * admise, sans blocage (🔵). Pour une réception par courrier AR, preuveDeDiffusion lit aussi le courrier lié et le
 * journal de la sortie.
 */
export function preuveDeReception(evenement: EvenementDiffusion): PreuveReception {
  if (evenement.nature !== 'reception') throw new Error(`Ligne « ${evenement.nature} » du journal : seule une réception a une preuve de réception.`)
  return evenement.ar ? 'ar' : 'sans_preuve'
}

/**
 * Preuve de la réception de l'OS lui-même (décision 9) : « ar » dès qu'une ligne « reception » du journal porte son AR, y
 * compris un AR revenu après une première réception (nouvelle ligne : le journal ne se réécrit pas) ; « sans_preuve »
 * quand l'OS est reçu sans AR ; null : jamais reçu. La réception reste datée de sa première ligne (estRecu,
 * devisCaducALaReception). Lit les lignes seules (preuveDeReception) : l'état du courrier lié d'une réception par courrier
 * AR sans AR saisi, et l'écart d'un AR avec son courrier lié apparu après la saisie (« ar_ecart_courrier »), se lisent par
 * preuveDeDiffusion, ligne par ligne.
 */
export function preuveReceptionOs(s: SortieOrdreService): PreuveReception | null {
  const receptions = s.journal.filter((e) => e.nature === 'reception')
  if (receptions.length === 0) return null
  return receptions.some((e) => preuveDeReception(e) === 'ar') ? 'ar' : 'sans_preuve'
}

/**
 * Preuve d'une ligne du journal (preuveDeDiffusion) ; « ar_ecart_courrier » : la ligne porte un AR en écart avec le
 * courrier lié (ecartArCourrier), écart apparu après la saisie, signalé à vérifier.
 */
export type PreuveDiffusion = 'trace_interne' | EtatNotificationCourrier | PreuveReception | 'ar_ecart_courrier'

/**
 * Écart entre l'AR d'une réception et son courrier lié (courriers.ts) apparu après la saisie (courrier non fourni à la
 * saisie, suivi postal complété ou corrigé ensuite) : message, ou null (aucun AR, ou AR cohérent avec le courrier). La
 * ligne du journal ne se réécrit pas : l'écart est signalé, jamais levé ; une nouvelle réception peut porter l'AR exact.
 */
export function ecartArCourrier(evenement: EvenementDiffusion, courrier: CourrierSuivi): string | null {
  const ar = evenement.ar ?? null
  const ecart = ar === null ? null : ecartDuCourrier(ar, courrier)
  if (ecart === null) return null
  return `AR de la réception du ${fr(evenement.date)} en écart avec le courrier lié : ${ecart} ; la ligne du journal ne se réécrit pas : enregistrer une nouvelle réception avec l'AR exact, ou corriger le suivi du courrier (courriers.ts).`
}

/**
 * Preuve d'une ligne du journal : la trace interne (journal horodaté) pour la messagerie, le courriel, le SMS et le
 * courrier simple, sauf pour une réception, qui a son AR ou est « sans preuve » (preuveDeReception) ; pour le courrier AR,
 * le courrier lié est attendu (forme « AR ») : une réception qui porte son AR vaut « ar », ou « ar_ecart_courrier » quand
 * l'AR est en écart avec le courrier (ecartArCourrier : signalé, sans lever, la ligne ne se réécrivant pas) ; une
 * réception sans AR saisi dont le courrier n'a pas porté l'OS à l'entreprise (pliPortantOs, lu dans le journal de la
 * sortie s : ligne écrite sans le contrôle de la saisie, avant la décision 9) est « sans preuve », jamais l'état de
 * notification de ce pli ; toute autre ligne, réception sans AR saisi sur le pli qui a porté l'OS comprise (comme avant
 * la décision 9), vaut l'état de notification du courrier lié (courriers.ts). Une ligne qui porte un AR a été rattachée
 * au pli à la saisie (pliDeLaReception).
 */
export function preuveDeDiffusion(s: SortieOrdreService, evenement: EvenementDiffusion, courrier?: CourrierSuivi): PreuveDiffusion {
  if (evenement.canal !== 'courrier_ar') return evenement.nature === 'reception' ? preuveDeReception(evenement) : 'trace_interne'
  if (!courrier) throw new Error(`Courrier AR ${evenement.courrierId ?? ''} : le courrier lié est attendu (preuve de notification).`)
  verifierCourrierAr(courrier)
  const ar = evenement.ar ?? null
  if (ar !== null) return ecartDuCourrier(ar, courrier) === null ? 'ar' : 'ar_ecart_courrier'
  if (evenement.nature === 'reception' && !pliPortantOs(s, evenement)) return 'sans_preuve'
  return etatNotificationCourrier(courrier)
}

// ─── Adaptateurs (branchements à faire plus tard) ─────────────────────────────────────────────

/**
 * Élément du suivi « à faire » (famille « demandes », nature « relance_os » de suivi-a-faire.ts, point 46), avec la liste
 * de ce qui manque (attendus) et l'état de la date de relance (relanceAFixer) ; aConfirmer reste faux : la relance est
 * un réglage de gestion, pas un repère juridique (ElementAFaire).
 */
export type RelanceOsAFaire = Omit<ElementAFaire, 'famille' | 'nature'> & {
  famille: 'demandes'
  nature: 'relance_os'
  attendus: AttenduOs[]
  /**
   * Aucune date de relance (jamais fixée, ou vidée par relancerOs) : l'élément demande de fixer la prochaine relance
   * (fixerRelance), pas de relancer l'entreprise.
   */
  relanceAFixer: boolean
}

/**
 * Relance due d'un OS envoyé, ni terminé ni refusé, dont un élément manque (attendusOs) ; null sinon. Avec une date de
 * relance : « Relancer l'entreprise », dû à cette date. Sans elle (jamais fixée, ou vidée par relancerOs), l'OS reste
 * dû : « Fixer la prochaine relance de l'entreprise » (relanceAFixer), dû le jour de la dernière relance du journal ou, à
 * défaut, du premier envoi (aucun délai inventé), et non une seconde relance le jour d'une relance déjà faite.
 */
function relanceDue(d: Demande, s: SortieOrdreService): RelanceOsAFaire | null {
  const attendus = attendusOs(d, s)
  const envoi = premierEnvoi(s)
  if (envoi === null || attendus.length === 0) return null
  const relanceAFixer = s.relanceLe === null
  const action = relanceAFixer ? "Fixer la prochaine relance de l'entreprise (fixerRelance)" : "Relancer l'entreprise"
  const manque = attendus.map((element) => REGLES_ATTENDUS[element].libelle).join(', ')
  return {
    id: `demandes:relance_os:${d.id}`,
    famille: 'demandes',
    nature: 'relance_os',
    libelle: `${action} : ordre de service ${d.numero ?? d.id} (${d.objet}) ; attendu : ${manque}`,
    date: s.relanceLe ?? (s.journal.findLast((e) => e.nature === 'relance') ?? envoi).date,
    mandatId: d.mandatId,
    objetId: d.id,
    assigneId: envoi.collaborateurId,
    aConfirmer: false,
    attendus,
    relanceAFixer,
  }
}

/**
 * Relances dues (décision de Hugo du 03/11/2026) : UN élément par OS envoyé, ni terminé ni refusé, tant qu'un élément manque
 * (attendusOs), date de relance fixée ou non (relanceDue : relancer, ou fixer la prochaine relance) ; il liste ce qui
 * manque. Tout reçu : rien n'est dû. Triées par date.
 */
export function relancesOsDues(items: readonly { demande: Demande; sortie: SortieOrdreService }[]): RelanceOsAFaire[] {
  return items
    .flatMap(({ demande: d, sortie: s }) => {
      const due = relanceDue(d, s)
      return due === null ? [] : [due]
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

export interface ContexteEnvoiVitfix {
  syndicArtisanId: string
  /** Libellé de la copropriété affiché au prestataire. */
  copropriete: string
  adresse?: string
  description?: string
  localisation?: string
  note?: string
}

/** Corps de l'action « envoyer » de la route, pour un OS envoyé par la messagerie VitFix. */
export function demandeEnvoiDepuisOs(d: Demande, s: SortieOrdreService, contexte: ContexteEnvoiVitfix): DemandeEnvoiOrdre {
  verifierLien(d, s)
  if (s.canal !== 'messagerie_vitfix') throw new Error(`OS ${d.numero ?? d.id} : canal « ${s.canal ?? 'aucun'} », pas la messagerie VitFix.`)
  if (d.numero === null) throw new Error(`Demande ${d.id} : N° d'OS absent, à numéroter avant l'envoi.`)
  const refuses = champsRefusesParLaRoute(d)
  if (refuses.length > 0) throw new Error(`Demande ${d.id} : ${refuses.map((r) => r.constat).join(' ; ')}.`)
  return {
    syndic_artisan_id: contexte.syndicArtisanId,
    copropriete: contexte.copropriete,
    adresse: contexte.adresse,
    objet: d.objet,
    description: contexte.description,
    localisation: contexte.localisation,
    urgence: s.delai,
    date_intervention: d.prevuLe ?? undefined,
    note: contexte.note,
    reference_aj: d.numero,
  }
}
