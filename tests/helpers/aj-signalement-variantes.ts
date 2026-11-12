// tests/helpers/aj-signalement-variantes.ts — fonctions SQL de la 20261112 qui appliquent la règle « adresse d'une
// fiche » (contrôle 2 de la PR 2, constats C1 à C3), simulées au plus près de leur corps pour les tests de routes :
//   - signalements_qr_pseudonymiser_gestionnaire (effacement RGPD : saisies de la fiche retirées, PUIS nom et e-mail
//     effacés, dans une transaction) ;
//   - signalements_qr_desactiver_gestionnaire, partie « saisies » (règle de la 20261112, ou égalité exacte de la
//     20261111 : un départ fait AVANT la 20261112 laisse les variantes) ;
//   - signalements_qr_emails_gestionnaires (destinataires confirmés ; exclusions par la règle, saisie rendue telle quelle).
// La règle est la jumelle TypeScript estAdresseDeFicheQr, dont les réponses sont celles de la fonction SQL sur la table de
// cas commune (tests/lib/aj-signalement-adresse-de-fiche.test.ts, essai PGlite) ; la garde (saisie de la fiche SEULE,
// contre-vérification du 12/11) est saisieDeLaFicheQr, jumelle de signalements_qr_saisie_de_la_fiche, mêmes réponses sur
// la table commune (gardes). Données fictives seulement.

import { estAdresseDeFicheQr } from '@/lib/aj-signalement/gestionnaires'
import { baseQr, type Ligne } from './aj-signalement-base'

const NOW = '2026-11-12T09:00:00+00:00'

/** Domaines déclarés du cabinet (v_domaines des fonctions SQL), triés. */
export const domainesDuCabinetQr = (cabinetId: unknown): string[] =>
  baseQr.table('signalements_qr_domaines_autorises').filter((d) => d.cabinet_id === cabinetId).map((d) => String(d.domaine)).sort((a, b) => a.localeCompare(b))

const saisies = (c: Ligne): string[] => (Array.isArray(c.emails_destinataires) ? (c.emails_destinataires as string[]) : [])

/** Fiche vue par la garde : identifiant, cabinet, adresse (NULL : effacée), active, contestée. */
export interface FicheGardeQr { id: string; cabinetId: string | null; email: string | null; actif: boolean; contestee: boolean }

/** Ce que la garde lit en base : les fiches, les domaines d'un cabinet, les attributions. */
export interface MondeGardeQr {
  fiches: readonly FicheGardeQr[]
  domainesDuCabinet: (cabinetId: string | null) => string[]
  attribuee: (ficheId: string, coproprieteId: string) => boolean
}

/**
 * Jumelle de signalements_qr_saisie_de_la_fiche (20261112) : la saisie est celle de la fiche SEULE quand la règle la
 * reconnaît comme l'adresse de la fiche (domaines de SON cabinet) et comme celle d'aucune AUTRE fiche active et non
 * contestée du cabinet de la copropriété (domaines de ce cabinet) ; au retrait d'une attribution (`retrait`), une autre
 * fiche ne compte que si elle est attribuée à la copropriété. Copropriété sans cabinet : aucune autre fiche.
 */
export function saisieDeLaFicheQr(
  adresse: unknown,
  fiche: { id: string; email: string | null; domaines: readonly string[] },
  copropriete: { id: string; cabinetId: string | null },
  retrait: boolean,
  monde: MondeGardeQr,
): boolean {
  if (!estAdresseDeFicheQr(adresse, fiche.email, fiche.domaines)) return false
  if (copropriete.cabinetId === null) return true
  const domaines = monde.domainesDuCabinet(copropriete.cabinetId)
  return !monde.fiches.some((o) => o.cabinetId === copropriete.cabinetId && o.id !== fiche.id && o.actif && !o.contestee
    && o.email !== null && (!retrait || monde.attribuee(o.id, copropriete.id)) && estAdresseDeFicheQr(adresse, o.email, domaines))
}

/** Le monde de la garde lu dans la base simulée. */
export function mondeSimuleQr(): MondeGardeQr {
  return {
    fiches: baseQr.table('signalements_qr_gestionnaires').map((g) => ({
      id: String(g.id), cabinetId: typeof g.cabinet_id === 'string' ? g.cabinet_id : null,
      email: typeof g.email === 'string' ? g.email : null, actif: g.actif === true, contestee: Boolean(g.adresse_contestee_le),
    })),
    domainesDuCabinet: (cabinetId) => domainesDuCabinetQr(cabinetId),
    attribuee: (ficheId, coproprieteId) =>
      baseQr.table('signalements_qr_attributions').some((a) => a.gestionnaire_id === ficheId && a.copropriete_id === coproprieteId),
  }
}

const coproprieteGardeQr = (c: Ligne) => ({ id: String(c.id), cabinetId: typeof c.cabinet_id === 'string' ? c.cabinet_id : null })

/**
 * signalements_qr_saisies_sans_fiche sur TOUTES les copropriétés (quel que soit leur cabinet) qui ont une saisie de la
 * fiche, une ligne de journal copropriete.modifiee (motif depart) par copropriété retouchée ; rend leur nombre.
 * `regle` : 'variantes' (20261112 : la garde, saisieDeLaFicheQr) ou 'exacte' (array_remove de la 20261111).
 */
