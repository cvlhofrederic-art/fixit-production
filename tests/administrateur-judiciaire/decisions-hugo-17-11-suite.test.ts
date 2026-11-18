import './fuseau-paris'
import { describe, expect, it } from 'vitest'
import { creerReglagesComptesCabinet } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import type { CourrierSuivi } from '@/lib/administrateur-judiciaire/domain/courriers'
import { composerDateIso as d } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  changerStatutEnvoi,
  creerEnvoiNotificationElectronique,
  creerEnvoiSignatureElectronique,
  lireNotificationElectronique,
  type EnvoiNotificationElectronique,
} from '@/lib/administrateur-judiciaire/domain/envois-electroniques'
import { segmentPlanOs } from '@/lib/administrateur-judiciaire/domain/envoi-ordre-service'
import {
  DECLENCHEUR_HONORAIRES_MISE_EN_DEMEURE,
  DECLENCHEUR_MISE_EN_DEMEURE,
  NAISSANCE_COPIE_AU_CS_PAR_DEFAUT,
  REGLES_ETAPES_COURRIER_PAR_DEFAUT,
  courrierDeclenche,
  declencherEtapesDuCourrier,
  regleCopieAuCsPourInfo,
  regleHonorairesMiseEnDemeure,
  type ContexteDeclenchementEtapes,
  type CourrierDeclencheur,
} from '@/lib/administrateur-judiciaire/domain/etapes-courrier'
import { USAGES_ETAPES_CABINET_PAR_DEFAUT } from '@/lib/administrateur-judiciaire/domain/etapes-dossier'
import { creerRattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import { echeancesFondsDetenusDeLAnnee, fondsDetenusA, type DonneesFondsDetenus } from '@/lib/administrateur-judiciaire/domain/fonds-detenus'
import { finDelaiContestationAg, type ContexteVoieNotification, type ResultatDelaiContestation } from '@/lib/administrateur-judiciaire/domain/statut-assemblee'
import { creerTraitement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import { assietteDroitProportionnelTravaux } from '@/lib/administrateur-judiciaire/domain/travaux-budget'
import {
  accordElectroniqueEnVigueur,
  creerConsentementVoieElectronique,
  demandesDepuisConsentements,
  type ConsentementVoieElectronique,
} from '@/lib/administrateur-judiciaire/domain/voie-notification'
import { chaineLe, lreLe } from './donnees-delai-contestation'
import { enTeteDuModule } from './en-tete-module'

/**
 * Suite des décisions de Hugo du 17/11/2026 (DECISIONS-HUGO-2026-11-17.md, section « Suite » : recommandations « selon la
 * loi » validées en bloc ; numéros de registre proposés J57 à J64) :
 * - J57 : LRE (ou procédé du prestataire qualifié) refusée ou non réclamée : le délai court quand même, du lendemain de la
 *   transmission de l'avis électronique (D. 1967 art. 64, dernier al.) ;
 * - J58 : après un échec d'envoi électronique, créer un nouveau courrier ;
 * - J59 : refus reçu avant le 25/12/2025 puis accord reçu depuis : l'accord daté l'emporte ; sans date valable, non ;
 * - J60 : contrôle technique et coordonnateur sécurité exclus de l'assiette du droit proportionnel ;
 * - J61 : segment « plan » du N° d'OS = date du premier envoi ;
 * - J62 : compte sans IBAN = compte global de l'administrateur tant que l'IBAN n'est pas saisi ;
 * - J63 : « avant le 15 mars / 15 septembre » = le 14 au plus tard ;
 * - J64 : Copie au CS née du courrier, sur les seules mises en demeure du contentieux (19-2 comprise), pas les relances ;
 *   réglage désactivé par défaut (J41).
 */

/** Partie du texte qui suit le marqueur, dans l'en-tête du module (les questions ouvertes, en général). */
const apres = (texte: string, marqueur: string): string => {
  const i = texte.indexOf(marqueur)
  if (i < 0) throw new Error(`Marqueur « ${marqueur} » introuvable.`)
  return texte.slice(i)
}

// ─── Envois électroniques (J57, J58) ────────────────────────────────────────────────────────────────

const H = (heure: string) => `2026-11-17T${heure}:00Z`
const courrierLre = { id: 'C1', formeEnvoi: 'Email', modeNotification: 'lre' } as const

const notification = (surcharge: Partial<Parameters<typeof creerEnvoiNotificationElectronique>[0]> = {}) =>
  creerEnvoiNotificationElectronique({ id: 'E1', courrier: courrierLre, horodatage: H('08:00'), ...surcharge })

function enchainer(envoi: EnvoiNotificationElectronique, statuts: string[], debut = 9): EnvoiNotificationElectronique {
  return statuts.reduce((e, statut, i) => changerStatutEnvoi(e, { statut, horodatage: H(`${String(debut).padStart(2, '0')}:${String(i).padStart(2, '0')}`) }), envoi)
}

const suivi = (surcharge: Partial<CourrierSuivi & { id: string }> = {}): CourrierSuivi & { id: string } => ({
  id: 'C1',
  formeEnvoi: 'Email',
  modeNotification: 'lre',
  dateDepot: '2026-11-16',
  datePremierePresentation: null,
  dateAccuseReception: null,
  dateAvisElectronique: null,
  ...surcharge,
})

const recuEnErreur = () => enchainer(notification(), ["Attente d'envoi", 'En cours', 'Envoyé OK', 'Reçu en erreur'])

// ─── Délai de contestation (comme decisions-hugo-17-11.test.ts) ─────────────────────────────────────

// ligne, chaineLe et lreLe : ./donnees-delai-contestation (partagés avec l'autre fichier des décisions du 17/11).

const lreDu = (date: string, voie: ContexteVoieNotification, professionnel: boolean | null = true) =>
  finDelaiContestationAg(chaineLe(date), [lreLe(date)], 'ag-1', { opposantsOuDefaillants: 1, professionnel, voie })

const motifDe = (resultat: ResultatDelaiContestation): string => {
  if (resultat.etat !== 'refuse') throw new Error(`Refus attendu : ${JSON.stringify(resultat)}`)
  return resultat.motif
}

// ─── J57 ────────────────────────────────────────────────────────────────────────────────────────────

describe('J57 — LRE refusée ou non réclamée : le délai court du lendemain de la transmission de l’avis (D. 1967 art. 64, dernier al.)', () => {
  it('« Reçu en erreur » après un avis saisi : la date de l’avis est gardée ; un refus ou une non-réclamation ne la remettent pas en cause', () => {
    const lecture = lireNotificationElectronique(recuEnErreur(), suivi({ dateAvisElectronique: '2026-11-17' }))
    expect(lecture.etatCourrier).toBe('notifie')
    expect(lecture.dateAvisElectronique).toBe('2026-11-17')
    expect(lecture.alertes.map((a) => a.code)).toEqual(['retour_en_erreur_apres_avis'])
    const message = lecture.alertes[0].message
    expect(message).toContain('décision de Hugo du 17/11/2026, J57')
    expect(message).toMatch(/refus ou une non-réclamation après l'avis ne remettent pas en cause sa date/)
    expect(message).toContain('D. 1967 art. 64, dernier al.')
    // « Reçu en erreur » reste distinct d'un défaut de transmission de l'avis : à vérifier sur le justificatif.
    expect(message).toMatch(/défaut de transmission de l'avis/)
    expect(message).toContain("information du destinataire (CPCE art. R. 53-3, I ; interprétation)")
    expect(message).not.toMatch(/n'est pas établi \(🔴\)/)
  })

  it('« Reçu en erreur » sans avis saisi : aucune date affirmée ; à saisir seulement si le justificatif établit la transmission', () => {
    const lecture = lireNotificationElectronique(recuEnErreur(), suivi())
    expect(lecture.dateAvisElectronique).toBeNull()
    expect(lecture.etatCourrier).toBe('envoye_non_notifie')
    expect(lecture.alertes.map((a) => a.code)).toEqual(['avis_a_saisir'])
    const message = lecture.alertes[0].message
    expect(message).toMatch(/ne saisir sa date .*sur le courrier C1 que si ce justificatif l'établit/)
    expect(message).toMatch(/refusé ou non réclamé.*la date de l'avis vaut.*J57/)
    expect(message).toMatch(/défaut de transmission de l'avis : aucune date à saisir/)
    expect(message).not.toMatch(/🔴/)
  })

  it('procédé du prestataire qualifié : même règle, la date se lit sur son justificatif de transmission (D. 1967 art. 64-5)', () => {
    const envoi = enchainer(
      creerEnvoiNotificationElectronique({ id: 'E2', courrier: { id: 'C2', formeEnvoi: 'Email direct', modeNotification: 'prestataire_qualifie' }, horodatage: H('08:00') }),
      ["Attente d'envoi", 'En cours', 'Envoyé OK', 'Reçu en erreur'],
    )
    const lecture = lireNotificationElectronique(envoi, suivi({ id: 'C2', formeEnvoi: 'Email direct', modeNotification: 'prestataire_qualifie', dateAvisElectronique: '2026-11-17' }))
    expect(lecture.alertes[0].message).toContain('J57')
    expect(lecture.alertes[0].message).toContain('justificatif de transmission du prestataire qualifié (D. 1967 art. 64-5)')
  })

  it('le délai de contestation ne lit que la date de l’avis : il court de son lendemain, l’envoi refusé ou non réclamé', () => {
    const resultat = lreDu(d(2026, 3, 5), {})
    expect(resultat).toMatchObject({ etat: 'calcule', mode: 'lre', dateEvenement: d(2026, 3, 5), pointDeDepart: d(2026, 3, 6) })
  })

  it('en-têtes : le refus et la non-réclamation ne sont plus une question ouverte ; J57 citée', () => {
    const envois = enTeteDuModule('envois-electroniques')
    expect(envois.texte).toContain('décision de Hugo du 17/11/2026 (J57)')
    expect(envois.texte).not.toContain('🔴 Refus, non-réclamation ou rejet')
    expect(envois.texte).not.toMatch(/effet sur la notification\s+n'est pas vérifié/)
    const courriers = enTeteDuModule('courriers')
    expect(courriers.texte).toContain('décision de Hugo du 17/11/2026 (J57)')
    expect(courriers.texte).not.toMatch(/non réclamée fait quand même courir le délai, comme une LRAR non retirée \(interprétation, aucun arrêt\)/)
    expect(enTeteDuModule('statut-assemblee').texte).toContain('J57')
  })
})

// ─── J58 ────────────────────────────────────────────────────────────────────────────────────────────

describe('J58 — après un échec d’envoi électronique : créer un nouveau courrier (un envoi en échec n’a rien notifié)', () => {
  const echec = () => enchainer(notification(), ["Attente d'envoi", 'Échec'])

  it('nouvelle tentative sur le même courrier après « Échec » : refusée, créer un nouveau courrier (avant : permise)', () => {
    expect(() => notification({ id: 'E2', horodatage: H('11:00'), envoisExistants: [echec()] })).toThrow(
      "Nouvel envoi refusé : l'envoi E1 du courrier C1 est en « Échec » : un envoi en échec n'a rien notifié ; pour un nouvel envoi, créer un nouveau courrier (nouveau dépôt ; D. 1967 art. 64, 64-1 ; décision de Hugo du 17/11/2026, J58).",
    )
  })

  it('le refus après « Reçu » est gardé ; un autre courrier, ou une demande de signature, ne sont pas bloqués', () => {
    const recu = enchainer(notification(), ["Attente d'envoi", 'En cours', 'Envoyé OK', 'Reçu'])
    expect(() => notification({ id: 'E2', horodatage: H('11:00'), envoisExistants: [recu] })).toThrow(/déjà « Reçu » ; pour un nouvel envoi, créer un nouveau courrier/)
    expect(notification({ id: 'E2', horodatage: H('11:00'), envoisExistants: [{ ...echec(), courrierId: 'AUTRE' }] }).statut).toBe('Préparation')
    const signature = creerEnvoiSignatureElectronique({ id: 'S1', courrierId: 'C1', horodatage: H('08:00') })
    expect(notification({ id: 'E2', envoisExistants: [signature] }).statut).toBe('Préparation')
  })

  it('l’envoi en « Échec » ne change plus : le message renvoie à un nouveau courrier', () => {
    expect(() => changerStatutEnvoi(echec(), { statut: 'En cours', horodatage: H('10:00') })).toThrow(
      /statut « Échec » final, plus aucun changement \(pour un nouvel envoi, créer un nouveau courrier\)/,
    )
  })

  it('inchangé : une nouvelle demande de signature après « Expiré » reste permise sur le même courrier', () => {
    const expiree = changerStatutEnvoi(
      changerStatutEnvoi(creerEnvoiSignatureElectronique({ id: 'S1', courrierId: 'C9', horodatage: H('08:00') }), { statut: 'En cours', horodatage: H('09:00') }),
      { statut: 'Expiré', horodatage: H('09:30') },
    )
    expect(creerEnvoiSignatureElectronique({ id: 'S2', courrierId: 'C9', horodatage: H('11:00'), envoisExistants: [expiree] }).statut).toBe('Soumis')
  })

  it('en-tête : la question de la nouvelle tentative après « Échec » est fermée ; J58 citée', () => {
    const { texte, item } = enTeteDuModule('envois-electroniques')
    expect(texte).toContain('décision de Hugo du 17/11/2026 (J58)')
    expect(texte).not.toMatch(/nouvelle tentative après « Échec » ou « Reçu en erreur » reste rattachée au même courrier/)
    // Relecture : l'envoi abandonné en « Préparation » ne se clôt que par « Échec », qui impose désormais un nouveau courrier.
    expect(item('- 🔴 Questions à Hugo')).toMatch(/abandonné en « Préparation ».*depuis J58, cet « Échec » impose un nouveau courrier/)
  })
})

// ─── J66 ─────────────────────────────────────────────────────────────

describe('J66 — après « Reçu en erreur » : pas de nouvel envoi sur le même courrier', () => {
  it('nouvelle tentative refusée : avis transmis = notification acquise (J57) ; sinon nouveau courrier (J58)', () => {
    expect(() => notification({ id: 'E2', horodatage: H('11:00'), envoisExistants: [recuEnErreur()] })).toThrow(
      /est « Reçu en erreur » : si le justificatif établit la transmission de l'avis électronique, la notification est acquise .*J57.*créer un nouveau courrier.*J66/,
    )
  })

  it('un autre courrier peut partir', () => {
    expect(notification({ id: 'E2', horodatage: H('11:00'), envoisExistants: [{ ...recuEnErreur(), courrierId: 'AUTRE' }] }).statut).toBe('Préparation')
  })

  it('en-tête : la question « Reçu en erreur » est fermée par J66', () => {
    const { texte } = enTeteDuModule('envois-electroniques')
    expect(texte).toContain('J66 (décision de Hugo du 17/11/2026')
    expect(texte).not.toContain('faut-il là')
  })
})

// ─── J59 ────────────────────────────────────────────────────────────────────────────────────────────

describe('J59 — refus reçu avant le 25/12/2025 puis accord reçu depuis : l’accord daté l’emporte', () => {
  const refus = creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'refus', recuLe: d(2025, 12, 20) })
  const accord = (recuLe: string): ConsentementVoieElectronique => ({ identiteId: 'id-1', sens: 'accord', recuLe })

  it('accord daté du 26/12/2025 : le refus n’est plus une demande de voie postale ; la LRE du 05/03/2026 fait courir le délai', () => {
    const consentements = [refus, creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'accord', recuLe: d(2025, 12, 26) })]
    expect(demandesDepuisConsentements(consentements, d(2026, 3, 5))).toEqual([])
    expect(lreDu(d(2026, 3, 5), { consentements })).toMatchObject({ etat: 'calcule', avertissements: [] })
  })

  it('accord sans date valable : il ne l’emporte pas, le refus d’avant le 25/12/2025 reste une demande de voie postale (avant : calculé)', () => {
    for (const recuLe of ['2026-02-30', '2026-13-01', '26/12/2025']) {
      const consentements = [refus, accord(recuLe)]
      expect(demandesDepuisConsentements(consentements, d(2026, 3, 5)), recuLe).toEqual([{ identiteId: 'id-1', recueLe: d(2025, 12, 20), origine: 'autre', agId: null }])
      const resultat = lreDu(d(2026, 3, 5), { consentements })
      expect(resultat, recuLe).toMatchObject({ etat: 'refuse', cause: 'voie_postale_demandee' })
      expect(motifDe(resultat)).toContain('refus de la voie électronique ou retrait de l\'accord reçu le 20/12/2025')
    }
  })

  it('accord sans date valable : il ne vaut pas non plus consentement à la LRE (J53), ni accord en vigueur', () => {
    expect(accordElectroniqueEnVigueur({ identiteId: 'id-1', consentements: [accord('2026-02-30')], date: d(2026, 3, 5) })).toBeNull()
    expect(accordElectroniqueEnVigueur({ identiteId: 'id-1', consentements: [accord('')], date: d(2026, 3, 5) })).toBeNull()
    expect(lreDu(d(2026, 3, 5), { consentements: [accord('2026-02-30')] }, false)).toMatchObject({ etat: 'refuse', cause: 'consentement_lre_absent' })
    // Un accord daté reste un consentement.
    expect(lreDu(d(2026, 3, 5), { consentements: [accord(d(2026, 2, 1))] }, false)).toMatchObject({ etat: 'calcule' })
  })

  it('inchangé : un accord daté reçu AVANT le refus ne l’emporte pas, le refus reste une demande de voie postale', () => {
    const consentements = [creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'accord', recuLe: d(2025, 12, 1) }), refus]
    expect(demandesDepuisConsentements(consentements, d(2026, 3, 5))).toEqual([{ identiteId: 'id-1', recueLe: d(2025, 12, 20), origine: 'autre', agId: null }])
    expect(lreDu(d(2026, 3, 5), { consentements })).toMatchObject({ etat: 'refuse', cause: 'voie_postale_demandee' })
  })

  it('en-tête : plus de « question à Hugo » ; J59 citée ; l’écrit hors du module et l’extension à l’accord en vigueur dites (relecture)', () => {
    const { texte, item } = enTeteDuModule('voie-notification')
    expect(texte).toContain('décision de Hugo du 17/11/2026 (J59)')
    expect(texte).not.toContain('question à Hugo')
    const j59 = item('Suite, décision de Hugo du 17/11/2026 (J59)')
    expect(j59).toMatch(/l'accord daté et écrit l'emporte/)
    expect(j59).toMatch(/L'écrit n'est pas un champ du module/)
    // Le refus seul est nommé par J59 ; le retrait suit la lecture de J50.
    expect(j59).not.toMatch(/un refus de la voie électronique \(ou un retrait d'accord\)/)
    expect(j59).toMatch(/retrait d'accord, assimilé au refus par J50/)
    // Accord en vigueur (J53, accord exprès d'avant le 25/12/2025) : extension prudente, non dite par J59, à confirmer.
    expect(j59).toMatch(/🔵 Par cohérence, un tel accord sans date valable ne vaut pas non plus accord en vigueur/)
    expect(j59).toMatch(/ce que J59 ne dit pas : lecture prudente, à confirmer par Hugo/)
  })
})

// ─── J60 ────────────────────────────────────────────────────────────────────────────────────────────

describe('J60 — contrôle technique et coordonnateur sécurité exclus de l’assiette du droit proportionnel', () => {
  it('« autres honoraires » : exclus, motif J60 (prestations intellectuelles, pas des travaux), plus de lecture 🔵', () => {
    const assiette = assietteDroitProportionnelTravaux([
      { nature: 'travaux', montantHtCentimes: 1_000_000 },
      { nature: 'honoraires_autres', montantHtCentimes: 80_000, libelle: 'Contrôle technique' },
      { nature: 'honoraires_autres', montantHtCentimes: 20_000, libelle: 'Coordonnateur SPS' },
    ])
    expect(assiette.montantHtRetenuCentimes).toBe(1_000_000)
    expect(assiette.montantHtExcluCentimes).toBe(100_000)
    const [, controle, coordonnateur] = assiette.depenses
    expect(controle).toMatchObject({ libelle: 'Contrôle technique', retenue: false })
    expect(coordonnateur).toMatchObject({ libelle: 'Coordonnateur SPS', retenue: false })
    expect(controle.raison).toContain('contrôle technique')
    expect(controle.raison).toContain('coordonnateur sécurité')
    expect(controle.raison).toContain('décision de Hugo du 17/11/2026, J60')
    expect(controle.raison).toContain('arrêté du 8 octobre 2015, art. 11')
    expect(controle.raison).not.toContain('🔵')
  })

  it('en-tête : la question des autres honoraires est fermée ; J60 citée', () => {
    const { texte } = enTeteDuModule('travaux-budget')
    expect(texte).toContain('décision de Hugo du 17/11/2026 (J60)')
    expect(apres(texte, '🔴 Non établi')).not.toContain('Les autres honoraires (bureau de contrôle, coordonnateur de sécurité), que J55 ne nomme pas')
  })
})

// ─── J61 ────────────────────────────────────────────────────────────────────────────────────────────

describe('J61 — segment « plan » du N° d’OS : la date du premier envoi (règle de gestion)', () => {
  it('confirmé : la date du premier envoi, au format AAAAMMJJ', () => {
    expect(segmentPlanOs('2026-11-17')).toBe('20261117')
  })

  it('en-tête : la question du segment plan est fermée ; J61 citée', () => {
    const { texte } = enTeteDuModule('envoi-ordre-service')
    expect(texte).toContain('décision de Hugo du 17/11/2026 (J61)')
    expect(apres(texte, '🔴 Non établi')).not.toContain('le segment <plan> est la date du PREMIER ENVOI')
    expect(texte).not.toMatch(/lecture à confirmer par Hugo, question ci-dessous/)
  })
})

// ─── Fonds détenus (J62, J63) ───────────────────────────────────────────────────────────────────────

const TILL_CDC = 'TILL.51210.00000.0'
const TILL_FT = 'TILL.51220.00000.0'

const mouvement = (id: string, date: string, compte512: string, montant: number, sens: 'entree' | 'sortie'): Traitement =>
  creerTraitement({
    id,
    famille: sens === 'entree' ? 'Encaissement' : 'Règlement de factures',
    date,
    mouvements:
      sens === 'entree'
        ? [
            { compte: compte512, sens: 'debit', montantCentimes: montant },
            { compte: 'TILL.45000.00001.0', sens: 'credit', montantCentimes: montant },
          ]
        : [
            { compte: 'TILL.40100.FOURN.0', sens: 'debit', montantCentimes: montant },
            { compte: compte512, sens: 'credit', montantCentimes: montant },
          ],
  })

const donneesTill = (): DonneesFondsDetenus => ({
  reglagesComptes: creerReglagesComptesCabinet({}),
  mandats: [
    {
      mandatId: 'm-till',
      coproprieteId: 'copro-tilleuls',
      segmentSyndicat: 'TILL',
      fondement: 'Administration provisoire (art. 29-1)',
      modeComptes: 'caisse_depots',
      comptes: [
        { banqueId: 'b-till-cdc', compte512: TILL_CDC, nature: 'caisse_depots', iban: null, etablissement: null },
        { banqueId: 'b-till-ft', compte512: TILL_FT, nature: 'fonds_travaux', iban: null, etablissement: 'Caisse des dépôts et consignations' },
      ],
    },
  ],
  comptabilites: [
    {
      coproprieteId: 'copro-tilleuls',
      traitements: [mouvement('till-a', '2026-04-01', TILL_FT, 300_000, 'entree'), mouvement('till-b', '2026-06-15', TILL_CDC, 200_000, 'sortie')],
    },
  ],
})

describe('J62 — compte sans IBAN : traité comme le compte global de l’administrateur tant que l’IBAN n’est pas saisi', () => {
  it('solde négatif : couverture non vérifiable, bloquante (inchangé) ; le motif dit le compte global, J62, et de saisir l’IBAN', () => {
    const fonds = fondsDetenusA('2026-12-31', donneesTill())
    expect(fonds.comptes.map((l) => [l.banqueId, l.mutualise])).toEqual([
      ['b-till-cdc', null],
      ['b-till-ft', null],
    ])
    expect(fonds.anomalies.map((a) => [a.code, a.gravite, a.banqueId])).toEqual([['couverture_non_verifiable', 'bloquant', 'b-till-cdc']])
    const { message } = fonds.anomalies[0]
    expect(message).toContain("traité comme le compte global de l'administrateur tant que son IBAN n'est pas saisi")
    expect(message).toContain('décision de Hugo du 17/11/2026, J62')
    expect(message).toContain("saisir l'IBAN de chaque compte du mandat")
    expect(message).not.toMatch(/les données ne disent pas s'il est propre au mandat/)
  })

  it('en-tête : la question des comptes sans IBAN est fermée ; J62 citée', () => {
    const { texte } = enTeteDuModule('fonds-detenus')
    expect(texte).toContain('décision de Hugo du 17/11/2026 (J62)')
    expect(apres(texte, '🔴 Non établi')).not.toContain('compte ouvert pour le mandat ou compte global')
  })
})

describe('J63 — « avant le 15 mars / 15 septembre » : le 14 au plus tard (C. com. R. 814-30)', () => {
  it('confirmé : attestation du commissaire aux comptes au plus tard le 14/09 (arrêté du 30/06) et le 14/03 (arrêté du 31/12)', () => {
    const attestations = echeancesFondsDetenusDeLAnnee(2026).filter((e) => e.objet === 'arrete_comptabilite_speciale')
    expect(attestations.map((e) => [e.date, e.dateLimite])).toEqual([
      ['2026-06-30', '2026-09-14'],
      ['2026-12-31', '2027-03-14'],
    ])
  })

  it('en-tête : la lecture stricte n’est plus « à confirmer » ; J63 citée', () => {
    const { texte } = enTeteDuModule('fonds-detenus')
    expect(texte).toContain('décision de Hugo du 17/11/2026 (J63)')
    expect(apres(texte, '🔴 Non établi')).not.toMatch(/« avant le 15 mars » : la lecture stricte/)
  })
})

// ─── J64 ────────────────────────────────────────────────────────────────────────────────────────────

describe('J64 — Copie au CS : née du courrier, sur les seules mises en demeure du contentieux (19-2 comprise), pas les relances', () => {
  const courrier = (libelle: string, famille: CourrierDeclencheur['modele']['famille'] = 'Contentieux'): CourrierDeclencheur => ({
    id: 'cour-1',
    modeleId: 'mod-1',
    modele: { famille, libelle },
    dateDepot: '2026-11-10',
    rattachements: [creerRattachement('Contentieux', 'C-3')],
    coproprieteId: 'copro-tilleuls',
    mandatId: 'M1',
  })
  const declenche = (libelle: string, famille?: CourrierDeclencheur['modele']['famille']) => courrierDeclenche(courrier(libelle, famille), DECLENCHEUR_MISE_EN_DEMEURE)

  it('mises en demeure du contentieux, procédure 19-2 comprise, même si son libellé ne dit pas « mise en demeure » (avant : non)', () => {
    for (const libelle of [
      'Mise en demeure de payer',
      'Mise en demeure de payer avec décompte',
      'Mise en demeure de payer - locataire',
      'Mise en demeure de payer - adresse relance',
      'MISE EN DEMEURE DE PAYER - procédure 19-2 - AR',
      'Procédure 19-2',
      'Procédure article 19-2 - AR',
    ])
      expect(declenche(libelle), libelle).toBe(true)
  })

  it('pas les simples relances, même quand leur libellé cite la mise en demeure ou la 19-2 (avant : « Relance mise en demeure » déclenchait)', () => {
    for (const libelle of ['Relance RAR', 'Relance loyer', 'Relance dossier avocat', 'Lettre comminatoire', 'Relance mise en demeure', 'Relance avant mise en demeure', 'Relances - procédure 19-2'])
      expect(declenche(libelle), libelle).toBe(false)
  })

  it('pas hors du contentieux ni hors des mises en demeure : Comptabilité syndic, « remise en demeure », article 19-21', () => {
    expect(declenche('RAR mise en demeure', 'Comptabilité syndic')).toBe(false)
    expect(declenche('Remise en demeure')).toBe(false)
    expect(declenche('Courrier article 19-21')).toBe(false)
    expect(declenche('Commandement de payer')).toBe(false)
  })

  it('réglage désactivé par défaut (J41) ; usage activé, l’étape naît du courrier de mise en demeure 19-2', () => {
    expect(NAISSANCE_COPIE_AU_CS_PAR_DEFAUT).toBe('courrier')
    expect(REGLES_ETAPES_COURRIER_PAR_DEFAUT.map((r) => [r.active, r.declencheur])).toEqual([[false, DECLENCHEUR_MISE_EN_DEMEURE]])
    expect(regleCopieAuCsPourInfo({ usages: USAGES_ETAPES_CABINET_PAR_DEFAUT }).active).toBe(false)
    const contexte: ContexteDeclenchementEtapes = {
      aujourdhui: '2026-11-16',
      idEtape: () => 'e-copie',
      demandeurId: 'collab-A',
      demandeurNature: 'collaborateur',
      realisateurId: 'collab-B',
      etapesExistantes: [],
    }
    const active = regleCopieAuCsPourInfo({ usages: { copieAuCsPourInfo: true } })
    expect(declencherEtapesDuCourrier(courrier('Procédure 19-2'), [active], contexte).etapes.map((e) => [e.courrierOrigineId, e.creeeLe])).toEqual([['cour-1', '2026-11-10']])
    expect(declencherEtapesDuCourrier(courrier('Relance mise en demeure'), [active], contexte).etapes).toEqual([])
  })

  it('relecture — J64 ne vise que la Copie au CS : les honoraires de la mise en demeure gardent leur déclencheur (avant : celui de J64)', () => {
    const forfait = {
      objet: 'forfait_mise_en_demeure',
      nature: 'Honoraires',
      tarif: 'Contentieux - MISE EN DEMEURE',
      quantite: 1,
      prixUnitaireHtDixMilliemes: 300_000,
      soumisTva: true,
      tauxTvaPct: 20,
      destinataire: 'Syndicat des copropriétaires', // J67, R7 : le forfait se facture au syndicat
    } as const
    const regle = regleHonorairesMiseEnDemeure({ lignes: [forfait] })
    expect(regle).toMatchObject({ active: false, declencheur: { par: 'famille', famille: 'Contentieux', libelleContient: 'mise en demeure' } })
    expect(regle.declencheur).toEqual(DECLENCHEUR_HONORAIRES_MISE_EN_DEMEURE)
    expect(Object.isFrozen(DECLENCHEUR_HONORAIRES_MISE_EN_DEMEURE)).toBe(true)
    // Comportement d'avant J64, inchangé : « Relance mise en demeure » propose les lignes, « Procédure 19-2 » non.
    expect(courrierDeclenche(courrier('Relance mise en demeure'), regle.declencheur)).toBe(true)
    expect(courrierDeclenche(courrier('Mise en demeure de payer'), regle.declencheur)).toBe(true)
    expect(courrierDeclenche(courrier('Procédure 19-2'), regle.declencheur)).toBe(false)
    // La Copie au CS, elle, suit J64.
    expect(regleCopieAuCsPourInfo().declencheur).toEqual(DECLENCHEUR_MISE_EN_DEMEURE)
    expect(courrierDeclenche(courrier('Relance mise en demeure'), DECLENCHEUR_MISE_EN_DEMEURE)).toBe(false)
  })

  it('en-têtes : les questions de naissance et de déclencheur sont fermées ; J64 citée', () => {
    const etapes = enTeteDuModule('etapes-courrier')
    expect(etapes.texte).toContain('décision de Hugo du 17/11/2026 (J64)')
    const questions = apres(etapes.texte, '🔴 Non établi')
    expect(questions).not.toContain("l'étape naît-elle du courrier ou de l'enchaînement")
    expect(questions).not.toContain('quels modèles de courrier font naître la Copie au CS')
    const modeles = enTeteDuModule('modeles-etapes')
    expect(modeles.texte).toContain('décision de Hugo du 17/11/2026 (J64)')
    expect(apres(modeles.texte, '🔴 Non établi')).not.toContain('laquelle retenir, pour ne pas la créer deux fois')
  })
})
