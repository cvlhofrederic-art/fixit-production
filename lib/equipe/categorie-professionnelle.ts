// lib/equipe/categorie-professionnelle.ts
//
// Catégorie professionnelle d'un membre d'équipe BTP (« Encarregado geral », « Chefe de equipa », « Servente »…) :
// un titre saisi par le gérant, affiché dans « Comptes utilisateurs », SANS AUCUN EFFET SUR LES DROITS. Les droits
// viennent du rôle (lib/permissions.ts, PRO_TEAM_ROLES) et des dérogations posées compte par compte. Décision de
// Frédéric du 25/11/2026 : un champ de titre plutôt qu'un nouveau rôle par métier, pour que chaque nouveau titre se
// saisisse sans développement. Colonne pro_team_members.job_title (migration 20261125_pro_team_members_job_title.sql).

/** Longueur maximale, la même que la contrainte CHECK de la colonne. */
export const LONGUEUR_MAX_CATEGORIE = 80

/**
 * Propositions de la liste déroulante ; la saisie reste libre. Portugal : catégories courantes du bâtiment ; France :
 * appellations usuelles de chantier.
 */
export const CATEGORIES_PROPOSEES: Readonly<Record<'pt' | 'fr', readonly string[]>> = {
  pt: ['Encarregado geral', 'Encarregado', 'Chefe de equipa', 'Oficial de 1.ª', 'Oficial de 2.ª', 'Oficial', 'Servente', 'Aprendiz'],
  fr: ['Chef de chantier', "Chef d'équipe", 'Compagnon professionnel', 'Ouvrier qualifié', 'Ouvrier', 'Manœuvre', 'Apprenti'],
}

/**
 * Caractère de contrôle (Cc : C0, DEL, C1) ou de format invisible (Cf : inversion de sens U+202E, espace sans
 * chasse U+200B…) : refusé dans un titre affiché. Les blancs ont déjà été ramenés à une espace.
 */
const CARACTERE_INVISIBLE = /[\p{Cc}\p{Cf}]/u

/**
 * Valeur à enregistrer pour une catégorie reçue du gérant : le texte, blancs réduits à une espace ; `null` pour
 * « aucune catégorie » (null ou texte vide) ; `undefined` si la valeur est refusée (autre type, trop longue,
 * caractère de contrôle).
 */
export function normaliserCategorie(valeur: unknown): string | null | undefined {
  if (valeur === null) return null
  if (typeof valeur !== 'string') return undefined
  const texte = valeur.replace(/\s+/g, ' ').trim()
  if (texte === '') return null
  if (texte.length > LONGUEUR_MAX_CATEGORIE || CARACTERE_INVISIBLE.test(texte)) return undefined
  return texte
}
