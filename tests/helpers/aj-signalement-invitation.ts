// tests/helpers/aj-signalement-invitation.ts — accès des gestionnaires (PR 2, lot 3) : comptes, liaison, envoi d'accès.
//
// - authQr : comptes Supabase Auth simulés (createUser, listUsers, getUserById, updateUserById) au plus près de GoTrue
//   pour ce que lib/equipe utilise : une adresse déjà inscrite donne « A user with this email address has already been
//   registered » ; une méthode peut être mise en échec, et un rappel peut agir juste avant qu'elle ne réponde ; la
//   politique du mot de passe du projet (refusMotDePasse) refuse createUser et updateUserById quand ils portent un mot de
//   passe (weak_password, code d'AuthWeakPasswordError), APRÈS le contrôle de l'adresse déjà inscrite (ordre de GoTrue) ;
// - clientInvitationQr : le client de la base simulée (tests/helpers/aj-signalement-base.ts) avec auth.admin, et la
//   LIAISON du trigger trg_signalements_qr_invitations_liaison de la 20261112 rejouée après chaque écriture des envois
//   (la base simulée ne joue aucun trigger) : mêmes gardes que le corps SQL ; liaison.active = false la coupe ;
// - simulerEnvoiAccesQr, simulerContestationAccesQr : corps SQL de signalements_qr_envoyer_acces et du nouveau corps de
//   signalements_qr_contester_adresse (20261112), au plus près du texte.
// Aucune donnée réelle : adresses en @exemple.test.
// Usage :
//   vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-invitation')).clientInvitationQr }))

import { baseQr, type Ligne } from './aj-signalement-base'

export interface CompteSimule {
  id: string
  email: string
  app_metadata: Record<string, unknown>
  user_metadata: Record<string, unknown>
  ban_duration?: string
  /** Dernier mot de passe posé (createUser ou updateUserById). */
  password?: string
}

type MethodeAuth = 'createUser' | 'listUsers' | 'getUserById' | 'updateUserById' | 'deleteUser'

export const authQr = {
  comptes: [] as CompteSimule[],
  appels: [] as Array<{ methode: MethodeAuth; args: unknown[] }>,
  /** Méthode mise en échec (message d'erreur de GoTrue). */
  echecs: {} as Partial<Record<MethodeAuth, string>>,
  /** Rappel joué juste avant la réponse d'une méthode (ex. : poser une erreur ponctuelle de la base). */
  avant: {} as Partial<Record<MethodeAuth, () => void>>,
  /** Politique du mot de passe du projet : refus de tout mot de passe (null : aucun refus). */
  refusMotDePasse: null as null | { message: string; code: string },
  compteur: 0,
}

export function reinitialiserAuthQr(): void {
  authQr.comptes = []
  authQr.appels = []
  authQr.echecs = {}
  authQr.avant = {}
  authQr.refusMotDePasse = null
  authQr.compteur = 0
}

const noter = (methode: MethodeAuth, args: unknown[]) => {
  authQr.appels.push({ methode, args })
  authQr.avant[methode]?.()
  const echec = authQr.echecs[methode]
  return echec ? { message: echec, status: 422 } : null
}

const copie = (c: CompteSimule) => ({ ...c, app_metadata: { ...c.app_metadata }, user_metadata: { ...c.user_metadata } })

/** Refus de la politique du mot de passe, au format d'AuthWeakPasswordError (code weak_password, statut 422). */
const refusPolitique = (password: string | undefined) =>
  (password !== undefined && authQr.refusMotDePasse ? { ...authQr.refusMotDePasse, status: 422 } : null)

