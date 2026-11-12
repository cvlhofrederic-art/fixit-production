// tests/migrations/signalements_qr_diffusion.test.ts
//
// Migration 20261113_signalements_qr_diffusion.sql (AJ Signalement, PR 3 : diffusion de messages d'exploitation aux
// déclarants d'une copropriété ; cahier des charges du 11/11/2026, § 2 et § 3, décisions de Hugo du 11/11 : H1 = option C,
// H7 = date facultative de fin de mission). Le TEXTE SQL est contrôlé ici (liste du § 10.1) ; les règles elles-mêmes
// (oppositions, lots, annonce, purge) sont exécutées sur un vrai PostgreSQL par signalements_qr_diffusion.execution.test.ts.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { DELAI_ANNONCE_DIFFUSION_JOURS, MODELES_DIFFUSION_QR } from '@/lib/aj-signalement/affichage-diffusion'
import { LANGUES_DIFFUSION_OUVERTES_QR } from '@/lib/aj-signalement/types'

const DOSSIER = join(process.cwd(), 'supabase/migrations')
const FICHIER = '20261113_signalements_qr_diffusion.sql'
const CHEMIN = join(DOSSIER, FICHIER)
const sql = existsSync(CHEMIN) ? readFileSync(CHEMIN, 'utf-8').replace(/\r\n/g, '\n') : ''
/** Le SQL sans ses commentaires : une mention en commentaire ne compte pas comme instruction. */
const code = sql.replace(/--[^\n]*/g, '')
/** Ce qui s'exécute une seule fois, à l'application : le SQL sans le corps des fonctions (balise $fn$). */
const horsFonctions = code.replace(/\$fn\$[\s\S]*?\$fn\$/g, '$fn$ $fn$')
const code1111 = readFileSync(join(DOSSIER, '20261111_signalements_qr_gestionnaires.sql'), 'utf-8').replace(/--[^\n]*/g, '')

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const trie = (valeurs: Iterable<string>) => [...valeurs].sort((a, b) => a.localeCompare(b))

const TABLES_NOUVELLES = [
  'signalements_qr_diffusions', 'signalements_qr_diffusion_destinataires', 'signalements_qr_diffusion_oppositions',
]

/** Fonctions de la migration, avec la signature exacte de leurs arguments (REVOKE / GRANT). */
const FONCTIONS_ATTENDUES: Record<string, string> = {
  signalements_qr_empreinte_email: 'text',
  signalements_qr_diffusion_raison_inactive: 'uuid',
  signalements_qr_diffusion_controler_portee: 'text, text[], text[], uuid, boolean',
  signalements_qr_diffusion_gestionnaire_autorise: 'uuid, uuid, uuid',
  signalements_qr_diffusion_cible: 'uuid, text, text[], text[], uuid, timestamptz, boolean',
  signalements_qr_diffusion_valeurs: 'uuid',
  signalements_qr_diffusion_apercu: 'uuid, text, text[], text[], uuid, boolean',
  signalements_qr_diffusions_mois: 'uuid',
  signalements_qr_diffusion_creer:
    'uuid, uuid, uuid, text, uuid, text, date, text, text, text, text, text, text, text[], text[], uuid, text, timestamptz, integer, text',
  signalements_qr_diffusion_ecarter: 'uuid[]',
  signalements_qr_diffusion_lot: 'uuid, integer',
  signalements_qr_diffusion_resultats: 'uuid, integer, uuid[], uuid[], uuid[], text',
  signalements_qr_diffusions_liste: 'uuid, timestamptz, integer',
  signalements_qr_diffusion_lien: 'uuid',
  signalements_qr_diffusion_opposer: 'uuid, text, text',
  signalements_qr_diffusion_lever: 'uuid',
  signalements_qr_diffusion_opposer_signalement: 'uuid, uuid, uuid, text, uuid, date',
  signalements_qr_diffusion_annonce: 'uuid',
  signalements_qr_diffusion_annonce_faite: 'uuid',
  signalements_qr_diffusion_annonce_envoyee: 'uuid, integer',
  signalements_qr_diffusions_a_reprendre: 'integer',
  signalements_qr_diffusion_purger: '',
}

/** Les 34 actions de la 20261111 (aucune migration postérieure ne les a changées) et les 7 de la diffusion (§ 2.4). */
const ACTIONS_DIFFUSION = [
  'cabinet.diffusion_activee', 'cabinet.diffusion_suspendue',
  'diffusion.envoyee', 'diffusion.reprise', 'diffusion.opposition', 'diffusion.opposition_levee', 'diffusion.purge',
]

interface FonctionSql { nom: string; types: string; entete: string; corps: string }

