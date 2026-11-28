// tests/migrations/signalements_qr_gestionnaires.test.ts
//
// Migration 20261111_signalements_qr_gestionnaires.sql (AJ Signalement, demandes de Hugo du 10/11/2026) : cabinets
// clients (nom, identifiant du chemin public vitfix.io/<identifiant>/…, langue, domaines e-mail), gestionnaires,
// envois de confirmation d'adresse, attributions, journal, opérations, colonnes ajoutées aux copropriétés et aux
// signalements, 14 fonctions appelées par les routes et 2 fonctions de trigger (gel de l'identifiant, rattachement
// définitif). Le texte SQL est contrôlé ici : la migration n'est rejouée sur aucune base PostgreSQL en local ni en CI.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { MIGRATION_GESTIONNAIRES_QR } from '@/lib/aj-signalement/serveur'
import { ATTRIBUTIONS_MAX_PAR_GESTIONNAIRE_QR } from '@/lib/aj-signalement/types'
import { attributionsGestionnaireQrSchema, departGestionnaireQrSchema } from '@/lib/validation'

const DOSSIER = join(process.cwd(), 'supabase/migrations')
const FICHIER = '20261111_signalements_qr_gestionnaires.sql'
const CHEMIN = join(DOSSIER, FICHIER)
const sql = existsSync(CHEMIN) ? readFileSync(CHEMIN, 'utf-8') : ''
/** Le SQL sans ses commentaires : une mention en commentaire ne compte pas comme instruction. */
const code = sql.replace(/--[^\n]*/g, '')
/** Ce qui s'exécute une seule fois, à l'application : le SQL sans le corps des fonctions (balise $fn$). */
const horsFonctions = code.replace(/\$fn\$[\s\S]*?\$fn\$/g, '$fn$ $fn$')

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const espaces = (s: string) => echapper(s).replace(/\s+/g, '\\s+')
const trie = (valeurs: Iterable<string>) => [...valeurs].sort((a, b) => a.localeCompare(b))

const TABLES_NOUVELLES = [
  'signalements_qr_cabinets', 'signalements_qr_domaines_autorises', 'signalements_qr_gestionnaires',
  'signalements_qr_invitations', 'signalements_qr_attributions', 'signalements_qr_journal', 'signalements_qr_operations',
]

/** Les 14 fonctions appelées par les routes (clé service), avec la signature exacte de leurs arguments. */
const RPC: Record<string, string> = {
  signalements_qr_creer_coproprietes: 'uuid, uuid, text, uuid, uuid, jsonb',
  signalements_qr_compteurs: 'uuid[]',
  signalements_qr_remplacer_attributions: 'uuid, uuid[], boolean, uuid',
  signalements_qr_attribuer_au_gestionnaire: 'uuid, uuid[], uuid',
  signalements_qr_desactiver_gestionnaire: 'uuid, jsonb, uuid',
  signalements_qr_reactiver_gestionnaire: 'uuid, uuid',
  signalements_qr_inviter_gestionnaire: 'jsonb, jsonb, uuid[], uuid',
  signalements_qr_confirmer_adresse: 'uuid',
  signalements_qr_contester_adresse: 'uuid',
  signalements_qr_emails_gestionnaires: 'uuid',
  signalements_qr_reserver_emails: 'uuid, int, int, int',
  signalements_qr_purger_journal: '',
  signalements_qr_enregistrer_cabinet: 'uuid, text, text, text, text[], uuid',
  signalements_qr_rattacher_coproprietes: 'uuid, uuid[], uuid, jsonb, boolean',
}
const FONCTIONS_TRIGGER = ['signalements_qr_identifiant_fige', 'signalements_qr_cabinet_copro_fige']

interface FonctionSql { nom: string; types: string; entete: string; corps: string }

/** Fonctions définies dans le fichier : nom, types des arguments (noms retirés), en-tête (RETURNS…) et corps. */
function fonctionsDefinies(): FonctionSql[] {
  const motif = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(\w+)\s*\(([^)]*)\)([\s\S]*?)\bAS\s+\$fn\$([\s\S]*?)\$fn\$/gi
  return [...code.matchAll(motif)].map((m) => ({
    nom: m[1],
    types: m[2].split(',').map((p) => p.trim()).filter(Boolean).map((p) => p.split(/\s+/).slice(1).join(' ').toLowerCase()).join(', '),
    entete: m[3],
    corps: m[4],
  }))
}
const FONCTIONS = fonctionsDefinies()
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

describe(`Migration ${FICHIER} : fichier et ordre`, () => {
  it('existe, et MIGRATION_GESTIONNAIRES_QR (repli des routes) le désigne', () => {
    expect(existsSync(CHEMIN)).toBe(true)
    expect(MIGRATION_GESTIONNAIRES_QR).toBe(`supabase/migrations/${FICHIER}`)
  })

  it('passe après les deux migrations du 06/11/2026 (ordre des noms de fichier)', () => {
    const fichiers = readdirSync(DOSSIER).sort((a, b) => a.localeCompare(b))
    expect(fichiers.indexOf(FICHIER)).toBeGreaterThan(fichiers.indexOf('20261106_signalements_qr_geoloc_qualite.sql'))
    expect(fichiers.indexOf(FICHIER)).toBeGreaterThan(fichiers.indexOf('20261106_signalements_qr_confirmation.sql'))
  })

  it('se termine par la relecture du schéma par PostgREST', () => {
    expect(code).toMatch(/NOTIFY pgrst, 'reload schema';\s*$/)
  })

  it('en-tête : chaque message P0001 levé par une fonction ou un trigger y est cité (essai PGlite du 11/11)', () => {
    const entete = sql.slice(0, sql.indexOf('-- ── 1.'))
    expect(entete.length).toBeGreaterThan(0)
    const leves = new Set([...code.matchAll(/RAISE EXCEPTION '([a-z_]+)' USING ERRCODE = 'P0001'/g)].map((m) => m[1]))
    expect(leves.size).toBeGreaterThan(0)
    expect([...leves].filter((m) => !new RegExp(`\\b${m}\\b`).test(entete))).toEqual([])
  })
})

describe(`Migration ${FICHIER} : rejouable, sans donnée`, () => {
  it('IF NOT EXISTS sur chaque table, index et colonne ; OR REPLACE sur chaque fonction et trigger', () => {
    expect([...code.matchAll(/CREATE TABLE (?!IF NOT EXISTS)/g)]).toHaveLength(0)
    expect([...code.matchAll(/CREATE (?:UNIQUE )?INDEX (?!IF NOT EXISTS)/g)]).toHaveLength(0)
    expect([...code.matchAll(/ADD COLUMN (?!IF NOT EXISTS)/g)]).toHaveLength(0)
    expect([...code.matchAll(/CREATE (?!OR REPLACE )FUNCTION/g)]).toHaveLength(0)
    expect([...code.matchAll(/CREATE (?!OR REPLACE )TRIGGER/g)]).toHaveLength(0)
    expect(code).not.toMatch(/\bDROP\b/i)
  })

  it('aucune écriture de données à l’application (hors corps des fonctions)', () => {
    expect(horsFonctions).not.toMatch(/\bINSERT\s+INTO\b/i)
    expect(horsFonctions).not.toMatch(/\bUPDATE\s+[a-z_]+(?:\s+[a-z]+)?\s+SET\b/i)
    expect(horsFonctions).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(horsFonctions).not.toMatch(/\bTRUNCATE\b/i)
    expect(horsFonctions).not.toMatch(/\bCOPY\b/i)
  })

  it('aucune valeur réelle : ni drapeau « à tous » posé, ni adresse, ni domaine, ni nom de cabinet ou de copropriété', () => {
    expect(code).not.toMatch(/attribuee_a_tous\s*=\s*true/i)
    expect(sql).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+/i)
    expect(code).not.toMatch(/'[a-z0-9-]+(\.[a-z0-9-]+)*\.(fr|com|pt|io|net|org|eu|test)'/i)
    expect(sql.toLowerCase()).not.toContain('aj' + 'associ')
    expect(sql.toLowerCase()).not.toContain(['aj', 'associ'].join(' '))
    expect(sql).not.toMatch(/Parc Belle Ombre/i)
  })
})

