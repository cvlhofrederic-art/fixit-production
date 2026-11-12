// tests/lib/aj-signalement-affichage-gestion.test.ts
//
// Libellés et calculs purs des écrans du super admin (cabinets clients, gestionnaires, journal ; demandes de Hugo du
// 10/11/2026) : chaque valeur des listes fermées a son libellé ; filtres des copropriétés ; groupes et successions du
// départ d'un gestionnaire (une succession par copropriété exigée) ; saisie des domaines ; aperçu de l'adresse.

import { describe, expect, it } from 'vitest'
import {
  LIBELLE_ACTION_JOURNAL_QR, LIBELLE_ETAT_GESTIONNAIRE_QR, LIBELLE_ORIGINE_ATTRIBUTION_QR, TON_ETAT_GESTIONNAIRE_QR,
  analyserDomainesQr, apercuCheminCabinetQr, auteurJournalQr, filtrerCoproprietesQr, groupesDepartQr, successionsDepartQr,
} from '@/lib/aj-signalement/affichage-gestion'
import { TEXTES_TABLEAU_QR, messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import {
  ACTIONS_JOURNAL_QR, ETATS_GESTIONNAIRE_QR, ORIGINES_ATTRIBUTION_QR, gestionCoproprieteQrVide,
  type AttributionVueQr, type CoproprieteQr, type EvenementJournalQr,
} from '@/lib/aj-signalement/types'

const G1 = '11111111-1111-4111-8111-111111111111'
const G2 = '22222222-2222-4222-8222-222222222222'
const K1 = { id: 'k1', nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }

const copro = (id: string, gestion: Partial<CoproprieteQr> = {}): CoproprieteQr => ({
  id, nom: `Résidence ${id}`, adresse: '', jeton: '0'.repeat(32), emailsDestinataires: [], actif: true, creeLe: '2026-11-01T00:00:00Z',
  nbSignalements: 0, nbEnAttente: 0, derniereAdresseProposee: null, ...gestionCoproprieteQrVide(), ...gestion,
})

describe('libellés des listes fermées', () => {
  it('chaque action du journal a un libellé en clair, distinct', () => {
    const libelles = ACTIONS_JOURNAL_QR.map((a) => LIBELLE_ACTION_JOURNAL_QR[a])
    expect(libelles.every((l) => typeof l === 'string' && l.length > 3)).toBe(true)
    expect(new Set(libelles).size).toBe(ACTIONS_JOURNAL_QR.length)
  })

  it('chaque état d’une fiche a un libellé et une teinte ; « adresse contestée » est en rouge', () => {
    for (const etat of ETATS_GESTIONNAIRE_QR) {
      expect(LIBELLE_ETAT_GESTIONNAIRE_QR[etat].length).toBeGreaterThan(3)
      expect(TON_ETAT_GESTIONNAIRE_QR[etat]).toBeTruthy()
    }
    expect(LIBELLE_ETAT_GESTIONNAIRE_QR.adresse_contestee).toBe('Adresse contestée par son destinataire')
    expect(TON_ETAT_GESTIONNAIRE_QR.adresse_contestee).toBe('rouge')
    expect(TON_ETAT_GESTIONNAIRE_QR.adresse_confirmee).toBe('vert')
  })

  it('origine d’une attribution (SPEC § 1.8)', () => {
    expect(ORIGINES_ATTRIBUTION_QR.map((o) => LIBELLE_ORIGINE_ATTRIBUTION_QR[o])).toEqual(['attribuée', 'créée par lui', 'importée', 'réattribuée'])
  })

  it('auteur d’une ligne du journal : « Administrateur », le nom du gestionnaire, ou « Système »', () => {
    const e = (profil: EvenementJournalQr['acteur']['profil'], nom: string | null) => ({ acteur: { profil, nom } }) as EvenementJournalQr
    expect(auteurJournalQr(e('super_admin', null))).toBe('Administrateur')
    expect(auteurJournalQr(e('gestionnaire', 'Marie Exemple'))).toBe('Marie Exemple')
    expect(auteurJournalQr(e('gestionnaire', null))).toBe('Ancien gestionnaire')
    expect(auteurJournalQr(e('systeme', null))).toBe('Système')
  })

  it('les nouveaux codes d’erreur ont leur message (jamais le texte du serveur)', () => {
    for (const code of ['doublon', 'hors_domaine', 'existe_deja', 'identifiant_pris', 'identifiant_fige', 'domaine_pris', 'sans_cabinet',
      'cabinet_fige', 'a_reverifier', 'deja_confirmee', 'expire', 'adresse_contestee', 'adresse_reservee', 'domaines_a_renseigner',
      'fiche_active', 'fiche_effacee', 'signalements_presents', 'conflit_statut'] as const) {
      expect(messageErreurTableauQr(code).length, code).toBeGreaterThan(10)
      expect(TEXTES_TABLEAU_QR.erreurs[code]).toBe(messageErreurTableauQr(code))
    }
  })
})

describe('filtres des copropriétés', () => {
  const liste = [
    copro('a'),
    copro('b', { cabinet: K1 }),
    copro('c', { cabinet: K1, attribueeATous: true }),
    copro('d', { cabinet: K1, gestionnaires: [{ id: G1, nom: 'Marie Exemple' }] }),
    copro('e', { cabinet: K1, gestionnaires: [{ id: G2, nom: null }], adressesDeGestionnaires: 1 }),
  ]
  const ids = (filtre: string) => filtrerCoproprietesQr(liste, filtre).map((c) => c.id)

  it.each([
    ['', ['a', 'b', 'c', 'd', 'e']],
    ['sans_cabinet', ['a']],
    ['sans_gestionnaire', ['a', 'b']],
    ['a_tous', ['c']],
    ['adresses_gestionnaires', ['e']],
    [`gestionnaire:${G1}`, ['d']],
    ['inconnu', ['a', 'b', 'c', 'd', 'e']],
  ])('« %s »', (filtre, attendus) => {
    expect(ids(filtre)).toEqual(attendus)
  })
})

describe('départ d’un gestionnaire', () => {
  const attributions: AttributionVueQr[] = [
    { coproprieteId: 'a', nom: 'Résidence a', origine: 'super_admin', creeLe: '2026-11-01T00:00:00Z' },
    { coproprieteId: 'b', nom: 'Résidence b', origine: 'import', creeLe: '2026-11-01T00:00:00Z' },
    { coproprieteId: 'z', nom: 'Résidence z', origine: 'creation', creeLe: '2026-11-01T00:00:00Z' },
  ]
  const coproprietes = [
    copro('a', { cabinet: K1, gestionnaires: [{ id: G1, nom: 'Marie' }] }),
    copro('b', { cabinet: K1, gestionnaires: [{ id: G1, nom: 'Marie' }, { id: G2, nom: 'Paul' }] }),
  ]

  it('deux groupes : seul gestionnaire (successeur à choisir) / d’autres restent ; copropriété inconnue → seul', () => {
    const g = groupesDepartQr(G1, attributions, coproprietes)
    expect(g.seul.map((a) => a.coproprieteId)).toEqual(['a', 'z'])
    expect(g.partages.map((a) => a.coproprieteId)).toEqual(['b'])
  })

  it('une succession par copropriété : successeur, « sans gestionnaire » (null) ; les partagées partent sans successeur', () => {
    const g = groupesDepartQr(G1, attributions, coproprietes)
    expect(successionsDepartQr(g, { a: G2, z: 'sans' })).toEqual({
      ok: true,
      successions: [
        { coproprieteId: 'a', versGestionnaireId: G2 },
        { coproprieteId: 'z', versGestionnaireId: null },
        { coproprieteId: 'b', versGestionnaireId: null },
      ],
    })
  })

  it('un choix manquant : refus, avec les copropriétés à compléter', () => {
    const g = groupesDepartQr(G1, attributions, coproprietes)
    expect(successionsDepartQr(g, { a: G2 })).toEqual({ ok: false, manquantes: ['z'] })
    expect(successionsDepartQr(g, { a: '', z: 'sans' })).toEqual({ ok: false, manquantes: ['a'] })
  })
})

describe('saisie d’un cabinet', () => {
  it('domaines : séparés par des virgules ou des espaces, rognés, minuscules, sans doublon ; messageries publiques refusées', () => {
    expect(analyserDomainesQr(' Cabinet-Exemple.fr, exemple.test  exemple.test ,')).toEqual({ domaines: ['cabinet-exemple.fr', 'exemple.test'], invalides: [] })
    expect(analyserDomainesQr('gmail.com, pas un domaine, exemple.test')).toEqual({ domaines: ['exemple.test'], invalides: ['gmail.com', 'pas', 'un', 'domaine'] })
    expect(analyserDomainesQr('')).toEqual({ domaines: [], invalides: [] })
  })

  it('aperçu de l’adresse des QR codes', () => {
    expect(apercuCheminCabinetQr('cabinet-exemple')).toBe('vitfix.io/cabinet-exemple/signalement/…')
    expect(apercuCheminCabinetQr('')).toBe('vitfix.io/<identifiant>/signalement/…')
  })
})
