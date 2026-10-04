import type { EntreeIndexRecherche, TypeEntreeIndex } from '@/lib/administrateur-judiciaire/domain/recherche'
import type { EtapeRecouvrement } from '@/lib/administrateur-judiciaire/domain/recouvrement'
import { normaliserTexteLibre } from '@/lib/administrateur-judiciaire/domain/texte'

/**
 * Compréhension des demandes adressées à Fixy : motifs appliqués au texte normalisé (normaliserTexteLibre : sans
 * accents, minuscules, ponctuation → espace) et entités reconnues dans l'index de recherche.
 * L'ordre des motifs et des tests est la logique métier : ne pas le modifier.
 */

/** Étape de recouvrement demandée (premier motif qui correspond). */
export const MOTIFS_ETAPE_RECOUVREMENT: [RegExp, EtapeRecouvrement][] = [
  [/mise en demeure|mets? en demeure|passe.*demeure/, 'mise_en_demeure'],
  [/exigibilit/, 'exigibilite'],
  [/procedure|assign|tribunal|injonction|action en justice/, 'procedure'],
  [/cl[oô]tur|marque.*sold|solde le dossier|dossier sold|regl[ée] le dossier|termin/, 'solde'],
  [/relance|amiable/, 'amiable'],
]

/** Clé de l'acte à préparer ; « rapport » est traité à part par repondreDemandeFixy (Dossier du juge). */
export type CleActeDemande = 'misedemeure' | 'notification' | 'convocation' | 'requete' | 'etatfrais' | 'pv' | 'rapport'

export const MOTIFS_ACTE_A_PREPARER: [RegExp, CleActeDemande][] = [
  [/mise en demeure/, 'misedemeure'],
  [/notification/, 'notification'],
  [/convocation/, 'convocation'],
  [/prorogation|requete/, 'requete'],
  [/etat de frais|honoraires|taxation/, 'etatfrais'],
  [/proces.verbal|\bpv\b/, 'pv'],
  [/rapport|compte rendu|aide.memoire/, 'rapport'],
]

/** Écran à ouvrir : [motif, route, libellé] ; le libellé sert aussi au titre « J'ouvre … » de la réponse. */
export const MOTIFS_ECRAN_NAVIGATION: [RegExp, string, string][] = [
  [/banque|releve|recouvrement|tresorerie/, 'tresorerie', 'Banque et recouvrement'],
  [/reprise/, 'reprise', 'Reprise judiciaire'],
  [/dossier du juge|rapport au juge|audience/, 'dossierJuge', 'Dossier du juge'],
  [/cockpit|aujourd/, 'cockpit', "Aujourd'hui"],
  [/prise de fonction/, 'priseFonction', 'Prise de fonction'],
  [/dossier juridictionnel/, 'dossierJud', 'Dossier juridictionnel'],
  [/notification/, 'notifJud', 'Registre des notifications'],
  [/obligation/, 'obligations', 'Obligations'],
  [/calendrier/, 'calendrier', 'Calendrier réglementaire'],
  [/fiche/, 'fiche360', 'Fiche 360'],
  [/intervention|ordre de service/, 'interventions', 'Interventions'],
]

/** Mots du libellé ignorés pour la reconnaissance des entités (en plus des mots de moins de 3 lettres). */
export const MOTS_IGNORES_ENTITE = ['les', 'des', 'residence', 'copropriete', 'villa', 'sci', 'lot']

/**
 * Entrée de l'index citée dans une demande (`texteNormalise`), parmi les types demandés. Score = part des mots
 * significatifs du libellé présents dans le texte (inclusion de sous-chaîne, pas de mot entier), + 1 si le libellé
 * complet y figure ; à égalité, la première entrée l'emporte ; retenue à partir de 0,5.
 * Quasi-doublon de trouverEntiteDansCourriel, qui n'a pas le bonus du libellé complet : garder les deux.
 */
export function trouverEntiteDansDemande(
  texteNormalise: string,
  index: EntreeIndexRecherche[],
  types: TypeEntreeIndex[],
): EntreeIndexRecherche | null {
  let meilleure: { entree: EntreeIndexRecherche; score: number } | null = null
  for (const entree of index) {
    if (!types.includes(entree.type)) continue
    const libelle = normaliserTexteLibre(entree.label),
      mots = libelle.split(' ').filter((mot) => mot.length >= 3 && !MOTS_IGNORES_ENTITE.includes(mot))
    if (mots.length === 0) continue
    const trouves = mots.filter((mot) => texteNormalise.includes(mot)).length
    if (trouves === 0) continue
    const score = trouves / mots.length + (texteNormalise.includes(libelle) ? 1 : 0)
    if (!meilleure || score > meilleure.score)
      meilleure = {
        entree,
        score,
      }
  }
  return meilleure && meilleure.score >= 0.5 ? meilleure.entree : null
}

