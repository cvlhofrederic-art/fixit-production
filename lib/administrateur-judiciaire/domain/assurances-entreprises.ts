import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'

/**
 * Validité des assurances des entreprises (intégration Gestéam, T15). Gestéam suit, pour chaque entreprise, la
 * RC décennale et la RC professionnelle : un indicateur « nécessaire » et la date d'échéance de l'attestation.
 * Contrôle qui engage la responsabilité du syndic avant de confier des travaux.
 */

export type GarantieEntreprise = 'RC décennale' | 'RCP'

export interface EntrepriseAssurances {
  id: string
  rcDecennaleNecessaire?: boolean
  rcDecennaleEcheance?: string | null
  rcpNecessaire?: boolean
  rcpEcheance?: string | null
}

export interface AttestationAControler {
  prestataireId: string
  garantie: GarantieEntreprise
  echeance: string | null
  /** Échue ou échéant au plus tard à la date de contrôle ; ou nécessaire mais sans échéance saisie. */
  motif: 'echue_ou_echoit' | 'echeance_absente'
}

/**
 * Attestations nécessaires à contrôler à la date donnée (AAAA-MM-JJ) : échéance antérieure ou égale à la date, ou
 * échéance absente. Une garantie non nécessaire n'est jamais signalée. Ordre : entreprises dans l'ordre reçu, RC
 * décennale avant RCP. Lève une erreur si la date n'est pas AAAA-MM-JJ.
 */
export function attestationsEntreprisesAControler(
  entreprises: EntrepriseAssurances[],
  dateIso: string,
): AttestationAControler[] {
  if (!estDateIsoValide(dateIso)) throw new Error(`Date invalide : « ${dateIso} » (attendu AAAA-MM-JJ).`)
  const resultat: AttestationAControler[] = []
  for (const entreprise of entreprises) {
    const garanties: [GarantieEntreprise, boolean | undefined, string | null | undefined][] = [
      ['RC décennale', entreprise.rcDecennaleNecessaire, entreprise.rcDecennaleEcheance],
      ['RCP', entreprise.rcpNecessaire, entreprise.rcpEcheance],
    ]
    for (const [garantie, necessaire, echeance] of garanties) {
      if (!necessaire) continue
      if (!echeance) resultat.push({ prestataireId: entreprise.id, garantie, echeance: null, motif: 'echeance_absente' })
      else if (echeance <= dateIso)
        resultat.push({ prestataireId: entreprise.id, garantie, echeance, motif: 'echue_ou_echoit' })
    }
  }
  return resultat
}
