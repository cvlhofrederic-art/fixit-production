// tests/lib/aj-signalement-bureaux.test.ts
//
// Bureaux des cabinets clients (PR 1, sans écran) : module pur lib/aj-signalement/bureaux.ts (formes, règle « bureau
// requis », bornes alignées sur la migration 20261119_signalements_qr_bureaux.sql) et schémas Zod de lib/validation.ts
// (corps des routes des bureaux, bureauId des routes modifiées, filtres ?bureau=). Les corps d'un GESTIONNAIRE et
// l'import Excel restent sans bureau en V1 (une clé « bureau » y est refusée). Aucune donnée réelle : « Nord », « Sud ».

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  BUREAUX_MAX_PAR_CABINET_QR, FILTRE_SANS_BUREAU_QR, NOM_BUREAU_MAX_QR, bureauDepuisLigneQr, bureauRequisQr, bureauResumeDepuisLigneQr,
  contientControleQr, nombresBureauxQr,
} from '@/lib/aj-signalement/bureaux'
import {
  bureauQrSchema, coproprieteGestionnaireQrSchema, coproprieteQrSchema, gestionnaireQrSchema, importCoproprietesQrSchema,
  listeGestionnairesQrQuerySchema, modificationBureauQrSchema, modificationCoproprieteGestionnaireQrSchema, modificationCoproprieteQrSchema,
  modificationGestionnaireQrSchema, tableauQrQuerySchema,
} from '@/lib/validation'

const UUID = 'b0000000-0000-4000-8000-000000000001'
const CAB = 'ca000000-0000-4000-8000-000000000001'
const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20261119_signalements_qr_bureaux.sql'), 'utf-8')

describe('bornes alignées sur la migration', () => {
  it('nom : 80 caractères au plus (CHECK de la table et fonction) ; 100 bureaux par cabinet (fonction de création)', () => {
    expect(NOM_BUREAU_MAX_QR).toBe(80)
    expect(migration).toContain(`char_length(nom) BETWEEN 1 AND ${NOM_BUREAU_MAX_QR}`)
    expect(migration).toContain(`char_length(v_nom) NOT BETWEEN 1 AND ${NOM_BUREAU_MAX_QR}`)
    expect(BUREAUX_MAX_PAR_CABINET_QR).toBe(100)
    expect(migration).toContain(`>= ${BUREAUX_MAX_PAR_CABINET_QR} THEN`)
    expect(FILTRE_SANS_BUREAU_QR).toBe('aucun')
  })

  it('caractères de contrôle : C0, DEL et C1 refusés ; lettres accentuées, tirets, apostrophes acceptés', () => {
    for (const nom of ['Nord\n', 'Nord\tSud', '\u0000', 'Nord\u007f', 'Nord\u0085']) expect(contientControleQr(nom), JSON.stringify(nom)).toBe(true)
    for (const nom of ['Nord', 'Saint-Étienne', 'L’Isle', 'Île-de-France Est', 'Bureau n° 2']) expect(contientControleQr(nom), nom).toBe(false)
  })
})

describe('formes publiques', () => {
  const ligne = { id: UUID, cabinet_id: CAB, nom: 'Nord', ferme_le: null, created_at: '2026-11-19T09:00:00+00:00' }

  it('résumé posé sur une fiche ou une copropriété : { id, nom, ferme }', () => {
    expect(bureauResumeDepuisLigneQr(ligne)).toEqual({ id: UUID, nom: 'Nord', ferme: false })
    expect(bureauResumeDepuisLigneQr({ ...ligne, ferme_le: '2026-11-19T10:00:00+00:00' })).toEqual({ id: UUID, nom: 'Nord', ferme: true })
    expect(bureauResumeDepuisLigneQr({ ...ligne, nom: null })).toEqual({ id: UUID, nom: '', ferme: false })
  })

  it('bureau de la liste : cabinet, dates, nombres de rattachements actifs (0 par défaut)', () => {
    expect(bureauDepuisLigneQr(ligne)).toEqual({
      id: UUID, cabinetId: CAB, nom: 'Nord', ferme: false, fermeLe: null, creeLe: '2026-11-19T09:00:00+00:00', nbGestionnaires: 0, nbCoproprietes: 0,
    })
    expect(bureauDepuisLigneQr(ligne, { gestionnaires: 3, coproprietes: 7 })).toMatchObject({ nbGestionnaires: 3, nbCoproprietes: 7 })
  })

  it('nombres de bureaux d’un cabinet : total (fermés compris) et ouverts', () => {
    expect(nombresBureauxQr([{ ferme_le: null }, { ferme_le: '2026-11-19T10:00:00+00:00' }, { ferme_le: null }])).toEqual({ total: 3, ouverts: 2 })
    expect(nombresBureauxQr([])).toEqual({ total: 0, ouverts: 0 })
  })

  it('bureau requis pour une nouvelle fiche dès qu’un bureau est OUVERT (même règle que le trigger)', () => {
    expect(bureauRequisQr([])).toBe(false)
    expect(bureauRequisQr([{ ferme_le: '2026-11-19T10:00:00+00:00' }])).toBe(false)
    expect(bureauRequisQr([{ ferme_le: '2026-11-19T10:00:00+00:00' }, { ferme_le: null }])).toBe(true)
  })
})

