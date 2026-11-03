// Référence SEO PT écrite par pt-tests.mjs --mode reference : ses valeurs viennent du site audité (réseau)
// et sont validées avant écriture (CodeQL js/http-to-file-access). Aucun accès réseau.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BORNES_REFERENCE, problemeReference, referenceValide } from '../../scripts/seo/pt-audit/lib/reference.mjs'

const DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const REFERENCE = JSON.parse(readFileSync(path.join(DEPOT, 'data', 'seo', 'reference-seo-pt.json'), 'utf8'))
const PAGE = '/fr/services/peintre-six-fours-les-plages/'

/** Référence du dépôt dont la mesure FR de PAGE est modifiée. */
const avecMesure = (modif: Record<string, unknown>) => ({
  ...REFERENCE,
  fr: { ...REFERENCE.fr, [PAGE]: { ...REFERENCE.fr[PAGE], ...modif } },
})

describe('referenceValide — référence écrite par pt-tests --mode reference', () => {
  it('accepte la référence du dépôt (13/10/2026)', () => {
    expect(problemeReference(REFERENCE)).toBe('')
    expect(referenceValide(REFERENCE)).toBe(true)
  })

  it('refuse un title trop long ou avec un caractère de contrôle, sans recopier la valeur', () => {
    const long = 'x'.repeat(BORNES_REFERENCE.texte + 1)
    expect(problemeReference(avecMesure({ title: long }))).toBe('fr : ' + PAGE + ' : title hors bornes')
    expect(problemeReference(avecMesure({ title: 'Peintre\u0007 Six-Fours' }))).toBe('fr : ' + PAGE + ' : title hors bornes')
    expect(referenceValide(avecMesure({ title: long }))).toBe(false)
  })

  it('refuse un statut non entier, une canonique, des hreflang ou un champ hors du format', () => {
    expect(problemeReference(avecMesure({ status: '200' }))).toContain('statut HTTP entier attendu')
    expect(problemeReference(avecMesure({ status: 600 }))).toContain('statut HTTP entier attendu')
    expect(problemeReference(avecMesure({ canonical: 42 }))).toContain('canonique hors bornes')
    const hreflang = Array.from({ length: BORNES_REFERENCE.liste + 1 }, () => 'fr-FR=https://vitfix.io/fr/')
    expect(problemeReference(avecMesure({ hreflang }))).toContain('hreflang hors bornes')
    expect(problemeReference(avecMesure({ corps: '<html>' }))).toContain('champ inattendu')
  })

  it('refuse une empreinte mal formée, une clé inattendue, un chemin ou un nombre de pages hors bornes', () => {
    expect(problemeReference({ ...REFERENCE, 'sha256_/sitemap/2.xml': 'abc' })).toBe('sha256_/sitemap/2.xml : empreinte SHA-256 attendue')
    expect(problemeReference({ ...REFERENCE, autre: 1 })).toBe('autre : clé inattendue')
    expect(problemeReference({ ...REFERENCE, fr: { 'https://ailleurs.example/': REFERENCE.fr[PAGE] } })).toBe('fr : chemin de page hors bornes')
    const trop = BORNES_REFERENCE.pages + 1
    const pages = Object.fromEntries(Array.from({ length: trop }, (_, i) => ['/fr/page-' + i + '/', REFERENCE.fr[PAGE]]))
    expect(problemeReference({ ...REFERENCE, fr: pages })).toBe('fr : ' + trop + ' pages, au plus ' + BORNES_REFERENCE.pages)
  })

  it('refuse ce qui n’est pas un objet', () => {
    for (const v of [null, [], 'référence']) expect(referenceValide(v)).toBe(false)
  })
})
