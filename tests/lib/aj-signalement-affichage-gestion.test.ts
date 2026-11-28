// tests/lib/aj-signalement-affichage-gestion.test.ts
//
// Libellés et calculs purs des écrans du super admin (cabinets clients, gestionnaires, journal ; demandes de Hugo du
// 10/11/2026) : chaque valeur des listes fermées a son libellé ; filtres des copropriétés ; groupes et successions du
// départ d'un gestionnaire (une succession par copropriété exigée) ; saisie des domaines ; aperçu de l'adresse.

import { describe, expect, it } from 'vitest'
import {
  LIBELLE_ACTION_JOURNAL_QR, LIBELLE_ETAT_GESTIONNAIRE_QR, LIBELLE_ORIGINE_ATTRIBUTION_QR, TON_ETAT_GESTIONNAIRE_QR,
  actionAccesGestionnaireQr, analyserDomainesQr, apercuCheminCabinetQr, auteurJournalQr, compteASupprimerQr, connexionABloquerQr,
  connexionADebloquerQr, fichesAccesOuvrablesQr, filtrerCoproprietesQr, groupesDepartQr, successionsDepartQr,
} from '@/lib/aj-signalement/affichage-gestion'
import { TEXTES_TABLEAU_QR, messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import {
  ACTIONS_JOURNAL_QR, ETATS_GESTIONNAIRE_QR, ORIGINES_ATTRIBUTION_QR, gestionCoproprieteQrVide,
  type AttributionVueQr, type CoproprieteQr, type EvenementJournalQr, type GestionnaireQr,
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

// ── PR 2, lot 5 : ouverture de l'accès d'une fiche (boutons du super admin) ─────────────────────────────────────────
// « Ouvrir l'accès à son suivi » : fiche active, non contestée, sans compte relié, adresse connue, aucun refus « autre
// espace » ni demande d'effacement, et migration 20261112 appliquée (champs d'accès présents : sinon aucun bouton, la
// route répondrait 503). « Renvoyer l'accès » : un accès est déjà en attente, ou un envoi « acces » existe (page profil).
// L'action groupée ne reprend que les fiches à OUVRIR (un accès en attente n'est pas renvoyé en masse).
describe('accès d’une fiche à l’espace de son cabinet (PR 2)', () => {
  const resume = { id: 'k1', nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }
  const fiche = (id: string, sur: Partial<GestionnaireQr> = {}): GestionnaireQr => ({
    id, nom: `Fiche ${id}`, cabinet: resume, email: `${id}@exemple.test`, etat: 'adresse_confirmee', domaineForce: false, coproprietes: 1,
    ouverts: 0, urgents: 0, creeLe: '2026-11-01T09:00:00.000Z', confirmeeLe: '2026-11-02T09:00:00.000Z',
    accesOuvertLe: null, connexionBloquee: false, effacementDemandeLe: null, compteRelie: false, ...sur,
  })
  const envoiAcces = { objet: 'acces' as const, creeLe: '2026-11-01T09:00:00.000Z', envoyeLe: '2026-11-01T09:00:00.000Z', accepteLe: null, refus: null }

  it('fiche active sans compte : « ouvrir » (adresse confirmée, confirmation envoyée ou expirée)', () => {
    expect(actionAccesGestionnaireQr(fiche('a'))).toBe('ouvrir')
    expect(actionAccesGestionnaireQr(fiche('b', { etat: 'confirmation_envoyee' }))).toBe('ouvrir')
    expect(actionAccesGestionnaireQr(fiche('c', { etat: 'confirmation_expiree' }))).toBe('ouvrir')
  })

  it('accès en attente, ou un envoi « acces » déjà fait (page profil) : « renvoyer »', () => {
    expect(actionAccesGestionnaireQr(fiche('a', { etat: 'acces_envoye' }))).toBe('renvoyer')
    expect(actionAccesGestionnaireQr(fiche('b'), [envoiAcces])).toBe('renvoyer')
    expect(actionAccesGestionnaireQr(fiche('c'), [{ ...envoiAcces, objet: 'confirmation_adresse' }])).toBe('ouvrir')
  })

  it('aucun bouton : migration 20261112 absente, compte relié, fiche désactivée, contestée, refus « autre espace », effacement, adresse effacée', () => {
    const { accesOuvertLe: _a, connexionBloquee: _b, effacementDemandeLe: _c, compteRelie: _d, ...pr1 } = fiche('x')
    expect(actionAccesGestionnaireQr(pr1)).toBeNull()
    expect(actionAccesGestionnaireQr(fiche('a', { compteRelie: true }))).toBeNull()
    expect(actionAccesGestionnaireQr(fiche('b', { etat: 'acces_ouvert', compteRelie: true, accesOuvertLe: '2026-11-03T09:00:00.000Z' }))).toBeNull()
    for (const etat of ['desactive', 'adresse_contestee', 'refus_autre_espace', 'effacement_demande'] as const) {
      expect(actionAccesGestionnaireQr(fiche(etat, { etat }))).toBeNull()
    }
    expect(actionAccesGestionnaireQr(fiche('c', { email: null }))).toBeNull()
  })

  it('action groupée : les seules fiches à ouvrir, dans l’ordre de la liste', () => {
    const liste = [fiche('a'), fiche('b', { etat: 'acces_envoye' }), fiche('c', { compteRelie: true }), fiche('d', { etat: 'desactive' }), fiche('e')]
    expect(fichesAccesOuvrablesQr(liste).map((g) => g.id)).toEqual(['a', 'e'])
  })

  it('états d’accès nommés pour le super admin', () => {
    expect(LIBELLE_ETAT_GESTIONNAIRE_QR.acces_envoye).toBe('Accès envoyé')
    expect(LIBELLE_ETAT_GESTIONNAIRE_QR.acces_ouvert).toBe('Accès ouvert')
    expect(LIBELLE_ETAT_GESTIONNAIRE_QR.refus_autre_espace).toBe('Adresse déjà utilisée par un autre espace')
  })
})

// PR 2, lot 6 : actions sur le compte relié d'une fiche (super admin), seulement avec les champs d'accès (20261112).
describe('compte relié d’une fiche : bloquer, débloquer, supprimer (PR 2, lot 6)', () => {
  const resume = { id: 'k1', nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }
  const fiche = (sur: Partial<GestionnaireQr> = {}): GestionnaireQr => ({
    id: G1, nom: 'Marie Exemple', cabinet: resume, email: 'marie@exemple.test', etat: 'desactive', domaineForce: false, coproprietes: 0,
    ouverts: 0, urgents: 0, creeLe: '2026-11-01T09:00:00.000Z', confirmeeLe: null,
    accesOuvertLe: '2026-11-02T09:00:00.000Z', connexionBloquee: false, effacementDemandeLe: null, compteRelie: true, ...sur,
  })
  const { accesOuvertLe: _a, connexionBloquee: _b, effacementDemandeLe: _c, compteRelie: _d, ...pr1 } = fiche()

  it('connexion à bloquer : fiche désactivée, compte relié, connexion non bloquée', () => {
    expect(connexionABloquerQr(fiche())).toBe(true)
    expect(connexionABloquerQr(fiche({ connexionBloquee: true }))).toBe(false)
    expect(connexionABloquerQr(fiche({ compteRelie: false }))).toBe(false)
    expect(connexionABloquerQr(fiche({ etat: 'acces_ouvert' }))).toBe(false)
    expect(connexionABloquerQr(pr1)).toBe(false)
  })

  it('connexion à débloquer : fiche active (réactivée) au compte encore bloqué', () => {
    expect(connexionADebloquerQr(fiche({ etat: 'acces_ouvert', connexionBloquee: true }))).toBe(true)
    expect(connexionADebloquerQr(fiche({ connexionBloquee: true }))).toBe(false)
    expect(connexionADebloquerQr(fiche({ etat: 'acces_ouvert' }))).toBe(false)
    expect(connexionADebloquerQr(pr1)).toBe(false)
  })

  it('compte à supprimer : fiche effacée (nom effacé) dont le compte reste relié', () => {
    expect(compteASupprimerQr(fiche({ nom: null, email: null }))).toBe(true)
    expect(compteASupprimerQr(fiche({ nom: null, email: null, compteRelie: false }))).toBe(false)
    expect(compteASupprimerQr(fiche())).toBe(false)
    expect(compteASupprimerQr({ ...pr1, nom: null })).toBe(false)
  })
})
