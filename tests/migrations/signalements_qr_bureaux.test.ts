// tests/migrations/signalements_qr_bureaux.test.ts
//
// Migration 20261119_signalements_qr_bureaux.sql (AJ Signalement, bureaux des cabinets clients, PR 1 sans écran ;
// accord du 17/11/2026 sur les cinq choix de la note des bureaux). Le TEXTE SQL est contrôlé ici : additive, rejouable,
// sans politique RLS, droits à service_role seul, journal par des actions EXISTANTES (liste fermée non touchée), aucune
// valeur de client (dépôt public), et surtout la fonction redéfinie : signalements_qr_inviter_gestionnaire part du texte
// de sa DERNIÈRE définition (20261112) et n'en diffère que par le bureau (plan, risque § 8.2). Le script de retour
// arrière est contrôlé aussi (hors de supabase/migrations, texte de la 20261112 remis à l'identique). Les règles
// elles-mêmes sont exécutées sur un vrai PostgreSQL par signalements_qr_bureaux.execution.test.ts (PGlite).

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const DOSSIER = join(process.cwd(), 'supabase/migrations')
const FICHIER = '20261119_signalements_qr_bureaux.sql'
const CHEMIN = join(DOSSIER, FICHIER)
const CHEMIN_RETOUR = join(process.cwd(), 'supabase/retours-arriere/20261119_signalements_qr_bureaux.retour.sql')

const lire = (chemin: string) => (existsSync(chemin) ? readFileSync(chemin, 'utf-8').replace(/\r\n/g, '\n') : '')
const sansCommentaires = (texte: string) => texte.replace(/--[^\n]*/g, '')
const sql = lire(CHEMIN)
const code = sansCommentaires(sql)
/** Ce qui s'exécute une seule fois, à l'application : le SQL sans le corps des fonctions (balise $fn$). */
const horsFonctions = code.replace(/\$fn\$[\s\S]*?\$fn\$/g, '$fn$ $fn$')
const entete = sql.slice(0, Math.max(0, sql.indexOf('-- ── 1.')))
/** L'en-tête en texte suivi : les lignes de commentaire mises bout à bout. */
const enteteSuivi = entete.replace(/\n--[ \t]*/g, ' ')
const sql1112 = lire(join(DOSSIER, '20261112_signalements_qr_acces_gestionnaires.sql'))
const code1112 = sansCommentaires(sql1112)
const retour = lire(CHEMIN_RETOUR)
const codeRetour = sansCommentaires(retour)

const trie = (valeurs: Iterable<string>) => [...valeurs].sort((a, b) => a.localeCompare(b))
const compacter = (s: string) => s.replace(/\s+/g, ' ').trim()

interface FonctionSql { nom: string; types: string; entete: string; corps: string; texte: string }

function fonctionsDefinies(texte: string): FonctionSql[] {
  const motif = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(\w+)\s*\(([^)]*)\)([\s\S]*?)\bAS\s+\$fn\$([\s\S]*?)\$fn\$/gi
  return [...texte.matchAll(motif)].map((m) => ({
    nom: m[1],
    types: m[2].split(',').map((p) => p.trim()).filter(Boolean).map((p) => p.split(/\s+/).slice(1).join(' ').toLowerCase()).join(', '),
    entete: m[3],
    corps: m[4],
    texte: m[0],
  }))
}
const FONCTIONS = fonctionsDefinies(code)
const fonction = (nom: string, liste: FonctionSql[] = FONCTIONS): FonctionSql => {
  const trouvee = liste.find((f) => f.nom === nom)
  if (!trouvee) throw new Error(`fonction ${nom} absente`)
  return trouvee
}

