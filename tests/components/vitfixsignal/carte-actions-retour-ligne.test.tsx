// Carte commune (Carte de components/coproprietaire-dashboard/ui.tsx, employée par Vitfix Signal) : sa rangée de boutons
// (prop `actions`) passe à la ligne au lieu de sortir de l'écran. Relevé sur les captures des bureaux (vue « Cabinets »,
// téléphone de 375 px) : le bloc des actions était tenu à la largeur de tous ses boutons sur une seule ligne (shrink-0
// sans borne), d'où une page de 555 px avant la PR (« Logo » hors de l'écran) et de 666 px avec « Bureaux (n) ».
// jsdom ne calcule pas la mise en page : on vérifie les classes. max-w-full borne le bloc à la largeur de l'en-tête de la
// carte (ses boutons passent alors à la ligne, flex-wrap) ; il ne change rien tant que les boutons tiennent sur la ligne.
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Carte } from '@/components/coproprietaire-dashboard/ui'

describe('Carte : rangée de boutons plus large que la carte', () => {
  it('le bloc des actions est borné à la largeur de la carte et passe à la ligne', () => {
    render(
      <Carte titre="Cabinet Exemple" sousTitre="vitfix.io/cabinet-exemple/" actions={<><button type="button">Modifier</button><button type="button">Logo</button></>}>
        <p>Contenu</p>
      </Carte>,
    )
    const actions = screen.getByRole('button', { name: 'Modifier' }).parentElement as HTMLElement
    expect(actions).toHaveClass('flex', 'flex-wrap', 'max-w-full')
  })
})
