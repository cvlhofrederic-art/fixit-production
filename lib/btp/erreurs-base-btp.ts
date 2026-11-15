/**
 * Refus de la base pendant une écriture BTP (POST /api/btp), traduits en message clair pour l'écran
 * (constats donnees-btp-12, base-de-donnees-13 et api-coeur-15, partie /api/btp, de l'audit du 11/11/2026).
 *
 * Avant, tout refus devenait « Erreur serveur » : supprimer un chantier auquel une situation de travaux, une retenue,
 * un sous-traitant, un devis ou une facture est rattaché échouait sans explication. La règle elle-même ne change pas
 * (la base refuse toujours la suppression) : seul le message change.
 * Le message ne reprend jamais le détail brut de la base, qui peut contenir les valeurs de la ligne : seulement la
 * table ou le champ en cause, reconnus dans le texte de l'erreur. Module pur.
 */

export interface ErreurBase { code?: string; message?: string; details?: string | null }
export interface ReponseErreur { status: number; message: string }

export const MESSAGE_FICHE_INTROUVABLE = 'Fiche introuvable : elle a peut-être été supprimée entre-temps.'

/** Ce qui retient une fiche, selon la table qui la désigne encore. */
const RATTACHEMENTS: Record<string, string> = {
  situations_btp: 'une situation de travaux y est rattachée',
  retenues_btp: 'une retenue de garantie y est rattachée',
  dc4_btp: 'un sous-traitant (DC4) y est rattaché',
  devis: 'un devis y est rattaché',
  factures: 'une facture y est rattachée',
  pointages_btp: 'un pointage y est rattaché',
  depenses_btp: 'une dépense y est rattachée',
  equipes_btp: 'une équipe y est rattachée',
  equipe_membres_btp: 'une équipe y est rattachée',
  rapports_btp: 'un rapport y est rattaché',
  membres_btp: 'un membre de l\'équipe y est rattaché',
}

/** Début de la phrase, selon la fiche dont la suppression est refusée. */
const SUJETS: Record<string, string> = {
  chantiers_btp: 'Ce chantier ne peut pas être supprimé',
  membres_btp: 'Ce membre de l\'équipe ne peut pas être supprimé',
  equipes_btp: 'Cette équipe ne peut pas être supprimée',
}

const aLaCle = (objet: Record<string, unknown>, cle: string) => Object.prototype.hasOwnProperty.call(objet, cle)

/** Table qui désigne encore la fiche, lue dans le message de PostgreSQL (« … on table "situations_btp" »). */
function tableRattachee(erreur: ErreurBase): string | null {
  const dansMessage = /on table "([^"]+)"\s*$/.exec(erreur.message ?? '')
  const dansDetail = /referenced from table "([^"]+)"/.exec(erreur.details ?? '')
  return dansMessage?.[1] ?? dansDetail?.[1] ?? null
}

/** Champ d'une contrainte nommée « <table>_<champ>_check », la convention de PostgreSQL. */
function champDeContrainte(message: string, table: string): string | null {
  const contrainte = /check constraint "([^"]+)"/.exec(message)?.[1]
  if (!contrainte || !contrainte.startsWith(`${table}_`) || !contrainte.endsWith('_check')) return null
  return contrainte.slice(table.length + 1, -'_check'.length) || null
}

const ERREUR_SERVEUR: ReponseErreur = { status: 500, message: 'Erreur serveur' }

const FORMAT_IMPOSSIBLE: ReponseErreur = {
  status: 400,
  message: 'Enregistrement refusé : une des valeurs saisies n\'a pas le bon format (nombre, date, heure ou identifiant).',
}

/** Refus dont la réponse ne dépend que du code de l'erreur. */
const REPONSES_PAR_CODE: Record<string, ReponseErreur> = {
  PGRST116: { status: 404, message: MESSAGE_FICHE_INTROUVABLE },
  '23505': { status: 409, message: 'Enregistrement refusé : cette fiche existe déjà.' },
  PGRST204: { status: 400, message: 'Enregistrement refusé : un des champs envoyés n\'existe pas.' },
  // Nombre, date ou heure impossibles, identifiant mal formé, texte trop long.
  ...Object.fromEntries(['22P02', '22007', '22008', '22003', '22023', '22001'].map(code => [code, FORMAT_IMPOSSIBLE])),
}

/** Clé étrangère : suppression retenue par une fiche rattachée (409), ou fiche liée introuvable à l'écriture (400). */
function refusCleEtrangere(erreur: ErreurBase, action: string, table: string): ReponseErreur {
  if (action !== 'delete') {
    return { status: 400, message: 'Enregistrement refusé : la fiche liée (chantier, membre ou équipe) est introuvable.' }
  }
  const sujet = aLaCle(SUJETS, table) ? SUJETS[table] : 'Cette fiche ne peut pas être supprimée'
  const rattachee = tableRattachee(erreur)
  const raison = rattachee && aLaCle(RATTACHEMENTS, rattachee) ? RATTACHEMENTS[rattachee] : 'd\'autres données y sont rattachées'
  return { status: 409, message: `${sujet} : ${raison}.` }
}

/** Contrainte CHECK : le champ est nommé quand la contrainte suit la convention de PostgreSQL. */
function refusContrainte(message: string, table: string): ReponseErreur {
  const champ = champDeContrainte(message, table)
  return { status: 400, message: champ ? `Enregistrement refusé : valeur non autorisée pour ${champ}.` : 'Enregistrement refusé : une des valeurs saisies n\'est pas autorisée.' }
}

/** Champ obligatoire vide (NOT NULL) : le champ est nommé s'il se lit dans le message. */
function refusChampManquant(message: string): ReponseErreur {
  const champ = /null value in column "([^"]+)"/.exec(message)?.[1]
  return { status: 400, message: champ ? `Enregistrement refusé : champ obligatoire manquant (${champ}).` : 'Enregistrement refusé : un champ obligatoire est manquant.' }
}

/** Réponse à renvoyer pour une erreur de la base pendant l'action `action` sur la table `table`. */
export function traduireErreurBase(erreur: ErreurBase | null | undefined, action: string, table: string): ReponseErreur {
  if (!erreur) return ERREUR_SERVEUR
  const code = erreur.code ?? ''
  const message = erreur.message ?? ''
  if (code === '23503') return refusCleEtrangere(erreur, action, table)
  if (code === '23514') return refusContrainte(message, table)
  if (code === '23502') return refusChampManquant(message)
  return aLaCle(REPONSES_PAR_CODE, code) ? REPONSES_PAR_CODE[code] : ERREUR_SERVEUR
}