describe(`Migration ${FICHIER} : sécurité (clé service seulement)`, () => {
  it('les 7 tables nouvelles, et elles seules, sont créées', () => {
    const creees = [...code.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1])
    expect(trie(creees)).toEqual(trie(TABLES_NOUVELLES))
  })

  it.each(TABLES_NOUVELLES)('%s : RLS activée', (table) => {
    expect(code).toMatch(new RegExp(`ALTER TABLE ${table}\\s+ENABLE ROW LEVEL SECURITY;`))
  })

  it('aucune politique RLS, aucune vue (une vue du schéma public contournerait la RLS)', () => {
    expect(code).not.toMatch(/\bCREATE\s+POLICY\b/i)
    expect(code).not.toMatch(/\bCREATE\s+(OR\s+REPLACE\s+)?VIEW\b/i)
  })

  it('droits retirés à anon et authenticated sur les 7 tables', () => {
    const m = /REVOKE ALL ON ([\w\s,]+?) FROM anon, authenticated;/.exec(code)
    expect(m).not.toBeNull()
    const tables = (m?.[1] ?? '').split(',').map((t) => t.trim())
    expect(trie(tables)).toEqual(trie(TABLES_NOUVELLES))
  })

  it('séquence du journal (identité) : droits par défaut de Supabase retirés à anon et authenticated, jamais redonnés (essai PGlite du 11/11)', () => {
    // GENERATED ALWAYS AS IDENTITY crée signalements_qr_journal_id_seq ; Supabase y donne USAGE, SELECT, UPDATE à anon et
    // authenticated (droits par défaut du schéma public). L'insertion par la clé service n'en a pas besoin (nextval interne).
    expect(code).toMatch(/REVOKE ALL ON SEQUENCE signalements_qr_journal_id_seq FROM PUBLIC, anon, authenticated;/)
    expect(code).not.toMatch(/\bGRANT\b[^;]*\bON\s+SEQUENCE\b/i)
    expect([...code.matchAll(/GENERATED (?:ALWAYS|BY DEFAULT) AS IDENTITY|\bSERIAL\b|\bBIGSERIAL\b/gi)]).toHaveLength(1)
  })

  it('16 fonctions définies : les 14 appelées par les routes et les 2 de trigger, aucune autre', () => {
    expect(trie(FONCTIONS.map((f) => f.nom))).toEqual(trie([...Object.keys(RPC), ...FONCTIONS_TRIGGER]))
    expect(new Set(FONCTIONS.map((f) => f.nom)).size).toBe(FONCTIONS.length)
  })

  it.each(Object.entries(RPC))('%s(%s) : signature, EXECUTE retiré au public puis donné à service_role seul', (nom, types) => {
    expect(fonction(nom).types).toBe(types)
    const signature = `${nom}(${types})`
    expect(code).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION ${echapper(signature)} FROM PUBLIC, anon, authenticated;`))
    expect(code).toMatch(new RegExp(`GRANT\\s+EXECUTE ON FUNCTION ${echapper(signature)} TO service_role;`))
    expect(code).not.toMatch(new RegExp(`GRANT\\s+EXECUTE ON FUNCTION ${echapper(nom)}\\([^)]*\\) TO (?!service_role;)`))
  })

  it.each(FONCTIONS_TRIGGER)('%s() : fonction de trigger, EXECUTE retiré, jamais donné', (nom) => {
    expect(fonction(nom).types).toBe('')
    expect(fonction(nom).entete).toMatch(/RETURNS trigger/)
    expect(code).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION ${nom}\\(\\) FROM PUBLIC, anon, authenticated;`))
    expect(code).not.toMatch(new RegExp(`GRANT\\s+EXECUTE ON FUNCTION ${nom}\\(`))
  })

  it('toutes les fonctions : SECURITY INVOKER et search_path figé ; aucune SECURITY DEFINER', () => {
    for (const f of FONCTIONS) {
      expect(f.entete, f.nom).toMatch(/SECURITY INVOKER SET search_path = public, pg_temp/)
    }
    expect(code).not.toMatch(/SECURITY\s+DEFINER/i)
  })
})