/** Fonctions appelées par les routes, avec la signature exacte de leurs arguments. */
const RPC: Record<string, string> = {
  signalements_qr_enregistrer_bureau: 'uuid, uuid, text, uuid',
  signalements_qr_fermer_bureau: 'uuid, boolean, uuid',
  signalements_qr_inviter_gestionnaire: 'jsonb, jsonb, uuid[], uuid',
}
const FONCTIONS_TRIGGER = ['signalements_qr_bureau_du_gestionnaire', 'signalements_qr_bureau_de_la_copropriete']
/** Messages P0001 levés (codes publics 409 des routes) ; ceux de la fonction reprise de la 20261112 compris. */
const ERREURS_NOUVELLES = ['nom_pris', 'plafond_bureaux', 'bureau_utilise', 'bureau_requis', 'bureau_ferme']

describe(`Migration ${FICHIER} : fichier et ordre`, () => {
  it('existe et passe après toutes les migrations d’AJ Signalement (la 20261112 qu’elle reprend, la 20261113, la 20261114)', () => {
    expect(existsSync(CHEMIN)).toBe(true)
    const fichiers = readdirSync(DOSSIER).sort((a, b) => a.localeCompare(b))
    for (const avant of ['20261112_signalements_qr_acces_gestionnaires.sql', '20261113_signalements_qr_diffusion.sql', '20261114_signalements_qr_logo_cabinet.sql']) {
      expect(fichiers.indexOf(FICHIER), avant).toBeGreaterThan(fichiers.indexOf(avant))
    }
  })

  it('l’en-tête dit quand l’appliquer, et prévient du rejeu de la 20261112', () => {
    expect(entete.length).toBeGreaterThan(0)
    expect(enteteSuivi).toMatch(/APRÈS 20261112_signalements_qr_acces_gestionnaires\.sql/)
    expect(enteteSuivi).toMatch(/avant ou après la 20261113 et la 20261114/)
    expect(enteteSuivi).toMatch(/seulement après la fusion/)
    expect(enteteSuivi).toMatch(/La 20261112 rejouée APRÈS celle-ci remet son corps de signalements_qr_inviter_gestionnaire/)
    expect(enteteSuivi).toMatch(/rejouer ensuite celle-ci/)
  })

  it('l’en-tête dit les cinq choix, les réponses proposées appliquées, l’option A du journal et où est le retour arrière', () => {
    for (const choix of ['(1)', '(2)', '(3)', '(4)', '(5)']) expect(enteteSuivi).toContain(choix)
    expect(enteteSuivi).toMatch(/à valider/)
    expect(enteteSuivi).toMatch(/option A/)
    expect(enteteSuivi).toMatch(/cabinet\.modifie, champs \{bureaux\}/)
    expect(enteteSuivi).toContain('supabase/retours-arriere/20261119_signalements_qr_bureaux.retour.sql')
  })

  it('en-tête : chaque message P0001 levé y est cité ; codes levés : P0001 et 22023 seulement', () => {
    const leves = new Set([...code.matchAll(/RAISE EXCEPTION '([a-z_]+)' USING ERRCODE = 'P0001'/g)].map((m) => m[1]))
    expect(trie(leves)).toEqual(trie([
      ...ERREURS_NOUVELLES, 'a_reverifier',
      // Reprises de la 20261112 (corps de signalements_qr_inviter_gestionnaire).
      'domaine_autre_cabinet', 'hors_domaine', 'existe_deja',
    ]))
    for (const m of [...ERREURS_NOUVELLES, 'a_reverifier']) expect(entete, m).toMatch(new RegExp(`\\b${m}\\b`))
    const codes = new Set([...code.matchAll(/RAISE EXCEPTION '[a-z_]+' USING ERRCODE = '([0-9A-Z]{5})'/g)].map((m) => m[1]))
    expect(trie(codes)).toEqual(['22023', 'P0001'])
  })

  it('se termine par la relecture du schéma par PostgREST', () => {
    expect(code).toMatch(/NOTIFY pgrst, 'reload schema';\s*$/)
  })
})

