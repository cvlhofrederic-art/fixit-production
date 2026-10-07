import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import ModDeclEncargos from '@/components/syndic-dashboard/v54/modules/ModDeclEncargos'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { V54LocaleProvider, type V54Locale } from '@/lib/syndic/v54/i18n'
import type { DeclEncargo } from '@/lib/syndic/v54/api'

/**
 * Correctifs ModDeclEncargos (état daté / declaração de encargos) :
 * - la pastille de statut suit `estado` (pendente | emitida | concluida) au lieu d'afficher
 *   toujours « Pendente » / « À établir » ;
 * - les dates ISO renvoyées par l'API (dataPedido, prazoLimite) s'affichent en JJ/MM/AAAA.
 */

afterEach(cleanup)

const decl = (over: Partial<DeclEncargo>): DeclEncargo => ({
  id: 'd1', fracao: 'F1', condomino: 'Condómino', edificio: '',
  dataPedido: '2026-05-01', prazoLimite: '2026-05-11', encargosCorrentes: 0, divida: 0,
  estado: 'pendente', notas: '',
  ...over,
})

const donnees = (declaracoes: DeclEncargo[]): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], declaracoes,
})

const DECLS = [
  decl({ id: 'p', fracao: 'F-PEN', estado: 'pendente' }),
  decl({ id: 'e', fracao: 'F-EMI', estado: 'emitida' }),
  decl({ id: 'c', fracao: 'F-CON', estado: 'concluida' }),
]

function rendre(locale: V54Locale, declaracoes: DeclEncargo[] = DECLS) {
  return render(
    <V54LocaleProvider locale={locale}>
      <SyndicDataContext.Provider value={donnees(declaracoes)}><ModDeclEncargos /></SyndicDataContext.Provider>
    </V54LocaleProvider>,
  )
}

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
