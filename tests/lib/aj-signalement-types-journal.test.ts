// tests/lib/aj-signalement-types-journal.test.ts
//
// Les listes fermées de lib/aj-signalement/types.ts (actions du journal, origines d'une attribution, profils d'acteur,
// langues d'un cabinet, erreurs métier levées par les fonctions SQL) sont celles des migrations : une action ajoutée d'un
// seul côté ferait échouer l'écriture du journal (CHECK) ou laisserait une erreur SQL sans code public. Lues dans le
// texte SQL, ordre indifférent.
// PR 2 : la migration 20261112_signalements_qr_acces_gestionnaires.sql lève ses propres erreurs métier (deja_ouvert,
// adresse_contestee) et écrit une action par trigger (gestionnaire.acces_ouvert).
// PR 3 : la migration 20261113_signalements_qr_diffusion.sql REMPLACE la liste des actions du journal (la 20261111 est
// appliquée) et lève ses erreurs métier (diffusion_inactive, aucun_destinataire, perimetre_change) : la liste des actions
// est lue dans la DERNIÈRE définition de la contrainte (ordre des fichiers = ordre d'application), les erreurs et les
// actions écrites dans l'union des fichiers.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  ACTIONS_JOURNAL_QR, CLE_REPERE_CABINET_QR, ERREURS_METIER_SQL_QR, ETATS_GESTIONNAIRE_QR, LANGUES_CABINET_QR, ORIGINES_ATTRIBUTION_QR,
  PROFILS_ACTEUR_QR, ROLE_GESTIONNAIRE_QR, gestionCoproprieteQrVide,
} from '@/lib/aj-signalement/types'

const DOSSIER = join(process.cwd(), 'supabase/migrations')
const lireSql = (fichier: string) => readFileSync(join(DOSSIER, fichier), 'utf-8').replace(/--[^\n]*/g, '')
const code = lireSql('20261111_signalements_qr_gestionnaires.sql')
const code1112 = lireSql('20261112_signalements_qr_acces_gestionnaires.sql')
const FICHIER_DIFFUSION = '20261113_signalements_qr_diffusion.sql'
const code1113 = existsSync(join(DOSSIER, FICHIER_DIFFUSION)) ? lireSql(FICHIER_DIFFUSION) : ''
/** Migrations d'AJ Signalement dans l'ordre d'application (nom de fichier, comme la CLI Supabase). */
const MIGRATIONS_QR = readdirSync(DOSSIER).filter((f) => f.includes('signalements_qr') && f.endsWith('.sql')).sort((a, b) => a.localeCompare(b))
const codeTout = MIGRATIONS_QR.map(lireSql).join('\n')
const trie = (valeurs: Iterable<string>) => [...valeurs].sort((a, b) => a.localeCompare(b))

/** Valeurs littérales d'un CHECK (colonne IN (…)) nommé ou repéré par son début, dans un texte SQL (la 20261111 par défaut). */
function valeursCheck(debut: RegExp, texte = code): string[] {
  const m = new RegExp(`${debut.source}\\s*\\(([^)]*)\\)`).exec(texte)
  if (!m) throw new Error(`CHECK introuvable : ${debut.source}`)
  return [...m[1].matchAll(/'([^']*)'/g)].map((v) => v[1])
}