describe('Table des bureaux, colonnes et contraintes', () => {
  it('table signalements_qr_bureaux : id, cabinet (RESTRICT), nom, fermeture datée, auteur, dates ; AUCUNE adresse de contact (choix 4)', () => {
    const m = /CREATE TABLE IF NOT EXISTS signalements_qr_bureaux \(([\s\S]*?)\n\);/.exec(code)
    const corps = m?.[1] ?? ''
    expect(corps).toMatch(/id\s+UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/)
    expect(corps).toMatch(/cabinet_id\s+UUID NOT NULL REFERENCES signalements_qr_cabinets\(id\) ON DELETE RESTRICT/)
    expect(corps).toMatch(/nom\s+TEXT NOT NULL/)
    expect(corps).toMatch(/ferme_le\s+TIMESTAMPTZ,/)
    expect(corps).toMatch(/cree_par\s+UUID NOT NULL/)
    expect(corps).toMatch(/created_at\s+TIMESTAMPTZ NOT NULL DEFAULT now\(\)/)
    expect(corps).toMatch(/updated_at\s+TIMESTAMPTZ NOT NULL DEFAULT now\(\)/)
    expect(corps).toMatch(/CONSTRAINT signalements_qr_bureaux_id_cabinet_unique UNIQUE \(id, cabinet_id\)/)
    expect(corps).toMatch(/CHECK \(nom = btrim\(nom\) AND char_length\(nom\) BETWEEN 1 AND 80 AND nom !~ '\[\[:cntrl:\]\]'\)/)
    expect(corps).not.toMatch(/email|contact|adresse/i)
  })

  it('nom unique dans le cabinet, à la casse et aux espaces près (index unique, fermés compris)', () => {
    expect(code).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_signalements_qr_bureaux_nom\s+ON signalements_qr_bureaux \(cabinet_id, lower\(btrim\(nom\)\)\);/)
  })

  it('colonne bureau_id sur la fiche et sur la copropriété seulement, sans défaut (fiches existantes : vide)', () => {
    const ajouts = [...code.matchAll(/ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS (\w+) (\w+);/g)].map((m) => `${m[1]}.${m[2]} ${m[3]}`)
    expect(trie(ajouts)).toEqual(['signalements_qr_coproprietes.bureau_id UUID', 'signalements_qr_gestionnaires.bureau_id UUID'])
  })

  it.each([
    ['signalements_qr_gestionnaires', 'signalements_qr_gestionnaires_bureau_fk'],
    ['signalements_qr_coproprietes', 'signalements_qr_copros_bureau_fk'],
  ])('%s : clé étrangère composée (bureau_id, cabinet_id), créée si absente, NOT VALID puis VALIDATE', (table, nom) => {
    expect(code).toMatch(new RegExp(`IF NOT EXISTS \\(SELECT 1 FROM pg_constraint WHERE conname = '${nom}'\\s+AND conrelid = '${table}'::regclass\\)`))
    expect(code).toMatch(new RegExp(`ALTER TABLE ${table} ADD CONSTRAINT ${nom}\\s+FOREIGN KEY \\(bureau_id, cabinet_id\\) REFERENCES signalements_qr_bureaux \\(id, cabinet_id\\) ON DELETE RESTRICT NOT VALID;`))
    expect(code).toMatch(new RegExp(`ALTER TABLE ${table} VALIDATE CONSTRAINT ${nom};`))
  })

  it('copropriété sans cabinet : jamais de bureau (contrôle nommé, NOT VALID puis VALIDATE)', () => {
    expect(code).toMatch(/ADD CONSTRAINT signalements_qr_copros_bureau_cabinet\s+CHECK \(bureau_id IS NULL OR cabinet_id IS NOT NULL\) NOT VALID;/)
    expect(code).toMatch(/ALTER TABLE signalements_qr_coproprietes VALIDATE CONSTRAINT signalements_qr_copros_bureau_cabinet;/)
  })

  it('index sur bureau_id des deux tables (IF NOT EXISTS)', () => {
    expect(code).toMatch(/CREATE INDEX IF NOT EXISTS idx_signalements_qr_gestionnaires_bureau\s+ON signalements_qr_gestionnaires \(bureau_id\)/)
    expect(code).toMatch(/CREATE INDEX IF NOT EXISTS idx_signalements_qr_copros_bureau\s+ON signalements_qr_coproprietes \(bureau_id\)/)
  })

  it('le rattachement définitif d’une copropriété à son cabinet n’est pas touché', () => {
    expect(code).not.toMatch(/signalements_qr_cabinet_copro_fige/)
  })
})