export const adminAuthQr = {
  async createUser(p: { email: string; password: string; email_confirm?: boolean; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }) {
    const echec = noter('createUser', [p])
    if (echec) return { data: { user: null }, error: echec }
    if (authQr.comptes.some((c) => c.email === p.email)) {
      return { data: { user: null }, error: { message: 'A user with this email address has already been registered', status: 422 } }
    }
    const refus = refusPolitique(p.password)
    if (refus) return { data: { user: null }, error: refus }
    authQr.compteur += 1
    const compte: CompteSimule = {
      id: `0e000000-0000-4000-8000-${String(authQr.compteur).padStart(12, '0')}`, email: p.email,
      app_metadata: { ...(p.app_metadata ?? {}) }, user_metadata: { ...(p.user_metadata ?? {}) }, password: p.password,
    }
    authQr.comptes.push(compte)
    return { data: { user: copie(compte) }, error: null }
  },
  async listUsers(p: { page?: number; perPage?: number } = {}) {
    const echec = noter('listUsers', [p])
    if (echec) return { data: { users: [] }, error: echec }
    const parPage = p.perPage ?? 50
    const debut = ((p.page ?? 1) - 1) * parPage
    return { data: { users: authQr.comptes.slice(debut, debut + parPage).map(copie) }, error: null }
  },
  async getUserById(id: string) {
    const echec = noter('getUserById', [id])
    const compte = authQr.comptes.find((c) => c.id === id)
    if (echec || !compte) return { data: { user: null }, error: echec ?? { message: 'User not found', status: 404 } }
    return { data: { user: copie(compte) }, error: null }
  },
  async updateUserById(id: string, attributs: { app_metadata?: Record<string, unknown>; ban_duration?: string; password?: string }) {
    const echec = noter('updateUserById', [id, attributs])
    const compte = authQr.comptes.find((c) => c.id === id)
    if (echec || !compte) return { data: { user: null }, error: echec ?? { message: 'User not found', status: 404 } }
    const refus = refusPolitique(attributs.password)
    if (refus) return { data: { user: null }, error: refus }
    if (attributs.app_metadata) compte.app_metadata = { ...attributs.app_metadata }
    if (attributs.ban_duration !== undefined) compte.ban_duration = attributs.ban_duration
    if (attributs.password !== undefined) compte.password = attributs.password
    return { data: { user: copie(compte) }, error: null }
  },
  async deleteUser(id: string) {
    const echec = noter('deleteUser', [id])
    if (echec) return { data: null, error: echec }
    authQr.comptes = authQr.comptes.filter((c) => c.id !== id)
    return { data: null, error: null }
  },
}

/** Comptes créés ou modifiés : aucun appel d'écriture à l'auth. */
export const ecrituresAuthQr = () => authQr.appels.filter((a) => a.methode === 'createUser' || a.methode === 'updateUserById' || a.methode === 'deleteUser')

// ── Liaison du compte à la fiche (trigger de la 20261112, rejoué à la main) ──

export const liaisonQr = {
  active: true,
  /** user_id de chaque envoi au dernier passage (OLD.user_id du trigger). */
  vus: new Map<string, unknown>(),
}

/** À appeler APRÈS avoir posé les envois du test : leur user_id actuel est l'état « d'avant » (aucune liaison rejouée). */
export function reinitialiserLiaisonQr(): void {
  liaisonQr.active = true
  liaisonQr.vus = new Map(baseQr.table('signalements_qr_invitations').map((i) => [String(i.id), i.user_id ?? null]))
}

const maintenantIso = () => new Date().toISOString()

/** Corps de signalements_qr_lier_gestionnaire(), pour chaque envoi dont user_id vient de changer. */
function lierComptesQr(): void {
  const envois = baseQr.table('signalements_qr_invitations')
  const fiches = baseQr.table('signalements_qr_gestionnaires')
  for (const inv of envois) {
    const ancien = liaisonQr.vus.get(String(inv.id)) ?? null
    liaisonQr.vus.set(String(inv.id), inv.user_id ?? null)
    if (!liaisonQr.active) continue
    if (inv.objet !== 'acces' || !inv.user_id || !inv.accepted_at || inv.user_id === ancien) continue
    if (fiches.some((g) => g.user_id === inv.user_id && g.id !== inv.gestionnaire_id)) continue
    const g = fiches.find((f) => f.id === inv.gestionnaire_id && f.actif === true && !f.pseudonymise_le && !f.adresse_contestee_le
      && f.email === inv.email && (!f.user_id || f.user_id === inv.user_id))
    if (!g) continue
    Object.assign(g, {
      user_id: inv.user_id, acces_ouvert_le: g.acces_ouvert_le ?? inv.accepted_at, adresse_confirmee_le: g.adresse_confirmee_le ?? inv.accepted_at,
    })
    for (const autre of envois) {
      if (autre.gestionnaire_id === g.id && autre.id !== inv.id && !autre.accepted_at && autre.invite_token) autre.invite_token = null
    }
    baseQr.table('signalements_qr_journal').push({
      cabinet_id: g.cabinet_id, acteur_id: inv.user_id, acteur_profil: 'gestionnaire', acteur_gestionnaire_id: g.id,
      action: 'gestionnaire.acces_ouvert', gestionnaire_id: g.id, created_at: maintenantIso(),
    })
  }
}

