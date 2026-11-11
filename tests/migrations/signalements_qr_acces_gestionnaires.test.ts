// tests/migrations/signalements_qr_acces_gestionnaires.test.ts
//
// Migration 20261112_signalements_qr_acces_gestionnaires.sql (AJ Signalement, PR 2 : accès de chaque gestionnaire à
// l'espace de SON cabinet, vitfix.io/<identifiant>/suivi/). Additive et rejouable, appliquée APRÈS la 20261111 : 4
// colonnes sur la fiche (compte relié, dates d'accès, de blocage, de demande d'effacement), FK vers auth.users en
// NOT VALID puis VALIDATE, index unique « un compte = une fiche », envoi d'un accès en une transaction, trigger de
// liaison du compte à l'acceptation, corps de signalements_qr_emails_gestionnaires remplacé (acces_ouvert réel, même
// signature, mêmes exclusions). Aucune table nouvelle (les domaines sont en PR 1), aucune donnée, aucune valeur de
// client (dépôt public). Le texte SQL est contrôlé ici : aucune base PostgreSQL ne le rejoue en local ni en CI.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { MIGRATION_ACCES_QR, MIGRATION_GESTIONNAIRES_QR } from '@/lib/aj-signalement/serveur'

const DOSSIER = join(process.cwd(), 'supabase/migrations')
const FICHIER = '20261112_signalements_qr_acces_gestionnaires.sql'
const CHEMIN = join(DOSSIER, FICHIER)
const sql = existsSync(CHEMIN) ? readFileSync(CHEMIN, 'utf-8') : ''
const sansCommentaires = (texte: string) => texte.replace(/--[^\n]*/g, '')
const code = sansCommentaires(sql)
/** Ce qui s'exécute une seule fois, à l'application : le SQL sans le corps des fonctions (balise $fn$). */
const horsFonctions = code.replace(/\$fn\$[\s\S]*?\$fn\$/g, '$fn$ $fn$')
const code1111 = sansCommentaires(readFileSync(join(DOSSIER, '20261111_signalements_qr_gestionnaires.sql'), 'utf-8'))

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const espaces = (s: string) => echapper(s).replace(/\s+/g, '\\s+')
const trie = (valeurs: Iterable<string>) => [...valeurs].sort((a, b) => a.localeCompare(b))
const compacter = (s: string) => s.replace(/\s+/g, ' ').trim()

interface FonctionSql { nom: string; types: string; entete: string; corps: string }

function fonctionsDefinies(texte: string): FonctionSql[] {
  const motif = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(\w+)\s*\(([^)]*)\)([\s\S]*?)\bAS\s+\$fn\$([\s\S]*?)\$fn\$/gi
  return [...texte.matchAll(motif)].map((m) => ({
    nom: m[1],
    types: m[2].split(',').map((p) => p.trim()).filter(Boolean).map((p) => p.split(/\s+/).slice(1).join(' ').toLowerCase()).join(', '),
    entete: m[3],
    corps: m[4],
  }))
}
const FONCTIONS = fonctionsDefinies(code)
const fonction = (nom: string, liste: FonctionSql[] = FONCTIONS): FonctionSql => {
  const trouvee = liste.find((f) => f.nom === nom)
  if (!trouvee) throw new Error(`fonction ${nom} absente`)
  return trouvee
}

/** Fonctions appelées par les routes (clé service), avec la signature exacte de leurs arguments. */
const RPC: Record<string, string> = {
  signalements_qr_envoyer_acces: 'uuid, jsonb, uuid',
  signalements_qr_emails_gestionnaires: 'uuid',
}
const FONCTIONS_TRIGGER = ['signalements_qr_lier_gestionnaire']
const COLONNES = [
  ['user_id', 'UUID'], ['acces_ouvert_le', 'TIMESTAMPTZ'], ['connexion_bloquee_le', 'TIMESTAMPTZ'], ['effacement_demande_le', 'TIMESTAMPTZ'],
] as const

describe(`Migration ${FICHIER} : fichier et ordre`, () => {
  it('existe, et MIGRATION_ACCES_QR (repli des routes) le désigne', () => {
    expect(existsSync(CHEMIN)).toBe(true)
    expect(MIGRATION_ACCES_QR).toBe(`supabase/migrations/${FICHIER}`)
  })

  it('passe après la migration des gestionnaires (20261111), qu’elle complète', () => {
    const fichiers = readdirSync(DOSSIER).sort((a, b) => a.localeCompare(b))
    expect(fichiers.indexOf(FICHIER)).toBeGreaterThan(fichiers.indexOf(MIGRATION_GESTIONNAIRES_QR.replace('supabase/migrations/', '')))
    expect(sql).toMatch(/APRÈS 20261111_signalements_qr_gestionnaires\.sql/)
  })

  it('se termine par la relecture du schéma par PostgREST', () => {
    expect(code).toMatch(/NOTIFY pgrst, 'reload schema';\s*$/)
  })
})

