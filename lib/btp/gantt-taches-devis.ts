// Planeamento Gantt BTP : une tâche correspond à une ligne d'un devis de l'obra choisie, et porte ses jours et son
// horaire (demande de Frédéric du 28/11/2026 : « chaque tarefa doit correspondre à une ligne du devis pour le chantier
// sélectionné, on doit pouvoir marquer de quel jour à quel jour et de quel h à quel h cette tarefa doit être exécutée »).
//
// Les devis d'une obra sont ceux rattachés au chantier par la colonne devis.chantier_id (sélecteur de chantier du
// formulaire de devis, bouton « Associar orçamento » de l'écran Obras). chantiers_btp n'a pas de colonne devis_id en
// production : une obra créée par « Importar orçamento » n'est pas rattachée à son devis tant qu'on ne l'associe pas.
// Leurs lignes viennent de la colonne devis.items, que la synchronisation (app/api/devis/sync/route.ts) remplit avec
// toutes les lignes du document (buildDocumentLines : main-d'œuvre, matériaux, frais, tableaux personnalisés).
//
// Horaire : les heures valent pour chaque jour de la tâche, du jour de début au jour de fin (« das 08:00 às 17:00 »).
// Les sous-tâches enregistrées avant ce lot n'ont ni ligne de devis ni horaire : elles restent telles quelles.
// Tests : tests/lib/btp-gantt-taches-devis.test.ts.

/** Ligne d'un devis qu'une tâche du Gantt peut planifier. */
export interface LigneDevisPlanifiable {
  /** Clé de la liste de choix : identifiant du devis et rang de la ligne dans devis.items. */
  cle: string
  devisId: string
  devisNumero: string
  /** Identifiant de la ligne dans le devis (ProductLine.id), s'il existe. */
  ligneId: string | null
  /** Rang de la ligne dans devis.items. */
  ligneIndex: number
  /** Désignation de la ligne, espaces et retours à la ligne réduits. */
  description: string
  /** Quantité et unité telles qu'écrites dans le devis (« 25 m2 »), ou chaîne vide. */
  quantite: string
}

export interface DevisDeLObra {
  id: string
  numero: string
  lignes: LigneDevisPlanifiable[]
}

/** Référence d'une tâche du Gantt à une ligne de devis (champs ajoutés à la sous-tâche enregistrée). */
export interface RefLigneDevis {
  devisId?: string
  devisNumero?: string
  ligneId?: string | null
  ligneIndex?: number
}

const texte = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')

/** devis.items est un tableau JSON ; une ancienne ligne peut le porter en texte. */
function lignesBrutes(items: unknown): unknown[] {
  if (Array.isArray(items)) return items
  if (typeof items === 'string' && items.trim().startsWith('[')) {
    try {
      const lu: unknown = JSON.parse(items)
      return Array.isArray(lu) ? lu : []
    } catch {
      // Texte illisible : aucune ligne à proposer (le devis s'affiche alors « sans linhas »).
      return []
    }
  }
  return []
}

/** Quantité d'une ligne : `qty` (ProductLine) ou `quantite` (frais annexe). */
function nombreDe(ligne: Record<string, unknown>): number | null {
  if (typeof ligne.qty === 'number') return ligne.qty
  return typeof ligne.quantite === 'number' ? ligne.quantite : null
}

function quantiteDe(ligne: Record<string, unknown>): string {
  const qte = nombreDe(ligne)
  if (qte === null || !Number.isFinite(qte)) return ''
  const unite = ligne.unit === 'autre' ? texte(ligne.customUnit) : texte(ligne.unit) || texte(ligne.unite)
  return unite ? `${qte} ${unite}` : String(qte)
}

/**
 * Lignes d'un devis (ligne de la table devis, avec `items`) qu'une tâche peut planifier : celles qui ont une
 * désignation (ProductLine.description, ou designation d'un frais annexe). Les lignes vides sont écartées.
 */
export function lignesPlanifiables(devis: Record<string, unknown>): LigneDevisPlanifiable[] {
  const devisId = typeof devis.id === 'string' ? devis.id : ''
  if (!devisId) return []
  const devisNumero = texte(devis.numero)
  return lignesBrutes(devis.items).flatMap((brut, ligneIndex) => {
    if (!brut || typeof brut !== 'object') return []
    const ligne = brut as Record<string, unknown>
    const description = texte(ligne.description) || texte(ligne.designation) || texte(ligne.lineDetail)
    if (!description) return []
    const id = ligne.id
    return [{
      cle: `${devisId}::${ligneIndex}`,
      devisId,
      devisNumero,
      ligneId: typeof id === 'string' || typeof id === 'number' ? String(id) : null,
      ligneIndex,
      description,
      quantite: quantiteDe(ligne),
    }]
  })
}

