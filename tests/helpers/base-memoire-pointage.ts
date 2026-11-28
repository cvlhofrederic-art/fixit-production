// tests/helpers/base-memoire-pointage.ts — base Supabase simulée en mémoire et données fictives du pointage BTP,
// communes aux tests des routes /api/btp/pointage et /api/btp/pointage/evenement.
//
// Filtres eq / is / gte, tri, limite, insertion, upsert, modification, index « un pointage ouvert par employé » de la
// migration 20261116, table absente, colonne absente à l'écriture (`etat.colonnesAbsentes`), panne passagère d'une
// table (`etat.pannes`). Usage dans un test :
//   vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/base-memoire-pointage')).supabaseMemoire }))
// Comptes et données fictifs.

import { randomUUID } from 'node:crypto'

export type Ligne = Record<string, unknown>

export const etat = {
  user: null as null | Record<string, unknown>,
  tables: {} as Record<string, Ligne[]>,
  liaisons: [] as Array<{ equipe_id: string; membre_id: string }>,
  indexUnique: true,
  tablesAbsentes: new Set<string>(),
  /**
   * Colonnes « table.colonne » que la base n'a pas encore (migration non appliquée) : une insertion ou une modification
   * qui en écrit une échoue comme avec PostgREST (PGRST204). Vidé par donnees().
   */
  colonnesAbsentes: new Set<string>(),
  /**
   * Panne d'une table : table → nombre de requêtes, lectures comme écritures, qui échouent encore (délai dépassé,
   * code 57014) ; la table répond ensuite de nouveau. Vidé par donnees().
   */
  pannes: new Map<string, number>(),
  /** Simule un second envoi qui ouvre le pointage entre la vérification de la route et son insertion. */
  courseAvantInsertion: null as null | Ligne,
  /** Simule une seconde activation du même compte enregistrée entre le retrait et l'insertion d'un téléphone. */
  courseAppareil: null as null | Ligne,
  /**
   * Joué juste avant chaque modification (update) jusqu'à ce qu'il rende vrai : un autre envoi, ou l'employé, passé
   * entre une lecture et l'écriture qui la suit.
   */
  avantMiseAJour: null as null | ((table: string) => boolean),
  ecritures: [] as Array<{ table: string; op: 'insert' | 'update' | 'upsert' | 'delete'; valeur: Ligne; filtres: string[] }>,
}

/** Ordre des chaînes par points de code, comme PostgreSQL en collation « C » sur des dates et heures ISO. */
function comparer(x: string, y: string): number {
  if (x < y) return -1
  return x > y ? 1 : 0
}

