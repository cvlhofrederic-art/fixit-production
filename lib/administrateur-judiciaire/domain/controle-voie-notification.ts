import { estModeElectronique, type ModeNotification } from '@/lib/administrateur-judiciaire/domain/courriers'
import { ajouterJours, dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  ENTREE_EN_VIGUEUR_ART_42_1_LOI_2024,
  ENTREE_EN_VIGUEUR_DECRET_2020,
  ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE,
  accordElectroniqueEnVigueur,
  demandesDepuisConsentements,
  voieDeNotification,
  type ConsentementVoieElectronique,
  type DemandeVoiePostale,
} from '@/lib/administrateur-judiciaire/domain/voie-notification'

/**
 * Contrôle de la voie de notification d'un envoi qui fait courir un délai (J50, J52, J53). Une seule règle pour la
 * notification du procès-verbal d'AG (délai de contestation de L. 1965 art. 42, al. 2 : statut-assemblee.ts) et pour la
 * mise en demeure de L. 1965 art. 19-2 (exigibilité anticipée : recouvrement.ts) : L. 1965 art. 42-1 vise ensemble « les
 * notifications et les mises en demeure » (voie-notification.ts) ; D. 1967 art. 64 et 64-1. Fonctions pures, dates ISO.
 *
 * Code sorti de statut-assemblee.ts le 17/11/2026 (relecture des marques périmées), sans changement de règle ni de
 * message ; les décisions et leurs fondements restent décrits dans l'en-tête de statut-assemblee.ts (J50, J52, J53) et
 * dans celui de voie-notification.ts.
 * 🔵 Lecture de Claude, à confirmer par le référent métier : J52 et J53, prises pour la notification du procès-verbal, valent aussi
 * pour la mise en demeure, que les mêmes textes visent.
 */

const fr = dateIsoVersFr

/** Pourquoi la voie de notification empêche le délai de courir pour ce destinataire. */
export type CauseVoieRefusee = 'voie_postale_demandee' | 'accord_electronique_absent' | 'destinataire_non_renseigne' | 'consentement_lre_absent'

/**
 * Date de l'envoi, à laquelle la voie est jugée (relecture du 14/11/2026) : le dépôt, s'il est saisi et ne suit pas
 * l'événement (première présentation ou transmission de l'avis) ; à défaut, l'événement.
 */
export const dateEnvoiNotification = (depot: string | null | undefined, evenement: string): string =>
  depot && depot <= evenement ? depot : evenement

/** Demandes de voie postale et consentements à la voie électronique (voie-notification.ts) ; absents : aucun enregistré. */
export interface ContexteVoieNotification {
  demandesVoiePostale?: readonly DemandeVoiePostale[]
  consentements?: readonly ConsentementVoieElectronique[]
}

const AVERTISSEMENT_LRAR_HORS_DEMANDE =
  'LRAR sans demande de voie postale enregistrée : délai calculé, validité à confirmer (L. 1965 art. 42-1 ; D. 1967 art. 64-1 ; lecture du GRECCO, préconisation n° 19, source secondaire).'

/**
 * J53 (décision du 17/11/2026, recommandation suivie) : sans consentement enregistré aux envois recommandés
 * électroniques (CPCE art. L. 100), une LRE à un non-professionnel ne vaut pas notification ; l'accord du critère LRE de
 * Gestéam vaut ce consentement ; le prestataire qualifié (D. 1967 art. 64, 2°) n'est pas concerné ; la LRAR reste possible.
 */
const MOTIF_LRE_SANS_CONSENTEMENT =
  "LRE à un destinataire non professionnel (ou dont la qualité n'est pas saisie, lue comme non professionnelle) sans consentement enregistré aux envois recommandés électroniques (CPCE art. L. 100 ; l'accord du critère LRE repris de Gestéam vaut ce consentement) : elle ne vaut pas notification et ne fait pas courir le délai pour lui (décision du 17/11/2026, J53). Enregistrer son consentement s'il l'a donné avant l'envoi, ou le notifier par lettre recommandée avec avis de réception (D. 1967 art. 64-1) ou par le procédé d'un prestataire qualifié (art. 64, 2°)."

/**
 * J53, courrier sans destinataire renseigné (notification unique, finDelaiContestationAg ; relecture contradictoire du
 * 17/11/2026) : le consentement ne peut pas lui être rapproché ; la cause est le destinataire manquant, pas le
 * consentement, que le copropriétaire a pu donner.
 */
const MOTIF_LRE_DESTINATAIRE_INCONNU =
  "Destinataire du courrier rattaché non renseigné : le consentement aux envois recommandés électroniques (CPCE art. L. 100 ; l'accord du critère LRE repris de Gestéam vaut ce consentement), exigé d'un destinataire non professionnel ou dont la qualité n'est pas saisie, ne peut pas lui être rapproché ; la LRE ne vaut donc pas notification (décision du 17/11/2026, J53). Renseigner le destinataire du courrier, ou notifier par lettre recommandée avec avis de réception (D. 1967 art. 64-1) ou par le procédé d'un prestataire qualifié (art. 64, 2°)."

