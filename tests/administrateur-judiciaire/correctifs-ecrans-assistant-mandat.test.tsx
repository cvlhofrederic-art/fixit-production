import './fuseau-paris'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AssistantMandatModal } from '@/components/administrateur-judiciaire/modules/mandat/composants/AssistantMandatModal'

/**
 * Régression du constat 22 (défaut hérité de la maquette) : « Générer le plan » appelait planifierMandat sans
 * protection ; une exception du calcul s'échappait du gestionnaire de clic (aucun plan, aucun message). Les saisies de
 * la revue (durée de 999999 mois, ordonnance du 01/06/9999) ne lèvent plus depuis le correctif du domaine (constat 12) :
 * l'exception est donc provoquée ici en remplaçant planifierMandat, le temps d'un test, par une fonction qui lève.
 */
const controle = vi.hoisted(() => ({ erreur: null as Error | null }))

vi.mock('@/lib/administrateur-judiciaire/domain/planification-mandat', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/administrateur-judiciaire/domain/planification-mandat')>()
  return {
    ...original,
    planifierMandat: (...args: Parameters<typeof original.planifierMandat>) => {
      if (controle.erreur) throw controle.erreur
      return original.planifierMandat(...args)
    },
  }
})

afterEach(() => {
  controle.erreur = null
})

/** Saisit l'ordonnance et la durée puis clique « Générer le plan » (bouton du pied de la modale). */
function generer(ordonnance: string, duree: string) {
  fireEvent.change(screen.getByLabelText("Date de l'ordonnance"), { target: { value: ordonnance } })
  fireEvent.change(screen.getByLabelText('Durée (mois)'), { target: { value: duree } })
  fireEvent.click(screen.getByRole('button', { name: 'Générer le plan' }))
}

describe('Assistant de mandat — exception du calcul du plan (constat 22)', () => {
  it('une exception de planifierMandat s’affiche par le chemin d’erreur existant au lieu de s’échapper du clic', () => {
    render(<AssistantMandatModal open onClose={vi.fn()} />)
    controle.erreur = new Error('Date ISO invalide : « 10000-06-01 »')
    expect(() => generer('01/06/9999', '12')).not.toThrow()
    expect(screen.getByRole('alert').textContent).toBe('Date ISO invalide : « 10000-06-01 »')
    // Comme pour une date d'ordonnance invalide : pas de plan, bouton « Générer le plan » toujours au pied.
    expect(screen.queryByText('Plan généré')).toBeNull()
    expect(screen.queryByRole('button', { name: /Générer le plan automatiquement/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Générer le plan' })).not.toBeNull()
    // Une modification du formulaire efface l'erreur ; un calcul qui aboutit affiche le plan.
    controle.erreur = null
    generer('04/06/2026', '12')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Plan généré')).not.toBeNull()
  })

  it('saisies de la revue : plus d’exception (plan sans fin de mission hors calendrier, rejet de l’ordonnance fin 9999)', () => {
    render(<AssistantMandatModal open onClose={vi.fn()} />)
    expect(() => generer('04/06/2026', '999999')).not.toThrow()
    expect(screen.getByText('Plan généré')).not.toBeNull()
    expect(screen.queryByText(/fin de mission :/)).toBeNull()
    expect(() => generer('01/06/9999', '12')).not.toThrow()
    expect(screen.getByText('Plan généré')).not.toBeNull()
    expect(screen.queryByText(/fin de mission :/)).toBeNull()
    expect(() => generer('31/12/9999', '')).not.toThrow()
    expect(screen.getByRole('alert').textContent).toBe("Date d'ordonnance invalide : format JJ/MM/AAAA attendu.")
  })

  it('parcours normal inchangé : plan de l’ordonnance par défaut avec sa fin de mission', () => {
    render(<AssistantMandatModal open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Générer le plan automatiquement/ }))
    expect(screen.getByText('Plan généré')).not.toBeNull()
    expect(screen.getByText('04/06/2027', { selector: 'b' })).not.toBeNull()
    expect(screen.getByRole('button', { name: /Confirmer la mise en place/ })).not.toBeNull()
  })
})
