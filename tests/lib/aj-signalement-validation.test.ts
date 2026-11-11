// tests/lib/aj-signalement-validation.test.ts
//
// Schémas Zod d'AJ Signalement (lib/validation.ts) :
//   - tous les corps écrits des routes d'administration sont STRICTS (z.strictObject) : une clé inconnue est refusée ;
//   - les corps ACTUELS des écrans restent acceptés (creerCoproprieteQr, modifierCoproprieteQr, changerStatutSignalementQr) ;
//   - curseurs de date au format PostgREST « …123456+00:00 » acceptés ({ offset: true }) ;
//   - identifiant de cabinet rogné, en minuscules, format et noms réservés ; domaine : format et messageries publiques ;
//   - les schémas PUBLICS (dépôt, adresse, semblables) ne changent pas.
// Aucune donnée réelle : « cabinet-exemple », « exemple.test ».

import { describe, it, expect } from 'vitest'
import {
  attributionsCoproprieteQrSchema, attributionsGestionnaireQrSchema, cabinetQrSchema, coproprieteQrSchema, departGestionnaireQrSchema,
  domaineQrSchema, gestionnaireQrSchema, identifiantCabinetQrSchema, jetonLienQrSchema, journalQrQuerySchema, langueCabinetQrSchema,
  listeGestionnairesQrQuerySchema, modificationCabinetQrSchema, modificationCoproprieteQrSchema, modificationGestionnaireQrSchema,
  rattachementQrSchema, semblablesQrQuerySchema, signalementQrSchema, signalementsCoproQrQuerySchema, statutSignalementQrSchema,
  suppressionCoproprieteQrSchema, tableauQrQuerySchema,
} from '@/lib/validation'

const UUID = 'c0000000-0000-4000-8000-000000000001'
const JETON_LIEN = `${'a'.repeat(48)}.${'b'.repeat(64)}`
const CURSEUR = '2026-11-10T12:00:00.123456+00:00'

describe('corps actuels des écrans : acceptés tels quels', () => {
  it('creerCoproprieteQr : { nom, adresse, emailsDestinataires } sans operationId', () => {
    const r = coproprieteQrSchema.safeParse({ nom: 'Résidence Exemple', adresse: '1 rue Exemple', emailsDestinataires: ['cs@exemple.test'] })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data).toMatchObject({
        nom: 'Résidence Exemple', codePostal: '', ville: '', immatriculation: '', referenceCabinet: '', batiments: [],
        gestionnaireIds: [], attribueeATous: false, forcerDoublon: false, confirmerDoublonProbable: false, confirmerHorsDomaine: false,
      })
      expect(r.data.operationId).toBeUndefined()
      expect(r.data.cabinetId).toBeUndefined()
    }
  })

  it('modifierCoproprieteQr : { …saisie, actif }, { regenererJeton: true }, { adresse }', () => {
    expect(modificationCoproprieteQrSchema.safeParse({ nom: 'Résidence Exemple', adresse: '', emailsDestinataires: [], actif: false }).success).toBe(true)
    expect(modificationCoproprieteQrSchema.safeParse({ regenererJeton: true }).success).toBe(true)
    expect(modificationCoproprieteQrSchema.safeParse({ adresse: '1 rue Exemple' }).success).toBe(true)
  })

  it('changerStatutSignalementQr : { statut } seul ; statutAttendu facultatif', () => {
    expect(statutSignalementQrSchema.safeParse({ statut: 'en_cours' }).success).toBe(true)
    expect(statutSignalementQrSchema.safeParse({ statut: 'en_cours', statutAttendu: 'en_attente' }).success).toBe(true)
  })
})

