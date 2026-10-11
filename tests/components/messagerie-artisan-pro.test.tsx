// tests/components/messagerie-artisan-pro.test.tsx
//
// Messagerie > Pro des tableaux de bord Artisan ET BTP (MessagerieArtisan, branches V5 et
// legacy). Démo Marseille : le syndic qui valide la mission et le prestataire qui la reçoit
// sont le MÊME compte (même user id). On vérifie :
//   - l'ordre de mission reçu affiche Accepter / Refuser (il vient du donneur d'ordre) ;
//   - les réponses du prestataire (metadata.cote 'artisan') s'affichent comme les siennes,
//     celles du syndic (cote 'donneur_ordre') comme reçues ;
//   - « Envoyer un document » poste le message 'text' + metadata.document du contrat ;
//   - un document s'affiche en carte.

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'

const h = vi.hoisted(() => ({
  toast: { error: vi.fn(), success: vi.fn() },
  conversations: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
  appels: [] as Array<{ url: string; method: string; body?: Record<string, unknown> }>,
}))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'fr' }),
  useLocale: () => 'fr',
}))
vi.mock('@/lib/supabase', () => {
  const canal: Record<string, unknown> = {}
  canal.on = () => canal
  return {
    supabase: {
      auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })) },
      channel: vi.fn(() => canal),
      removeChannel: vi.fn(),
      from: vi.fn(),
    },
  }
})
vi.mock('@/lib/realtime-reconnect', () => ({ subscribeWithReconnect: vi.fn() }))
vi.mock('sonner', () => ({ toast: h.toast }))

import MessagerieArtisan from '@/components/dashboard/MessagerieArtisan'

const MOI = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const CONV = '55555555-5555-4555-8555-555555555555'
const ARTISAN = { id: 'profil-1', user_id: MOI, company_name: 'Plomberie Fred' }

const conversationPro = {
  id: CONV, artisan_id: MOI, contact_id: MOI, contact_type: 'pro', contact_name: 'Cabinet Frédéric',
  contact_avatar: '', last_message_at: '2026-10-11T09:00:00Z', last_message_preview: 'Ordre de mission', unread_count: 1, created_at: '2026-10-11T08:00:00Z',
}

const msg = (id: string, sender: string, type: string, content: string, metadata: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  id, conversation_id: CONV, sender_id: sender, type, content, metadata, read: false, created_at: '2026-10-11T09:00:00Z', ...extra,
})

const ORDRE = msg('m1', MOI, 'ordre_mission', 'Fuite colonne EF', {}, {
  ordre_mission: { titre: 'Plomberie', adresse: '12 rue Paradis', date_souhaitee: '2026-10-13', description: 'Fuite colonne EF', urgence: 'normale', statut: 'en_attente' },
})
const DU_SYNDIC = msg('m2', MOI, 'text', 'Merci de passer avant midi', { cote: 'donneur_ordre' })
const DE_MOI = msg('m3', MOI, 'text', 'Je passe demain matin', { cote: 'artisan' })
const DOC = msg('m4', MOI, 'text', '📄 Devis D-2026-014 — 640,00 € TTC — Remplacement colonne EF', {
  cote: 'artisan',
  document: { type: 'devis', reference: 'D-2026-014', montant_ttc: 640, description: 'Remplacement colonne EF', date: '2026-10-12' },
})

const reponse = (data: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => data }) as Response

beforeEach(() => {
  localStorage.clear()
  h.appels.length = 0
  h.toast.error.mockClear()
  h.toast.success.mockClear()
  h.conversations = [conversationPro]
  h.messages = [ORDRE, DU_SYNDIC, DE_MOI, DOC]
  Element.prototype.scrollIntoView = vi.fn()
  globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    const method = init?.method || 'GET'
    h.appels.push({ url: u, method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method !== 'GET') return reponse({ success: true, message: {}, conversation_id: CONV })
    if (u.includes('conversation_id=')) return reponse({ messages: h.messages })
    if (u.includes('contact_type=pro')) return reponse({ conversations: h.conversations.filter(c => c.contact_type === 'pro') })
    return reponse({ conversations: h.conversations.filter(c => c.contact_type === 'particulier') })
  }) as typeof fetch
})

async function ouvrirConversation(orgRole: string, props: Partial<React.ComponentProps<typeof MessagerieArtisan>> = {}, nom = 'Cabinet Frédéric') {
  const vue = render(<MessagerieArtisan artisan={ARTISAN} orgRole={orgRole} {...props} />)
  fireEvent.click(await screen.findByText(nom))
  await screen.findByText('Je passe demain matin')
  return vue
}

const postsMessagerie = () => h.appels.filter(a => a.url === '/api/pro/messagerie' && a.method === 'POST')