const REDACTION_2020 = `rédaction en vigueur du ${fr(ENTREE_EN_VIGUEUR_DECRET_2020)} au ${fr(ajouterJours(ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE, -1))}`
const REDACTION_ANTERIEURE_2020 = `rédaction antérieure au ${fr(ENTREE_EN_VIGUEUR_DECRET_2020)}`

/**
 * Fondement de l'accord exprès exigé avant le 25/12/2025, selon la date de l'envoi (relecture du 14/11/2026) : jusqu'au
 * 10/04/2024, la loi l'exigeait (L. 1965 art. 42-1, version de la loi n° 2014-366) ; du 11/04/2024 au 24/12/2025, le seul
 * décret (art. 64-3, rédaction en vigueur du 04/07/2020 au 24/12/2025), alors que l'art. 42-1 disait déjà « valablement faites par voie électronique » :
 * portée débattue, lecture prudente.
 */
function fondementAccordExpres(dateEnvoi: string): string {
  if (dateEnvoi < ENTREE_EN_VIGUEUR_DECRET_2020) return `L. 1965 art. 42-1, version de la loi n° 2014-366 ; D. 1967 art. 64 à 64-4, ${REDACTION_ANTERIEURE_2020}`
  if (dateEnvoi < ENTREE_EN_VIGUEUR_ART_42_1_LOI_2024) return `L. 1965 art. 42-1, version de la loi n° 2014-366 ; D. 1967 art. 64-3, ${REDACTION_2020}`
  return `D. 1967 art. 64-3, ${REDACTION_2020} ; L. 1965 art. 42-1, version de la loi du 9 avril 2024 : portée débattue, deux lectures selon le GRECCO, préconisation n° 19, source secondaire ; lecture prudente retenue`
}

/**
 * Fondement d'une demande de voie postale reçue avant le 25/12/2025 (relecture du 14/11/2026, sonde P6) : depuis le
 * 11/04/2024, la demande « à tout moment et par tout moyen » de L. 1965 art. 42-1, al. 2 ; avant, un retrait de l'accord
 * exprès. Effet retenu à sa réception (prudence : le délai de huit jours de l'art. 64-4 actuel n'existait pas).
 */
function fondementDemandeAncienRegime(recueLe: string): string {
  if (recueLe < ENTREE_EN_VIGUEUR_DECRET_2020)
    return `retrait de l'accord exprès à la voie électronique, D. 1967 art. 64 à 64-4, ${REDACTION_ANTERIEURE_2020} ; effet retenu à sa réception`
  if (recueLe < ENTREE_EN_VIGUEUR_ART_42_1_LOI_2024)
    return `retrait de l'accord exprès à la voie électronique, D. 1967 art. 64-4, ${REDACTION_2020} ; effet retenu à sa réception`
  return `« à tout moment et par tout moyen », L. 1965 art. 42-1, al. 2, version de la loi du 9 avril 2024 ; elle vaut au moins retrait de l'accord exprès, D. 1967 art. 64-4, ${REDACTION_2020} ; effet retenu à sa réception, le délai de huit jours de l'art. 64-4 actuel n'existait pas`
}

/**
 * Motif du refus d'un envoi électronique fait depuis le 25/12/2025 à un copropriétaire dont la demande de voie postale
 * est en vigueur (`depuis` : son effet, voieDeNotification). Demande, refus ou retrait reçu avant le 25/12/2025 : effet dès
 * sa réception, ancienne règle (décision du 17/11/2026, J52 : effetDemandeVoiePostale, `depuis` est alors la date
 * de réception) ; il remplace l'avertissement « à confirmer » de la fenêtre du 16 au 24/12/2025 (relecture du
 * 14/11/2026, sonde P9). Reçue depuis : effet de l'art. 64-4 actuel.
 */
function motifVoiePostaleDemandee(depuis: string, dateEnvoi: string, saisies: readonly DemandeVoiePostale[], identite: string): string {
  if (depuis >= ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE)
    return `Voie postale demandée par ce copropriétaire (effet le ${fr(depuis)}) : l'envoi électronique du ${fr(dateEnvoi)} ne fait pas courir le délai pour lui ; le notifier par lettre recommandée avec avis de réception (D. 1967 art. 64-1, 64-4).`
  const enregistree = saisies.some((d) => d.identiteId === identite && d.recueLe === depuis)
  const recue = enregistree
    ? `demande reçue le ${fr(depuis)}, avant le ${fr(ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE)}`
    : `refus de la voie électronique ou retrait de l'accord reçu le ${fr(depuis)}, avant le ${fr(ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE)}, valant demande de voie postale`
  return `Voie postale demandée par ce copropriétaire : ${recue} (${fondementDemandeAncienRegime(depuis)} ; décret du 22/12/2025 sans règle transitoire pour les notifications, C. civ. art. 2 ; décision du 17/11/2026, J52) : l'envoi électronique du ${fr(dateEnvoi)} ne vaut pas notification et ne fait pas courir le délai pour lui ; le notifier par lettre recommandée avec avis de réception (D. 1967 art. 64-1).`
}

