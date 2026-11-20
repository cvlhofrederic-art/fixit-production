// @vitest-environment node
// tests/api/devis-envoi-email.test.ts
//
// POST /api/devis/send-email — envoi d'un devis ou d'une facture en PDF au client, depuis l'adresse d'envoi de la
// plateforme (formulaire artisan, components/DevisFactureForm.tsx). Le serveur vérifie désormais ce qu'il envoie :
//   - compte : un compte professionnel (artisan ou société avec sa fiche ; conciergerie, gestionnaire et super admin,
//     rôles attribués par la plateforme seule, sans fiche) ;
//   - corps : une seule adresse valide, des champs de longueur bornée, un type de document connu ;
//   - pièce jointe : un PDF, de 10 Mo au plus ;
//   - contenu : chaque valeur saisie est échappée dans le HTML, l'objet tient sur une ligne ;
//   - volume : un plafond par compte et par 24 heures, en plus de la limite par minute.
// L'envoi ordinaire d'un devis depuis le formulaire reste accepté tel quel. Données fictives.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/** Taille maximale du PDF joint, en octets (10 Mo). */
const DIX_MO = 10 * 1024 * 1024

type Compte = { id: string; email: string; app_metadata: Record<string, unknown>; user_metadata: Record<string, unknown> }
type Envoi = { to: unknown; subject: string; html: string; attachments?: Array<{ filename: string; content: string }>; tags?: unknown }

const h = vi.hoisted(() => ({
  compte: null as unknown,
  compteCookie: null as unknown,
  fiches: [] as Array<{ id: string }>,
  erreurFiche: null as null | { message: string },
  lecturesFiche: [] as Array<{ table: string; filtre: [string, unknown] | null }>,
  clesRefusees: [] as string[],
  limites: [] as Array<{ cle: string; limite: number; fenetre: number }>,
  envois: [] as unknown[],
}))

vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async (cle: string, limite: number, fenetre: number) => {
    h.limites.push({ cle, limite, fenetre })
    return !h.clesRefusees.some((refusee) => cle.startsWith(refusee))
  }),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.compte),
}))
vi.mock('@/lib/supabase-server-component', () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: h.compteCookie } }) } })),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const lecture = { table, filtre: null as [string, unknown] | null }
      h.lecturesFiche.push(lecture)
      const q: Record<string, unknown> = {}
      q.select = () => q
      q.eq = (colonne: string, valeur: unknown) => { lecture.filtre = [colonne, valeur]; return q }
      q.limit = () => q
      q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
        Promise.resolve(h.erreurFiche ? { data: null, error: h.erreurFiche } : { data: h.fiches, error: null }).then(ok, ko)
      return q
    },
  },
}))
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async (message: unknown) => { h.envois.push(message); return { success: true, id: 'id-envoi' } }),
}))

const { POST } = await import('@/app/api/devis/send-email/route')

const ID_COMPTE = '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d'
const compte = (role: string | undefined): Compte => ({
  id: ID_COMPTE, email: 'pro@exemple.test', app_metadata: role === undefined ? {} : { role }, user_metadata: {},
})

/** « %PDF-1.3 » suivi de quelques octets, en base64 : ce que le formulaire envoie, en tout petit. */
const PDF = Buffer.from('%PDF-1.3\n%fictif\n%%EOF\n', 'latin1').toString('base64')

/** Le corps tel que le formulaire artisan l'envoie. */
const corpsFormulaire = (sur: Record<string, unknown> = {}) => ({
  to: 'client@exemple.test',
  docType: 'devis',
  docNumber: 'DEV-2026-012',
  docTitle: 'Remplacement du chauffe-eau',
  totalStr: '1 234,50 € TTC',
  clientName: 'Paul Petit',
  companyName: 'Plomberie Martin',
  companyPhone: '06 00 00 00 00',
  pdfBase64: PDF,
  ...sur,
})

const envoyer = async (corps: unknown) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/devis/send-email', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: typeof corps === 'string' ? corps : JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

const envoi = (i = 0) => h.envois[i] as Envoi

