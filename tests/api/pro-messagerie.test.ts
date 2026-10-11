// tests/api/pro-messagerie.test.ts
//
// /api/pro/messagerie — côté prestataire (tableaux de bord Artisan ET BTP).
// Démo : le super admin impersonne 'artisan' ou 'pro_societe' (même user id que le
// syndic donneur d'ordre). On vérifie :
//   - PATCH : contrôle de propriété de l'ordre (IDOR), message système au nom du
//     prestataire avec metadata.cote = 'artisan', enchaînement des statuts, suivi de la
//     mission syndic liée ;
//   - POST : sender_id forcé, metadata.cote = 'artisan', documents (devis / rapport /
//     facture) réservés aux conversations Pro ;
//   - GET : messages d'une conversation seulement si elle appartient au prestataire.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Filtre = [string, string, unknown]
type Appel = {
  table: string
  op: 'select' | 'insert' | 'update'
  colonnes?: string
  payload?: Record<string, unknown>
  filtres: Filtre[]
}
type Reponse = { data: unknown; error: unknown }

const h = vi.hoisted(() => {
  const appels: Appel[] = []
  const etat = {
    user: null as null | { id: string; email: string; app_metadata: Record<string, unknown> },
    repondre: (_a: Appel): Reponse => ({ data: null, error: null }),
  }
  const from = (table: string) => {
    const appel: Appel = { table, op: 'select', filtres: [] }
    appels.push(appel)
    const b: Record<string, unknown> = {}
    b.select = (cols?: string) => { if (appel.op === 'select') appel.colonnes = cols; return b }
    b.insert = (p: Record<string, unknown>) => { appel.op = 'insert'; appel.payload = p; return b }
    b.update = (p: Record<string, unknown>) => { appel.op = 'update'; appel.payload = p; return b }
    for (const m of ['eq', 'neq', 'in']) b[m] = (col: string, val: unknown) => { appel.filtres.push([m, col, val]); return b }
    for (const m of ['order', 'limit']) b[m] = () => b
    b.single = () => Promise.resolve(etat.repondre(appel))
    b.maybeSingle = () => Promise.resolve(etat.repondre(appel))
    b.then = (ok: (v: Reponse) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(etat.repondre(appel)).then(ok, ko)
    return b
  }
  return { appels, etat, from }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => h.etat.user),
  getUserRole: vi.fn((u: { app_metadata?: { role?: string } }) => u?.app_metadata?.role || ''),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => h.from(t) } }))

const { GET, POST, PATCH } = await import('@/app/api/pro/messagerie/route')

// Compte unique de la démo : super admin qui impersonne le prestataire
const MOI = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const AUTRE_ARTISAN = '44444444-4444-4444-8444-444444444444'
const CONV = '55555555-5555-4555-8555-555555555555'
const MSG = '66666666-6666-4666-8666-666666666666'
const MISSION_SYNDIC = '77777777-7777-4777-8777-777777777777'
const SIGNALEMENT = '88888888-8888-4888-8888-888888888888'

const impersonne = (role: string) => {
  h.etat.user = { id: MOI, email: 'frederic@exemple.fr', app_metadata: { role, _admin_override: true, _original_role: 'super_admin' } }
}

const requete = (method: 'GET' | 'POST' | 'PATCH', corps?: unknown, url = 'https://vitfix.io/api/pro/messagerie') =>
  new NextRequest(url, {
    method,
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    ...(corps !== undefined ? { body: JSON.stringify(corps) } : {}),
  })

const appelsSur = (table: string, op?: Appel['op']) => h.appels.filter(a => a.table === table && (!op || a.op === op))
const filtre = (a: Appel, col: string) => a.filtres.find(([, c]) => c === col)?.[2]

// Ordre de mission tel qu'écrit à la validation dans le Syndic v54
const ordre = (statut: string, artisanConv = MOI) => ({
  id: MSG,
  conversation_id: CONV,
  sender_id: MOI,
  type: 'ordre_mission',
  content: 'Fuite colonne EF',
  ordre_mission: {
    titre: 'Plomberie', adresse: '12 rue Paradis, Marseille', date_souhaitee: '2026-10-13',
    description: 'Fuite colonne EF', urgence: 'normale', statut,
    mission_id: null, signalement_id: SIGNALEMENT, syndic_mission_id: MISSION_SYNDIC,
  },
  metadata: { cote: 'donneur_ordre' },
  conversations: { artisan_id: artisanConv, contact_id: MOI, contact_name: 'Cabinet Frédéric' },
})

