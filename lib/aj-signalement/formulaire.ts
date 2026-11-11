// ── Formulaire public « AJ Signalement » : règles du parcours, sans React ─────
//
// Tous les champs sont obligatoires (demande de Hugo du 06/11/2026) : coordonnées (prénom, nom, téléphone,
// e-mail, bâtiment, étage, numéro de lot) et qualité (propriétaire / locataire). Le reste du parcours est celui
// du portail copropriétaire : où (logement / parties communes + zone), quel type, description de 10 caractères
// au moins, urgence. Le bouton d'envoi reste désactivé tant que tout n'est pas rempli ; les erreurs de saisie
// s'affichent sous le champ quitté. Le choix « même problème / autre problème » face aux signalements déjà faits
// au même endroit n'entre pas dans ces règles : il n'empêche jamais l'envoi.

import { NUMERO_QR, type LangueSignalementQr, type PrioriteSignalementQr, type QualiteDeclarantQr, type SaisieSignalementQr } from '@/lib/aj-signalement/types'
import type { TextesSignalementQr } from '@/lib/aj-signalement/textes'
import type { TextesCopro } from '@/lib/coproprietaire/textes'

export type LieuQr = '' | 'logement' | 'communes'
export type UrgenceQr = '' | 'non' | 'genant' | 'urgent'

export interface ValeursFormulaireQr {
  prenom: string
  nom: string
  telephone: string
  email: string
  batiment: string
  etage: string
  numLot: string
  qualite: '' | QualiteDeclarantQr
  lieu: LieuQr
  zone: string
  type: string
  description: string
  urgence: UrgenceQr
}

export const VALEURS_INITIALES_QR: ValeursFormulaireQr = {
  prenom: '', nom: '', telephone: '', email: '', batiment: '', etage: '', numLot: '', qualite: '',
  lieu: '', zone: '', type: '', description: '', urgence: '',
}

/** Même règle que la route (signalementQrSchema) et que le portail copropriétaire. */
export const DESCRIPTION_MIN_QR = 10

/** Même contrôle que strictEmail (lib/validation.ts) : domaine avec extension. */
export const EMAIL_VALIDE_QR = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/

/** Chiffres, espaces, points, parenthèses, tirets, « + » en tête ; six chiffres au moins, trente caractères au plus. */
export function telephoneValide(telephone: string): boolean {
  const propre = telephone.trim()
  return propre.length <= 30 && /^\+?[0-9 .()\-]+$/.test(propre) && (propre.match(/\d/g) ?? []).length >= 6
}

export type ChampCoordonnees = 'prenom' | 'nom' | 'telephone' | 'email' | 'batiment' | 'etage' | 'numLot'
export type ErreurChamp = 'obligatoire' | 'invalide'

export const CHAMPS_COORDONNEES: readonly ChampCoordonnees[] = ['prenom', 'nom', 'telephone', 'email', 'batiment', 'etage', 'numLot']
/** Toutes les coordonnées sont obligatoires, bâtiment compris. */
export const CHAMPS_OBLIGATOIRES: readonly ChampCoordonnees[] = CHAMPS_COORDONNEES

/** Erreurs des coordonnées : champ obligatoire vide, e-mail ou téléphone mal formé. Vide quand tout est correct. */
export function erreursCoordonnees(valeurs: ValeursFormulaireQr): Partial<Record<ChampCoordonnees, ErreurChamp>> {
  const erreurs: Partial<Record<ChampCoordonnees, ErreurChamp>> = {}
  for (const champ of CHAMPS_OBLIGATOIRES) {
    if (!valeurs[champ].trim()) erreurs[champ] = 'obligatoire'
  }
  if (!erreurs.email && !EMAIL_VALIDE_QR.test(valeurs.email.trim())) erreurs.email = 'invalide'
  if (!erreurs.telephone && !telephoneValide(valeurs.telephone)) erreurs.telephone = 'invalide'
  return erreurs
}

/** Message d'une erreur de coordonnées, dans la langue de la page. */
export function messageErreurChamp(champ: ChampCoordonnees, erreur: ErreurChamp, tq: TextesSignalementQr): string {
  if (erreur === 'obligatoire') return tq.champObligatoire
  return champ === 'email' ? tq.emailInvalide : tq.telephoneInvalide
}

