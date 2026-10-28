import { describe, it, expect, vi } from 'vitest'

// Pré-rendu serveur d'un composant client : DOMPurify n'a pas de DOM (isSupported faux, sanitize absent).
vi.mock('dompurify', () => ({ default: { isSupported: false } }))

import { assainirHtml } from '@/lib/security/assainir-html'

describe('assainirHtml sans DOM (repli serveur)', () => {
  it('retombe sur la liste blanche de lib/sanitize sans appeler DOMPurify', () => {
    const resultat = assainirHtml('<p>ok</p><script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)" onclick="x()">lien</a>')
    expect(resultat).toContain('<p>ok</p>')
    expect(resultat).not.toContain('<script')
    expect(resultat).not.toContain('<img')
    expect(resultat).not.toContain('onerror')
    expect(resultat).not.toContain('onclick')
    expect(resultat).not.toContain('javascript:')
  })

  it('retourne une chaîne vide pour une entrée vide', () => {
    expect(assainirHtml('')).toBe('')
  })
})