beforeEach(() => {
  h.appels.length = 0
  h.etat.repondre = () => ({ data: null, error: null })
  impersonne('artisan')
})

describe('PATCH /api/pro/messagerie — ordre de mission', () => {
  for (const role of ['artisan', 'pro_societe']) {
    it(`${role} (super admin impersonné, même compte que le syndic) : accepte → message système cote 'artisan' + mission syndic acceptée`, async () => {
      impersonne(role)
      h.etat.repondre = a => (a.table === 'conversation_messages' && a.op === 'select' ? { data: ordre('en_attente'), error: null } : { data: null, error: null })

      const res = await PATCH(requete('PATCH', {
        message_id: MSG, action: 'accepte', artisan_user_id: MOI, artisan_name: 'Plomberie Fred', arrival_time: '09:30', duration_hours: '2',
      }))
      expect(res.status).toBe(200)

      const majOrdre = appelsSur('conversation_messages', 'update')[0]
      expect(majOrdre.payload?.ordre_mission).toMatchObject({ statut: 'accepte', arrival_time: '09:30', duration_minutes: 120, syndic_mission_id: MISSION_SYNDIC })

      const systeme = appelsSur('conversation_messages', 'insert')[0]
      expect(systeme.payload).toMatchObject({
        conversation_id: CONV, sender_id: MOI, type: 'system',
        metadata: { cote: 'artisan', ordre_message_id: MSG, statut: 'accepte' },
      })
      expect(String(systeme.payload?.content)).toContain('Mission acceptée')

      const mission = appelsSur('syndic_missions', 'update')[0]
      expect(mission.payload).toMatchObject({ statut: 'acceptee' })
      expect(filtre(mission, 'id')).toBe(MISSION_SYNDIC)
      expect(filtre(mission, 'cabinet_id')).toBe(MOI)
    })
  }

  // Réponse type d'une base où le signalement du cabinet existe
  const avecSignalement = (statut: string) => (a: Appel): Reponse => {
    if (a.table === 'conversation_messages' && a.op === 'select') return { data: ordre(statut), error: null }
    if (a.table === 'syndic_signalements' && a.op === 'update') return { data: { id: SIGNALEMENT }, error: null }
    return { data: null, error: null }
  }

  it('accepte : la demande du copropriétaire suit (acceptee) et le fil de la demande reprend le message d’acceptation', async () => {
    h.etat.repondre = avecSignalement('en_attente')
    const res = await PATCH(requete('PATCH', { message_id: MSG, action: 'accepte', artisan_name: 'Plomberie Fred', arrival_time: '09:30' }))
    expect(res.status).toBe(200)

    const sig = appelsSur('syndic_signalements', 'update')[0]
    expect(sig.payload).toMatchObject({ statut: 'acceptee' })
    expect(sig.payload).not.toHaveProperty('artisan_assigne')
    expect(filtre(sig, 'id')).toBe(SIGNALEMENT)
    expect(filtre(sig, 'cabinet_id')).toBe(MOI)

    const suivi = appelsSur('syndic_signalement_messages', 'insert')[0]
    expect(suivi.payload).toMatchObject({ signalement_id: SIGNALEMENT, auteur: 'Plomberie Fred', role: 'system' })
    expect(String(suivi.payload?.texte)).toContain('Mission acceptée — Plomberie Fred sera sur place')
  })

  it('démarrer / terminer : la demande passe en_cours puis terminee, avec une ligne dans son fil', async () => {
    h.etat.repondre = avecSignalement('accepte')
    expect((await PATCH(requete('PATCH', { message_id: MSG, action: 'en_cours', artisan_name: 'Plomberie Fred' }))).status).toBe(200)
    expect(appelsSur('syndic_signalements', 'update')[0].payload).toMatchObject({ statut: 'en_cours' })
    expect(appelsSur('syndic_signalement_messages', 'insert')[0].payload).toMatchObject({ texte: "Plomberie Fred a démarré l'intervention." })

    h.appels.length = 0
    h.etat.repondre = avecSignalement('en_cours')
    expect((await PATCH(requete('PATCH', { message_id: MSG, action: 'termine', artisan_name: 'Plomberie Fred' }))).status).toBe(200)
    expect(appelsSur('syndic_signalements', 'update')[0].payload).toMatchObject({ statut: 'terminee' })
    expect(appelsSur('syndic_signalement_messages', 'insert')[0].payload).toMatchObject({ texte: "Plomberie Fred a terminé l'intervention." })
  })

  it('refus : mission annulée, demande remise en attente sans prestataire (le syndic peut la confier à nouveau)', async () => {
    h.etat.repondre = avecSignalement('en_attente')
    expect((await PATCH(requete('PATCH', { message_id: MSG, action: 'refuse', artisan_name: 'Plomberie Fred' }))).status).toBe(200)

    const mission = appelsSur('syndic_missions', 'update')[0]
    expect(mission.payload).toMatchObject({ statut: 'annulee' })
    expect(filtre(mission, 'cabinet_id')).toBe(MOI)

    const sig = appelsSur('syndic_signalements', 'update')[0]
    expect(sig.payload).toMatchObject({ statut: 'en_attente', artisan_assigne: null })
    expect(filtre(sig, 'cabinet_id')).toBe(MOI)
    expect(String(appelsSur('syndic_signalement_messages', 'insert')[0].payload?.texte)).toContain('a décliné la mission')
  })

  it("signalement absent du cabinet de la conversation : aucune ligne ajoutée à son fil", async () => {
    h.etat.repondre = a => (a.table === 'conversation_messages' && a.op === 'select' ? { data: ordre('accepte'), error: null } : { data: null, error: null })
    expect((await PATCH(requete('PATCH', { message_id: MSG, action: 'en_cours' }))).status).toBe(200)
    expect(appelsSur('syndic_signalements', 'update')).toHaveLength(1)
    expect(appelsSur('syndic_signalement_messages')).toHaveLength(0)
  })

  it('ordre sans références syndic (assign-mission historique) : ni mission ni demande touchées', async () => {
    const sansRefs = ordre('en_attente')
    sansRefs.ordre_mission = { ...sansRefs.ordre_mission, signalement_id: undefined as unknown as string, syndic_mission_id: undefined as unknown as string }
    h.etat.repondre = a => (a.table === 'conversation_messages' && a.op === 'select' ? { data: sansRefs, error: null } : { data: null, error: null })
    expect((await PATCH(requete('PATCH', { message_id: MSG, action: 'refuse' }))).status).toBe(200)
    expect(appelsSur('syndic_missions')).toHaveLength(0)
    expect(appelsSur('syndic_signalements')).toHaveLength(0)
  })

  it("IDOR : l'ordre d'un AUTRE prestataire → 404, rien n'est modifié", async () => {
    h.etat.repondre = a => (a.table === 'conversation_messages' && a.op === 'select' ? { data: ordre('en_attente', AUTRE_ARTISAN), error: null } : { data: null, error: null })
    const res = await PATCH(requete('PATCH', { message_id: MSG, action: 'refuse' }))
    expect(res.status).toBe(404)
    expect(h.appels.filter(a => a.op !== 'select')).toHaveLength(0)
  })

  it('artisan_user_id du corps différent du compte connecté → 403', async () => {
    const res = await PATCH(requete('PATCH', { message_id: MSG, action: 'accepte', artisan_user_id: AUTRE_ARTISAN }))
    expect(res.status).toBe(403)
    expect(h.appels).toHaveLength(0)
  })

  it('enchaînement des statuts : un ordre déjà accepté ne se ré-accepte pas (409, pas de 2e message)', async () => {
    h.etat.repondre = a => (a.table === 'conversation_messages' && a.op === 'select' ? { data: ordre('accepte'), error: null } : { data: null, error: null })
    const res = await PATCH(requete('PATCH', { message_id: MSG, action: 'accepte', arrival_time: '09:00' }))
    expect(res.status).toBe(409)
    expect(h.appels.filter(a => a.op !== 'select')).toHaveLength(0)
  })

  it('démarrer puis terminer : statuts suivis sur la mission syndic ; refus → mission annulée', async () => {
    h.etat.repondre = a => (a.table === 'conversation_messages' && a.op === 'select' ? { data: ordre('accepte'), error: null } : { data: null, error: null })
    expect((await PATCH(requete('PATCH', { message_id: MSG, action: 'en_cours' }))).status).toBe(200)
    expect(appelsSur('syndic_missions', 'update')[0].payload).toMatchObject({ statut: 'en_cours' })
    expect(appelsSur('conversation_messages', 'insert')[0].payload).toMatchObject({ sender_id: MOI, metadata: { cote: 'artisan' } })

    h.appels.length = 0
    h.etat.repondre = a => (a.table === 'conversation_messages' && a.op === 'select' ? { data: ordre('en_cours'), error: null } : { data: null, error: null })
    expect((await PATCH(requete('PATCH', { message_id: MSG, action: 'termine' }))).status).toBe(200)
    expect(appelsSur('syndic_missions', 'update')[0].payload).toMatchObject({ statut: 'terminee' })

    h.appels.length = 0
    h.etat.repondre = a => (a.table === 'conversation_messages' && a.op === 'select' ? { data: ordre('en_attente'), error: null } : { data: null, error: null })
    expect((await PATCH(requete('PATCH', { message_id: MSG, action: 'refuse' }))).status).toBe(200)
    expect(appelsSur('syndic_missions', 'update')[0].payload).toMatchObject({ statut: 'annulee' })
    expect(appelsSur('conversation_messages', 'insert')[0].payload).toMatchObject({ metadata: { cote: 'artisan', statut: 'refuse' } })
  })

  it('corps invalide → 400 ; super admin non impersonné → 403 (rôle pro requis)', async () => {
    expect((await PATCH(requete('PATCH', { message_id: 'pas-un-uuid', action: 'accepte' }))).status).toBe(400)
    expect((await PATCH(requete('PATCH', { message_id: MSG, action: 'valider' }))).status).toBe(400)
    h.etat.user = { id: MOI, email: 'frederic@exemple.fr', app_metadata: { role: 'super_admin' } }
    expect((await PATCH(requete('PATCH', { message_id: MSG, action: 'accepte' }))).status).toBe(403)
  })
})

