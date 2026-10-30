// tests/components/politiques-legales.test.tsx
//
// Politiques communes aux pages FR (app/(commun)) et PT : components/legal/PolitiqueConfidentialite.tsx (la page FR passe
// avecSousTraitantsIa et liste Groq, Tavily et OpenRouter ; la page PT ne le fait pas encore, voir le test des pages) et
// components/legal/PolitiqueCookies.tsx (en-têtes de colonnes du tableau en <th>).
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
  it('page FR (avecSousTraitantsIa) : Groq, Tavily et OpenRouter après Docuseal', async () => {
    const html = renderToStaticMarkup(await PolitiqueConfidentialite({ avecSousTraitantsIa: true }))
    const docuseal = html.indexOf('privacy.protection.subProcessorDocuseal')
    expect(docuseal).toBeGreaterThan(-1)
    for (const cle of SOUS_TRAITANTS_IA) expect(html.indexOf(`<li>${cle}</li>`), cle).toBeGreaterThan(docuseal)
  })

  it('sans avecSousTraitantsIa (valeur par défaut) : liste sans les sous-traitants d’IA', async () => {
    const html = renderToStaticMarkup(await PolitiqueConfidentialite({}))
    expect(html).toContain('privacy.protection.subProcessorDocuseal')
    for (const cle of SOUS_TRAITANTS_IA) expect(html, cle).not.toContain(cle)
  })

  it('pages : /fr/confidentialite/ passe avecSousTraitantsIa, /pt/privacidade/ rend la même politique', () => {
    const fr = ConfidentialitePage()
    const pt = PrivacidadePage()
    expect(fr.type).toBe(PolitiqueConfidentialite)
    expect(fr.props).toEqual({ avecSousTraitantsIa: true })
    // /pt/privacidade/ ne passe pas le prop, comme sur main : les trois sous-traitants y manquent alors que leurs textes sont
    // traduits dans locales/pt.json (probable oubli, à trancher par Frédéric). Ce test ne fige pas ce choix.
    expect(pt.type).toBe(PolitiqueConfidentialite)
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