beforeEach(() => {
  h.compte = compte('artisan')
  h.compteCookie = null
  h.fiches = [{ id: 'fiche-1' }]
  h.erreurFiche = null
  h.lecturesFiche = []
  h.clesRefusees = []
  h.limites = []
  h.envois = []
})

describe('envoi ordinaire depuis le formulaire artisan (inchangé)', () => {
  it('artisan avec fiche : 200, un e-mail au client, PDF joint, objet et étiquettes d\'avant', async () => {
    const res = await envoyer(corpsFormulaire())
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ success: true, id: 'id-envoi' })
    expect(h.envois).toHaveLength(1)
    expect(envoi().to).toBe('client@exemple.test')
    expect(envoi().subject).toBe('Devis DEV-2026-012 — Plomberie Martin')
    expect(envoi().attachments).toEqual([{ filename: 'DEV-2026-012.pdf', content: PDF }])
    expect(envoi().tags).toEqual([{ name: 'doc_type', value: 'devis' }, { name: 'artisan_id', value: ID_COMPTE }])
    expect(envoi().html).toContain('<p>Bonjour Paul Petit,</p>')
    expect(envoi().html).toContain('votre devis N°DEV-2026-012 — Remplacement du chauffe-eau d\'un montant de 1 234,50 € TTC.')
    expect(envoi().html).toContain('<p>Cordialement,<br>Plomberie Martin<br>06 00 00 00 00</p>')
  })

  it('facture : objet « Facture … »', async () => {
    const res = await envoyer(corpsFormulaire({ docType: 'facture', docNumber: 'FACT-2026-003' }))
    expect(res.status).toBe(200)
    expect(envoi().subject).toBe('Facture FACT-2026-003 — Plomberie Martin')
    expect(envoi().html).toContain('votre facture N°FACT-2026-003')
  })

  it.each([
    ['vides', { docTitle: '', totalStr: '', clientName: '', companyName: '', companyPhone: '' }],
    ['nuls', { docTitle: null, totalStr: null, clientName: null, companyName: null, companyPhone: null }],
    ['absents', { docTitle: undefined, totalStr: undefined, clientName: undefined, companyName: undefined, companyPhone: undefined }],
  ])('champs facultatifs %s : 200', async (_cas, sur) => {
    const res = await envoyer(corpsFormulaire(sur))
    expect(res.status).toBe(200)
    expect(envoi().subject).toBe('Devis DEV-2026-012')
    expect(envoi().html).toContain('<p>Bonjour ,</p>')
  })

  it('adresse entourée d\'espaces : acceptée, envoyée sans les espaces', async () => {
    const res = await envoyer(corpsFormulaire({ to: '  client@exemple.test ' }))
    expect(res.status).toBe(200)
    expect(envoi().to).toBe('client@exemple.test')
  })

  it('champs à leur longueur maximale : 200', async () => {
    const res = await envoyer(corpsFormulaire({
      docNumber: 'N'.repeat(100), docTitle: 'T'.repeat(500), totalStr: '9'.repeat(60), clientName: 'C'.repeat(500),
      companyName: 'S'.repeat(300), companyPhone: '0'.repeat(60),
    }))
    expect(res.status).toBe(200)
  })

  it('session portée par le cookie (sans en-tête Authorization) : acceptée', async () => {
    h.compte = null
    h.compteCookie = compte('artisan')
    expect((await envoyer(corpsFormulaire())).status).toBe(200)
  })

  it('sans session : 401, aucun e-mail', async () => {
    h.compte = null
    expect((await envoyer(corpsFormulaire())).status).toBe(401)
    expect(h.envois).toHaveLength(0)
  })
})