describe('corps stricts : clé inconnue refusée', () => {
  it.each([
    ['coproprieteQrSchema', coproprieteQrSchema, { nom: 'X', jeton: '0'.repeat(32) }],
    ['modificationCoproprieteQrSchema (cabinetId : rattachement par sa route)', modificationCoproprieteQrSchema, { nom: 'X', cabinetId: UUID }],
    ['statutSignalementQrSchema', statutSignalementQrSchema, { statut: 'en_cours', coproprieteId: UUID }],
    ['gestionnaireQrSchema (id tiré par la route)', gestionnaireQrSchema, { nom: 'Marie Exemple', email: 'marie@exemple.test', cabinetId: UUID, id: UUID }],
    ['attributionsCoproprieteQrSchema', attributionsCoproprieteQrSchema, { gestionnaireIds: [], origine: 'import' }],
    ['attributionsGestionnaireQrSchema', attributionsGestionnaireQrSchema, { coproprieteIds: [], acteur: UUID }],
    ['departGestionnaireQrSchema', departGestionnaireQrSchema, { successions: [], motif: 'x' }],
    ['suppressionCoproprieteQrSchema', suppressionCoproprieteQrSchema, { nomConfirmation: 'X', force: true }],
    ['jetonLienQrSchema', jetonLienQrSchema, { token: JETON_LIEN, cabinet: 'cabinet-exemple', email: 'x@exemple.test' }],
    ['cabinetQrSchema', cabinetQrSchema, { nom: 'X', identifiant: 'cabinet-exemple', domaines: [], cree_par: UUID }],
    ['modificationCabinetQrSchema', modificationCabinetQrSchema, { nom: 'X', id: UUID }],
    ['rattachementQrSchema', rattachementQrSchema, { coproprieteIds: [UUID], cabinetId: UUID }],
  ])('%s', (_nom, schema, corps) => {
    expect(schema.safeParse(corps).success).toBe(false)
  })

  it('paramètres de requête stricts (un paramètre inconnu donne 400)', () => {
    expect(tableauQrQuerySchema.safeParse({ gestionnaire: UUID, cabinet: UUID }).success).toBe(true)
    expect(tableauQrQuerySchema.safeParse({ vue: 'x' }).success).toBe(false)
    expect(listeGestionnairesQrQuerySchema.safeParse({}).data).toEqual({ etat: 'actifs' })
    expect(listeGestionnairesQrQuerySchema.safeParse({ etat: 'tous', cabinet: UUID }).success).toBe(true)
    expect(listeGestionnairesQrQuerySchema.safeParse({ page: '2' }).success).toBe(false)
  })
})

describe('règles des corps', () => {
  it('modification : au moins un champ autre qu’un drapeau de confirmation ; regenererJeton vaut true seulement', () => {
    expect(modificationCoproprieteQrSchema.safeParse({}).success).toBe(false)
    expect(modificationCoproprieteQrSchema.safeParse({ forcerDoublon: true, confirmerHorsDomaine: true }).success).toBe(false)
    expect(modificationCoproprieteQrSchema.safeParse({ regenererJeton: false }).success).toBe(false)
    expect(modificationCoproprieteQrSchema.safeParse({ attribueeATous: true }).success).toBe(true)
  })

  it('code postal (5 chiffres ou format portugais), immatriculation normalisée', () => {
    expect(coproprieteQrSchema.safeParse({ nom: 'X', codePostal: '13001' }).success).toBe(true)
    expect(coproprieteQrSchema.safeParse({ nom: 'X', codePostal: '4000-123' }).success).toBe(true)
    expect(coproprieteQrSchema.safeParse({ nom: 'X', codePostal: '1300' }).success).toBe(false)
    const r = coproprieteQrSchema.safeParse({ nom: 'X', immatriculation: 'ab.123 45-c' })
    expect(r.success && r.data.immatriculation).toBe('AB12345C')
  })

  it('gestionnaire : cabinetId obligatoire, e-mail rogné et en minuscules', () => {
    expect(gestionnaireQrSchema.safeParse({ nom: 'Marie Exemple', email: 'marie@exemple.test' }).success).toBe(false)
    const r = gestionnaireQrSchema.safeParse({ nom: ' Marie Exemple ', email: 'Marie@Exemple.TEST', cabinetId: UUID })
    expect(r.success && r.data).toEqual({ nom: 'Marie Exemple', email: 'marie@exemple.test', cabinetId: UUID, coproprieteIds: [], forcerDomaine: false })
  })

  it('modification d’une fiche : une seule action (nom · actif: true · pseudonymiser: true)', () => {
    expect(modificationGestionnaireQrSchema.safeParse({ nom: 'Marie' }).success).toBe(true)
    expect(modificationGestionnaireQrSchema.safeParse({ actif: true }).success).toBe(true)
    expect(modificationGestionnaireQrSchema.safeParse({ actif: false }).success).toBe(false)
    expect(modificationGestionnaireQrSchema.safeParse({ pseudonymiser: true }).success).toBe(true)
    expect(modificationGestionnaireQrSchema.safeParse({ nom: 'Marie', actif: true }).success).toBe(false)
  })

  it('départ : une succession = { coproprieteId, versGestionnaireId | null }', () => {
    expect(departGestionnaireQrSchema.safeParse({ successions: [{ coproprieteId: UUID, versGestionnaireId: null }] }).success).toBe(true)
    expect(departGestionnaireQrSchema.safeParse({ successions: [{ coproprieteId: UUID }] }).success).toBe(false)
  })

  it('lien de confirmation : jeton signé + identifiant du chemin (format seul, rogné, minuscules)', () => {
    expect(jetonLienQrSchema.safeParse({ token: JETON_LIEN, cabinet: 'cabinet-exemple' }).success).toBe(true)
    expect(jetonLienQrSchema.safeParse({ token: JETON_LIEN }).success).toBe(false)
    expect(jetonLienQrSchema.safeParse({ token: 'a'.repeat(48), cabinet: 'cabinet-exemple' }).success).toBe(false)
    expect(jetonLienQrSchema.safeParse({ token: JETON_LIEN, cabinet: 'Cabinet Exemple' }).success).toBe(false)
  })
})