describe(`Migration ${FICHIER} : rejouable, additive, sans donnée`, () => {
  it.each(COLONNES)('colonne %s %s ajoutée à la fiche, IF NOT EXISTS, sans valeur par défaut', (colonne, type) => {
    expect(code).toMatch(new RegExp(`ALTER TABLE signalements_qr_gestionnaires ADD COLUMN IF NOT EXISTS ${colonne} ${type};`))
  })

  it('ces 4 colonnes seulement, aucune autre table modifiée par ALTER TABLE (hors contrainte de la fiche)', () => {
    const ajoutees = [...code.matchAll(/ADD COLUMN IF NOT EXISTS (\w+)/g)].map((m) => m[1])
    expect(trie(ajoutees)).toEqual(trie(COLONNES.map(([c]) => c)))
    const tables = new Set([...code.matchAll(/ALTER TABLE (\w+)/g)].map((m) => m[1]))
    expect([...tables]).toEqual(['signalements_qr_gestionnaires'])
  })

  it('IF NOT EXISTS sur chaque index et colonne ; OR REPLACE sur chaque fonction et trigger ; aucun DROP', () => {
    expect([...code.matchAll(/CREATE (?:UNIQUE )?INDEX (?!IF NOT EXISTS)/g)]).toHaveLength(0)
    expect([...code.matchAll(/ADD COLUMN (?!IF NOT EXISTS)/g)]).toHaveLength(0)
    expect([...code.matchAll(/CREATE (?!OR REPLACE )FUNCTION/g)]).toHaveLength(0)
    expect([...code.matchAll(/CREATE (?!OR REPLACE )TRIGGER/g)]).toHaveLength(0)
    expect(code).not.toMatch(/\bDROP\b/i)
  })

  it('aucune table nouvelle (les domaines et les envois existent depuis la 20261111), aucune vue, aucune politique', () => {
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i)
    expect(code).not.toMatch(/\bCREATE\s+(OR\s+REPLACE\s+)?VIEW\b/i)
    expect(code).not.toMatch(/\bCREATE\s+POLICY\b/i)
  })

  it('aucune contrainte CHECK ajoutée ni remplacée : les actions et refus de la PR 2 sont déjà dans la 20261111', () => {
    expect(code).not.toMatch(/\bCHECK\s*\(/i)
    expect(code).not.toMatch(/signalements_qr_journal_action_valeurs/)
    for (const action of ['gestionnaire.acces_envoye', 'gestionnaire.acces_ouvert', 'gestionnaire.refus_autre_espace', 'gestionnaire.connexion_bloquee', 'gestionnaire.effacement_demande']) {
      expect(code1111).toContain(`'${action}'`)
    }
    expect(code1111).toMatch(/objet\s+TEXT NOT NULL CHECK \(objet IN \('confirmation_adresse', 'acces'\)\)/)
    expect(code1111).toMatch(/refus IN \('compte_autre_espace', 'pas_moi'\)/)
  })

  it('aucune écriture de données à l’application (hors corps des fonctions)', () => {
    expect(horsFonctions).not.toMatch(/\bINSERT\s+INTO\b/i)
    expect(horsFonctions).not.toMatch(/\bUPDATE\s+[a-z_]+(?:\s+[a-z]+)?\s+SET\b/i)
    expect(horsFonctions).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(horsFonctions).not.toMatch(/\bTRUNCATE\b/i)
    expect(horsFonctions).not.toMatch(/\bCOPY\b/i)
  })

  it('aucune valeur réelle : ni adresse, ni domaine, ni nom de cabinet ou de copropriété', () => {
    expect(sql).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+/i)
    expect(code).not.toMatch(/'[a-z0-9-]+(\.[a-z0-9-]+)*\.(fr|com|pt|io|net|org|eu|test)'/i)
    expect(sql.toLowerCase()).not.toContain('aj' + 'associ')
    expect(sql.toLowerCase()).not.toContain(['aj', 'associ'].join(' '))
    expect(sql).not.toMatch(/Parc Belle Ombre/i)
  })
})

