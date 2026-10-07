import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import ModExtranet from '@/components/syndic-dashboard/v54/modules/ModExtranet'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { V54LocaleProvider, type V54Locale } from '@/lib/syndic/v54/i18n'
import { collectTexts } from '../syndic-v54-i18n/crawl'
import { residusPortugais } from '../syndic-v54-i18n/residus-pt'

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

/**
 * Correctif ModExtranet (bouton « Copiar » / « Copier ») : le toast « Link copiado » / « Lien copié »
 * partait sans attendre navigator.clipboard.writeText, donc même quand la copie échouait
 * (permission refusée, presse-papiers indisponible hors contexte sécurisé) ; le rejet n'était
 * pas traité. Désormais : succès confirmé → toast actuel ; échec → toast d'erreur.
 */
const TEXTES = {
  'pt-PT': {
    bouton: 'Copiar',
    succes: 'Link copiado',
    succesDesc: 'URL do portal copiado para o clipboard',
    echec: 'Não foi possível copiar o link',
    echecDesc: 'Selecione o URL do portal e copie-o manualmente',
  },
  'fr-FR': {
    bouton: 'Copier',
    succes: 'Lien copié',
    succesDesc: "URL de l'extranet copiée dans le presse-papiers",
    echec: 'Impossible de copier le lien',
    echecDesc: "Sélectionnez l'URL de l'extranet et copiez-la manuellement",
  },
} as const

function rendreAvecToasts(locale: V54Locale) {
  return render(
    <V54LocaleProvider locale={locale}>
      <ToastProvider>
        <ModExtranet />
      </ToastProvider>
    </V54LocaleProvider>,
  )
}

/** Laisse la promesse de writeText se régler et React appliquer le toast. */
const reglerPromesses = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

describe.each(['pt-PT', 'fr-FR'] as const)('ModExtranet (%s) — résultat de la copie', (locale) => {
  const t = TEXTES[locale]
  const rejetsNonTraites = vi.fn()
  beforeEach(() => {
    rejetsNonTraites.mockClear()
    process.on('unhandledRejection', rejetsNonTraites)
  })
  afterEach(() => {
    process.off('unhandledRejection', rejetsNonTraites)
  })

  it('copie réussie : toast de succès, aucun toast d’erreur', async () => {
    installerPressePapiers()
    rendreAvecToasts(locale)
    fireEvent.click(screen.getByRole('button', { name: t.bouton }))
    const succes = await screen.findByText(t.succes)
    expect(succes.closest('[role="status"]')?.textContent).toContain(t.succesDesc)
    expect(screen.queryByText(t.echec)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('copie refusée par le navigateur : toast d’erreur, pas de « copié », rejet traité', async () => {
    const writeText = installerPressePapiers()
    writeText.mockRejectedValue(new DOMException('Document is not focused.', 'NotAllowedError'))
    rendreAvecToasts(locale)
    fireEvent.click(screen.getByRole('button', { name: t.bouton }))
    const alerte = await screen.findByRole('alert')
    expect(alerte.textContent).toContain(t.echec)
    expect(alerte.textContent).toContain(t.echecDesc)
    expect(screen.queryByText(t.succes)).toBeNull()
    await reglerPromesses()
    expect(rejetsNonTraites).not.toHaveBeenCalled()
  })

  it('presse-papiers indisponible : toast d’erreur, pas de « copié »', async () => {
    Reflect.deleteProperty(window.navigator, 'clipboard')
    expect('clipboard' in window.navigator).toBe(false)
    rendreAvecToasts(locale)
    fireEvent.click(screen.getByRole('button', { name: t.bouton }))
    const alerte = await screen.findByRole('alert')
    expect(alerte.textContent).toContain(t.echec)
    expect(alerte.textContent).toContain(t.echecDesc)
    expect(screen.queryByText(t.succes)).toBeNull()
  })
})

describe('ModExtranet (fr-FR) — toast d’échec de copie', () => {
  // Le parcours fr-residus installe un presse-papiers qui réussit : il ne voit jamais ce toast.
  it('aucun texte portugais', async () => {
    Reflect.deleteProperty(window.navigator, 'clipboard')
    rendreAvecToasts('fr-FR')
    fireEvent.click(screen.getByRole('button', { name: TEXTES['fr-FR'].bouton }))
    const alerte = await screen.findByRole('alert')
    expect(residusPortugais(collectTexts(alerte))).toEqual([])
  })
})
