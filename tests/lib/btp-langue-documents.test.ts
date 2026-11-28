// Langue des documents d'une société BTP (lib/btp/langue-documents.ts) : celle de sa fiche, comme la série de
// numérotation du serveur (lib/numerotation-prefixes.ts), et non celle de l'écran.
import { describe, it, expect } from 'vitest'
import { langueDocumentsBtp } from '@/lib/btp/langue-documents'
import { fichePortugaise } from '@/lib/numerotation-prefixes'

describe('langueDocumentsBtp', () => {
  it.each([
    ['pt', 'fr', 'pt'],
    ['pt', 'pt', 'pt'],
    ['fr', 'pt', 'fr'],
    ['fr', 'fr', 'fr'],
    [null, 'pt', 'fr'],
    ['', 'pt', 'fr'],
    ['en', 'pt', 'fr'],
  ] as const)('fiche en %s, écran en %s → %s', (language, ecran, attendu) => {
    expect(langueDocumentsBtp({ language }, ecran)).toBe(attendu)
  })

  it('fiche inconnue (non chargée, ou sans clé language) : langue de l\'écran', () => {
    expect(langueDocumentsBtp(null, 'pt')).toBe('pt')
    expect(langueDocumentsBtp(undefined, 'pt')).toBe('pt')
    expect(langueDocumentsBtp({ company_name: 'X' }, 'pt')).toBe('pt')
    expect(langueDocumentsBtp({ company_name: 'X' }, 'fr')).toBe('fr')
    // écran anglais, néerlandais ou espagnol : les documents BTP n'existent qu'en français et en portugais
    expect(langueDocumentsBtp(undefined, 'en')).toBe('fr')
  })

  it('toujours d\'accord avec la série de numérotation dès que la fiche est connue', () => {
    for (const language of ['pt', 'fr', null, '', 'en', 'es']) {
      for (const ecran of ['fr', 'pt', 'en']) {
        const fiche = { language }
        expect(langueDocumentsBtp(fiche, ecran) === 'pt').toBe(fichePortugaise(fiche))
      }
    }
  })
})
