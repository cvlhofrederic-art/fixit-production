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
 * critère LRE (J53). » Partie domaine seulement : la qualité sur l'identité, son lecteur, et la qualité de chaque
 * destinataire pour le contrôle J53 (statut-assemblee.ts, inchangé), écrite et testée, sans appelant de production
 * aujourd'hui. Ni écran ni table (aucune table des identités n'existe encore).
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

/** Fiche sans case (rien de saisi : le champ est absent). */
const sansCase = (): Identite => creerIdentite(saisie())
/** Fiche dont la case est décochée à la saisie (professionnel: false). */
const decocheeExplicite = (): Identite => creerIdentite(saisie({ professionnel: false }))
const cochee = (): Identite => creerIdentite(saisie({ professionnel: true }))
/** Les deux formes de la case non cochée : absente, ou décochée. */
const nonCochees = (): Identite[] => [sansCase(), decocheeExplicite()]
const forme = (identite: Identite): string => ('professionnel' in identite ? `case ${String(identite.professionnel)}` : 'sans case')

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

describe('J78 — qualité de chaque destinataire pour le contrôle J53 (avecQualiteProfessionnelle, sans appelant de production)', () => {
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
    for (const identite of nonCochees())
      expect(avecQualiteProfessionnelle(entree, [identite]), forme(identite)).toEqual([{ identiteId: 'id-1', courrierId: 'k1', professionnel: false }])
    expect(entree).toEqual([{ identiteId: 'id-1', courrierId: 'k1', professionnel: true }])
  })

  it('identité introuvable : null, même si l’appelant a donné true (jamais l’inverse de la lecture prudente)', () => {
    const entree = [{ identiteId: 'id-9', courrierId: 'k1', professionnel: true }]
    expect(avecQualiteProfessionnelle(entree, [])).toEqual([{ identiteId: 'id-9', courrierId: 'k1', professionnel: null }])
    // une autre fiche cochée (id-1) ne prête pas sa qualité à id-9
    expect(avecQualiteProfessionnelle(entree, [cochee()])).toEqual([{ identiteId: 'id-9', courrierId: 'k1', professionnel: null }])
  })

  it('identité en double dans les fiches : erreur (données incohérentes), quelle que soit la case de chacune', () => {
    const destinataires = [{ identiteId: 'id-1', courrierId: 'k1' }]
    for (const fiches of [
      [cochee(), sansCase()],
      [sansCase(), cochee()],
      [decocheeExplicite(), sansCase()],
    ])
      expect(() => avecQualiteProfessionnelle(destinataires, fiches)).toThrow(
        'Identité id-1 en double dans les fiches identité (case « professionnel ») : données incohérentes.',
      )
    // le doublon d'une fiche étrangère aux destinataires est refusé aussi : les fiches lues sont incohérentes
    const autre = creerIdentite(saisie({ id: 'id-2', nom: 'Petit' }))
    expect(() => avecQualiteProfessionnelle(destinataires, [sansCase(), autre, autre])).toThrow(/Identité id-2 en double/)
  })
})

