// tests/lib/aj-signalement-minimisation.test.ts
//
// lib/aj-signalement/minimisation.ts (PR 2, SPEC § 2.5) : ce qu'un gestionnaire connecté reçoit d'une copropriété et
// d'un signalement. Module pur. Jamais : nom, e-mail ou identifiant d'un autre gestionnaire, liste des gestionnaires,
// auteur nominatif d'un changement de statut, email_erreur, confirmation_erreur, adresse proposée, auteur d'une
// copropriété créée par un collègue. Les adresses saisies qui sont celles d'une AUTRE fiche sont remplacées par un
// compteur (adressesMasquees) ; une copropriété désactivée reste visible sans son jeton (aucun QR code).
// Données fictives (@exemple.test, « Résidence Exemple »).

import { describe, it, expect } from 'vitest'
import {
  auteurStatutQr, coproprieteVueGestionnaireQr, signalementVuGestionnaireQr, tableauVuGestionnaireQr, type VueGestionnaireQr,
} from '@/lib/aj-signalement/minimisation'
import { gestionCoproprieteQrVide, type CoproprieteQr, type SignalementQr } from '@/lib/aj-signalement/types'

const U1 = '0b000000-0000-4000-8000-000000000001'
const U2 = '0b000000-0000-4000-8000-000000000002'
const G1 = 'a0000000-0000-4000-8000-000000000001'
const G2 = 'a0000000-0000-4000-8000-000000000002'
const CAB = 'ca000000-0000-4000-8000-000000000001'
const C1 = 'c0000000-0000-4000-8000-000000000001'
const C2 = 'c0000000-0000-4000-8000-000000000002'
const C_TOUS = 'c0000000-0000-4000-8000-000000000003'
const S1 = '5f000000-0000-4000-8000-000000000001'
const S2 = '5f000000-0000-4000-8000-000000000002'
const JETON = '0123456789abcdef0123456789abcdef'

const copro = (id: string, sur: Partial<CoproprieteQr> = {}): CoproprieteQr => ({
  ...gestionCoproprieteQrVide(),
  id, nom: 'Résidence Exemple', adresse: '1 rue Exemple', jeton: JETON, emailsDestinataires: [], actif: true,
  creeLe: '2026-11-01T09:00:00+00:00', nbSignalements: 2, nbEnAttente: 1, derniereAdresseProposee: { adresse: '2 rue Proposée', le: '2026-11-02' },
  cabinet: { id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }, codePostal: '13001', ville: 'Marseille',
  gestionnaires: [{ id: G1, nom: 'Marie Exemple' }, { id: G2, nom: 'Paul Collègue' }], adressesDeGestionnaires: 1,
  ...sur,
})

const signalement = (id: string, coproprieteId: string, sur: Partial<SignalementQr> = {}): SignalementQr => ({
  id, coproprieteId, coproprieteNom: 'Résidence Exemple', prenom: 'Prénom', nom: 'Déclarant', telephone: '0600000000',
  email: 'declarant@exemple.test', batiment: 'A', etage: '1', numLot: '7', estPartieCommune: false, zoneSignalee: '',
  typeIntervention: 'Plomberie', description: 'Fuite d’eau', priorite: 'normale', statut: 'en_attente', langue: 'fr',
  emailEnvoyeLe: '2026-11-10T09:01:00+00:00', emailErreur: 'partiel : 1 refusé', confirmationEnvoyeeLe: null, confirmationErreur: 'refusé',
  qualiteDeclarant: 'locataire', adresseProposee: '3 rue Proposée', signalementLieId: null, creeLe: '2026-11-10T09:00:00+00:00',
  misAJourLe: '2026-11-10T09:00:00+00:00', ...sur,
})

const vue = (sur: Partial<VueGestionnaireQr> = {}): VueGestionnaireQr => ({
  userId: U1, gestionnaireId: G1, nom: 'Marie Exemple',
  portee: { visibles: new Set([C1, C_TOUS]), modifiables: new Set([C1]) },
  fichesSaisies: [{ id: G1, email: 'marie.exemple@exemple.test' }, { id: G2, email: 'paul.collegue@exemple.test' }],
  ...sur,
})