describe('schémas des routes des bureaux (super admin)', () => {
  it('création : { nom } rogné, 1 à 80 caractères, sans caractère de contrôle ; strict', () => {
    expect(bureauQrSchema.parse({ nom: '  Nord  ' })).toEqual({ nom: 'Nord' })
    expect(bureauQrSchema.safeParse({ nom: 'x'.repeat(80) }).success).toBe(true)
    for (const corps of [{ nom: '' }, { nom: '   ' }, { nom: 'x'.repeat(81) }, { nom: 'Nord\nSud' }, { nom: 'Nord', cabinetId: CAB }, { nom: 'Nord', contactEmail: 'b@exemple.test' }, {}]) {
      expect(bureauQrSchema.safeParse(corps).success, JSON.stringify(corps)).toBe(false)
    }
  })

  it('modification : une seule action — { nom }, { fermer: true }, { fermer: false } ; deux à la fois ou rien : refusé', () => {
    expect(modificationBureauQrSchema.parse({ nom: ' Sud ' })).toEqual({ nom: 'Sud' })
    expect(modificationBureauQrSchema.parse({ fermer: true })).toEqual({ fermer: true })
    expect(modificationBureauQrSchema.parse({ fermer: false })).toEqual({ fermer: false })
    for (const corps of [{}, { nom: 'Sud', fermer: true }, { fermer: 'oui' }, { ferme: true }, { cabinetId: CAB }]) {
      expect(modificationBureauQrSchema.safeParse(corps).success, JSON.stringify(corps)).toBe(false)
    }
  })
})

describe('bureauId dans les routes modifiées', () => {
  it('création d’une fiche : bureauId facultatif (uuid) ; absent : aucune clé', () => {
    const base = { nom: 'Julie Nouvelle', email: 'julie.nouvelle@exemple.test', cabinetId: CAB }
    expect(gestionnaireQrSchema.parse({ ...base, bureauId: UUID }).bureauId).toBe(UUID)
    expect(gestionnaireQrSchema.parse(base)).not.toHaveProperty('bureauId')
    expect(gestionnaireQrSchema.safeParse({ ...base, bureauId: 'nord' }).success).toBe(false)
    expect(gestionnaireQrSchema.safeParse({ ...base, bureauId: null }).success).toBe(false)
  })

  it('modification d’une fiche : { bureauId } seul ; jamais null (le bureau se change, il ne se retire pas)', () => {
    expect(modificationGestionnaireQrSchema.parse({ bureauId: UUID })).toEqual({ bureauId: UUID })
    for (const corps of [{ bureauId: null }, { bureauId: UUID, nom: 'Marie Exemple' }, { bureauId: UUID, actif: true }]) {
      expect(modificationGestionnaireQrSchema.safeParse(corps).success, JSON.stringify(corps)).toBe(false)
    }
    // Les actions existantes restent acceptées.
    expect(modificationGestionnaireQrSchema.safeParse({ nom: 'Marie Exemple' }).success).toBe(true)
    expect(modificationGestionnaireQrSchema.safeParse({ actif: true }).success).toBe(true)
  })

  it('copropriété (super admin) : bureauId facultatif à la création ; uuid ou null à la modification (compte comme une modification)', () => {
    expect(coproprieteQrSchema.parse({ nom: 'Résidence Exemple', cabinetId: CAB, bureauId: UUID }).bureauId).toBe(UUID)
    expect(coproprieteQrSchema.parse({ nom: 'Résidence Exemple' })).not.toHaveProperty('bureauId')
    expect(modificationCoproprieteQrSchema.parse({ bureauId: UUID })).toEqual({ bureauId: UUID })
    expect(modificationCoproprieteQrSchema.parse({ bureauId: null })).toEqual({ bureauId: null })
    expect(modificationCoproprieteQrSchema.safeParse({ bureauId: 'nord' }).success).toBe(false)
  })

  it('gestionnaire connecté : aucun bureau dans ses corps (choix 3, le bureau est tenu par le super admin)', () => {
    expect(coproprieteGestionnaireQrSchema.safeParse({
      operationId: UUID, nom: 'Résidence Exemple', adresse: '1 rue Exemple', codePostal: '13001', ville: 'Ville Exemple', bureauId: UUID,
    }).success).toBe(false)
    expect(modificationCoproprieteGestionnaireQrSchema.safeParse({ bureauId: UUID }).success).toBe(false)
  })

  it('import Excel : sans colonne « bureau » en V1 (une clé bureau ou bureauId dans une ligne est refusée)', () => {
    const ligne = { numeroLigne: 1, nom: 'Résidence Exemple' }
    const corps = (l: Record<string, unknown>) => ({ mode: 'verifier', operationId: UUID, cabinetId: CAB, lignes: [l] })
    expect(importCoproprietesQrSchema.safeParse(corps(ligne)).success).toBe(true)
    expect(importCoproprietesQrSchema.safeParse(corps({ ...ligne, bureau: 'Nord' })).success).toBe(false)
    expect(importCoproprietesQrSchema.safeParse(corps({ ...ligne, bureauId: UUID })).success).toBe(false)
  })
})

describe('filtres ?bureau= (super admin)', () => {
  it('liste des gestionnaires : uuid ou « aucun » ; autre valeur refusée', () => {
    expect(listeGestionnairesQrQuerySchema.parse({ bureau: UUID })).toMatchObject({ bureau: UUID })
    expect(listeGestionnairesQrQuerySchema.parse({ bureau: 'aucun' })).toMatchObject({ bureau: 'aucun' })
    expect(listeGestionnairesQrQuerySchema.parse({})).not.toHaveProperty('bureau')
    expect(listeGestionnairesQrQuerySchema.safeParse({ bureau: 'nord' }).success).toBe(false)
  })

  it('tableau : uuid seulement', () => {
    expect(tableauQrQuerySchema.parse({ bureau: UUID })).toEqual({ bureau: UUID })
    expect(tableauQrQuerySchema.safeParse({ bureau: 'aucun' }).success).toBe(false)
    expect(tableauQrQuerySchema.parse({ cabinet: CAB })).toEqual({ cabinet: CAB })
  })
})