describe('Fonctions et triggers', () => {
  it('fonctions définies : les trois des routes (signatures exactes) et les deux de trigger ; SECURITY INVOKER, search_path figé', () => {
    expect(trie(FONCTIONS.map((f) => `${f.nom}(${f.types})`))).toEqual(trie([
      ...Object.entries(RPC).map(([nom, types]) => `${nom}(${types})`),
      ...FONCTIONS_TRIGGER.map((nom) => `${nom}()`),
    ]))
    for (const f of FONCTIONS) {
      expect(f.entete, f.nom).toMatch(/LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp/)
      expect(f.entete, f.nom).not.toMatch(/SECURITY DEFINER/)
    }
    for (const nom of FONCTIONS_TRIGGER) expect(fonction(nom).entete).toMatch(/RETURNS trigger/)
  })

  it('triggers : nouvelle fiche, changement de bureau ou réactivation d’une fiche ou d’une copropriété ; updated_at des bureaux', () => {
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER trg_signalements_qr_gestionnaires_bureau\s+BEFORE INSERT OR UPDATE OF bureau_id, actif ON signalements_qr_gestionnaires\s+FOR EACH ROW EXECUTE FUNCTION signalements_qr_bureau_du_gestionnaire\(\);/)
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER trg_signalements_qr_copros_bureau\s+BEFORE INSERT OR UPDATE OF bureau_id, actif ON signalements_qr_coproprietes\s+FOR EACH ROW EXECUTE FUNCTION signalements_qr_bureau_de_la_copropriete\(\);/)
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER trg_signalements_qr_bureaux_updated_at\s+BEFORE UPDATE ON signalements_qr_bureaux FOR EACH ROW EXECUTE FUNCTION set_updated_at\(\);/)
  })

  it('fiche : bureau_requis (nouvelle fiche si un bureau OUVERT existe, ou retrait), bureau_ferme sous verrou du bureau', () => {
    const corps = compacter(fonction('signalements_qr_bureau_du_gestionnaire').corps)
    expect(corps).toContain("IF TG_OP = 'UPDATE' OR EXISTS (SELECT 1 FROM signalements_qr_bureaux b WHERE b.cabinet_id = NEW.cabinet_id AND b.ferme_le IS NULL) THEN RAISE EXCEPTION 'bureau_requis'")
    expect(corps).toContain('SELECT b.ferme_le INTO v_ferme FROM signalements_qr_bureaux b WHERE b.id = NEW.bureau_id FOR SHARE;')
    expect(corps).toContain("RAISE EXCEPTION 'bureau_ferme'")
    expect(corps).not.toMatch(/INSERT|DELETE|UPDATE signalements/)
  })

  it('réactivation (actif faux → vrai, bureau inchangé) : contrôlée comme un rattachement, fiche et copropriété (bureau_ferme)', () => {
    const fiche = compacter(fonction('signalements_qr_bureau_du_gestionnaire').corps)
    expect(fiche).toContain("IF TG_OP = 'UPDATE' AND NEW.bureau_id IS NOT DISTINCT FROM OLD.bureau_id THEN")
    expect(fiche).toContain('IF NEW.bureau_id IS NULL OR NOT NEW.actif OR OLD.actif THEN RETURN NEW; END IF;')
    expect(fiche.indexOf('NOT NEW.actif OR OLD.actif')).toBeLessThan(fiche.indexOf('FOR SHARE'))
    const copro = compacter(fonction('signalements_qr_bureau_de_la_copropriete').corps)
    expect(copro).toContain("(TG_OP = 'UPDATE' AND NEW.bureau_id IS NOT DISTINCT FROM OLD.bureau_id AND (NOT NEW.actif OR OLD.actif))")
    expect(copro.indexOf('NOT NEW.actif OR OLD.actif')).toBeLessThan(copro.indexOf('FOR SHARE'))
  })

  it('copropriété : seul le rattachement à un bureau fermé est refusé (bureau facultatif)', () => {
    const corps = compacter(fonction('signalements_qr_bureau_de_la_copropriete').corps)
    expect(corps).toContain("RAISE EXCEPTION 'bureau_ferme'")
    expect(corps).not.toContain('bureau_requis')
    expect(corps).toContain('FOR SHARE')
  })

  it('journal : action EXISTANTE cabinet.modifie, champs {bureaux}, détails énumération + identifiant, jamais le nom du bureau', () => {
    for (const nom of ['signalements_qr_enregistrer_bureau', 'signalements_qr_fermer_bureau']) {
      const corps = fonction(nom).corps
      const actions = new Set([...corps.matchAll(/'super_admin', '([a-z_.]+)'/g)].map((m) => m[1]))
      expect([...actions], nom).toEqual(['cabinet.modifie'])
      expect(corps, nom).toMatch(/ARRAY\['bureaux'\]/)
      const details = [...corps.matchAll(/jsonb_build_object\('bureau', ([^;]*)\)\);/g)].map((m) => m[1])
      expect(details, nom).toHaveLength(1)
      expect(details[0], nom).toMatch(/'bureauId', (v_id|p_bureau)$/)
      expect(details[0], nom).not.toMatch(/v_nom|p_nom|\bnom\b/)
    }
    expect(fonction('signalements_qr_enregistrer_bureau').corps).toMatch(/CASE WHEN p_bureau IS NULL THEN 'cree' ELSE 'renomme' END/)
    expect(fonction('signalements_qr_fermer_bureau').corps).toMatch(/CASE WHEN p_fermer THEN 'ferme' ELSE 'rouvert' END/)
  })

  it('création et renommage : verrou du cabinet, nom unique (nom_pris), plafond de 100 (plafond_bureaux) sous le verrou', () => {
    const corps = compacter(fonction('signalements_qr_enregistrer_bureau').corps)
    const verrou = corps.indexOf("PERFORM pg_advisory_xact_lock(hashtextextended('signalements_qr_bureaux:' || p_cabinet::text, 0));")
    expect(verrou).toBeGreaterThan(0)
    expect(corps.indexOf("'nom_pris'")).toBeGreaterThan(verrou)
    expect(corps).toContain('>= 100 THEN RAISE EXCEPTION \'plafond_bureaux\'')
    expect(corps.indexOf("'plafond_bureaux'")).toBeGreaterThan(verrou)
    expect(corps).toContain('lower(btrim(b.nom)) = lower(v_nom)')
  })

  it('fermeture : bureau verrouillé AVANT le contrôle des rattachements actifs (bureau_utilise)', () => {
    const corps = compacter(fonction('signalements_qr_fermer_bureau').corps)
    const verrou = corps.indexOf('WHERE b.id = p_bureau FOR UPDATE;')
    expect(verrou).toBeGreaterThan(0)
    expect(corps.indexOf("'bureau_utilise'")).toBeGreaterThan(verrou)
    expect(corps).toContain('g.bureau_id = p_bureau AND g.actif')
    expect(corps).toContain('c.bureau_id = p_bureau AND c.actif')
  })

  it('EXECUTE retiré à PUBLIC, anon et authenticated ; donné à service_role pour les trois fonctions des routes seulement', () => {
    for (const [nom, types] of Object.entries(RPC)) {
      expect(code).toContain(`REVOKE EXECUTE ON FUNCTION ${nom}(${types}) FROM PUBLIC, anon, authenticated;`)
    }
    for (const nom of FONCTIONS_TRIGGER) expect(code).toContain(`REVOKE EXECUTE ON FUNCTION ${nom}() FROM PUBLIC, anon, authenticated;`)
    expect(trie([...code.matchAll(/\bGRANT\b[^;]*;/g)].map((m) => m[0]))).toEqual(trie(
      Object.entries(RPC).map(([nom, types]) => `GRANT  EXECUTE ON FUNCTION ${nom}(${types}) TO service_role;`),
    ))
  })
})

