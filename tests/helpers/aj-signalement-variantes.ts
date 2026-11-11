// tests/helpers/aj-signalement-variantes.ts — fonctions SQL de la 20261112 qui appliquent la règle « adresse d'une
// fiche » (contrôle 2 de la PR 2, constats C1 à C3), simulées au plus près de leur corps pour les tests de routes :
//   - signalements_qr_pseudonymiser_gestionnaire (effacement RGPD : saisies de la fiche retirées, PUIS nom et e-mail
//     effacés, dans une transaction) ;
//   - signalements_qr_desactiver_gestionnaire, partie « saisies » (règle de la 20261112, ou égalité exacte de la
//     20261111 : un départ fait AVANT la 20261112 laisse les variantes) ;
//   - signalements_qr_emails_gestionnaires (destinataires confirmés ; exclusions par la règle, saisie rendue telle quelle).
// La règle est la jumelle TypeScript estAdresseDeFicheQr, dont les réponses sont celles de la fonction SQL sur la table de
// cas commune (tests/lib/aj-signalement-adresse-de-fiche.test.ts, essai PGlite). Données fictives seulement.

import { estAdresseDeFicheQr } from '@/lib/aj-signalement/gestionnaires'
import { baseQr, type Ligne } from './aj-signalement-base'

const NOW = '2026-11-12T09:00:00+00:00'

/** Domaines déclarés du cabinet (v_domaines des fonctions SQL), triés. */
export const domainesDuCabinetQr = (cabinetId: unknown): string[] =>
  baseQr.table('signalements_qr_domaines_autorises').filter((d) => d.cabinet_id === cabinetId).map((d) => String(d.domaine)).sort((a, b) => a.localeCompare(b))

const saisies = (c: Ligne): string[] => (Array.isArray(c.emails_destinataires) ? (c.emails_destinataires as string[]) : [])

/**
 * signalements_qr_saisies_sans_fiche sur TOUTES les copropriétés (quel que soit leur cabinet) qui ont une saisie de la
 * fiche, une ligne de journal copropriete.modifiee (motif depart) par copropriété retouchée ; rend leur nombre.
 * `regle` : 'variantes' (20261112) ou 'exacte' (array_remove de la 20261111).
 */
function retirerSaisiesDeFicheQr(fiche: Ligne, acteur: unknown, regle: 'variantes' | 'exacte'): number {
  const email = typeof fiche.email === 'string' ? fiche.email : null
  if (email === null) return 0
  const domaines = domainesDuCabinetQr(fiche.cabinet_id)
  const deFiche = (e: string) => (regle === 'exacte' ? e === email : estAdresseDeFicheQr(e, email, domaines))
  let retouchees = 0
  for (const c of baseQr.table('signalements_qr_coproprietes')) {
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
    if (!fiche || fiche.actif !== true) return { error: { code: 'P0001', message: 'a_reverifier' } }
    const attributions = baseQr.table('signalements_qr_attributions')
    const sans = attributions.filter((x) => x.gestionnaire_id === a.p_id).length
    baseQr.etat.tables.signalements_qr_attributions = attributions.filter((x) => x.gestionnaire_id !== a.p_id)
    Object.assign(fiche, { actif: false, desactive_le: NOW })
    for (const e of baseQr.table('signalements_qr_invitations')) if (e.gestionnaire_id === a.p_id) e.invite_token = null
    const adressesRetirees = retirerSaisiesDeFicheQr(fiche, a.p_acteur, regle)
    return { data: { deplacees: 0, laisseesSansGestionnaire: sans, adressesRetirees } }
  }
}

/** signalements_qr_emails_gestionnaires (20261112) : exclusions d'abord (saisie rendue), puis gestionnaires ; 100 au plus. */
export function simulerDestinatairesQr(): void {
  baseQr.etat.fonctions.signalements_qr_emails_gestionnaires = (a) => {
    const c = baseQr.table('signalements_qr_coproprietes').find((x) => x.id === a.p_copropriete)
    if (!c) return { data: [] }
    const fiches = baseQr.table('signalements_qr_gestionnaires')
    const attribuee = (g: Ligne) => c.attribuee_a_tous === true
      || baseQr.table('signalements_qr_attributions').some((x) => x.copropriete_id === c.id && x.gestionnaire_id === g.id)
    const exclues = saisies(c).flatMap((e) => fiches
      .filter((g) => (g.actif !== true || g.adresse_contestee_le) && estAdresseDeFicheQr(e, g.email as string | null, domainesDuCabinetQr(g.cabinet_id)))
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
