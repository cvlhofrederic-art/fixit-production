import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { FICHES_PORTEUSES, creerRattachement, type Rattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import { cadreRemunerationDuRegime, type CadreRemunerationSinistre } from '@/lib/administrateur-judiciaire/domain/honoraires-sinistre'
import { SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE, type MandatRemunere } from '@/lib/administrateur-judiciaire/domain/ordonnances-remuneration'

/**
 * Actes hors tarif de l'administrateur provisoire de l'art. 29-1 et leur état pour le compte provisoire détaillé des
 * émoluments. Fonctions pures, montants en CENTIMES ENTIERS (taux horaire HT en dix-millièmes d'euro, comme
 * honoraires-facturation.ts), dates ISO, sans écran ni table.
 *
 * Droit (textes déjà relus le 17/11/2026, en vigueur) :
 * - 🟢 L'arrêté du 8 octobre 2015, art. 14, liste les actes rémunérés hors droits fixes et proportionnels (dont la gestion
 *   administrative et matérielle des sinistres hors déclaration, les diligences en cas de mutation d'un lot, le
 *   recouvrement d'une créance justifiée contre un copropriétaire, les réunions d'information des copropriétaires), sans
 *   mode de calcul. Copropriété de 500 lots et plus : « par dérogation aux articles 4 à 15 », l'entière rémunération est
 *   fixée par le juge (art. 3) : pas d'acte hors tarif.
 * - 🟢 Le président du tribunal judiciaire fixe les acomptes « sur justification des diligences accomplies » au vu d'un
 *   compte provisoire détaillé des émoluments, et arrête la rémunération en fin de mission (D. 1967 art. 61-1-5, II et
 *   III). L'administrateur joint à sa requête « tout élément justifiant » les bases retenues (règles professionnelles,
 *   arrêté du 18 juillet 2018, règles 810.2 et 820.3, lues en version initiale).
 *
 * Décision du 20/11/2026 (partie C, F5) : chaque acte hors tarif se chiffre au temps passé, en minutes exactes,
 * multiplié par le taux horaire du cabinet, acte par acte, avec la date, la durée, l'objet et la fiche liée (sinistre,
 * vente de lot, recouvrement, réunion). Le montant est une demande présentée au juge, jamais une facture au syndicat :
 * aucun élément « A facturer » n'est créé (honoraires-sinistre.ts garde son signalement), etatDesActesHorsTarif rend
 * l'état acte par acte (MENTION_ACTES_HORS_TARIF), sur la période du compte provisoire (par défaut l'année de mission,
 * periodeAnneeDeMission de honoraires-tableau.ts, décision du 20/11/2026, F3).
 * - Montant d'un acte : minutes × taux ÷ 60, arrondi une seule fois au centime le plus proche (demi au-dessus) ; le
 *   total est la somme des lignes. 🔵 Le montant est HT : le tarif et le juge raisonnent en HT ; aucune TVA n'est
 *   calculée ici.
 * - Fiche liée : obligatoire, une fiche de dossier (🔵 par exemple Sinistre, Mutation pour une vente de lot, Contentieux
 *   pour un recouvrement ; le type d'une réunion n'est pas fixé), jamais une fiche porteuse (copropriété, identité,
 *   entreprise), comme la fiche d'un élément d'honoraires (honoraires-facturation.ts).
 * - Données hors du domaine : le taux horaire du cabinet (réglage du cabinet, non relevé), passé par l'appelant ; les
 *   actes eux-mêmes, passés aussi par l'appelant (aucune table : leur enregistrement viendra avec les écrans).
 * - 🔵 L'état ne vaut que pour l'administration provisoire de l'art. 29-1 de moins de 500 lots (cadre
 *   « tarif_administrateur_provisoire » de cadreRemunerationDuRegime) : ailleurs, il n'y a pas d'acte hors tarif de
 *   l'arrêté, et l'état est refusé avec le motif du cadre.
 */

export interface ActeHorsTarif {
  id: string
  mandatId: string
  /** Date de l'acte (AAAA-MM-JJ). */
  date: string
  /** Temps passé, en minutes exactes ; depuis des horaires début / fin : dureeDepuisHoraires(debut, fin).minutes. */
  minutes: number
  /** Objet de l'acte : la diligence accomplie. */
  objet: string
  /** Fiche liée (sinistre, vente de lot, recouvrement, réunion…) : une fiche de dossier. */
  fiche: Rattachement
}

export interface LigneActeHorsTarif extends ActeHorsTarif {
  /** Minutes × taux horaire du cabinet, HT, arrondi au centime : une demande au juge. */
  montantDemandeHtCentimes: number
}

export interface ParametresEtatActesHorsTarif {
  mandatId: string
  /** Régime et nombre de lots du mandat : seule l'AP de l'art. 29-1 de moins de 500 lots a des actes hors tarif. */
  mandat: MandatRemunere
  /** Période du compte provisoire, bornes incluses : par défaut l'année de mission (periodeAnneeDeMission), modifiable. */
  du: string
  au: string
  /** Taux horaire HT du cabinet, en dix-millièmes d'euro (réglage du cabinet, passé par l'appelant). */
  tauxHoraireHtDixMilliemes: number
}

export interface EtatActesHorsTarif {
  mandatId: string
  du: string
  au: string
  tauxHoraireHtDixMilliemes: number
  /** Acte par acte, par date puis par identifiant. */
  lignes: LigneActeHorsTarif[]
  totalMinutes: number
  /** Somme des montants demandés des lignes. */
  totalDemandeHtCentimes: number
  mention: string
  fondements: readonly string[]
}

/** Décision du 20/11/2026 (partie C, F5) : mention de l'état, à afficher avec l'écran du compte provisoire. */
export const MENTION_ACTES_HORS_TARIF =
  'Demande présentée au juge, jamais une facture au syndicat : temps passé en minutes exactes × taux horaire du cabinet, ' +
  'acte par acte ; le juge fixe les acomptes et arrête la rémunération (D. 1967 art. 61-1-5, II et III).'

export const FONDEMENTS_ACTES_HORS_TARIF: readonly string[] = [
  'Arrêté du 8 octobre 2015, art. 14 : actes rémunérés hors droits fixes et proportionnels, sans mode de calcul',
  'D. 1967 art. 61-1-5, II et III : acomptes sur justification des diligences accomplies, rémunération arrêtée en fin de mission',
  'Règles professionnelles des administrateurs judiciaires (arrêté du 18 juillet 2018), règles 810.2 et 820.3',
  'Décision du 20/11/2026 (partie C, F5) : temps passé en minutes exactes × taux horaire du cabinet, acte par acte',
]

const MINUTES_PAR_HEURE = 60
/** Un centime vaut cent dix-millièmes d'euro. */
const DIX_MILLIEMES_PAR_CENTIME = 100

const estEntierStrictementPositif = (valeur: number): boolean => Number.isInteger(valeur) && valeur > 0

function verifierTauxHoraire(tauxHoraireHtDixMilliemes: number): void {
  if (!estEntierStrictementPositif(tauxHoraireHtDixMilliemes))
    throw new Error(`Taux horaire invalide (${tauxHoraireHtDixMilliemes}) : dix-millièmes d'euro entiers strictement positifs attendus.`)
}

/**
 * Montant demandé pour un acte (décision du 20/11/2026, partie C, F5) : minutes exactes × taux horaire HT ÷ 60, arrondi
 * une seule fois au centime le plus proche (demi au-dessus).
 */
export function montantDemandeHtCentimes(minutes: number, tauxHoraireHtDixMilliemes: number): number {
  if (!estEntierStrictementPositif(minutes)) throw new Error(`Durée invalide (${minutes}) : minutes entières strictement positives attendues.`)
  verifierTauxHoraire(tauxHoraireHtDixMilliemes)
  const produit = minutes * tauxHoraireHtDixMilliemes
  if (!Number.isSafeInteger(produit)) throw new Error(`Durée ou taux trop élevé (${minutes} minutes) pour un calcul exact.`)
  return Math.round(produit / (MINUTES_PAR_HEURE * DIX_MILLIEMES_PAR_CENTIME))
}

/** Fiche liée revalidée (type connu, identifiant non vide, nettoyé) ; une fiche porteuse n'est pas une fiche de dossier. */
function ficheLiee(acteId: string, fiche: Rattachement | null | undefined): Rattachement {
  if (!fiche) throw new Error(`Acte ${acteId} : fiche liée attendue (sinistre, vente de lot, recouvrement, réunion…).`)
  const rattachement = creerRattachement(fiche.type, fiche.id)
  if ((FICHES_PORTEUSES as readonly string[]).includes(rattachement.type))
    throw new Error(`Acte ${acteId} : « ${rattachement.type} » est une fiche porteuse ; la fiche liée est une fiche de dossier.`)
  return rattachement
}

/** Acte contrôlé (date, durée en minutes exactes, objet, fiche liée), identifiants et objet nettoyés ; l'acte reçu n'est pas modifié. */
export function creerActeHorsTarif(saisie: ActeHorsTarif): ActeHorsTarif {
  const id = saisie.id.trim()
  if (!id) throw new Error('Acte hors tarif sans identifiant.')
  const mandatId = saisie.mandatId.trim()
  if (!mandatId) throw new Error(`Acte ${id} : mandat non renseigné.`)
  if (!estDateIsoValide(saisie.date)) throw new Error(`Acte ${id} : date invalide (${saisie.date}), AAAA-MM-JJ attendu.`)
  if (!estEntierStrictementPositif(saisie.minutes))
    throw new Error(`Acte ${id} : durée invalide (${saisie.minutes}), minutes entières strictement positives attendues.`)
  const objet = saisie.objet.trim()
  if (!objet) throw new Error(`Acte ${id} : objet non renseigné.`)
  return { id, mandatId, date: saisie.date, minutes: saisie.minutes, objet, fiche: ficheLiee(id, saisie.fiche) }
}

/** Motif du refus de l'état, par cadre sans acte hors tarif de l'arrêté. */
const HORS_DU_TARIF: Readonly<Record<Exclude<CadreRemunerationSinistre, 'tarif_administrateur_provisoire'>, string>> = {
  remuneration_fixee_par_le_juge:
    `Administration provisoire (art. 29-1), copropriété de ${SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE} lots et plus : l'art. 14 ne ` +
    "s'applique pas, l'entière rémunération est fixée par le juge (arrêté du 8 octobre 2015, art. 3) ; pas d'état des actes hors tarif.",
  remuneration_fixee_par_le_president:
    "Mandat hors du tarif de l'art. 29-1 : rémunération fixée par le président qui a désigné le cabinet (C. com. R. 814-27) ; " +
    "pas d'état des actes hors tarif.",
  regime_inconnu:
    "Régime du mandat non reconnu : le vérifier sur le fondement du mandat ; l'état des actes hors tarif ne vaut que pour " +
    "l'administration provisoire de l'art. 29-1 de moins de 500 lots (arrêté du 8 octobre 2015, art. 14).",
  contrat_type_syndic: "Contrat type de syndic : ni tarif de l'art. 29-1 ni actes hors tarif de l'arrêté du 8 octobre 2015.",
}

function verifierParametres({ mandatId, mandat, du, au, tauxHoraireHtDixMilliemes }: ParametresEtatActesHorsTarif): void {
  if (!mandatId.trim()) throw new Error('Mandat : identifiant vide.')
  const cadre = cadreRemunerationDuRegime(mandat.regime, mandat.nbLots)
  if (cadre !== 'tarif_administrateur_provisoire') throw new Error(HORS_DU_TARIF[cadre])
  for (const date of [du, au]) if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  if (du > au) throw new Error(`Période invalide : du ${du} au ${au}.`)
  verifierTauxHoraire(tauxHoraireHtDixMilliemes)
}

/** Actes du mandat, contrôlés ; un acte fourni deux fois est refusé. Les actes d'un autre mandat sont ignorés. */
function actesDuMandat(actes: readonly ActeHorsTarif[], mandatId: string): ActeHorsTarif[] {
  const ids = new Set<string>()
  const retenus = actes.filter((a) => a.mandatId.trim() === mandatId).map(creerActeHorsTarif)
  for (const acte of retenus) {
    if (ids.has(acte.id)) throw new Error(`Acte ${acte.id} : fourni deux fois.`)
    ids.add(acte.id)
  }
  return retenus
}

const parDateEtIdentifiant = (a: ActeHorsTarif, b: ActeHorsTarif): number => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)

