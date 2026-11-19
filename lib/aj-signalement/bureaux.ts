// ── AJ Signalement : bureaux d'un cabinet client (V1, migration 20261119_signalements_qr_bureaux.sql) ─────────────
//
// Module pur, sans dépendance serveur (importé par lib/validation.ts, lib/aj-signalement/types.ts et le serveur).
// Accord du 17/11/2026 sur les cinq choix de la note des bureaux : la copropriété est rattachée directement à un bureau ;
// bureau obligatoire pour une NOUVELLE fiche gestionnaire dès que son cabinet a un bureau ouvert (fiches existantes
// complétées au fil de l'eau) ; bureaux tenus par le super admin seul ; aucune adresse de contact par bureau en V1 ;
// visibilité inchangée (le bureau n'est qu'un filtre du super admin : rien ici n'entre dans une portée ni dans une
// réponse faite à un gestionnaire). La base reste juge (triggers, clés étrangères composées) ; ces fonctions ne servent
// qu'à refuser plus tôt, avec un code précis, et à mettre les lignes en forme.

/** Nom d'un bureau : 1 à 80 caractères après rognage (CHECK de signalements_qr_bureaux et fonction de création). */
export const NOM_BUREAU_MAX_QR = 80
/** Bureaux d'un cabinet, fermés compris, au plus (plafond de signalements_qr_enregistrer_bureau : plafond_bureaux). */
export const BUREAUX_MAX_PAR_CABINET_QR = 100
/** Valeur du filtre ?bureau= de la liste des gestionnaires : fiches sans bureau d'un cabinet qui a un bureau ouvert. */
export const FILTRE_SANS_BUREAU_QR = 'aucun'

/** Bureau tel qu'une fiche ou une copropriété le porte (vue du super admin). */
export interface BureauResumeQr {
  id: string
  nom: string
  /** Fermé : aucun nouveau rattachement ; ce qui y est rattaché le reste. */
  ferme: boolean
}

/** Bureau de la liste d'un cabinet (GET /cabinets/[id]/bureaux). */
export interface BureauQr extends BureauResumeQr {
  cabinetId: string
  fermeLe: string | null
  creeLe: string
  /** Gestionnaires ACTIFS rattachés (ce sont eux qui empêchent la fermeture). */
  nbGestionnaires: number
  /** Copropriétés ACTIVES rattachées (elles aussi empêchent la fermeture). */
  nbCoproprietes: number
}

/** Ligne de signalements_qr_bureaux telle que les routes la lisent. */
export interface LigneBureauQr {
  id: string
  cabinet_id: string
  nom: string | null
  ferme_le: string | null
  created_at: string | null
}

/** Nombres de bureaux d'un cabinet : tous (fermés compris) et ouverts. */
export interface NombresBureauxQr {
  total: number
  ouverts: number
}

/**
 * Le texte contient-il un caractère de contrôle (C0, DEL, C1) ? La base refuse [[:cntrl:]] dans un nom de bureau ; le
 * schéma Zod le refuse avant elle (400 plutôt qu'une contrainte violée).
 */
export function contientControleQr(texte: string): boolean {
  for (const c of texte) {
    const code = c.codePointAt(0) ?? 0
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true
  }
  return false
}

const estFerme = (l: Pick<LigneBureauQr, 'ferme_le'>): boolean => l.ferme_le !== null && l.ferme_le !== undefined

/** Résumé d'un bureau, posé sur une fiche ou une copropriété. */
export const bureauResumeDepuisLigneQr = (l: Pick<LigneBureauQr, 'id' | 'nom' | 'ferme_le'>): BureauResumeQr => ({
  id: l.id, nom: l.nom ?? '', ferme: estFerme(l),
})

/** Bureau de la liste d'un cabinet, avec les nombres de rattachements actifs (0 s'ils ne sont pas donnés). */
export function bureauDepuisLigneQr(l: LigneBureauQr, rattaches: { gestionnaires: number; coproprietes: number } = { gestionnaires: 0, coproprietes: 0 }): BureauQr {
  return {
    ...bureauResumeDepuisLigneQr(l),
    cabinetId: l.cabinet_id,
    fermeLe: l.ferme_le ?? null,
    creeLe: l.created_at ?? '',
    nbGestionnaires: rattaches.gestionnaires,
    nbCoproprietes: rattaches.coproprietes,
  }
}

/** Nombres de bureaux d'un cabinet. */
export function nombresBureauxQr(bureaux: ReadonlyArray<Pick<LigneBureauQr, 'ferme_le'>>): NombresBureauxQr {
  return { total: bureaux.length, ouverts: bureaux.filter((b) => !estFerme(b)).length }
}

/**
 * Une nouvelle fiche du cabinet doit-elle avoir un bureau ? Oui dès que le cabinet a un bureau OUVERT (même règle que
 * le trigger signalements_qr_bureau_du_gestionnaire). Tant qu'aucun bureau n'existe, rien ne change.
 */
export const bureauRequisQr = (bureaux: ReadonlyArray<Pick<LigneBureauQr, 'ferme_le'>>): boolean => bureaux.some((b) => !estFerme(b))
