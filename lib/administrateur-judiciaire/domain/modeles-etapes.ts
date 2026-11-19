import { ajouterJours, dateIsoVersFr, estDateIsoValide, verifierAujourdhui } from '@/lib/administrateur-judiciaire/domain/dates'
import { REGLES_DELAIS_LEGAUX } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { etatEtape, type EtapeTypeProcessus } from '@/lib/administrateur-judiciaire/domain/etapes'
import {
  TITRE_COPIE_AU_CS_POUR_INFO,
  USAGES_ETAPES_CABINET_PAR_DEFAUT,
  creerEtapeDossier,
  type EtapeDossier,
  type NatureDemandeurEtape,
  type UsagesEtapesCabinet,
} from '@/lib/administrateur-judiciaire/domain/etapes-dossier'
import { creerRattachement, type Rattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import { construireChecklistPriseFonction } from '@/lib/administrateur-judiciaire/domain/prise-de-fonction'
import { PIECES_REPRISE, REGLE_MOTEUR_PAR_DELAI_PIECE, type PieceReprise } from '@/lib/administrateur-judiciaire/domain/reprise'
import { DOSSIER, type Dossier } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Modèles d'étapes par type de dossier : listes de contrôle (point 49 du bilan 2). Fonctions pures, dates AAAA-MM-JJ,
 * délais en jours entiers, sans écran ni table : l'écran des modèles, leur table et celle des listes instanciées relèvent
 * de Frédéric. S'appuie sur etapes.ts (EtapeTypeProcessus, enchainer ; depuis J76, un délai null n'y fixe aucune limite) et
 * etapes-dossier.ts (point 48 : creerEtapeDossier, enchainerEtapeDossier), inchangé. prise-de-fonction.ts et reprise.ts
 * restent inchangés, exports compris : leurs listes sont converties ici en modèles (adaptateurs modelePriseDeFonction et
 * modeleReprise).
 *
 * Gestéam (cartographie, tranches lues) :
 * 🟢 Tranche 42, complément du 28/10/2026 (Étapes → recherche → critère Dossier → sélecteur « Étape type ») : types
 *   d'étapes par dossier. Contentieux (3) : Ouverture de dossier · Lettre de mise en demeure · Copie au CS pour info ;
 *   l'étape automatique vue est le n° 3, le processus est Ouverture → Mise en demeure → Copie au conseil syndical.
 *   Sinistre (14) : Déclaration sinistre · Information lésé · Demande d'intervention · Demande de devis · Devis à
 *   l'assurance · Expertise · Proposition indemnité propriétaire · Lettre de désistement · Proposition indemnité locataire ·
 *   Accord sur indemnité immédiate · Règlement immédiat au lésé · Facture définitive au courtier · Règlement différé au
 *   lésé · Honoraire sinistre. Gestion, Contrat, Travaux, Équipement, Mutation, Assemblée, Exercice comptable, Mandat de
 *   syndic : aucun type propre. Partout : « Votes par correspondance » (type commun). ⚪ L'ordre affiché est celui du
 *   paramétrage (codes non visibles, sauf le n° 3 du contentieux) ; ⚪ aucun délai entre étapes n'est relevé.
 * 🟢 Tranche 17 § 6 (08/10/2026) et etape_processus.json : « Étape type », une seule valeur, Votes par correspondance,
 *   notée « une seule valeur paramétrée dans ce cabinet ». La tranche 42 corrige cette note : 🔵 le relevé, fait sans
 *   critère Dossier, ne montrait que le type commun.
 * 🟢 Tranche 17 § 7 et PROCESSUS (referentiels-gesteam-judiciaire.ts, réutilisé, pas dupliqué) : familles « Liste de
 *   contrôle - Bail » (Départ locataire, Nouveau bail) et « Liste de contrôle - Mandat » (Nouveau mandat de gérance, Nouveau
 *   mandat de syndic) ; « Nouveau mandat de syndic » est l'équivalent Gestéam de la prise de fonction.
 * 🟢 Tranche 40, référentiel Classe d'évènement (46 valeurs) : 37 classes « Liste de contrôle - … », de Mandat à Liste
 *   isolée, une par type de fiche (gérance comprise, gardée pour la traçabilité). Seuls les NOMS sont relevés : le contenu
 *   (les étapes) d'aucune de ces listes ne l'est. Graphie de la tranche 40 (« Équipement », « État des lieux… ») ; le
 *   référentiel DOSSIER, relevé le 08/10/2026, écrit « Equipement ».
 * 🟢 Tranche 43 § 4 (Évènements, critère Processus) : processus « Nouveau mandat de syndic », 0 évènement : le cabinet
 *   n'utilise pas cette liste, la prise de fonction se suit ailleurs ; son contenu n'est pas relevé.
 * 🟢 Tranche 35 § Étapes : bouton Enchaînement (🔵 étape suivante d'un processus), champ Instructions de l'étape.
 * Listes non relevées en entier, non complétées ici : le contenu des 37 listes de contrôle ; les types d'étapes des
 * dossiers Bail, Communication, Comptabilité, Mandat de gérance et Location Transaction, absents de la tranche 42
 * (DOSSIERS_NON_RELEVES : typesEtapesDuDossier rend null).
 *
 * Décisions de Hugo (registre des décisions juridiques) :
 * - J20 : instancier une liste est un geste du collaborateur : chaque étape est d'origine « manuelle », « Créée par » ce
 *   collaborateur (obligatoire), jamais « Automatique » (🔵 par analogie avec l'étape enchaînée de J20) ; la règle « étape
 *   automatique non réalisée après N jours » ne la vise donc pas : elle remonte au suivi « à faire » par sa limite, quand
 *   elle en a une ; sans délai saisi, elle y remonte chaque jour, marquée « sans délai », jamais en retard (question n° 6
 *   ci-dessous).
 * - J21 : les durées d'étape sont en minutes ; 🔵 les délais d'un modèle, eux, sont en jours entiers (écart entre deux
 *   limites), comme EtapeTypeProcessus.delaiJours : deux grandeurs distinctes.
 * - J24 et J41 : « Copie au CS pour info » reste un usage du cabinet, inactif par défaut (etapeCopieAuCsPourInfo,
 *   USAGES_ETAPES_CABINET_PAR_DEFAUT) ; le référentiel la nomme (TITRE_COPIE_AU_CS_POUR_INFO, réutilisé), lui donne un code
 *   (ETAPE_TYPE_COPIE_AU_CS_POUR_INFO) et la garde au sélecteur « Étape type » (🔵 choix manuel du collaborateur) ;
 *   processusDuDossier et modeleDuDossier la retirent tant que le réglage du cabinet (UsagesEtapesCabinet) ne l'active
 *   pas : sans ce réglage, ni l'enchaînement après la mise en demeure ni l'instanciation ne la créent.
 * - J44 : pas de case « Fixe » : l'instanciation ne saisit ni « À faire le » ni « Prévue le » (programmerEtape ensuite).
 * - J64 (décision de Hugo du 17/11/2026 (J64) ; DECISIONS-HUGO-2026-11-17.md, section « Suite » : recommandations
 *   validées en bloc, numéro de registre proposé) : usage « Copie au CS » activé, l'étape naît « Automatique » du courrier
 *   de mise en demeure du contentieux (procédure 19-2 comprise, pas les simples relances ; etapes-courrier.ts,
 *   regleCopieAuCsPourInfo), et l'enchaînement ne la recrée pas (enchainerEtapeDossierSansDoublon) ; réglage désactivé par
 *   défaut (J41). Ferme l'ancienne question n° 6 (courrier ou enchaînement). processusDuDossier et modeleDuDossier,
 *   inchangés, la portent toujours quand l'usage est actif : retirer les types nés du courrier avant l'instanciation
 *   relève de modeleSansEtapesNeesDuCourrier (question n° 5 ci-dessous et n° 6 de etapes-courrier.ts).
 * - J76 (réponse de Frédéric du 17/11/2026 sur sa page de validation ; registre : J76) : aucun délai par défaut entre les
 *   étapes des dossiers Sinistre et Contentieux ; le cabinet saisit les siens dans ses modèles, comptés d'une étape à la
 *   suivante, jamais tous depuis le départ ; un délai d'étape est un délai de GESTION, jamais présenté comme légal. Le
 *   référentiel et processusDuDossier ne portent donc aucun délai (null), et processusDuModele garde « non saisi » (null) :
 *   enchaînée sans délai saisi, l'étape suivante n'a pas de limite (etapes.enchainer), comme dans une liste instanciée ;
 *   un délai saisi par le cabinet, 0 compris, fixe la limite. Ferme la question n° 1 et, en partie, la n° 2.
 *   Conséquence : enchaînée sans délai, l'étape n'a ni limite, ni « à faire le », ni alerte, et la règle des N jours ne
 *   vise pas une étape « manuelle » (J20). Sur main, le délai de 0 jour lui donnait une limite. Elle remonte maintenant
 *   au suivi « à faire » chaque jour, à la date de référence, marquée « sans délai », jamais en retard
 *   (suivi-a-faire.depuisEtapes) : voir la question n° 6 ci-dessous.
 *
 * 🔵 Choix VitFix :
 * - codes d'étape type (etapeType) : « <dossier>.<titre sans accent> », Gestéam ne montrant pas les siens ; ordre du
 *   processus = ordre affiché ; « Votes par correspondance » hors des suites (type commun, pas une étape d'un processus) ;
 * - délais du référentiel : aucun (null ; aucun relevé, J76). Enchaînée telle quelle, l'étape suivante n'a pas de limite
 *   et n'est jamais en retard. Un modèle tiré du référentiel (modeleDuDossier) part de même « sans délai saisi » (null) :
 *   le cabinet saisit les siens, puis processusDuModele les convertit pour l'enchaînement ;
 * - modèle : titre, type de dossier (référentiel DOSSIER : le rattachement du point 47), classe Gestéam facultative,
 *   étapes ordonnées (type, titre, délai, instructions) ; ajout, retrait, renommage, déplacement, délai. Contrôles :
 *   identifiants et titres non vides, aucun type ni titre en double (casse et espaces ignorés), au moins une étape, au
 *   plus ETAPES_PAR_MODELE_MAX, délai entier de 0 à DELAI_ETAPE_MAX_JOURS (garde-fous) ;
 * - délais d'une liste instanciée : comptés depuis la limite de l'étape précédente (depuis le départ pour la première),
 *   donc cumulés ; une étape sans délai (null) n'a pas de limite et n'ajoute rien au cumul. Converti pour l'enchaînement
 *   (processusDuModele), le délai garde la définition d'etapes.ts : après la réalisation de l'étape précédente ; non
 *   saisi, il reste null (pas de limite, J76) ;
 * - instanciation : toutes les étapes créées d'un coup, le jour du départ, rattachées au dossier du modèle (et aux
 *   rattachements fournis), instructions recopiées. C'est une copie : modifier le modèle ensuite ne change pas la liste ;
 * - avancement : réalisées (« fait le ») sur total, pourcentage arrondi à l'inférieur (100 % seulement quand tout est
 *   réalisé) ; terminée quand toutes sont validées ou sans validation ; prochaine = la première encore à faire dans
 *   l'ordre du modèle ;
 * - prise de fonction (premier modèle) : les 8 diligences de construireChecklistPriseFonction, appelée telle quelle (le
 *   régime de l'art. 29-1 choisit les fondements) ; libellé en titre, champ « art » en instructions, sans délai ni statut
 *   de départ (les statuts de la check-list d'origine se déduisent de données de démonstration) ; le service (role) n'a
 *   pas de champ dans l'étape et n'est pas repris. Reprise (second modèle) : les 12 pièces de PIECES_REPRISE, libellé en
 *   titre, base et délai LÉGAL cités en instructions (« pratique » : sans délai légal ; « à confirmer » quand la règle du
 *   moteur de délais n'a pas la certitude TEXTE), sans délai de gestion. Les deux sous « Liste de contrôle - Mandat »,
 *   dossier « Mandat de syndic ».
 *
 * 🔴 Non établi — questions :
 * 1. Fermée par J76 (ci-dessus) : aucun délai de gestion par défaut ; le cabinet saisit les siens.
 * 2. En partie fermée par J76 : d'une étape à la suivante, jamais tous depuis le départ. Reste ouvert (Frédéric ou Hugo,
 *    registre J76) : le délai part-il de la limite de l'étape précédente (liste instanciée, choix actuel) ou de sa
 *    réalisation (enchaînement, choix actuel) ? À la réalisation d'une étape, faut-il replanifier les suivantes ?
 * 3. Hugo : contenu des listes de contrôle Gestéam (dont « Nouveau mandat de syndic ») et types d'étapes des dossiers non
 *    relevés : à relever en lecture seule si le cabinet en a besoin ; rien n'est inventé ici.
 * 4. Hugo : les fondements et délais légaux cités par prise-de-fonction.ts (« 1 mois après le prononcé », « sous 15
 *    jours », « 3 mois … (à confirmer) ») et par reprise.ts (« 15 jours », « 1 mois », « apurement ») sont recopiés tels
 *    quels en instructions, sans revérification ; aucun n'est tranché par le registre des décisions juridiques (le moteur
 *    de délais les date avec sa propre certitude) : à confirmer.
 * 5. Frédéric ou Hugo : un modèle s'instancie d'un coup (liste de contrôle) ou se suit étape par étape (enchaînement).
 *    Les deux sur une même liste font double emploi : enchaîner depuis une étape d'une liste instanciée recrée l'étape
 *    suivante, déjà présente. Et l'instanciation d'un coup crée toutes les étapes le jour du départ, si bien que
 *    « En cours depuis » (J23 : depuis la création) court pour toutes dès ce jour. Faut-il un seul des deux usages par
 *    modèle, ou créer chaque étape à la réalisation de la précédente ?
 * 6. Proposition de Hugo du 19/11/2026, codée, à valider par Frédéric avant fusion (registre J76, point de contact avec
 *    J20) : une étape sans délai saisi, enchaînée ou instanciée d'une liste, n'a ni limite, ni « à faire le », ni alerte ;
 *    d'origine « manuelle », elle échappe à la règle des N jours. Elle remonte au suivi « à faire »
 *    (suivi-a-faire.depuisEtapes) à la date de référence, chaque jour, marquée « sans délai », pour ne pas être oubliée :
 *    due le jour même, elle n'est jamais en retard. Une étape automatique sans date n'y remonte pas ainsi : sa relance à
 *    N jours la suit déjà (depuisEtapesAutomatiques), sans doublon. Une étape datée et une étape à valider sont
 *    inchangées. Reste à obtenir : l'accord écrit de Frédéric. L'en-tête d'etapes-dossier.ts (J20) dit encore que
 *    l'enchaînement fixe toujours une limite : à corriger après cet accord, en accord avec la PR #741, qui modifie ce
 *    fichier.
 *
 * Délais : un délai de modèle est un délai de GESTION, réglage du cabinet ; il ne s'affiche jamais comme un délai légal.
 * Les délais légaux de la prise de fonction et de la reprise (notification de l'ordonnance, remise des pièces par l'ancien
 * syndic, compte séparé) restent au moteur de délais (delais-legaux.ts, planification-mandat.ts), qui les date et les
 * justifie : ils ne sont jamais convertis en délais de modèle.
 */

// ─── Classes « Liste de contrôle - … » (tranche 40) ─────────────────────────────────────────

/** 🟢 Tranche 40, référentiel Classe : les 37 objets des classes « Liste de contrôle - … », dans l'ordre relevé. */
export const OBJETS_LISTE_DE_CONTROLE = [
  'Mandat',
  'Contrat',
  'Travaux',
  'Équipement',
  'Sinistre',
  'Contentieux',
  'Mutation',
  'Assemblée',
  'Résolution',
  'Exercice',
  'Bail',
  "État des lieux d'entrée",
  'État des lieux de sortie',
  'Traitement',
  'Compte',
  'Demande de devis',
  "Demande d'intervention",
  'Document',
  'Courrier',
  'Agenda',
  'Mémo',
  'Honoraires facture',
  'Honoraires détail',
  "Ticket d'appel",
  'Avis de loyer',
  'Compte de gérance',
  'Appel copropriétaire',
  'Appel immeuble',
  'Encaissement',
  'Facture',
  'Règlement détail',
  'Règlement',
  'Terme détail',
  'Déclaration',
  'État paramétré',
  'Mouvement',
  'Liste isolée',
] as const
export type ObjetListeDeControle = (typeof OBJETS_LISTE_DE_CONTROLE)[number]
export type ClasseListeDeControle = `Liste de contrôle - ${ObjetListeDeControle}`

/** Libellés complets des classes (🔵 reconstitués de la notation factorisée de la tranche 40, comme les clés de PROCESSUS). */
export const CLASSES_LISTE_DE_CONTROLE: readonly ClasseListeDeControle[] = OBJETS_LISTE_DE_CONTROLE.map(
  (objet): ClasseListeDeControle => `Liste de contrôle - ${objet}`,
)
const CLASSES_ADMISES: ReadonlySet<string> = new Set(CLASSES_LISTE_DE_CONTROLE)

// ─── Référentiel des types d'étapes par dossier (tranche 42) ───────────────────────────────

/** Dossiers que le cabinet a outillés en processus d'étapes (🟢 tranche 42). */
export const DOSSIERS_OUTILLES = ['Contentieux', 'Sinistre'] as const satisfies readonly Dossier[]
export type DossierOutille = (typeof DOSSIERS_OUTILLES)[number]

/** 🟢 Tranche 42 : dossiers consultés, sans type d'étape propre (le type commun seul). */
export const DOSSIERS_SANS_TYPE_PROPRE: readonly Dossier[] = [
  'Gestion',
  'Contrat',
  'Travaux',
  'Equipement',
  'Mutation',
  'Assemblée',
  'Exercice comptable',
  'Mandat de syndic',
]

/** ⚪ Dossiers du référentiel DOSSIER que la tranche 42 ne cite pas : types d'étapes non relevés. */
export const DOSSIERS_NON_RELEVES: readonly Dossier[] = ['Bail', 'Communication', 'Comptabilité', 'Mandat de gérance', 'Location Transaction']

/** Titre sans accent, en minuscules, mots joints par « _ » : « Devis à l'assurance » → « devis_a_l_assurance ». */
const codeDuTitre = (titre: string): string =>
  titre
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('_')

/** J76 : aucun délai par défaut (null) ; le cabinet saisit les siens, délais de GESTION, jamais légaux. */
const typeEtape = (prefixe: string, titre: string): Readonly<EtapeTypeProcessus> =>
  Object.freeze({ etapeType: `${prefixe}.${codeDuTitre(titre)}`, titre, delaiJours: null })

const TITRES_CONTENTIEUX = ['Ouverture de dossier', 'Lettre de mise en demeure', TITRE_COPIE_AU_CS_POUR_INFO] as const

const TITRES_SINISTRE = [
  'Déclaration sinistre',
  'Information lésé',
  "Demande d'intervention",
  'Demande de devis',
  "Devis à l'assurance",
  'Expertise',
  'Proposition indemnité propriétaire',
  'Lettre de désistement',
  'Proposition indemnité locataire',
  'Accord sur indemnité immédiate',
  'Règlement immédiat au lésé',
  'Facture définitive au courtier',
  'Règlement différé au lésé',
  'Honoraire sinistre',
] as const

/** 🟢 Types d'étapes propres à chaque dossier outillé, dans l'ordre affiché (= ordre du processus, 🔵). */
export const TYPES_ETAPES_PAR_DOSSIER: Readonly<Record<DossierOutille, readonly Readonly<EtapeTypeProcessus>[]>> = Object.freeze({
  Contentieux: Object.freeze(TITRES_CONTENTIEUX.map((titre) => typeEtape('contentieux', titre))),
  Sinistre: Object.freeze(TITRES_SINISTRE.map((titre) => typeEtape('sinistre', titre))),
})

/** 🟢 Type commun à tous les dossiers consultés ; 🔵 hors des suites. */
export const TYPE_ETAPE_COMMUN: Readonly<EtapeTypeProcessus> = typeEtape('commun', 'Votes par correspondance')

/** Code de l'étape type n° 3 du contentieux, à passer à etapeCopieAuCsPourInfo (usage du cabinet : J24, J41). */
export const ETAPE_TYPE_COPIE_AU_CS_POUR_INFO = typeEtape('contentieux', TITRE_COPIE_AU_CS_POUR_INFO).etapeType

const estOutille = (dossier: string): dossier is DossierOutille => (DOSSIERS_OUTILLES as readonly string[]).includes(dossier)

function verifierDossier(dossier: string): void {
  if (!(DOSSIER as readonly string[]).includes(dossier))
    throw new Error(`Type de dossier inconnu : « ${dossier} » (référentiel DOSSIER attendu).`)
}

const copies = (types: readonly Readonly<EtapeTypeProcessus>[]): EtapeTypeProcessus[] => types.map((t) => ({ ...t }))

/**
 * Types d'étapes proposés pour un dossier (sélecteur « Étape type ») : ses types propres puis le type commun ; le type
 * commun seul pour un dossier consulté sans type propre ; null pour un dossier non relevé. Copies : les modifier ne touche
 * pas le référentiel. Refus : type de dossier hors référentiel DOSSIER.
 */
export function typesEtapesDuDossier(dossier: Dossier): EtapeTypeProcessus[] | null {
  verifierDossier(dossier)
  if (estOutille(dossier)) return copies([...TYPES_ETAPES_PAR_DOSSIER[dossier], TYPE_ETAPE_COMMUN])
  return DOSSIERS_SANS_TYPE_PROPRE.includes(dossier) ? copies([TYPE_ETAPE_COMMUN]) : null
}

/**
 * Types propres d'un dossier outillé retenus pour une suite (processus, modèle) : sans « Copie au CS pour info » tant que
 * l'usage du cabinet n'est pas activé (J24, J41 : inactif par défaut).
 */
function typesDeLaSuite(dossier: DossierOutille, usages: UsagesEtapesCabinet): EtapeTypeProcessus[] {
  if (!estOutille(dossier)) throw new Error(`Aucun processus d’étapes relevé pour le dossier « ${dossier} ».`)
  return copies(
    TYPES_ETAPES_PAR_DOSSIER[dossier].filter((t) => usages.copieAuCsPourInfo || t.etapeType !== ETAPE_TYPE_COPIE_AU_CS_POUR_INFO),
  )
}

/**
 * Processus d'un dossier outillé (sans le type commun), à passer à enchainerEtapeDossier ; copie. J41 : sans réglage du
 * cabinet qui active l'usage, le processus du contentieux s'arrête à la mise en demeure. J76 : aucun délai (null) ;
 * enchaînée telle quelle, l'étape suivante n'a pas de limite. Pour des limites, passer par modeleDuDossier, les délais
 * saisis par le cabinet, puis processusDuModele.
 */
export function processusDuDossier(
  dossier: DossierOutille,
  usages: UsagesEtapesCabinet = USAGES_ETAPES_CABINET_PAR_DEFAUT,
): EtapeTypeProcessus[] {
  return typesDeLaSuite(dossier, usages)
}

// ─── Modèle de liste de contrôle, paramétré par le cabinet ─────────────────────────────────

/** 🔵 Garde-fou VitFix (dix ans de 365 jours) : au-delà, faute de saisie. Délai de GESTION, jamais légal. */
export const DELAI_ETAPE_MAX_JOURS = 3_650

/** 🔵 Garde-fou VitFix : le plus long processus relevé compte 14 étapes. */
export const ETAPES_PAR_MODELE_MAX = 100

export interface EtapeModele {
  /** Clé stable de l'étape dans le modèle (code d'étape type) ; le renommage ne la change pas. */
  etapeType: string
  titre: string
  /**
   * Délai de GESTION saisi par le cabinet, en jours entiers, compté depuis la limite de l'étape précédente (depuis le
   * départ pour la première) ; null : non saisi, l'étape instanciée n'a pas de limite.
   */
  delaiJours: number | null
  /** Recopiées dans les instructions de l'étape instanciée. */
  instructions: string
}

export interface ModeleListeControle {
  id: string
  titre: string
  /** Type de dossier auquel les étapes instanciées se rattachent (référentiel DOSSIER, point 47). */
  dossier: Dossier
  /** Classe Gestéam correspondante (tranche 40), pour la traçabilité ; null si aucune. */
  classe: ClasseListeDeControle | null
  /** Dans l'ordre de la liste. */
  etapes: EtapeModele[]
}

export interface SaisieEtapeModele {
  etapeType: string
  titre: string
  /** Absent : null (non saisi). */
  delaiJours?: number | null
  instructions?: string
}

export interface SaisieModeleListeControle {
  id: string
  titre: string
  dossier: Dossier
  classe?: ClasseListeDeControle | null
  etapes: readonly SaisieEtapeModele[]
}

/** Comparaison des titres : espaces de bord retirés, espaces internes réduits, casse ignorée. */
const cleTitre = (titre: string): string => titre.trim().replaceAll(/\s+/g, ' ').toLocaleLowerCase('fr-FR')

function verifierDelai(delaiJours: number | null, quoi: string): void {
  if (delaiJours !== null && (!Number.isInteger(delaiJours) || delaiJours < 0 || delaiJours > DELAI_ETAPE_MAX_JOURS))
    throw new Error(
      `${quoi} : délai de gestion invalide (${delaiJours}) : nombre entier de jours entre 0 et ${DELAI_ETAPE_MAX_JOURS} attendu.`,
    )
}

function verifierEtapeModele(saisie: SaisieEtapeModele, rang: number, titreModele: string): EtapeModele {
  const etapeType = saisie.etapeType.trim()
  if (!etapeType) throw new Error(`Modèle « ${titreModele} », étape ${rang} : type d’étape attendu.`)
  const titre = saisie.titre.trim()
  if (!titre) throw new Error(`Modèle « ${titreModele} », étape ${rang} : titre attendu.`)
  const delaiJours = saisie.delaiJours ?? null
  verifierDelai(delaiJours, `Modèle « ${titreModele} », étape « ${etapeType} »`)
  return { etapeType, titre, delaiJours, instructions: (saisie.instructions ?? '').trim() }
}

/** Types et titres comparés de la même façon : espaces et casse ignorés (deux codes qui ne diffèrent que par la casse sont une faute de saisie). */
function verifierEtapesUniques(etapes: readonly EtapeModele[], titreModele: string): void {
  const types = new Set<string>()
  const titres = new Set<string>()
  for (const etape of etapes) {
    if (types.has(cleTitre(etape.etapeType)))
      throw new Error(`Modèle « ${titreModele} » : type d’étape « ${etape.etapeType} » en double.`)
    if (titres.has(cleTitre(etape.titre))) throw new Error(`Modèle « ${titreModele} » : titre « ${etape.titre} » en double.`)
    types.add(cleTitre(etape.etapeType))
    titres.add(cleTitre(etape.titre))
  }
}

/**
 * Modèle contrôlé. Refus : identifiant ou titre vides ; type de dossier hors référentiel DOSSIER ; classe hors des 37
 * classes « Liste de contrôle - … » ; aucune étape ou plus de ETAPES_PAR_MODELE_MAX ; type d'étape ou titre vides ; type
 * ou titre en double (casse et espaces ignorés) ; délai non entier, négatif ou au-delà de DELAI_ETAPE_MAX_JOURS. La
 * saisie reçue n'est pas modifiée. Sert aussi à recontrôler un modèle relu d'un stockage.
 */
export function creerModeleListeControle(saisie: SaisieModeleListeControle): ModeleListeControle {
  const id = saisie.id.trim()
  if (!id) throw new Error('Modèle de liste de contrôle : identifiant du modèle attendu.')
  const titre = saisie.titre.trim()
  if (!titre) throw new Error('Modèle de liste de contrôle : titre du modèle attendu.')
  verifierDossier(saisie.dossier)
  const classe = saisie.classe ?? null
  if (classe !== null && !CLASSES_ADMISES.has(classe)) throw new Error(`Classe de liste de contrôle inconnue : « ${classe} ».`)
  if (saisie.etapes.length === 0) throw new Error(`Modèle « ${titre} » : au moins une étape attendue.`)
  if (saisie.etapes.length > ETAPES_PAR_MODELE_MAX)
    throw new Error(`Modèle « ${titre} » : ${saisie.etapes.length} étapes, au plus ${ETAPES_PAR_MODELE_MAX} attendues.`)
  const etapes = saisie.etapes.map((etape, i) => verifierEtapeModele(etape, i + 1, titre))
  verifierEtapesUniques(etapes, titre)
  return { id, titre, dossier: saisie.dossier, classe, etapes }
}

export function renommerModele(modele: ModeleListeControle, titre: string): ModeleListeControle {
  return creerModeleListeControle({ ...modele, titre })
}

function rangDeLEtape(modele: ModeleListeControle, etapeType: string): number {
  const i = modele.etapes.findIndex((e) => e.etapeType === etapeType.trim())
  if (i < 0) throw new Error(`Modèle « ${modele.titre} » : aucune étape de type « ${etapeType} ».`)
  return i
}

function verifierRang(rang: number, max: number, geste: string): void {
  if (!Number.isInteger(rang) || rang < 1 || rang > max)
    throw new Error(`${geste} refusé : rang invalide (${rang}) : entier de 1 à ${max} attendu.`)
}

/** Ajoute une étape au rang donné (1 = en tête ; par défaut, en fin). Le modèle reçu n'est pas modifié. */
export function ajouterEtapeModele(
  modele: ModeleListeControle,
  etape: SaisieEtapeModele,
  rang: number = modele.etapes.length + 1,
): ModeleListeControle {
  verifierRang(rang, modele.etapes.length + 1, 'Ajout')
  const etapes: SaisieEtapeModele[] = [...modele.etapes]
  etapes.splice(rang - 1, 0, etape)
  return creerModeleListeControle({ ...modele, etapes })
}

/** Retire une étape. Refus : type absent, dernière étape (une liste de contrôle n'est jamais vide). */
export function retirerEtapeModele(modele: ModeleListeControle, etapeType: string): ModeleListeControle {
  const i = rangDeLEtape(modele, etapeType)
  if (modele.etapes.length === 1) throw new Error(`Retrait refusé : le modèle « ${modele.titre} » doit garder au moins une étape.`)
  return creerModeleListeControle({ ...modele, etapes: modele.etapes.filter((_, j) => j !== i) })
}

/** Champ absent : inchangé ; `delaiJours: null` efface le délai. */
export interface ModificationEtapeModele {
  titre?: string
  delaiJours?: number | null
  instructions?: string
}

/** Modifie titre, délai ou instructions d'une étape ; le type (clé stable) ne change pas. Mêmes contrôles qu'à la création. */
export function modifierEtapeModele(
  modele: ModeleListeControle,
  etapeType: string,
  modification: ModificationEtapeModele,
): ModeleListeControle {
  const i = rangDeLEtape(modele, etapeType)
  const actuelle = modele.etapes[i]
  const nouvelle: SaisieEtapeModele = {
    etapeType: actuelle.etapeType,
    titre: modification.titre ?? actuelle.titre,
    delaiJours: modification.delaiJours === undefined ? actuelle.delaiJours : modification.delaiJours,
    instructions: modification.instructions ?? actuelle.instructions,
  }
  return creerModeleListeControle({ ...modele, etapes: modele.etapes.map((e, j) => (j === i ? nouvelle : e)) })
}

export function renommerEtapeModele(modele: ModeleListeControle, etapeType: string, titre: string): ModeleListeControle {
  return modifierEtapeModele(modele, etapeType, { titre })
}

/** Délai de GESTION de l'étape, en jours ; null : effacé (l'étape instanciée n'aura pas de limite). */
export function fixerDelaiEtapeModele(modele: ModeleListeControle, etapeType: string, delaiJours: number | null): ModeleListeControle {
  return modifierEtapeModele(modele, etapeType, { delaiJours })
}

/** Place l'étape au rang donné (1 à n), les autres gardant leur ordre relatif. */
export function deplacerEtapeModele(modele: ModeleListeControle, etapeType: string, rang: number): ModeleListeControle {
  const i = rangDeLEtape(modele, etapeType)
  verifierRang(rang, modele.etapes.length, 'Déplacement')
  const etapes = [...modele.etapes]
  const [etape] = etapes.splice(i, 1)
  etapes.splice(rang - 1, 0, etape)
  return creerModeleListeControle({ ...modele, etapes })
}

/**
 * Le processus Gestéam d'un dossier outillé en modèle paramétrable : délais non saisis (null), à fixer par le cabinet. J41 :
 * sans réglage du cabinet qui active l'usage, pas de « Copie au CS pour info » (l'instanciation ne la crée donc pas).
 */
export function modeleDuDossier(
  dossier: DossierOutille,
  { id, titre }: { id: string; titre: string },
  usages: UsagesEtapesCabinet = USAGES_ETAPES_CABINET_PAR_DEFAUT,
): ModeleListeControle {
  return creerModeleListeControle({
    id,
    titre,
    dossier,
    etapes: typesDeLaSuite(dossier, usages).map(({ etapeType, titre: titreEtape }) => ({ etapeType, titre: titreEtape, delaiJours: null })),
  })
}

/**
 * Le modèle en EtapeTypeProcessus[], pour enchainerEtapeDossier (délai après la réalisation de l'étape précédente).
 * Délai non saisi : null, gardé tel quel (J76 : aucun délai par défaut) ; l'étape enchaînée n'a alors pas de limite,
 * comme dans la liste instanciée (limitesDuModele). Refus : modèle invalide.
 */
export function processusDuModele(modele: ModeleListeControle): EtapeTypeProcessus[] {
  const controle = creerModeleListeControle(modele)
  return controle.etapes.map(({ etapeType, titre, delaiJours }) => ({ etapeType, titre, delaiJours }))
}

/**
 * Limites prévues de chaque étape pour un départ donné : départ + délais cumulés ; null pour une étape sans délai, qui
 * n'ajoute rien au cumul. Délais de GESTION. Refus : départ invalide, limite hors calendrier, modèle invalide.
 */
export function limitesDuModele(modele: ModeleListeControle, depart: string): (string | null)[] {
  const controle = creerModeleListeControle(modele)
  if (!estDateIsoValide(depart)) throw new Error(`Date de départ invalide (${depart}) : AAAA-MM-JJ attendu.`)
  let cumul = 0
  return controle.etapes.map((etape) => {
    if (etape.delaiJours === null) return null
    cumul += etape.delaiJours
    const limite = ajouterJours(depart, cumul)
    if (!estDateIsoValide(limite))
      throw new Error(
        `Modèle « ${controle.titre} », étape « ${etape.titre} » : limite hors calendrier (départ le ${dateIsoVersFr(depart)} + ${cumul} jours).`,
      )
    return limite
  })
}

// ─── Instanciation ──────────────────────────────────────────────────────────────────────────

export interface InstanciationListeControle {
  /** Un identifiant par étape du modèle, dans l'ordre (fournis par l'appelant, comme pour creerEtapeDossier). */
  ids: readonly string[]
  /** Identifiant du dossier, du type du modèle (rattachement du point 47). */
  dossierId: string
  /** Date de création des étapes et point de départ des délais (AAAA-MM-JJ). */
  depart: string
  /** Collaborateur qui instancie la liste : « Créée par » (J20). */
  creeeParId: string
  demandeurId: string
  demandeurNature: NatureDemandeurEtape
  realisateurId?: string | null
  validateurId?: string | null
  /** Rattachements supplémentaires (copropriété, identité…), sans doublon avec celui du dossier. */
  rattachements?: readonly Rattachement[]
}

export interface ListeControleInstanciee {
  modeleId: string
  /** Titre du modèle au jour de l'instanciation. */
  titre: string
  dossier: Rattachement
  depart: string
  /** Dans l'ordre du modèle au jour de l'instanciation. */
  etapes: EtapeDossier[]
}

function verifierIdentifiants(ids: readonly string[], attendus: number): void {
  if (ids.length !== attendus)
    throw new Error(`Instanciation refusée : ${attendus} identifiants d’étape attendus (un par étape du modèle), ${ids.length} reçus.`)
  const vus = new Set<string>()
  for (const id of ids.map((brut) => brut.trim()).filter(Boolean)) {
    if (vus.has(id)) throw new Error(`Instanciation refusée : identifiant d’étape « ${id} » en double.`)
    vus.add(id)
  }
}

/**
 * Instancie le modèle : une EtapeDossier par étape (creerEtapeDossier), à faire, créée le jour du départ, d'origine
 * « manuelle » par le collaborateur qui instancie (J20), rattachée au dossier du modèle puis aux rattachements fournis,
 * limite = départ + délais cumulés (limitesDuModele), instructions du modèle. Refus : modèle invalide ; collaborateur
 * vide ; identifiants en nombre différent des étapes, vides ou en double ; dossier sans identifiant ; départ invalide ; et
 * les refus de creerEtapeDossier (demandeur vide, nature inconnue…).
 */
export function instancierModele(modele: ModeleListeControle, instanciation: InstanciationListeControle): ListeControleInstanciee {
  const controle = creerModeleListeControle(modele)
  const creeeParId = instanciation.creeeParId.trim()
  if (!creeeParId) throw new Error('Instanciation refusée : collaborateur qui instancie la liste attendu (« Créée par », décision J20).')
  verifierIdentifiants(instanciation.ids, controle.etapes.length)
  const dossier = creerRattachement(controle.dossier, instanciation.dossierId)
  const limites = limitesDuModele(controle, instanciation.depart)
  const rattachements = [dossier, ...(instanciation.rattachements ?? [])]
  const etapes = controle.etapes.map((etape, i) =>
    creerEtapeDossier({
      id: instanciation.ids[i],
      titre: etape.titre,
      etapeType: etape.etapeType,
      creeeLe: instanciation.depart,
      origine: 'manuelle',
      creeeParId,
      demandeurId: instanciation.demandeurId,
      demandeurNature: instanciation.demandeurNature,
      realisateurId: instanciation.realisateurId ?? null,
      validateurId: instanciation.validateurId ?? null,
      limite: limites[i],
      rattachements,
      instructions: etape.instructions,
    }),
  )
  return { modeleId: controle.id, titre: controle.titre, dossier, depart: instanciation.depart, etapes }
}

/** Remplace une étape de la liste par sa nouvelle version (réalisée, validée, reprogrammée). La liste reçue n'est pas modifiée. */
export function remplacerEtapeListe(liste: ListeControleInstanciee, etape: EtapeDossier): ListeControleInstanciee {
  if (!liste.etapes.some((e) => e.id === etape.id)) throw new Error(`Étape « ${etape.id} » absente de la liste « ${liste.titre} ».`)
  return { ...liste, etapes: liste.etapes.map((e) => (e.id === etape.id ? etape : e)) }
}

// ─── Avancement ─────────────────────────────────────────────────────────────────────────────

export interface ProchaineEtapeListe {
  /** Rang dans la liste, à partir de 1. */
  rang: number
  id: string
  titre: string
  etapeType: string | null
  limite: string | null
  enRetard: boolean
}

export interface AvancementListeControle {
  total: number
  /** Étapes faites (« fait le » renseigné), validées ou non. */
  realisees: number
  aValider: number
  /** Validées, ou réalisées sans validation prévue ou « sans objet ». */
  terminees: number
  /** Étapes à faire dont la limite est dépassée au jour donné. */
  enRetard: number
  /** Réalisées sur total, en pour cent, arrondi à l'inférieur. */
  pourcentage: number
  /** Toutes terminées. */
  terminee: boolean
  /** Première étape encore à faire dans l'ordre du modèle ; null si aucune. */
  prochaine: ProchaineEtapeListe | null
}

/** Avancement au jour donné (statuts d'etapes.etatEtape). Refus : date du jour invalide. */
export function avancementListeControle(liste: ListeControleInstanciee, aujourdhui: string): AvancementListeControle {
  verifierAujourdhui(aujourdhui)
  const etats = liste.etapes.map((etape) => etatEtape(etape, aujourdhui))
  const compter = (critere: (etat: (typeof etats)[number]) => boolean): number => etats.filter(critere).length
  const total = liste.etapes.length
  const realisees = compter((e) => e.statut !== 'a_faire')
  const terminees = compter((e) => e.statut === 'validee' || e.statut === 'terminee')
  const rang = etats.findIndex((e) => e.statut === 'a_faire')
  const suivante = rang >= 0 ? liste.etapes[rang] : undefined
  return {
    total,
    realisees,
    aValider: compter((e) => e.statut === 'a_valider'),
    terminees,
    enRetard: compter((e) => e.enRetard),
    pourcentage: total === 0 ? 0 : Math.floor((realisees * 100) / total),
    terminee: total > 0 && terminees === total,
    prochaine: suivante
      ? {
          rang: rang + 1,
          id: suivante.id,
          titre: suivante.titre,
          etapeType: suivante.etapeType,
          limite: suivante.limite,
          enRetard: etats[rang].enRetard,
        }
      : null,
  }
}

// ─── Premier modèle : prise de fonction (prise-de-fonction.ts) ─────────────────────────────

export const ID_MODELE_PRISE_DE_FONCTION = 'prise-de-fonction'

/**
 * Les 8 diligences de construireChecklistPriseFonction en modèle : libellé en titre, fondement cité (« art ») en
 * instructions, code « prise-de-fonction.<n° de diligence> », sans délai (les délais légaux cités restent au moteur de
 * délais). `fondement` (celui du mandat) choisit le régime, comme dans la check-list d'origine. Les statuts de départ et
 * le service ne sont pas repris.
 */
export function modelePriseDeFonction({ fondement = null }: { fondement?: string | null } = {}): ModeleListeControle {
  const diligences = construireChecklistPriseFonction({ code: '', fondement, impayes: 0 })
  return creerModeleListeControle({
    id: ID_MODELE_PRISE_DE_FONCTION,
    titre: 'Prise de fonction',
    dossier: 'Mandat de syndic',
    classe: 'Liste de contrôle - Mandat',
    etapes: diligences.map((d) => ({ etapeType: `prise-de-fonction.${d.id}`, titre: d.label, delaiJours: null, instructions: d.art })),
  })
}

// ─── Second modèle : reprise des pièces auprès de l'ancien syndic (reprise.ts) ─────────────

export const ID_MODELE_REPRISE = 'reprise-ancien-syndic'

/**
 * Délai d'une pièce cité en clair dans les instructions, toujours qualifié de LÉGAL pour ne pas se confondre avec le délai
 * de gestion du modèle : « pratique » n'est pas un délai (reprise.ts : sans délai légal) ; « apurement » se lit comme à
 * l'écran de reprise (deux mois après le délai d'un mois). Marque « à confirmer » reprise de la certitude de la règle du
 * moteur de délais (REGLE_MOTEUR_PAR_DELAI_PIECE → REGLES_DELAIS_LEGAUX) : toute certitude autre que TEXTE, ou une règle
 * introuvable, la porte.
 */
function delaiCiteDeLaPiece(piece: PieceReprise): string {
  if (piece.delai === 'pratique') return 'sans délai légal'
  const regle = REGLES_DELAIS_LEGAUX.find((r) => r.id === REGLE_MOTEUR_PAR_DELAI_PIECE[piece.delai])
  const delai = piece.delai === 'apurement' ? "deux mois après le délai d'un mois" : piece.delai
  return `délai légal cité : ${delai}${regle?.certitude === 'TEXTE' ? '' : ' (à confirmer)'}`
}

/**
 * Les 12 pièces de PIECES_REPRISE en modèle (liste de contrôle « Mandat ») : libellé en titre, base et délai légal cités
 * en instructions (delaiCiteDeLaPiece), code « reprise.<clé de pièce> », sans délai de gestion (les délais légaux de
 * remise restent au moteur de délais : REGLE_MOTEUR_PAR_DELAI_PIECE).
 */
export function modeleReprise(): ModeleListeControle {
  return creerModeleListeControle({
    id: ID_MODELE_REPRISE,
    titre: "Reprise des pièces auprès de l'ancien syndic",
    dossier: 'Mandat de syndic',
    classe: 'Liste de contrôle - Mandat',
    etapes: PIECES_REPRISE.map((p) => ({
      etapeType: `reprise.${p.cle}`,
      titre: p.libelle,
      delaiJours: null,
      instructions: `Base : ${p.base} · ${delaiCiteDeLaPiece(p)}`,
    })),
  })
}