describe('curseurs de date (format PostgREST)', () => {
  it('« …123456+00:00 » accepté et gardé tel quel ; « Z » aussi ; date libre refusée', () => {
    const r = signalementsCoproQrQuerySchema.safeParse({ avant: CURSEUR, avantId: UUID })
    expect(r.success && r.data.avant).toBe(CURSEUR)
    expect(signalementsCoproQrQuerySchema.safeParse({ avant: '2026-11-10T12:00:00.123Z' }).success).toBe(true)
    expect(signalementsCoproQrQuerySchema.safeParse({ avant: '10/11/2026' }).success).toBe(false)
    expect(signalementsCoproQrQuerySchema.safeParse({}).data).toEqual({ statut: 'ouverts', limite: 50 })
    expect(journalQrQuerySchema.safeParse({ avant: CURSEUR, avantId: '42' }).success).toBe(true)
    expect(journalQrQuerySchema.safeParse({ avantId: 'abc' }).success).toBe(false)
    expect(journalQrQuerySchema.safeParse({}).data).toEqual({ limite: 100 })
    expect(journalQrQuerySchema.safeParse({ action: 'cabinet.cree' }).success).toBe(true)
    expect(journalQrQuerySchema.safeParse({ action: 'inconnue' }).success).toBe(false)
  })
})

describe('cabinets : identifiant, langue, domaines', () => {
  it('identifiant rogné et mis en minuscules ; hors format refusé ; réservé refusé avec « Identifiant réservé »', () => {
    expect(identifiantCabinetQrSchema.safeParse('  Cabinet-Exemple ').data).toBe('cabinet-exemple')
    for (const mauvais of ['ab', 'a--b', '-ab', 'ab-', 'cabinet_exemple', 'é'.repeat(5), 'a'.repeat(41)]) {
      expect(identifiantCabinetQrSchema.safeParse(mauvais).success, mauvais).toBe(false)
    }
    const reserve = identifiantCabinetQrSchema.safeParse('signalement')
    expect(reserve.success).toBe(false)
    if (!reserve.success) expect(reserve.error.issues[0].message).toBe('Identifiant réservé')
    expect(identifiantCabinetQrSchema.safeParse('confirmation-adresse').success).toBe(false)
  })

  it('langue fr | pt (fr par défaut) ; domaines en minuscules, messageries publiques refusées, 20 au plus', () => {
    expect(langueCabinetQrSchema.safeParse('es').success).toBe(false)
    const r = cabinetQrSchema.safeParse({ nom: ' Cabinet Exemple ', identifiant: 'cabinet-exemple', domaines: ['Exemple.TEST'] })
    expect(r.success && r.data).toEqual({ nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr', domaines: ['exemple.test'] })
    expect(domaineQrSchema.safeParse('gmail.com').success).toBe(false)
    expect(domaineQrSchema.safeParse('exemple').success).toBe(false)
    expect(cabinetQrSchema.safeParse({ nom: 'X', identifiant: 'cabinet-exemple', domaines: Array.from({ length: 21 }, (_, i) => `d${i}.exemple.test`) }).success).toBe(false)
  })

  it('modification d’un cabinet : au moins une clé ; rattachement : 1 à 500 copropriétés', () => {
    expect(modificationCabinetQrSchema.safeParse({}).success).toBe(false)
    expect(modificationCabinetQrSchema.safeParse({ domaines: [] }).success).toBe(true)
    expect(rattachementQrSchema.safeParse({ coproprieteIds: [] }).success).toBe(false)
    expect(rattachementQrSchema.safeParse({ coproprieteIds: [UUID] }).success).toBe(true)
  })
})

describe('schémas publics inchangés', () => {
  it('dépôt et signalements semblables : clé inconnue ignorée (pas de rupture pour la page publique)', () => {
    const depot = {
      jeton: '0'.repeat(32), prenom: 'P', nom: 'N', telephone: '0600000000', email: 'p@exemple.test', batiment: 'A', etage: '1', numLot: '1',
      qualiteDeclarant: 'locataire', estPartieCommune: false, typeIntervention: 'Plomberie', description: 'Fuite d’eau au plafond', priorite: 'normale',
      champInconnu: 'x',
    }
    expect(signalementQrSchema.safeParse(depot).success).toBe(true)
    expect(semblablesQrQuerySchema.safeParse({ jeton: '0'.repeat(32), batiment: 'A', zone: 'Hall', autre: '1' }).success).toBe(true)
  })
})
