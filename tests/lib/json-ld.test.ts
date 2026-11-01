// tests/lib/json-ld.test.ts
//
// serialiserJsonLd : le JSON-LD de la fiche publique artisan reprend des valeurs saisies par l'artisan
// (nom d'entreprise, ville, catégories…). La sortie ne doit jamais pouvoir fermer la balise <script>,
// et tout parseur JSON doit relire exactement l'objet de départ.

import { describe, it, expect } from 'vitest'
import { serialiserJsonLd } from '@/lib/seo/json-ld'

describe('serialiserJsonLd', () => {
  it('neutralise une charge « </script><script> » dans une valeur', () => {
    const donnees = {
      '@type': 'HomeAndConstructionBusiness',
      name: 'Plomberie </script><script>alert(document.cookie)</script>',
    }
    const sortie = serialiserJsonLd(donnees)
    expect(sortie).not.toMatch(/[<>]/)
    expect(sortie.toLowerCase()).not.toContain('</script')
    expect(JSON.parse(sortie)).toEqual(donnees)
  })

  it('échappe &, U+2028 et U+2029 et relit les valeurs à l’identique', () => {
    const donnees = { name: 'Dupont & Fils', description: 'ligne\u2028suite\u2029fin', categories: ['<b>', 'a>b'] }
    const sortie = serialiserJsonLd(donnees)
    expect(sortie).not.toMatch(/[&\u2028\u2029<>]/)
    expect(sortie).toContain('\\u0026')
    expect(sortie).toContain('\\u2028')
    expect(sortie).toContain('\\u2029')
    expect(JSON.parse(sortie)).toEqual(donnees)
  })

  it('donne la même sortie que JSON.stringify sans caractère sensible', () => {
    const donnees = { '@context': 'https://schema.org', name: 'Électricité Martin', ratingValue: 4.8 }
    expect(serialiserJsonLd(donnees)).toBe(JSON.stringify(donnees))
  })
})
