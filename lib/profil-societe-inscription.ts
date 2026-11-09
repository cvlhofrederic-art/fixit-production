import type { Country } from '@/lib/config/companyTypes'
import { getLegalStructureOptions } from '@/lib/tax-calculator'

/** Identité légale renvoyée par la vérification du SIRET (ou du NIF) à l'inscription. */
export interface SocieteVerifiee {
  siren?: string
  nafCode?: string
  nafLabel?: string
  legalForm?: string
  address?: string
  city?: string
  postalCode?: string
}

/**
 * Champs société à écrire dans `profiles_artisan` à l'inscription d'une société BTP
 * (`/api/auth/create-profile`). La forme juridique choisie dans le formulaire, préremplie depuis le
 * registre et modifiable, prime sur le libellé brut du registre.
 *
 * Sans ces champs, `legal_form` restait vide : le formulaire de devis et facture BTP retombait sur
 * « Entreprise Individuelle (EI) », mentions légales de l'EI comprises, même pour une SAS.
 * Les valeurs vides ne sont pas envoyées.
 */
export function champsSocieteProfil(
  societe: SocieteVerifiee | null | undefined,
  formeChoisie: string,
  pays: Country,
): Record<string, string> {
  const libelleForme = formeChoisie
    ? getLegalStructureOptions(pays).find((option) => option.key === formeChoisie)?.label
    : undefined
  const champs: Record<string, string | undefined> = {
    legal_form: libelleForme || societe?.legalForm,
    siren: societe?.siren,
    naf_code: societe?.nafCode,
    naf_label: societe?.nafLabel,
    company_address: societe?.address,
    company_city: societe?.city,
    company_postal_code: societe?.postalCode,
  }
  const resultat: Record<string, string> = {}
  for (const [cle, valeur] of Object.entries(champs)) {
    if (typeof valeur === 'string' && valeur.trim()) resultat[cle] = valeur.trim()
  }
  return resultat
}