// Risque § 8.2 du plan : réécrire la fonction depuis un mauvais texte (celui de la 20261111) annulerait les corrections
// de la 20261112. Comparaison au texte de la DERNIÈRE définition : seules les lignes du bureau diffèrent.
describe('signalements_qr_inviter_gestionnaire : texte de la 20261112, seules les lignes du bureau diffèrent', () => {
  const nouvelle = () => fonction('signalements_qr_inviter_gestionnaire')
  const ancienne = () => fonction('signalements_qr_inviter_gestionnaire', fonctionsDefinies(code1112))

  it('la 20261112 en est la dernière définition avant celle-ci (aucune autre migration ne la redéfinit)', () => {
    const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.sql') && f < FICHIER).sort((a, b) => a.localeCompare(b))
    const definitions = fichiers.filter((f) => /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+signalements_qr_inviter_gestionnaire\s*\(/.test(sansCommentaires(lire(join(DOSSIER, f)))))
    expect(definitions.at(-1)).toBe('20261112_signalements_qr_acces_gestionnaires.sql')
  })

  it('même signature et même en-tête', () => {
    expect(nouvelle().types).toBe(ancienne().types)
    expect(compacter(nouvelle().entete)).toBe(compacter(ancienne().entete))
  })

  it('corps de la 20261112 ; seuls s’ajoutent la lecture de bureauId et son insertion', () => {
    let attendu = compacter(ancienne().corps)
    const remplacements: Array<[string, string]> = [
      ["v_cab uuid := nullif(p_gestionnaire->>'cabinetId', '')::uuid;",
        "v_cab uuid := nullif(p_gestionnaire->>'cabinetId', '')::uuid; v_bureau uuid := nullif(p_gestionnaire->>'bureauId', '')::uuid;"],
      ['INSERT INTO signalements_qr_gestionnaires (id, cabinet_id, nom, email, domaine_force, cree_par) VALUES (v_id, v_cab, v_nom, v_email, v_force, p_acteur);',
        'INSERT INTO signalements_qr_gestionnaires (id, cabinet_id, bureau_id, nom, email, domaine_force, cree_par) VALUES (v_id, v_cab, v_bureau, v_nom, v_email, v_force, p_acteur);'],
    ]
    for (const [avant, apres] of remplacements) {
      expect(attendu.split(avant).length - 1, avant).toBe(1)
      attendu = attendu.replace(avant, apres)
    }
    expect(compacter(nouvelle().corps)).toBe(attendu)
  })

  it('les verrous et le refus d’une boîte déjà portée (contre-vérification du 12/11) sont toujours là', () => {
    const corps = compacter(nouvelle().corps)
    expect(corps).toContain("PERFORM pg_advisory_xact_lock(hashtext('signalements_qr_domaine:' || split_part(v_email, '@', 2)));")
    expect(corps).toContain("RAISE EXCEPTION 'existe_deja' USING ERRCODE = 'P0001', DETAIL = v_existante::text;")
  })
})

describe('Sûreté de la migration', () => {
  it('RLS activée sur la table nouvelle, aucune politique, aucun droit à anon, authenticated ou PUBLIC', () => {
    expect(code).toContain('ALTER TABLE signalements_qr_bureaux ENABLE ROW LEVEL SECURITY;')
    expect(code).toContain('REVOKE ALL ON signalements_qr_bureaux FROM PUBLIC, anon, authenticated;')
    expect(code).toContain('REVOKE ALL ON signalements_qr_gestionnaires FROM anon, authenticated;')
    expect(code).not.toMatch(/\bPOLICY\b/i)
    expect(code).not.toMatch(/\bTO\s+(anon|authenticated|PUBLIC)\b/i)
  })

  it('journal : la liste fermée des actions n’est ni nommée ni remplacée (option A)', () => {
    expect(code).not.toMatch(/signalements_qr_journal_action_valeurs/)
    expect(code).not.toMatch(/'bureau\.[a-z_]+'/)
  })

  it('IF NOT EXISTS sur chaque table, index et colonne ; OR REPLACE sur chaque fonction et trigger ; aucun DROP', () => {
    expect([...code.matchAll(/CREATE TABLE (?!IF NOT EXISTS)/g)]).toHaveLength(0)
    expect([...code.matchAll(/CREATE (?:UNIQUE )?INDEX (?!IF NOT EXISTS)/g)]).toHaveLength(0)
    expect([...code.matchAll(/ADD COLUMN (?!IF NOT EXISTS)/g)]).toHaveLength(0)
    expect([...code.matchAll(/CREATE (?!OR REPLACE )FUNCTION/g)]).toHaveLength(0)
    expect([...code.matchAll(/CREATE (?!OR REPLACE )TRIGGER/g)]).toHaveLength(0)
    expect(code).not.toMatch(/\bDROP\b/i)
  })

  it('aucune écriture de données à l’application (hors du corps des fonctions)', () => {
    expect(horsFonctions).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|TRUNCATE)\b/i)
  })

  it('aucune fonction propre à PostgreSQL 18 (la production tourne en 17)', () => {
    expect(code).not.toMatch(/\b(uuidv7|uuid_extract_timestamp|casefold|array_sort|array_reverse)\s*\(/i)
    expect(code).not.toMatch(/\bVIRTUAL\b|\bOLD\s+TABLE\b.*RETURNING|RETURNING\s+OLD\b/i)
  })
})

