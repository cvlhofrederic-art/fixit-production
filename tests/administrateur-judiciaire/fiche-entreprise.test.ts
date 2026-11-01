import { describe, expect, it } from 'vitest'
import { composerDateIso } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  SEUIL_ALERTE_ASSURANCE_JOURS,
  avecTelecomPrefere,
  etatAssurance,
  etatVigilance,
  masquerIban,
  nouvelleFicheEntreprise,
  telecomPrefere,
  type TelecomEntreprise,
} from '@/lib/administrateur-judiciaire/domain/fiche-entreprise'
import { VALIDITE_VIGILANCE_MOIS } from '@/lib/administrateur-judiciaire/domain/vigilance-entreprises'

const LE_4_JUIN = composerDateIso(2026, 6, 4)

describe('fiche entreprise — état d’une attestation d’assurance', () => {
  it('sans date de fin, l’attestation n’est pas fournie', () => {
    expect(etatAssurance(null, LE_4_JUIN)).toEqual({ etat: 'Non fournie', jusquAu: null })
  })

  it('échue la veille, à jour le jour même de sa fin', () => {
    expect(etatAssurance(composerDateIso(2026, 6, 3), LE_4_JUIN).etat).toBe('Échue')
    expect(etatAssurance(LE_4_JUIN, LE_4_JUIN).etat).toBe('Échoit bientôt')
  })

  it(`« échoit bientôt » dans les ${SEUIL_ALERTE_ASSURANCE_JOURS} jours, « à jour » au-delà`, () => {
    expect(SEUIL_ALERTE_ASSURANCE_JOURS).toBe(30)
    expect(etatAssurance(composerDateIso(2026, 7, 4), LE_4_JUIN).etat).toBe('Échoit bientôt')
    expect(etatAssurance(composerDateIso(2026, 7, 5), LE_4_JUIN)).toEqual({ etat: 'À jour', jusquAu: composerDateIso(2026, 7, 5) })
  })

  it('refuse une date qui n’est pas ISO', () => {
    expect(() => etatAssurance('31/12/2026', LE_4_JUIN)).toThrow(/AAAA-MM-JJ/)
  })
})

describe('fiche entreprise — attestation de vigilance', () => {
  it(`valable ${VALIDITE_VIGILANCE_MOIS} mois, comme le contrôle avant ordre de service`, () => {
    expect(etatVigilance(null, LE_4_JUIN)).toEqual({ etat: 'Non fournie', jusquAu: null })
    expect(etatVigilance(composerDateIso(2026, 1, 5), LE_4_JUIN)).toEqual({ etat: 'À jour', jusquAu: composerDateIso(2026, 7, 5) })
    expect(etatVigilance(composerDateIso(2025, 12, 4), LE_4_JUIN)).toEqual({ etat: 'À renouveler', jusquAu: LE_4_JUIN })
  })
})

describe('fiche entreprise — courriel et téléphone préférés', () => {
  const telecoms: TelecomEntreprise[] = [
    { type: 'Courriel', nature: 'Général', prefere: true, valeur: 'a@exemple.fr' },
    { type: 'Courriel', nature: 'Compta', prefere: false, valeur: 'b@exemple.fr' },
    { type: 'Téléphone', nature: 'Bureau', prefere: true, valeur: '01 00 00 00 00' },
  ]

  it('lit le télécom préféré de chaque genre', () => {
    expect(telecomPrefere(telecoms, 'Courriel')).toBe('a@exemple.fr')
    expect(telecomPrefere(telecoms, 'Téléphone')).toBe('01 00 00 00 00')
    expect(telecomPrefere([], 'Courriel')).toBe('')
  })

  it('remplace le préféré sans toucher aux autres ; un 06 devient un mobile', () => {
    const remplaces = avecTelecomPrefere(telecoms, 'Téléphone', '06 11 22 33 44')
    expect(remplaces).toEqual([
      { type: 'Mobile', nature: 'Général', prefere: true, valeur: '06 11 22 33 44' },
      telecoms[0],
      telecoms[1],
    ])
  })

  it('une saisie vide retire le préféré', () => {
    expect(avecTelecomPrefere(telecoms, 'Courriel', '  ')).toEqual([telecoms[1], telecoms[2]])
  })

  it('une fiche neuve a les réglages courants et aucune pièce', () => {
    const fiche = nouvelleFicheEntreprise({ numero: '00001' })
    expect(fiche.numero).toBe('00001')
    expect(fiche.reglement).toEqual({ mode: 'Virement', delaiJours: 30, unVirementPar: 'Facture', priorite: 2, iban: null, bic: null })
    expect([fiche.vigilanceLe, fiche.kbisLe, fiche.contacts.length]).toEqual([null, null, 0])
  })
})

describe('fiche entreprise — IBAN masqué', () => {
  it('garde les quatre premiers et les quatre derniers caractères', () => {
    expect(masquerIban('FR76 3000 6000 0112 3456 7890 189')).toBe('FR76 •••• •••• •••• 0189')
    expect(masquerIban('fr7630006000011234567890189')).toBe('FR76 •••• •••• •••• 0189')
  })

  it('un IBAN absent ou trop court reste illisible', () => {
    expect(masquerIban(null)).toBe('')
    expect(masquerIban('FR76')).toBe('••••')
  })
})
