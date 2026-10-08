import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ModDeclEncargos from '@/components/syndic-dashboard/v54/modules/ModDeclEncargos'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { V54LocaleProvider, type V54Locale } from '@/lib/syndic/v54/i18n'

/**
 * Textes du délai de la déclaration, chacun selon la règle de son pays :
 * - PT : délai LÉGAL de 10 jours à compter du lendemain de la demande, terme reporté au premier jour
 *   ouvrable s'il tombe un dimanche ou un férié (art. 1424.º-A, n.º 2, du Code civil : « no prazo
 *   máximo de 10 dias a contar do respetivo requerimento » ; art. 279.º via art. 296.º) — et non
 *   « 10 dias úteis » ;
 *   la vente est communiquée à l'administrateur par le condómino ALIENANTE, par correio registado,
 *   sous 15 jours, avec nom complet et NIF du nouveau propriétaire (DL 268/94, art. 3.º, n.º 3) ;
 * - FR : aucun délai légal de délivrance de l'état daté (décret n° 67-223, art. 5 : contenu
 *   seulement) ; le module garde son « délai interne de traitement », sans mention légale.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const donnees = (extra: Partial<SyndicData> = {}): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], declaracoes: [],
  ...extra,
})

function rendre(locale: V54Locale, extra: Partial<SyndicData> = {}) {
  return render(
    <V54LocaleProvider locale={locale}>
      <ToastProvider>
        <SyndicDataContext.Provider value={donnees(extra)}><ModDeclEncargos /></SyndicDataContext.Provider>
      </ToastProvider>
    </V54LocaleProvider>,
  )
}

/** Remplit le formulaire et l'enregistre (POST simulé, réponse 200). */
function enregistrerDeclaration(locale: V54Locale, lot: string) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ declaracao: {} }), { status: 200 }))
  fireEvent.click(screen.getAllByRole('button', { name: locale === 'pt-PT' ? /Nova declaração/ : /Nouvel état daté/ })[0])
  fireEvent.change(document.getElementById('de-frac') as HTMLInputElement, { target: { value: lot } })
  fireEvent.change(document.getElementById('de-cond') as HTMLInputElement, { target: { value: 'Maria Costa' } })
  fireEvent.click(screen.getByRole('button', { name: locale === 'pt-PT' ? 'Registar' : 'Enregistrer' }))
}

describe('ModDeclEncargos — textes du délai (PT : légal, FR : interne)', () => {
  it('PT : alerte conforme au Code civil et au DL 268/94', () => {
    const { container } = rendre('pt-PT')
    expect(screen.getByText(
      'O administrador é obrigado a emitir a declaração de encargos no prazo máximo de 10 dias a contar do pedido (art. 1424.º-A, n.º 2, do Código Civil). '
      + 'Após a alienação, o condómino alienante deve comunicá-la ao administrador por correio registado, no prazo máximo de 15 dias, '
      + 'com o nome completo e o NIF do novo proprietário (art. 3.º, n.º 3, do Decreto-Lei n.º 268/94).',
    )).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/dias úteis/)
    expect(container.textContent).not.toMatch(/novo proprietário deve notificar/)
  })

  it('PT : toast d’enregistrement — délai légal de 10 jours, sans « dias úteis »', async () => {
    rendre('pt-PT', { token: 'jeton-de', refresh: vi.fn() })
    enregistrerDeclaration('pt-PT', 'Apt 5.º D')
    expect(await screen.findByText('Fração Apt 5.º D · prazo legal 10 dias')).toBeInTheDocument()
  })

  it('FR : toast d’enregistrement — délai interne, aucun délai légal annoncé', async () => {
    const { container } = rendre('fr-FR', { token: 'jeton-de', refresh: vi.fn() })
    enregistrerDeclaration('fr-FR', '12 — Apt B3')
    expect(await screen.findByText('Lot 12 — Apt B3 · délai interne de traitement : 10 jours')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/délai légal/)
  })
})
