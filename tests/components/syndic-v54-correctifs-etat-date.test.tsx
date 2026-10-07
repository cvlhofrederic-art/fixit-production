import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react'
import ModDeclEncargos from '@/components/syndic-dashboard/v54/modules/ModDeclEncargos'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { V54LocaleProvider, type V54Locale } from '@/lib/syndic/v54/i18n'
import type { DeclEncargo } from '@/lib/syndic/v54/api'

/**
 * Correctifs ModDeclEncargos (état daté / declaração de encargos) :
 * - la pastille de statut suit `estado` (pendente | emitida | concluida) au lieu d'afficher
 *   toujours « Pendente » / « À établir » ;
 * - les dates ISO renvoyées par l'API (dataPedido, prazoLimite) s'affichent en JJ/MM/AAAA ;
 * - les onglets filtrent le tableau par statut (KPI toujours calculés sur toute la liste) ;
 * - la date limite est calculée par le serveur selon le pays (textes : syndic-v54-decl-encargos-textes) ;
 * - « Fora do prazo » / « Hors délai » : le jour de l'échéance reste dans le délai.
 */

const TZ_INITIAL = process.env.TZ
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  if (TZ_INITIAL === undefined) delete process.env.TZ
  else process.env.TZ = TZ_INITIAL
})

const decl = (over: Partial<DeclEncargo>): DeclEncargo => ({
  id: 'd1', fracao: 'F1', condomino: 'Condómino', edificio: '',
  dataPedido: '2026-05-01', prazoLimite: '2026-05-11', encargosCorrentes: 0, divida: 0,
  estado: 'pendente', notas: '',
  ...over,
})

const donnees = (declaracoes: DeclEncargo[], extra: Partial<SyndicData> = {}): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], declaracoes,
  ...extra,
})

const DECLS = [
  decl({ id: 'p', fracao: 'F-PEN', estado: 'pendente' }),
  decl({ id: 'e', fracao: 'F-EMI', estado: 'emitida' }),
  decl({ id: 'c', fracao: 'F-CON', estado: 'concluida' }),
]

function rendre(locale: V54Locale, declaracoes: DeclEncargo[] = DECLS, extra: Partial<SyndicData> = {}) {
  return render(
    <V54LocaleProvider locale={locale}>
      <ToastProvider>
        <SyndicDataContext.Provider value={donnees(declaracoes, extra)}><ModDeclEncargos /></SyndicDataContext.Provider>
      </ToastProvider>
    </V54LocaleProvider>,
  )
}

/** Lots affichés dans le tableau, dans l'ordre (vide si aucun tableau). */
const lotsAffiches = (): string[] =>
  screen.queryAllByRole('row').slice(1).map(r => within(r).getAllByRole('cell')[0].textContent ?? '')

/** Nombre affiché par la carte KPI de libellé donné. */
const kpi = (libelle: string): string => {
  const etiquette = screen.getAllByText(libelle).find(e => /lbl/.test(e.className))
  if (!etiquette) throw new Error(`KPI introuvable : ${libelle}`)
  return etiquette.previousElementSibling?.textContent ?? ''
}

/** Textes de toutes les cartes KPI (nombre + libellé). */
const toutesKpi = (): string[] =>
  ['Total de declarações', 'Pendentes', 'Fora do prazo', 'Concluídas'].map(l => `${l}=${kpi(l)}`)

/** Pastille de statut (dernière cellule) de la ligne du lot donné. */
const pastille = (lot: string): HTMLElement => {
  const ligne = screen.getByText(lot).closest('tr') as HTMLElement
  const cellules = within(ligne).getAllByRole('cell')
  return cellules[cellules.length - 1].firstElementChild as HTMLElement
}

describe('ModDeclEncargos — statut de chaque déclaration', () => {
  it('PT : libellé et couleur selon estado', () => {
    rendre('pt-PT')
    expect(pastille('F-PEN').textContent).toBe('Pendente')
    expect(pastille('F-PEN').className).toMatch(/amber/)
    expect(pastille('F-EMI').textContent).toBe('Emitida')
    expect(pastille('F-EMI').className).toMatch(/gold/)
    expect(pastille('F-CON').textContent).toBe('Concluída')
    expect(pastille('F-CON').className).toMatch(/sage/)
  })

  it('FR : libellé et couleur selon estado', () => {
    rendre('fr-FR')
    expect(pastille('F-PEN').textContent).toBe('À établir')
    expect(pastille('F-PEN').className).toMatch(/amber/)
    expect(pastille('F-EMI').textContent).toBe('Délivré')
    expect(pastille('F-EMI').className).toMatch(/gold/)
    expect(pastille('F-CON').textContent).toBe('Clôturé')
    expect(pastille('F-CON').className).toMatch(/sage/)
  })

  it('statut inconnu : valeur brute, pastille ambre', () => {
    rendre('fr-FR', [decl({ fracao: 'F-X', estado: 'arquivada' })])
    expect(pastille('F-X').textContent).toBe('arquivada')
    expect(pastille('F-X').className).toMatch(/amber/)
  })
})

