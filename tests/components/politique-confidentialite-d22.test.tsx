// tests/components/politique-confidentialite-d22.test.tsx
//
// D22 (décision de Hugo du 17/11/2026, au nom de VitFix, point 6 — page seulement) sur la politique de confidentialité
// de VitFix (/fr/confidentialite/ et /pt/privacidade/, components/legal/PolitiqueConfidentialite.tsx) :
//   - ligne Supabase : base hébergée à Francfort, dans l'Union européenne (région eu-central-1 du projet, lue le
//     17/11/2026 dans l'interface de gestion de Supabase ; le code ne fixe pas la région), avec l'accès possible de son
//     support depuis les États-Unis et Singapour (contrat de Supabase, relevé le 13/11/2026) ;
//   - « Délégué à la Protection des Données » et « DPO » remplacés par « contact pour les données » : aucun délégué n'est
//     désigné (docs/conformite/dpia-rgpd.md : « pas désigné formellement »).
// Mise en page inchangée : mêmes clés, aux mêmes places. Portugais : même correction, à relire (H4).
// getServerTranslation simulé : t() lit les vrais fichiers de langue.

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import fr from '@/locales/fr.json'
import pt from '@/locales/pt.json'

const langue = vi.hoisted(() => ({ courante: 'fr' as 'fr' | 'pt' }))

vi.mock('@/lib/i18n/server', async () => {
  const dictionnaires = { fr: (await import('@/locales/fr.json')).default, pt: (await import('@/locales/pt.json')).default }
  const lire = (cle: string): string => {
    let valeur: unknown = dictionnaires[langue.courante]
    for (const k of cle.split('.')) valeur = (valeur as Record<string, unknown>)?.[k]
    return typeof valeur === 'string' ? valeur : cle
  }
  return { getServerTranslation: async () => ({ t: lire, locale: langue.courante }) }
})

const { default: PolitiqueConfidentialite } = await import('@/components/legal/PolitiqueConfidentialite')

const rendre = async (l: 'fr' | 'pt') => {
  langue.courante = l
  return renderToStaticMarkup(await PolitiqueConfidentialite())
}

describe('ligne Supabase', () => {
  it('FR : Francfort, Union européenne ; plus « États-Unis » comme lieu de la base', async () => {
    const ligne = fr.privacy.protection.subProcessorSupabase
    expect(ligne).toMatch(/^Supabase \(base de données et authentification, Francfort, Union européenne ; /)
    expect(ligne).toContain('son support peut y accéder depuis les États-Unis et Singapour')
    expect(ligne).not.toBe('Supabase (base de données et authentification, États-Unis)')
    expect(await rendre('fr')).toContain(`<li>${ligne}</li>`)
  })

  it('PT (à relire, H4) : Frankfurt, União Europeia', async () => {
    const ligne = pt.privacy.protection.subProcessorSupabase
    expect(ligne).toMatch(/^Supabase \(base de dados e autenticação, Frankfurt, União Europeia; /)
    expect(ligne).toContain('Estados Unidos e de Singapura')
    expect(ligne).not.toBe('Supabase (base de dados e autenticação, Estados Unidos)')
    expect(await rendre('pt')).toContain(`<li>${ligne}</li>`)
  })
})

describe('contact pour les données, pas de délégué', () => {
  it('FR : ni « Délégué à la Protection des Données » ni « DPO » sur la page ; « contact pour les données » deux fois', async () => {
    const html = await rendre('fr')
    expect(html).not.toMatch(/d[ée]l[ée]gu[ée] à la protection/i)
    expect(html).not.toMatch(/\bDPO\b/)
    expect(fr.privacy.rights.contactInfo).toBe('Pour exercer vos droits, écrivez à notre contact pour les données personnelles :')
    expect(fr.privacy.contact.p1).toBe(
      'Pour toute question relative à la protection de vos données personnelles, vous pouvez écrire à notre contact pour les données personnelles :',
    )
  })

  it('PT (à relire, H4) : ni « Encarregado de Proteção de Dados » ni « DPO » sur la page', async () => {
    const html = await rendre('pt')
    expect(html).not.toMatch(/encarregado de prote[çc][ãa]o de dados/i)
    expect(html).not.toMatch(/\bDPO\b/)
    expect(pt.privacy.rights.contactInfo).toBe('Para exercer os seus direitos, escreva ao nosso contacto para os dados pessoais:')
    expect(pt.privacy.contact.p1).toBe(
      'Para qualquer questão relativa à proteção dos seus dados pessoais, pode escrever ao nosso contacto para os dados pessoais:',
    )
  })

  it('mise en page inchangée : l’adresse de contact suit toujours les deux phrases, en gras', async () => {
    for (const l of ['fr', 'pt'] as const) {
      const html = await rendre(l)
      const textes = l === 'fr' ? fr : pt
      expect(html, l).toContain(`${textes.privacy.rights.contactInfo} <strong>dpo@vitfix.io</strong>`)
      expect(html, l).toContain(`${textes.privacy.contact.p1}<strong> dpo@vitfix.io</strong>`)
    }
  })
})