describe('MessagerieArtisan — même compte syndic / prestataire', () => {
  for (const orgRole of ['artisan', 'pro_societe']) {
    it(`${orgRole} (V5) : l'ordre reçu propose Accepter / Refuser, côtés corrects`, async () => {
      await ouvrirConversation(orgRole)
      expect(screen.getByRole('button', { name: /proDash\.messagerie\.accepter/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /proDash\.messagerie\.refuser/ })).toBeInTheDocument()

      // Ma réponse : bulle « own » ; message du syndic : bulle reçue
      expect(screen.getByText('Je passe demain matin').closest('.v5-msg-cb')).toHaveClass('own')
      const recu = screen.getByText('Merci de passer avant midi').closest('.v5-msg-cb') as HTMLElement
      expect(recu).not.toHaveClass('own')
      expect(within(recu).getByText(/Cabinet Frédéric/)).toHaveTextContent('proDash.messagerie.donneurOrdres')

      // Document en carte
      const carte = screen.getByTestId('carte-document-pro')
      expect(carte).toHaveTextContent('Devis')
      expect(carte).toHaveTextContent('D-2026-014')
      expect(carte).toHaveTextContent('640,00 € TTC')
      expect(carte.closest('.v5-msg-cb')).toHaveClass('own')
    })
  }

  it("legacy (rôle non V5) : mêmes règles de côté, ordre actionnable", async () => {
    await ouvrirConversation('pro_gestionnaire')
    expect(screen.getByRole('button', { name: /proDash\.messagerie\.accepter/ })).toBeInTheDocument()
    expect(screen.getByText('Je passe demain matin').closest('.v22-msg-bubble-row')).toHaveClass('own')
    expect(screen.getByText('Merci de passer avant midi').closest('.v22-msg-bubble-row')).not.toHaveClass('own')
    expect(screen.getByTestId('carte-document-pro')).toHaveTextContent('Remplacement colonne EF')
  })

  it('Refuser envoie le PATCH sur l\'ordre (même user id)', async () => {
    await ouvrirConversation('artisan')
    fireEvent.click(screen.getByRole('button', { name: /proDash\.messagerie\.refuser/ }))
    await waitFor(() => expect(h.appels.some(a => a.method === 'PATCH')).toBe(true))
    expect(h.appels.find(a => a.method === 'PATCH')?.body).toMatchObject({ message_id: 'm1', action: 'refuse', artisan_user_id: MOI })
  })

  it("réponse texte : envoyée avec metadata.cote 'artisan'", async () => {
    await ouvrirConversation('artisan')
    fireEvent.change(screen.getByPlaceholderText('proDash.messagerie.ecrireMessage'), { target: { value: 'Bien reçu' } })
    fireEvent.keyDown(screen.getByPlaceholderText('proDash.messagerie.ecrireMessage'), { key: 'Enter' })
    await waitFor(() => expect(postsMessagerie()).toHaveLength(1))
    expect(postsMessagerie()[0].body).toMatchObject({ content: 'Bien reçu', type: 'text', sender_id: MOI, metadata: { cote: 'artisan' } })
  })
})

