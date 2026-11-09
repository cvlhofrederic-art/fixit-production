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
 * Statut juridique initial du formulaire de devis et facture BTP. Le champ est verrouillé, « défini à
 * l'inscription » : il suit la forme juridique du profil. Un document déjà émis garde la sienne, figée avec
 * lui. Un brouillon ou un nouveau document, même tiré d'un document plus ancien (facture depuis un devis,
 * avoir, duplication), prend celle du profil : avant, il recopiait celle du document source, restée en EI
 * quand le profil n'avait pas encore de forme juridique.
 */
export function statutJuridiqueInitialBtp(
  document: { companyStatus?: string | null; docNumber?: string | null } | null | undefined,
  formeProfil: string | null | undefined,
): string {
  const duDocument = document?.companyStatus || ''
  const forme = String(formeProfil || '').trim()
  if (duDocument && (documentEmis(document?.docNumber) || !forme)) return duDocument
  if (forme) return LIBELLE_PAR_CODE[mapLegalFormToCode(forme)] || STATUT_PAR_DEFAUT
  return duDocument || STATUT_PAR_DEFAUT
}