/**
 * Client de la base simulée avec auth.admin ; la liaison est rejouée après chaque requête attendue sur les envois (rappel
 * de la base simulée : joué avant que la réponse ne soit rendue, pas après single() ni maybeSingle()).
 */
export const clientInvitationQr = {
  from: (table: string) => (table === 'signalements_qr_invitations' ? baseQr.client.from(table, lierComptesQr) : baseQr.client.from(table)),
  rpc: (nom: string, args: Record<string, unknown> = {}) => baseQr.client.rpc(nom, args),
  auth: { admin: adminAuthQr },
}

// ── Fonctions SQL de la 20261112 ─────────────────────────────────────────────

const erreurMetier = (message: string) => ({ error: { code: 'P0001', message } })

/** signalements_qr_envoyer_acces : fiche relue, erreurs a_reverifier / adresse_contestee / deja_ouvert, envois invalidés. */
export function simulerEnvoiAccesQr(): void {
  baseQr.etat.fonctions.signalements_qr_envoyer_acces = (a) => {
    const inv = (a.p_invitation ?? {}) as Ligne
    if (!a.p_gestionnaire || !inv.id || !a.p_acteur || !inv.invite_token) return { error: { code: '22023', message: 'parametre_invalide' } }
    const g = baseQr.table('signalements_qr_gestionnaires').find((f) => f.id === a.p_gestionnaire)
    if (!g || g.actif !== true || g.pseudonymise_le || !g.email || inv.email !== g.email) return erreurMetier('a_reverifier')
    if (g.adresse_contestee_le) return erreurMetier('adresse_contestee')
    if (g.user_id) return erreurMetier('deja_ouvert')
    const envois = baseQr.table('signalements_qr_invitations')
    for (const e of envois) if (e.gestionnaire_id === g.id && e.objet === 'acces' && !e.accepted_at && e.invite_token) e.invite_token = null
    envois.push({
      id: inv.id, gestionnaire_id: g.id, objet: 'acces', email: g.email, full_name: g.nom, role: 'gestionnaire_signalement',
      invite_token: inv.invite_token, invite_sent_at: null, accepted_at: null, user_id: null, refus: null, envoye_par: a.p_acteur,
      created_at: maintenantIso(),
    })
    return { data: true }
  }
}

const SEPT_JOURS_MS = 7 * 24 * 3600 * 1000

/**
 * Nouveau corps de signalements_qr_contester_adresse : envoi de confirmation OU d'accès, fiche sans compte relié ; comme
 * la 20261111 corrigée (PR 1), les jetons de TOUS les envois de la fiche sont effacés, celui d'un envoi déjà accepté
 * compris (« C'est moi » garde le jeton). Le verrou de la fiche (pris d'abord) ne se simule pas.
 */
export function simulerContestationAccesQr(): void {
  baseQr.etat.fonctions.signalements_qr_contester_adresse = (a) => {
    const envois = baseQr.table('signalements_qr_invitations')
    const inv = envois.find((i) => i.id === a.p_invitation && (i.objet === 'confirmation_adresse' || i.objet === 'acces') && !i.accepted_at
      && !i.refus && i.invite_token && Date.now() - new Date(String(i.created_at)).getTime() < SEPT_JOURS_MS)
    const g = inv && baseQr.table('signalements_qr_gestionnaires').find((f) => f.id === inv.gestionnaire_id && f.actif === true
      && !f.adresse_contestee_le && f.email === inv.email && !f.user_id)
    if (!inv || !g) return { data: false }
    Object.assign(inv, { refus: 'pas_moi', invite_token: null })
    g.adresse_contestee_le = maintenantIso()
    for (const e of envois) if (e.gestionnaire_id === g.id && e.invite_token) e.invite_token = null
    baseQr.table('signalements_qr_journal').push({
      cabinet_id: g.cabinet_id, acteur_profil: 'gestionnaire', acteur_gestionnaire_id: g.id, action: 'gestionnaire.adresse_contestee',
      gestionnaire_id: g.id, details: { objet: inv.objet }, created_at: maintenantIso(),
    })
    return { data: true }
  }
}
