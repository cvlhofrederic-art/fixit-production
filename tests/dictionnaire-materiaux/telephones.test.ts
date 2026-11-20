// @vitest-environment node
// Masquage des numéros de téléphone portugais écrits sans « +351 » (lib/dictionnaire-materiaux/ia/telephones.ts),
// avant l'envoi d'une description de chantier au modèle : les numéros partent masqués, les mesures restent lisibles,
// et le masquage commun rétablit les numéros dans la réponse.

import { describe, expect, it } from 'vitest'
import { resolveSanitizedToken, sanitizeContextForLLM } from '@/lib/ai/sanitize-context'
import { masquerTelephonesPortugais } from '@/lib/dictionnaire-materiaux/ia/telephones'

const JETON = /<phone:[a-f0-9]{8}>/g

describe('masquage des téléphones portugais', () => {
  it('masque les écritures courantes, mobiles et fixes, avec ou sans indicatif', () => {
    const numeros = ['912 345 678', '912345678', '934-567-890', '961.234.567', '22 123 4567', '234 567 890', '219876543', '351 934567890', '00351 961234567']
    for (const numero of numeros) {
      const tokenMap = new Map<string, string>()
      const masque = masquerTelephonesPortugais(`Cliente: ${numero}.`, tokenMap)
      expect(masque, numero).toMatch(/^Cliente: <phone:[a-f0-9]{8}>\.$/)
      expect([...tokenMap.values()], numero).toEqual([numero])
    }
  })

  it('laisse les mesures, les années et les suites plus longues', () => {
    const textes = [
      'Três paredes com 250-300-280 cm de altura.',
      'Alturas 250 260 270 cm, larguras 912 345 678 mm.',
      'Área 260.000.000 m² ao todo.',
      'Orçamento 250 000 000 €.',
      'Fissura de 2 mm numa parede de 250 x 300 cm, rebocada em 2019.',
      'Referência 9123456789 (dez algarismos) e lote 12345678 (oito).',
    ]
    for (const texte of textes) {
      const tokenMap = new Map<string, string>()
      expect(masquerTelephonesPortugais(texte, tokenMap), texte).toBe(texte)
      expect(tokenMap.size, texte).toBe(0)
    }
  })

  it('donne un même jeton à un même numéro, sans reprendre un jeton déjà pris', () => {
    const tokenMap = new Map<string, string>([['<phone:7e000000>', '+351 912 000 000']])
    const masque = masquerTelephonesPortugais('Ligar 912 345 678, ou 912 345 678 à noite, ou 22 123 4567.', tokenMap)
    const jetons = masque.match(JETON) ?? []
    expect(jetons).toHaveLength(3)
    expect(jetons[0]).toBe(jetons[1])
    expect(new Set(jetons).size).toBe(2)
    expect(jetons).not.toContain('<phone:7e000000>')
    expect(tokenMap.get('<phone:7e000000>')).toBe('+351 912 000 000')
  })

  it('se rétablit avec le masquage commun, après lui', () => {
    const { sanitized, tokenMap } = sanitizeContextForLLM(
      { texte: 'Cliente 912 345 678 ou +351 913 222 111, ana@exemplo.pt.' },
      { types: ['email', 'phone', 'iban'] },
    )
    const masque = masquerTelephonesPortugais(sanitized.texte, tokenMap)
    expect(masque).not.toMatch(/\d{3} \d{3} \d{3}/)
    expect(masque).not.toContain('ana@exemplo.pt')
    expect(resolveSanitizedToken(`Resposta: ${masque}`, tokenMap)).toBe('Resposta: Cliente 912 345 678 ou +351 913 222 111, ana@exemplo.pt.')
  })
})
