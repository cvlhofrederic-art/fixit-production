// Fenêtre commune (Modale de components/coproprietaire-dashboard/ui.tsx, employée par AJ Signalement) : une fenêtre plus
// haute que l'écran doit défiler DANS la fenêtre. Signalé par Hugo le 13/11/2026 sur « Modifier la copropriété » : la
// fenêtre (1 428 px pour un écran de 740 px) était centrée dans un fond fixe sans défilement, le corps de la page était
// figé (overflow hidden) : ni le titre ni le bouton « Enregistrer » n'étaient joignables.
// jsdom ne calcule pas la mise en page : on vérifie les classes qui bornent la hauteur et ouvrent le défilement, et que
// la barre de défilement (cible = la fenêtre elle-même) ne ferme pas la fenêtre.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Modale } from '@/components/coproprietaire-dashboard/ui'

afterEach(() => { cleanup(); document.body.style.overflow = '' })

const rendre = (onFermer = vi.fn()) => {
  render(
    <Modale titre="Modifier la copropriété" onFermer={onFermer} labelFermer="Fermer la fenêtre">
      {Array.from({ length: 40 }, (_, i) => <p key={i}>Ligne {i}</p>)}
      <button type="button">Enregistrer</button>
    </Modale>,
  )
  return onFermer
}

describe('Modale : une fenêtre plus haute que l’écran défile', () => {
  it('la fenêtre est bornée à la hauteur de l’écran et défile verticalement', () => {
    rendre()
    const fenetre = screen.getByRole('dialog', { name: 'Modifier la copropriété' })
    const classes = fenetre.className.split(/\s+/)
    expect(classes).toContain('overflow-y-auto')
    expect(classes).toContain('max-h-[100dvh]')
    expect(classes).toContain('sm:max-h-[calc(100dvh_-_2rem)]')
  })

  it('un clic dans la fenêtre (barre de défilement comprise) ne la ferme pas ; un clic sur le fond la ferme', () => {
    const onFermer = rendre()
    const fenetre = screen.getByRole('dialog', { name: 'Modifier la copropriété' })
    fireEvent.mouseDown(fenetre)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(onFermer).not.toHaveBeenCalled()
    fireEvent.mouseDown(fenetre.parentElement as HTMLElement)
    expect(onFermer).toHaveBeenCalledTimes(1)
  })

  it('le fond reste figé pendant l’ouverture et retrouve son défilement à la fermeture', () => {
    document.body.style.overflow = ''
    render(
      <Modale titre="Fenêtre" onFermer={() => {}} labelFermer="Fermer la fenêtre"><p>Contenu</p></Modale>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    cleanup()
    expect(document.body.style.overflow).toBe('')
  })
})
