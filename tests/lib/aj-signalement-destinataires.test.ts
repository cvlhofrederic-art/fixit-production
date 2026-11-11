// tests/lib/aj-signalement-destinataires.test.ts
//
// Destinataires d'un signalement (SPEC § 1.7.1, RG-06, RG-06 bis) : fonction pure lib/aj-signalement/destinataires.ts.
//   - (adresses saisies MOINS les adresses de fiches inactives ou contestées) ∪ gestionnaires de la copropriété actifs
//     à adresse confirmée (lignes de signalements_qr_emails_gestionnaires), dédoublonnés sur l'adresse canonique ;
//   - une adresse présente des deux côtés garde le type « gestionnaire » ;
//   - ADMIN_EMAIL / ADMIN_EMAIL_2 seulement si l'union est vide (règle actuelle) ; plafond de 100 (un lot Resend).
// La sélection des fiches (actives, confirmées, non contestées, attribuées ou « à tous » du même cabinet) est faite par
// la fonction SQL : ses lignes arrivent ici déjà filtrées. Adresses fictives en exemple.test.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  DESTINATAIRES_MAX_QR, adressesDeFichesQr, destinatairesSignalementQr, saisiesVisiblesQr,
} from '@/lib/aj-signalement/destinataires'
import { destinatairesSignalement } from '@/lib/aj-signalement/serveur'
import type { LigneEmailGestionnaireQr } from '@/lib/aj-signalement/types'

const ENV = { ADMIN_EMAIL: 'Admin@Exemple.test', ADMIN_EMAIL_2: 'admin2@exemple.test' }
const SANS_ADMIN = {}
const g = (gestionnaireId: string, email: string, champs: Partial<LigneEmailGestionnaireQr> = {}): LigneEmailGestionnaireQr => ({
  gestionnaireId, email, accesOuvert: false, exclu: false, ...champs,
})
const adresses = (r: ReturnType<typeof destinatairesSignalementQr>) => r.destinataires.map((d) => d.email)