/** Fonctions définies : nom, types des arguments (noms et DEFAULT retirés), en-tête (RETURNS…, LANGUAGE…) et corps. */
function fonctionsDefinies(texte: string): FonctionSql[] {
  const motif = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(\w+)\s*\(([^)]*)\)([\s\S]*?)\bAS\s+\$fn\$([\s\S]*?)\$fn\$/gi
  return [...texte.matchAll(motif)].map((m) => ({
    nom: m[1],
    types: m[2].split(',').map((p) => p.trim()).filter(Boolean)
      .map((p) => p.replace(/\s+DEFAULT\s+[\s\S]*$/i, '').split(/\s+/).slice(1).join(' ').toLowerCase()).join(', '),
    entete: m[3],
    corps: m[4],
  }))
}
const FONCTIONS = fonctionsDefinies(code)
const fonction = (nom: string): FonctionSql => {
  const trouvee = FONCTIONS.find((f) => f.nom === nom)
  if (!trouvee) throw new Error(`fonction ${nom} absente de ${FICHIER}`)
  return trouvee
}

/** Bloc de colonnes d'un CREATE TABLE (jusqu'à la parenthèse fermante en début de ligne). */
function blocTable(table: string): string {
  const m = new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\);`).exec(code)
  if (!m) throw new Error(`table ${table} absente de ${FICHIER}`)
  return m[1]
}

/** Valeurs littérales d'une liste « colonne IN (…) » repérée par son début. */
function valeursListe(texte: string, debut: RegExp): string[] {
  const m = new RegExp(`${debut.source}\\s*\\(([^)]*)\\)`).exec(texte)
  if (!m) throw new Error(`liste introuvable : ${debut.source}`)
  return [...m[1].matchAll(/'([^']*)'/g)].map((v) => v[1])
}

describe(`Migration ${FICHIER} : fichier et ordre`, () => {
  it('existe et passe après la dernière migration appliquée des signalements (20261112)', () => {
    expect(existsSync(CHEMIN)).toBe(true)
    const fichiers = readdirSync(DOSSIER).sort((a, b) => a.localeCompare(b))
    expect(fichiers.indexOf(FICHIER)).toBeGreaterThan(fichiers.indexOf('20261112_signalements_qr_acces_gestionnaires.sql'))
    expect(sql).toMatch(/APRÈS 20261112_signalements_qr_acces_gestionnaires\.sql/)
  })

  it('se termine par la relecture du schéma par PostgREST', () => {
    expect(code).toMatch(/NOTIFY pgrst, 'reload schema';\s*$/)
  })

  it('en-tête : chaque message P0001 levé par une fonction y est cité', () => {
    const entete = sql.slice(0, sql.indexOf('-- ── 1.'))
    expect(entete.length).toBeGreaterThan(0)
    const leves = new Set([...code.matchAll(/RAISE EXCEPTION '([a-z_]+)' USING ERRCODE = 'P0001'/g)].map((m) => m[1]))
    expect(trie(leves)).toEqual(trie(['a_reverifier', 'aucun_destinataire', 'diffusion_inactive', 'perimetre_change']))
    expect([...leves].filter((m) => !new RegExp(`\\b${m}\\b`).test(entete))).toEqual([])
  })

  it('fonctions : seulement P0001 (métier), 42501 (interdit) et 22023 (paramètre invalide) ; toute levée a un code', () => {
    const corps = FONCTIONS.map((f) => f.corps).join('\n')
    const codes = new Set([...corps.matchAll(/RAISE EXCEPTION '[a-z_]+' USING ERRCODE = '([0-9A-Z]{5})'/g)].map((m) => m[1]))
    expect(trie(codes)).toEqual(trie(['22023', '42501', 'P0001']))
    expect(new Set([...corps.matchAll(/RAISE EXCEPTION '([a-z_]+)' USING ERRCODE = '42501'/g)].map((m) => m[1]))).toEqual(new Set(['interdit']))
    expect(new Set([...corps.matchAll(/RAISE EXCEPTION '([a-z_]+)' USING ERRCODE = '22023'/g)].map((m) => m[1]))).toEqual(new Set(['parametre_invalide']))
    expect([...corps.matchAll(/RAISE EXCEPTION/g)].length).toBe([...corps.matchAll(/RAISE EXCEPTION '[a-z_]+' USING ERRCODE = '[0-9A-Z]{5}'/g)].length)
  })
})

describe(`Migration ${FICHIER} : rejouable, sans donnée`, () => {
  it('IF NOT EXISTS sur chaque table, index et colonne ; OR REPLACE sur chaque fonction', () => {
    expect([...code.matchAll(/CREATE TABLE (?!IF NOT EXISTS)/g)]).toHaveLength(0)
    expect([...code.matchAll(/CREATE (?:UNIQUE )?INDEX (?!IF NOT EXISTS)/g)]).toHaveLength(0)
    expect([...code.matchAll(/ADD COLUMN (?!IF NOT EXISTS)/g)]).toHaveLength(0)
    expect([...code.matchAll(/CREATE (?!OR REPLACE )FUNCTION/g)]).toHaveLength(0)
    expect(code).not.toMatch(/\bCREATE\s+(OR\s+REPLACE\s+)?TRIGGER\b/i)
  })

  it('un seul DROP : celui de la liste fermée du journal, remplacée dans la même instruction (§ 2.4, F2)', () => {
    const drops = [...code.matchAll(/\bDROP\b[^,;]*/gi)].map((m) => m[0].replace(/\s+/g, ' ').trim())
    expect(drops).toEqual(['DROP CONSTRAINT IF EXISTS signalements_qr_journal_action_valeurs'])
    expect(code).toMatch(/ALTER TABLE signalements_qr_journal\s+DROP CONSTRAINT IF EXISTS signalements_qr_journal_action_valeurs,\s+ADD CONSTRAINT signalements_qr_journal_action_valeurs CHECK \(action IN \(/)
  })

  it('aucune écriture de données à l’application (hors corps des fonctions)', () => {
    expect(horsFonctions).not.toMatch(/\bINSERT\s+INTO\b/i)
    expect(horsFonctions).not.toMatch(/\bUPDATE\s+[a-z_]+(?:\s+[a-z]+)?\s+SET\b/i)
    expect(horsFonctions).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(horsFonctions).not.toMatch(/\bTRUNCATE\b/i)
    expect(horsFonctions).not.toMatch(/\bCOPY\b/i)
  })

  it('contraintes ajoutées aux tables existantes : nommées, créées si absentes de pg_constraint, NOT VALID puis VALIDATE', () => {
    // Fin d'instruction : « ; » en fin de ligne (le motif de la politique contient un « ; » dans une classe de caractères).
    const ajoutees = [...horsFonctions.matchAll(/ALTER TABLE (\w+) ADD CONSTRAINT (\w+)([\s\S]*?);[ \t]*\n/g)]
    expect(ajoutees.length).toBeGreaterThanOrEqual(6)
    for (const [, table, nom, definition] of ajoutees) {
      expect(definition, nom).toMatch(/NOT VALID\s*$/)
      expect(horsFonctions, nom).toMatch(new RegExp(`conname = '${nom}'\\s+AND conrelid = '${table}'::regclass`))
      expect(horsFonctions, nom).toMatch(new RegExp(`ALTER TABLE ${table} VALIDATE CONSTRAINT ${nom};`))
    }
  })

  it('aucune valeur réelle : ni adresse, ni domaine, ni nom de cabinet ou de copropriété', () => {
    expect(sql).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+/i)
    expect(code).not.toMatch(/'[a-z0-9-]+(\.[a-z0-9-]+)*\.(fr|com|pt|io|net|org|eu|test)'/i)
    expect(sql.toLowerCase()).not.toContain('aj' + 'associ')
    expect(sql.toLowerCase()).not.toContain(['aj', 'associ'].join(' '))
    expect(sql).not.toMatch(/Parc Belle Ombre/i)
  })
})

describe(`Migration ${FICHIER} : sécurité (clé service seulement)`, () => {
  it('les 3 tables nouvelles, et elles seules, sont créées', () => {
    const creees = [...code.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1])
    expect(trie(creees)).toEqual(trie(TABLES_NOUVELLES))
  })

  it.each(TABLES_NOUVELLES)('%s : RLS activée', (table) => {
    expect(code).toMatch(new RegExp(`ALTER TABLE ${table}\\s+ENABLE ROW LEVEL SECURITY;`))
  })

  it('aucune politique RLS, aucune vue', () => {
    expect(code).not.toMatch(/\bCREATE\s+POLICY\b/i)
    expect(code).not.toMatch(/\bCREATE\s+(OR\s+REPLACE\s+)?VIEW\b/i)
  })

  it('droits retirés à anon et authenticated sur les 3 tables, et sur la séquence de l’identité des oppositions', () => {
    const m = /REVOKE ALL ON ([\w\s,]+?) FROM anon, authenticated;/.exec(code)
    expect(m).not.toBeNull()
    expect(trie((m?.[1] ?? '').split(',').map((t) => t.trim()))).toEqual(trie(TABLES_NOUVELLES))
    expect(code).toMatch(/REVOKE ALL ON SEQUENCE signalements_qr_diffusion_oppositions_id_seq FROM PUBLIC, anon, authenticated;/)
    expect(code).not.toMatch(/\bGRANT\b[^;]*\bON\s+SEQUENCE\b/i)
    expect(code).not.toMatch(/\bGRANT\b[^;]*\bON\s+(TABLE\s+)?signalements_qr/i)
  })

  it('les fonctions définies sont exactement celles attendues', () => {
    expect(trie(FONCTIONS.map((f) => f.nom))).toEqual(trie(Object.keys(FONCTIONS_ATTENDUES)))
    expect(new Set(FONCTIONS.map((f) => f.nom)).size).toBe(FONCTIONS.length)
  })

  it.each(Object.entries(FONCTIONS_ATTENDUES))('%s(%s) : signature, EXECUTE retiré au public puis donné à service_role seul', (nom, types) => {
    expect(fonction(nom).types).toBe(types)
    const signature = `${nom}(${types})`
    expect(code).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION ${echapper(signature)} FROM PUBLIC, anon, authenticated;`))
    expect(code).toMatch(new RegExp(`GRANT\\s+EXECUTE ON FUNCTION ${echapper(signature)} TO service_role;`))
    expect(code).not.toMatch(new RegExp(`GRANT\\s+EXECUTE ON FUNCTION ${echapper(nom)}\\([^)]*\\) TO (?!service_role;)`))
  })

  it('toutes les fonctions : SECURITY INVOKER et search_path figé ; aucune SECURITY DEFINER', () => {
    for (const f of FONCTIONS) expect(f.entete, f.nom).toMatch(/SECURITY INVOKER SET search_path = public, pg_temp/)
    expect(code).not.toMatch(/SECURITY\s+DEFINER/i)
  })

  it('plpgsql à RETURNS TABLE : #variable_conflict use_column en tête du corps (erreur 42702 à l’exécution sinon)', () => {
    const concernees = FONCTIONS.filter((f) => /RETURNS TABLE/i.test(f.entete) && /LANGUAGE plpgsql/i.test(f.entete))
    expect(trie(concernees.map((f) => f.nom))).toEqual(trie([
      'signalements_qr_diffusion_apercu', 'signalements_qr_diffusion_creer', 'signalements_qr_diffusion_lot',
      'signalements_qr_diffusion_purger',
    ]))
    for (const f of concernees) expect(f.corps, f.nom).toMatch(/^\s*#variable_conflict use_column\n/)
  })
})