describe('compte : réservé aux comptes professionnels', () => {
  it.each(['client', 'particulier', 'locataire', 'coproprio', 'syndic', 'syndic_gestionnaire'])(
    'rôle %s : 403, aucun e-mail', async (role) => {
      h.compte = compte(role)
      const res = await envoyer(corpsFormulaire())
      expect(res.status).toBe(403)
      expect(res.json.error).toMatch(/réservé aux comptes professionnels/)
      expect(h.envois).toHaveLength(0)
    })

  it('rôle client avec une fiche : 403 (l\'écran ne lui ouvre pas le formulaire)', async () => {
    h.compte = compte('client')
    h.fiches = [{ id: 'fiche-1' }]
    expect((await envoyer(corpsFormulaire())).status).toBe(403)
    expect(h.envois).toHaveLength(0)
  })

  it('rôle artisan sans fiche : 403, aucun e-mail', async () => {
    h.fiches = []
    expect((await envoyer(corpsFormulaire())).status).toBe(403)
    expect(h.envois).toHaveLength(0)
  })

  it('la fiche est cherchée par le compte connecté, jamais par une valeur du corps', async () => {
    await envoyer(corpsFormulaire({ user_id: 'autre', artisan_id: 'autre' }))
    expect(h.lecturesFiche).toEqual([{ table: 'profiles_artisan', filtre: ['user_id', ID_COMPTE] }])
  })

  it('rôle pas encore posé, avec fiche (inscription avec confirmation d\'e-mail) : 200', async () => {
    h.compte = compte(undefined)
    expect((await envoyer(corpsFormulaire())).status).toBe(200)
  })

  it('rôle pas encore posé, sans fiche : 403', async () => {
    h.compte = compte(undefined)
    h.fiches = []
    expect((await envoyer(corpsFormulaire())).status).toBe(403)
    expect(h.envois).toHaveLength(0)
  })

  it('société (pro_societe) avec sa fiche : 200', async () => {
    h.compte = compte('pro_societe')
    expect((await envoyer(corpsFormulaire())).status).toBe(200)
    expect(h.lecturesFiche).toEqual([{ table: 'profiles_artisan', filtre: ['user_id', ID_COMPTE] }])
  })

  it('société (pro_societe) sans fiche : 403, aucun e-mail (rôle qu\'un compte peut prendre lui-même)', async () => {
    h.compte = compte('pro_societe')
    h.fiches = []
    expect((await envoyer(corpsFormulaire())).status).toBe(403)
    expect(h.envois).toHaveLength(0)
  })

  it.each(['pro_conciergerie', 'pro_gestionnaire', 'super_admin'])(
    'rôle %s, attribué par la plateforme seule, sans fiche : 200 (le tableau de bord lui est ouvert sans fiche)', async (role) => {
      h.compte = compte(role)
      h.fiches = []
      expect((await envoyer(corpsFormulaire())).status).toBe(200)
      expect(h.lecturesFiche).toHaveLength(0)
    })

  it('fiche illisible (panne de la base) : 503, aucun e-mail', async () => {
    h.erreurFiche = { message: 'timeout' }
    const res = await envoyer(corpsFormulaire())
    expect(res.status).toBe(503)
    expect(h.envois).toHaveLength(0)
  })
})

describe('destinataire : une seule adresse valide', () => {
  it.each([
    ['une liste d\'adresses', ['a@exemple.test', 'b@exemple.test']],
    ['deux adresses dans une chaîne', 'a@exemple.test, b@exemple.test'],
    ['un nom suivi d\'une adresse', 'Paul <a@exemple.test>'],
    ['une adresse sans domaine complet', 'client@localhost'],
    ['un texte', 'pas une adresse'],
    ['rien', ''],
    ['un nombre', 42],
  ])('%s : 400, aucun e-mail', async (_cas, to) => {
    const res = await envoyer(corpsFormulaire({ to }))
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/adresse e-mail/i)
    expect(h.envois).toHaveLength(0)
  })
})

