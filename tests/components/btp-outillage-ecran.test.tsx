// tests/components/btp-outillage-ecran.test.tsx — écran « Ferramentas e viaturas » (société BTP, 26/11/2026) :
// ce que voit l'encarregado (sa vérification du vendredi, pas le répertoire), ce qu'il envoie, ce que voit le gérant.
// Serveur simulé : fetch remplacé, réponses de /api/btp/outillage écrites ici.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ContexteOutillage } from '@/lib/btp/outillage-regles'

const etat = vi.hoisted(() => ({ locale: 'pt' }))
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => etat.locale, useTranslation: () => ({ t: (c: string) => c }) }))
vi.mock('@/lib/auth/jeton-acces', () => ({ jetonAcces: async () => 'tok' }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import { toast } from 'sonner'
import { OutillageSection } from '@/components/dashboard/btp/OutillageSection'

const VILLA = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a01'
const BETONEIRA = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d01'
const ESCADOTES = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d02'

const contexteChef = (): ContexteOutillage => ({
  disponible: true, gestion: false, rattachement: 'relie', aujourdhui: '2026-11-27', vendredi: '2026-11-27',
  chantiers: [{ id: VILLA, titre: 'Moradia Gaia', adresse: 'Rua A, Gaia', etat: 'a_faire', derniere: null }],
  lieux: [],
  outils: [
    { id: BETONEIRA, type: 'outil', nom: 'Betoneira', reference: null, quantite: 1, chantierId: VILLA, etat: 'ok', notes: null, surPlaceDepuis: '2026-11-20' },
    { id: ESCADOTES, type: 'outil', nom: 'Escadotes', reference: null, quantite: 4, chantierId: VILLA, etat: 'ok', notes: null, surPlaceDepuis: '2026-11-20' },
  ],
  verifications: [],
})

let reponses: { get: ContexteOutillage | { status: number; error: string }; post: { status: number; corps: Record<string, unknown> } }
let envois: Array<Record<string, unknown>>

beforeEach(() => {
  etat.locale = 'pt'
  envois = []
  reponses = { get: contexteChef(), post: { status: 201, corps: { verification: null } } }
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      envois.push(JSON.parse(String(init.body)))
      return new Response(JSON.stringify(reponses.post.corps), { status: reponses.post.status })
    }
    const get = reponses.get
    if ('status' in get && 'error' in get) return new Response(JSON.stringify({ error: get.error }), { status: get.status })
    return new Response(JSON.stringify(get), { status: 200 })
  }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('Ferramentas e viaturas — o encarregado', () => {
  it('vê a verificação de sexta da sua obra e o histórico, não o inventário', async () => {
    render(<OutillageSection />)
    expect(await screen.findByText('Moradia Gaia')).toBeTruthy()
    expect(screen.getByText('A verificar hoje')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Verificação de sexta-feira' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Histórico' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Inventário' })).toBeNull()
  })

  it('« Validar » espera que tudo esteja marcado, e envia o que ele marcou', async () => {
    render(<OutillageSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Verificar agora' }))
    const validar = screen.getByRole('button', { name: 'Validar a verificação' }) as HTMLButtonElement
    expect(validar.disabled).toBe(true)
    expect(screen.getByText('Falta marcar 2 elementos.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '✖ Em falta' }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } })
    expect(validar.disabled).toBe(false)
    fireEvent.change(screen.getByRole('textbox', { name: 'Observação sobre Betoneira' }), { target: { value: 'Levada para Porto' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Observações/ }), { target: { value: 'Precisamos de uma rebarbadora' } })
    fireEvent.click(validar)

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toEqual({
      action: 'valider', chantierId: VILLA, fuseau: expect.any(String),
      observations: 'Precisamos de uma rebarbadora',
      lignes: [
        { outilId: BETONEIRA, presents: 0, enPanne: false, remarque: 'Levada para Porto' },
        { outilId: ESCADOTES, presents: 3, enPanne: false, remarque: null },
      ],
    })
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
  })

  it('observação escondida (elemento de novo presente): não é enviada', async () => {
    render(<OutillageSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Verificar agora' }))
    fireEvent.click(screen.getByRole('button', { name: '✖ Em falta' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Observação sobre Betoneira' }), { target: { value: 'Levada para Porto' } })
    fireEvent.click(screen.getByRole('button', { name: '✔ Presente' }))
    expect(screen.queryByRole('textbox', { name: 'Observação sobre Betoneira' })).toBeNull()
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar a verificação' }))
    await waitFor(() => expect(envois).toHaveLength(1))
    expect((envois[0].lignes as Array<Record<string, unknown>>)[0]).toEqual({ outilId: BETONEIRA, presents: 1, enPanne: false, remarque: null })
  })

  it('obra sem ferramentas: só se envia com uma observação', async () => {
    reponses.get = { ...contexteChef(), chantiers: [{ id: VILLA, titre: 'Moradia Gaia', adresse: '', etat: 'sans_outils', derniere: null }], outils: [] }
    render(<OutillageSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Verificar agora' }))
    const validar = screen.getByRole('button', { name: 'Validar a verificação' }) as HTMLButtonElement
    expect(validar.disabled).toBe(true)
    expect(screen.getByText('Escreva uma observação para enviar.')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: /Observações/ }), { target: { value: 'Precisamos de um andaime' } })
    expect(validar.disabled).toBe(false)
    fireEvent.click(validar)
    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({ lignes: [], observations: 'Precisamos de um andaime' })
  })

  it('« Marcar tudo presente » marca cada elemento com a quantidade prevista', async () => {
    render(<OutillageSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Verificar agora' }))
    fireEvent.click(screen.getByRole('button', { name: 'Marcar tudo presente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Validar a verificação' }))
    await waitFor(() => expect(envois).toHaveLength(1))
    expect((envois[0].lignes as Array<Record<string, unknown>>).map(l => l.presents)).toEqual([1, 4])
  })

  it('lista mudada entretanto: mensagem, lista recarregada, nada dado como registado', async () => {
    reponses.post = { status: 409, corps: { error: 'liste_changee' } }
    render(<OutillageSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Verificar agora' }))
    fireEvent.click(screen.getByRole('button', { name: 'Marcar tudo presente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Validar a verificação' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('A lista desta obra mudou')))
    expect(toast.success).not.toHaveBeenCalled()
    await waitFor(() => expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThanOrEqual(3))
  })

  it('conta sem ficha de colaborador: explica porquê, sem obras', async () => {
    reponses.get = { ...contexteChef(), rattachement: 'aucun', chantiers: [], outils: [] }
    render(<OutillageSection />)
    expect(await screen.findByText(/não está ligada a nenhuma ficha de colaborador/)).toBeTruthy()
  })

  it('módulo fechado (operário): mensagem clara, sem botão « Tentar novamente »', async () => {
    reponses.get = { status: 403, error: 'acces_refuse' }
    render(<OutillageSection />)
    expect(await screen.findByText(/Não tem acesso a este módulo/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull()
  })

  it('migração por aplicar: o ecrã di-lo e não mostra nada para preencher', async () => {
    reponses.get = { ...contexteChef(), disponible: false, chantiers: [], outils: [] }
    render(<OutillageSection />)
    expect(await screen.findByText(/migração de 26\/11\/2026/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Verificar agora' })).toBeNull()
  })
})

describe('Outillage et véhicules — le gérant', () => {
  it('ajoute un véhicule au dépôt depuis le répertoire', async () => {
    etat.locale = 'fr'
    reponses.get = { ...contexteChef(), gestion: true, lieux: [{ id: VILLA, titre: 'Moradia Gaia', statut: 'En cours' }] }
    reponses.post = { status: 201, corps: { outil: {} } }
    render(<OutillageSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Répertoire' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Ajouter' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), { target: { value: 'vehicule' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Nom/ }), { target: { value: 'Camionnette Master' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Immatriculation' }), { target: { value: 'AA-00-BB' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toEqual({
      action: 'creer',
      outil: { type: 'vehicule', nom: 'Camionnette Master', reference: 'AA-00-BB', quantite: 1, chantierId: null, etat: 'ok', notes: null },
    })
  })

  it('voit où sont les outils et ce qu’en dit la dernière vérification', async () => {
    etat.locale = 'fr'
    reponses.get = {
      ...contexteChef(), gestion: true, lieux: [{ id: VILLA, titre: 'Moradia Gaia', statut: 'En cours' }],
      verifications: [{
        id: 'v1', chantierId: VILLA, chantierTitre: 'Moradia Gaia', vendredi: '2026-11-20', le: '2026-11-20T16:00:00Z', par: 'Paulo',
        manquants: 1, enPanne: 0, observations: null,
        lignes: [{ outilId: BETONEIRA, nom: 'Betoneira', type: 'outil', reference: null, attendus: 1, presents: 0, enPanne: false, remarque: null }],
      }],
    }
    render(<OutillageSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Répertoire' }))
    expect(screen.getAllByText('Moradia Gaia').length).toBeGreaterThan(0)
    expect(screen.getByText(/Manquant · vendredi 20\/11/)).toBeTruthy()
  })
})