describe('destinatairesSignalementQr', () => {
  it('adresses saisies seules : type « saisi », rognées, en minuscules, dédoublonnées, sans les valeurs sans « @ »', () => {
    const r = destinatairesSignalementQr({ emails_destinataires: [' CS@Exemple.test ', 'cs@exemple.test', 'pas-une-adresse', ''] }, [], ENV)
    expect(r).toEqual({ destinataires: [{ email: 'cs@exemple.test', type: 'saisi', accesOuvert: false }], auDelaDuPlafond: 0 })
  })

  it('saisies ∪ gestionnaires ; une adresse des deux côtés (casse, espaces) → une seule entrée, de type « gestionnaire »', () => {
    const r = destinatairesSignalementQr(
      { emails_destinataires: ['cs@exemple.test', ' Marie.Martin@Exemple.test'] },
      [g('g1', 'marie.martin@exemple.test', { accesOuvert: true }), g('g2', 'paul.durand@exemple.test')],
      ENV,
    )
    expect(r.destinataires).toEqual([
      { email: 'cs@exemple.test', type: 'saisi', accesOuvert: false },
      { email: 'marie.martin@exemple.test', type: 'gestionnaire', accesOuvert: true },
      { email: 'paul.durand@exemple.test', type: 'gestionnaire', accesOuvert: false },
    ])
  })

  it('gestionnaires seuls (copropriété sans saisie, ou « à tous ») : l’administrateur ne reçoit rien (Q3 : règle actuelle)', () => {
    const r = destinatairesSignalementQr({ emails_destinataires: [] }, [g('g1', 'marie.martin@exemple.test'), g('g2', 'paul.durand@exemple.test')], ENV)
    expect(r.destinataires.map((d) => d.type)).toEqual(['gestionnaire', 'gestionnaire'])
    expect(adresses(r)).not.toContain('admin@exemple.test')
  })

  it('union vide : repli ADMIN_EMAIL puis ADMIN_EMAIL_2, type « administrateur », dédoublonnés', () => {
    expect(destinatairesSignalementQr({ emails_destinataires: null }, [], ENV).destinataires).toEqual([
      { email: 'admin@exemple.test', type: 'administrateur', accesOuvert: false },
      { email: 'admin2@exemple.test', type: 'administrateur', accesOuvert: false },
    ])
    expect(adresses(destinatairesSignalementQr({}, [], { ADMIN_EMAIL: 'a@exemple.test', ADMIN_EMAIL_2: ' A@exemple.test' }))).toEqual(['a@exemple.test'])
    expect(destinatairesSignalementQr({}, [], SANS_ADMIN).destinataires).toEqual([])
  })

  it('adresse d’une fiche inactive restée dans les saisies (ligne exclu) : retirée ; repli ADMIN_* si c’était la seule', () => {
    const exclue = g('g-parti', 'ancien@exemple.test', { exclu: true })
    expect(adresses(destinatairesSignalementQr({ emails_destinataires: [' Ancien@exemple.test', 'cs@exemple.test'] }, [exclue], ENV))).toEqual(['cs@exemple.test'])
    const seule = destinatairesSignalementQr({ emails_destinataires: ['ancien@exemple.test'] }, [exclue], ENV)
    expect(seule.destinataires.map((d) => d.type)).toEqual(['administrateur', 'administrateur'])
  })

  it('adresse d’une fiche contestée dans les saisies (ligne exclu) : retirée de même', () => {
    const contestee = g('g-conteste', 'contestee@exemple.test', { exclu: true })
    expect(adresses(destinatairesSignalementQr({ emails_destinataires: ['contestee@exemple.test', 'cs@exemple.test'] }, [contestee, g('g1', 'marie.martin@exemple.test')], ENV)))
      .toEqual(['cs@exemple.test', 'marie.martin@exemple.test'])
  })

  it('une fiche absente des lignes (non confirmée, désactivée, autre copropriété) ne reçoit rien en tant que gestionnaire', () => {
    // La fonction SQL ne renvoie que les fiches actives confirmées : une fiche non confirmée n'a pas de ligne.
    const r = destinatairesSignalementQr({ emails_destinataires: ['cs@exemple.test'] }, [], ENV)
    expect(r.destinataires).toEqual([{ email: 'cs@exemple.test', type: 'saisi', accesOuvert: false }])
  })

  it('plafond de 100 (un lot Resend) : au-delà, adresses écartées et comptées', () => {
    expect(DESTINATAIRES_MAX_QR).toBe(100)
    const lignes = Array.from({ length: 105 }, (_, i) => g(`g${i}`, `gestionnaire${i}@exemple.test`))
    const r = destinatairesSignalementQr({ emails_destinataires: ['cs@exemple.test'] }, lignes, ENV)
    expect(r.destinataires).toHaveLength(100)
    expect(r.auDelaDuPlafond).toBe(6)
    expect(r.destinataires[0]).toEqual({ email: 'cs@exemple.test', type: 'saisi', accesOuvert: false })
  })

  it('la même adresse renvoyée deux fois par la base n’est comptée qu’une fois', () => {
    const r = destinatairesSignalementQr({}, [g('g1', 'marie.martin@exemple.test'), g('g1', 'MARIE.martin@exemple.test')], ENV)
    expect(adresses(r)).toEqual(['marie.martin@exemple.test'])
  })

  it('le plafond SQL des lignes (LIMIT 100, exclues d’abord) est celui de la migration', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261111_signalements_qr_gestionnaires.sql'), 'utf-8')
    expect(sql).toMatch(/ORDER BY t\.exclu DESC, t\.gestionnaire_id\s+LIMIT 100/)
  })
})

describe('destinatairesSignalement (serveur.ts) garde son comportement jusqu’au lot 3', () => {
  it('saisies si présentes, sinon ADMIN_*, en adresses seules', () => {
    expect(destinatairesSignalement({ emails_destinataires: [' CS@exemple.test', 'cs@exemple.test'] }, ENV)).toEqual(['cs@exemple.test'])
    expect(destinatairesSignalement({ emails_destinataires: [] }, ENV)).toEqual(['admin@exemple.test', 'admin2@exemple.test'])
    expect(destinatairesSignalement({}, SANS_ADMIN)).toEqual([])
  })
})