/**
 * Devis d'une obra (rattachés au chantier par `chantier_id`), dans l'ordre reçu (les plus récents d'abord). Un devis
 * supprimé (`deleted_at`) est écarté ; un devis sans ligne planifiable est gardé (l'écran dit qu'il n'a pas de lignes).
 */
export function devisDeLObra(devis: ReadonlyArray<Record<string, unknown>>, chantierId: string): DevisDeLObra[] {
  if (!chantierId) return []
  const vus = new Set<string>()
  const resultat: DevisDeLObra[] = []
  for (const d of devis) {
    const id = typeof d.id === 'string' ? d.id : ''
    if (!id || vus.has(id) || d.deleted_at || d.chantier_id !== chantierId) continue
    vus.add(id)
    resultat.push({ id, numero: texte(d.numero), lignes: lignesPlanifiables(d) })
  }
  return resultat
}

/**
 * Même ligne de devis : même devis, même rang dans devis.items et, quand les deux l'ont, même identifiant. Le rang
 * seul ne suffit pas (une ligne ajoutée au devis décale les suivantes) ; l'identifiant seul non plus : le formulaire
 * de devis BTP numérote chaque section à partir de 1 (main-d'œuvre, matériaux, frais), et devis.items les met bout à
 * bout, si bien que deux lignes d'un même devis portent souvent le même identifiant.
 */
export function memeLigne(tache: RefLigneDevis, ligne: LigneDevisPlanifiable): boolean {
  if (tache.devisId !== ligne.devisId || tache.ligneIndex !== ligne.ligneIndex) return false
  return !tache.ligneId || !ligne.ligneId || tache.ligneId === ligne.ligneId
}

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/
const JOUR = /^\d{4}-\d{2}-\d{2}$/

export type ErreurPeriode = 'jours_manquants' | 'fin_avant_debut' | 'heures_manquantes' | 'heure_fin_avant_debut'

/**
 * Contrôle des jours (AAAA-MM-JJ) et de l'horaire (HH:MM) d'une tâche. Le jour de fin peut être le jour de début ;
 * l'heure de fin doit suivre l'heure de début (l'horaire vaut pour chaque jour).
 */
export function erreurPeriode(p: { debut: string; fin: string; heureDebut: string; heureFin: string }): ErreurPeriode | null {
  if (!JOUR.test(p.debut) || !JOUR.test(p.fin)) return 'jours_manquants'
  if (p.fin < p.debut) return 'fin_avant_debut'
  if (!HEURE.test(p.heureDebut) || !HEURE.test(p.heureFin)) return 'heures_manquantes'
  if (p.heureFin <= p.heureDebut) return 'heure_fin_avant_debut'
  return null
}

export const MESSAGES_PERIODE: Record<ErreurPeriode, { fr: string; pt: string }> = {
  jours_manquants: { fr: 'Indiquez le jour de début et le jour de fin.', pt: 'Indique o dia de início e o dia de fim.' },
  fin_avant_debut: { fr: 'Le jour de fin précède le jour de début.', pt: 'O dia de fim é anterior ao dia de início.' },
  heures_manquantes: { fr: 'Indiquez l’heure de début et l’heure de fin.', pt: 'Indique a hora de início e a hora de fim.' },
  heure_fin_avant_debut: { fr: 'L’heure de fin doit suivre l’heure de début.', pt: 'A hora de fim tem de ser posterior à hora de início.' },
}

/** Jour AAAA-MM-JJ affiché JJ/MM/AAAA, sans passer par l'heure UTC (un « new Date('2026-12-01') » recule d'un jour à l'ouest). */
export function jourAffiche(jour: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : jour
}

/** « 01/12/2026 → 05/12/2026 », ou le seul jour quand la tâche tient en un jour. */
export function joursAffiches(debut: string, fin: string): string {
  if (!debut && !fin) return ''
  if (!fin || debut === fin) return jourAffiche(debut)
  return `${jourAffiche(debut)} → ${jourAffiche(fin)}`
}

/** « das 08:00 às 17:00 » / « de 08:00 à 17:00 », ou chaîne vide sans horaire (sous-tâche d'avant ce lot). */
export function horaireAffiche(heureDebut: string | undefined, heureFin: string | undefined, isPt: boolean): string {
  if (!heureDebut || !heureFin) return ''
  return isPt ? `das ${heureDebut} às ${heureFin}` : `de ${heureDebut} à ${heureFin}`
}

/**
 * Fin d'une tâche, pour savoir si elle est en retard. Avec un horaire : le jour de fin à l'heure de fin, en heure
 * locale. Sans horaire (sous-tâche d'avant ce lot) : le calcul d'avant, inchangé.
 */
export function finDeTache(t: { fin: string; heureFin?: string }): Date {
  if (t.heureFin && HEURE.test(t.heureFin) && JOUR.test(t.fin)) return new Date(`${t.fin}T${t.heureFin}:00`)
  return new Date(t.fin)
}