describe(`Migration ${FICHIER} : cabinets clients et domaines`, () => {
  const cabinets = () => blocTable('signalements_qr_cabinets')

  it('identifiant du chemin public : obligatoire, unique, 3 à 40 caractères au format figé', () => {
    expect(cabinets()).toMatch(/identifiant\s+TEXT NOT NULL,/)
    expect(cabinets()).toMatch(/CONSTRAINT signalements_qr_cabinets_identifiant_unique UNIQUE \(identifiant\)/)
    expect(cabinets()).toMatch(/CONSTRAINT signalements_qr_cabinets_identifiant_format\s+CHECK \(char_length\(identifiant\) BETWEEN 3 AND 40 AND identifiant ~ '\^\[a-z\]\[a-z0-9\]\*\(-\[a-z0-9\]\+\)\*\$'\)/)
  })

  it('le format de l’identifiant accepte « cabinet-exemple » et refuse tirets en bord, tirets doublés, majuscules, accents', () => {
    const m = /identifiant ~ '([^']+)'/.exec(cabinets())
    const format = new RegExp(m?.[1] ?? '^$')
    expect(format.test('cabinet-exemple')).toBe(true)
    expect(format.test('cabinet2')).toBe(true)
    for (const refuse of ['-cabinet', 'cabinet-', 'cabinet--exemple', 'Cabinet', 'cabinét', '2cabinet', 'cabinet_exemple', 'cabinet exemple']) {
      expect(format.test(refuse), refuse).toBe(false)
    }
  })

  it('nom obligatoire, langue fr ou pt (fr par défaut), sans aucune donnée par défaut', () => {
    expect(cabinets()).toMatch(/nom\s+TEXT NOT NULL CHECK \(char_length\(btrim\(nom\)\) BETWEEN 1 AND 200\)/)
    expect(cabinets()).toMatch(/langue\s+TEXT NOT NULL DEFAULT 'fr'/)
    expect(cabinets()).toMatch(/CONSTRAINT signalements_qr_cabinets_langue_valeurs CHECK \(langue IN \('fr', 'pt'\)\)/)
  })

  it('domaine : rattaché à un cabinet (suppression en cascade), unique entre tous les cabinets, en minuscules', () => {
    const domaines = blocTable('signalements_qr_domaines_autorises')
    expect(domaines).toMatch(/cabinet_id\s+UUID NOT NULL REFERENCES signalements_qr_cabinets\(id\) ON DELETE CASCADE/)
    expect(domaines).toMatch(/CONSTRAINT signalements_qr_domaines_domaine_unique UNIQUE \(domaine\)/)
    expect(domaines).toMatch(/domaine = lower\(domaine\)/)
    expect(domaines).toMatch(/char_length\(domaine\) <= 253/)
  })

  it('identifiant figé par trigger dès qu’une copropriété ou un gestionnaire existe dans le cabinet', () => {
    expect(code).toMatch(new RegExp(espaces(
      'CREATE OR REPLACE TRIGGER trg_signalements_qr_cabinets_identifiant_fige BEFORE UPDATE OF identifiant ON signalements_qr_cabinets FOR EACH ROW EXECUTE FUNCTION signalements_qr_identifiant_fige();',
    )))
    const corps = fonction('signalements_qr_identifiant_fige').corps
    expect(corps).toMatch(/NEW\.identifiant IS DISTINCT FROM OLD\.identifiant/)
    expect(corps).toMatch(/FROM signalements_qr_coproprietes c WHERE c\.cabinet_id = OLD\.id/)
    expect(corps).toMatch(/FROM signalements_qr_gestionnaires g WHERE g\.cabinet_id = OLD\.id/)
    expect(corps).toMatch(/RAISE EXCEPTION 'identifiant_fige' USING ERRCODE = 'P0001'/)
  })

  it('rattachement d’une copropriété à un cabinet définitif (NULL → cabinet seulement)', () => {
    expect(code).toMatch(new RegExp(espaces(
      'CREATE OR REPLACE TRIGGER trg_signalements_qr_copros_cabinet_fige BEFORE UPDATE OF cabinet_id ON signalements_qr_coproprietes FOR EACH ROW EXECUTE FUNCTION signalements_qr_cabinet_copro_fige();',
    )))
    const corps = fonction('signalements_qr_cabinet_copro_fige').corps
    expect(corps).toMatch(/OLD\.cabinet_id IS NOT NULL AND NEW\.cabinet_id IS DISTINCT FROM OLD\.cabinet_id/)
    expect(corps).toMatch(/RAISE EXCEPTION 'cabinet_fige' USING ERRCODE = 'P0001'/)
  })

  it('updated_at tenu sur les cabinets et les gestionnaires', () => {
    for (const table of ['signalements_qr_cabinets', 'signalements_qr_gestionnaires']) {
      expect(code).toMatch(new RegExp(espaces(
        `CREATE OR REPLACE TRIGGER trg_${table}_updated_at BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION set_updated_at();`,
      )))
    }
  })

  it('enregistrement d’un cabinet : identifiant ou domaine déjà pris refusés, domaines remplacés, journal sans valeur', () => {
    const corps = fonction('signalements_qr_enregistrer_cabinet').corps
    expect(corps).toMatch(/RAISE EXCEPTION 'identifiant_pris' USING ERRCODE = 'P0001'/)
    expect(corps).toMatch(/RAISE EXCEPTION 'domaine_pris' USING ERRCODE = 'P0001'/)
    for (const action of ['cabinet.cree', 'cabinet.modifie', 'cabinet.domaines_modifies']) expect(corps).toContain(`'${action}'`)
    expect(corps).toMatch(/jsonb_build_object\('nombre', cardinality\(v_domaines\)\)/)
  })

  it('rattachement de copropriétés : seulement celles qui n’ont pas de cabinet, sous le verrou du cabinet, journalisé', () => {
    const corps = fonction('signalements_qr_rattacher_coproprietes').corps
    expect(corps).toMatch(/pg_advisory_xact_lock\(hashtextextended\('signalements_qr_creation:' \|\| p_cabinet::text, 0\)\)/)
    expect(corps).toMatch(/c\.cabinet_id IS NULL/)
    expect(corps).toMatch(/RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001'/)
    expect(corps).toContain("'copropriete.rattachee'")
  })

  it('rattachement (relecture 9) : clé du nom posée là où elle manque, doublon nom + code postal refusé SOUS le verrou sauf forçage journalisé', () => {
    const corps = fonction('signalements_qr_rattacher_coproprietes').corps
    const verrou = corps.indexOf("pg_advisory_xact_lock(hashtextextended('signalements_qr_creation:'")
    // Essai PGlite du 11/11 (D5) : une clé manquante (copropriété que la route n'a pas lue) est REFUSÉE, avant toute
    // écriture ; avant, le contrôle nom + code postal sautait en silence (cle_nom restait NULL).
    const manque = corps.search(new RegExp(espaces(
      "IF EXISTS (SELECT 1 FROM signalements_qr_coproprietes c WHERE c.id = ANY (v_ids) AND c.cle_nom IS NULL AND jsonb_typeof(p_cles_nom->(c.id::text)) IS DISTINCT FROM 'string') THEN RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';",
    )))
    const pose = corps.search(new RegExp(espaces('UPDATE signalements_qr_coproprietes c SET cle_nom = p_cles_nom->>(c.id::text) WHERE c.id = ANY (v_ids) AND c.cle_nom IS NULL;')))
    expect(manque).toBeGreaterThan(verrou)
    expect(pose).toBeGreaterThan(manque)
    expect(corps).not.toMatch(/nullif\(p_cles_nom/)
    const controle = new RegExp(espaces(
      "WHERE c.id = ANY (v_ids) AND c.code_postal <> '' AND c.cle_nom IS NOT NULL AND EXISTS (SELECT 1 FROM signalements_qr_coproprietes d WHERE d.id <> c.id AND (d.cabinet_id = p_cabinet OR d.id = ANY (v_ids)) AND d.cle_nom = c.cle_nom AND d.code_postal = c.code_postal)",
    ))
    const m = controle.exec(corps)
    expect(m).not.toBeNull()
    expect(m?.index ?? -1).toBeGreaterThan(verrou)
    expect(verrou).toBeGreaterThan(0)
    const refus = corps.search(new RegExp(espaces("IF cardinality(v_doublons) > 0 AND NOT coalesce(p_forcer_doublon, false) THEN RAISE EXCEPTION 'doublon' USING ERRCODE = 'P0001';")))
    expect(refus).toBeGreaterThan(m?.index ?? Infinity)
    // Le refus précède le rattachement ; le forçage est journalisé (doublon.force) pour chaque copropriété en cause.
    expect(refus).toBeLessThan(corps.indexOf('UPDATE signalements_qr_coproprietes c SET cabinet_id = p_cabinet'))
    expect(corps).toMatch(new RegExp(espaces(
      "SELECT p_cabinet, p_acteur, 'super_admin', 'doublon.force', x.id, '{\"critere\": \"nom_code_postal\"}'::jsonb FROM unnest(v_doublons) AS x(id)",
    )))
    expect(corps).toMatch(new RegExp(espaces("jsonb_typeof(p_cles_nom) <> 'object'")))
  })
})