describe('ModDeclEncargos — dates en JJ/MM/AAAA', () => {
  it.each<V54Locale>(['pt-PT', 'fr-FR'])('%s : date de demande et date limite formatées', (locale) => {
    rendre(locale, [decl({ fracao: 'F-D', dataPedido: '2026-05-01', prazoLimite: '2026-05-11' })])
    const ligne = screen.getByText('F-D').closest('tr') as HTMLElement
    expect(within(ligne).getByText('01/05/2026')).toBeInTheDocument()
    expect(within(ligne).getByText('11/05/2026')).toBeInTheDocument()
    expect(within(ligne).queryByText('2026-05-01')).toBeNull()
  })

  it('date absente ou non ISO : affichée telle quelle', () => {
    rendre('pt-PT', [decl({ fracao: 'F-V', dataPedido: '', prazoLimite: 'a definir' })])
    const cellules = within(screen.getByText('F-V').closest('tr') as HTMLElement).getAllByRole('cell')
    expect(cellules[3].textContent).toBe('')
    expect(cellules[4].textContent).toBe('a definir')
  })
})

describe('ModDeclEncargos — les onglets filtrent le tableau', () => {
  const ONGLETS: Record<V54Locale, { todas: string; pen: string; em: string; conc: string }> = {
    'pt-PT': { todas: 'Todas (3)', pen: 'Pendentes (1)', em: 'Emitidas', conc: 'Concluídas (1)' },
    'fr-FR': { todas: 'Tous (3)', pen: 'À établir (1)', em: 'Délivrés', conc: 'Clôturés (1)' },
  }

  it.each<V54Locale>(['pt-PT', 'fr-FR'])('%s : chaque onglet ne montre que les déclarations de son statut', (locale) => {
    const o = ONGLETS[locale]
    rendre(locale)
    expect(lotsAffiches()).toEqual(['F-PEN', 'F-EMI', 'F-CON'])
    fireEvent.click(screen.getByRole('tab', { name: o.pen }))
    expect(lotsAffiches()).toEqual(['F-PEN'])
    fireEvent.click(screen.getByRole('tab', { name: o.em }))
    expect(lotsAffiches()).toEqual(['F-EMI'])
    fireEvent.click(screen.getByRole('tab', { name: o.conc }))
    expect(lotsAffiches()).toEqual(['F-CON'])
    fireEvent.click(screen.getByRole('tab', { name: o.todas }))
    expect(lotsAffiches()).toEqual(['F-PEN', 'F-EMI', 'F-CON'])
  })

  it('clavier : les flèches et Fin changent l’onglet actif et le filtre', () => {
    rendre('pt-PT')
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Pendentes (1)' })).toHaveAttribute('aria-selected', 'true')
    expect(lotsAffiches()).toEqual(['F-PEN'])
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Concluídas (1)' })).toHaveAttribute('aria-selected', 'true')
    expect(lotsAffiches()).toEqual(['F-CON'])
  })

  it('statut inconnu : affiché seulement dans « Todas »', () => {
    rendre('pt-PT', [...DECLS, decl({ id: 'x', fracao: 'F-X', estado: 'arquivada' })])
    expect(lotsAffiches()).toContain('F-X')
    for (const nom of ['Pendentes (1)', 'Emitidas', 'Concluídas (1)']) {
      fireEvent.click(screen.getByRole('tab', { name: nom }))
      expect(lotsAffiches()).not.toContain('F-X')
    }
  })

  it('les KPI restent calculés sur toute la liste, quel que soit l’onglet', () => {
    rendre('pt-PT')
    const avant = toutesKpi()
    expect(avant[0]).toBe('Total de declarações=3')
    for (const nom of ['Pendentes (1)', 'Emitidas', 'Concluídas (1)', 'Todas (3)']) {
      fireEvent.click(screen.getByRole('tab', { name: nom }))
      expect(toutesKpi()).toEqual(avant)
    }
  })

  it.each([
    ['pt-PT', 'Emitidas', 'Sem declarações nesta vista.', 'Nenhuma declaração registada'],
    ['fr-FR', 'Délivrés', 'Aucun état daté dans cette vue.', 'Aucun état daté enregistré'],
  ] as const)('%s : onglet sans déclaration → message de vue vide, pas l’état vide', (locale, onglet, vueVide, videTitre) => {
    rendre(locale, [decl({ id: 'p', fracao: 'F-PEN', estado: 'pendente' })])
    fireEvent.click(screen.getByRole('tab', { name: onglet }))
    expect(screen.getByText(vueVide)).toBeInTheDocument()
    expect(screen.queryByText(videTitre)).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

/** Ouvre le formulaire et remplit le lot et le copropriétaire. */
function remplir(locale: V54Locale, lot: string, nom: string) {
  fireEvent.click(screen.getAllByRole('button', { name: locale === 'pt-PT' ? /Nova declaração/ : /Nouvel état daté/ })[0])
  fireEvent.change(document.getElementById('de-frac') as HTMLInputElement, { target: { value: lot } })
  fireEvent.change(document.getElementById('de-cond') as HTMLInputElement, { target: { value: nom } })
}

const enregistrer = (locale: V54Locale) =>
  fireEvent.click(screen.getByRole('button', { name: locale === 'pt-PT' ? 'Registar' : 'Enregistrer' }))

const espionFetch = () =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ declaracao: {} }), { status: 200 }))

