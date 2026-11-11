// tests/lib/aj-signalement-types-journal.test.ts
//
// Les listes fermées de lib/aj-signalement/types.ts (actions du journal, origines d'une attribution, profils d'acteur,
// langues d'un cabinet, erreurs métier levées par les fonctions SQL) sont celles de la migration
// 20261111_signalements_qr_gestionnaires.sql : une action ajoutée d'un seul côté ferait échouer l'écriture du journal
// (CHECK) ou laisserait une erreur SQL sans code public. Lues dans le texte SQL, ordre indifférent.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  ACTIONS_JOURNAL_QR, ERREURS_METIER_SQL_QR, ETATS_GESTIONNAIRE_QR, LANGUES_CABINET_QR, ORIGINES_ATTRIBUTION_QR,
  PROFILS_ACTEUR_QR, gestionCoproprieteQrVide,
} from '@/lib/aj-signalement/types'

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261111_signalements_qr_gestionnaires.sql'), 'utf-8')
const code = sql.replace(/--[^\n]*/g, '')
const trie = (valeurs: Iterable<string>) => [...valeurs].sort((a, b) => a.localeCompare(b))

/** Valeurs littérales d'un CHECK (colonne IN (…)) nommé ou repéré par son début. */
function valeursCheck(debut: RegExp): string[] {
  const m = new RegExp(`${debut.source}\\s*\\(([^)]*)\\)`).exec(code)
  if (!m) throw new Error(`CHECK introuvable : ${debut.source}`)
  return [...m[1].matchAll(/'([^']*)'/g)].map((v) => v[1])
}

const corpsFonctions = [...code.matchAll(/\$fn\$([\s\S]*?)\$fn\$/g)].map((m) => m[1]).join('\n')

describe('actions du journal', () => {
  const actionsSql = valeursCheck(/CONSTRAINT signalements_qr_journal_action_valeurs CHECK \(action IN/)

  it('ACTIONS_JOURNAL_QR = liste du CHECK du journal (mêmes éléments, sans doublon)', () => {
    expect(trie(ACTIONS_JOURNAL_QR)).toEqual(trie(actionsSql))
    expect(new Set(ACTIONS_JOURNAL_QR).size).toBe(ACTIONS_JOURNAL_QR.length)
  })

  it('les actions des cabinets clients et du rattachement sont dans la liste, celles de la PR 2 aussi (posée une fois)', () => {
    for (const action of ['cabinet.cree', 'cabinet.modifie', 'cabinet.domaines_modifies', 'copropriete.rattachee']) {
      expect(ACTIONS_JOURNAL_QR).toContain(action)
    }
    for (const action of ['gestionnaire.acces_envoye', 'gestionnaire.acces_ouvert', 'gestionnaire.refus_autre_espace', 'gestionnaire.connexion_bloquee', 'gestionnaire.effacement_demande']) {
      expect(ACTIONS_JOURNAL_QR).toContain(action)
    }
  })

  it('toute action écrite par une fonction SQL est admise par le CHECK', () => {
    const ecrites = new Set([...corpsFonctions.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]))
    expect(ecrites.size).toBeGreaterThan(10)
    for (const action of ecrites) expect(actionsSql, action).toContain(action)
  })
})

describe('autres listes fermées', () => {
  it('ORIGINES_ATTRIBUTION_QR = CHECK des attributions', () => {
    expect(trie(ORIGINES_ATTRIBUTION_QR)).toEqual(trie(valeursCheck(/origine\s+TEXT NOT NULL CHECK \(origine IN/)))
  })

  it('PROFILS_ACTEUR_QR = CHECK de l’acteur du journal', () => {
    expect(trie(PROFILS_ACTEUR_QR)).toEqual(trie(valeursCheck(/CONSTRAINT signalements_qr_journal_acteur_profil_valeurs CHECK \(acteur_profil IN/)))
  })

  it('LANGUES_CABINET_QR = CHECK de la langue d’un cabinet (fr par défaut)', () => {
    expect(trie(LANGUES_CABINET_QR)).toEqual(trie(valeursCheck(/CONSTRAINT signalements_qr_cabinets_langue_valeurs CHECK \(langue IN/)))
    expect(LANGUES_CABINET_QR[0]).toBe('fr')
  })

  it('ERREURS_METIER_SQL_QR = messages levés en P0001 par les fonctions (chacun traduit en 409 par les routes)', () => {
    const levees = new Set([...code.matchAll(/RAISE EXCEPTION '([a-z_]+)' USING ERRCODE = 'P0001'/g)].map((m) => m[1]))
    expect(trie(levees)).toEqual(trie(ERREURS_METIER_SQL_QR))
  })

  it('aucune autre erreur levée que P0001 (métier), 42501 (interdit) et 22023 (paramètre invalide)', () => {
    const codes = new Set([...code.matchAll(/RAISE EXCEPTION '[a-z_]+' USING ERRCODE = '([0-9A-Z]{5})'/g)].map((m) => m[1]))
    expect(trie(codes)).toEqual(trie(['22023', '42501', 'P0001']))
    expect(new Set([...code.matchAll(/RAISE EXCEPTION '([a-z_]+)' USING ERRCODE = '42501'/g)].map((m) => m[1]))).toEqual(new Set(['interdit']))
    expect(new Set([...code.matchAll(/RAISE EXCEPTION '([a-z_]+)' USING ERRCODE = '22023'/g)].map((m) => m[1]))).toEqual(new Set(['parametre_invalide']))
    expect([...code.matchAll(/RAISE EXCEPTION/g)].length).toBe([...code.matchAll(/RAISE EXCEPTION '[a-z_]+' USING ERRCODE = '[0-9A-Z]{5}'/g)].length)
  })

  it('états d’un gestionnaire : 5 en PR 1, puis 4 réservés à la PR 2', () => {
    expect(ETATS_GESTIONNAIRE_QR.slice(0, 5)).toEqual(['confirmation_envoyee', 'confirmation_expiree', 'adresse_confirmee', 'adresse_contestee', 'desactive'])
    expect(ETATS_GESTIONNAIRE_QR.slice(5)).toEqual(['acces_envoye', 'acces_ouvert', 'refus_autre_espace', 'effacement_demande'])
  })
})

describe('gestionCoproprieteQrVide', () => {
  it('valeurs d’une copropriété sans cabinet ni gestionnaire, créée par l’administrateur, sans compteur', () => {
    expect(gestionCoproprieteQrVide()).toEqual({
      cabinet: null, codePostal: '', ville: '', immatriculation: null, referenceCabinet: null, batiments: [],
      attribueeATous: false, gestionnaires: [], creePar: 'administrateur',
      ouverts: 0, urgentsOuverts: 0, attente48h: 0, dernier: null, adressesDeGestionnaires: 0,
    })
  })

  it('chaque appel rend des tableaux neufs (aucun partage entre copropriétés)', () => {
    const a = gestionCoproprieteQrVide()
    const b = gestionCoproprieteQrVide()
    a.batiments.push('A')
    a.gestionnaires.push({ id: 'g1', nom: 'Prénom Nom' })
    expect(b.batiments).toEqual([])
    expect(b.gestionnaires).toEqual([])
  })
})