describe('contenu : valeurs échappées, champs bornés', () => {
  const balise = (champ: string) => `<b data-champ="${champ}">&'</b>`
  const echappee = (champ: string) => `&lt;b data-champ=&quot;${champ}&quot;&gt;&amp;&#039;&lt;/b&gt;`

  it('chaque valeur saisie est échappée dans le HTML, aucune ne devient du balisage', async () => {
    const champs = ['docNumber', 'docTitle', 'totalStr', 'clientName', 'companyName', 'companyPhone']
    const res = await envoyer(corpsFormulaire(Object.fromEntries(champs.map((c) => [c, balise(c)]))))
    expect(res.status).toBe(200)
    expect(envoi().html).not.toMatch(/<b data-champ=/)
    for (const champ of champs) expect(envoi().html, champ).toContain(echappee(champ))
  })

  it('objet sur une seule ligne, sans entité HTML', async () => {
    const res = await envoyer(corpsFormulaire({ docNumber: 'DEV-1\r\nSuite', companyName: 'L\'Atelier\n& Fils' }))
    expect(res.status).toBe(200)
    expect(envoi().subject).toBe('Devis DEV-1 Suite — L\'Atelier & Fils')
  })

  it.each([
    ['docNumber', 101, /numéro/i],
    ['docTitle', 501, /titre/i],
    ['totalStr', 61, /montant/i],
    ['clientName', 501, /nom du client/i],
    ['companyName', 301, /nom de l'entreprise/i],
    ['companyPhone', 61, /téléphone/i],
  ])('%s de %i caractères : 400 avec un message en français, aucun e-mail', async (champ, longueur, message) => {
    const res = await envoyer(corpsFormulaire({ [champ]: 'x'.repeat(longueur) }))
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(message)
    expect(h.envois).toHaveLength(0)
  })

  it.each([['avoir'], ['Devis'], [''], [undefined]])('type de document %j : 400', async (docType) => {
    const res = await envoyer(corpsFormulaire({ docType }))
    expect(res.status).toBe(400)
    expect(h.envois).toHaveLength(0)
  })

  it('numéro de document absent : 400', async () => {
    expect((await envoyer(corpsFormulaire({ docNumber: '' }))).status).toBe(400)
    expect(h.envois).toHaveLength(0)
  })

  it('corps illisible ou qui n\'est pas un objet : 400', async () => {
    expect((await envoyer('{ pas du json')).status).toBe(400)
    expect((await envoyer([corpsFormulaire()])).status).toBe(400)
    expect(h.envois).toHaveLength(0)
  })
})

describe('pièce jointe : un PDF de taille bornée', () => {
  it.each([
    ['une archive', Buffer.from('PK\u0003\u0004contenu', 'latin1').toString('base64')],
    ['une page web', Buffer.from('<html><body>page</body></html>', 'latin1').toString('base64')],
    ['un texte qui n\'est pas du base64', 'ceci n\'est pas un fichier'],
    ['un PDF précédé d\'autre chose', Buffer.from('x%PDF-1.3\n', 'latin1').toString('base64')],
  ])('%s : 400, aucun e-mail', async (_cas, pdfBase64) => {
    const res = await envoyer(corpsFormulaire({ pdfBase64 }))
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/PDF/)
    expect(h.envois).toHaveLength(0)
  })

  it('pièce jointe absente : 400', async () => {
    expect((await envoyer(corpsFormulaire({ pdfBase64: '' }))).status).toBe(400)
    expect((await envoyer(corpsFormulaire({ pdfBase64: undefined }))).status).toBe(400)
    expect(h.envois).toHaveLength(0)
  })

  it('PDF de plus de 10 Mo : 413 avec un message en français, aucun e-mail', async () => {
    const tropGros = Buffer.concat([Buffer.from('%PDF-1.3\n', 'latin1'), Buffer.alloc(DIX_MO)]).toString('base64')
    const res = await envoyer(corpsFormulaire({ pdfBase64: tropGros }))
    expect(res.status).toBe(413)
    expect(res.json.error).toMatch(/10 Mo/)
    expect(h.envois).toHaveLength(0)
  })

  it('PDF de 10 Mo tout juste : 200', async () => {
    const enTete = Buffer.from('%PDF-1.3\n', 'latin1')
    const limite = Buffer.concat([enTete, Buffer.alloc(DIX_MO - enTete.length)]).toString('base64')
    expect((await envoyer(corpsFormulaire({ pdfBase64: limite }))).status).toBe(200)
  })
})

