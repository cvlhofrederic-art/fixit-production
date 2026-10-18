// tests/components/syndic-v54-canal-demandes-origine.test.tsx
//
// Canal de communication v54, onglet Demandes : provenance d'une demande à côté du nom du demandeur.
//   - 'portail'  → badge « Portail » (compte rattaché à sa fiche, identité vérifiée) ;
//   - 'public'   → badge « Formulaire public » (dépôt sans compte, e-mail non vérifié) ;
//   - inconnue (null / absente : colonne pas encore en base) → aucun badge.
// Le badge figure dans la liste et dans l'en-tête de la demande ouverte, en FR et en PT.

import React, { useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { CanalDemandes } from '@/components/syndic-dashboard/v54/modules/canal/CanalDemandes'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { V54LocaleProvider, type V54Locale } from '@/lib/syndic/v54/i18n'
import type { Signalement } from '@/lib/syndic/v54/api'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const signalement = (id: string, demandeurNom: string, createdAt: string, over: Partial<Signalement> = {}): Signalement => ({
  id, immeuble: 'Le Prado', demandeurNom, demandeurRole: 'coproprio', demandeurEmail: `${id}@example.fr`, typeIntervention: 'Plomberie',
  description: `Description ${id}`, priorite: 'normale', statut: 'en_attente', batiment: '', etage: '', numLot: '',
  createdAt, messages: [], ...over,
})

// La plus récente (portail) est ouverte au rendu.
const PORTAIL = signalement('s-portail', 'Marie Coste', '2026-10-17T10:00:00Z', { origine: 'portail' })
const PUBLIC = signalement('s-public', 'Jean Durand', '2026-10-17T09:00:00Z', { origine: 'public' })
const INCONNUE_NULL = signalement('s-null', 'Paul Martin', '2026-10-17T08:00:00Z', { origine: null })
const INCONNUE_ABSENTE = signalement('s-absente', 'Lucie Bernard', '2026-10-17T07:00:00Z')
const LISTE = [PORTAIL, PUBLIC, INCONNUE_NULL, INCONNUE_ABSENTE]

function Demandes({ liste }: Readonly<{ liste: Signalement[] }>) {
  const [sel, setSel] = useState<string | null>(null)
  return <CanalDemandes signalements={liste} selectedId={sel} onSelect={setSel} onValider={vi.fn()} token="tok" onRafraichir={vi.fn()} />
}
const rendre = (liste: Signalement[], locale: V54Locale = 'fr-FR') =>
  render(<V54LocaleProvider locale={locale}><ToastProvider><Demandes liste={liste} /></ToastProvider></V54LocaleProvider>)

const carte = (nom: string) => screen.getByRole('button', { name: new RegExp(nom) })
const enTete = () => document.querySelector('.canal-chat-meta') as HTMLElement

describe('Canal — provenance des demandes', () => {
  it('« Portail » et « Formulaire public » à côté du nom, rien quand la provenance est inconnue', () => {
    rendre(LISTE)

    // Liste : un badge par demande dont la provenance est connue, à côté du nom du demandeur.
    expect(within(carte('Marie Coste')).getByText('Portail')).toBeInTheDocument()
    expect(within(carte('Jean Durand')).getByText('Formulaire public')).toBeInTheDocument()
    expect(within(carte('Paul Martin')).queryByText(/Portail|Formulaire public/)).toBeNull()
    expect(within(carte('Lucie Bernard')).queryByText(/Portail|Formulaire public/)).toBeNull()
    expect(carte('Marie Coste')).toHaveTextContent('Marie CostePortail · Plomberie')

    // En-tête de la demande ouverte (la plus récente : portail).
    expect(within(enTete()).getByText('Portail')).toBeInTheDocument()
    expect(within(enTete()).queryByText('Formulaire public')).toBeNull()

    // Infobulles : identité vérifiée / e-mail non vérifié.
    expect(screen.getAllByTitle('Demande déposée depuis le portail copropriétaire — identité vérifiée.')).toHaveLength(2)
    expect(screen.getAllByTitle('Demande déposée via le formulaire public, sans compte — e-mail non vérifié.')).toHaveLength(1)
  })

  it("l'en-tête suit la demande ouverte : formulaire public, puis aucune mention pour une provenance inconnue", () => {
    rendre(LISTE)
    fireEvent.click(carte('Jean Durand'))
    expect(within(enTete()).getByText('Formulaire public')).toBeInTheDocument()
    expect(within(enTete()).queryByText('Portail')).toBeNull()

    fireEvent.click(carte('Paul Martin'))
    expect(within(enTete()).queryByText(/Portail|Formulaire public/)).toBeNull()
    expect(enTete()).toHaveTextContent('Paul Martin')
  })

  it('libellés portugais', () => {
    rendre(LISTE, 'pt-PT')
    expect(within(carte('Marie Coste')).getByText('Portal')).toBeInTheDocument()
    expect(within(carte('Jean Durand')).getByText('Formulário público')).toBeInTheDocument()
    expect(within(enTete()).getByText('Portal')).toBeInTheDocument()
    expect(screen.getAllByTitle('Pedido enviado a partir do portal do condómino — identidade verificada.')).toHaveLength(2)
  })
})