/** Dernière définition de la liste des actions du journal : celle du dernier fichier qui la pose (ou la remplace). */
const MOTIF_ACTIONS = /CONSTRAINT signalements_qr_journal_action_valeurs CHECK \(action IN/
const FICHIER_DERNIERE_LISTE = [...MIGRATIONS_QR].reverse().find((f) => MOTIF_ACTIONS.test(lireSql(f))) ?? ''

const corpsFonctions = [...codeTout.matchAll(/\$fn\$([\s\S]*?)\$fn\$/g)].map((m) => m[1]).join('\n')

describe('actions du journal', () => {
  const actionsSql = valeursCheck(MOTIF_ACTIONS, lireSql(FICHIER_DERNIERE_LISTE))

  it('la dernière définition de la liste est celle de la 20261113 (diffusion), qui reprend les 34 actions de la 20261111', () => {
    expect(FICHIER_DERNIERE_LISTE).toBe(FICHIER_DIFFUSION)
    const actions1111 = valeursCheck(MOTIF_ACTIONS)
    expect(actions1111).toHaveLength(34)
    for (const action of actions1111) expect(actionsSql, action).toContain(action)
  })

  it('ACTIONS_JOURNAL_QR = liste du CHECK du journal (mêmes éléments, sans doublon)', () => {
    expect(trie(ACTIONS_JOURNAL_QR)).toEqual(trie(actionsSql))
    expect(new Set(ACTIONS_JOURNAL_QR).size).toBe(ACTIONS_JOURNAL_QR.length)
  })

  it('les 7 actions de la diffusion (PR 3) sont dans la liste', () => {
    for (const action of ['cabinet.diffusion_activee', 'cabinet.diffusion_suspendue', 'diffusion.envoyee', 'diffusion.reprise',
      'diffusion.opposition', 'diffusion.opposition_levee', 'diffusion.purge']) {
      expect(ACTIONS_JOURNAL_QR).toContain(action)
    }
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

  it('ERREURS_METIER_SQL_QR = messages levés en P0001 par les fonctions des TROIS migrations (chacun traduit en 409)', () => {
    const levees = new Set([...`${code}\n${code1112}\n${code1113}`.matchAll(/RAISE EXCEPTION '([a-z_]+)' USING ERRCODE = 'P0001'/g)].map((m) => m[1]))
    expect(trie(levees)).toEqual(trie(ERREURS_METIER_SQL_QR))
    expect(ERREURS_METIER_SQL_QR).toContain('deja_ouvert')
    expect(ERREURS_METIER_SQL_QR).toContain('adresse_contestee')
    for (const erreur of ['diffusion_inactive', 'aucun_destinataire', 'perimetre_change']) expect(ERREURS_METIER_SQL_QR).toContain(erreur)
  })

  it('les erreurs métier de toutes les migrations d’AJ Signalement sont celles des trois fichiers ci-dessus', () => {
    const levees = new Set([...codeTout.matchAll(/RAISE EXCEPTION '([a-z_]+)' USING ERRCODE = 'P0001'/g)].map((m) => m[1]))
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

describe('rôle du gestionnaire et repère de routage (PR 2)', () => {
  it('ROLE_GESTIONNAIRE_QR = valeur du CHECK des envois = rôle admis par lib/equipe pour l’espace aj_signalement', () => {
    expect(ROLE_GESTIONNAIRE_QR).toBe('gestionnaire_signalement')
    expect(code).toMatch(new RegExp(`role\\s+TEXT NOT NULL DEFAULT '${ROLE_GESTIONNAIRE_QR}' CHECK \\(role = '${ROLE_GESTIONNAIRE_QR}'\\)`))
    const equipe = readFileSync(join(process.cwd(), 'lib/equipe/lien-invitation.ts'), 'utf-8')
    expect(/const ROLE_GESTIONNAIRE_SIGNALEMENT = '([^']+)'/.exec(equipe)?.[1]).toBe(ROLE_GESTIONNAIRE_QR)
  })

  it('ne commence ni par syndic ni par pro_ (aucune branche de ces espaces ne l’admet)', () => {
    expect(ROLE_GESTIONNAIRE_QR.startsWith('syndic')).toBe(false)
    expect(ROLE_GESTIONNAIRE_QR.startsWith('pro_')).toBe(false)
  })

  it('repère de routage dans app_metadata : aj_signalement_cabinet (aiguillage seulement, aucun droit)', () => {
    expect(CLE_REPERE_CABINET_QR).toBe('aj_signalement_cabinet')
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
