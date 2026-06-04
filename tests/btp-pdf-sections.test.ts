// tests/btp-pdf-sections.test.ts — Régression Bug A (frais annexes absent du
// PDF V3 BTP) + Bug B (matérial/frais perdus à la réouverture du devis).
//
// Le PDF V3 builder fait du heavy DOM/jsPDF — au lieu de mocker tout jsPDF,
// on isole la **logique de sélection des sections** dans une fonction pure
// testable et on vérifie ses sorties avec les inputs critiques (description
// nulle, lignes vides, enabled=false, customTables mélangés).
//
// Cette logique mirror la sous-fonction `hasFilled` + les conditions
// `materialLinesEnabled !== false`, `fraisLinesEnabled !== false` dans
// lib/pdf/devis-pdf-v3.ts lignes 998-1013.

import { describe, it, expect } from 'vitest'

// Réplique de la logique implémentée dans devis-pdf-v3.ts. Si on touche au
// PDF V3, on doit garder ces deux fonctions synchronisées (ou extraire la
// helper dans un module partagé).
type Line = { description?: unknown }
type CustomTable = { name?: string; lines?: Line[] } | null

const hasFilled = (arr: Line[] | undefined | null): boolean =>
  Array.isArray(arr) && arr.some(l => l && typeof l.description === 'string' && (l.description as string).trim().length > 0)

interface PdfSectionInputs {
  linesName?: string
  laborLines?: Line[]
  materialLines?: Line[]
  fraisLines?: Line[]
  materialLinesName?: string
  fraisLinesName?: string
  materialLinesEnabled?: boolean
  fraisLinesEnabled?: boolean
  customTables?: CustomTable[]
}

function buildSections(input: PdfSectionInputs): Array<{ name: string }> {
  const sections: Array<{ name: string }> = []
  const defaultLabor = "Main d'œuvre"
  const defaultMaterial = 'Matériaux'
  const defaultFrais = 'Frais annexes'

  if (hasFilled(input.laborLines)) {
    sections.push({ name: input.linesName || defaultLabor })
  }
  if (input.materialLinesEnabled !== false && hasFilled(input.materialLines)) {
    sections.push({ name: input.materialLinesName || defaultMaterial })
  }
  if (input.fraisLinesEnabled !== false && hasFilled(input.fraisLines)) {
    sections.push({ name: input.fraisLinesName || defaultFrais })
  }
  if (Array.isArray(input.customTables) && input.customTables.length > 0) {
    for (const ct of input.customTables) {
      if (ct && hasFilled(ct.lines)) {
        sections.push({ name: ct.name || 'Section' })
      }
    }
  }
  return sections
}

