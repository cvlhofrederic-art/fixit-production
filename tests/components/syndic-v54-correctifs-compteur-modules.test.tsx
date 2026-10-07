import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModOsMeusModulos from '@/components/syndic-dashboard/v54/modules/ModOsMeusModulos'
import { V54LocaleProvider, type V54Locale } from '@/lib/syndic/v54/i18n'

/**
 * Correctif ModOsMeusModulos : le PT annonçait « 90 módulos » et « 90/90 ativos » en dur
 * alors que le catalogue affiche 77 cartes. Le PT calcule désormais ses compteurs à partir
 * des cartes affichées, avec la même logique que le FR.
 */

afterEach(cleanup)

function rendre(locale: V54Locale) {
  return render(
    <V54LocaleProvider locale={locale}>
      <ModOsMeusModulos />
    </V54LocaleProvider>,
  )
}

/** Une carte du catalogue = un interrupteur (le panneau « ordre du menu » n'en a pas). */
const nombreDeCartes = () => screen.getAllByRole('checkbox').length

describe('ModOsMeusModulos — compteur de modules', () => {
  it('PT : chapeau et pastille égaux au nombre de cartes (77)', () => {
    rendre('pt-PT')
    const n = nombreDeCartes()
    expect(n).toBe(77)
    expect(screen.getByText(`${n}/${n} ativos`)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`^${n} módulos profissionais · `))).toBeInTheDocument()
    expect(screen.queryByText(/90\/90|90 módulos/)).toBeNull()
  })

  it('FR : chapeau et pastille égaux au nombre de cartes', () => {
    rendre('fr-FR')
    const n = nombreDeCartes()
    expect(n).toBeGreaterThan(0)
    expect(screen.getByText(`${n}/${n} actifs`)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`^${n} modules professionnels · `))).toBeInTheDocument()
  })
})