/**
 * État des actes hors tarif d'un mandat pour le compte provisoire (décision du 20/11/2026, partie C, F5) : les actes du
 * mandat datés du `du` au `au` inclus, acte par acte, chacun chiffré au temps passé × taux horaire du cabinet. Une
 * demande présentée au juge, jamais une facture au syndicat. Refusé hors de l'AP de l'art. 29-1 de moins de 500 lots.
 */
export function etatDesActesHorsTarif(actes: readonly ActeHorsTarif[], parametres: ParametresEtatActesHorsTarif): EtatActesHorsTarif {
  verifierParametres(parametres)
  const { du, au, tauxHoraireHtDixMilliemes } = parametres
  const mandatId = parametres.mandatId.trim()
  const lignes = actesDuMandat(actes, mandatId)
    .filter((a) => a.date >= du && a.date <= au)
    .sort(parDateEtIdentifiant)
    .map((a) => ({ ...a, montantDemandeHtCentimes: montantDemandeHtCentimes(a.minutes, tauxHoraireHtDixMilliemes) }))
  return {
    mandatId,
    du,
    au,
    tauxHoraireHtDixMilliemes,
    lignes,
    totalMinutes: lignes.reduce((s, l) => s + l.minutes, 0),
    totalDemandeHtCentimes: lignes.reduce((s, l) => s + l.montantDemandeHtCentimes, 0),
    mention: MENTION_ACTES_HORS_TARIF,
    fondements: FONDEMENTS_ACTES_HORS_TARIF,
  }
}