export function requete(table: string) {
  const filtres: Array<{ texte: string; test: (l: Ligne) => boolean }> = []
  const tri: Array<[string, boolean]> = []
  let op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  let valeur: Ligne = {}
  let limite = Number.POSITIVE_INFINITY
  let avecLiaison = false
  const lignes = () => (etat.tables[table] ??= [])
  const correspondantes = () => lignes().filter(l => filtres.every(f => f.test(l)))

  const inserer = (): { data: unknown; error: unknown } => {
    if (table === 'pointages_btp' && etat.courseAvantInsertion) {
      lignes().push(etat.courseAvantInsertion)
      etat.courseAvantInsertion = null
    }
    if (table === 'pointage_appareils_btp' && etat.courseAppareil) {
      lignes().push(etat.courseAppareil)
      etat.courseAppareil = null
    }
    const ligne: Ligne = { id: randomUUID(), created_at: new Date().toISOString(), ...valeur }
    const conflit = table === 'pointages_btp' && etat.indexUnique && ligne.heure_depart == null && ligne.membre_id
      && lignes().some(l => l.owner_id === ligne.owner_id && l.membre_id === ligne.membre_id && l.heure_depart == null)
    if (conflit) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "pointages_btp_un_ouvert_par_membre"' } }
    // Index unique partiel pointage_appareils_btp_actifs (migration 20261117) : un téléphone actif par compte.
    const doublonTelephone = table === 'pointage_appareils_btp' && etat.indexUnique && ligne.retire_le == null
      && lignes().some(l => l.user_id === ligne.user_id && l.retire_le == null)
    if (doublonTelephone) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "pointage_appareils_btp_actifs"' } }
    // Contrainte unique du journal des envois (migration 20261117) : téléphone, chantier, sens, heure de détection.
    const memeEnvoi = table === 'pointage_evenements_btp' && lignes().some(l => ['appareil_id', 'chantier_id', 'sens', 'detecte_le'].every(c => l[c] === ligne[c]))
    if (memeEnvoi) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "pointage_evenements_btp_un_envoi"' } }
    lignes().push(ligne)
    etat.ecritures.push({ table, op: 'insert', valeur, filtres: [] })
    return { data: [ligne], error: null }
  }

  const lire = (): { data: unknown; error: unknown } => {
    let resultat: Ligne[] = correspondantes().map(l => (avecLiaison
      ? { ...l, equipe_membres_btp: etat.liaisons.filter(x => x.equipe_id === l.id).map(x => ({ membre_id: x.membre_id })) }
      : { ...l }))
    for (const [colonne, croissant] of [...tri].reverse()) {
      resultat = [...resultat].sort((a, b) => comparer(String(a[colonne] ?? ''), String(b[colonne] ?? '')) * (croissant ? 1 : -1))
    }
    return { data: resultat.slice(0, limite), error: null }
  }

  const executer = (): { data: unknown; error: unknown } => {
    if (etat.tablesAbsentes.has(table)) {
      return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` } }
    }
    const colonneAbsente = op !== 'select' && op !== 'delete' ? Object.keys(valeur).find(c => etat.colonnesAbsentes.has(`${table}.${c}`)) : undefined
    if (colonneAbsente) {
      return { data: null, error: { code: 'PGRST204', message: `Could not find the '${colonneAbsente}' column of '${table}' in the schema cache` } }
    }
    const pannesRestantes = etat.pannes.get(table) ?? 0
    if (pannesRestantes > 0) {
      etat.pannes.set(table, pannesRestantes - 1)
      return { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }
    }
    if (op === 'insert') return inserer()
    if (op === 'upsert') {
      const existante = lignes().find(l => l.owner_id === valeur.owner_id)
      if (existante) Object.assign(existante, valeur)
      else lignes().push({ ...valeur })
      etat.ecritures.push({ table, op, valeur, filtres: [] })
      return { data: null, error: null }
    }
    if (op === 'delete') {
      const cibles = correspondantes()
      etat.tables[table] = lignes().filter(l => !cibles.includes(l))
      etat.ecritures.push({ table, op, valeur: {}, filtres: filtres.map(f => f.texte) })
      return { data: cibles.map(l => ({ ...l })), error: null }
    }
    if (op === 'update') {
      if (etat.avantMiseAJour?.(table)) etat.avantMiseAJour = null
      const cibles = correspondantes()
      // Index « un pointage ouvert par employé » (migration 20261116), vérifié aussi quand une modification rouvre.
      if (table === 'pointages_btp' && etat.indexUnique) {
        const apres = [...lignes().filter(l => !cibles.includes(l)), ...cibles.map(l => ({ ...l, ...valeur }))]
        const doublon = apres.some(a => a.heure_depart == null && apres.filter(b => b.heure_depart == null && b.owner_id === a.owner_id && b.membre_id === a.membre_id).length > 1)
        if (doublon) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "pointages_btp_un_ouvert_par_membre"' } }
      }
      for (const l of cibles) Object.assign(l, valeur)
      etat.ecritures.push({ table, op, valeur, filtres: filtres.map(f => f.texte) })
      return { data: cibles.map(l => ({ ...l })), error: null }
    }
    return lire()
  }

  const b: Record<string, unknown> = {}
  b.select = (colonnes?: string) => { if (colonnes?.includes('equipe_membres_btp')) avecLiaison = true; return b }
  b.eq = (c: string, v: unknown) => { filtres.push({ texte: `${c}=${String(v)}`, test: l => l[c] === v }); return b }
  b.in = (c: string, v: unknown[]) => { filtres.push({ texte: `${c} in (${v.map(String).join(',')})`, test: l => v.includes(l[c]) }); return b }
  b.is = (c: string, v: unknown) => { filtres.push({ texte: `${c} is ${String(v)}`, test: l => (l[c] ?? null) === v }); return b }
  b.gte = (c: string, v: unknown) => { filtres.push({ texte: `${c}>=${String(v)}`, test: l => String(l[c]) >= String(v) }); return b }
  b.lte = (c: string, v: unknown) => { filtres.push({ texte: `${c}<=${String(v)}`, test: l => String(l[c]) <= String(v) }); return b }
  b.order = (c: string, o?: { ascending?: boolean }) => { tri.push([c, o?.ascending !== false]); return b }
  b.limit = (n: number) => { limite = n; return b }
  b.insert = (v: Ligne) => { op = 'insert'; valeur = v; return b }
  b.upsert = (v: Ligne) => { op = 'upsert'; valeur = v; return b }
  b.update = (v: Ligne) => { op = 'update'; valeur = v; return b }
  b.delete = () => { op = 'delete'; return b }
  b.single = async () => {
    const r = executer()
    if (r.error) return r
    const premiere = Array.isArray(r.data) ? r.data[0] : r.data
    return premiere ? { data: premiere, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
  }
  b.maybeSingle = async () => {
    const r = executer()
    return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error }
  }
  b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(executer()).then(ok, ko)
  return b
}

export const supabaseMemoire = { from: (t: string) => requete(t) }

// ── Société A (celle qu'on teste) et société B (qui ne doit jamais apparaître) ──
export const SOC_A = '0b6c1a4e-6f1d-4c39-9a51-2f0d8f6e1a01'
export const SOC_B = '0b6c1a4e-6f1d-4c39-9a51-2f0d8f6e1a02'
export const U_PAUL = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01'
export const U_INACTIF = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e02'
export const U_SANS_FICHE = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e03'
export const M_PAUL = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f01'
export const M_JEAN = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f02'
export const M_GERANT = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f03'
export const M_LUC = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f04'
export const C_VILLA = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a01'
export const C_GARAGE = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a02'
export const C_IMMEUBLE = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a03'
export const C_FINI = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a04'
export const C_JEAN = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a05'
export const C_SOC_B = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a06'
export const EQ_MACONS = '4f5a6b7c-8d9e-4f0a-9b1c-2d3e4f5a6b01'

export const GERANT_A = { id: SOC_A, email: 'gerant@a.example', app_metadata: { role: 'pro_societe' } }
export const OUVRIER_PAUL = { id: U_PAUL, email: 'paul@a.example', app_metadata: { role: 'pro_societe', pro_team_role: 'OUVRIER', company_id: SOC_A } }
export const OUVRIER_INACTIF = { id: U_INACTIF, email: 'jean@a.example', app_metadata: { role: 'pro_societe', pro_team_role: 'OUVRIER', company_id: SOC_A } }
export const OUVRIER_SANS_FICHE = { id: U_SANS_FICHE, email: 'sans.fiche@a.example', app_metadata: { role: 'pro_societe', pro_team_role: 'OUVRIER', company_id: SOC_A } }

// 16/11/2026 07:30:00 UTC = 08:30:00 à Paris, 07:30:00 à Lisbonne.
export const MAINTENANT = Date.UTC(2026, 10, 16, 7, 30, 0)
export const HEURE = 3_600_000

/** Remet la base dans son état de départ : société A complète, un homonyme dans la société B. */
export function donnees() {
  etat.pannes.clear()
  etat.colonnesAbsentes.clear()
  etat.tables = {
    pro_team_members: [
      { id: randomUUID(), company_id: SOC_A, user_id: U_PAUL, email: 'paul@a.example', role: 'OUVRIER', is_active: true },
      { id: randomUUID(), company_id: SOC_A, user_id: U_INACTIF, email: 'jean@a.example', role: 'OUVRIER', is_active: false },
      { id: randomUUID(), company_id: SOC_A, user_id: U_SANS_FICHE, email: 'sans.fiche@a.example', role: 'OUVRIER', is_active: true },
      { id: randomUUID(), company_id: SOC_A, user_id: null, email: 'invite@a.example', role: 'OUVRIER', is_active: true },
      // Compte désactivé dont l'adresse est celle de la fiche de Luc : Luc n'a PAS de compte actif.
      { id: randomUUID(), company_id: SOC_A, user_id: randomUUID(), email: 'luc@a.example', role: 'OUVRIER', is_active: false },
    ],
    membres_btp: [
      { id: M_PAUL, owner_id: SOC_A, prenom: 'Paul', nom: 'Exemple', email: ' Paul@A.example', type_compte: 'ouvrier', actif: true },
      { id: M_JEAN, owner_id: SOC_A, prenom: 'Jean', nom: 'Test', email: 'invite@a.example', type_compte: 'ouvrier', actif: true },
      { id: M_GERANT, owner_id: SOC_A, prenom: 'Gérard', nom: 'Gérant', email: '', type_compte: 'gerant', actif: true },
      { id: M_LUC, owner_id: SOC_A, prenom: 'Luc', nom: 'Parti', email: 'luc@a.example', type_compte: 'ouvrier', actif: true },
      // Même adresse que Paul, dans une autre société : ne doit jamais être prise pour lui.
      { id: randomUUID(), owner_id: SOC_B, prenom: 'Paul', nom: 'Homonyme', email: 'paul@a.example', actif: true },
    ],
    chantiers_btp: [
      { id: C_VILLA, owner_id: SOC_A, titre: 'Villa', statut: 'En cours', adresse: '1 rue des Lilas', ville: 'Marseille', code_postal: '13008', latitude: 43.25, longitude: 5.38, geo_rayon_m: 150, budget: 45000, client: 'Mme X', membres_ids: [M_PAUL] },
      { id: C_GARAGE, owner_id: SOC_A, titre: 'Garage', statut: 'En cours', latitude: null, longitude: null, geo_rayon_m: 100, membres_ids: [M_PAUL] },
      { id: C_IMMEUBLE, owner_id: SOC_A, titre: 'Immeuble', statut: 'En cours', latitude: 43.3, longitude: 5.4, geo_rayon_m: 100, membres_ids: [] },
      { id: C_FINI, owner_id: SOC_A, titre: 'Fini', statut: 'Terminé', latitude: 43.3, longitude: 5.4, geo_rayon_m: 100, membres_ids: [M_PAUL] },
      { id: C_JEAN, owner_id: SOC_A, titre: 'Chantier de Jean', statut: 'En cours', latitude: 43.3, longitude: 5.4, geo_rayon_m: 100, membres_ids: [M_JEAN] },
      { id: C_SOC_B, owner_id: SOC_B, titre: 'Chantier B', statut: 'En cours', latitude: 43.3, longitude: 5.4, geo_rayon_m: 100, membres_ids: [M_PAUL] },
    ],
    equipes_btp: [{ id: EQ_MACONS, owner_id: SOC_A, nom: 'Maçons', chantier_id: C_IMMEUBLE }],
    pointage_reglages_btp: [{ owner_id: SOC_A, auto_active: true }],
    settings_btp: [],
    pointages_btp: [
      { id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', employe: 'Paul Exemple', date: '2026-11-13', heure_arrivee: '08:00:00', heure_depart: '16:00:00', pause_minutes: 60, heures_travaillees: 7, mode: 'manuel', arrivee_lat: 43.25, arrivee_lng: 5.38, distance_m: 12, created_at: '2026-11-13T07:00:00Z' },
      { id: randomUUID(), owner_id: SOC_A, membre_id: M_JEAN, chantier_id: C_JEAN, chantier_nom: 'Chantier de Jean', employe: 'Jean Test', date: '2026-11-13', heure_arrivee: '08:00:00', heure_depart: '12:00:00', pause_minutes: 0, heures_travaillees: 4, mode: 'manuel', created_at: '2026-11-13T07:00:00Z' },
      { id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', employe: 'Paul Exemple', date: '2026-09-01', heure_arrivee: '08:00:00', heure_depart: '12:00:00', pause_minutes: 0, heures_travaillees: 4, mode: 'manuel', created_at: '2026-09-01T07:00:00Z' },
    ],
  }
  etat.liaisons = [{ equipe_id: EQ_MACONS, membre_id: M_PAUL }]
}