describe('BTP PDF V3 — section selection logic', () => {
  it('Bug A — frais annexes apparaît quand fraisLines a au moins une description', () => {
    const sections = buildSections({
      laborLines: [{ description: 'Pose carrelage' }],
      materialLines: [{ description: 'Briques' }],
      fraisLines: [{ description: 'Transport' }],
      fraisLinesEnabled: true,
    })
    expect(sections.map(s => s.name)).toEqual([
      "Main d'œuvre",
      'Matériaux',
      'Frais annexes',
    ])
  })

  it('Bug A — frais annexes apparaît avec nom personnalisé', () => {
    const sections = buildSections({
      laborLines: [{ description: 'Pose' }],
      fraisLines: [{ description: 'Déplacement' }],
      fraisLinesName: 'MES FRAIS',
      fraisLinesEnabled: true,
    })
    expect(sections.find(s => s.name === 'MES FRAIS')).toBeDefined()
  })

  it('frais annexes absent si fraisLinesEnabled === false', () => {
    const sections = buildSections({
      laborLines: [{ description: 'Pose' }],
      fraisLines: [{ description: 'Transport' }],
      fraisLinesEnabled: false,
    })
    expect(sections.find(s => s.name === 'Frais annexes')).toBeUndefined()
  })

  it('frais annexes présent si fraisLinesEnabled est undefined (legacy non-stocké)', () => {
    const sections = buildSections({
      laborLines: [{ description: 'Pose' }],
      fraisLines: [{ description: 'Transport' }],
      // fraisLinesEnabled NON défini — backward compat
    })
    expect(sections.find(s => s.name === 'Frais annexes')).toBeDefined()
  })

  it('frais annexes absent si toutes les lignes ont description vide ou whitespace', () => {
    const sections = buildSections({
      laborLines: [{ description: 'Pose' }],
      fraisLines: [{ description: '   ' }, { description: '' }],
      fraisLinesEnabled: true,
    })
    expect(sections.find(s => s.name === 'Frais annexes')).toBeUndefined()
  })

  it('robustesse : ne crash pas si une ligne a description undefined (localStorage corrompu)', () => {
    expect(() =>
      buildSections({
        laborLines: [{ description: 'Pose' }],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fraisLines: [{ description: undefined } as any, { description: 'Transport' }],
        fraisLinesEnabled: true,
      }),
    ).not.toThrow()
    const sections = buildSections({
      laborLines: [{ description: 'Pose' }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fraisLines: [{ description: undefined } as any, { description: 'Transport' }],
      fraisLinesEnabled: true,
    })
    expect(sections.find(s => s.name === 'Frais annexes')).toBeDefined()
  })

  it('robustesse : customTables avec entrée null ne crash pas', () => {
    expect(() =>
      buildSections({
        laborLines: [{ description: 'Pose' }],
        customTables: [null, { name: 'Démolition', lines: [{ description: 'Murs' }] }],
      }),
    ).not.toThrow()
    const sections = buildSections({
      laborLines: [{ description: 'Pose' }],
      customTables: [null, { name: 'Démolition', lines: [{ description: 'Murs' }] }],
    })
    expect(sections.find(s => s.name === 'Démolition')).toBeDefined()
  })

  it('robustesse : laborLines avec description undefined ne crash pas', () => {
    const sections = buildSections({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      laborLines: [{ description: undefined } as any],
      fraisLines: [{ description: 'Transport' }],
      fraisLinesEnabled: true,
    })
    // Pas de section labor (toutes les descriptions vides) mais frais OK
    expect(sections.find(s => s.name === "Main d'œuvre")).toBeUndefined()
    expect(sections.find(s => s.name === 'Frais annexes')).toBeDefined()
  })

  it('combine fraisLines + customTables type frais', () => {
    const sections = buildSections({
      laborLines: [{ description: 'Pose' }],
      fraisLines: [{ description: 'Déplacement' }],
      fraisLinesEnabled: true,
      customTables: [{ name: 'Sous-traitance', lines: [{ description: 'Carreleur' }] }],
    })
    expect(sections.map(s => s.name)).toContain('Frais annexes')
    expect(sections.map(s => s.name)).toContain('Sous-traitance')
  })
})

// Bug B — quand on re-ouvre un devis BTP sauvegardé, materialLines et
// fraisLines doivent être hydratés depuis `initialData` (pas resets aux
// placeholders vides). Test de la logique d'init du form.

interface BtpInitialData {
  lines?: Array<{ description: string }>
  materialLines?: Array<{ description: string }>
  fraisLines?: Array<{ description: string }>
  customTables?: Array<{ name: string; lines: Array<{ description: string }> }>
}

// Réplique des lignes 476-501 de DevisFactureFormBTP.tsx
function initFormSections(initialData: BtpInitialData | undefined) {
  const lines = initialData?.lines && initialData.lines.length > 0
    ? initialData.lines
    : [{ id: 1, description: '' }]
  const _initialMaterial = initialData?.materialLines
  const _initialFrais = initialData?.fraisLines
  const materialLines = Array.isArray(_initialMaterial) && _initialMaterial.length > 0
    ? _initialMaterial
    : [{ id: 1, description: '' }]
  const fraisLines = Array.isArray(_initialFrais) && _initialFrais.length > 0
    ? _initialFrais
    : [{ id: 1, description: '' }]
  return { lines, materialLines, fraisLines }
}

describe('BTP form — Bug B re-open: materialLines/fraisLines hydration', () => {
  it('matérial et frais hydratés depuis initialData quand non-vides', () => {
    const init = initFormSections({
      lines: [{ description: 'Pose' }],
      materialLines: [{ description: 'Briques' }, { description: 'Ciment' }],
      fraisLines: [{ description: 'Transport' }],
    })
    expect(init.materialLines).toHaveLength(2)
    expect(init.fraisLines).toHaveLength(1)
    expect(init.materialLines[0]).toEqual(expect.objectContaining({ description: 'Briques' }))
    expect(init.fraisLines[0]).toEqual(expect.objectContaining({ description: 'Transport' }))
  })

  it('fallback placeholder quand initialData ne contient pas matérial/frais (legacy)', () => {
    const init = initFormSections({
      lines: [{ description: 'Pose' }],
      // pas de materialLines ni fraisLines (devis pré-feature)
    })
    expect(init.materialLines).toHaveLength(1)
    expect(init.fraisLines).toHaveLength(1)
    expect(init.materialLines[0]).toEqual(expect.objectContaining({ description: '' }))
    expect(init.fraisLines[0]).toEqual(expect.objectContaining({ description: '' }))
  })

  it('fallback placeholder quand initialData.materialLines = [] (vide explicite)', () => {
    const init = initFormSections({
      lines: [{ description: 'Pose' }],
      materialLines: [],
      fraisLines: [],
    })
    expect(init.materialLines).toHaveLength(1)
    expect(init.fraisLines).toHaveLength(1)
  })

  it('fallback placeholder quand initialData = undefined (nouveau devis)', () => {
    const init = initFormSections(undefined)
    expect(init.lines).toHaveLength(1)
    expect(init.materialLines).toHaveLength(1)
    expect(init.fraisLines).toHaveLength(1)
  })
})
