// tests/lib/aj-signalement-export-csv.test.ts
//
// « Exporter la liste (CSV) » après un import (SPEC § 1.9.7) : nom, adresse, CP, ville, gestionnaires, lien public du QR
// code (chemin du cabinet client, choix de Hugo du 10/11/2026). Généré dans le navigateur, conservé nulle part. Toute
// cellule qui commence par =, +, -, @, une tabulation ou un retour chariot est préfixée d'une apostrophe : les noms
// viennent du fichier d'un tiers et la liste s'ouvre dans Excel (injection de formule). Données fictives seulement.

import { describe, expect, it } from 'vitest'
import { celluleCsvQr, exportCoproprietesCsvQr, neutraliserCelluleCsvQr } from '@/lib/aj-signalement/import/export-csv'
import { decouperCsvQr } from '@/lib/aj-signalement/import/csv'

const JETON = '0123456789abcdef0123456789abcdef'

describe('neutralisation des formules', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+33 6 00 00 00 00', "'+33 6 00 00 00 00"],
    ['-2', "'-2"],
    ['@SOMME(A1:A2)', "'@SOMME(A1:A2)"],
    ['\tcachée', "'\tcachée"],
    ['\rretour', "'\rretour"],
  ])('« %s » → « %s »', (brut, attendu) => {
    expect(neutraliserCelluleCsvQr(brut)).toBe(attendu)
  })

  it('texte ordinaire inchangé ; signe au milieu inchangé', () => {
    expect(neutraliserCelluleCsvQr('Résidence Exemple')).toBe('Résidence Exemple')
    expect(neutraliserCelluleCsvQr('Bât. A-B')).toBe('Bât. A-B')
    expect(neutraliserCelluleCsvQr('')).toBe('')
  })

  it('cellule : neutralisée PUIS mise entre guillemets si besoin (« ; », guillemet, retour à la ligne)', () => {
    expect(celluleCsvQr('=HYPERLINK("x";"y")')).toBe('"\'=HYPERLINK(""x"";""y"")"')
    expect(celluleCsvQr('1 rue Exemple\nBât. A')).toBe('"1 rue Exemple\nBât. A"')
    expect(celluleCsvQr('simple')).toBe('simple')
  })
})

describe('liste exportée', () => {
  const csv = exportCoproprietesCsvQr([
    { nom: '=Résidence Exemple', adresse: '1 rue Exemple', codePostal: '13008', ville: 'Marseille', gestionnaires: ['Marie Exemple', '@Paul Exemple'], jeton: JETON, identifiantCabinet: 'cabinet-exemple' },
    { nom: 'Villa Exemple', adresse: '', codePostal: '', ville: '', gestionnaires: [], jeton: JETON, identifiantCabinet: null },
  ], 'https://vitfix.io')

  it('UTF-8 avec BOM, séparateur « ; », fins de ligne CRLF', () => {
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('\r\n')
  })

  it('colonnes : nom, adresse, CP, ville, gestionnaires, lien public (chemin du cabinet ; ancien chemin sans cabinet)', () => {
    const { lignes } = decouperCsvQr(csv.slice(1))
    expect(lignes).toEqual([
      ['Nom', 'Adresse', 'Code postal', 'Ville', 'Gestionnaire(s)', 'Lien du QR code'],
      ["'=Résidence Exemple", '1 rue Exemple', '13008', 'Marseille', 'Marie Exemple, @Paul Exemple', `https://vitfix.io/cabinet-exemple/signalement/${JETON}/`],
      ['Villa Exemple', '', '', '', '', `https://vitfix.io/fr/signalement/${JETON}/`],
    ])
  })
})
