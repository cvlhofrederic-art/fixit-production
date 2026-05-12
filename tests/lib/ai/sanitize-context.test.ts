import { describe, it, expect } from 'vitest'
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'

describe('sanitizeContextForLLM', () => {
  it('remplace les emails par des tokens', () => {
    const { sanitized, tokenMap } = sanitizeContextForLLM({
      contact: { email: 'marie.dupont@gmail.com' }
    })
    expect(sanitized.contact.email).toMatch(/^<email:[a-f0-9]{8}>$/)
    expect(tokenMap.size).toBe(1)
    const [, value] = Array.from(tokenMap.entries())[0]
    expect(value).toBe('marie.dupont@gmail.com')
  })

  it('remplace les téléphones FR avec ou sans +33', () => {
    const { sanitized } = sanitizeContextForLLM({
      phones: ['+33612345678', '06 12 34 56 78', '01.23.45.67.89']
    })
    expect(sanitized.phones[0]).toMatch(/^<phone:/)
    expect(sanitized.phones[1]).toMatch(/^<phone:/)
    expect(sanitized.phones[2]).toMatch(/^<phone:/)
  })

  it('remplace les téléphones PT (+351)', () => {
    const { sanitized } = sanitizeContextForLLM({
      phone: '+351 912 345 678'
    })
    expect(sanitized.phone).toMatch(/^<phone:/)
  })

  it('remplace les IBAN FR', () => {
    const { sanitized } = sanitizeContextForLLM({
      iban: 'FR76 3000 4000 0312 3456 7890 143'
    })
    expect(sanitized.iban).toMatch(/^<iban:/)
  })

  it('remplace les IBAN PT', () => {
    const { sanitized } = sanitizeContextForLLM({
      iban: 'PT50000201231234567890154'
    })
    expect(sanitized.iban).toMatch(/^<iban:/)
  })

  it('remplace les adresses postales (heuristique mot-clé)', () => {
    const { sanitized } = sanitizeContextForLLM({
      address: '12 rue de la Paix, 75002 Paris'
    })
    expect(sanitized.address).toMatch(/^<address:/)
  })

  it('préserve les nombres simples sans les confondre avec IBAN', () => {
    const { sanitized } = sanitizeContextForLLM({
      count: 42,
      year: 2026,
      amount: 1500.50,
    })
    expect(sanitized.count).toBe(42)
    expect(sanitized.year).toBe(2026)
    expect(sanitized.amount).toBe(1500.50)
  })

  it('traverse les objets imbriqués et tableaux', () => {
    const { sanitized, tokenMap } = sanitizeContextForLLM({
      coproprios: [
        { nom: 'Dupont', email: 'a@b.fr' },
        { nom: 'Costa', email: 'c@d.pt' },
      ]
    })
    expect(sanitized.coproprios[0].email).toMatch(/^<email:/)
    expect(sanitized.coproprios[1].email).toMatch(/^<email:/)
    expect(tokenMap.size).toBe(2)
  })

  it('tokens déterministes : même valeur → même token dans une session', () => {
    const { sanitized: s1 } = sanitizeContextForLLM({ a: 'x@y.fr', b: 'x@y.fr' })
    expect(s1.a).toBe(s1.b)
  })

  it('résiste à null et undefined', () => {
    const { sanitized } = sanitizeContextForLLM({
      email: null,
      phone: undefined,
      iban: '',
    })
    expect(sanitized.email).toBeNull()
    expect(sanitized.phone).toBeUndefined()
    expect(sanitized.iban).toBe('')
  })

  it('ne mute pas l\'objet d\'entrée', () => {
    const input = { email: 'a@b.fr' }
    sanitizeContextForLLM(input)
    expect(input.email).toBe('a@b.fr')
  })

  it('résiste aux objets cycliques (anti boucle infinie)', () => {
    const cyclic: Record<string, unknown> = { name: 'x' }
    cyclic.self = cyclic
    expect(() => sanitizeContextForLLM(cyclic)).not.toThrow()
  })

  it('booleans, dates et autres primitives passent inchangés', () => {
    const date = new Date('2026-05-11')
    const { sanitized } = sanitizeContextForLLM({
      flag: true,
      created: date,
      pi: Math.PI,
    })
    expect(sanitized.flag).toBe(true)
    expect(sanitized.created).toBe(date)
    expect(sanitized.pi).toBe(Math.PI)
  })
})

describe('resolveSanitizedToken', () => {
  it('réinjecte la valeur originale à partir du token', () => {
    const { sanitized, tokenMap } = sanitizeContextForLLM({ email: 'a@b.fr' })
    const token = sanitized.email as string
    const real = resolveSanitizedToken(token, tokenMap)
    expect(real).toBe('a@b.fr')
  })

  it('retourne null si le token exact est inconnu', () => {
    const tokenMap = new Map()
    expect(resolveSanitizedToken('<email:deadbeef>', tokenMap)).toBeNull()
  })

  it('remplace tous les tokens présents dans une string LLM-générée', () => {
    const { sanitized, tokenMap } = sanitizeContextForLLM({ email: 'a@b.fr' })
    const token = sanitized.email as string
    const llmOutput = `Contacter ${token} pour confirmer.`
    const real = resolveSanitizedToken(llmOutput, tokenMap)
    expect(real).toBe('Contacter a@b.fr pour confirmer.')
  })

  it('laisse intact les tokens inconnus dans une string (pas null)', () => {
    const tokenMap = new Map<string, string>([['<email:aaaaaaaa>', 'real@x.fr']])
    const out = resolveSanitizedToken('A <email:aaaaaaaa> B <email:bbbbbbbb> C', tokenMap)
    expect(out).toBe('A real@x.fr B <email:bbbbbbbb> C')
  })
})
