// Pages de service du concelho d'Águeda : le propriétaire les ouvre sans chantier documenté (décision du 22/10/2026) et
// ajoutera ses chantiers plus tard dans data/seo/local-proof.json (clé = slug de la page). Ce test vérifie le mécanisme
// avec un jeu de données FICTIF (ces chantiers n'existent pas et ne sont jamais publiés) : le chantier s'affiche avec sa
// photo et ses détails sur la seule page concernée, et la date de la page dans le sitemap suit sa mise en production.

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

vi.mock('@/data/seo/local-proof.json', () => ({
  default: {
    chantiers: [
      {
        cidade: 'agueda', metier: 'limpeza-de-terrenos-agueda', tipo: 'Limpeza de faixa de gestão de combustível', quantidade: '2 000 m²',
        mes: '2026-11', freguesia: 'Macinhata do Vouga', publicado: '2026-11-30',
        problema: 'Mato e silvas encostados à casa', solucao: 'Trator com destroçador e roçadoras junto aos muros',
        foto: '/images/chantiers/teste-agueda.jpg', foto_alt: 'Terreno em Macinhata do Vouga depois da limpeza',
      },
      // Même slug, autre concelho : jamais affiché sur la page d'Águeda.
      { cidade: 'aveiro', metier: 'limpeza-de-terrenos-agueda', tipo: 'Limpeza de terreno', mes: '2026-11', publicado: '2026-10-28' },
      // Chantier sans date de mise en production : affiché, mais ne change pas la date de la page.
      { cidade: 'agueda', metier: 'terraplanagem-agueda', tipo: 'Desaterro para plataforma de moradia', mes: '2026-10', freguesia: 'Barrô' },
    ],
    precos: [],
    prazos: [],
    avis: [],
    metodos: {},
  },
}))

import LimpezaPage from '@/app/pt/servicos/limpeza-de-terrenos-agueda/page'
import TerraplanagemPage from '@/app/pt/servicos/terraplanagem-agueda/page'
import { LIMPEZA_DE_TERRENOS_AGUEDA, TERRAPLANAGEM_AGUEDA, dataModificacaoConcelho } from '@/lib/data/pt-servicos-concelho'
import { sitemapsPt } from '@/lib/sitemap-pt-pages'

const BASE = 'https://vitfix.io'

describe('chantiers réels sur les pages de service d’Águeda (données fictives)', () => {
  it('le chantier s’affiche avec sa photo, son texte alternatif et ce qui a été trouvé et fait', () => {
    const { container } = render(LimpezaPage())
    const bloco = container.querySelector('#chantiers')
    expect(bloco).not.toBeNull()
    expect(bloco?.textContent).toContain('Limpeza de faixa de gestão de combustível, 2 000 m², Macinhata do Vouga')
    expect(bloco?.textContent).toContain('Mato e silvas encostados à casa')
    expect(bloco?.querySelector('img')?.getAttribute('alt')).toBe('Terreno em Macinhata do Vouga depois da limpeza')
    // Le chantier d'un autre concelho au même slug n'apparaît pas.
    expect(bloco?.querySelectorAll('article')).toHaveLength(1)
  })

  it('la date de la page suit la mise en production du chantier ; sans date, elle ne change pas', () => {
    expect(dataModificacaoConcelho(LIMPEZA_DE_TERRENOS_AGUEDA)).toBe('2026-11-30')
    expect(dataModificacaoConcelho(TERRAPLANAGEM_AGUEDA)).toBe(TERRAPLANAGEM_AGUEDA.dataModificacao)
    const { servicos } = sitemapsPt(BASE)
    expect(servicos.find((u) => u.url === `${BASE}/pt/servicos/limpeza-de-terrenos-agueda/`)?.lastModified).toBe('2026-11-30')
    expect(servicos.find((u) => u.url === `${BASE}/pt/servicos/terraplanagem-agueda/`)?.lastModified).toBe(TERRAPLANAGEM_AGUEDA.dataModificacao)
  })

  it('un chantier sans photo s’affiche en texte seul, sur sa page uniquement', () => {
    const { container } = render(TerraplanagemPage())
    const bloco = container.querySelector('#chantiers')
    expect(bloco?.textContent).toContain('Desaterro para plataforma de moradia, Barrô')
    expect(bloco?.querySelector('img')).toBeNull()
  })
})
