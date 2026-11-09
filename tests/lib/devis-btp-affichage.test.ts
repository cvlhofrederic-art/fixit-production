// Affichage du formulaire de devis et facture BTP (lib/devis-btp-affichage.ts) : type du client importé,
// ligne TVA du résumé hors régime classique, immatriculation au RCS des mentions légales.

import { describe, it, expect } from 'vitest'
import { estClientProfessionnel, formaterImmatriculationRcs, ligneTvaHorsClassique } from '@/lib/devis-btp-affichage'

describe('estClientProfessionnel', () => {
  it.each(['professionnel', 'societe', 'syndic', 'promoteur', 'collectivite'])('type %s : professionnel', (type) => {
    expect(estClientProfessionnel({ type })).toBe(true)
  })

  it('un SIRET renseigné suffit, comme dans la base clients', () => {
    expect(estClientProfessionnel({ type: 'particulier', siret: '951 819 010 00012' })).toBe(true)
    expect(estClientProfessionnel({ siret: '95181901000012' })).toBe(true)
  })

  it('particulier sans SIRET, ou client sans type ni SIRET : particulier', () => {
    expect(estClientProfessionnel({ type: 'particulier', siret: '' })).toBe(false)
    expect(estClientProfessionnel({ type: 'particulier_bailleur', siret: '  ' })).toBe(false)
    expect(estClientProfessionnel({})).toBe(false)
  })
})

describe('ligneTvaHorsClassique', () => {
  it('autoliquidation : pas de taux, la TVA est due par le preneur', () => {
    expect(ligneTvaHorsClassique('autoliquidation_btp')).toEqual({ libelle: 'TVA', valeur: 'Autoliquidation' })
  })

  it('franchise en base : TVA non applicable', () => {
    expect(ligneTvaHorsClassique('franchise_293b')).toEqual({ libelle: 'TVA', valeur: 'Non applicable' })
  })

  it('régime classique : les lignes par taux restent affichées', () => {
    expect(ligneTvaHorsClassique('classique')).toBeNull()
  })
})

describe('formaterImmatriculationRcs', () => {
  it.each([
    ['RCS Aix-en-Provence 941 761 967', 'RCS Aix-en-Provence 941 761 967'],
    ['941 761 967 R.C.S. Aix-en-Provence', 'RCS Aix-en-Provence 941 761 967'],
    ['RCS : Marseille 123456789', 'RCS Marseille 123 456 789'],
    ['rcs Marseille 123 456 789', 'RCS Marseille 123 456 789'],
    ['Aix-en-Provence', 'RCS Aix-en-Provence'],
    ['941761967', 'RCS 941 761 967'],
    ['RM Marseille 953951589', 'RM Marseille 953951589'],
    ['SIREN 941761967 RCS Marseille', 'RCS Marseille 941 761 967'],
    ['B 941 761 967 RCS Aix-en-Provence', 'RCS Aix-en-Provence 941 761 967'],
    ['RCS Paris 8e 123 456 789', 'RCS Paris 8e 123 456 789'],
    ['RCS Les Arcs 123 456 789', 'RCS Les Arcs 123 456 789'],
  ])('« %s » → « %s »', (saisie, attendu) => {
    expect(formaterImmatriculationRcs(saisie)).toBe(attendu)
  })

  it.each([
    'R.M. Marseille 953951589',
    'Marseille RM 953951589',
    'RNE 953951589',
    'Répertoire des métiers de Marseille 953951589',
  ])('saisie à un autre registre que le RCS, laissée telle quelle : « %s »', (saisie) => {
    expect(formaterImmatriculationRcs(saisie)).toBe(saisie)
  })

  it('rend une chaîne vide sans saisie, ou pour « RCS » seul (le repère « à renseigner » s\'affiche)', () => {
    expect(formaterImmatriculationRcs('')).toBe('')
    expect(formaterImmatriculationRcs(null)).toBe('')
    expect(formaterImmatriculationRcs('   ')).toBe('')
    expect(formaterImmatriculationRcs('RCS')).toBe('')
    expect(formaterImmatriculationRcs('R.C.S. :')).toBe('')
  })
})
