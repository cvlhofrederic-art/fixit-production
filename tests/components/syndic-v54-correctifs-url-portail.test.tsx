import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ModExtranet from '@/components/syndic-dashboard/v54/modules/ModExtranet'
import { V54LocaleProvider, type V54Locale } from '@/lib/syndic/v54/i18n'

/**
 * Correctif ModExtranet (panneau « Portal Condóminos » / « Espace copropriétaire ») :
 * le bouton « Copiar » / « Copier » copiait https://vitfix.io/copropriétaire/portail (avec accent,
 * route inexistante) alors que le champ affiche https://vitfix.io/coproprietaire/portail.
 * Le presse-papiers reçoit désormais exactement l'URL affichée, dans les deux langues.
 */

const URL_AFFICHEE = 'https://vitfix.io/coproprietaire/portail'

// jsdom n'implémente pas navigator.clipboard : on l'installe le temps du test, puis on le retire
// (le faux presse-papiers ne doit pas fuir vers les autres tests du fichier).
function installerPressePapiers() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true })
  return writeText
}

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window.navigator, 'clipboard')
})

function rendre(locale: V54Locale) {
  return render(
    <V54LocaleProvider locale={locale}>
      <ModExtranet />
    </V54LocaleProvider>,
  )
}

describe('ModExtranet — URL du portail copiée', () => {
  it.each([
    ['pt-PT', 'URL do portal', 'Copiar'],
    ['fr-FR', "URL de l'extranet", 'Copier'],
  ] as const)('%s : copie exactement l’URL affichée', (locale, libelleChamp, libelleBouton) => {
    const writeText = installerPressePapiers()
    rendre(locale)
    const champ = screen.getByLabelText(libelleChamp) as HTMLInputElement
    expect(champ.value).toBe(URL_AFFICHEE)
    fireEvent.click(screen.getByRole('button', { name: libelleBouton }))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(champ.value)
    expect(writeText.mock.calls[0][0]).not.toMatch(/é/)
  })
})