describe('MessagerieArtisan — Envoyer un document', () => {
  const ouvrirFormulaire = async (choix: RegExp, orgRole = 'artisan', props = {}) => {
    await ouvrirConversation(orgRole, props)
    const barre = screen.getByRole('group', { name: 'proDash.messagerie.envoyerDocument' })
    fireEvent.click(within(barre).getByRole('button', { name: choix }))
    return screen.getByRole('dialog')
  }

  it('devis : poste un message text avec le résumé et metadata { cote, document }', async () => {
    const dialogue = await ouvrirFormulaire(/Devis/)
    fireEvent.change(within(dialogue).getByLabelText('proDash.messagerie.docReference'), { target: { value: 'D-2026-014' } })
    fireEvent.change(within(dialogue).getByLabelText('proDash.messagerie.docMontantTtc'), { target: { value: '640' } })
    fireEvent.change(within(dialogue).getByLabelText('proDash.messagerie.docDescription'), { target: { value: 'Remplacement colonne EF' } })
    fireEvent.change(within(dialogue).getByLabelText('proDash.messagerie.docDate'), { target: { value: '2026-10-12' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: /proDash\.messagerie\.docEnvoyer/ }))

    await waitFor(() => expect(postsMessagerie()).toHaveLength(1))
    expect(postsMessagerie()[0].body).toEqual({
      artisan_user_id: MOI,
      contact_id: MOI,
      sender_id: MOI,
      contact_type: 'pro',
      contact_name: 'Plomberie Fred',
      content: '📄 Devis D-2026-014 — 640,00 € TTC — Remplacement colonne EF',
      type: 'text',
      metadata: {
        cote: 'artisan',
        document: { type: 'devis', reference: 'D-2026-014', montant_ttc: 640, description: 'Remplacement colonne EF', date: '2026-10-12' },
      },
    })
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('proDash.messagerie.docEnvoye'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it("rapport d'intervention : pas de montant, compte rendu", async () => {
    const dialogue = await ouvrirFormulaire(/Rapport d'intervention/, 'pro_societe')
    expect(within(dialogue).queryByLabelText('proDash.messagerie.docMontantTtc')).not.toBeInTheDocument()
    fireEvent.change(within(dialogue).getByLabelText('proDash.messagerie.docReference'), { target: { value: 'R-7' } })
    fireEvent.change(within(dialogue).getByLabelText('proDash.messagerie.docCompteRendu'), { target: { value: 'Colonne remplacée, essais OK' } })
    fireEvent.change(within(dialogue).getByLabelText('proDash.messagerie.docDate'), { target: { value: '2026-10-12' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: /proDash\.messagerie\.docEnvoyer/ }))

    await waitFor(() => expect(postsMessagerie()).toHaveLength(1))
    const corps = postsMessagerie()[0].body as { content: string; metadata: { document: Record<string, unknown> } }
    expect(corps.metadata.document).toEqual({ type: 'rapport', reference: 'R-7', description: 'Colonne remplacée, essais OK', date: '2026-10-12' })
    expect(corps.content).toBe("📝 Rapport d'intervention R-7 — Colonne remplacée, essais OK")
  })

  it('champs invalides (montant manquant) : rien n’est envoyé, toast et champ signalé', async () => {
    const dialogue = await ouvrirFormulaire(/Facture/)
    fireEvent.change(within(dialogue).getByLabelText('proDash.messagerie.docReference'), { target: { value: 'F-2026-003' } })
    fireEvent.change(within(dialogue).getByLabelText('proDash.messagerie.docDescription'), { target: { value: 'Colonne EF' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: /proDash\.messagerie\.docEnvoyer/ }))

    expect(h.toast.error).toHaveBeenCalledWith('proDash.messagerie.docChampsInvalides')
    expect(within(dialogue).getByLabelText('proDash.messagerie.docMontantTtc')).toHaveAttribute('aria-invalid', 'true')
    expect(postsMessagerie()).toHaveLength(0)
  })

  it('pré-remplissage depuis un devis enregistré (référence, montant TTC, description, date)', async () => {
    const devis = {
      id: 'd1', docType: 'devis', docNumber: 'D-2026-014', docTitle: 'Remplacement colonne EF', docDate: '2026-10-12', status: 'envoye',
      lines: [{ description: 'Colonne', totalHT: 533.33, tvaRate: 20 }],
    }
    const dialogue = await ouvrirFormulaire(/Devis/, 'artisan', { documentsEnregistres: [devis] })
    fireEvent.change(within(dialogue).getByLabelText('proDash.messagerie.docPreRemplir'), { target: { value: 'd1' } })
    expect(within(dialogue).getByLabelText('proDash.messagerie.docReference')).toHaveValue('D-2026-014')
    expect(within(dialogue).getByLabelText('proDash.messagerie.docMontantTtc')).toHaveValue('640,00')
    expect(within(dialogue).getByLabelText('proDash.messagerie.docDescription')).toHaveValue('Remplacement colonne EF')

    fireEvent.click(within(dialogue).getByRole('button', { name: /proDash\.messagerie\.docEnvoyer/ }))
    await waitFor(() => expect(postsMessagerie()).toHaveLength(1))
    expect(postsMessagerie()[0].body).toMatchObject({
      metadata: { document: { type: 'devis', reference: 'D-2026-014', montant_ttc: 640, date: '2026-10-12' } },
    })
  })

  it('échec serveur : formulaire conservé et toast d’erreur', async () => {
    const dialogue = await ouvrirFormulaire(/Devis/)
    globalThis.fetch = vi.fn(async () => reponse({ error: 'x' }, false)) as typeof fetch
    fireEvent.change(within(dialogue).getByLabelText('proDash.messagerie.docReference'), { target: { value: 'D-1' } })
    fireEvent.change(within(dialogue).getByLabelText('proDash.messagerie.docMontantTtc'), { target: { value: '12,5' } })
    fireEvent.change(within(dialogue).getByLabelText('proDash.messagerie.docDescription'), { target: { value: 'x' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: /proDash\.messagerie\.docEnvoyer/ }))
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('proDash.messagerie.docErreurEnvoi'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('conversation avec un particulier : pas de barre « Envoyer un document »', async () => {
    h.conversations = [{ ...conversationPro, id: 'conv-part', contact_type: 'particulier', contact_name: 'Mme Martin' }]
    await ouvrirConversation('artisan', {}, 'Mme Martin')
    expect(screen.queryByRole('group', { name: 'proDash.messagerie.envoyerDocument' })).not.toBeInTheDocument()
  })
})