describe('auteurStatutQr : qui a changé le statut, sans nom', () => {
  it.each([
    [{ par: U1, profil: 'gestionnaire' }, 'vous'],
    [{ par: U2, profil: 'gestionnaire' }, 'collegue'],
    [{ par: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4', profil: 'super_admin' }, 'cabinet'],
    [{ par: U1, profil: 'super_admin' }, 'cabinet'],
    [{ par: null, profil: null }, null],
    [{ par: U1, profil: 'inconnu' }, null],
    [null, null],
  ] as const)('%o → %s', (trace, attendu) => {
    expect(auteurStatutQr(trace, U1)).toBe(attendu)
  })
})

describe('coproprieteVueGestionnaireQr', () => {
  it('aucune donnée d’un autre gestionnaire : liste vide, adresse d’un collègue masquée (compteur), la sienne et les extérieures gardées', () => {
    const c = coproprieteVueGestionnaireQr(copro(C_TOUS, {
      attribueeATous: true,
      emailsDestinataires: ['cs@externe.test', 'Paul.Collegue@exemple.test', 'marie.exemple@exemple.test'],
      creePar: { gestionnaireId: G2, nom: 'Paul Collègue' },
    }), vue())
    expect(c.gestionnaires).toEqual([])
    expect(c.emailsDestinataires).toEqual(['cs@externe.test', 'marie.exemple@exemple.test'])
    expect(c.adressesMasquees).toBe(1)
    expect(c.adressesDeGestionnaires).toBe(0)
    expect(c.derniereAdresseProposee).toBeNull()
    expect(c.creePar).toBe('administrateur')
    expect(c.creeeParVous).toBe(false)
    expect(c.modifiable).toBe(false)
    const texte = JSON.stringify(c)
    expect(texte).not.toContain(G2)
    expect(texte).not.toMatch(/Paul/i)
    expect(texte).not.toContain('paul.collegue')
  })

  it('créée par lui : « créée par vous », son nom seulement ; attribuée explicitement : modifiable', () => {
    const c = coproprieteVueGestionnaireQr(copro(C1, { creePar: { gestionnaireId: G1, nom: 'Marie Exemple' } }), vue())
    expect(c.creePar).toEqual({ gestionnaireId: G1, nom: 'Marie Exemple' })
    expect(c.creeeParVous).toBe(true)
    expect(c.modifiable).toBe(true)
    expect(c.jeton).toBe(JETON)
    expect(c.cabinet).toEqual({ id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' })
  })

  it('copropriété désactivée : visible sans son jeton (aucun QR code)', () => {
    const c = coproprieteVueGestionnaireQr(copro(C1, { actif: false }), vue())
    expect(c.actif).toBe(false)
    expect(c.jeton).toBe('')
  })

  it('n’écrit pas dans la copropriété reçue', () => {
    const origine = copro(C1, { emailsDestinataires: ['paul.collegue@exemple.test'] })
    coproprieteVueGestionnaireQr(origine, vue())
    expect(origine.gestionnaires).toHaveLength(2)
    expect(origine.emailsDestinataires).toEqual(['paul.collegue@exemple.test'])
  })
})

describe('signalementVuGestionnaireQr', () => {
  it('erreurs d’envoi, de confirmation et adresse proposée retirées ; date d’envoi et coordonnées du déclarant gardées', () => {
    const s = signalementVuGestionnaireQr(signalement(S1, C1), { par: U2, profil: 'gestionnaire' }, vue())
    expect(s.emailErreur).toBeNull()
    expect(s.confirmationErreur).toBeNull()
    expect(s.adresseProposee).toBe('')
    expect(s.emailEnvoyeLe).toBe('2026-11-10T09:01:00+00:00')
    expect(s).toMatchObject({ prenom: 'Prénom', nom: 'Déclarant', telephone: '0600000000', email: 'declarant@exemple.test' })
    expect(s.statutModifiePar).toBe('collegue')
    expect(JSON.stringify(s)).not.toContain(U2)
  })

  it('sans trace : statutModifiePar null', () => {
    expect(signalementVuGestionnaireQr(signalement(S1, C1), null, vue()).statutModifiePar).toBeNull()
  })
})

describe('tableauVuGestionnaireQr', () => {
  it('ne garde QUE les copropriétés et signalements de sa portée (défense en profondeur), sans fiche de suivi', () => {
    const t = tableauVuGestionnaireQr({
      coproprietes: [copro(C1), copro(C2), copro(C_TOUS, { attribueeATous: true })],
      signalements: [signalement(S1, C1), signalement(S2, C2)],
      gestionnaire: { id: G2, nom: 'Paul Collègue', actif: true, cabinet: { id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' } },
    }, new Map([[S1, { par: U1, profil: 'gestionnaire' }]]), vue())
    expect(t.coproprietes.map((c) => c.id)).toEqual([C1, C_TOUS])
    expect(t.signalements.map((s) => s.id)).toEqual([S1])
    expect(t.signalements[0].statutModifiePar).toBe('vous')
    expect(t.gestionnaire).toBeUndefined()
    expect(Object.keys(t).sort()).toEqual(['coproprietes', 'signalements'])
    expect(JSON.stringify(t)).not.toContain(G2)
  })
})