describe(`Migration ${FICHIER} : réglages du cabinet, annonce (H1) et fin de mission (H7)`, () => {
  const COLONNES_CABINET: Array<[string, string]> = [
    ['diffusion_contact_email', 'TEXT'],
    ['diffusion_politique_url', 'TEXT'],
    ['diffusion_politique_verifiee_le', 'TIMESTAMPTZ'],
    ['diffusion_contrat_reference', 'TEXT'],
    ['diffusion_contrat_signe_le', 'DATE'],
    ['diffusion_telephones', "TEXT\\[\\] NOT NULL DEFAULT '\\{\\}'"],
    ['diffusion_activee_le', 'TIMESTAMPTZ'],
    ['diffusion_activee_par', 'UUID'],
  ]

  it.each(COLONNES_CABINET)('cabinet : colonne %s %s, IF NOT EXISTS', (colonne, type) => {
    expect(code).toMatch(new RegExp(`ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS ${colonne}\\s+${type};`))
  })

  it('colonnes ajoutées aux tables existantes : ces 8 du cabinet, 2 du signalement, 1 de la copropriété, aucune autre', () => {
    const ajoutees = [...code.matchAll(/ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS (\w+)/g)].map((m) => `${m[1]}.${m[2]}`)
    expect(trie(ajoutees)).toEqual(trie([
      ...COLONNES_CABINET.map(([c]) => `signalements_qr_cabinets.${c}`),
      'signalements_qr.diffusion_annoncee_le', 'signalements_qr.diffusion_annonce_origine',
      'signalements_qr_coproprietes.diffusion_fin_gestion_le',
    ]))
  })

  it('activation impossible sans contact, politique déclarée décrivant la diffusion, contrat référencé et daté', () => {
    expect(code).toMatch(/CHECK \(diffusion_activee_le IS NULL OR \(diffusion_contact_email IS NOT NULL AND diffusion_politique_url IS NOT NULL\s+AND diffusion_politique_verifiee_le IS NOT NULL AND diffusion_contrat_reference IS NOT NULL\s+AND diffusion_contrat_signe_le IS NOT NULL\)\) NOT VALID/)
  })

  it('politique en https seulement, sans guillemet, chevron, apostrophe ni espace (recopiée dans un href)', () => {
    const m = /diffusion_politique_url ~ '([^']+)'/.exec(code)
    expect(m).not.toBeNull()
    expect(code).toMatch(/char_length\(diffusion_politique_url\) BETWEEN 12 AND 508/)
    // PostgreSQL refuse une répétition au-delà de 255 ({4,500}) : l'expression serait invalide à chaque écriture.
    for (const r of code.matchAll(/\{(\d+),(\d+)\}/g)) expect(Number(r[2]), r[0]).toBeLessThanOrEqual(255)
    const motif = new RegExp(m?.[1] ?? '$^')
    expect(motif.test('https://cabinet-exemple.test/confidentialite')).toBe(true)
    for (const refusee of ['http://cabinet-exemple.test/', 'https://exemple.test/"><script>', 'https://exemple.test/a b', "https://exemple.test/'", 'javascript:alert(1)']) {
      expect(motif.test(refusee), refusee).toBe(false)
    }
  })

  it('téléphones autorisés (H2) : chiffres seuls, 10 au plus, une seule dimension, aucun élément NULL', () => {
    expect(code).toMatch(/cardinality\(diffusion_telephones\) <= 10/)
    expect(code).toMatch(/coalesce\(array_ndims\(diffusion_telephones\), 1\) = 1/)
    // Un élément NULL devient « * » (troisième argument d'array_to_string), que l'expression refuse ; sans lui, il serait
    // ignoré et la contrainte passerait.
    const m = /array_to_string\(diffusion_telephones, ',', '\*'\) ~ '([^']+)'/.exec(code)
    const motif = new RegExp(m?.[1] ?? '$^')
    expect(motif.test('')).toBe(true)
    expect(motif.test('0612345678,351912345678')).toBe(true)
    expect(motif.test('06 12 34 56 78')).toBe(false)
    expect(motif.test('+33612345678')).toBe(false)
    expect(motif.test('0612345678,*')).toBe(false)
    expect(motif.test('*')).toBe(false)
  })

  it('H1 = option C : date et origine de l’annonce par signalement (accusé ou message d’annonce), cohérentes', () => {
    expect(code).toMatch(/ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS diffusion_annoncee_le\s+TIMESTAMPTZ;/)
    expect(code).toMatch(/ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS diffusion_annonce_origine\s+TEXT;/)
    expect(code).toMatch(/diffusion_annonce_origine IN \('accuse', 'message'\)/)
    expect(code).toMatch(/\(diffusion_annoncee_le IS NULL\) = \(diffusion_annonce_origine IS NULL\)/)
  })

  it('H1 = option C : inclusion 15 jours après le message d’annonce, immédiate après l’accusé (art. 13.4)', () => {
    const cible = fonction('signalements_qr_diffusion_cible').corps
    expect(cible).toMatch(/s\.diffusion_annonce_origine = 'message' AND s\.diffusion_annoncee_le <= p_jusqu_au - interval '15 days'/)
    expect(cible).toMatch(/s\.diffusion_annonce_origine = 'accuse' AND s\.diffusion_annoncee_le <= p_jusqu_au/)
  })

  it('H7 : date facultative de fin de mission sur la copropriété, contrôlée par la règle unique d’inactivité', () => {
    expect(code).toMatch(/ALTER TABLE signalements_qr_coproprietes ADD COLUMN IF NOT EXISTS diffusion_fin_gestion_le\s+DATE;/)
    const regle = fonction('signalements_qr_diffusion_raison_inactive').corps
    expect(regle).toMatch(/diffusion_fin_gestion_le/)
    for (const raison of ['introuvable', 'copropriete_inactive', 'sans_cabinet', 'diffusion_non_activee', 'langue_non_ouverte', 'fin_gestion']) {
      expect(regle).toContain(`'${raison}'`)
    }
    for (const nom of ['signalements_qr_diffusion_apercu', 'signalements_qr_diffusion_creer', 'signalements_qr_diffusion_lot', 'signalements_qr_diffusion_annonce']) {
      expect(fonction(nom).corps, nom).toMatch(/signalements_qr_diffusion_raison_inactive\(/)
    }
  })

  it('H9 : langues ouvertes à la diffusion, mêmes en TypeScript (LANGUES_DIFFUSION_OUVERTES_QR) et dans la règle d’inactivité', () => {
    const regle = fonction('signalements_qr_diffusion_raison_inactive').corps
    const m = /WHEN NOT \(k\.langue = ANY \(ARRAY\[([^\]]*)\]::text\[\]\)\) THEN 'langue_non_ouverte'/.exec(regle)
    expect(m).not.toBeNull()
    const sql = [...(m?.[1] ?? '').matchAll(/'([^']+)'/g)].map((v) => v[1])
    expect(trie(sql)).toEqual(trie(LANGUES_DIFFUSION_OUVERTES_QR))
    expect(LANGUES_DIFFUSION_OUVERTES_QR).toEqual(['fr'])
  })
})

