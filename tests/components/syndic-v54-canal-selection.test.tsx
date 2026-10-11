// tests/components/syndic-v54-canal-selection.test.tsx
//
// Canal de communication v54 (données réelles) — onglets Demandes et Professionnels :
//   - un rafraîchissement (polling 15 s) qui apporte un élément plus récent ne change plus
//     l'élément ouvert (avant : sans clic, l'écran sautait sur le plus récent) ;
//   - le brouillon de réponse est effacé quand on change d'élément ;
//   - le fil d'une demande est affiché dans l'ordre chronologique.

import React, { useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { CanalDemandes } from '@/components/syndic-dashboard/v54/modules/canal/CanalDemandes'
import { CanalPro } from '@/components/syndic-dashboard/v54/modules/canal/CanalPro'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { V54LocaleProvider } from '@/lib/syndic/v54/i18n'
import type { ConversationCanalPro, Signalement } from '@/lib/syndic/v54/api'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const signalement = (id: string, immeuble: string, createdAt: string, over: Partial<Signalement> = {}): Signalement => ({
  id, immeuble, demandeurNom: `Demandeur ${immeuble}`, demandeurRole: 'coproprio', demandeurEmail: '', typeIntervention: 'Plomberie',
  description: `Description ${immeuble}`, priorite: 'normale', statut: 'en_attente', batiment: '', etage: '', numLot: '',
  createdAt, messages: [], ...over,
})

const conversation = (id: string, nom: string, derniereActivite: string): ConversationCanalPro => ({
  id, artisanUserId: `compte-${id}`, prestataire: { nom, metier: 'Plombier' }, derniereActivite, apercu: '', ordre: null,
  messages: [{ id: `${id}-m1`, type: 'text', contenu: `Message de ${nom}`, creeLe: derniereActivite, cote: 'artisan', ordreMission: null, document: null }],
})

/** Parent minimal : garde la sélection comme CanalReel (useState) et reçoit les listes rafraîchies. */
function Demandes({ liste }: Readonly<{ liste: Signalement[] }>) {
  const [sel, setSel] = useState<string | null>(null)
  return <CanalDemandes signalements={liste} selectedId={sel} onSelect={setSel} onValider={vi.fn()} token="tok" onRafraichir={vi.fn()} />
}
function Pros({ liste }: Readonly<{ liste: ConversationCanalPro[] }>) {
  const [sel, setSel] = useState<string | null>(null)
  return <CanalPro conversations={liste} selectedId={sel} onSelect={setSel} token="tok" onRafraichir={vi.fn()} nbEquipe={0} onEquipe={vi.fn()} />
}
const cadre = (ui: React.ReactNode) => <V54LocaleProvider locale="fr-FR"><ToastProvider>{ui}</ToastProvider></V54LocaleProvider>

/** Titre de la demande ouverte (en-tête du fil). */
const titreDemande = () => document.querySelector('.canal-chat-title')?.textContent ?? ''

describe('Canal — onglet Demandes', () => {
  const PRADO = signalement('s-prado', 'Le Prado', '2026-10-12T08:00:00Z')
  const CASTELLANE = signalement('s-castellane', 'Castellane', '2026-10-12T07:00:00Z')
  const NOUVELLE = signalement('s-nouvelle', 'Belle de Mai', '2026-10-12T10:00:00Z')

  it('sans clic : la plus récente est ouverte puis conservée quand une demande plus récente arrive', () => {
    const { rerender } = render(cadre(<Demandes liste={[CASTELLANE, PRADO]} />))
    expect(titreDemande()).toContain('Le Prado')
    rerender(cadre(<Demandes liste={[CASTELLANE, PRADO, NOUVELLE]} />))
    expect(titreDemande()).toContain('Le Prado')
  })

  it('demande choisie conservée au rafraîchissement ; brouillon effacé au changement de demande', () => {
    const { rerender } = render(cadre(<Demandes liste={[CASTELLANE, PRADO]} />))
    fireEvent.click(screen.getByRole('button', { name: /Castellane/ }))
    expect(titreDemande()).toContain('Castellane')

    const saisie = screen.getByRole('textbox', { name: /message/i })
    fireEvent.change(saisie, { target: { value: 'Le plombier passe demain' } })
    rerender(cadre(<Demandes liste={[CASTELLANE, PRADO, NOUVELLE]} />))
    expect(titreDemande()).toContain('Castellane')
    // Même demande : le brouillon reste.
    expect(screen.getByRole('textbox', { name: /message/i })).toHaveValue('Le plombier passe demain')

    fireEvent.click(screen.getByRole('button', { name: /Le Prado/ }))
    expect(titreDemande()).toContain('Le Prado')
    expect(screen.getByRole('textbox', { name: /message/i })).toHaveValue('')
  })

  it('fil de la demande trié par date (chronologique), quel que soit l’ordre reçu', () => {
    const avecFil = signalement('s-fil', 'Le Prado', '2026-10-12T08:00:00Z', {
      messages: [
        { id: 'f3', auteur: 'Syndic', role: 'syndic', texte: 'Troisième', createdAt: '2026-10-12T11:00:00Z' },
        { id: 'f1', auteur: 'Marie', role: 'coproprio', texte: 'Premier', createdAt: '2026-10-12T09:00:00Z' },
        { id: 'f2', auteur: 'Système', role: 'system', texte: 'Deuxième', createdAt: '2026-10-12T10:00:00Z' },
      ],
    })
    render(cadre(<Demandes liste={[avecFil]} />))
    const textes = ['Premier', 'Deuxième', 'Troisième'].map((t) => screen.getByText(t))
    expect(textes[0].compareDocumentPosition(textes[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(textes[1].compareDocumentPosition(textes[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('Canal — onglet Professionnels', () => {
  const DAMIEN = conversation('c-damien', 'Damien Perrin', '2026-10-12T09:00:00Z')
  const SOPHIE = conversation('c-sophie', 'Sophie Arnaud', '2026-10-12T08:00:00Z')
  const DAMIEN_PLUS_ANCIEN = { ...DAMIEN, derniereActivite: '2026-10-12T07:00:00Z' }
  const SOPHIE_PLUS_RECENTE = { ...SOPHIE, derniereActivite: '2026-10-12T12:00:00Z' }

  it('sans clic : la conversation ouverte reste la même quand une autre devient la plus récente', () => {
    const { rerender } = render(cadre(<Pros liste={[DAMIEN, SOPHIE]} />))
    expect(screen.getByText('Message de Damien Perrin')).toBeInTheDocument()
    rerender(cadre(<Pros liste={[SOPHIE_PLUS_RECENTE, DAMIEN_PLUS_ANCIEN]} />))
    expect(screen.getByText('Message de Damien Perrin')).toBeInTheDocument()
    expect(screen.queryByText('Message de Sophie Arnaud')).toBeNull()
  })

  it('brouillon effacé quand on ouvre une autre conversation, conservé au rafraîchissement', () => {
    const { rerender } = render(cadre(<Pros liste={[DAMIEN, SOPHIE]} />))
    const saisie = () => screen.getByRole('textbox', { name: /message/i })
    fireEvent.change(saisie(), { target: { value: 'Merci pour le devis' } })
    rerender(cadre(<Pros liste={[SOPHIE_PLUS_RECENTE, DAMIEN_PLUS_ANCIEN]} />))
    expect(saisie()).toHaveValue('Merci pour le devis')

    fireEvent.click(screen.getAllByRole('button', { name: /Sophie Arnaud/ })[0])
    expect(screen.getByText('Message de Sophie Arnaud')).toBeInTheDocument()
    expect(saisie()).toHaveValue('')
  })
})
