import './fuseau-paris'
import { describe, expect, it } from 'vitest'
import { composerDateIso as d } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  avecQualiteProfessionnelle,
  creerIdentite,
  migrerCoproprietaire,
  qualiteProfessionnelleDe,
  type Identite,
  type SaisieIdentite,
} from '@/lib/administrateur-judiciaire/domain/identites-positions'
import {
  finDelaiContestationAg,
  finDelaiContestationAgParDestinataire,
  type ContexteVoieNotification,
} from '@/lib/administrateur-judiciaire/domain/statut-assemblee'
import { creerConsentementVoieElectronique, type SensConsentementVoieElectronique } from '@/lib/administrateur-judiciaire/domain/voie-notification'
import { chaineLe, lreLe } from './donnees-delai-contestation'
import { enTeteDuModule } from './en-tete-module'

/**
 * J78 — réponse de Frédéric du 17/11/2026 (page de validation, sj-qualite-pro.json, choix « accord ») : « case
 * « professionnel » sur la fiche identité, décochée par défaut. Le consentement d'un non-professionnel reste celui du
 * critère LRE (J53). » Partie domaine seulement : la qualité sur l'identité, son lecteur, et son branchement sur le
 * contrôle J53 (statut-assemblee.ts, inchangé). Ni écran ni table (aucune table des identités n'existe encore).
 */

const saisie = (surcharge: Partial<SaisieIdentite> = {}): SaisieIdentite => ({
  id: 'id-1',
  nature: 'physique',
  civilite: 'Madame',
  nom: 'Durand',
  prenom: 'Anne',
  telecoms: [],
  ...surcharge,
})

const LE = d(2026, 3, 5)
const consent = (sens: SensConsentementVoieElectronique, recuLe: string, identiteId = 'id-1') =>
  creerConsentementVoieElectronique({ identiteId, sens, recuLe })

/** Délai de l'AG (un opposant, id-1, notifié par le courrier k1) ; la qualité vient de la fiche identité (J78). */
const delaiPour = (identites: Identite[], courrier = lreLe(LE), voie: ContexteVoieNotification = {}) =>
  finDelaiContestationAgParDestinataire(chaineLe(courrier.dateDepot ?? LE), [courrier], 'ag-1', {
    opposantsOuDefaillants: 1,
    notifications: avecQualiteProfessionnelle([{ identiteId: 'id-1', courrierId: 'k1' }], identites),
    voie,
  })

const decochee = (): Identite => creerIdentite(saisie())
const cochee = (): Identite => creerIdentite(saisie({ professionnel: true }))

describe('J78 — case « professionnel » sur la fiche identité, décochée par défaut', () => {
  it('rien de saisi : pas de champ, comme avant ; l’identité est lue non professionnelle', () => {
    const identite = creerIdentite(saisie())
    expect('professionnel' in identite).toBe(false)
    expect(identite).toEqual({ ...saisie(), adresses: [], groupes: [], representants: [] })
    expect(qualiteProfessionnelleDe(identite)).toBe(false)
  })

  it('case cochée ou décochée : gardée telle quelle ; null (reprise) : non saisie, donc décochée', () => {
    expect(creerIdentite(saisie({ professionnel: true })).professionnel).toBe(true)
    expect(creerIdentite(saisie({ professionnel: false })).professionnel).toBe(false)
    const reprise = creerIdentite(saisie({ professionnel: null }))
    expect('professionnel' in reprise).toBe(false)
    expect(qualiteProfessionnelleDe(reprise)).toBe(false)
  })

  it('toute autre valeur est refusée, avec un message clair', () => {
    for (const valeur of ['oui', 1, 'true'])
      expect(() => creerIdentite(saisie({ professionnel: valeur as unknown as boolean })), String(valeur)).toThrow(
        /Case « professionnel » de Durand : cochée ou décochée attendue/,
      )
  })

  it('migration de l’ancienne fiche copropriétaire : aucune case (l’ancienne fiche n’en a pas), lue non professionnelle', () => {
    const { identite } = migrerCoproprietaire(
      { id: 'c-1', lotId: 'lot-1', nom: 'Martin', tel: '', mail: '', statut: 'A jour' },
      { coproprieteId: 'copro-1', serie: '1', dateEntree: d(2020, 1, 1) },
    )
    expect('professionnel' in identite).toBe(false)
    expect(qualiteProfessionnelleDe(identite)).toBe(false)
  })
})

