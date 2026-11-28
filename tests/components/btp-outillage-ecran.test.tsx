// tests/components/btp-outillage-ecran.test.tsx — écran « Ferramentas e viaturas » (société BTP, 26/11/2026) :
// ce que voit l'encarregado (sa vérification du vendredi, pas le répertoire), ce qu'il envoie, ce que voit le gérant.
// Serveur simulé : fetch remplacé, réponses de /api/btp/outillage écrites ici.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    { id: BETONEIRA, type: 'outil', categorie: null, nom: 'Betoneira', reference: null, quantite: 1, chantierId: VILLA, etat: 'ok', notes: null, surPlaceDepuis: '2026-11-20' },
    { id: ESCADOTES, type: 'outil', categorie: null, nom: 'Escadotes', reference: null, quantite: 4, chantierId: VILLA, etat: 'ok', notes: null, surPlaceDepuis: '2026-11-20' },
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
    fireEvent.change(screen.getByRole('combobox', { name: /Catégorie/ }), { target: { value: 'vehicule' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Nom/ }), { target: { value: 'Camionnette Master' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Immatriculation' }), { target: { value: 'AA-00-BB' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toEqual({
      action: 'creer',
      outil: { type: 'vehicule', categorie: null, nom: 'Camionnette Master', reference: 'AA-00-BB', quantite: 1, chantierId: null, etat: 'ok', notes: null },
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

describe('Inventário por categorias e pesquisa (28/11/2026)', () => {
  const ANDAIME = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d11'
  const CORTE = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d12'
  const MARTELO = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d13'
  const CARRINHA = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d14'
  const contexteGerente = (): ContexteOutillage => ({
    ...contexteChef(), gestion: true, lieux: [{ id: VILLA, titre: 'Moradia Gaia', statut: 'En cours' }],
    outils: [
      { id: ANDAIME, type: 'outil', categorie: 'echafaudage', nom: 'Andaime de fachada', reference: null, quantite: 1, chantierId: VILLA, etat: 'ok', notes: null, surPlaceDepuis: '2026-11-20' },
      { id: CORTE, type: 'outil', categorie: 'machines', nom: 'Máquina de corte', reference: 'MC-01', quantite: 1, chantierId: null, etat: 'ok', notes: null, surPlaceDepuis: '2026-11-20' },
      { id: MARTELO, type: 'outil', categorie: 'main', nom: 'Martelo', reference: null, quantite: 3, chantierId: VILLA, etat: 'ok', notes: null, surPlaceDepuis: '2026-11-20' },
      { id: CARRINHA, type: 'vehicule', categorie: null, nom: 'Carrinha Master', reference: 'AA-00-BB', quantite: 1, chantierId: null, etat: 'ok', notes: null, surPlaceDepuis: '2026-11-20' },
      { id: BETONEIRA, type: 'outil', categorie: null, nom: 'Betoneira', reference: null, quantite: 1, chantierId: VILLA, etat: 'ok', notes: null, surPlaceDepuis: '2026-11-20' },
    ],
  })
  const lignesAffichees = () => screen.getAllByRole('row').map(r => r.textContent ?? '')
  const abrirInventario = async () => {
    reponses.get = contexteGerente()
    render(<OutillageSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Inventário' }))
  }

  it('arruma o inventário por categoria, pela ordem fixa, viaturas e « Sem categoria » no fim', async () => {
    await abrirInventario()
    const titulos = screen.getAllByRole('rowheader').map(c => (c.textContent ?? '').trim())
    expect(titulos).toEqual([
      '🔨 Ferramentas de mão (1)', '🏗️ Andaimes e escadas (1)', '⚙️ Máquinas e equipamentos (1)', '🚐 Viaturas (1)', '🔧 Sem categoria (1)',
    ])
    expect(screen.getByText('1 ferramenta ainda sem categoria: escolha-a em « Editar ».')).toBeTruthy()
  })

  it('filtra por categoria com os botões, e volta a « Tudo »', async () => {
    await abrirInventario()
    fireEvent.click(screen.getByRole('button', { name: 'Andaimes e escadas (1)' }))
    expect(screen.getByRole('button', { name: 'Andaimes e escadas (1)' }).getAttribute('aria-pressed')).toBe('true')
    expect(lignesAffichees().some(t => t.includes('Andaime de fachada'))).toBe(true)
    expect(lignesAffichees().some(t => t.includes('Martelo'))).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Tudo (5)' }))
    expect(lignesAffichees().some(t => t.includes('Martelo'))).toBe(true)
  })

  it('pesquisa pelo nome sem acentos, e conta o que encontra em cada categoria', async () => {
    await abrirInventario()
    const pesquisa = screen.getByRole('searchbox', { name: 'Procurar no inventário' })
    fireEvent.change(pesquisa, { target: { value: 'maquina' } })
    expect(lignesAffichees().some(t => t.includes('Máquina de corte'))).toBe(true)
    expect(lignesAffichees().some(t => t.includes('Martelo'))).toBe(false)
    expect(screen.getByRole('button', { name: 'Tudo (1)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ferramentas de mão (0)' })).toBeTruthy()
    // O nome da categoria também se procura.
    fireEvent.change(pesquisa, { target: { value: 'andaimes' } })
    expect(lignesAffichees().some(t => t.includes('Andaime de fachada'))).toBe(true)
    fireEvent.change(pesquisa, { target: { value: 'rebarbadora' } })
    expect(screen.getByText('Nenhum elemento corresponde à pesquisa.')).toBeTruthy()
  })

  it('uma ferramenta nova pede a categoria antes de guardar, e envia-a', async () => {
    await abrirInventario()
    reponses.post = { status: 201, corps: { outil: {} } }
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Nome/ }), { target: { value: 'Nível laser' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(toast.error).toHaveBeenCalledWith('Escolha a categoria da ferramenta.')
    expect(envois).toHaveLength(0)
    fireEvent.change(screen.getByRole('combobox', { name: /Categoria/ }), { target: { value: 'mesure' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({ action: 'creer', outil: { type: 'outil', categorie: 'mesure', nom: 'Nível laser' } })
  })

  it('com uma categoria escolhida no filtro, o novo elemento já vem nela', async () => {
    await abrirInventario()
    fireEvent.click(screen.getByRole('button', { name: 'Máquinas e equipamentos (1)' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar' }))
    expect((screen.getByRole('combobox', { name: /Categoria/ }) as HTMLSelectElement).value).toBe('machines')
  })

  it('editar uma ferramenta já classificada guarda a sua categoria', async () => {
    await abrirInventario()
    reponses.post = { status: 200, corps: { outil: {} } }
    const linha = screen.getAllByRole('row').find(r => r.textContent?.includes('Martelo')) as HTMLElement
    fireEvent.click(within(linha).getByRole('button', { name: 'Editar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({ action: 'modifier', id: MARTELO, outil: { type: 'outil', categorie: 'main', quantite: 3 } })
  })
})

describe('Verificação de sexta: lista por categoria, pesquisa numa obra grande', () => {
  it('títulos por categoria quando há várias; pesquisa a partir de 9 elementos, que só esconde', async () => {
    const muitos = Array.from({ length: 9 }, (_, i) => ({
      id: `6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8e${String(i).padStart(2, '0')}`, type: 'outil' as const,
      categorie: i < 3 ? 'echafaudage' as const : 'main' as const, nom: i < 3 ? `Andaime ${i}` : `Colher ${i}`,
      reference: null, quantite: 1, chantierId: VILLA, etat: 'ok' as const, notes: null, surPlaceDepuis: '2026-11-20',
    }))
    reponses.get = { ...contexteChef(), outils: muitos }
    render(<OutillageSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Verificar agora' }))
    expect(screen.getByRole('group', { name: 'Ferramentas de mão (6)' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Andaimes e escadas (3)' })).toBeTruthy()
    const pesquisa = screen.getByRole('searchbox', { name: 'Procurar nesta obra' })
    fireEvent.change(pesquisa, { target: { value: 'andaime 1' } })
    expect(screen.getAllByRole('button', { name: '✔ Presente' })).toHaveLength(1)
    expect(screen.getByText('Falta marcar 9 elementos.')).toBeTruthy()
    fireEvent.change(pesquisa, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Marcar tudo presente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Validar a verificação' }))
    await waitFor(() => expect(envois).toHaveLength(1))
    // Mesma ordem que o ecrã: ferramentas de mão primeiro, depois andaimes.
    expect((envois[0].lignes as Array<Record<string, unknown>>).map(l => l.outilId)).toEqual([...muitos.slice(3), ...muitos.slice(0, 3)].map(o => o.id))
  })

  it('obra pequena, uma só categoria: nem títulos nem pesquisa', async () => {
    render(<OutillageSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Verificar agora' }))
    expect(screen.queryByRole('searchbox')).toBeNull()
    // Uma só categoria: o título fica só para os leitores de ecrã.
    expect(screen.getByText(/Sem categoria \(/).className).toBe('sr-only')
  })
})

describe('Depois da relecture: pesquisa e filtros nunca enganam', () => {
  const nove = () => Array.from({ length: 9 }, (_, i) => ({
    id: `6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8f${String(i).padStart(2, '0')}`, type: 'outil' as const,
    categorie: i < 3 ? 'echafaudage' as const : 'main' as const, nom: i < 3 ? `Andaime ${i}` : `Colher ${i}`,
    reference: null, quantite: 1, chantierId: VILLA, etat: 'ok' as const, notes: null, surPlaceDepuis: '2026-11-20',
  }))

  it('durante uma pesquisa, o botão só marca os elementos visíveis', async () => {
    reponses.get = { ...contexteChef(), outils: nove() }
    render(<OutillageSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Verificar agora' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Procurar nesta obra' }), { target: { value: 'andaime' } })
    fireEvent.click(screen.getByRole('button', { name: 'Marcar os 3 visíveis como presentes' }))
    expect(screen.getByText('Falta marcar 6 elementos.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Validar a verificação' }) as HTMLButtonElement).disabled).toBe(true)
    expect(envois).toHaveLength(0)
  })

  it('lista recarregada mais curta (lista mudada): já sem campo de pesquisa, nada fica escondido', async () => {
    reponses.get = { ...contexteChef(), outils: nove() }
    reponses.post = { status: 409, corps: { error: 'liste_changee' } }
    render(<OutillageSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Verificar agora' }))
    fireEvent.click(screen.getByRole('button', { name: 'Marcar tudo presente' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Procurar nesta obra' }), { target: { value: 'andaime 1' } })
    reponses.get = { ...contexteChef(), outils: nove().slice(1) }
    fireEvent.click(screen.getByRole('button', { name: 'Validar a verificação' }))
    await waitFor(() => expect(screen.queryByRole('searchbox')).toBeNull())
    expect(screen.getAllByRole('listitem')).toHaveLength(8)
  })

  it('filtro em « Sem categoria »: classificada a última, o ecrã volta a « Tudo » em vez de ficar vazio', async () => {
    const semCategoria = { ...contexteChef(), gestion: true, lieux: [{ id: VILLA, titre: 'Moradia Gaia', statut: 'En cours' }] }
    reponses.get = semCategoria
    reponses.post = { status: 200, corps: { outil: {} } }
    render(<OutillageSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Inventário' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sem categoria (2)' }))
    // As duas já classificadas no servidor quando o ecrã recarrega.
    reponses.get = { ...semCategoria, outils: semCategoria.outils.map(o => ({ ...o, categorie: 'machines' as const })) }
    const linha = screen.getAllByRole('row').find(r => r.textContent?.includes('Betoneira')) as HTMLElement
    fireEvent.click(within(linha).getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByRole('combobox', { name: /Categoria/ }), { target: { value: 'machines' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tudo (2)' }).getAttribute('aria-pressed')).toBe('true'))
    expect(screen.queryByRole('button', { name: /Sem categoria/ })).toBeNull()
    expect(screen.queryByText('Nenhum elemento corresponde à pesquisa.')).toBeNull()
  })

  it('uma ferramenta antiga sem categoria pode ser editada (mudar de obra, avariada) sem escolher categoria', async () => {
    reponses.get = { ...contexteChef(), gestion: true, lieux: [{ id: VILLA, titre: 'Moradia Gaia', statut: 'En cours' }] }
    reponses.post = { status: 200, corps: { outil: {} } }
    render(<OutillageSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Inventário' }))
    const linha = screen.getAllByRole('row').find(r => r.textContent?.includes('Betoneira')) as HTMLElement
    fireEvent.click(within(linha).getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Estado' }), { target: { value: 'en_panne' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({ action: 'modifier', id: BETONEIRA, outil: { type: 'outil', categorie: null, etat: 'en_panne' } })
    expect(toast.error).not.toHaveBeenCalled()
  })
})