describe(`Migration ${FICHIER} : compte relié à la fiche`, () => {
  it('FK vers auth.users créée seulement si absente de pg_constraint, ON DELETE SET NULL, NOT VALID puis VALIDATE', () => {
    expect(code).toMatch(new RegExp(espaces(
      "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_gestionnaires_user_fk' AND conrelid = 'signalements_qr_gestionnaires'::regclass) THEN",
    )))
    expect(code).toMatch(new RegExp(espaces(
      'ALTER TABLE signalements_qr_gestionnaires ADD CONSTRAINT signalements_qr_gestionnaires_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;',
    )))
    const ajout = code.indexOf('ADD CONSTRAINT signalements_qr_gestionnaires_user_fk')
    const validation = code.search(/ALTER TABLE signalements_qr_gestionnaires VALIDATE CONSTRAINT signalements_qr_gestionnaires_user_fk;/)
    expect(ajout).toBeGreaterThan(0)
    expect(validation).toBeGreaterThan(ajout)
  })

  it('un compte = une fiche : index unique partiel sur user_id', () => {
    expect(code).toMatch(new RegExp(espaces(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_signalements_qr_gestionnaires_user ON signalements_qr_gestionnaires (user_id) WHERE user_id IS NOT NULL;',
    )))
  })

  it('pas de CHECK « accès ouvert ⇒ compte » (l’effacement du compte met user_id à NULL par la FK)', () => {
    expect(code).not.toMatch(/acces_ouvert_le IS NULL OR user_id IS NOT NULL/i)
  })
})

