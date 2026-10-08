import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ModEnquetes from '@/components/syndic-dashboard/v54/modules/ModEnquetes'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { V54LocaleProvider, type V54Locale } from '@/lib/syndic/v54/i18n'
import type { Enquete } from '@/lib/syndic/v54/api'

/**
 * Correctif ModEnquetes (Enquetes & Sondagens / Sondages & consultations) : la pastille de la
 * date limite d'un sondage réel restait dorée une fois la date passée. La règle comparait le
 * libellé de démonstration « Prazo expirado », que la colonne DATE ne renvoie jamais.
 * Désormais : date limite « AAAA-MM-JJ » strictement antérieure au jour civil local → rouille,
 * dans les onglets actifs comme dans l'historique ; la démonstration garde son drapeau.
 */

const TZ_INITIAL = process.env.TZ

beforeEach(() => {
  process.env.TZ = 'Europe/Lisbon'
  vi.useFakeTimers({ toFake: ['Date'] })
  // 11 h à Lisbonne le 07/10/2026.
  vi.setSystemTime(new Date('2026-10-07T10:00:00Z'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  if (TZ_INITIAL === undefined) delete process.env.TZ
  else process.env.TZ = TZ_INITIAL
})

const enquete = (over: Partial<Enquete>): Enquete => ({
  id: 'e1', titulo: 'Sondage', descricao: '', estado: 'ativa', tipo: '', edificio: '', prazo: '',
  total: 10, options: [], anonima: false,
  ...over,
})

const donnees = (enquetes: Enquete[]): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], enquetes,
})

const ENQUETES = [
  enquete({ id: 'hier', titulo: 'Limite hier', prazo: '2026-10-06' }),
  enquete({ id: 'jour', titulo: 'Limite aujourd’hui', prazo: '2026-10-07', estado: 'a_decorrer' }),
  enquete({ id: 'futur', titulo: 'Limite future', prazo: '2031-03-17' }),
  enquete({ id: 'sans', titulo: 'Sans limite', prazo: '' }),
  enquete({ id: 'clos', titulo: 'Clos dépassé', prazo: '2026-09-30', estado: 'encerrada' }),
  enquete({ id: 'clos-futur', titulo: 'Clos à venir', prazo: '2026-12-01', estado: 'encerrada' }),
]

function rendre(locale: V54Locale, data?: SyndicData) {
  const ecran = <V54LocaleProvider locale={locale}><ModEnquetes /></V54LocaleProvider>
  return render(data ? <SyndicDataContext.Provider value={data}>{ecran}</SyndicDataContext.Provider> : ecran)
}

/** Carte du sondage (titre → bloc de la carte), pour y chercher les pastilles. */
const carte = (titre: string): HTMLElement => screen.getByText(titre).closest('div[style*="border-radius"]') as HTMLElement

describe.each<[V54Locale, string]>([
  ['pt-PT', 'Histórico'],
  ['fr-FR', 'Historique'],
])('ModEnquetes (%s) — pastille de la date limite, données réelles', (locale, ongletHistorique) => {
  it('date passée : rouille ; jour même et date future : dorée', () => {
    rendre(locale, donnees(ENQUETES))
    expect(screen.getByText('06/10/2026').className).toMatch(/rust/)
    expect(screen.getByText('07/10/2026').className).toMatch(/gold/)
    expect(screen.getByText('07/10/2026').className).not.toMatch(/rust/)
    expect(screen.getByText('17/03/2031').className).toMatch(/gold/)
  })

  it('date limite vide : aucune pastille de date', () => {
    rendre(locale, donnees(ENQUETES))
    expect(carte('Sans limite').textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('historique : même règle pour un sondage clôturé', () => {
    rendre(locale, donnees(ENQUETES))
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(ongletHistorique) }))
    expect(screen.getByText('30/09/2026').className).toMatch(/rust/)
    expect(screen.getByText('01/12/2026').className).toMatch(/gold/)
  })

  it('jour civil local : à 0 h 30 le 08/10 à Lisbonne, le 07/10 est dépassé', () => {
    vi.setSystemTime(new Date('2026-10-07T23:30:00Z'))
    rendre(locale, donnees(ENQUETES))
    expect(screen.getByText('07/10/2026').className).toMatch(/rust/)
  })
})

describe('ModEnquetes — démonstration inchangée (drapeau prazoExpire)', () => {
  it('PT : « 8 dias restantes » dorée, « Prazo expirado » rouille', () => {
    rendre('pt-PT')
    expect(screen.getByText('8 dias restantes').className).toMatch(/gold/)
    const expires = screen.getAllByText('Prazo expirado')
    expect(expires).toHaveLength(2)
    for (const p of expires) expect(p.className).toMatch(/rust/)
  })

  it('FR : « 8 jours restants » dorée, « Délai dépassé » rouille', () => {
    rendre('fr-FR')
    expect(screen.getByText('8 jours restants').className).toMatch(/gold/)
    const expires = screen.getAllByText('Délai dépassé')
    expect(expires).toHaveLength(2)
    for (const p of expires) expect(p.className).toMatch(/rust/)
  })
})