describe(`Migration ${FICHIER} : gestionnaires et envois`, () => {
  const gestionnaires = () => blocTable('signalements_qr_gestionnaires')

  it('id SANS valeur par défaut : tiré par la route et signé dans le lien avant l’insertion', () => {
    expect(gestionnaires()).toMatch(/^\s*id\s+UUID PRIMARY KEY,/)
    expect(gestionnaires().split('\n').find((l) => /^\s*id\s/.test(l))).not.toMatch(/DEFAULT/)
    expect(blocTable('signalements_qr_invitations')).toMatch(/^\s*id\s+UUID PRIMARY KEY,/)
  })

  it('toujours dans un cabinet (jamais supprimé tant qu’il a des gestionnaires)', () => {
    expect(gestionnaires()).toMatch(/cabinet_id\s+UUID NOT NULL REFERENCES signalements_qr_cabinets\(id\) ON DELETE RESTRICT/)
    expect(code).not.toMatch(/coalesce\(g\.cabinet_id/i)
  })

  it('fiche pseudonymisée toujours inactive ; identité exigée tant qu’elle ne l’est pas ; une fiche par adresse', () => {
    expect(gestionnaires()).toMatch(/CONSTRAINT signalements_qr_gestionnaires_pseudonymise_inactif\s+CHECK \(pseudonymise_le IS NULL OR NOT actif\)/)
    expect(gestionnaires()).toMatch(/CONSTRAINT signalements_qr_gestionnaires_identite\s+CHECK \(pseudonymise_le IS NOT NULL OR \(nom IS NOT NULL AND email IS NOT NULL\)\)/)
    expect(code).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_signalements_qr_gestionnaires_email\s+ON signalements_qr_gestionnaires \(email\) WHERE email IS NOT NULL;/)
  })

  it('envois : format lu par lib/equipe, objets et refus fermés, rôle unique', () => {
    const invitations = blocTable('signalements_qr_invitations')
    expect(invitations).toMatch(/gestionnaire_id\s+UUID NOT NULL REFERENCES signalements_qr_gestionnaires\(id\) ON DELETE CASCADE/)
    expect(invitations).toMatch(/objet\s+TEXT NOT NULL CHECK \(objet IN \('confirmation_adresse', 'acces'\)\)/)
    expect(invitations).toMatch(/role\s+TEXT NOT NULL DEFAULT 'gestionnaire_signalement' CHECK \(role = 'gestionnaire_signalement'\)/)
    expect(invitations).toMatch(/invite_token\s+TEXT UNIQUE CHECK \(invite_token IS NULL OR invite_token ~ '\^\[a-f0-9\]\{48\}\$'\)/)
    expect(invitations).toMatch(/refus\s+TEXT CHECK \(refus IS NULL OR refus IN \('compte_autre_espace', 'pas_moi'\)\)/)
    for (const colonne of ['email', 'full_name', 'accepted_at', 'user_id', 'created_at']) expect(invitations).toMatch(new RegExp(`\\n\\s*${colonne}\\s`))
  })

  it('création d’une fiche : l’id et l’envoi fournis par la route, insérés tels quels, dans les domaines de SON cabinet', () => {
    const corps = fonction('signalements_qr_inviter_gestionnaire').corps
    expect(corps).toContain("p_gestionnaire->>'id'")
    expect(corps).toContain("p_invitation->>'id'")
    expect(corps).toMatch(/INSERT INTO signalements_qr_gestionnaires \(id, cabinet_id,/)
    expect(corps).toMatch(/INSERT INTO signalements_qr_invitations \(id, gestionnaire_id,/)
    expect(corps).not.toMatch(/gen_random_uuid/)
    expect(corps).toMatch(/d\.cabinet_id = v_cab AND d\.domaine = split_part\(v_email, '@', 2\)/)
    expect(corps).toMatch(/RAISE EXCEPTION 'hors_domaine' USING ERRCODE = 'P0001'/)
    for (const action of ['gestionnaire.cree', 'gestionnaire.domaine_force', 'attribution.ajoutee']) expect(corps).toContain(`'${action}'`)
  })

  it('création d’une fiche (relecture 2) : domaine déclaré par un AUTRE cabinet refusé, forçage compris, AVANT l’insertion', () => {
    const corps = fonction('signalements_qr_inviter_gestionnaire').corps
    const motif = new RegExp(espaces(
      "IF EXISTS (SELECT 1 FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id <> v_cab AND d.domaine = split_part(v_email, '@', 2)) THEN RAISE EXCEPTION 'domaine_autre_cabinet' USING ERRCODE = 'P0001';",
    ))
    const m = motif.exec(corps)
    expect(m).not.toBeNull()
    // Ni conditionné par v_force, ni placé après l'insertion de la fiche.
    expect(corps.slice(0, m?.index ?? 0)).not.toMatch(/IF NOT v_force[^;]*$/)
    expect(m?.index ?? Infinity).toBeLessThan(corps.indexOf('INSERT INTO signalements_qr_gestionnaires'))
  })

  it.each(['signalements_qr_confirmer_adresse', 'signalements_qr_contester_adresse'])(
    '%s : envoi de confirmation encore valable (7 jours, non accepté, sans refus), fiche active non contestée',
    (nom) => {
      const corps = fonction(nom).corps
      expect(corps).toMatch(/i\.objet = 'confirmation_adresse'/)
      expect(corps).toMatch(/i\.accepted_at IS NULL/)
      expect(corps).toMatch(/i\.refus IS NULL/)
      expect(corps).toMatch(/i\.invite_token IS NOT NULL/)
      expect(corps).toMatch(/i\.created_at > now\(\) - interval '7 days'/)
      expect(corps).toMatch(/g\.actif AND g\.adresse_contestee_le IS NULL/)
      expect(corps).toMatch(/RETURN false;/)
    },
  )

  it('« Ce n’est pas moi » : refus pas_moi, fiche contestée, autres envois en attente invalidés', () => {
    const corps = fonction('signalements_qr_contester_adresse').corps
    expect(corps).toMatch(/refus = 'pas_moi'/)
    expect(corps).toMatch(/adresse_contestee_le = now\(\)/)
    expect(corps).toContain("'gestionnaire.adresse_contestee'")
    expect(fonction('signalements_qr_confirmer_adresse').corps).toMatch(/adresse_confirmee_le = coalesce\(adresse_confirmee_le, now\(\)\)/)
  })

  it('lien rouvert après « C’est moi » (essai PGlite du 11/11, D4) : le jeton reste et accepted_at fait foi (usage unique) ; départ et contestation effacent TOUS les jetons de la fiche', () => {
    // lireInvitationValide (lib/equipe) retrouve l'envoi par son jeton : effacé, la page dirait « lien invalide » au lieu
    // de « Adresse déjà confirmée. ». Gardé, il n'accorde rien de plus : confirmer et contester exigent accepted_at NULL.
    const confirmer = fonction('signalements_qr_confirmer_adresse').corps
    expect(confirmer).toMatch(/UPDATE signalements_qr_invitations i SET accepted_at = now\(\)\s+WHERE i\.id = p_invitation/)
    expect(confirmer).not.toMatch(/invite_token\s*=\s*NULL/)
    expect(confirmer).toMatch(/i\.accepted_at IS NULL AND i\.refus IS NULL\s+AND i\.invite_token IS NOT NULL/)
    for (const [nom, fiche] of [['signalements_qr_contester_adresse', 'v_g'], ['signalements_qr_desactiver_gestionnaire', 'p_id']]) {
      const corps = fonction(nom).corps
      expect(corps, nom).toMatch(new RegExp(espaces(`UPDATE signalements_qr_invitations SET invite_token = NULL WHERE gestionnaire_id = ${fiche} AND invite_token IS NOT NULL;`)))
      expect(corps, nom).not.toMatch(/SET invite_token = NULL\s+WHERE gestionnaire_id = \w+ AND accepted_at IS NULL/)
    }
  })

  it('réactivation refusée pour une fiche pseudonymisée', () => {
    expect(fonction('signalements_qr_reactiver_gestionnaire').corps).toMatch(/pseudonymise_le IS NULL/)
  })
})

describe(`Migration ${FICHIER} : attributions et adresses des gestionnaires (RG-06 bis)`, () => {
  it('attributions : une ligne par couple, origine fermée', () => {
    const attributions = blocTable('signalements_qr_attributions')
    expect(attributions).toMatch(/PRIMARY KEY \(copropriete_id, gestionnaire_id\)/)
    expect(attributions).toMatch(/origine\s+TEXT NOT NULL CHECK \(origine IN \('super_admin', 'creation', 'import', 'reattribution'\)\)/)
  })

  it.each(['signalements_qr_remplacer_attributions', 'signalements_qr_attribuer_au_gestionnaire', 'signalements_qr_desactiver_gestionnaire'])(
    '%s : retire l’adresse de la fiche qui perd la copropriété des adresses saisies (array_remove)',
    (nom) => {
      expect(fonction(nom).corps).toMatch(/SET emails_destinataires = array_remove\(emails_destinataires, v_email\)/)
      expect(fonction(nom).corps).toMatch(/ARRAY\['emails_destinataires'\]/)
    },
  )

  it('départ : adresse retirée de TOUTES les copropriétés qui la contiennent, successions exigées', () => {
    const corps = fonction('signalements_qr_desactiver_gestionnaire').corps
    expect(corps).toMatch(/WHERE v_email = ANY\s*\(emails_destinataires\)\s+RETURNING/)
    expect(corps).toMatch(/'reattribution'/)
    expect(corps).toMatch(/invite_token = NULL/)
    expect(corps).toMatch(/jsonb_build_object\('deplacees', v_deplacees, 'laisseesSansGestionnaire', v_sans, 'adressesRetirees', v_retirees\)/)
  })

  it('remplacement des attributions : copropriété sans cabinet refusée, insertion AVANT suppression', () => {
    const corps = fonction('signalements_qr_remplacer_attributions').corps
    expect(corps).toMatch(/RAISE EXCEPTION 'sans_cabinet' USING ERRCODE = 'P0001'/)
    expect(corps.indexOf('INSERT INTO signalements_qr_attributions')).toBeGreaterThan(-1)
    expect(corps.indexOf('INSERT INTO signalements_qr_attributions')).toBeLessThan(corps.indexOf('DELETE FROM signalements_qr_attributions'))
  })

  it('destinataires gestionnaires : signature figée (acces_ouvert et exclu), même cabinet, adresse confirmée non contestée', () => {
    const f = fonction('signalements_qr_emails_gestionnaires')
    expect(f.entete).toMatch(/RETURNS TABLE\(gestionnaire_id uuid, email text, acces_ouvert boolean, exclu boolean\)/)
    expect(f.entete).toMatch(/LANGUAGE sql STABLE/)
    expect(f.corps).toMatch(/false AS acces_ouvert/)
    expect(f.corps).toMatch(/g\.cabinet_id = c\.cabinet_id/)
    expect(f.corps).toMatch(/g\.actif AND g\.email IS NOT NULL AND g\.adresse_confirmee_le IS NOT NULL AND g\.adresse_contestee_le IS NULL/)
    expect(f.corps).toMatch(/c\.attribuee_a_tous OR EXISTS/)
    expect(f.corps).toMatch(/NOT g\.actif OR g\.adresse_contestee_le IS NOT NULL/)
    expect(f.corps).toMatch(/ORDER BY t\.exclu DESC, t\.gestionnaire_id\s+LIMIT 100/)
  })
})

describe(`Migration ${FICHIER} : copropriétés (création unique, doublons, cabinet)`, () => {
  it('création : sous le verrou du cabinet, rejeu par operationId, gestionnaires du MÊME cabinet seulement', () => {
    const corps = fonction('signalements_qr_creer_coproprietes').corps
    expect(corps).toMatch(/pg_advisory_xact_lock\(hashtextextended\('signalements_qr_creation:' \|\| v_cab::text, 0\)\)/)
    expect(corps).toMatch(/FROM signalements_qr_operations o WHERE o\.id = p_operation/)
    expect(corps).toMatch(/g\.id = v_g AND g\.actif AND g\.cabinet_id = p_cabinet/)
    expect(corps).toMatch(/coalesce\(c\.cabinet_id, v_zero\) = v_cab/)
    expect(corps).toMatch(/RAISE EXCEPTION 'doublon' USING ERRCODE = 'P0001'/)
    expect(corps).toMatch(/replace\(gen_random_uuid\(\)::text, '-', ''\)/)
    expect(corps).toMatch(/INSERT INTO signalements_qr_operations \(id, cabinet_id,/)
  })

  it('rejeu (relecture 1) : même auteur, même cabinet et MÊME lot (empreinte des lignes), sinon a_reverifier ; rendu relu en base', () => {
    expect(blocTable('signalements_qr_operations')).toMatch(/\n\s*empreinte_lignes\s+TEXT NOT NULL,/)
    const corps = fonction('signalements_qr_creer_coproprietes').corps
    expect(corps).toMatch(/v_empreinte := encode\(sha256\(convert_to\(p_lignes::text, 'UTF8'\)\), 'hex'\);/)
    expect(corps).toMatch(/SELECT o\.resultat, o\.acteur_id, o\.cabinet_id, o\.empreinte_lignes INTO v_deja, v_auteur, v_cab_op, v_empreinte_op/)
    expect(corps).toMatch(new RegExp(espaces(
      'IF v_auteur IS DISTINCT FROM p_acteur OR v_cab_op IS DISTINCT FROM p_cabinet OR v_empreinte_op IS DISTINCT FROM v_empreinte THEN RAISE EXCEPTION \'a_reverifier\'',
    )))
    expect(corps).toMatch(/INSERT INTO signalements_qr_operations \(id, cabinet_id, acteur_id, acteur_profil, type, empreinte_lignes, resultat\)/)
    // Le résultat conservé ne garde ni nom ni adresse ; le rendu (premier passage et rejeu) les relit dans la base.
    expect(corps).toMatch(/v_creees := v_creees \|\| jsonb_build_object\('numeroLigne', \(v_l->>'numeroLigne'\)::int, 'id', v_id, 'jeton', v_jeton\);/)
    const rendus = [...corps.matchAll(/'jeton', c\.jeton, 'nom', c\.nom, 'adresse', c\.adresse, 'codePostal', c\.code_postal, 'ville', c\.ville/g)]
    expect(rendus).toHaveLength(2)
    expect([...corps.matchAll(/JOIN signalements_qr_coproprietes c ON c\.id = \(e\.val->>'id'\)::uuid/g)]).toHaveLength(2)
    expect(corps).toMatch(/RETURN jsonb_build_object\('creees', v_rendu, 'completees', coalesce\(v_deja->'completees', '\[\]'::jsonb\), 'rejeu', true\);/)
    expect(corps).toMatch(/RETURN jsonb_build_object\('creees', v_rendu, 'completees', v_compl, 'rejeu', false\);/)
  })

  it('« compléter » (relecture 8) : cle_nom reçoit la clé du nom EXISTANT, jamais celle du nom de la ligne', () => {
    const corps = fonction('signalements_qr_creer_coproprietes').corps
    const debut = corps.indexOf("IF v_l->>'action' = 'completer'")
    const completer = corps.slice(debut, corps.indexOf('v_compl := v_compl', debut))
    expect(completer).toMatch(/cle_nom\s+= coalesce\(c\.cle_nom, nullif\(v_l->>'cleNomExistante', ''\)\)/)
    expect(completer).not.toContain("v_l->>'cleNom'")
  })

  it('« compléter » et « créer » dans un même lot (essai PGlite du 11/11, D3) : complétions d’abord, quel que soit l’ordre des lignes ; complétion qui fait apparaître un doublon nom + code postal refusée', () => {
    const corps = fonction('signalements_qr_creer_coproprietes').corps
    // Une seule boucle : les lignes « compléter » passent avant les autres, chacune dans l'ordre du lot.
    expect(corps).toMatch(new RegExp(espaces(
      "FOR v_l IN SELECT e.val FROM jsonb_array_elements(p_lignes) WITH ORDINALITY AS e(val, rang) ORDER BY coalesce(e.val->>'action' = 'completer', false) DESC, e.rang LOOP",
    )))
    expect([...corps.matchAll(/FOR v_l IN/g)]).toHaveLength(1)
    const debut = corps.indexOf("IF v_l->>'action' = 'completer'")
    const completer = corps.slice(debut, corps.indexOf('v_compl := v_compl', debut))
    // Clé et code postal lus avant, relus après la complétion ; comparés aux AUTRES fiches du cabinet si l'un a changé.
    expect(completer).toMatch(/SELECT c\.cle_nom, c\.code_postal INTO v_cle_avant, v_cp_avant\s+FROM signalements_qr_coproprietes c WHERE c\.id = v_id AND coalesce\(c\.cabinet_id, v_zero\) = v_cab/)
    expect(completer).toMatch(/RETURNING c\.cle_nom, c\.code_postal INTO v_cle, v_cp;/)
    const controle = new RegExp(espaces(
      "IF (v_cle IS DISTINCT FROM v_cle_avant OR v_cp IS DISTINCT FROM v_cp_avant) AND v_cle IS NOT NULL AND v_cp <> '' AND EXISTS (SELECT 1 FROM signalements_qr_coproprietes d WHERE coalesce(d.cabinet_id, v_zero) = v_cab AND d.id <> v_id AND d.cle_nom = v_cle AND d.code_postal = v_cp) THEN RAISE EXCEPTION 'doublon' USING ERRCODE = 'P0001', DETAIL = v_num;",
    ))
    expect(completer).toMatch(controle)
    // Aucun forçage pour une complétion (le plan d'import envoie toujours forcerDoublon: false).
    expect(completer).not.toMatch(/forcerDoublon/)
  })

  it('import (lot 5) : un fichier d’UNE ligne reste un import ; « compléter » ne remplit que les champs vides, n’écrase rien', () => {
    const corps = fonction('signalements_qr_creer_coproprietes').corps
    expect(corps).toMatch(/v_type := CASE WHEN v_nb = 1 AND coalesce\(p_lignes->0->>'origine', ''\) <> 'import' THEN 'creation' ELSE 'import' END;/)
    for (const [colonne, cle] of [['adresse', 'adresse'], ['code_postal', 'codePostal'], ['ville', 'ville']]) {
      expect(corps).toMatch(new RegExp(`${colonne}\\s+= CASE WHEN c\\.${colonne} = '' THEN coalesce\\(v_l->>'${cle}', ''\\) ELSE c\\.${colonne} END`))
    }
    expect(corps).toMatch(/immatriculation\s+= coalesce\(c\.immatriculation, nullif\(v_l->>'immatriculation', ''\)\)/)
    expect(corps).toMatch(/reference_cabinet = coalesce\(c\.reference_cabinet, nullif\(v_l->>'referenceCabinet', ''\)\)/)
    expect(corps).toMatch(/batiments\s+= CASE WHEN cardinality\(c\.batiments\) = 0/)
    // Les destinataires saisis d'une copropriété existante ne sont jamais touchés par « compléter ».
    const debut = corps.indexOf("IF v_l->>'action' = 'completer'")
    const completer = corps.slice(debut, corps.indexOf('v_compl := v_compl', debut))
    expect(completer.length).toBeGreaterThan(0)
    expect(completer).not.toMatch(/emails_destinataires/)
  })

  it('« attribuée à tous » exige un cabinet', () => {
    expect(code).toMatch(/ADD CONSTRAINT signalements_qr_copros_tous_cabinet\s+CHECK \(NOT attribuee_a_tous OR cabinet_id IS NOT NULL\) NOT VALID/)
  })

  it.each([
    ['signalements_qr_coproprietes', 'cabinet_id', 'UUID'],
    ['signalements_qr_coproprietes', 'code_postal', "TEXT NOT NULL DEFAULT ''"],
    ['signalements_qr_coproprietes', 'ville', "TEXT NOT NULL DEFAULT ''"],
    ['signalements_qr_coproprietes', 'immatriculation', 'TEXT'],
    ['signalements_qr_coproprietes', 'reference_cabinet', 'TEXT'],
    ['signalements_qr_coproprietes', 'batiments', "TEXT[] NOT NULL DEFAULT '{}'"],
    ['signalements_qr_coproprietes', 'attribuee_a_tous', 'BOOLEAN NOT NULL DEFAULT false'],
    ['signalements_qr_coproprietes', 'cle_nom', 'TEXT'],
    ['signalements_qr_coproprietes', 'cree_par_gestionnaire_id', 'UUID'],
    ['signalements_qr_coproprietes', 'operation_id', 'UUID'],
    ['signalements_qr', 'statut_modifie_le', 'TIMESTAMPTZ'],
    ['signalements_qr', 'statut_modifie_par', 'UUID'],
    ['signalements_qr', 'statut_modifie_profil', 'TEXT'],
    ['signalements_qr', 'nb_emails_envoyes', 'SMALLINT NOT NULL DEFAULT 0'],
    ['signalements_qr', 'email_retenu', 'BOOLEAN NOT NULL DEFAULT false'],
  ])('%s.%s ajoutée seulement si elle manque (%s)', (table, colonne, definition) => {
    expect(code).toMatch(new RegExp(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${colonne} ${echapper(definition)};`))
  })

  it('aucune colonne ajoutée aux tables nouvelles (fichier jamais appliqué avant sa version finale)', () => {
    for (const table of TABLES_NOUVELLES) expect(code).not.toMatch(new RegExp(`ALTER TABLE ${table} ADD COLUMN`))
  })

  it.each([
    ['signalements_qr_coproprietes', 'signalements_qr_copros_cabinet_fk', /FOREIGN KEY \(cabinet_id\) REFERENCES signalements_qr_cabinets\(id\) ON DELETE RESTRICT NOT VALID/],
    ['signalements_qr_coproprietes', 'signalements_qr_copros_createur_fk', /FOREIGN KEY \(cree_par_gestionnaire_id\) REFERENCES signalements_qr_gestionnaires\(id\) ON DELETE SET NULL NOT VALID/],
    ['signalements_qr_coproprietes', 'signalements_qr_copros_tous_cabinet', /CHECK \(NOT attribuee_a_tous OR cabinet_id IS NOT NULL\) NOT VALID/],
    ['signalements_qr_coproprietes', 'signalements_qr_copros_code_postal_format', /CHECK \(code_postal ~ '\^\(\[0-9\]\{5\}\|\[0-9\]\{4\}-\[0-9\]\{3\}\)\?\$'\) NOT VALID/],
    ['signalements_qr_coproprietes', 'signalements_qr_copros_champs_longueurs', /cardinality\(batiments\) <= 50\) NOT VALID/],
    ['signalements_qr_coproprietes', 'signalements_qr_copros_immatriculation_format', /CHECK \(immatriculation IS NULL OR immatriculation ~ '\^\[A-Z0-9\]\{1,20\}\$'\) NOT VALID/],
    ['signalements_qr', 'signalements_qr_statut_modifie_profil_valeurs', /CHECK \(statut_modifie_profil IS NULL OR statut_modifie_profil IN \('super_admin', 'gestionnaire'\)\) NOT VALID/],
    ['signalements_qr', 'signalements_qr_nb_emails_bornes', /CHECK \(nb_emails_envoyes BETWEEN 0 AND 100\) NOT VALID/],
  ])('%s : contrainte %s créée seulement si absente de pg_constraint, NOT VALID puis VALIDATE', (table, nom, definition) => {
    expect(code).toMatch(new RegExp(`conname = '${nom}'\\s+AND conrelid = '${table}'::regclass`))
    expect(code).toMatch(new RegExp(`ADD CONSTRAINT ${nom}\\s`))
    expect(code).toMatch(definition)
    expect(code).toMatch(new RegExp(`ALTER TABLE ${table} VALIDATE CONSTRAINT ${nom};`))
  })

  it('doublons garantis par la base, par cabinet (le groupe « sans cabinet » ramené à l’UUID nul)', () => {
    const zero = "coalesce\\(cabinet_id, '00000000-0000-0000-0000-000000000000'::uuid\\)"
    expect(code).toMatch(new RegExp(`CREATE UNIQUE INDEX IF NOT EXISTS uq_signalements_qr_copros_immatriculation\\s+ON signalements_qr_coproprietes \\(\\(${zero}\\), immatriculation\\)\\s+WHERE immatriculation IS NOT NULL;`))
    expect(code).toMatch(new RegExp(`CREATE UNIQUE INDEX IF NOT EXISTS uq_signalements_qr_copros_reference\\s+ON signalements_qr_coproprietes \\(\\(${zero}\\), reference_cabinet\\)\\s+WHERE reference_cabinet IS NOT NULL;`))
    expect(code).not.toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS \w+\s+ON signalements_qr_coproprietes \([^;]*cle_nom/)
  })

  it('compteurs par copropriété calculés en base (GROUP BY), sans lecture de toutes les lignes', () => {
    const f = fonction('signalements_qr_compteurs')
    expect(f.entete).toMatch(/RETURNS TABLE\(copropriete_id uuid, total bigint, en_attente bigint, ouverts bigint, urgents_ouverts bigint, attente_48h bigint, dernier timestamptz\)/)
    expect(f.entete).toMatch(/LANGUAGE sql STABLE/)
    expect(f.corps).toMatch(/WHERE s\.copropriete_id = ANY\s*\(p_ids\)/)
    expect(f.corps).toMatch(/GROUP BY s\.copropriete_id/)
  })
})

describe(`Migration ${FICHIER} : journal, opérations, budget d’e-mails`, () => {
  it('journal : par cabinet, noms de champs seulement, détails bornés, liste d’actions fermée et nommée', () => {
    const journal = blocTable('signalements_qr_journal')
    expect(journal).toMatch(/id\s+BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY/)
    expect(journal).toMatch(/\n\s*cabinet_id\s+UUID,/)
    expect(journal).toMatch(/champs\s+TEXT\[\] NOT NULL DEFAULT '\{\}'/)
    expect(journal).toMatch(/CHECK \(pg_column_size\(details\) <= 2048\)/)
    expect(journal).toMatch(/CONSTRAINT signalements_qr_journal_action_valeurs CHECK \(action IN \(/)
    expect(journal).toMatch(/CONSTRAINT signalements_qr_journal_acteur_profil_valeurs CHECK \(acteur_profil IN \('super_admin', 'gestionnaire', 'systeme'\)\)/)
  })

  it('opérations : rattachées au cabinet', () => {
    expect(blocTable('signalements_qr_operations')).toMatch(/\n\s*cabinet_id\s+UUID,/)
  })

  it('budget d’e-mails : réservation atomique sous le verrou du cabinet, sommes de la dernière heure', () => {
    const corps = fonction('signalements_qr_reserver_emails').corps
    expect(corps).toMatch(/pg_advisory_xact_lock\(hashtextextended\('signalements_qr_emails:' \|\| coalesce\(v_cab, v_zero\)::text, 0\)\)/)
    expect(corps).toMatch(/interval '1 hour'/)
    expect(corps).toMatch(/v_somme_copro \+ p_nombre <= p_max_copro AND v_somme_cabinet \+ p_nombre <= p_max_cabinet/)
    expect(corps).toMatch(/email_retenu = true/)
    expect(corps).toMatch(/jsonb_build_object\('accorde', true, 'retenus', v_retenus\)/)
    expect(corps).toMatch(/jsonb_build_object\('accorde', false, 'retenus', v_retenus\)/)
  })

  it('budget d’e-mails (relecture 10) : texte exact des deux sommes, de la fenêtre, du dernier envoi, des retenus et des deux issues', () => {
    // La décision n'existe qu'en base (aucune copie TypeScript) : chaque pièce de la règle est contrôlée ici. Un essai sur
    // une vraie base (branche ou base de test) reste à décider avec Frédéric.
    const corps = fonction('signalements_qr_reserver_emails').corps
    const morceaux = [
      // Fenêtre : la dernière heure glissante.
      "v_depuis timestamptz := now() - interval '1 hour';",
      // Cabinet de la copropriété du dépôt.
      'SELECT s.copropriete_id, c.cabinet_id INTO v_copro, v_cab FROM signalements_qr s JOIN signalements_qr_coproprietes c ON c.id = s.copropriete_id WHERE s.id = p_signalement;',
      "PERFORM pg_advisory_xact_lock(hashtextextended('signalements_qr_emails:' || coalesce(v_cab, v_zero)::text, 0));",
      // Somme de la copropriété : messages de l'heure, sans le dépôt en cours.
      'SELECT coalesce(sum(s.nb_emails_envoyes), 0) INTO v_somme_copro FROM signalements_qr s WHERE s.copropriete_id = v_copro AND s.created_at > v_depuis AND s.id <> p_signalement;',
      // Somme du cabinet : toutes ses copropriétés (le groupe « sans cabinet » compte comme un cabinet), même fenêtre.
      'SELECT coalesce(sum(s.nb_emails_envoyes), 0) INTO v_somme_cabinet FROM signalements_qr s JOIN signalements_qr_coproprietes c ON c.id = s.copropriete_id WHERE coalesce(c.cabinet_id, v_zero) = coalesce(v_cab, v_zero) AND s.created_at > v_depuis AND s.id <> p_signalement;',
      // Dernier e-mail parti de la copropriété, puis dépôts retenus depuis (mention de rattrapage, alerte unique).
      'SELECT max(s.created_at) INTO v_dernier_envoi FROM signalements_qr s WHERE s.copropriete_id = v_copro AND s.email_envoye_le IS NOT NULL AND s.id <> p_signalement;',
      'SELECT count(*) INTO v_retenus FROM signalements_qr s WHERE s.copropriete_id = v_copro AND s.email_retenu AND s.id <> p_signalement AND (v_dernier_envoi IS NULL OR s.created_at > v_dernier_envoi);',
      // Accordé (≤ aux DEUX plafonds) : nb_emails_envoyes = p_nombre ; sinon retenu, dépôt gardé.
      'IF v_somme_copro + p_nombre <= p_max_copro AND v_somme_cabinet + p_nombre <= p_max_cabinet THEN UPDATE signalements_qr SET nb_emails_envoyes = p_nombre, email_retenu = false WHERE id = p_signalement;',
      'UPDATE signalements_qr SET nb_emails_envoyes = 0, email_retenu = true WHERE id = p_signalement;',
    ]
    let position = 0
    for (const morceau of morceaux) {
      const m = new RegExp(espaces(morceau)).exec(corps.slice(position))
      expect(m, morceau).not.toBeNull()
      // Dans cet ordre : verrou AVANT les sommes, sommes AVANT la décision.
      position += (m?.index ?? 0) + (m?.[0].length ?? 0)
    }
  })

  it('purge du journal : 12 mois glissants, une ligne journal.purge', () => {
    const corps = fonction('signalements_qr_purger_journal').corps
    expect(corps).toMatch(/DELETE FROM signalements_qr_journal WHERE created_at < now\(\) - interval '12 months'/)
    expect(corps).toContain("'journal.purge'")
  })

  it('verrous par cabinet : hashtextextended (PostgreSQL 11+, la migration du 04/11 exige déjà la 14)', () => {
    expect([...code.matchAll(/pg_advisory_xact_lock\(hashtextextended\(/g)].length).toBeGreaterThanOrEqual(3)
    expect(code).not.toMatch(/pg_advisory_lock\(/)
    expect(code).not.toMatch(/hashtext\(/)
  })
})

describe(`Migration ${FICHIER} : au plus ${ATTRIBUTIONS_MAX_PAR_GESTIONNAIRE_QR} attributions par fiche (essai PGlite du 11/11, D6)`, () => {
  // Le départ exige UNE succession par attribution et la page profil envoie l'ensemble complet : les deux routes en
  // acceptent au plus ATTRIBUTIONS_MAX_PAR_GESTIONNAIRE_QR. Sans borne en base, une fiche à 1 001 attributions (imports
  // successifs) ne pouvait plus partir. La borne est vérifiée, fiches verrouillées, par chaque fonction qui ajoute des
  // attributions à une fiche existante ; attribuer_au_gestionnaire pose l'ensemble complet (≤ 1 000) et
  // inviter_gestionnaire une fiche neuve (≤ 500).
  const borne = (corps: string, fiches: string): RegExpMatchArray | null => corps.match(new RegExp(espaces(
    `IF EXISTS (SELECT 1 FROM signalements_qr_attributions a WHERE a.gestionnaire_id = ANY (${fiches}) GROUP BY a.gestionnaire_id HAVING count(*) > ${ATTRIBUTIONS_MAX_PAR_GESTIONNAIRE_QR}) THEN RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';`,
  )))

  it.each([
    ['signalements_qr_creer_coproprietes', 'v_fiches'],
    ['signalements_qr_remplacer_attributions', 'v_nouveaux'],
    ['signalements_qr_desactiver_gestionnaire', 'v_successeurs'],
  ])('%s : borne vérifiée après les insertions, sur les fiches verrouillées (%s)', (nom, fiches) => {
    const corps = fonction(nom).corps
    const m = borne(corps, fiches)
    expect(m).not.toBeNull()
    expect(m?.index ?? -1).toBeGreaterThan(corps.indexOf('INSERT INTO signalements_qr_attributions'))
  })

  it('une seule borne dans le fichier, égale à celle des routes (page profil, départ)', () => {
    expect(new Set([...code.matchAll(/HAVING count\(\*\) > (\d+)/g)].map((m) => Number(m[1])))).toEqual(new Set([ATTRIBUTIONS_MAX_PAR_GESTIONNAIRE_QR]))
    expect(code).toMatch(new RegExp(`cardinality\\(v_cibles\\) > ${ATTRIBUTIONS_MAX_PAR_GESTIONNAIRE_QR}`))
    const ids = Array.from({ length: ATTRIBUTIONS_MAX_PAR_GESTIONNAIRE_QR + 1 }, (_, i) => `c0000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    const successions = ids.map((coproprieteId) => ({ coproprieteId, versGestionnaireId: null }))
    expect(departGestionnaireQrSchema.safeParse({ successions: successions.slice(0, -1) }).success).toBe(true)
    expect(departGestionnaireQrSchema.safeParse({ successions }).success).toBe(false)
    expect(attributionsGestionnaireQrSchema.safeParse({ coproprieteIds: ids.slice(0, -1) }).success).toBe(true)
    expect(attributionsGestionnaireQrSchema.safeParse({ coproprieteIds: ids }).success).toBe(false)
  })
})

describe(`Migration ${FICHIER} : ordre unique des verrous de ligne (essai PGlite du 11/11, D7)`, () => {
  // Fiches avant copropriétés, chacune par identifiant croissant, dans toutes les fonctions qui écrivent les deux : un
  // remplacement (copropriété puis fiche) et une page profil ou un départ (fiche puis copropriété) ne se bloquent plus
  // mutuellement (40P01). Une fiche contrôlée active l'est SOUS verrou : un départ concurrent ne la désactive qu'après.
  const position = (corps: string, motif: string): number => {
    const m = new RegExp(espaces(motif)).exec(corps)
    expect(m, motif).not.toBeNull()
    return m?.index ?? -1
  }

  it('création : verrou du cabinet, puis fiches des lignes, puis copropriétés à compléter, AVANT la boucle des lignes ; fiche de l’auteur revérifiée', () => {
    const corps = fonction('signalements_qr_creer_coproprietes').corps
    const cabinet = position(corps, "PERFORM pg_advisory_xact_lock(hashtextextended('signalements_qr_creation:' || v_cab::text, 0));")
    const fiches = position(corps, 'PERFORM 1 FROM signalements_qr_gestionnaires g WHERE g.id = ANY (v_fiches) ORDER BY g.id FOR NO KEY UPDATE;')
    const copros = position(corps, 'PERFORM 1 FROM signalements_qr_coproprietes c WHERE c.id = ANY (v_a_completer) ORDER BY c.id FOR NO KEY UPDATE;')
    const revue = position(corps, "IF p_profil = 'gestionnaire' AND NOT EXISTS (SELECT 1 FROM signalements_qr_gestionnaires g WHERE g.id = p_gestionnaire AND g.actif AND g.cabinet_id = p_cabinet) THEN RAISE EXCEPTION 'interdit'")
    const boucle = corps.indexOf('FOR v_l IN')
    expect([cabinet < fiches, fiches < copros, copros < revue, revue < boucle]).toEqual([true, true, true, true])
    expect(corps).toMatch(/v_fiches := ARRAY\(SELECT DISTINCT x\.val::uuid/)
  })

  it('remplacement des attributions : fiches de la liste (par id) AVANT la copropriété', () => {
    const corps = fonction('signalements_qr_remplacer_attributions').corps
    const fiches = position(corps, 'PERFORM 1 FROM signalements_qr_gestionnaires g WHERE g.id = ANY (v_nouveaux) ORDER BY g.id FOR NO KEY UPDATE;')
    const copro = position(corps, 'FROM signalements_qr_coproprietes c WHERE c.id = p_copropriete FOR UPDATE;')
    const controle = position(corps, 'WHERE g.id = t.x AND g.actif AND g.cabinet_id = v_cab')
    expect([fiches < copro, copro < controle]).toEqual([true, true])
  })

  it('page profil : la fiche (FOR UPDATE), puis ses copropriétés anciennes et nouvelles (par id), AVANT toute écriture', () => {
    const corps = fonction('signalements_qr_attribuer_au_gestionnaire').corps
    const fiche = position(corps, 'FROM signalements_qr_gestionnaires g WHERE g.id = p_gestionnaire FOR UPDATE;')
    const copros = position(corps, 'PERFORM 1 FROM signalements_qr_coproprietes c WHERE c.id = ANY (v_cibles) OR c.id IN (SELECT a.copropriete_id FROM signalements_qr_attributions a WHERE a.gestionnaire_id = p_gestionnaire) ORDER BY c.id FOR NO KEY UPDATE;')
    expect([fiche < copros, copros < corps.indexOf('INSERT INTO signalements_qr_attributions')]).toEqual([true, true])
  })

  it('départ : la fiche et ses successeurs par id (une seule boucle), puis les copropriétés par id ; attributions relues SOUS ces verrous', () => {
    const corps = fonction('signalements_qr_desactiver_gestionnaire').corps
    const boucle = position(corps, "FOR v_f IN SELECT t.x FROM (SELECT p_id AS x UNION SELECT nullif(e.val->>'versGestionnaireId', '')::uuid FROM jsonb_array_elements(v_succ) AS e(val)) AS t WHERE t.x IS NOT NULL ORDER BY t.x LOOP")
    const copros = position(corps, 'PERFORM 1 FROM signalements_qr_coproprietes c WHERE c.id IN (SELECT a.copropriete_id FROM signalements_qr_attributions a WHERE a.gestionnaire_id = p_id) OR (v_email IS NOT NULL AND v_email = ANY (c.emails_destinataires)) ORDER BY c.id FOR NO KEY UPDATE;')
    const attr = position(corps, 'v_attr := ARRAY(SELECT a.copropriete_id FROM signalements_qr_attributions a WHERE a.gestionnaire_id = p_id);')
    expect([boucle < copros, copros < attr]).toEqual([true, true])
    expect([...corps.matchAll(/FROM signalements_qr_gestionnaires g WHERE g\.id = p_id FOR UPDATE/g)]).toHaveLength(1)
  })

  it.each(['signalements_qr_confirmer_adresse', 'signalements_qr_contester_adresse'])('%s : la fiche AVANT l’envoi (même ordre que le départ, qui efface ses jetons)', (nom) => {
    const corps = fonction(nom).corps
    const fiche = position(corps, 'PERFORM 1 FROM signalements_qr_gestionnaires g WHERE g.id = (SELECT i.gestionnaire_id FROM signalements_qr_invitations i WHERE i.id = p_invitation) FOR NO KEY UPDATE;')
    expect(fiche).toBeLessThan(corps.indexOf('UPDATE signalements_qr_invitations i SET'))
  })
})