describe('taille du corps annoncée par l\'en-tête Content-Length', () => {
  // Le navigateur annonce la taille du corps dans l'en-tête Content-Length ; la route refuse d'emblée un corps trop gros
  // pour ne porter qu'un PDF de 10 Mo et les autres champs. Une requête construite dans un test ne porte pas cet
  // en-tête (sa valeur y est nulle) : il est posé ici à la main.
  /** Borne de la route : le PDF de 10 Mo en base64, plus 64 Kio pour les autres champs. */
  const TAILLE_MAX_CORPS = Math.ceil(DIX_MO / 3) * 4 + 64 * 1024

  const envoyerAvecTaille = async (corps: string, tailleAnnoncee: number) => {
    const requete = new NextRequest('https://vitfix.io/api/devis/send-email', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json', 'Content-Length': String(tailleAnnoncee) },
      body: corps,
    })
    const res = await POST(requete)
    return { status: res.status, json: await res.json() as Record<string, unknown>, corpsLu: requete.bodyUsed }
  }

  it('corps annoncé au-delà de la borne : 413 avec un message en français, corps jamais lu, aucun e-mail', async () => {
    const res = await envoyerAvecTaille(JSON.stringify(corpsFormulaire()), TAILLE_MAX_CORPS + 1)
    expect(res.status).toBe(413)
    expect(res.json.error).toMatch(/10 Mo/)
    expect(res.corpsLu).toBe(false)
    expect(h.envois).toHaveLength(0)
  })

  it('PDF de 10 Mo et champs à leur longueur maximale, annoncés à leur taille réelle comme par le navigateur : 200', async () => {
    const enTete = Buffer.from('%PDF-1.3\n', 'latin1')
    const pdfBase64 = Buffer.concat([enTete, Buffer.alloc(DIX_MO - enTete.length)]).toString('base64')
    const corps = JSON.stringify(corpsFormulaire({
      pdfBase64, docNumber: 'N'.repeat(100), docTitle: 'É'.repeat(500), totalStr: '9'.repeat(60), clientName: 'É'.repeat(500),
      companyName: 'É'.repeat(300), companyPhone: '0'.repeat(60),
    }))
    const res = await envoyerAvecTaille(corps, Buffer.byteLength(corps, 'utf8'))
    expect(res.status).toBe(200)
    expect(h.envois).toHaveLength(1)
    expect(envoi().attachments).toEqual([{ filename: `${'N'.repeat(100)}.pdf`, content: pdfBase64 }])
  })
})

describe('volume : limite par minute conservée, plafond par compte et par 24 heures ajouté', () => {
  const MINUTE = 60_000
  const JOUR = 24 * 60 * 60 * 1000

  it('les deux compteurs portent le compte, pas l\'adresse Internet', async () => {
    await envoyer(corpsFormulaire())
    expect(h.limites).toEqual([
      { cle: `send_devis_${ID_COMPTE}`, limite: 20, fenetre: MINUTE },
      { cle: `send_devis_jour_${ID_COMPTE}`, limite: 100, fenetre: JOUR },
    ])
  })

  it('plafond des 24 heures atteint : 429 avec un message en français, aucun e-mail', async () => {
    h.clesRefusees = ['send_devis_jour_']
    const res = await envoyer(corpsFormulaire())
    expect(res.status).toBe(429)
    expect(res.json.error).toMatch(/100 e-mails par 24 heures/)
    expect(h.envois).toHaveLength(0)
  })

  it('une demande refusée (corps invalide, compte non professionnel) ne consomme pas le plafond des 24 heures', async () => {
    await envoyer(corpsFormulaire({ to: 'pas une adresse' }))
    h.compte = compte('client')
    await envoyer(corpsFormulaire())
    expect(h.limites.filter((l) => l.cle.startsWith('send_devis_jour_'))).toHaveLength(0)
  })

  it('limite par minute atteinte : 429, aucun e-mail', async () => {
    h.clesRefusees = [`send_devis_${ID_COMPTE}`]
    expect((await envoyer(corpsFormulaire())).status).toBe(429)
    expect(h.envois).toHaveLength(0)
  })
})