describe('J78 — de bout en bout : délai de contestation de l’AG (J50, J53), qualité lue sur la fiche', () => {
  it('rien de saisi : même résultat qu’avant J78 (qualité non saisie, lue comme non professionnelle)', () => {
    const avant = finDelaiContestationAgParDestinataire(chaineLe(LE), [lreLe(LE)], 'ag-1', {
      opposantsOuDefaillants: 1,
      notifications: [{ identiteId: 'id-1', courrierId: 'k1' }],
    })
    for (const identite of nonCochees()) expect(delaiPour([identite]), forme(identite)).toEqual(avant)
    expect(delaiPour([])).toEqual(avant)
  })

  it('case absente ou décochée, LRE, aucun accord du critère LRE : refus consentement_lre_absent (J53)', () => {
    for (const identite of nonCochees())
      expect(delaiPour([identite]), forme(identite)).toMatchObject({ etat: 'refuse', cause: 'consentement_lre_absent' })
    // identité introuvable : même lecture prudente
    expect(delaiPour([])).toMatchObject({ etat: 'refuse', cause: 'consentement_lre_absent' })
  })

  it('identité introuvable, l’appelant donnait true : la valeur est remplacée par null, la LRE sans accord est refusée (J53)', () => {
    for (const identites of [[], [creerIdentite(saisie({ id: 'id-9', nom: 'Petit', professionnel: true }))]]) {
      const delai = finDelaiContestationAgParDestinataire(chaineLe(LE), [lreLe(LE)], 'ag-1', {
        opposantsOuDefaillants: 1,
        notifications: avecQualiteProfessionnelle([{ identiteId: 'id-1', courrierId: 'k1', professionnel: true }], identites),
      })
      expect(delai, String(identites.length)).toMatchObject({ etat: 'refuse', cause: 'consentement_lre_absent' })
    }
  })

  it('case absente ou décochée, accord du critère LRE en vigueur à l’envoi : délai calculé', () => {
    for (const identite of nonCochees())
      expect(delaiPour([identite], lreLe(LE), { consentements: [consent('accord', d(2026, 1, 10))] }), forme(identite)).toMatchObject({
        etat: 'calcule',
      })
  })

  it('case cochée, aucun accord : délai calculé (le consentement de CPCE art. L. 100 n’est pas exigé)', () => {
    expect(delaiPour([cochee()])).toMatchObject({ etat: 'calcule', avertissements: [] })
  })

  it('les autres règles restent, case cochée ou non : voie postale (J52, J74) et accord exprès avant le 25/12/2025 (J50)', () => {
    // J74 : refus, puis accord reçu le 27/02/2026, en vigueur le 08/03/2026 ; LRE du 05/03/2026 : voie postale encore en vigueur
    const refusPuisAccord = { consentements: [consent('refus', d(2026, 1, 10)), consent('accord', d(2026, 2, 27))] }
    for (const identite of [...nonCochees(), cochee()]) {
      expect(delaiPour([identite], lreLe(LE), refusPuisAccord), forme(identite)).toMatchObject({
        etat: 'refuse',
        cause: 'voie_postale_demandee',
      })
      // J50 : LRE du 10/12/2025, sans accord exprès enregistré
      expect(delaiPour([identite], lreLe(d(2025, 12, 10))), forme(identite)).toMatchObject({
        etat: 'refuse',
        cause: 'accord_electronique_absent',
      })
    }
    // une fois l’accord en vigueur (08/03/2026), la LRE vaut notification, même case absente ou décochée
    for (const identite of nonCochees())
      expect(delaiPour([identite], lreLe(d(2026, 3, 10)), refusPuisAccord), forme(identite)).toMatchObject({ etat: 'calcule' })
  })

  it('prestataire qualifié et LRAR : inchangés, quelle que soit la case', () => {
    const pscq = lreLe(LE, { formeEnvoi: 'Fichier', modeNotification: 'prestataire_qualifie' })
    const lrar = lreLe(LE, { formeEnvoi: 'AR', modeNotification: 'lrar', dateDepot: d(2026, 3, 3), datePremierePresentation: LE, dateAvisElectronique: null })
    for (const courrier of [pscq, lrar]) {
      const reference = delaiPour([sansCase()], courrier)
      expect(reference, courrier.formeEnvoi).toMatchObject({ etat: 'calcule' })
      for (const identite of [decocheeExplicite(), cochee()])
        expect(delaiPour([identite], courrier), `${courrier.formeEnvoi}, ${forme(identite)}`).toEqual(reference)
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

  it('notification unique (finDelaiContestationAg) : l’appelant passe qualiteProfessionnelleDe(fiche de courrier.personneId) ; le domaine ne relie pas la qualité à la fiche', () => {
    const courrier = lreLe(LE)
    // usage attendu de l'appelant : la fiche du destinataire du courrier, pas une autre
    const options = (identites: Identite[]) => ({
      opposantsOuDefaillants: 1,
      professionnel: qualiteProfessionnelleDe(identites.find((i) => i.id === courrier.personneId)),
    })
    for (const identite of nonCochees())
      expect(finDelaiContestationAg(chaineLe(LE), [courrier], 'ag-1', options([identite])), forme(identite)).toMatchObject({
        etat: 'refuse',
        cause: 'consentement_lre_absent',
      })
    expect(finDelaiContestationAg(chaineLe(LE), [courrier], 'ag-1', options([cochee()]))).toMatchObject({ etat: 'calcule' })
    // fiche cochée d'une autre identité (id-9) que le destinataire du courrier (id-1) : rien n'est lu, refus
    const autre = creerIdentite(saisie({ id: 'id-9', nom: 'Petit', professionnel: true }))
    expect(finDelaiContestationAg(chaineLe(LE), [courrier], 'ag-1', options([autre]))).toMatchObject({
      etat: 'refuse',
      cause: 'consentement_lre_absent',
    })
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

  it('identites-positions.ts : accord sans date valable écarté par J59 (et non J66), extension à confirmer', () => {
    const { texte } = enTeteDuModule('identites-positions')
    expect(texte).toContain(
      "accord sans date valable écarté : J59, étendu à l'accord en vigueur par lecture prudente, à confirmer par Hugo (voie-notification.ts)",
    )
    // J66 traite du statut « Reçu en erreur » (envois-electroniques.ts), pas de l'accord sans date
    expect(texte).not.toContain('J66')
  })

  it('identites-positions.ts : rien n’est branché hors des tests ; l’appelant de la notification unique passe la qualité', () => {
    const { texte } = enTeteDuModule('identites-positions')
    expect(texte).not.toContain('branchement sur le contrôle J53')
    expect(texte).toContain(
      "avecQualiteProfessionnelle, écrit et testé, à brancher par l'appelant de finDelaiContestationAgParDestinataire (aucun aujourd'hui)",
    )
    expect(texte).toContain('identité en double dans les fiches : erreur (données incohérentes)')
    expect(texte).toContain(
      "finDelaiContestationAg (notification unique) : la qualité reste une option de l'appelant, qui passe qualiteProfessionnelleDe(fiche de courrier.personneId) ; le domaine ne la relie pas à la fiche",
    )
  })
})
