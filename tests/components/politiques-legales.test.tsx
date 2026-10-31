// tests/components/politiques-legales.test.tsx
//
// Politiques communes aux pages FR (app/(commun)) et PT : components/legal/PolitiqueConfidentialite.tsx (les deux pages
// listent les mêmes sous-traitants, dont Groq, Tavily et OpenRouter) et components/legal/PolitiqueCookies.tsx (en-têtes de
// colonnes du tableau en <th>).
// getServerTranslation simulé : t() renvoie la clé.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/i18n/server', () => ({
  getServerTranslation: async () => ({ t: (cle: string) => cle, locale: 'fr' }),
}))

import PolitiqueConfidentialite from '@/components/legal/PolitiqueConfidentialite'
import PolitiqueCookies from '@/components/legal/PolitiqueCookies'
import ConfidentialitePage from '@/app/(commun)/confidentialite/page'
import PrivacidadePage from '@/app/pt/privacidade/page'

const SOUS_TRAITANTS_IA = ['privacy.protection.subProcessorGroq', 'privacy.protection.subProcessorTavily', 'privacy.protection.subProcessorOpenrouter']

describe('PolitiqueConfidentialite', () => {
  it('sous-traitants d’IA : Groq, Tavily et OpenRouter listés après Docuseal', async () => {
    const html = renderToStaticMarkup(await PolitiqueConfidentialite())
    const docuseal = html.indexOf('<li>privacy.protection.subProcessorDocuseal</li>')
    expect(docuseal).toBeGreaterThan(-1)
    for (const cle of SOUS_TRAITANTS_IA) expect(html.indexOf(`<li>${cle}</li>`), cle).toBeGreaterThan(docuseal)
  })

  it('pages : /fr/confidentialite/ et /pt/privacidade/ rendent la même politique, sans option', () => {
    for (const page of [ConfidentialitePage(), PrivacidadePage()]) {
      expect(page.type).toBe(PolitiqueConfidentialite)
      expect(page.props).toEqual({})
    }
  })
})

describe('PolitiqueCookies', () => {
  it('en-têtes du tableau en <th scope="col">, alignés à gauche, en demi-gras et à la hauteur de ligne des anciennes <td>', async () => {
    const html = renderToStaticMarkup(await PolitiqueCookies())
    const entete = html.match(/<thead>([\s\S]*?)<\/thead>/)
    expect(entete).not.toBeNull()
    expect(entete![1]).not.toContain('<td')
    const classes = [...entete![1].matchAll(/<th scope="col" class="([^"]*)"/g)].map((m) => m[1].split(' '))
    expect(classes).toHaveLength(3)
    for (const c of classes) expect(c).toEqual(expect.arrayContaining(['text-left', 'font-semibold', 'leading-[1.6]']))
  })
})