/** Corps JSON du POST /api/syndic/decl-encargos. */
const corpsPost = (espion: ReturnType<typeof espionFetch>): Record<string, unknown> => {
  const appel = espion.mock.calls.find(c => c[0] === '/api/syndic/decl-encargos')
  if (!appel) throw new Error('POST /api/syndic/decl-encargos non envoyé')
  return JSON.parse((appel[1] as RequestInit).body as string)
}

describe('ModDeclEncargos — date limite calculée par le serveur selon le pays', () => {
  it.each([
    ['pt-PT', 'Apt 5.º D', 'pt'],
    ['fr-FR', '12 — Apt B3', 'fr'],
  ] as const)('%s : la date limite n’est plus envoyée, le pays l’est', async (locale, lot, pays) => {
    const espion = espionFetch()
    const refresh = vi.fn()
    rendre(locale, [], { token: 'jeton-de', refresh })
    remplir(locale, lot, 'Maria Costa')
    enregistrer(locale)
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const corps = corpsPost(espion)
    expect(corps).not.toHaveProperty('prazoLimite')
    expect(corps).toMatchObject({ fracao: lot, condomino: 'Maria Costa', locale: pays })
  })

  it('date de la demande par défaut : jour civil local, pas le jour UTC', async () => {
    process.env.TZ = 'Europe/Lisbon'
    vi.useFakeTimers({ toFake: ['Date'] })
    // 23 h 30 UTC = 0 h 30 le 11 mai à Lisbonne (heure d'été).
    vi.setSystemTime(new Date('2026-05-10T23:30:00Z'))
    const espion = espionFetch()
    const refresh = vi.fn()
    rendre('pt-PT', [], { token: 'jeton-de', refresh })
    remplir('pt-PT', 'Apt 5.º D', 'Maria Costa')
    expect((document.getElementById('de-data') as HTMLInputElement).value).toBe('2026-05-11')
    enregistrer('pt-PT')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(corpsPost(espion).dataPedido).toBe('2026-05-11')
  })

  it.each<V54Locale>(['pt-PT', 'fr-FR'])('%s : date de la demande vidée → l’enregistrement part quand même', async (locale) => {
    const espion = espionFetch()
    const refresh = vi.fn()
    rendre(locale, [], { token: 'jeton-de', refresh })
    remplir(locale, 'Lot 7', 'Maria Costa')
    fireEvent.change(document.getElementById('de-data') as HTMLInputElement, { target: { value: '' } })
    enregistrer(locale)
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(corpsPost(espion).dataPedido).toBe('')
  })

  it('démonstration : date vidée → la modale se ferme et le toast de démonstration s’affiche', async () => {
    render(
      <V54LocaleProvider locale="pt-PT">
        <ToastProvider><ModDeclEncargos /></ToastProvider>
      </V54LocaleProvider>,
    )
    remplir('pt-PT', 'Apt 5.º D', 'Maria Costa')
    fireEvent.change(document.getElementById('de-data') as HTMLInputElement, { target: { value: '' } })
    enregistrer('pt-PT')
    expect(await screen.findByText('Declaração registada (demo)')).toBeInTheDocument()
    expect(document.getElementById('de-frac')).toBeNull()
  })
})

describe('ModDeclEncargos — « Fora do prazo » / « Hors délai »', () => {
  const ECHEANCES = [
    decl({ id: 'j', fracao: 'F-JOUR', estado: 'pendente', prazoLimite: '2026-05-11' }),
    decl({ id: 'v', fracao: 'F-VEILLE', estado: 'pendente', prazoLimite: '2026-05-10' }),
    decl({ id: 'e', fracao: 'F-EMISE', estado: 'emitida', prazoLimite: '2026-05-01' }),
  ]

  it.each([['pt-PT', 'Fora do prazo'], ['fr-FR', 'Hors délai']] as const)('%s : l’échéance du jour reste dans le délai', (locale, libelle) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 4, 11, 10, 0))
    rendre(locale, ECHEANCES)
    expect(kpi(libelle)).toBe('1')
    cleanup()
    rendre(locale, [ECHEANCES[0]])
    expect(kpi(libelle)).toBe('0')
  })
})