function retirerSaisiesDeFicheQr(fiche: Ligne, acteur: unknown, regle: 'variantes' | 'exacte'): number {
  const email = typeof fiche.email === 'string' ? fiche.email : null
  if (email === null) return 0
  const domaines = domainesDuCabinetQr(fiche.cabinet_id)
  const monde = mondeSimuleQr()
  const laFiche = { id: String(fiche.id), email, domaines }
  let retouchees = 0
  for (const c of baseQr.table('signalements_qr_coproprietes')) {
    const deFiche = (e: string) => (regle === 'exacte' ? e === email : saisieDeLaFicheQr(e, laFiche, coproprieteGardeQr(c), false, monde))
    const avant = saisies(c)
    if (!avant.some(deFiche)) continue
    c.emails_destinataires = avant.filter((e) => !deFiche(e))
    retouchees += 1
    baseQr.table('signalements_qr_journal').push({
      action: 'copropriete.modifiee', cabinet_id: c.cabinet_id, acteur_id: acteur, acteur_profil: 'super_admin', copropriete_id: c.id,
      gestionnaire_id: fiche.id, champs: ['emails_destinataires'], details: { motif: 'depart' }, created_at: NOW,
    })
  }
  return retouchees
}

/** signalements_qr_pseudonymiser_gestionnaire (20261112). */
export function simulerPseudonymisationQr(): void {
  baseQr.etat.fonctions.signalements_qr_pseudonymiser_gestionnaire = (a) => {
    if (!a.p_id || !a.p_acteur) return { error: { code: '22023', message: 'parametre_invalide' } }
    const fiche = baseQr.table('signalements_qr_gestionnaires').find((g) => g.id === a.p_id)
    if (!fiche || fiche.actif === true) return { error: { code: 'P0001', message: 'a_reverifier' } }
    if (fiche.pseudonymise_le) return { data: { pseudonymisee: false, adressesRetirees: 0 } }
    const adressesRetirees = retirerSaisiesDeFicheQr(fiche, a.p_acteur, 'variantes')
    Object.assign(fiche, { nom: null, email: null, pseudonymise_le: NOW })
    return { data: { pseudonymisee: true, adressesRetirees } }
  }
}

/**
 * signalements_qr_desactiver_gestionnaire réduit au départ « sans successeur » : fiche désactivée, attributions
 * retirées, jetons effacés, saisies de la fiche retirées (règle de la 20261112, ou égalité exacte de la 20261111).
 */
export function simulerDepartQr(regle: 'variantes' | 'exacte'): void {
  baseQr.etat.fonctions.signalements_qr_desactiver_gestionnaire = (a) => {
    const fiche = baseQr.table('signalements_qr_gestionnaires').find((g) => g.id === a.p_id)
    if (fiche?.actif !== true) return { error: { code: 'P0001', message: 'a_reverifier' } }
    const attributions = baseQr.table('signalements_qr_attributions')
    const sans = attributions.filter((x) => x.gestionnaire_id === a.p_id).length
    baseQr.etat.tables.signalements_qr_attributions = attributions.filter((x) => x.gestionnaire_id !== a.p_id)
    Object.assign(fiche, { actif: false, desactive_le: NOW })
    for (const e of baseQr.table('signalements_qr_invitations')) if (e.gestionnaire_id === a.p_id) e.invite_token = null
    const adressesRetirees = retirerSaisiesDeFicheQr(fiche, a.p_acteur, regle)
    return { data: { deplacees: 0, laisseesSansGestionnaire: sans, adressesRetirees } }
  }
}

/**
 * signalements_qr_emails_gestionnaires (20261112) : exclusions d'abord (saisie rendue : celle d'une fiche partie ou
 * contestée SEULE, par la garde), puis gestionnaires ; 100 au plus.
 */
export function simulerDestinatairesQr(): void {
  baseQr.etat.fonctions.signalements_qr_emails_gestionnaires = (a) => {
    const c = baseQr.table('signalements_qr_coproprietes').find((x) => x.id === a.p_copropriete)
    if (!c) return { data: [] }
    const fiches = baseQr.table('signalements_qr_gestionnaires')
    const monde = mondeSimuleQr()
    const attribuee = (g: Ligne) => c.attribuee_a_tous === true
      || baseQr.table('signalements_qr_attributions').some((x) => x.copropriete_id === c.id && x.gestionnaire_id === g.id)
    const deLaFicheSeule = (e: string, g: Ligne) => saisieDeLaFicheQr(
      e, { id: String(g.id), email: typeof g.email === 'string' ? g.email : null, domaines: domainesDuCabinetQr(g.cabinet_id) }, coproprieteGardeQr(c), false, monde,
    )
    const exclues = saisies(c).flatMap((e) => fiches
      .filter((g) => (g.actif !== true || g.adresse_contestee_le) && deLaFicheSeule(e, g))
      .map((g) => ({ gestionnaire_id: g.id, email: e, acces_ouvert: false, exclu: true })))
    const recoivent = fiches
      .filter((g) => g.cabinet_id === c.cabinet_id && g.actif === true && g.email && g.adresse_confirmee_le && !g.adresse_contestee_le && attribuee(g))
      .map((g) => ({
        gestionnaire_id: g.id, email: g.email, acces_ouvert: Boolean(g.user_id && g.acces_ouvert_le && !g.connexion_bloquee_le), exclu: false,
      }))
    return { data: [...exclues, ...recoivent].slice(0, 100) }
  }
  baseQr.etat.fonctions.signalements_qr_reserver_emails = () => ({ data: { accorde: true, retenus: 0 } })
}
