import { describe, it, expect, vi, beforeEach } from 'vitest'

const groqMock = vi.fn()

vi.mock('@/lib/groq', () => ({
  callGroqWithRetry: groqMock,
}))

describe('lib/syndic/lea-documents-extract', () => {
  beforeEach(() => {
    groqMock.mockReset()
  })

  describe('extractPdfText', () => {
    it('rejette un buffer sans magic bytes %PDF', async () => {
      const { extractPdfText } = await import('@/lib/syndic/lea-documents-extract')
      const buf = new Uint8Array([1, 2, 3, 4, 5]).buffer
      await expect(extractPdfText(buf)).rejects.toThrow('not_a_pdf')
    })
  })

  describe('extractMetadataFromText', () => {
    it('retourne metadata vide si texte trop court', async () => {
      const { extractMetadataFromText } = await import('@/lib/syndic/lea-documents-extract')
      const result = await extractMetadataFromText('court')
      expect(result.raw_llm).toBe('')
      expect(groqMock).not.toHaveBeenCalled()
    })

    it('parse une réponse JSON valide du LLM', async () => {
      groqMock.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              date_doc: '2026-03-15',
              montant_ttc: 1250.5,
              montant_ht: 1042.08,
              fournisseur: 'Plomberie Dupont SARL',
              numero_facture: 'FACT-2026-007',
              iban: 'FR76 1234 5678 9012',
              type_detected: 'facture_artisan',
              summary_short: 'Réparation fuite salle de bain',
            }),
          },
        }],
      })
      const { extractMetadataFromText } = await import('@/lib/syndic/lea-documents-extract')
      const result = await extractMetadataFromText('Facture FACT-2026-007 Plomberie Dupont SARL 1250.50 EUR'.repeat(2))
      expect(result.date_doc).toBe('2026-03-15')
      expect(result.montant_ttc).toBe(1250.5)
      expect(result.fournisseur).toBe('Plomberie Dupont SARL')
      expect(result.iban).toBe('FR7612345678901 2'.replace(/\s/g, ''))
      expect(result.type_detected).toBe('facture_artisan')
    })

    it('rejette un type_detected invalide', async () => {
      groqMock.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              fournisseur: 'X',
              type_detected: 'invalid_type',
            }),
          },
        }],
      })
      const { extractMetadataFromText } = await import('@/lib/syndic/lea-documents-extract')
      const result = await extractMetadataFromText('blah '.repeat(30))
      expect(result.type_detected).toBeNull()
    })

    it('tolère les fences markdown ```json', async () => {
      groqMock.mockResolvedValueOnce({
        choices: [{
          message: {
            content: '```json\n{"montant_ttc": 99.99}\n```',
          },
        }],
      })
      const { extractMetadataFromText } = await import('@/lib/syndic/lea-documents-extract')
      const result = await extractMetadataFromText('blah '.repeat(30))
      expect(result.montant_ttc).toBe(99.99)
    })

    it('retourne metadata vide si JSON invalide', async () => {
      groqMock.mockResolvedValueOnce({
        choices: [{ message: { content: 'pas du json' } }],
      })
      const { extractMetadataFromText } = await import('@/lib/syndic/lea-documents-extract')
      const result = await extractMetadataFromText('blah '.repeat(30))
      expect(result.montant_ttc).toBeUndefined()
      expect(result.raw_llm).toContain('pas du json')
    })
  })
})
