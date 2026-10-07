import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ModDefinicoes from '@/components/syndic-dashboard/v54/modules/ModDefinicoes'
import { V54LocaleProvider, type V54Locale } from '@/lib/syndic/v54/i18n'

/**
 * Correctif ModDefinicoes (carte « O Meu Gabinete » / « Mon cabinet ») : le champ e-mail
 * affichait par défaut une adresse personnelle réelle à tous les visiteurs de la démo PT.
 * Il affiche désormais une adresse fictive neutre dans les deux langues.
 */

afterEach(cleanup)

function rendre(locale: V54Locale) {
  return render(
    <V54LocaleProvider locale={locale}>
      <ModDefinicoes />
    </V54LocaleProvider>,
  )
}

const champEmail = (): HTMLInputElement => document.getElementById('def-email') as HTMLInputElement

describe('ModDefinicoes — adresse e-mail de démonstration', () => {
  it('PT : adresse fictive contacto@exemplo.pt', () => {
    const { container } = rendre('pt-PT')
    expect(screen.getByLabelText('Email')).toBe(champEmail())
    expect(champEmail().value).toBe('contacto@exemplo.pt')
    expect(container.innerHTML).not.toMatch(/admincvlho|@gmail\.com/i)
  })

  it('FR : adresse fictive contact@exemple.fr', () => {
    const { container } = rendre('fr-FR')
    expect(screen.getByLabelText('E-mail')).toBe(champEmail())
    expect(champEmail().value).toBe('contact@exemple.fr')
    expect(container.innerHTML).not.toMatch(/admincvlho|@gmail\.com/i)
  })

  it("aucune adresse personnelle dans le code du tableau de bord syndic v54", () => {
    const racine = join(process.cwd(), 'components', 'syndic-dashboard', 'v54')
    const fichiers: string[] = []
    const parcourir = (dossier: string) => {
      for (const nom of readdirSync(dossier)) {
        const chemin = join(dossier, nom)
        if (statSync(chemin).isDirectory()) parcourir(chemin)
        else if (/\.(ts|tsx)$/.test(nom)) fichiers.push(chemin)
      }
    }
    parcourir(racine)
    expect(fichiers.length).toBeGreaterThan(0)
    const fautifs = fichiers.filter((f) => /admincvlho/i.test(readFileSync(f, 'utf-8')))
    expect(fautifs).toEqual([])
  })
})