describe('adressesDeFichesQr (RG-06 bis-1 : une adresse de gestionnaire n’est jamais une adresse saisie)', () => {
  const fiches = [{ email: 'marie.martin@exemple.test' }, { email: 'ancien@exemple.test' }, { email: null }]

  it('repère, parmi les adresses proposées, celles d’une fiche active ou non (casse, espaces), dédoublonnées', () => {
    expect(adressesDeFichesQr([' Marie.Martin@exemple.test', 'cs@exemple.test', 'ANCIEN@exemple.test', 'marie.martin@exemple.test'], fiches))
      .toEqual(['marie.martin@exemple.test', 'ancien@exemple.test'])
  })

  it('aucune fiche, ou aucune adresse de fiche : liste vide (une fiche effacée, sans adresse, n’attrape rien)', () => {
    expect(adressesDeFichesQr(['cs@exemple.test'], [])).toEqual([])
    expect(adressesDeFichesQr(['cs@exemple.test', ''], fiches)).toEqual([])
  })
})

describe('sous-adresses « + » : la boîte d’une fiche sous une étiquette est l’adresse de la fiche (relecture 2 du lot 6)', () => {
  const fiches = [{ id: 'g1', email: 'marie.martin@exemple.test' }, { id: 'g2', email: 'paul.durand@exemple.test' }]

  it('adressesDeFichesQr : « prenom+etiquette@ » est repérée (rendue telle que proposée, canonique)', () => {
    expect(adressesDeFichesQr(['cs+copro@exemple.test', ' Marie.Martin+Suivi@exemple.test'], fiches)).toEqual(['marie.martin+suivi@exemple.test'])
  })

  it('fiche dont l’adresse porte elle-même une étiquette : sa boîte et ses autres étiquettes sont repérées', () => {
    expect(adressesDeFichesQr(['marie@exemple.test', 'marie+autre@exemple.test', 'mariette@exemple.test'], [{ email: 'marie+aj@exemple.test' }]))
      .toEqual(['marie@exemple.test', 'marie+autre@exemple.test'])
  })

  it('saisiesVisiblesQr : la sous-adresse d’un collègue est masquée, la sienne reste visible', () => {
    expect(saisiesVisiblesQr(['paul.durand+x@exemple.test', 'marie.martin+y@exemple.test', 'cs+z@exemple.test'], fiches, 'g1'))
      .toEqual({ emails: ['marie.martin+y@exemple.test', 'cs+z@exemple.test'], adressesMasquees: 1 })
  })

  it('destinatairesSignalementQr : la sous-adresse d’une fiche exclue (partie, contestée) quitte l’envoi ; une autre adresse reste', () => {
    const r = destinatairesSignalementQr(
      { emails_destinataires: ['marie.martin+suivi@exemple.test', 'cs+copro@exemple.test'] },
      [g('g1', 'marie.martin@exemple.test', { exclu: true })],
      ENV,
    )
    expect(adresses(r)).toEqual(['cs+copro@exemple.test'])
  })
})

describe('saisiesVisiblesQr (PR 2, RG-06 bis-4 : un gestionnaire ne voit pas l’adresse d’un collègue)', () => {
  const fiches = [{ id: 'g1', email: 'marie.martin@exemple.test' }, { id: 'g2', email: 'paul.durand@exemple.test' }]

  it('masque l’adresse d’une AUTRE fiche par un compteur, garde la sienne et les adresses extérieures', () => {
    expect(saisiesVisiblesQr(['cs@exemple.test', 'Paul.Durand@exemple.test', 'marie.martin@exemple.test'], fiches, 'g1'))
      .toEqual({ emails: ['cs@exemple.test', 'marie.martin@exemple.test'], adressesMasquees: 1 })
  })

  it('rien à masquer : toutes les saisies, compteur à zéro', () => {
    expect(saisiesVisiblesQr(['cs@exemple.test'], fiches, 'g2')).toEqual({ emails: ['cs@exemple.test'], adressesMasquees: 0 })
  })
})
