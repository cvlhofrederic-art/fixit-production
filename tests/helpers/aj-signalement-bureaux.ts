// tests/helpers/aj-signalement-bureaux.ts — bureaux des cabinets dans la base simulée (PR 1 des bureaux).
//
// Fonctions SQL de la migration 20261119_signalements_qr_bureaux.sql simulées au plus près de leurs règles visibles
// depuis les routes (le vrai PostgreSQL est essayé par tests/migrations/signalements_qr_bureaux.execution.test.ts) :
//   - signalements_qr_enregistrer_bureau : création ou renommage, nom unique dans le cabinet à la casse et aux espaces
//     près (nom_pris), plafond de 100 (plafond_bureaux), cabinet ou bureau inconnu (a_reverifier), journal ;
//   - signalements_qr_fermer_bureau : fermeture refusée si un gestionnaire actif ou une copropriété active y est
//     rattaché (bureau_utilise), réouverture, journal ;
//   - les triggers des écritures directes (fiche et copropriété) ne sont pas joués par la base simulée : les routes
//     contrôlent avant d'écrire, et le vrai PostgreSQL juge en dernier.
// Et l'état de la production AVANT cette migration (table, colonnes et fonctions absentes). Aucune donnée réelle :
// bureaux « Nord », « Sud », cabinets d'exemple.

import { baseQr, type creerBaseQr, type Ligne } from './aj-signalement-base'

type BaseQr = ReturnType<typeof creerBaseQr>

const ERREUR_METIER = (message: string) => ({ error: { code: 'P0001', message } })

let compteurBureaux = 0
/** Identifiant tiré par la fonction de création simulée (…b01, …b02…). */
export const idBureauSimule = (n: number): string => `b0000000-0000-4000-8000-000000000${String(n).padStart(3, '0')}`

/** Ligne de signalements_qr_bureaux. */
export const ligneBureauQr = (id: string, cabinetId: string, nom: string, sur: Ligne = {}): Ligne => ({
  id, cabinet_id: cabinetId, nom, ferme_le: null, cree_par: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
  created_at: '2026-11-19T09:00:00+00:00', updated_at: '2026-11-19T09:00:00+00:00', ...sur,
})

/** Fonctions SQL des bureaux, simulées dans la base partagée (à appeler après baseQr.reinitialiser()). */
export function simulerFonctionsBureauxQr(base: BaseQr = baseQr): void {
  compteurBureaux = 0
  const journal = (cabinetId: unknown, acteur: unknown, details: Record<string, unknown>) =>
    base.table('signalements_qr_journal').push({
      action: 'cabinet.modifie', cabinet_id: cabinetId, acteur_id: acteur, acteur_profil: 'super_admin', champs: ['bureaux'], details,
    })
  base.etat.fonctions.signalements_qr_enregistrer_bureau = (a) => {
    const nom = typeof a.p_nom === 'string' ? a.p_nom.trim() : ''
    if (!a.p_cabinet || !a.p_acteur || nom.length < 1 || nom.length > 80) return { error: { code: '22023', message: 'parametre_invalide' } }
    // Identifiants des cabinets en texte : une autre valeur ne désigne aucun cabinet (a_reverifier).
    const cabinetId = typeof a.p_cabinet === 'string' ? a.p_cabinet : null
    if (cabinetId === null || !base.table('signalements_qr_cabinets').some((c) => c.id === cabinetId)) return ERREUR_METIER('a_reverifier')
    const bureaux = base.table('signalements_qr_bureaux')
    const existant = a.p_bureau ? bureaux.find((b) => b.id === a.p_bureau && b.cabinet_id === a.p_cabinet) : undefined
    if (a.p_bureau && !existant) return ERREUR_METIER('a_reverifier')
    if (existant?.nom === nom) return { data: { id: existant.id, cree: false, modifie: false } }
    if (bureaux.some((b) => b.cabinet_id === a.p_cabinet && String(b.nom).trim().toLowerCase() === nom.toLowerCase() && b.id !== a.p_bureau)) {
      return ERREUR_METIER('nom_pris')
    }
    if (existant) {
      existant.nom = nom
      journal(a.p_cabinet, a.p_acteur, { bureau: 'renomme', bureauId: existant.id })
      return { data: { id: existant.id, cree: false, modifie: true } }
    }
    if (bureaux.filter((b) => b.cabinet_id === a.p_cabinet).length >= 100) return ERREUR_METIER('plafond_bureaux')
    compteurBureaux += 1
    const id = idBureauSimule(compteurBureaux)
    bureaux.push(ligneBureauQr(id, cabinetId, nom, { cree_par: a.p_acteur }))
    journal(a.p_cabinet, a.p_acteur, { bureau: 'cree', bureauId: id })
    return { data: { id, cree: true, modifie: true } }
  }
  base.etat.fonctions.signalements_qr_fermer_bureau = (a) => {
    if (!a.p_bureau || typeof a.p_fermer !== 'boolean' || !a.p_acteur) return { error: { code: '22023', message: 'parametre_invalide' } }
    const b = base.table('signalements_qr_bureaux').find((x) => x.id === a.p_bureau)
    if (!b) return ERREUR_METIER('a_reverifier')
    if (a.p_fermer === (b.ferme_le !== null && b.ferme_le !== undefined)) return { data: { id: b.id, modifie: false } }
    if (a.p_fermer && (base.table('signalements_qr_gestionnaires').some((g) => g.bureau_id === b.id && g.actif === true)
      || base.table('signalements_qr_coproprietes').some((c) => c.bureau_id === b.id && c.actif !== false))) {
      return ERREUR_METIER('bureau_utilise')
    }
    b.ferme_le = a.p_fermer ? '2026-11-19T10:00:00+00:00' : null
    journal(b.cabinet_id, a.p_acteur, { bureau: a.p_fermer ? 'ferme' : 'rouvert', bureauId: b.id })
    return { data: { id: b.id, modifie: true } }
  }
}

// ── La production avant la migration du 19/11/2026 (bureaux) ─────────────────────────────────────────────────────

export const TABLES_MIGRATION_BUREAUX_QR: readonly string[] = ['signalements_qr_bureaux']
export const COLONNES_MIGRATION_BUREAUX_QR: Readonly<Record<string, readonly string[]>> = {
  signalements_qr_gestionnaires: ['bureau_id'],
  signalements_qr_coproprietes: ['bureau_id'],
}
export const FONCTIONS_MIGRATION_BUREAUX_QR: readonly string[] = ['signalements_qr_enregistrer_bureau', 'signalements_qr_fermer_bureau']

/**
 * Met la base simulée dans l'état de la production avant la migration des bureaux (les précédentes appliquées) : table
 * absente (PGRST205, comme PostgREST 13), colonnes absentes (42703 / PGRST204), fonctions retirées (PGRST202). La
 * création d'une fiche garde sa signature : sa version simulée par le test reste en place.
 */
export function simulerProductionAvantBureauxQr(base: BaseQr = baseQr): void {
  base.etat.codeTableAbsente = 'PGRST205'
  base.etat.tablesAbsentes = [...new Set([...base.etat.tablesAbsentes, ...TABLES_MIGRATION_BUREAUX_QR])]
  for (const [table, colonnes] of Object.entries(COLONNES_MIGRATION_BUREAUX_QR)) {
    base.etat.colonnesAbsentes[table] = [...new Set([...(base.etat.colonnesAbsentes[table] ?? []), ...colonnes])]
  }
  for (const fonction of FONCTIONS_MIGRATION_BUREAUX_QR) delete base.etat.fonctions[fonction]
}