describe('J78 — lecteur pur de la qualité (qualiteProfessionnelleDe)', () => {
  it('identité absente : null (non saisie) ; décochée ou sans case : false ; cochée : true', () => {
    expect(qualiteProfessionnelleDe(null)).toBeNull()
    expect(qualiteProfessionnelleDe(undefined)).toBeNull()
    expect(qualiteProfessionnelleDe({})).toBe(false)
    expect(qualiteProfessionnelleDe({ professionnel: false })).toBe(false)
    expect(qualiteProfessionnelleDe({ professionnel: true })).toBe(true)
  })

  it('valeur enregistrée invalide (base, reprise) : lue non professionnelle, la lecture prudente de J53', () => {
    expect(qualiteProfessionnelleDe({ professionnel: 'oui' as unknown as boolean })).toBe(false)
    expect(qualiteProfessionnelleDe({ professionnel: null as unknown as boolean })).toBe(false)
  })
})

describe('J78 — branchement sur le contrôle J53 (avecQualiteProfessionnelle)', () => {
  it('remplit la qualité de chaque destinataire d’après sa fiche ; identité introuvable : null (non saisie)', () => {
    const identites = [cochee(), creerIdentite(saisie({ id: 'id-2', nom: 'Petit' }))]
    expect(
      avecQualiteProfessionnelle(
        [
          { identiteId: 'id-1', courrierId: 'k1' },
          { identiteId: 'id-2', courrierId: 'k2' },
          { identiteId: 'id-3', courrierId: null },
        ],
        identites,
      ),
    ).toEqual([
      { identiteId: 'id-1', courrierId: 'k1', professionnel: true },
      { identiteId: 'id-2', courrierId: 'k2', professionnel: false },
      { identiteId: 'id-3', courrierId: null, professionnel: null },
    ])
  })

  it('la case est la seule source : une valeur donnée par l’appelant est remplacée ; l’entrée n’est pas modifiée', () => {
    const entree = [{ identiteId: 'id-1', courrierId: 'k1', professionnel: true }]
    expect(avecQualiteProfessionnelle(entree, [decochee()])).toEqual([{ identiteId: 'id-1', courrierId: 'k1', professionnel: false }])
    expect(entree).toEqual([{ identiteId: 'id-1', courrierId: 'k1', professionnel: true }])
  })
})