describe('Script de retour arrière', () => {
  it('existe HORS de supabase/migrations (jamais appliqué par la chaîne)', () => {
    expect(existsSync(CHEMIN_RETOUR)).toBe(true)
    expect(readdirSync(DOSSIER).some((f) => f.includes('retour'))).toBe(false)
  })

  it('l’en-tête dit ce qui est perdu, ce qui reste, et le relevé à faire avant (des nombres seulement)', () => {
    const suivi = retour.slice(0, retour.indexOf('-- ── 1.')).replace(/\n--[ \t]*/g, ' ')
    expect(suivi).toMatch(/PAS une migration/)
    expect(suivi).toMatch(/Ce qui est perdu : les bureaux et les rattachements/)
    expect(suivi).toMatch(/les lignes du journal/)
    // Le relevé est dit en phrase (aucune requête en commentaire) ; la requête toute prête est dans la procédure.
    expect(suivi).toMatch(/le nombre de bureaux \(lignes de signalements_qr_bureaux\)/)
    expect(suivi).toMatch(/celui des fiches rattachées \(lignes de signalements_qr_gestionnaires dont bureau_id est renseigné\)/)
    expect(suivi).toMatch(/celui des copropriétés rattachées \(lignes de signalements_qr_coproprietes dont bureau_id est renseigné\)/)
    expect(suivi).toContain('docs/rollback-procedures.md')
    expect(retour.slice(0, retour.indexOf('-- ── 1.'))).not.toMatch(/^--\s*(SELECT|\(SELECT)\b/im)
    const procedure = lire(join(process.cwd(), 'docs/rollback-procedures.md'))
    const section = procedure.slice(procedure.indexOf('## Migration 20261119'))
    expect(section).toContain('SELECT (SELECT count(*) FROM signalements_qr_bureaux) AS bureaux,')
    expect(section).toContain('(SELECT count(*) FROM signalements_qr_gestionnaires WHERE bureau_id IS NOT NULL) AS fiches_rattachees,')
    expect(section).toContain('(SELECT count(*) FROM signalements_qr_coproprietes WHERE bureau_id IS NOT NULL) AS coproprietes_rattachees;')
  })

  it('retire les triggers, les fonctions nouvelles, les contraintes, les colonnes et la table ; IF EXISTS partout', () => {
    for (const instruction of [
      'DROP TRIGGER IF EXISTS trg_signalements_qr_gestionnaires_bureau ON signalements_qr_gestionnaires;',
      'DROP TRIGGER IF EXISTS trg_signalements_qr_copros_bureau ON signalements_qr_coproprietes;',
      'DROP FUNCTION IF EXISTS signalements_qr_bureau_du_gestionnaire();',
      'DROP FUNCTION IF EXISTS signalements_qr_bureau_de_la_copropriete();',
      'DROP FUNCTION IF EXISTS signalements_qr_enregistrer_bureau(uuid, uuid, text, uuid);',
      'DROP FUNCTION IF EXISTS signalements_qr_fermer_bureau(uuid, boolean, uuid);',
      'ALTER TABLE signalements_qr_gestionnaires DROP CONSTRAINT IF EXISTS signalements_qr_gestionnaires_bureau_fk;',
      'ALTER TABLE signalements_qr_coproprietes DROP CONSTRAINT IF EXISTS signalements_qr_copros_bureau_fk;',
      'ALTER TABLE signalements_qr_coproprietes DROP CONSTRAINT IF EXISTS signalements_qr_copros_bureau_cabinet;',
      'ALTER TABLE signalements_qr_gestionnaires DROP COLUMN IF EXISTS bureau_id;',
      'ALTER TABLE signalements_qr_coproprietes DROP COLUMN IF EXISTS bureau_id;',
      'DROP TABLE IF EXISTS signalements_qr_bureaux;',
    ]) expect(codeRetour, instruction).toContain(instruction)
    expect([...codeRetour.matchAll(/\bDROP (TRIGGER|FUNCTION|TABLE|CONSTRAINT|COLUMN) (?!IF EXISTS)/g)]).toHaveLength(0)
    expect(codeRetour.indexOf('DROP TRIGGER')).toBeLessThan(codeRetour.indexOf('DROP FUNCTION'))
    expect(codeRetour.lastIndexOf('DROP CONSTRAINT')).toBeLessThan(codeRetour.indexOf('DROP TABLE'))
  })

  it('remet signalements_qr_inviter_gestionnaire dans son texte de la 20261112, À L’IDENTIQUE (commentaires compris), avec ses droits', () => {
    const remise = fonctionsDefinies(retour)
    expect(remise.map((f) => f.nom)).toEqual(['signalements_qr_inviter_gestionnaire'])
    expect(remise[0].texte).toBe(fonctionsDefinies(sql1112).find((f) => f.nom === 'signalements_qr_inviter_gestionnaire')?.texte)
    expect(codeRetour).toContain('REVOKE EXECUTE ON FUNCTION signalements_qr_inviter_gestionnaire(jsonb, jsonb, uuid[], uuid) FROM PUBLIC, anon, authenticated;')
    expect(codeRetour).toContain('GRANT  EXECUTE ON FUNCTION signalements_qr_inviter_gestionnaire(jsonb, jsonb, uuid[], uuid) TO service_role;')
  })

  it('hors du corps de la fonction remise : ni le journal ni aucune donnée touchés ; se termine par la relecture du schéma', () => {
    const retourHorsFonctions = codeRetour.replace(/\$fn\$[\s\S]*?\$fn\$/g, '$fn$ $fn$')
    expect(retourHorsFonctions).not.toMatch(/signalements_qr_journal|INSERT\s+INTO|DELETE\s+FROM|TRUNCATE|UPDATE\s+\w+\s+SET/i)
    expect(codeRetour).toMatch(/NOTIFY pgrst, 'reload schema';\s*$/)
  })
})