describe(`Migration ${FICHIER} : tables de la diffusion`, () => {
  it('diffusions : modèles (dont « ascenseur à l’arrêt », H3, et l’annonce, H1), langues, portées ; aucun plafond', () => {
    const bloc = blocTable('signalements_qr_diffusions')
    expect(trie(valeursListe(bloc, /modele\s+TEXT NOT NULL CHECK \(modele IN/))).toEqual(trie([
      'libre', 'fuite', 'coupure_eau', 'coupure_electricite', 'intervention', 'fin_incident', 'ascenseur_arret', 'annonce',
    ]))
    expect(trie(valeursListe(bloc, /portee\s+TEXT NOT NULL CHECK \(portee IN/))).toEqual(trie(['copropriete', 'batiment', 'etage', 'signalement']))
    expect(bloc).toMatch(/nb_destinataires\s+INTEGER NOT NULL CHECK \(nb_destinataires >= 1\)/)
    expect(code).not.toMatch(/BETWEEN 1 AND 5000/)
    expect(bloc).toMatch(/CONSTRAINT signalements_qr_diffusions_operation_unique UNIQUE \(operation_id\)/)
    expect(bloc).toMatch(/CONSTRAINT signalements_qr_diffusions_annonce CHECK \(modele <> 'annonce' OR portee = 'copropriete'\)/)
  })

  it('TypeScript et SQL d’accord : modèles (MODELES_DIFFUSION_QR), délai de l’annonce (15 jours), colonnes des valeurs', () => {
    const bloc = blocTable('signalements_qr_diffusions')
    expect(trie(MODELES_DIFFUSION_QR)).toEqual(trie(valeursListe(bloc, /modele\s+TEXT NOT NULL CHECK \(modele IN/)))
    expect(DELAI_ANNONCE_DIFFUSION_JOURS).toBe(15)
    expect(fonction('signalements_qr_diffusion_cible').corps).toContain(`interval '${DELAI_ANNONCE_DIFFUSION_JOURS} days'`)
    // CoupleValeursQr (lib/aj-signalement/diffusion-valeurs.ts) lit batiment, etage et nb_adresses.
    expect(fonction('signalements_qr_diffusion_valeurs').entete).toMatch(/RETURNS TABLE\(batiment text, etage text, nb_adresses bigint\)/)
  })

  it('diffusions : instruction écrite exigée du super admin (J29), fiche exigée d’un gestionnaire', () => {
    const bloc = blocTable('signalements_qr_diffusions')
    expect(bloc).toMatch(/acteur_profil <> 'super_admin' OR \(instruction_reference IS NOT NULL AND instruction_recue_le IS NOT NULL\)/)
    expect(bloc).toMatch(/\(acteur_profil = 'gestionnaire'\) = \(acteur_gestionnaire_id IS NOT NULL\)/)
    expect(bloc).toMatch(/position\('@' IN instruction_reference\) = 0/)
  })

  it('diffusions : valeurs figées à la création (idempotence de Resend), objet et texte sans caractère de contrôle', () => {
    const bloc = blocTable('signalements_qr_diffusions')
    for (const c of ['fige_cabinet_nom', 'fige_cabinet_identifiant', 'fige_copropriete_nom', 'fige_contact_email', 'fige_politique_url', 'fige_expediteur']) {
      expect(bloc).toMatch(new RegExp(`${c}\\s+TEXT NOT NULL`))
    }
    expect(bloc).toMatch(/objet\s+TEXT NOT NULL CHECK \(char_length\(objet\) BETWEEN 3 AND 120 AND objet !~ '\[\[:cntrl:\]\]'\)/)
    expect(bloc).toMatch(/texte\s+TEXT NOT NULL CHECK \(char_length\(texte\) BETWEEN 10 AND 2000/)
    expect(bloc).toMatch(/perimetre_jusqu_au\s+TIMESTAMPTZ NOT NULL/)
  })

  it('destinataires : empreinte de 32 octets, un par adresse et par diffusion, états et codes fermés', () => {
    const bloc = blocTable('signalements_qr_diffusion_destinataires')
    expect(bloc).toMatch(/email_empreinte\s+BYTEA NOT NULL CHECK \(octet_length\(email_empreinte\) = 32\)/)
    expect(bloc).toMatch(/CONSTRAINT signalements_qr_diffusion_dest_unique UNIQUE \(diffusion_id, email_empreinte\)/)
    expect(trie(valeursListe(bloc, /CHECK \(etat IN/))).toEqual(trie(['en_attente', 'en_cours', 'envoye', 'refuse', 'annule', 'incertain']))
    expect(trie(valeursListe(bloc, /code IS NULL OR code IN/))).toEqual(trie([
      'adresse_refusee', 'adresse_absente', 'adresse_changee', 'opposition', 'diffusion_inactive', 'limite_service',
      'quota_service', 'perime', 'issue_inconnue', 'deja_annoncee',
    ]))
    expect(bloc).not.toMatch(/\bemail\s+TEXT/i)
  })

  it('oppositions : AUCUNE clé étrangère (la preuve survit au signalement et à la copropriété, J23)', () => {
    const bloc = blocTable('signalements_qr_diffusion_oppositions')
    expect(bloc).not.toMatch(/\bREFERENCES\b/i)
    expect(code).not.toMatch(/ALTER TABLE signalements_qr_diffusion_oppositions[^;]*FOREIGN KEY/i)
    expect(trie(valeursListe(bloc, /origine\s+TEXT NOT NULL CHECK \(origine IN/))).toEqual(trie(['page', 'un_clic', 'lien_expire', 'plainte', 'demande_cabinet']))
  })

  it('oppositions : une seule active par (copropriété, empreinte) — index unique partiel ; levée par le seul lien qui a servi', () => {
    expect(code).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_signalements_qr_diffusion_opp_active\s+ON signalements_qr_diffusion_oppositions \(copropriete_id, email_empreinte\) WHERE levee_le IS NULL;/)
    expect(blocTable('signalements_qr_diffusion_oppositions')).toMatch(/levee_destinataire_id = destinataire_id/)
  })

  it('aucune adresse en clair hors de signalements_qr (J24) ; aucun canal autre que l’e-mail (décision de Hugo)', () => {
    for (const t of TABLES_NOUVELLES) expect(blocTable(t), t).not.toMatch(/\b(email|telephone)\s+TEXT\b/i)
    expect(sql).not.toMatch(/\bsms\b/i)
  })
})

describe(`Migration ${FICHIER} : règles portées par les fonctions`, () => {
  it('normalisation unique de l’adresse en SQL (rognage, minuscules, SHA-256) employée par cible, opposer, annonce, lot', () => {
    expect(fonction('signalements_qr_empreinte_email').corps).toMatch(/sha256\(convert_to\(lower\(btrim\(p_email, E' \\t\\r\\n'\)\), 'UTF8'\)\)/)
    expect(fonction('signalements_qr_empreinte_email').entete).toMatch(/IMMUTABLE STRICT/)
    for (const nom of ['signalements_qr_diffusion_cible', 'signalements_qr_diffusion_opposer', 'signalements_qr_diffusion_annonce', 'signalements_qr_diffusion_ecarter']) {
      expect(fonction(nom).corps, nom).toMatch(/signalements_qr_empreinte_email\(/)
    }
  })

  it('cible : arrêtée à l’instant de l’aperçu, oppositions de CETTE copropriété, une ligne par adresse', () => {
    const cible = fonction('signalements_qr_diffusion_cible').corps
    expect(cible).toMatch(/s\.created_at <= p_jusqu_au/)
    expect(cible).toMatch(/o\.copropriete_id = p_copropriete AND o\.email_empreinte = c\.empreinte AND o\.levee_le IS NULL/)
    expect(cible).toMatch(/SELECT DISTINCT ON \(c\.empreinte\)/)
  })

  it('création : verrou de la copropriété, rejeu par operation_id, nombre réel jamais au-dessus de l’annoncé', () => {
    const creer = fonction('signalements_qr_diffusion_creer').corps
    expect(creer).toMatch(/pg_advisory_xact_lock\(hashtextextended\('aj-diffusion:' \|\| p_copropriete::text, 0\)\)/)
    expect(creer).toMatch(/v_nb > p_attendu/)
    expect(creer).toMatch(/'diffusion\.envoyee'/)
  })

  it('lot : verrou SKIP LOCKED, revérification à la reprise d’un lot interrompu, 24 h au plus', () => {
    const lot = fonction('signalements_qr_diffusion_lot').corps
    expect(lot).toMatch(/FOR UPDATE SKIP LOCKED/)
    expect(lot).toMatch(/signalements_qr_diffusion_ecarter\(/)
    expect(lot).toMatch(/interval '24 hours'/)
    expect(lot).toMatch(/interval '10 minutes'/)
  })

  it('aucun paramètre ni colonne de forçage (J8 : aucune exception, même urgente)', () => {
    const interdit = /(urgent|forc|ignor|bypass|passe_droit|sans_opposition)/i
    const parametres = [...code.matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+\w+\s*\(([^)]*)\)/g)]
      .flatMap((m) => m[1].match(/\bp_\w+/g) ?? [])
    expect(parametres.length).toBeGreaterThan(50)
    for (const p of parametres) expect(p).not.toMatch(interdit)
    const colonnes = [
      ...TABLES_NOUVELLES.flatMap((t) => [...blocTable(t).matchAll(/^\s+([a-z_]+)\s+[A-Z]/gm)].map((m) => m[1])),
      ...[...code.matchAll(/ADD COLUMN IF NOT EXISTS (\w+)/g)].map((m) => m[1]),
    ]
    expect(colonnes.length).toBeGreaterThan(40)
    for (const c of colonnes) expect(c).not.toMatch(interdit)
  })

  it('levée : lien de la page qui a servi à l’opposition, dans les 24 h, origines page ou un clic seulement', () => {
    const lever = fonction('signalements_qr_diffusion_lever').corps
    expect(lever).toMatch(/o\.destinataire_id = p_destinataire/)
    expect(lever).toMatch(/o\.origine IN \('page', 'un_clic'\)/)
    expect(lever).toMatch(/o\.created_at > now\(\) - interval '24 hours'/)
  })

  it('purge (§ 2.5, H10) : diffusions et oppositions levées à 3 ans, oppositions actives à 3 ans sans signalement restant', () => {
    const purger = fonction('signalements_qr_diffusion_purger').corps
    expect([...purger.matchAll(/interval '3 years'/g)].length).toBeGreaterThanOrEqual(3)
    expect(purger).toMatch(/NOT EXISTS \(SELECT 1 FROM signalements_qr s/)
    expect(purger).toMatch(/'diffusion\.purge'/)
  })
})

describe(`Migration ${FICHIER} : liste fermée du journal (§ 2.4)`, () => {
  const actions1111 = valeursListe(code1111, /CONSTRAINT signalements_qr_journal_action_valeurs CHECK \(action IN/)
  const nouvelles = () => valeursListe(code, /ADD CONSTRAINT signalements_qr_journal_action_valeurs CHECK \(action IN/)

  it('la 20261111 a 34 actions, et la nouvelle liste = ces 34 + les 7 de la diffusion, sans doublon', () => {
    expect(actions1111).toHaveLength(34)
    expect(trie(nouvelles())).toEqual(trie([...actions1111, ...ACTIONS_DIFFUSION]))
    expect(new Set(nouvelles()).size).toBe(nouvelles().length)
  })

  it('remplacement gardé : seulement si les 7 actions manquent à la définition lue par pg_get_constraintdef', () => {
    expect(horsFonctions).toMatch(/pg_get_constraintdef\(/)
    const garde = /IF v_avant @> ARRAY\[([^\]]*)\]/.exec(horsFonctions)
    expect(garde).not.toBeNull()
    expect(trie([...(garde?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]))).toEqual(trie(ACTIONS_DIFFUSION))
  })

  it('jamais une action perdue : la liste remplacée doit contenir chaque valeur de la définition actuelle (55000 sinon)', () => {
    expect(horsFonctions).toMatch(/RAISE EXCEPTION 'journal_action_perdue' USING ERRCODE = '55000'/)
  })

  it('NOT VALID dans le remplacement, puis VALIDATE hors du bloc', () => {
    expect(horsFonctions).toMatch(/'diffusion\.purge'\)\) NOT VALID;/)
    expect(horsFonctions).toMatch(/ALTER TABLE signalements_qr_journal VALIDATE CONSTRAINT signalements_qr_journal_action_valeurs;/)
  })

  it('toute action écrite par une fonction de cette migration est dans la nouvelle liste ; details sans objet ni texte', () => {
    const corps = FONCTIONS.map((f) => f.corps).join('\n')
    const ecrites = new Set([...corps.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]))
    expect(ecrites.size).toBeGreaterThanOrEqual(4)
    for (const action of ecrites) expect(nouvelles(), action).toContain(action)
    for (const m of corps.matchAll(/INSERT INTO signalements_qr_journal[\s\S]*?;/g)) {
      expect(m[0]).not.toMatch(/p_objet|p_texte|p_email_saisi|email_empreinte|\.email\b/)
    }
  })
})
