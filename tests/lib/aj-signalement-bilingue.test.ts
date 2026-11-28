// tests/lib/aj-signalement-bilingue.test.ts
//
// Tables bilingues (lib/aj-signalement/bilingue.ts) : textes FR et PT écrits clé par clé, rangés par langue dans
// l'ordre de la table, sous-tables comprises. Les dictionnaires de la page publique (textes.ts) et de l'e-mail de
// confirmation (email.ts) ont les mêmes clés dans les deux langues, et aucun texte vide.

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))

import { parLangue } from '@/lib/aj-signalement/bilingue'
import { TEXTES_CONFIRMATION_QR } from '@/lib/aj-signalement/email'
import { TEXTES_SIGNALEMENT_QR } from '@/lib/aj-signalement/textes'

describe('parLangue', () => {
  it('range chaque clé dans sa langue, dans l’ordre de la table, sous-tables comprises', () => {
    const textes = parLangue<{ titre: string; etats: { ouvert: string; clos: string } }>({
      titre: { fr: 'Titre', pt: 'Título' },
      etats: parLangue({ ouvert: { fr: 'Ouvert', pt: 'Aberto' }, clos: { fr: 'Clos', pt: 'Fechado' } }),
    })
    expect(textes).toEqual({
      fr: { titre: 'Titre', etats: { ouvert: 'Ouvert', clos: 'Clos' } },
      pt: { titre: 'Título', etats: { ouvert: 'Aberto', clos: 'Fechado' } },
    })
    expect(Object.keys(textes.pt)).toEqual(['titre', 'etats'])
  })
})

/** Chaque texte d'un dictionnaire, sous-objets compris, avec son chemin (« erreurs.reseau »). */
const feuilles = (objet: object, prefixe = ''): Array<[string, unknown]> => Object.entries(objet).flatMap(([cle, valeur]) => (
  typeof valeur === 'object' && valeur !== null ? feuilles(valeur, `${prefixe}${cle}.`) : [[`${prefixe}${cle}`, valeur] as [string, unknown]]
))

describe('dictionnaires FR / PT', () => {
  it.each([
    ['page publique', TEXTES_SIGNALEMENT_QR],
    ['confirmation', TEXTES_CONFIRMATION_QR],
  ])('%s : mêmes clés dans les deux langues, aucun texte vide', (_nom, textes) => {
    const fr = feuilles(textes.fr)
    const pt = feuilles(textes.pt)
    expect(pt.map(([chemin]) => chemin)).toEqual(fr.map(([chemin]) => chemin))
    for (const [chemin, texte] of [...fr, ...pt]) {
      expect(typeof texte === 'string' && texte.trim() !== '', chemin).toBe(true)
    }
  })
})
