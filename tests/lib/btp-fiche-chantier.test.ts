// tests/lib/btp-fiche-chantier.test.ts — règles d'enregistrement de la fiche chantier BTP (lib/btp/fiche-chantier.ts,
// 17/11/2026) : seuls les champs modifiés partent ; la position enregistrée ne se perd pas quand on corrige l'adresse.

import { describe, expect, it } from 'vitest'
import {
  adresseModifiee, avertissementPositionGardee, champsModifies, memePosition, porteLaPositionEnregistree,
  questionGarderPosition, questionPositionNecessaire, questionRetirerPosition,
} from '@/lib/btp/fiche-chantier'

const OUVERTE = {
  titre: 'Villa', adresse: '1 rue des Lilas', codePostal: '13008', ville: 'Marseille',
  latitude: 43.2504 as number | null, longitude: 5.3801 as number | null, geoRayonM: 50, membres_ids: ['m-paul', 'm-jean'],
  devis_id: null as string | null,
}

describe('champsModifies', () => {
  it('rien de modifié : aucun champ', () => {
    expect(champsModifies(OUVERTE, { ...OUVERTE })).toEqual({})
  })

  it('seuls les champs modifiés, avec leur nouvelle valeur (null compris)', () => {
    expect(champsModifies(OUVERTE, { ...OUVERTE, titre: 'Villa rénovée', latitude: null, longitude: null }))
      .toEqual({ titre: 'Villa rénovée', latitude: null, longitude: null })
  })

  it('employés : même liste dans un autre ordre = inchangée ; un employé de plus ou de moins = modifiée', () => {
    expect(champsModifies(OUVERTE, { ...OUVERTE, membres_ids: ['m-jean', 'm-paul'] })).toEqual({})
    expect(champsModifies(OUVERTE, { ...OUVERTE, membres_ids: ['m-paul'] })).toEqual({ membres_ids: ['m-paul'] })
    expect(champsModifies(OUVERTE, { ...OUVERTE, membres_ids: ['m-paul', 'm-luc'] })).toEqual({ membres_ids: ['m-paul', 'm-luc'] })
  })

  it('absent et null se valent (chantier sans position dont on corrige l’adresse : aucun null renvoyé)', () => {
    expect(champsModifies({ latitude: undefined as number | null | undefined }, { latitude: null })).toStrictEqual({})
    expect(champsModifies({ devis_id: null as string | null | undefined }, { devis_id: undefined })).toStrictEqual({})
    expect(champsModifies({ devis_id: null as string | null }, { devis_id: 'd-1' })).toStrictEqual({ devis_id: 'd-1' })
  })
})

describe('adresse et position', () => {
  it('adresse modifiée : rue, code postal ou ville ; espaces et majuscules ne comptent pas', () => {
    expect(adresseModifiee(OUVERTE, { ...OUVERTE })).toBe(false)
    expect(adresseModifiee(OUVERTE, { ...OUVERTE, ville: '  MARSEILLE ', adresse: '1  rue des lilas' })).toBe(false)
    expect(adresseModifiee(OUVERTE, { ...OUVERTE, adresse: '3 rue des Lilas' })).toBe(true)
    expect(adresseModifiee(OUVERTE, { ...OUVERTE, codePostal: '13009' })).toBe(true)
    expect(adresseModifiee(OUVERTE, { ...OUVERTE, ville: 'Aubagne' })).toBe(true)
  })

  it('même position : coordonnées égales, ou toutes deux absentes', () => {
    expect(memePosition({ latitude: 43.25, longitude: 5.38 }, { latitude: 43.25, longitude: 5.38 })).toBe(true)
    expect(memePosition({ latitude: null, longitude: null }, {})).toBe(true)
    expect(memePosition({ latitude: 43.25, longitude: 5.38 }, { latitude: 43.25, longitude: 5.39 })).toBe(false)
  })

  it('la fiche porte la position enregistrée : valable à l’ouverture et inchangée ; jamais pour un nouveau chantier', () => {
    expect(porteLaPositionEnregistree(OUVERTE, { latitude: 43.2504, longitude: 5.3801 })).toBe(true)
    expect(porteLaPositionEnregistree(OUVERTE, { latitude: 43.26, longitude: 5.39 })).toBe(false)
    expect(porteLaPositionEnregistree({ latitude: null, longitude: null }, { latitude: null, longitude: null })).toBe(false)
    expect(porteLaPositionEnregistree({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(false)
    expect(porteLaPositionEnregistree(null, { latitude: 43.2504, longitude: 5.3801 })).toBe(false)
  })

  it('question à l’enregistrement : adresse modifiée et position enregistrée encore portée, seulement', () => {
    expect(questionPositionNecessaire(OUVERTE, { ...OUVERTE, codePostal: '13009' })).toBe(true)
    expect(questionPositionNecessaire(OUVERTE, { ...OUVERTE })).toBe(false)
    expect(questionPositionNecessaire(OUVERTE, { ...OUVERTE, codePostal: '13009', latitude: 43.26, longitude: 5.39 })).toBe(false)
    expect(questionPositionNecessaire({ ...OUVERTE, latitude: null, longitude: null }, { ...OUVERTE, codePostal: '13009', latitude: null, longitude: null })).toBe(false)
    expect(questionPositionNecessaire(null, { ...OUVERTE, codePostal: '13009' })).toBe(false)
  })
})

describe('questions posées', () => {
  it('1re question, français et portugais : OK garde la position ; le second bouton n’est pas nommé (son libellé dépend du navigateur)', () => {
    const fr = questionGarderPosition('Villa', false)
    expect(fr).toContain('L’adresse du chantier « Villa » a changé.')
    expect(fr).toContain('OK : garder la position (adresse corrigée).')
    expect(fr).toContain('L’autre bouton : la retirer, ou revenir à la fiche (une seconde question suit).')
    expect(fr).not.toContain('Annuler')
    const pt = questionGarderPosition('Moradia', true)
    expect(pt).toContain('A morada da obra « Moradia » mudou.')
    expect(pt).toContain('OK: manter a posição (morada corrigida).')
    expect(pt).toContain('Outro botão: retirá-la ou voltar à ficha')
  })

  it('2e question : seul OK retire ; l’autre bouton revient à la fiche ; où retrouver « Placer à ma position actuelle »', () => {
    const fr = questionRetirerPosition('Villa', false)
    expect(fr).toContain('Retirer la position GPS du chantier « Villa » (le chantier a changé d’endroit) ?')
    expect(fr).toContain('OK : la retirer et enregistrer')
    expect(fr).toContain('(écran Pointage équipes, onglet Affectations)')
    expect(fr).toContain('L’autre bouton : revenir à la fiche sans rien enregistrer.')
    const pt = questionRetirerPosition('Moradia', true)
    expect(pt).toContain('Retirar a posição GPS da obra « Moradia »')
    expect(pt).toContain('(ecrã Registo de horas, separador Atribuições)')
    expect(pt).toContain('Outro botão: voltar à ficha sem guardar nada.')
  })

  it('avertissement du bouton GPS quand la position enregistrée est gardée', () => {
    expect(avertissementPositionGardee(false)).toContain('la position actuelle du chantier est gardée')
    expect(avertissementPositionGardee(true)).toContain('a posição atual da obra é mantida')
  })
})
