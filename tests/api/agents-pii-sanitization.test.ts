import { describe, it, expect } from 'vitest'
import { sanitizeContextForLLM } from '@/lib/ai/sanitize-context'

describe('Agents PII sanitization integration', () => {
  it('un contexte typique syndic est correctement sanitizé', () => {
    const realContext = {
      cabinet: { nom: 'Cabinet Dupont', email: 'contact@cabinet-dupont.fr' },
      artisans: [
        { id: 'a1', nom: 'Jean Plombier', email: 'jean@plombier.fr', phone: '+33612345678' },
        { id: 'a2', nom: 'Maria Eletricista', email: 'maria@eletro.pt', phone: '+351912345678' },
      ],
      coproprios: [
        { nom: 'M. Costa', address: '12 rua das Flores, 4000 Porto', iban: 'PT50000201231234567890154' },
      ],
    }

    const { sanitized, tokenMap } = sanitizeContextForLLM(realContext)
    const serialized = JSON.stringify(sanitized)

    expect(serialized).not.toContain('jean@plombier.fr')
    expect(serialized).not.toContain('maria@eletro.pt')
    expect(serialized).not.toContain('+33612345678')
    expect(serialized).not.toContain('+351912345678')
    expect(serialized).not.toContain('PT50000201231234567890154')
    expect(serialized).not.toContain('rua das Flores')

    expect(serialized).toMatch(/<email:[a-f0-9]{8}>/)
    expect(serialized).toMatch(/<phone:[a-f0-9]{8}>/)
    expect(serialized).toMatch(/<iban:[a-f0-9]{8}>/)
    expect(serialized).toMatch(/<address:[a-f0-9]{8}>/)

    expect(Array.from(tokenMap.values())).toContain('jean@plombier.fr')
    expect(Array.from(tokenMap.values())).toContain('+33612345678')
    expect(Array.from(tokenMap.values())).toContain('PT50000201231234567890154')
  })

  it('cabinet email contact@... est sanitizé', () => {
    const { sanitized } = sanitizeContextForLLM({ contact: 'contact@cabinet-dupont.fr' })
    expect(sanitized.contact).toMatch(/^<email:/)
  })
})
