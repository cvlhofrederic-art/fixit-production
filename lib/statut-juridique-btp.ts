import { mapLegalFormToCode } from '@/lib/devis-utils'

/** Libellés du statut juridique affichés par le formulaire de devis et facture BTP, par code interne. */
const LIBELLE_PAR_CODE: Record<string, string> = {
  ei: 'Entreprise Individuelle (EI)',
  eurl: 'EURL',
  sarl: 'SARL',
  sas: 'SAS',
  sasu: 'SASU',
  ae: 'Auto-entrepreneur',
  sa: 'SA',
}

const STATUT_PAR_DEFAUT = 'Entreprise Individuelle (EI)'

/**
 * Un document est émis quand il porte un numéro légal (DEV-, FACT-, AV-, AC-…). Un brouillon n'a pas de
 * numéro, ou un numéro provisoire BR- : le numéro légal n'est tiré qu'à l'émission (saveAndSend).
 */
export function documentEmis(numero: string | null | undefined): boolean {
  const n = String(numero || '').trim()
  return n !== '' && !n.toUpperCase().startsWith('BR-')
}

/**
 * Document déjà enregistré (brouillon ou émis) : il a un identifiant, un horodatage d'enregistrement ou un numéro
 * légal. Un document tiré d'un autre est neuf : l'avoir perd identifiant et horodatage, et le duplicata BTP reçoit
 * un nouvel identifiant marqué `isDuplicate` (DevisSection), sans être encore enregistré.
 */
export function documentExistant(
  document: { id?: unknown; savedAt?: unknown; docNumber?: string | null; isDuplicate?: unknown } | null | undefined,
): boolean {
  if (!document || document.isDuplicate) return false
  return Boolean(document.savedAt) || Boolean(document.id) || documentEmis(document.docNumber)
}

/**
 * Statut juridique initial du formulaire de devis et facture BTP. Le champ est verrouillé, « défini à
 * l'inscription ». Un document déjà enregistré garde exactement le sien : le formulaire réenregistre un
 * brouillon dès son ouverture, et un document existant ne doit pas être modifié à son insu. Un nouveau document,
 * même tiré d'un plus ancien (facture depuis un devis, avoir, duplication), prend la forme du profil : avant, il
 * recopiait celle du document source, restée en EI quand le profil n'avait pas encore de forme juridique.
 */
export function statutJuridiqueInitialBtp(
  document: { companyStatus?: string | null; docNumber?: string | null; id?: unknown; savedAt?: unknown; isDuplicate?: unknown } | null | undefined,
  formeProfil: string | null | undefined,
): string {
  const duDocument = document?.companyStatus || ''
  const forme = String(formeProfil || '').trim()
  if (duDocument && (documentExistant(document) || !forme)) return duDocument
  if (forme) return LIBELLE_PAR_CODE[mapLegalFormToCode(forme)] || STATUT_PAR_DEFAUT
  return duDocument || STATUT_PAR_DEFAUT
}

/**
 * Document BTP émis en un clic, sans repasser par le formulaire (facture totale, acompte par taux) : forme juridique
 * du profil au jour de l'émission, comme le RIB (`appliquerRibCourant`), au lieu de celle recopiée du devis. Le
 * document est neuf : rien d'enregistré n'est modifié. Sans forme au profil, celle du devis reste.
 */
export function appliquerFormeProfil<T extends Record<string, unknown>>(payload: T, formeProfil: string | null | undefined): T {
  if (!String(formeProfil || '').trim()) return payload
  return { ...payload, companyStatus: statutJuridiqueInitialBtp(undefined, formeProfil) }
}