export type TypeIntentionFixy =
  | 'aide'
  | 'action'
  | 'acte'
  | 'navigation'
  | 'intervention'
  | 'juridique'
  | 'debiteurs'
  | 'echeances'
  | 'comptes'
  | 'personne'
  | 'copro'
  | 'inconnu'

export type ConfianceIntentionFixy = 'forte' | 'faible'

/**
 * Intention reconnue. `detail` dépend du type : étape de recouvrement (action), clé d'acte (acte), route
 * (navigation), texte normalisé (intervention, juridique), sinon null.
 */
export interface IntentionFixy {
  texte: string
  cible: EntreeIndexRecherche | null
  detail: string | null
  confiance: ConfianceIntentionFixy
  type: TypeIntentionFixy
}

/**
 * Comprend une demande en langage courant. Ordre des tests : aide ; action (personne reconnue ET verbe impératif en
 * tête) ; acte (verbe de rédaction) ; navigation (« ouvre / va / affiche / montre » en tête) ; intervention ;
 * juridique ; débiteurs ; échéances ; comptes ; personne ; copropriété ; prestataire ; sinon inconnu.
 */
export function comprendreDemandeFixy(texte: string, index: EntreeIndexRecherche[]): IntentionFixy {
  const normalise = normaliserTexteLibre(texte),
    base: Omit<IntentionFixy, 'type'> = {
      texte,
      cible: null,
      detail: null,
      confiance: 'forte',
    }
  if (!normalise)
    return {
      ...base,
      type: 'aide',
      confiance: 'faible',
    }
  if (/^(aide|help|que sais tu|que peux tu|\?)$/.test(normalise) || /que peux tu faire|comment ca marche/.test(normalise))
    return {
      ...base,
      type: 'aide',
    }
  const personne = trouverEntiteDansDemande(normalise, index, ['personne']),
    copro = trouverEntiteDansDemande(normalise, index, ['copro'])
  for (const [motif, etape] of MOTIFS_ETAPE_RECOUVREMENT)
    if (
      motif.test(normalise) &&
      personne &&
      /^(passe|mets?|marque|enregistre|lance|ouvre le dossier|declare|cl[oô]ture|solde le)/.test(normalise)
    )
      return {
        ...base,
        type: 'action',
        cible: personne,
        detail: etape,
      }
  if (/prepare|genere|redige|ecris|fais|sors/.test(normalise)) {
    for (const [motif, cle] of MOTIFS_ACTE_A_PREPARER)
      if (motif.test(normalise))
        return {
          ...base,
          type: 'acte',
          cible: personne || copro,
          detail: cle,
        }
  }
  if (/^(ouvre|va|affiche|montre)( moi)?( dans| sur| la| le| les)? /.test(normalise)) {
    if (personne)
      return {
        ...base,
        type: 'navigation',
        cible: personne,
        detail: 'personne360',
      }
    for (const [motif, route] of MOTIFS_ECRAN_NAVIGATION)
      if (motif.test(normalise))
        return {
          ...base,
          type: 'navigation',
          cible: copro,
          detail: route,
        }
    if (copro)
      return {
        ...base,
        type: 'navigation',
        cible: copro,
        detail: 'fiche360',
      }
  }
  if (/intervention|ordre de service|travaux|fuite|panne|chantier|\bos\b/.test(normalise))
    return {
      ...base,
      type: 'intervention',
      cible: copro,
      detail: normalise,
      confiance: copro ? 'forte' : 'faible',
    }
  if (/article|art\b|art\.|delai legal|que dit la loi|texte|decret|loi\b/.test(normalise))
    return {
      ...base,
      type: 'juridique',
      cible: copro || personne,
      detail: normalise,
    }
  if (/debiteur|impaye|qui doit|retard de paiement|doivent/.test(normalise))
    return {
      ...base,
      type: 'debiteurs',
      cible: copro,
    }
  if (/echeance|delai|en retard|a faire|prochain|quand|urgent|expire/.test(normalise))
    return {
      ...base,
      type: 'echeances',
      cible: copro || personne,
    }
  if (/compte|solde|budget|tresorerie|argent|finance|banque|releve|encaissement/.test(normalise))
    return {
      ...base,
      type: personne ? 'personne' : 'comptes',
      cible: personne || copro,
    }
  if (personne)
    return {
      ...base,
      type: 'personne',
      cible: personne,
    }
  if (copro)
    return {
      ...base,
      type: 'copro',
      cible: copro,
    }
  const prestataire = trouverEntiteDansDemande(normalise, index, ['prestataire'])
  return prestataire
    ? {
        ...base,
        type: 'navigation',
        cible: prestataire,
        detail: 'prestataires',
      }
    : {
        ...base,
        type: 'inconnu',
        confiance: 'faible',
      }
}