describe('J78 — de bout en bout : délai de contestation de l’AG (J50, J53), qualité lue sur la fiche', () => {
  it('rien de saisi : même résultat qu’avant J78 (qualité non saisie, lue comme non professionnelle)', () => {
    const avant = finDelaiContestationAgParDestinataire(chaineLe(LE), [lreLe(LE)], 'ag-1', {
      opposantsOuDefaillants: 1,
      notifications: [{ identiteId: 'id-1', courrierId: 'k1' }],
    })
    expect(delaiPour([decochee()])).toEqual(avant)
    expect(delaiPour([])).toEqual(avant)
  })

  it('case décochée, LRE, aucun accord du critère LRE : refus consentement_lre_absent (J53)', () => {
    expect(delaiPour([decochee()])).toMatchObject({ etat: 'refuse', cause: 'consentement_lre_absent' })
    // identité introuvable : même lecture prudente
    expect(delaiPour([])).toMatchObject({ etat: 'refuse', cause: 'consentement_lre_absent' })
  })

  it('case décochée, accord du critère LRE en vigueur à l’envoi : délai calculé', () => {
    expect(delaiPour([decochee()], lreLe(LE), { consentements: [consent('accord', d(2026, 1, 10))] })).toMatchObject({ etat: 'calcule' })
  })

  it('case cochée, aucun accord : délai calculé (le consentement de CPCE art. L. 100 n’est pas exigé)', () => {
    expect(delaiPour([cochee()])).toMatchObject({ etat: 'calcule', avertissements: [] })
  })

  it('les autres règles restent, case cochée ou non : voie postale (J52, J74) et accord exprès avant le 25/12/2025 (J50)', () => {
    // J74 : refus, puis accord reçu le 27/02/2026, en vigueur le 08/03/2026 ; LRE du 05/03/2026 : voie postale encore en vigueur
    const refusPuisAccord = { consentements: [consent('refus', d(2026, 1, 10)), consent('accord', d(2026, 2, 27))] }
    for (const identite of [decochee(), cochee()]) {
      expect(delaiPour([identite], lreLe(LE), refusPuisAccord), String(identite.professionnel)).toMatchObject({
        etat: 'refuse',
        cause: 'voie_postale_demandee',
      })
      // J50 : LRE du 10/12/2025, sans accord exprès enregistré
      expect(delaiPour([identite], lreLe(d(2025, 12, 10))), String(identite.professionnel)).toMatchObject({
        etat: 'refuse',
        cause: 'accord_electronique_absent',
      })
    }
    // une fois l’accord en vigueur (08/03/2026), la LRE vaut notification, même case décochée
    expect(delaiPour([decochee()], lreLe(d(2026, 3, 10)), refusPuisAccord)).toMatchObject({ etat: 'calcule' })
  })

  it('prestataire qualifié et LRAR : inchangés, quelle que soit la case', () => {
    const pscq = lreLe(LE, { formeEnvoi: 'Fichier', modeNotification: 'prestataire_qualifie' })
    const lrar = lreLe(LE, { formeEnvoi: 'AR', modeNotification: 'lrar', dateDepot: d(2026, 3, 3), datePremierePresentation: LE, dateAvisElectronique: null })
    for (const courrier of [pscq, lrar]) {
      const sansCase = delaiPour([decochee()], courrier)
      expect(sansCase, courrier.formeEnvoi).toMatchObject({ etat: 'calcule' })
      expect(delaiPour([cochee()], courrier), courrier.formeEnvoi).toEqual(sansCase)
    }
  })

  it('deux opposants : le professionnel est calculé, le non-professionnel sans accord bloque la fin de l’AG', () => {
    const identites = [cochee(), creerIdentite(saisie({ id: 'id-2', nom: 'Petit' }))]
    const delai = finDelaiContestationAgParDestinataire(chaineLe(LE), [lreLe(LE), lreLe(LE, { id: 'k2', personneId: 'id-2' })], 'ag-1', {
      opposantsOuDefaillants: 2,
      notifications: avecQualiteProfessionnelle(
        [
          { identiteId: 'id-1', courrierId: 'k1' },
          { identiteId: 'id-2', courrierId: 'k2' },
        ],
        identites,
      ),
    })
    expect(delai).toMatchObject({ etat: 'refuse', cause: 'consentement_lre_absent' })
    if (delai.etat !== 'refuse') throw new Error('refus attendu')
    expect(delai.destinataires.map((r) => [r.identiteId, r.etat])).toEqual([
      ['id-1', 'calcule'],
      ['id-2', 'refuse'],
    ])
  })

  it('notification unique (finDelaiContestationAg) : la qualité se lit sur la fiche du destinataire du courrier', () => {
    const options = (identite: Identite) => ({ opposantsOuDefaillants: 1, professionnel: qualiteProfessionnelleDe(identite) })
    expect(finDelaiContestationAg(chaineLe(LE), [lreLe(LE)], 'ag-1', options(decochee()))).toMatchObject({ etat: 'refuse', cause: 'consentement_lre_absent' })
    expect(finDelaiContestationAg(chaineLe(LE), [lreLe(LE)], 'ag-1', options(cochee()))).toMatchObject({ etat: 'calcule' })
  })
})

describe('J78 — en-têtes', () => {
  it('voie-notification.ts : la qualité professionnelle a une source (J78), plus « aucune source »', () => {
    const { texte } = enTeteDuModule('voie-notification')
    expect(texte).not.toContain("n'a aucune source dans le module")
    expect(texte).toContain(
      "J78 (réponse de Frédéric du 17/11/2026) : la qualité professionnelle du destinataire vient de la case « professionnel » de la fiche identité, décochée par défaut (identites-positions.ts, qualiteProfessionnelleDe, avecQualiteProfessionnelle)",
    )
  })

  it('identites-positions.ts : J78 citée ; preuve et date de la qualité laissées ouvertes (question à Hugo)', () => {
    const { texte } = enTeteDuModule('identites-positions')
    expect(texte).toContain('J78 (réponse de Frédéric du 17/11/2026, sj-qualite-pro.json)')
    const nonEtabli = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(nonEtabli).toContain('ce qui justifie de cocher la case « professionnel »')
    expect(nonEtabli).toContain('si cette qualité doit être datée')
  })
})