describe(`Migration ${FICHIER} : fonctions et droits (clé service seulement)`, () => {
  it('3 fonctions définies : l’envoi d’un accès, les destinataires (corps remplacé) et la fonction du trigger de liaison', () => {
    expect(trie(FONCTIONS.map((f) => f.nom))).toEqual(trie([...Object.keys(RPC), ...FONCTIONS_TRIGGER]))
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

  it('toutes les fonctions : SECURITY INVOKER et search_path figé, quotation $fn$ ; aucune SECURITY DEFINER', () => {
    for (const f of FONCTIONS) expect(f.entete, f.nom).toMatch(/SECURITY INVOKER SET search_path = public, pg_temp/)
    expect(code).not.toMatch(/SECURITY\s+DEFINER/i)
  })

  it('aucune autre erreur levée que P0001 (métier) et 22023 (paramètre invalide)', () => {
    const codes = new Set([...code.matchAll(/RAISE EXCEPTION '[a-z_]+' USING ERRCODE = '([0-9A-Z]{5})'/g)].map((m) => m[1]))
    expect(trie(codes)).toEqual(['22023', 'P0001'])
    expect([...code.matchAll(/RAISE EXCEPTION/g)].length).toBe([...code.matchAll(/RAISE EXCEPTION '[a-z_]+' USING ERRCODE = '[0-9A-Z]{5}'/g)].length)
  })
})

describe(`Migration ${FICHIER} : envoi d’un accès (signalements_qr_envoyer_acces)`, () => {
  const corps = () => fonction('signalements_qr_envoyer_acces').corps

  it('paramètres vérifiés, fiche VERROUILLÉE puis relue : active, non pseudonymisée, même adresse que celle signée', () => {
    expect(corps()).toMatch(/RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023'/)
    expect(corps()).toMatch(/FROM signalements_qr_gestionnaires g WHERE g\.id = p_gestionnaire FOR UPDATE/)
    expect(corps()).toMatch(new RegExp(espaces(
      "IF NOT FOUND OR NOT v_g.actif OR v_g.pseudonymise_le IS NOT NULL OR v_g.email IS NULL OR p_invitation->>'email' IS DISTINCT FROM v_g.email THEN RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';",
    )))
  })

  it('adresse contestée → adresse_contestee ; compte déjà relié → deja_ouvert (« Mot de passe oublié »)', () => {
    expect(corps()).toMatch(new RegExp(espaces("IF v_g.adresse_contestee_le IS NOT NULL THEN RAISE EXCEPTION 'adresse_contestee' USING ERRCODE = 'P0001';")))
    expect(corps()).toMatch(new RegExp(espaces("IF v_g.user_id IS NOT NULL THEN RAISE EXCEPTION 'deja_ouvert' USING ERRCODE = 'P0001';")))
  })

  it('un nouvel envoi invalide les envois d’accès en attente, puis insère l’envoi signé (objet acces, adresse de la fiche)', () => {
    const invalidation = corps().search(new RegExp(espaces(
      "UPDATE signalements_qr_invitations SET invite_token = NULL WHERE gestionnaire_id = p_gestionnaire AND objet = 'acces' AND accepted_at IS NULL AND invite_token IS NOT NULL;",
    )))
    const insertion = corps().search(new RegExp(espaces(
      "INSERT INTO signalements_qr_invitations (id, gestionnaire_id, objet, email, full_name, invite_token, envoye_par) VALUES (v_inv, p_gestionnaire, 'acces', v_g.email, v_g.nom, p_invitation->>'invite_token', p_acteur);",
    )))
    expect(invalidation).toBeGreaterThan(0)
    expect(insertion).toBeGreaterThan(invalidation)
  })

  it('ni journal ni rôle écrits ici (journal par la route après l’e-mail ; le rôle n’est jamais lu dans la ligne)', () => {
    expect(corps()).not.toMatch(/signalements_qr_journal/)
    expect(corps()).not.toMatch(/\brole\b/)
  })
})

describe(`Migration ${FICHIER} : liaison du compte à l’acceptation (trigger)`, () => {
  const corps = () => fonction('signalements_qr_lier_gestionnaire').corps

  it('trigger AFTER UPDATE OF user_id sur les envois, une ligne à la fois', () => {
    expect(code).toMatch(new RegExp(espaces(
      'CREATE OR REPLACE TRIGGER trg_signalements_qr_invitations_liaison AFTER UPDATE OF user_id ON signalements_qr_invitations FOR EACH ROW EXECUTE FUNCTION signalements_qr_lier_gestionnaire();',
    )))
  })

  it('gardes : envoi « acces » accepté avec un compte nouveau ; compte relié à aucune autre fiche', () => {
    expect(corps()).toMatch(new RegExp(espaces(
      "IF NEW.objet <> 'acces' OR NEW.user_id IS NULL OR NEW.accepted_at IS NULL OR NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN RETURN NEW;",
    )))
    expect(corps()).toMatch(new RegExp(espaces(
      'IF EXISTS (SELECT 1 FROM signalements_qr_gestionnaires g WHERE g.user_id = NEW.user_id AND g.id <> NEW.gestionnaire_id) THEN RETURN NEW;',
    )))
  })

  it('fiche reliée seulement si active, non pseudonymisée, non contestée, à la même adresse, sans autre compte', () => {
    expect(corps()).toMatch(new RegExp(espaces(
      'WHERE g.id = NEW.gestionnaire_id AND g.actif AND g.pseudonymise_le IS NULL AND g.adresse_contestee_le IS NULL AND g.email = NEW.email AND (g.user_id IS NULL OR g.user_id = NEW.user_id)',
    )))
    expect(corps()).toMatch(/acces_ouvert_le\s+= coalesce\(g\.acces_ouvert_le, NEW\.accepted_at\)/)
    expect(corps()).toMatch(/adresse_confirmee_le = coalesce\(g\.adresse_confirmee_le, NEW\.accepted_at\)/)
  })

  it('liaison faite : autres envois en attente invalidés, journal gestionnaire.acces_ouvert (acteur : le gestionnaire)', () => {
    expect(corps()).toMatch(new RegExp(espaces(
      'UPDATE signalements_qr_invitations SET invite_token = NULL WHERE gestionnaire_id = NEW.gestionnaire_id AND id <> NEW.id AND accepted_at IS NULL AND invite_token IS NOT NULL;',
    )))
    expect(corps()).toMatch(new RegExp(espaces(
      "VALUES (v_cab, NEW.user_id, 'gestionnaire', NEW.gestionnaire_id, 'gestionnaire.acces_ouvert', NEW.gestionnaire_id);",
    )))
  })
})

describe(`Migration ${FICHIER} : destinataires (signalements_qr_emails_gestionnaires, corps remplacé)`, () => {
  const nouvelle = () => fonction('signalements_qr_emails_gestionnaires')
  const ancienne = () => fonction('signalements_qr_emails_gestionnaires', fonctionsDefinies(code1111))
  const ACCES_REEL = '(g.user_id IS NOT NULL AND g.acces_ouvert_le IS NOT NULL AND g.connexion_bloquee_le IS NULL) AS acces_ouvert'

  it('même signature et même en-tête que la 20261111 (CREATE OR REPLACE ne change pas un type de retour)', () => {
    expect(nouvelle().types).toBe(ancienne().types)
    expect(compacter(nouvelle().entete)).toBe(compacter(ancienne().entete))
    expect(nouvelle().entete).toMatch(/RETURNS TABLE\(gestionnaire_id uuid, email text, acces_ouvert boolean, exclu boolean\)/)
  })

  it('acces_ouvert réel : compte relié, accès ouvert, connexion non bloquée', () => {
    expect(nouvelle().corps).toContain(ACCES_REEL)
    expect(nouvelle().corps).not.toMatch(/false AS acces_ouvert/)
  })

  it('le reste du corps est celui de la 20261111 : même cabinet, adresse confirmée non contestée, exclusions, limite', () => {
    const attendu = compacter(ancienne().corps).replace('false AS acces_ouvert', compacter(ACCES_REEL))
    expect(compacter(nouvelle().corps)).toBe(attendu)
    expect(nouvelle().corps).toMatch(/g\.cabinet_id = c\.cabinet_id/)
    expect(nouvelle().corps).toMatch(/g\.email = ANY \(c\.emails_destinataires\)/)
    expect(nouvelle().corps).toMatch(/NOT g\.actif OR g\.adresse_contestee_le IS NOT NULL/)
    expect(nouvelle().corps).toMatch(/ORDER BY t\.exclu DESC, t\.gestionnaire_id\s+LIMIT 100/)
  })
})
