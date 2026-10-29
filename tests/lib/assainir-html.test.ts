import { describe, it, expect } from 'vitest'
import { assainirHtml } from '@/lib/security/assainir-html'
import { safeMarkdownToHTML } from '@/lib/sanitize'

describe('assainirHtml (DOMPurify côté navigateur)', () => {
  it('retourne une chaîne vide pour une entrée vide', () => {
    expect(assainirHtml('')).toBe('')
  })

  it('retire les balises script et leur contenu', () => {
    expect(assainirHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>')
  })

  it('retire les gestionnaires d’événements', () => {
    const resultat = assainirHtml('<img src="x" onerror="alert(1)"><p onclick="alert(2)">t</p>')
    expect(resultat).not.toContain('onerror')
    expect(resultat).not.toContain('onclick')
    expect(resultat).toContain('<p>t</p>')
  })

  it('retire les URL javascript: des liens', () => {
    const resultat = assainirHtml('<a href="javascript:alert(1)">x</a><a href="JaVaScRiPt:alert(2)">y</a>')
    expect(resultat).not.toContain('javascript')
    expect(resultat).not.toContain('JaVaScRiPt')
    expect(resultat).toContain('>x</a>')
  })

  it('retire les balises et attributs style (pas de superposition ni de redressement d’interface)', () => {
    const resultat = assainirHtml('<style>body{display:none}</style><p style="position:fixed" class="x">t</p>')
    expect(resultat).not.toContain('<style')
    expect(resultat).not.toContain('style=')
    expect(resultat).toContain('class="x"')
  })

  it('retire iframe, object, embed et formulaires', () => {
    const resultat = assainirHtml('<iframe src="https://evil.example"></iframe><object data="x"></object><embed src="x"><form action="https://evil.example"><input name="mdp"></form><p>fin</p>')
    expect(resultat).not.toContain('<iframe')
    expect(resultat).not.toContain('<object')
    expect(resultat).not.toContain('<embed')
    expect(resultat).not.toContain('<form')
    expect(resultat).not.toContain('<input')
    expect(resultat).toContain('<p>fin</p>')
  })

  it('conserve les balises et les classes du HTML produit par safeMarkdownToHTML', () => {
    // DOMPurify repasse par l'analyseur HTML du navigateur (un <h3> ferme le <p> qui le contient, <br /> devient
    // <br>) : on vérifie le contenu utile, pas l'égalité octet pour octet.
    const resultat = assainirHtml(safeMarkdownToHTML('## Titre\n\n**gras** et `code`\n\n- un\n- deux'))
    expect(resultat).toContain('<h3 class="font-bold text-gray-900 mt-4 mb-1">Titre</h3>')
    expect(resultat).toContain('<strong class="font-semibold">gras</strong>')
    expect(resultat).toContain('<code class="bg-gray-100 border border-gray-200 px-1 py-0.5 rounded text-xs font-mono text-purple-700">code</code>')
    expect(resultat).toContain('<ul class="my-2 space-y-0.5"><li class="ml-4 list-disc text-sm py-0.5">un</li>')
    expect(resultat).toContain('<li class="ml-4 list-disc text-sm py-0.5">deux</li></ul>')
  })

  it('ne modifie pas un paragraphe simple produit par safeMarkdownToHTML', () => {
    const html = safeMarkdownToHTML('Bonjour, voici **le total** : 120 €')
    expect(assainirHtml(html)).toBe(html)
  })

  it('neutralise une réponse IA hostile de bout en bout', () => {
    const resultat = assainirHtml(safeMarkdownToHTML('<img src=x onerror=alert(1)> **gras** <script>alert(2)</script>'))
    expect(resultat).toContain('&lt;img')
    expect(resultat).toContain('<strong class="font-semibold">gras</strong>')
    expect(resultat).not.toContain('<script')
    expect(resultat).not.toMatch(/<img/)
  })
})