describe('POST /api/pro/messagerie — message du prestataire', () => {
  const convPro = (a: Appel): Reponse => {
    if (a.table === 'conversations' && a.op === 'select') return { data: { id: CONV, contact_type: 'pro' }, error: null }
    if (a.table === 'conversation_messages' && a.op === 'insert') return { data: { id: 'nouveau', ...a.payload }, error: null }
    return { data: null, error: null }
  }

  it("réponse texte : sender_id forcé au compte connecté et metadata.cote = 'artisan'", async () => {
    h.etat.repondre = convPro
    const res = await POST(requete('POST', {
      artisan_user_id: MOI, contact_id: MOI, contact_type: 'pro', content: 'Je passe demain', type: 'text',
      sender_id: '99999999-9999-4999-8999-999999999999',
    }))
    expect(res.status).toBe(200)
    const insert = appelsSur('conversation_messages', 'insert')[0]
    expect(insert.payload).toMatchObject({ conversation_id: CONV, sender_id: MOI, type: 'text', content: 'Je passe demain', metadata: { cote: 'artisan' } })
    // Plus de notification « message entrant » fabriquée par le prestataire
    expect(appelsSur('artisan_notifications')).toHaveLength(0)
  })

  it('document : message text, metadata.document conservé (montant arrondi au centime)', async () => {
    h.etat.repondre = convPro
    const document = { type: 'devis', reference: 'D-2026-014', montant_ttc: 640.004, description: 'Remplacement colonne EF', date: '2026-10-12' }
    const res = await POST(requete('POST', {
      artisan_user_id: MOI, contact_id: MOI, contact_type: 'pro', type: 'text',
      content: '📄 Devis D-2026-014 — 640,00 € TTC — Remplacement colonne EF',
      metadata: { cote: 'artisan', document },
    }))
    expect(res.status).toBe(200)
    const insert = appelsSur('conversation_messages', 'insert')[0]
    expect(insert.payload).toMatchObject({
      type: 'text', sender_id: MOI,
      content: '📄 Devis D-2026-014 — 640,00 € TTC — Remplacement colonne EF',
      metadata: { cote: 'artisan', document: { ...document, montant_ttc: 640 } },
    })
  })

  it('conversation cherchée par type (une paire peut avoir une conversation particulier ET pro) : la plus ancienne du type demandé', async () => {
    h.etat.repondre = convPro
    await POST(requete('POST', { artisan_user_id: MOI, contact_id: MOI, contact_type: 'pro', content: 'Bien reçu' }))
    const recherche = appelsSur('conversations', 'select')[0]
    expect(filtre(recherche, 'artisan_id')).toBe(MOI)
    expect(filtre(recherche, 'contact_id')).toBe(MOI)
    expect(filtre(recherche, 'contact_type')).toBe('pro')
    expect(appelsSur('conversations', 'insert')).toHaveLength(0)

    h.appels.length = 0
    await POST(requete('POST', { artisan_user_id: MOI, contact_id: AUTRE_ARTISAN, content: 'Bonjour' }))
    expect(filtre(appelsSur('conversations', 'select')[0], 'contact_type')).toBe('particulier')
  })

  it('erreur de lecture de la conversation → 500 journalisé, aucune conversation créée', async () => {
    h.etat.repondre = a => (a.table === 'conversations' && a.op === 'select' ? { data: null, error: { message: 'boom' } } : { data: null, error: null })
    const res = await POST(requete('POST', { artisan_user_id: MOI, contact_id: MOI, contact_type: 'pro', content: 'x' }))
    expect(res.status).toBe(500)
    expect(h.appels.filter(a => a.op !== 'select')).toHaveLength(0)
  })

  it('document sans texte : le résumé lisible est construit côté serveur', async () => {
    h.etat.repondre = convPro
    await POST(requete('POST', {
      artisan_user_id: MOI, contact_id: MOI, contact_type: 'pro',
      metadata: { document: { type: 'rapport', reference: 'R-7', description: 'Colonne remplacée', date: '2026-10-12' } },
    }))
    expect(appelsSur('conversation_messages', 'insert')[0].payload?.content).toBe("📝 Rapport d'intervention R-7 — Colonne remplacée")
  })

  it("document vers une conversation qui n'est pas Pro → 404, aucune conversation créée", async () => {
    h.etat.repondre = a => (a.table === 'conversations' && a.op === 'select' ? { data: { id: CONV, contact_type: 'particulier' }, error: null } : { data: null, error: null })
    const res = await POST(requete('POST', {
      artisan_user_id: MOI, contact_id: MOI, contact_type: 'pro',
      metadata: { document: { type: 'facture', reference: 'F-1', montant_ttc: 10, description: 'x', date: '2026-10-12' } },
    }))
    expect(res.status).toBe(404)
    expect(h.appels.filter(a => a.op !== 'select')).toHaveLength(0)
  })

  it("refuse un ordre de mission, un côté 'donneur_ordre' ou un document invalide (400)", async () => {
    h.etat.repondre = convPro
    const base = { artisan_user_id: MOI, contact_id: MOI, contact_type: 'pro', content: 'x' }
    expect((await POST(requete('POST', { ...base, type: 'ordre_mission' }))).status).toBe(400)
    expect((await POST(requete('POST', { ...base, metadata: { cote: 'donneur_ordre' } }))).status).toBe(400)
    expect((await POST(requete('POST', { ...base, metadata: { document: { type: 'devis', reference: 'D', montant_ttc: -1, description: 'x', date: '2026-10-12' } } }))).status).toBe(400)
    expect(appelsSur('conversation_messages', 'insert')).toHaveLength(0)
  })

  it('artisan_user_id différent du compte connecté → 403', async () => {
    const res = await POST(requete('POST', { artisan_user_id: AUTRE_ARTISAN, contact_id: MOI, content: 'x' }))
    expect(res.status).toBe(403)
  })
})

