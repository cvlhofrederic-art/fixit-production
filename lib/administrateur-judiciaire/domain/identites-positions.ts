import type { LotEnregistre } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Tantiemes } from '@/lib/administrateur-judiciaire/domain/format'
import { formaterNumeroCompte } from '@/lib/administrateur-judiciaire/domain/plan-comptable'
import { normaliserTexte } from '@/lib/administrateur-judiciaire/domain/texte'
import { GROUPE_IDENTITE, QUALITE_IDENTITE, type GroupeIdentite } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Décision D2 (Hugo Carvalho, 27/10/2026) — Identité / Position / Compte copropriétaire. Fonctions pures, dates ISO
 * (AAAA-MM-JJ), sans écran. Tables : version 3 de la base locale (db/schema.ts : identites, positions,
 * comptesCoproprietaires), écrites par ces fonctions.
 *
 * Gestéam — fiche client (tranche 30) : la position (« client » : compte, statut En place / Futur…) porte une grille
 * Identité · Relation · Part ; les relations sont les qualités de QUALITE_IDENTITE (tranche 20). Le compte 450 porte un
 * numéro de SÉRIE, pas l'identité (tranche 24) ; son premier segment est celui du syndicat (D1).
 *
 * Périmètre VitFix : blocs copropriete, location, personnel (et autre) de QUALITE_IDENTITE ; la gérance est hors champ.
 * Règles de contrôle d'un lot : un propriétaire au moins ; pleine propriété OU démembrement (nue-propriété + usufruit),
 * jamais les deux ; parts de chaque droit = 1 ; un seul compte pour les droits de propriété du lot (une dette = un compte).
 *
 * Point 59 du bilan 2 — coordonnées et rattachements (Gestéam, tranche 37 § Identités : adresses « À partir du …
 * jusqu'au … », bouton Représentant légal, groupes ; tranche 39 : grilles Positions et Participations).
 * - Adresses datées, bornes INCLUSES (les positions, elles, sont semi-ouvertes : sorties le jour de leur sortie).
 * - 🟢 D. 1967 art. 65 al. 2 (décret n° 2025-1292, en vigueur le 25/12/2025) : notifications et mises en demeure
 *   « valablement faites à la dernière adresse électronique ou au dernier domicile communiqué par le copropriétaire à
 *   cet effet » ; aucun délai de prise d'effet d'un changement d'adresse.
 * - 🔵 Déduit : une adresse vaut pour la notification dès sa réception par le syndic (communiqueeLe), et au plus tôt
 *   à sa date de début ; parmi les adresses en cours à la date, la dernière à prendre effet l'emporte (une adresse
 *   temporaire de correspondance prime l'adresse permanente pendant sa période) ; à prise d'effet égale, l'adresse
 *   bornée l'emporte ; sinon aucune n'est retenue et le contrôle le signale. Si aucune adresse n'est en cours (ancienne
 *   adresse close, nouvelle pas encore reçue), la dernière communiquée reste l'adresse de notification, et le contrôle
 *   signale qu'elle est échue.
 * - J67, R19 (décision de Hugo du 17/11/2026) : seule vaut pour notifier l'adresse communiquée par le copropriétaire
 *   lui-même (D. 1967 art. 65, al. 1 : il « notifie au syndic son domicile réel ou élu » ; al. 2 : notification valable
 *   « au dernier domicile communiqué par le copropriétaire à cet effet ») ou par la notification du transfert de
 *   propriété, qui porte le « domicile réel ou élu » de l'acquéreur (art. 6, al. 2). Chaque adresse porte donc son
 *   origine (ORIGINES_ADRESSE). Une adresse d'origine « autre » (courrier retourné, recherche, annuaire, adresse donnée
 *   pour un autre usage) ne sert jamais à notifier ; elle reste parmi les adresses valables, pour un courrier simple :
 *   à défaut d'adresse de notification, la dernière adresse « autre » en cours sert à la lettre simple
 *   (adressePourCourrierSimple, avec un avertissement : controlerAdresseDeCourrierSimple), comme l'avis d'appel de fonds
 *   (D. 1967 art. 35-2). Origine inconnue (reprise de Gestéam) : adresse admise, avec l'alerte « origine à vérifier »
 *   avant une notification (controlerAdresseDeNotification). Enregistrement de l'origine : à brancher avec la table des
 *   identités.
 * - Groupes bornés par GROUPE_IDENTITE ; représentant légal daté, réservé à la personne morale (plusieurs co-gérants
 *   possibles) ; participations DÉRIVÉES des positions (D2 : la part est portée par la position), sans entité.
 * 🟢 Adresse électronique de notification datée : voie-notification.ts (CommunicationAdresseElectronique, reçue le
 * communiqueeLe ; adresseElectroniqueDeNotification retient la dernière reçue à la date), appelée par avis-appel.ts ; les
 * télécoms (Telecom) restent sans date, voulu : l'adresse de notification n'est pas un simple télécom ; contrôle avant
 * envoi : controlerAvantEnvoiElectronique (voie-notification.ts), écrit et testé, à brancher par l'appelant de
 * creerEnvoiNotificationElectronique (anomaliesAvantEnvoi).
 * J78 (réponse de Frédéric du 17/11/2026, sj-qualite-pro.json) : case « professionnel » sur la fiche identité, décochée
 * par défaut (Identite.professionnel, facultative). Décochée ou absente : destinataire non professionnel ; une LRE exige
 * alors son consentement, qui reste l'accord du critère LRE repris de Gestéam (CPCE art. L. 100 ; J53 ; accord sans
 * date valable écarté : J59, étendu par J66 (validé par Hugo le 17/11/2026) à tout usage, consentement de J53 compris ;
 * code : accordElectroniqueEnVigueur, voie-notification.ts, PR #728 ; les commentaires de voie-notification.ts
 * (accordElectroniqueEnVigueur, estAccordSansDateValable, en-tête) disent encore l'extension « à confirmer » : à mettre
 * à jour à part). Cochée : ce consentement n'est pas exigé ; les autres règles restent (voie postale : J52, J74 ; accord
 * exprès avant le 25/12/2025 : J50). Lecture sans date (état saisi, pour l'affichage) : qualiteProfessionnelleDe ; à
 * la date de l'envoi : qualite-professionnelle.ts (qualiteProfessionnelleA).
 * Qualité de chaque destinataire pour le contrôle J53, lue à la date de son envoi : avecQualiteProfessionnelleALEnvoi
 * (qualite-professionnelle.ts), écrit et testé, à brancher par l'appelant de finDelaiContestationAgParDestinataire
 * (aucun aujourd'hui) ; la case y est la seule source : identité introuvable, null ; identité en double dans les
 * fiches : erreur (données incohérentes). avecQualiteProfessionnelle, qui lit la case sans date, ne sert plus au
 * contrôle J53 (J78 : décocher la case plus tard ne change pas les envois déjà faits). finDelaiContestationAg
 * (notification unique) : la qualité reste une option de l'appelant, qui passe qualiteProfessionnelleALEnvoi(fiche de
 * courrier.personneId, courrier) ; le domaine ne la relie pas à la fiche (statut-assemblee.ts : seule la date de
 * l'envoi, dateEnvoiNotification, est extraite d'evaluerNotification, sans changer le calcul). Table : identites
 * (version 3 de db/schema.ts) ; écriture de la case : enregistrerQualiteProfessionnelle (db/identites.ts) ; écran : à
 * brancher.
 * J78, décisions de Hugo du 19/11/2026 (« VALIDE TOUT », puis « ok » pour la date de lecture, sur les recommandations de
 * Claude) : à coder avec la table des identités, pas ici ; à valider par Frédéric avant toute fusion. Elles remplacent
 * les deux questions laissées à Hugo.
 * - Case datée : la qualité se lit à la date de l'envoi. Date retenue (« ok » de Hugo du 19/11/2026) : date du dépôt de
 *   l'envoi quand elle est saisie, sinon celle de l'événement. Elle reprend la lecture de J50 (statut-assemblee.ts,
 *   controlerVoie : régime, accord exprès, consentement et demande de voie postale jugés à cette date), qui reste
 *   ouverte en J50 (🔵) : cette décision ne tranche pas J50 ; si J50 est tranchée autrement, les deux dates se relisent
 *   ensemble. Précision (choix de rédaction de Claude, relecture du 19/11/2026) : le code de J50 (statut-assemblee.ts,
 *   evaluerNotification) ne garde le dépôt que s'il ne suit pas l'événement ; sinon, il retient l'événement. L'en-tête
 *   de statut-assemblee.ts et le registre (J50) ne le disent pas. Dans ce calcul, la case ne compte que pour une LRE
 *   (J53), et une LRE dont l'avis précède le dépôt est refusée avant (preuve_a_saisir) : aucun écart aujourd'hui. Codé
 *   avec la table des identités : la date est celle que ce code calcule (dateEnvoiNotification, extraite
 *   d'evaluerNotification sans recopie ; qualite-professionnelle.ts). Décocher la case plus tard ne change pas le
 *   calcul des envois déjà faits. Aujourd'hui, qualiteProfessionnelleDe lit l'état actuel de la case, sans date. Ce
 *   lecteur ne change pas ici. Lien entre cette case sans date et la case datée (proposé, à valider par Frédéric ;
 *   qualite-professionnelle.ts) : la case sans date est le dernier état saisi ; la lecture à la date de l'envoi ne lit
 *   que les états datés, qui prennent effet le lendemain de leur saisie.
 * - Case cochée seulement sur une justification écrite (par exemple une société qui reçoit l'envoi pour son activité,
 *   avec son SIREN), jamais du seul fait d'être une personne morale. Le SIREN n'est qu'un exemple : aucun texte lu ne
 *   l'exige. Cochée à tort, la notification est irrégulière et le délai ne court pas. Repère : code de la consommation,
 *   article liminaire (version en vigueur depuis le 24/04/2024, loi n° 2024-364 du 22/04/2024, art. 2 ; lu sur
 *   Légifrance le 19/11/2026) : « Non-professionnel : toute personne morale qui n'agit pas à des fins
 *   professionnelles » (2°) ; « Professionnel : toute personne physique ou morale, publique ou privée, qui agit à des
 *   fins entrant dans le cadre de son activité commerciale, industrielle, artisanale, libérale ou agricole […] » (3°).
 *   Une personne morale peut donc être non professionnelle. 🔵 Ces définitions valent « pour l'application du présent
 *   code » ; CPCE art. L. 100 ne définit pas « professionnel » et n'y renvoie pas : les reprendre ici est une lecture
 *   par analogie, à vérifier.
 *
 * 🔴 Non établi : l'usage de l'adresse reste libre, valeurs Gestéam du champ « Usage » non relevées ; choix du jeu de
 * coordonnées par compte ou par syndicat (dans Gestéam, la fiche client désigne son jeu de coordonnées ; ici, l'adresse
 * vaut pour l'identité entière) ; parts sociales d'un associé de SCI qui n'est pas lui-même titulaire d'une position
 * (hors champ).
 */

const QUALITES_COPROPRIETE = QUALITE_IDENTITE.copropriete
export const QUALITES_POSITION = [
  ...QUALITE_IDENTITE.copropriete,
  ...QUALITE_IDENTITE.location,
  ...QUALITE_IDENTITE.personnel,
  ...QUALITE_IDENTITE.autre,
] as const
export type QualitePosition = (typeof QUALITES_POSITION)[number]

const PLEINE_PROPRIETE: readonly string[] = ['Copropriétaire', 'Indivisaire', 'Associé(e)']

export const estQualiteCopropriete = (qualite: QualitePosition): boolean => (QUALITES_COPROPRIETE as readonly string[]).includes(qualite)

export interface Telecom {
  nature: string
  valeur: string
}

/**
 * J67, R19 — origine d'une adresse : communiquée par le copropriétaire (D. 1967 art. 65, al. 1), notification du
 * transfert de propriété (art. 6, al. 2), ou autre (trouvée autrement : jamais pour notifier).
 */
export const ORIGINES_ADRESSE = ['coproprietaire', 'transfert_art_6', 'autre'] as const
export type OrigineAdresse = (typeof ORIGINES_ADRESSE)[number]
const ORIGINES_ADMISES: ReadonlySet<string> = new Set(ORIGINES_ADRESSE)

/** Adresse postale datée : valable du `du` au `au` INCLUS (au null : sans fin). */
export interface AdresseDatee {
  id: string
  lignes: string[]
  codePostal: string
  ville: string
  pays: string
  /** Usage de l'adresse (Gestéam « Usage », valeurs non relevées) ; null : aucun. */
  usage: string | null
  du: string
  au: string | null
  /** Réception de l'adresse par le syndic (D. 1967 art. 65) ; null : inconnue, la date de début fait foi. */
  communiqueeLe: string | null
  /** J67, R19 — origine de l'adresse ; absente ou null : inconnue (reprise de Gestéam), admise avec une alerte. */
  origine?: OrigineAdresse | null
}

/** Représentant légal ou statutaire d'une personne morale, du `du` au `au` INCLUS. */
export interface RepresentantLegal {
  /** Identité du représentant (personne physique ou morale). */
  identiteId: string
  /** Gérant, président… ; null : non précisée. */
  fonction: string | null
  du: string
  au: string | null
}

export interface Identite {
  id: string
  nature: 'physique' | 'morale'
  /** Civilité Gestéam (Monsieur, Madame, Indivision, SDC, S.C.I., Société…). */
  civilite: string
  nom: string
  prenom: string | null
  telecoms: Telecom[]
  adresses: AdresseDatee[]
  groupes: GroupeIdentite[]
  /** Vide pour une personne physique. */
  representants: RepresentantLegal[]
  /**
   * J78 — case « professionnel » (CPCE art. L. 100 ; contrôle J53), décochée par défaut. Absente : non saisie, lue comme
   * non professionnelle (qualiteProfessionnelleDe). Non indexée ; enregistrement : enregistrerQualiteProfessionnelle
   * (db/identites.ts) ; écran : à brancher. Sans date ici : c'est le dernier état saisi ; la date et la justification
   * écrite (J78, en-tête) sont dans les états datés de la table des identités (IdentiteEnregistree.historiqueProfessionnel,
   * qualite-professionnelle.ts), seuls lus par le contrôle J53.
   */
  professionnel?: boolean
}

export type SaisieIdentite = Omit<Identite, 'adresses' | 'groupes' | 'representants' | 'professionnel'> &
  Partial<Pick<Identite, 'adresses' | 'groupes' | 'representants'>> & {
    /** J78 : absente ou null (reprise) : non saisie, la case reste décochée. */
    professionnel?: boolean | null
  }

const nettoyer = (texte: string): string => texte.replace(/\s+/g, ' ').trim()

function verifierPeriode(du: string, au: string | null, objet: string): void {
  if (!estDateIsoValide(du)) throw new Error(`Date de début invalide (${du}) pour ${objet} : AAAA-MM-JJ attendu.`)
  if (au === null) return
  if (!estDateIsoValide(au)) throw new Error(`Date de fin invalide (${au}) pour ${objet} : AAAA-MM-JJ attendu.`)
  if (au < du) throw new Error(`${objet} : date de fin antérieure à la date de début.`)
}

/** Pays nettoyé ; « France » par défaut et quelle que soit la graphie (FRANCE, france…). */
function paysDeLAdresse(saisie: string): string {
  const pays = nettoyer(saisie)
  return !pays || normaliserTexte(pays) === 'FRANCE' ? 'France' : pays
}

export function creerAdresseDatee(saisie: AdresseDatee): AdresseDatee {
  const lignes = saisie.lignes.map(nettoyer).filter(Boolean)
  if (lignes.length === 0) throw new Error('Adresse sans ligne (numéro et voie attendus).')
  const ville = nettoyer(saisie.ville)
  if (!ville) throw new Error('Adresse sans ville.')
  const pays = paysDeLAdresse(saisie.pays)
  const codePostal = saisie.codePostal.trim()
  if (pays === 'France' && !/^\d{5}$/.test(codePostal)) throw new Error(`Code postal « ${saisie.codePostal} » : 5 chiffres attendus.`)
  verifierPeriode(saisie.du, saisie.au, `l'adresse « ${saisie.id} »`)
  if (saisie.communiqueeLe !== null && !estDateIsoValide(saisie.communiqueeLe))
    throw new Error(`Date de communication invalide (${saisie.communiqueeLe}) pour l'adresse « ${saisie.id} » : AAAA-MM-JJ attendu.`)
  const origine = saisie.origine ?? null
  if (origine !== null && !ORIGINES_ADMISES.has(origine))
    throw new Error(`Origine « ${String(origine)} » de l'adresse « ${saisie.id} » inconnue (${ORIGINES_ADRESSE.join(', ')}).`)
  return { ...saisie, lignes, codePostal, ville, pays, usage: saisie.usage?.trim() || null }
}

function verifierGroupes(groupes: GroupeIdentite[]): void {
  const vus = new Set<string>()
  for (const groupe of groupes) {
    if (!(GROUPE_IDENTITE as readonly string[]).includes(groupe)) throw new Error(`Groupe « ${groupe} » inconnu.`)
    if (vus.has(groupe)) throw new Error(`Groupe « ${groupe} » en double.`)
    vus.add(groupe)
  }
}

function verifierRepresentants(identite: Pick<Identite, 'id' | 'nature' | 'nom'>, representants: RepresentantLegal[]): void {
  if (representants.length > 0 && identite.nature !== 'morale')
    throw new Error(`${identite.nom} : le représentant légal est réservé à une personne morale.`)
  for (const r of representants) {
    if (!r.identiteId.trim()) throw new Error('Représentant légal : identité attendue.')
    if (r.identiteId.trim() === identite.id) throw new Error(`${identite.nom} : une personne morale ne se représente pas elle-même.`)
    verifierPeriode(r.du, r.au, `le représentant de ${identite.nom}`)
  }
}

/** J78 : case cochée ou décochée gardée ; absente ou null, rien (non saisie) ; toute autre valeur refusée. */
function caseProfessionnel(valeur: unknown, nom: string): Pick<Identite, 'professionnel'> {
  if (valeur === undefined || valeur === null) return {}
  if (typeof valeur !== 'boolean') throw new Error(`Case « professionnel » de ${nom} : cochée ou décochée attendue (reçu « ${String(valeur)} »).`)
  return { professionnel: valeur }
}

export function creerIdentite(saisie: SaisieIdentite): Identite {
  const nom = nettoyer(saisie.nom)
  if (!nom) throw new Error("Nom de l'identité manquant.")
  const adresses = (saisie.adresses ?? []).map(creerAdresseDatee)
  const ids = adresses.map((a) => a.id)
  const doublon = ids.find((id, i) => ids.indexOf(id) !== i)
  if (doublon !== undefined) throw new Error(`Adresse « ${doublon} » en double.`)
  const groupes = saisie.groupes ?? []
  verifierGroupes(groupes)
  const representants = saisie.representants ?? []
  verifierRepresentants({ id: saisie.id, nature: saisie.nature, nom }, representants)
  const { professionnel, ...reste } = saisie
  return {
    ...reste,
    nom,
    prenom: saisie.prenom?.trim() || null,
    adresses,
    groupes: [...groupes],
    representants: representants.map((r) => ({ ...r, identiteId: r.identiteId.trim(), fonction: r.fonction?.trim() || null })),
    ...caseProfessionnel(professionnel, nom),
  }
}

/**
 * J78 — qualité professionnelle du destinataire (CPCE art. L. 100), état actuel de la case, pour l'affichage de la fiche :
 * null si l'identité est absente (non saisie) ; sinon la case de la fiche, décochée par défaut (true seulement si elle
 * est cochée ; toute autre valeur enregistrée : non professionnelle, lecture prudente de J53). Lit l'état actuel de la
 * case, sans date ; la lecture à la date de l'envoi (dépôt saisi, sinon événement : J78, en-tête), seule à passer au
 * contrôle J53, est qualiteProfessionnelleALEnvoi (qualite-professionnelle.ts). Notification unique
 * (finDelaiContestationAg) : l'appelant passe qualiteProfessionnelleALEnvoi(fiche de courrier.personneId, courrier) ;
 * le domaine ne fait pas ce lien.
 */
export function qualiteProfessionnelleDe(identite: Pick<Identite, 'professionnel'> | null | undefined): boolean | null {
  if (identite === null || identite === undefined) return null
  return identite.professionnel === true
}

/**
 * J78 — qualité de chaque destinataire (NotificationDestinataire de statut-assemblee.ts, ou tout objet rattaché à une
 * identité), lue sur sa fiche SANS DATE (qualiteProfessionnelleDe). Ne sert plus au contrôle J53 : la case s'y lit à la
 * date de chaque envoi (avecQualiteProfessionnelleALEnvoi, qualite-professionnelle.ts ; décocher la case plus tard ne
 * change pas les envois déjà faits). La case est la seule source : une valeur donnée par
 * l'appelant est remplacée ; identité introuvable : null (non saisie, lue comme non professionnelle), même si l'appelant
 * avait donné true. Identité en double dans les fiches : erreur (données incohérentes, comme une identité en double dans
 * les notifications du procès-verbal) ; aucune des deux fiches ne l'emporte. L'entrée n'est pas modifiée.
 */
export function avecQualiteProfessionnelle<T extends { identiteId: string }>(
  destinataires: readonly T[],
  identites: readonly Pick<Identite, 'id' | 'professionnel'>[],
): (T & { professionnel: boolean | null })[] {
  const parId = new Map<string, Pick<Identite, 'id' | 'professionnel'>>()
  for (const identite of identites) {
    if (parId.has(identite.id))
      throw new Error(`Identité ${identite.id} en double dans les fiches identité (case « professionnel ») : données incohérentes.`)
    parId.set(identite.id, identite)
  }
  return destinataires.map((d) => ({ ...d, professionnel: qualiteProfessionnelleDe(parId.get(d.identiteId)) }))
}

const dansPeriode = (date: string, du: string, au: string | null): boolean => du <= date && (au === null || date <= au)

function verifierDate(date: string): void {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
}

/** Adresses valables à une date (bornes incluses), dans l'ordre de la fiche. */
export function adressesValablesA(identite: Pick<Identite, 'adresses'>, date: string): AdresseDatee[] {
  verifierDate(date)
  return identite.adresses.filter((a) => dansPeriode(date, a.du, a.au))
}

/** Prise d'effet d'une adresse pour la notification : sa réception par le syndic, au plus tôt sa date de début. */
const priseDEffet = (a: AdresseDatee): string => (a.communiqueeLe !== null && a.communiqueeLe > a.du ? a.communiqueeLe : a.du)

const comparerCandidates = (a: AdresseDatee, b: AdresseDatee): number =>
  priseDEffet(b).localeCompare(priseDEffet(a)) || Number(b.au !== null) - Number(a.au !== null)

/** J67, R19 : une adresse d'origine « autre » ne sert jamais à notifier (origine inconnue : admise, avec une alerte). */
const sertANotifier = (a: AdresseDatee): boolean => a.origine !== 'autre'

/**
 * Adresses candidates à la notification, la dernière à prendre effet en tête (bornée d'abord à égalité) : celles en
 * cours à la date, ou à défaut les adresses communiquées et déjà closes (`echue`). Jamais une adresse « autre ».
 */
function candidatesNotification(identite: Pick<Identite, 'adresses'>, date: string): { candidates: AdresseDatee[]; echue: boolean } {
  verifierDate(date)
  const communiquees = identite.adresses.filter((a) => sertANotifier(a) && priseDEffet(a) <= date)
  const enCours = communiquees.filter((a) => a.au === null || date <= a.au)
  if (enCours.length > 0) return { candidates: enCours.sort(comparerCandidates), echue: false }
  return { candidates: communiquees.sort(comparerCandidates), echue: communiquees.length > 0 }
}

const indiscernables = (a: AdresseDatee, b: AdresseDatee): boolean => priseDEffet(a) === priseDEffet(b) && (a.au === null) === (b.au === null)

/**
 * D. 1967 art. 65 al. 2 — adresse postale de notification à la date : la dernière communiquée qui vaut à cette date,
 * à défaut la dernière communiquée, même close ; jamais une adresse d'origine « autre » (J67, R19) ; null si aucune, ou
 * si deux se valent.
 */
export function adresseDeNotification(identite: Pick<Identite, 'adresses'>, date: string): AdresseDatee | null {
  return premiereRetenue(candidatesNotification(identite, date).candidates)
}

/** Première de candidates triées ; null si aucune, ou si les deux premières se valent. */
function premiereRetenue(candidates: readonly AdresseDatee[]): AdresseDatee | null {
  const [premiere, seconde] = candidates
  if (!premiere) return null
  return seconde && indiscernables(premiere, seconde) ? null : premiere
}

/** Adresses d'origine « autre » reçues et en cours à la date, la dernière à prendre effet en tête. */
const autresEnCours = (identite: Pick<Identite, 'adresses'>, date: string): AdresseDatee[] =>
  identite.adresses.filter((a) => !sertANotifier(a) && priseDEffet(a) <= date && (a.au === null || date <= a.au)).sort(comparerCandidates)

/**
 * J67, R19 — adresse d'un courrier simple, qui n'est pas une notification (lettre simple de l'avis d'appel de fonds,
 * D. 1967 art. 35-2) : l'adresse de notification ; sans aucune adresse de notification, la dernière adresse d'origine
 * « autre » en cours à la date (elle « peut servir pour un courrier simple ») ; null sinon, ou si deux se valent.
 */
export function adressePourCourrierSimple(identite: Pick<Identite, 'adresses'>, date: string): AdresseDatee | null {
  const { candidates } = candidatesNotification(identite, date)
  return premiereRetenue(candidates.length > 0 ? candidates : autresEnCours(identite, date))
}

export interface AnomalieAdresse {
  code: 'sans_adresse' | 'adresses_concurrentes' | 'adresse_echue' | 'origine_a_verifier' | 'adresse_autre'
  message: string
}

/** Sans adresse de notification : les adresses « autre » déjà reçues, écartées (J67, R19), sont nommées. */
function messageSansAdresse(identite: Pick<Identite, 'adresses'>, date: string): string {
  const autres = identite.adresses.filter((a) => !sertANotifier(a) && priseDEffet(a) <= date).map((a) => `« ${a.id} »`)
  if (autres.length === 0) return `Aucune adresse postale communiquée au ${date}.`
  return `Aucune adresse postale communiquée au ${date} : ${autres.join(', ')} (origine « autre ») ne vaut pas pour notifier (D. 1967 art. 65, al. 2 ; J67, R19).`
}

export function controlerAdresses(identite: Pick<Identite, 'adresses'>, date: string): AnomalieAdresse[] {
  const { candidates, echue } = candidatesNotification(identite, date)
  const [premiere, seconde] = candidates
  if (!premiere) return [{ code: 'sans_adresse', message: messageSansAdresse(identite, date) }]
  if (seconde && indiscernables(premiere, seconde))
    return [{ code: 'adresses_concurrentes', message: `Adresses « ${premiere.id} » et « ${seconde.id} » concurrentes : préciser laquelle a été communiquée en dernier.` }]
  if (echue)
    return [
      {
        code: 'adresse_echue',
        message: `Adresse « ${premiere.id} » close le ${premiere.au} : demander la nouvelle adresse ; d'ici là, la dernière adresse communiquée reste valable (D. 1967 art. 65).`,
      },
    ]
  return []
}

/**
 * Contrôle avant une notification : celui de controlerAdresses, et l'alerte « origine à vérifier » quand l'adresse
 * retenue a une origine inconnue (reprise de Gestéam ; J67, R19). Un courrier simple n'en a pas besoin.
 */
export function controlerAdresseDeNotification(identite: Pick<Identite, 'adresses'>, date: string): AnomalieAdresse[] {
  const anomalies = controlerAdresses(identite, date)
  const retenue = adresseDeNotification(identite, date)
  if (retenue === null || (retenue.origine ?? null) !== null) return anomalies
  return [
    ...anomalies,
    {
      code: 'origine_a_verifier',
      message: `Adresse « ${retenue.id} » : origine à vérifier (reprise) ; elle ne vaut pour notifier que si le copropriétaire l'a communiquée à cet effet, ou si elle vient de la notification du transfert de propriété (D. 1967 art. 65, al. 2, et art. 6, al. 2 ; J67, R19).`,
    },
  ]
}

/**
 * Contrôle avant un courrier simple : celui de controlerAdresses ; sans adresse de notification, une adresse « autre »
 * en cours permet l'envoi, avec l'avertissement « adresse_autre » à la place de « sans_adresse » (J67, R19).
 */
export function controlerAdresseDeCourrierSimple(identite: Pick<Identite, 'adresses'>, date: string): AnomalieAdresse[] {
  const retenue = adressePourCourrierSimple(identite, date)
  if (retenue === null || sertANotifier(retenue)) return controlerAdresses(identite, date)
  return [
    {
      code: 'adresse_autre',
      message: `Adresse « ${retenue.id} » (origine « autre ») retenue pour ce courrier simple : elle ne vaudrait pas pour une notification (D. 1967 art. 65, al. 2 ; J67, R19).`,
    },
  ]
}

/** Représentants légaux d'une personne morale à une date (bornes incluses) ; [] pour une personne physique. */
export function representantsLegauxA(identite: Pick<Identite, 'nature' | 'representants'>, date: string): RepresentantLegal[] {
  verifierDate(date)
  return identite.nature === 'morale' ? identite.representants.filter((r) => dansPeriode(date, r.du, r.au)) : []
}

/** Identités d'un groupe (ex. « Copie CS » : copies au conseil syndical), triées par nom. */
export const identitesDuGroupe = (identites: Identite[], groupe: GroupeIdentite): Identite[] =>
  identites.filter((i) => i.groupes.includes(groupe)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

export interface CompteCoproprietaire {
  id: string
  /** D1 : le syndicat. */
  coproprieteId: string
  /** Numéro de série du compte (segment auxiliaire, 5 caractères). */
  serie: string
  libelle: string
  /**
   * Décision J10 (Hugo, 30/10/2026) — identité du mandataire commun des indivisaires du compte (L. 1965 art. 23, al. 2 :
   * désigné d'accord entre eux ou, à défaut, par le président du tribunal judiciaire). Facultatif et non indexé ; absent,
   * null ou vide : aucun désigné. Seul ce mandataire reçoit un règlement destiné à un indivisaire
   * (reglements-fournisseurs.ts, controlerBeneficiaireIndivisaire) ; un remboursement du compte va à lui, ou à tous les
   * indivisaires ensemble (J67, R80 : controlerBeneficiaireCompte).
   */
  mandataireCommunId?: string | null
  /**
   * J67, R80 (17/11/2026) — compte démembré (usufruit, nue-propriété) : accord écrit des deux qui désigne la personne à
   * payer (C. civ. art. 1342-2) ; absent ou null : aucun, le remboursement va aux deux ensemble ou il est refusé
   * (reglements-fournisseurs.ts, controlerBeneficiaireCompte). Enregistrement : à brancher.
   */
  accordPaiementDemembrement?: AccordPaiementDemembrement | null
}

/** Accord écrit de l'usufruitier et du nu-propriétaire sur la personne qui reçoit les paiements du compte (J67, R80). */
export interface AccordPaiementDemembrement {
  /** Identité désignée pour recevoir le paiement. */
  beneficiaireId: string
  /** Pièce de l'accord (document de la GED). */
  documentId: string
  signeLe: string
}

export function creerCompteCoproprietaire(saisie: CompteCoproprietaire): CompteCoproprietaire {
  const brut = saisie.serie.trim().toUpperCase()
  if (!/^[0-9A-Z]{1,5}$/.test(brut)) throw new Error(`Série « ${saisie.serie} » : 1 à 5 caractères alphanumériques attendus.`)
  return { ...saisie, serie: brut.padStart(5, '0'), libelle: saisie.libelle.trim() }
}

/**
 * Numéro du compte copropriétaire : <syndicat>.45000.<série>.0 ; `planCode` : un sous-compte du 450 créé par l'AG (450-1,
 * J67, R104 : repartition-appels.planDuCompteBudget).
 */
export const numeroCompteCoproprietaire = (compte: CompteCoproprietaire, segmentSyndicat: string, planCode = '45000'): string =>
  formaterNumeroCompte({ mandat: segmentSyndicat, planCode, auxiliaire: compte.serie })

export type StatutPosition = 'En place' | 'Futur' | 'Sorti'

/**
 * Nature de la mutation qui fait entrer une position (J67, R111) : à titre onéreux (vente), donation, succession,
 * démembrement. D. 1967 art. 6-2 ne vise que la mutation à titre onéreux ; tout transfert est notifié au syndic (art. 6).
 */
export const NATURES_MUTATION = ['onereuse', 'donation', 'succession', 'demembrement'] as const
export type NatureMutation = (typeof NATURES_MUTATION)[number]

/** Donation ou succession : la règle de la vente (art. 6-2) s'applique par analogie, à confirmer (J67, R111). */
export const estMutationATitreGratuit = (nature: NatureMutation | null | undefined): boolean => nature === 'donation' || nature === 'succession'

export interface Position {
  id: string
  identiteId: string
  lotId: string
  /** Compte du débiteur ; obligatoire pour une qualité de copropriété, null sinon. */
  compteId: string | null
  qualite: QualitePosition
  /** Part du droit ; obligatoire pour une qualité de copropriété. */
  part: Tantiemes | null
  statut: StatutPosition
  dateEntree: string
  dateSortie: string | null
  /** Nature de la mutation qui a fait entrer la position (muterLot) ; absente : inconnue (position d'origine, reprise). */
  natureMutation?: NatureMutation | null
}

export type SaisiePosition = Position

export function creerPosition(saisie: SaisiePosition): Position {
  if (!(QUALITES_POSITION as readonly string[]).includes(saisie.qualite))
    throw new Error(`Qualité « ${saisie.qualite} » hors du périmètre VitFix (copropriété, location, personnel).`)
  if (!estDateIsoValide(saisie.dateEntree)) throw new Error(`Date d'entrée invalide (${saisie.dateEntree}) : AAAA-MM-JJ attendu.`)
  if (saisie.dateSortie !== null) {
    if (!estDateIsoValide(saisie.dateSortie)) throw new Error(`Date de sortie invalide (${saisie.dateSortie}) : AAAA-MM-JJ attendu.`)
    if (saisie.dateSortie < saisie.dateEntree) throw new Error('Date de sortie antérieure à la date d’entrée.')
  }
  const nature = saisie.natureMutation
  if (nature !== null && nature !== undefined && !(NATURES_MUTATION as readonly string[]).includes(nature))
    throw new Error(`Nature de mutation inconnue : « ${nature} » (${NATURES_MUTATION.join(', ')} attendues).`)
  if (estQualiteCopropriete(saisie.qualite)) {
    if (!saisie.compteId?.trim()) throw new Error(`${saisie.qualite} : rattacher la position à un compte copropriétaire.`)
    if (!saisie.part) throw new Error(`${saisie.qualite} : indiquer la part du droit.`)
  }
  if (saisie.part) {
    const { numerateur, denominateur } = saisie.part
    if (!Number.isInteger(numerateur) || !Number.isInteger(denominateur) || numerateur <= 0 || denominateur <= 0 || numerateur > denominateur)
      throw new Error(`Part invalide (${numerateur}/${denominateur}) : fraction entre 0 et 1 attendue.`)
  }
  return saisie
}

/** Positions en place sur un lot à une date : entrées, pas encore sorties, hors statut « Futur ». */
export const positionsEnPlace = (positions: Position[], lotId: string, date: string): Position[] =>
  positions.filter(
    (p) => p.lotId === lotId && p.statut !== 'Futur' && p.dateEntree <= date && (p.dateSortie === null || date < p.dateSortie),
  )

/** Statut d'une position à une date, cohérent avec positionsEnPlace (sortie le jour de sa sortie). */
export function statutPositionA(p: Position, date: string): StatutPosition {
  verifierDate(date)
  if (p.statut === 'Futur' || date < p.dateEntree) return 'Futur'
  if (p.dateSortie !== null && date >= p.dateSortie) return 'Sorti'
  return 'En place'
}

export interface LignePositionIdentite {
  position: Position
  /** Lot joint (immeuble, n°) ; null s'il n'est pas fourni. */
  lot: LotEnregistre | null
  statut: StatutPosition
}

const RANG_STATUT: Record<StatutPosition, number> = { 'En place': 0, Futur: 1, Sorti: 2 }

const comparerLignes = (a: LignePositionIdentite, b: LignePositionIdentite): number =>
  RANG_STATUT[a.statut] - RANG_STATUT[b.statut] ||
  Number(a.lot === null) - Number(b.lot === null) ||
  (a.lot?.numero ?? a.position.lotId).localeCompare(b.lot?.numero ?? b.position.lotId, 'fr', { numeric: true })

/**
 * Grille Positions d'une identité (Gestéam : Immeubles · N° · Nature · Statut) : en place, puis futures, puis sorties,
 * puis par n° de lot. Sans date, le statut enregistré ; avec une date, le statut à cette date.
 */
export function positionsIdentite(
  positions: Position[],
  identiteId: string,
  { date, lots = [] }: { date?: string; lots?: LotEnregistre[] } = {},
): LignePositionIdentite[] {
  if (date !== undefined) verifierDate(date)
  return positions
    .filter((p) => p.identiteId === identiteId)
    .map((position) => ({
      position,
      lot: lots.find((l) => l.id === position.lotId) ?? null,
      statut: date === undefined ? position.statut : statutPositionA(position, date),
    }))
    .sort(comparerLignes)
}

const pgcd = (a: number, b: number): number => (b === 0 ? a : pgcd(b, a % b))
const sommeParts = (parts: Tantiemes[]): Tantiemes =>
  parts.reduce(
    (s, p) => {
      const numerateur = s.numerateur * p.denominateur + p.numerateur * s.denominateur
      const denominateur = s.denominateur * p.denominateur
      const d = pgcd(numerateur, denominateur)
      return { numerateur: numerateur / d, denominateur: denominateur / d }
    },
    { numerateur: 0, denominateur: 1 },
  )

type Droit = 'pleine propriété' | 'nue-propriété' | 'usufruit'

/** Droit de propriété porté par une qualité ; null hors des qualités de propriété (locataire, gardien…). */
function droitDe(qualite: QualitePosition): Droit | null {
  if (PLEINE_PROPRIETE.includes(qualite)) return 'pleine propriété'
  if (qualite === 'Nu propriétaire') return 'nue-propriété'
  if (qualite === 'Usufruitier') return 'usufruit'
  return null
}

export type CodeAnomalieDroits = 'sans_proprietaire' | 'droits_incompatibles' | 'demembrement_incomplet' | 'parts_incompletes' | 'comptes_multiples'

export interface AnomalieDroits {
  code: CodeAnomalieDroits
  message: string
}

/** Contrôle des positions EN PLACE d'un lot (voir l'en-tête du module). */
export function controlerDroitsLot(positions: Position[]): AnomalieDroits[] {
  const proprietaires = positions.filter((p) => estQualiteCopropriete(p.qualite))
  if (proprietaires.length === 0) return [{ code: 'sans_proprietaire', message: 'Lot sans propriétaire en place.' }]
  const anomalies: AnomalieDroits[] = []
  const groupes = {
    'pleine propriété': proprietaires.filter((p) => droitDe(p.qualite) === 'pleine propriété'),
    'nue-propriété': proprietaires.filter((p) => droitDe(p.qualite) === 'nue-propriété'),
    usufruit: proprietaires.filter((p) => droitDe(p.qualite) === 'usufruit'),
  }
  const demembre = groupes['nue-propriété'].length > 0 || groupes.usufruit.length > 0
  if (groupes['pleine propriété'].length > 0 && demembre)
    anomalies.push({ code: 'droits_incompatibles', message: 'Pleine propriété et démembrement en même temps sur le lot.' })
  else if (demembre && (groupes['nue-propriété'].length === 0 || groupes.usufruit.length === 0))
    anomalies.push({ code: 'demembrement_incomplet', message: 'Démembrement incomplet : nue-propriété et usufruit attendus tous deux.' })
  for (const [droit, liste] of Object.entries(groupes)) {
    if (liste.length === 0) continue
    const somme = sommeParts(liste.map((p) => p.part as Tantiemes))
    if (somme.numerateur !== somme.denominateur)
      anomalies.push({ code: 'parts_incompletes', message: `Parts de ${droit} : ${somme.numerateur}/${somme.denominateur} au lieu de 1.` })
  }
  if (new Set(proprietaires.map((p) => p.compteId)).size > 1)
    anomalies.push({ code: 'comptes_multiples', message: 'Plusieurs comptes pour les droits de propriété du lot : une dette = un compte.' })
  return anomalies
}

/** Participation d'une identité à un compte (Gestéam, grille Participations : Compte · Société, indivision · Parts · Total · Statut). */
export interface Participation {
  compteId: string
  /** Libellé du compte (nom de l'indivision ou de la société) ; null s'il est vide ou si le compte n'est pas fourni. */
  libelle: string | null
  lotId: string
  qualite: QualitePosition
  part: Tantiemes
  /** Somme des parts EN PLACE à la date sur le même compte, le même lot et le même droit (1 attendu). */
  total: Tantiemes
  statut: StatutPosition
}

const QUALITES_PARTICIPATION: ReadonlySet<string> = new Set(['Indivisaire', 'Associé(e)'])

/**
 * Participations d'une identité, dérivées de ses positions : indivisaire ou associé, ou droit partagé (part < 1). Un plein
 * propriétaire seul (1/1) n'a pas de participation. Ordre des positions.
 */
export function participationsIdentite(
  positions: Position[],
  comptes: CompteCoproprietaire[],
  identiteId: string,
  date: string,
): Participation[] {
  verifierDate(date)
  const participations: Participation[] = []
  for (const p of positions) {
    const droit = droitDe(p.qualite)
    if (p.identiteId !== identiteId || droit === null || p.compteId === null || p.part === null) continue
    if (!QUALITES_PARTICIPATION.has(p.qualite) && p.part.numerateur === p.part.denominateur) continue
    const coTitulaires = positionsEnPlace(positions, p.lotId, date).filter(
      (q) => q.compteId === p.compteId && droitDe(q.qualite) === droit && q.part !== null,
    )
    participations.push({
      compteId: p.compteId,
      libelle: comptes.find((c) => c.id === p.compteId)?.libelle.trim() || null,
      lotId: p.lotId,
      qualite: p.qualite,
      part: p.part,
      total: sommeParts(coTitulaires.map((q) => q.part as Tantiemes)),
      statut: statutPositionA(p, date),
    })
  }
  return participations
}

/**
 * Mutation d'un lot : les positions sortantes sont closes à la date (statut Sorti), les entrantes ouvertes (En place),
 * avec la nature de la mutation quand elle est connue (J67, R111 ; enregistrement en base : à brancher). Rien n'est
 * effacé ; renvoie les positions à jour et le contrôle des droits du lot à la date.
 */
export function muterLot(
  positions: Position[],
  {
    lotId,
    date,
    sortantes,
    entrantes,
    nature = null,
  }: {
    lotId: string
    date: string
    sortantes: string[]
    entrantes: Omit<Position, 'lotId' | 'statut' | 'dateEntree' | 'dateSortie' | 'natureMutation'>[]
    nature?: NatureMutation | null
  },
): { positions: Position[]; anomalies: AnomalieDroits[] } {
  if (!estDateIsoValide(date)) throw new Error(`Date de mutation invalide (${date}) : AAAA-MM-JJ attendu.`)
  for (const id of sortantes)
    if (!positions.some((p) => p.id === id && p.lotId === lotId)) throw new Error(`Position sortante introuvable sur le lot : « ${id} ».`)
  const natureMutation = nature ? { natureMutation: nature } : {}
  const apres = [
    ...positions.map((p) => (sortantes.includes(p.id) ? { ...p, statut: 'Sorti' as const, dateSortie: date } : p)),
    ...entrantes.map((e) => creerPosition({ ...e, lotId, statut: 'En place', dateEntree: date, dateSortie: null, ...natureMutation })),
  ]
  return { positions: apres, anomalies: controlerDroitsLot(positionsEnPlace(apres, lotId, date)) }
}

/** Ancien copropriétaire VitFix (une fiche par lot : identité, position et solde mêlés). */
export interface CoproprietaireHistorique {
  id: string
  lotId: string
  nom: string
  tel: string
  mail: string
  statut: string
}

/** Migration D2 : une identité, un compte et une position de pleine propriété (1/1) par ancienne fiche. */
export function migrerCoproprietaire(
  ancien: CoproprietaireHistorique,
  { coproprieteId, serie, dateEntree }: { coproprieteId: string; serie: string; dateEntree: string },
): { identite: Identite; compte: CompteCoproprietaire; position: Position } {
  const identite = creerIdentite({
    id: `id-${ancien.id}`,
    nature: 'physique',
    civilite: '',
    nom: ancien.nom,
    prenom: null,
    telecoms: [
      ...(ancien.tel.trim() ? [{ nature: 'Téléphone', valeur: ancien.tel.trim() }] : []),
      ...(ancien.mail.trim() ? [{ nature: 'E-mail', valeur: ancien.mail.trim() }] : []),
    ],
  })
  const compte = creerCompteCoproprietaire({ id: `cpt-${ancien.id}`, coproprieteId, serie, libelle: identite.nom })
  const position = creerPosition({
    id: `pos-${ancien.id}`,
    identiteId: identite.id,
    lotId: ancien.lotId,
    compteId: compte.id,
    qualite: 'Copropriétaire',
    part: { numerateur: 1, denominateur: 1 },
    statut: 'En place',
    dateEntree,
    dateSortie: null,
  })
  return { identite, compte, position }
}