/**
 * Voie de notification face au mode (J50) : refus quand le délai ne court pas pour ce copropriétaire (voie postale
 * demandée, dont la demande reçue avant le 25/12/2025, effective dès sa réception : J52 ; accord exprès absent avant le
 * 25/12/2025 ; LRE à un non-professionnel sans consentement enregistré, CPCE art. L. 100 : J53), avertissements sinon.
 * Le régime (avant ou depuis le 25/12/2025),
 * l'accord, le consentement et la demande de voie postale sont jugés à la date de l'ENVOI (`dateEnvoi` : dépôt, à défaut
 * l'événement ; relecture du 14/11/2026, 🔵 interprétation) ; le point de départ reste le lendemain de l'événement.
 */
export function controlerVoieNotification(
  mode: ModeNotification,
  dateEnvoi: string,
  identiteId: string | null,
  professionnel: boolean | null,
  voie: ContexteVoieNotification,
): { cause: CauseVoieRefusee; motif: string } | { avertissements: string[] } {
  const consentements = voie.consentements ?? []
  const demandesSaisies = voie.demandesVoiePostale ?? []
  const avertissements: string[] = []
  if (identiteId === null && (demandesSaisies.length > 0 || consentements.length > 0))
    avertissements.push(
      "Destinataire du courrier non renseigné : les demandes de voie postale et les consentements enregistrés n'ont pas pu lui être rapprochés.",
    )
  const identite = identiteId ?? ''
  const electronique = estModeElectronique(mode)
  const accord = () => accordElectroniqueEnVigueur({ identiteId: identite, consentements, date: dateEnvoi })
  if (dateEnvoi < ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE) {
    if (!electronique) return { avertissements }
    const demande = demandesSaisies
      .filter((d) => d.identiteId === identite && d.recueLe <= dateEnvoi)
      .sort((a, b) => a.recueLe.localeCompare(b.recueLe))[0]
    if (demande !== undefined)
      return {
        cause: 'voie_postale_demandee',
        motif: `Voie postale demandée par ce copropriétaire, demande reçue le ${fr(demande.recueLe)} (${fondementDemandeAncienRegime(demande.recueLe)}) : l'envoi électronique du ${fr(dateEnvoi)} ne fait pas courir le délai pour lui ; le notifier par lettre recommandée avec avis de réception (D. 1967 art. 64-1).`,
      }
    if (accord() === null)
      return {
        cause: 'accord_electronique_absent',
        motif: `Notification électronique envoyée le ${fr(dateEnvoi)}, avant le ${fr(ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE)} : accord exprès du copropriétaire à la voie électronique non enregistré (${fondementAccordExpres(dateEnvoi)}).`,
      }
    return { avertissements }
  }
  const demandes = [...demandesSaisies, ...demandesDepuisConsentements(consentements, dateEnvoi)]
  const { voie: voieApplicable, depuis } = voieDeNotification({ identiteId: identite, demandes, date: dateEnvoi })
  if (electronique && voieApplicable === 'postale')
    return { cause: 'voie_postale_demandee', motif: motifVoiePostaleDemandee(depuis ?? dateEnvoi, dateEnvoi, demandesSaisies, identite) }
  // LRAR : avertissement seulement si aucune demande n'est reçue à l'envoi (une demande reçue, même pas encore effective,
  // justifie la voie postale ; relecture du 14/11/2026)
  if (!electronique && !demandes.some((d) => d.identiteId === identite && d.recueLe <= dateEnvoi)) avertissements.push(AVERTISSEMENT_LRAR_HORS_DEMANDE)
  // J53 : la LRE vers un non-professionnel (ou de qualité non saisie) exige son consentement (CPCE art. L. 100), lu dans
  // l'accord du critère LRE en vigueur à la date de l'envoi ; sans destinataire renseigné, rien à lui rapprocher
  if (mode === 'lre' && professionnel !== true && accord() === null)
    return identiteId === null
      ? { cause: 'destinataire_non_renseigne', motif: MOTIF_LRE_DESTINATAIRE_INCONNU }
      : { cause: 'consentement_lre_absent', motif: MOTIF_LRE_SANS_CONSENTEMENT }
  return { avertissements }
}