describe('GET /api/pro/messagerie — messages d\'une conversation', () => {
  const url = `https://vitfix.io/api/pro/messagerie?artisan_user_id=${MOI}&conversation_id=${CONV}`

  it("conversation d'un autre prestataire → 404, aucun message lu ni marqué lu", async () => {
    h.etat.repondre = () => ({ data: null, error: null })
    const res = await GET(requete('GET', undefined, url))
    expect(res.status).toBe(404)
    expect(appelsSur('conversation_messages')).toHaveLength(0)
    const controle = appelsSur('conversations', 'select')[0]
    expect(filtre(controle, 'id')).toBe(CONV)
    expect(filtre(controle, 'artisan_id')).toBe(MOI)
  })

  it('limite de débit GET : 240 requêtes / minute par compte (liste 8 s + fil 5 s + cloche)', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkRateLimit).mockClear()
    await GET(requete('GET', undefined, `https://vitfix.io/api/pro/messagerie?artisan_user_id=${MOI}&contact_type=pro`))
    expect(checkRateLimit).toHaveBeenCalledWith(`pro_msg_${MOI}`, 240, 60_000)
  })

  it('sa propre conversation → 200 avec les messages', async () => {
    h.etat.repondre = a => {
      if (a.table === 'conversations' && a.op === 'select') return { data: { id: CONV }, error: null }
      if (a.table === 'conversation_messages' && a.op === 'select') return { data: [ordre('en_attente')], error: null }
      return { data: null, error: null }
    }
    const res = await GET(requete('GET', undefined, url))
    expect(res.status).toBe(200)
    expect((await res.json()).messages).toHaveLength(1)
  })
})