/**
 * Le formulaire peut partir : coordonnées correctes, qualité choisie et parcours complet (lieu, zone, type, description,
 * urgence). Zone des parties communes : même règle que signalementQrSchema (vide après nettoyage = manquante).
 */
export function formulaireComplet(valeurs: ValeursFormulaireQr): boolean {
  if (Object.keys(erreursCoordonnees(valeurs)).length > 0 || valeurs.qualite === '') return false
  if (valeurs.lieu === '' || (valeurs.lieu === 'communes' && valeurs.zone.trim() === '')) return false
  return valeurs.type !== '' && valeurs.description.trim().length >= DESCRIPTION_MIN_QR && valeurs.urgence !== ''
}

/** Urgence du formulaire → priorité enregistrée, comme le portail copropriétaire (gênant = normale). */
export const prioriteDepuisUrgence = (urgence: UrgenceQr): PrioriteSignalementQr => (urgence === 'urgent' ? 'urgente' : 'normale')

const texte = (valeur: string, max: number): string => valeur.trim().slice(0, max)

/** Ce qui s'ajoute à la saisie au moment de l'envoi : adresse proposée d'après la position, signalement désigné comme le même. */
export interface ComplementsSaisieQr {
  adresseProposee?: string
  signalementLieNumero?: string
}

/** Corps du POST à partir des valeurs saisies (mêmes bornes que signalementQrSchema). */
export function construireSaisieQr(
  valeurs: ValeursFormulaireQr, jeton: string, langue: LangueSignalementQr, complements: ComplementsSaisieQr = {},
): SaisieSignalementQr {
  const communes = valeurs.lieu === 'communes'
  const numeroLie = complements.signalementLieNumero ?? ''
  return {
    jeton,
    prenom: texte(valeurs.prenom, 100),
    nom: texte(valeurs.nom, 100),
    telephone: texte(valeurs.telephone, 30),
    email: valeurs.email.trim().toLowerCase().slice(0, 200),
    batiment: texte(valeurs.batiment, 50),
    etage: texte(valeurs.etage, 20),
    numLot: texte(valeurs.numLot, 20),
    qualiteDeclarant: valeurs.qualite,
    estPartieCommune: communes,
    zoneSignalee: communes ? texte(valeurs.zone, 200) : '',
    typeIntervention: texte(valeurs.type, 100),
    description: texte(valeurs.description, 5000),
    priorite: prioriteDepuisUrgence(valeurs.urgence),
    langue,
    adresseProposee: texte(complements.adresseProposee ?? '', 300),
    // Un logement n'est jamais rattaché à un signalement des parties communes.
    signalementLieNumero: communes && NUMERO_QR.test(numeroLie) ? numeroLie : '',
  }
}

/** « 4e étage » / « 1er étage » / « 4.º piso » ; étage non numérique rendu tel quel (règle du portail). */
export function libelleEtageQr(etage: string, langue: LangueSignalementQr, t: TextesCopro): string {
  if (!/^\d+$/.test(etage)) return `${t.commun.etage} ${etage}`
  if (langue === 'pt') return `${etage}.º ${t.commun.etage}`
  return `${etage}${etage === '1' ? 'er' : 'e'} ${t.commun.etage}`
}

/** « bât. B, 4e étage, lot 12 » d'après les coordonnées saisies ; « votre logement » tant qu'elles manquent. */
export function lieuLogementQr(valeurs: ValeursFormulaireQr, langue: LangueSignalementQr, t: TextesCopro, tq: TextesSignalementQr): string {
  const parties: string[] = []
  const batiment = valeurs.batiment.trim()
  const etage = valeurs.etage.trim()
  const lot = valeurs.numLot.trim()
  if (batiment) parties.push(`${langue === 'pt' ? 'bloco' : 'bât.'} ${batiment}`)
  if (etage) parties.push(libelleEtageQr(etage, langue, t))
  if (lot) parties.push(`${t.commun.lot} ${lot}`)
  return parties.length > 0 ? parties.join(', ') : tq.votreLogement
}
