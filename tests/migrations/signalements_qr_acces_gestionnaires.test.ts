// tests/migrations/signalements_qr_acces_gestionnaires.test.ts
//
// Migration 20261112_signalements_qr_acces_gestionnaires.sql (AJ Signalement, PR 2 : accès de chaque gestionnaire à
// l'espace de SON cabinet, vitfix.io/<identifiant>/suivi/). Additive et rejouable, appliquée APRÈS la 20261111 : 4
// colonnes sur la fiche (compte relié, dates d'accès, de blocage, de demande d'effacement), FK vers auth.users en
// NOT VALID puis VALIDATE, index unique « un compte = une fiche », envoi d'un accès en une transaction, trigger de
// liaison du compte à l'acceptation, règle « adresse d'une fiche » en UNE fonction (signalements_qr_adresse_de_fiche :
// même boîte, sous-adresses « + » comprises, ou même partie locale de boîte sur un domaine du cabinet de la fiche ; sa
// jumelle TypeScript et la table de cas commune : tests/lib/aj-signalement-adresse-de-fiche.test.ts), corps de
// signalements_qr_emails_gestionnaires remplacé (acces_ouvert réel, même signature, exclusions par la règle), corps de
// signalements_qr_contester_adresse élargi (lot 3 : « Ce n'est pas moi » depuis un lien d'accès, fiche sans compte
// relié, objet de l'envoi au journal), départ (signalements_qr_desactiver_gestionnaire, corps de la 20261111 corrigée)
// qui retire des saisies l'adresse de la fiche ET ses variantes par la règle (contrôle 2, C1), effacement RGPD en une
// transaction (signalements_qr_pseudonymiser_gestionnaire : variantes retirées AVANT que l'adresse ne disparaisse),
// retraits d'attribution (signalements_qr_remplacer_attributions, signalements_qr_attribuer_au_gestionnaire, corps de
// la 20261111 corrigée) par la même règle (C3).
// Contre-vérification du 12/11 : chaque retrait et chaque exclusion passe par la garde signalements_qr_saisie_de_la_fiche
// (saisie de la fiche SEULE : une saisie que la règle reconnaît aussi comme l'adresse d'une AUTRE fiche active et non
// contestée du cabinet de la copropriété reste) ; création d'une fiche (signalements_qr_inviter_gestionnaire, corps de la
// 20261111 corrigée) refusée si elle partage une boîte avec une fiche existante ; enregistrement d'un cabinet
// (signalements_qr_enregistrer_cabinet, idem) refusé pour un domaine porté par une fiche d'un autre cabinet.
// Aucune table nouvelle (les domaines sont en PR 1), aucune donnée, aucune valeur de client (dépôt public). Le texte
// SQL est contrôlé ici ; l'essai PGlite (aj-pr2/pglite-essai, hors CI) le rejoue sur PostgreSQL 18.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { MIGRATION_ACCES_QR, MIGRATION_GESTIONNAIRES_QR } from '@/lib/aj-signalement/serveur'
import { estAdresseDeFicheQr } from '@/lib/aj-signalement/gestionnaires'
import { adressesDeFichesQr } from '@/lib/aj-signalement/destinataires'

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
  signalements_qr_contester_adresse: 'uuid',
  signalements_qr_desactiver_gestionnaire: 'uuid, jsonb, uuid',
  signalements_qr_pseudonymiser_gestionnaire: 'uuid, uuid',
  signalements_qr_remplacer_attributions: 'uuid, uuid[], boolean, uuid',
  signalements_qr_attribuer_au_gestionnaire: 'uuid, uuid[], uuid',
  // Contre-vérification du 12/11 : création d'une fiche et enregistrement d'un cabinet (corps de la 20261111 corrigée).
  signalements_qr_inviter_gestionnaire: 'jsonb, jsonb, uuid[], uuid',
  signalements_qr_enregistrer_cabinet: 'uuid, text, text, text, text[], uuid',
  // La règle et la garde, appelées par les fonctions ci-dessus (SECURITY INVOKER : avec le droit de l'appelant, service_role).
  signalements_qr_adresse_de_fiche: 'text, text, text[]',
  signalements_qr_saisie_de_la_fiche: 'text, uuid, text, text[], uuid, uuid',
  signalements_qr_saisies_sans_fiche: 'text[], uuid, text, text[], uuid, uuid',
}
const FONCTIONS_TRIGGER = ['signalements_qr_lier_gestionnaire']
/** Fonctions de la 20261111 dont celle-ci remplace le corps (même signature), à partir de sa version corrigée. */
const REDEFINIES_1111 = [
  'signalements_qr_emails_gestionnaires', 'signalements_qr_contester_adresse', 'signalements_qr_desactiver_gestionnaire',
  'signalements_qr_remplacer_attributions', 'signalements_qr_attribuer_au_gestionnaire',
  'signalements_qr_inviter_gestionnaire', 'signalements_qr_enregistrer_cabinet',
]
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

  // Essai PGlite du 11/11 (contre.mjs, rejeu de la 20261111 seule après la 20261112) : CREATE OR REPLACE remet les deux
  // corps de la 20261111 (acces_ouvert faux, contestation d'un lien d'accès refusée). L'en-tête le dit à qui applique.
  it('l’en-tête prévient : la 20261111 rejouée après celle-ci remet ses corps, rejouer alors celle-ci', () => {
    const entete = sql.slice(0, sql.indexOf('-- ── 1.'))
    expect(entete).toMatch(/rejouée APRÈS celle-ci/)
    expect(entete).toMatch(/rejouer ensuite celle-ci/)
    // Chaque fonction de la 20261111 dont celle-ci remplace le corps est nommée (contrôle 2 : le départ en plus).
    const redefinies = FONCTIONS.map((f) => f.nom).filter((nom) => fonctionsDefinies(code1111).some((f) => f.nom === nom))
    expect(trie(redefinies)).toEqual(trie(REDEFINIES_1111))
    for (const nom of redefinies) expect(entete, nom).toContain(nom)
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
  it('fonctions définies : envoi d’un accès, règle, destinataires, contestation et départ (corps remplacés), effacement, trigger', () => {
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
    expect([...code.matchAll(/RAISE EXCEPTION/g)]).toHaveLength([...code.matchAll(/RAISE EXCEPTION '[a-z_]+' USING ERRCODE = '[0-9A-Z]{5}'/g)].length)
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

  // Exclusions (RG-06 bis-3) : une saisie est celle d'une fiche partie ou contestée selon la règle commune
  // signalements_qr_adresse_de_fiche (même BOÎTE, sous-adresse « + » comprise, ou même partie locale de boîte sur un
  // domaine DÉCLARÉ par le cabinet de la fiche), domaines du cabinet de la fiche. La ligne exclue porte la SAISIE
  // reconnue (retirée telle quelle de l'envoi). Contre-vérification du 12/11 : par la garde (saisie de la fiche SEULE) —
  // une saisie que la règle reconnaît aussi comme l'adresse d'une AUTRE fiche active et non contestée du cabinet de la
  // copropriété n'est pas exclue pour la fiche partie ou contestée (même boîte dans deux cabinets, domaine d'une fiche
  // forcée déclaré par un autre cabinet, deux domaines d'un cabinet).
  const EXCLUSION = `SELECT g.id, u.e, false, true
      FROM signalements_qr_coproprietes c
      CROSS JOIN LATERAL unnest(c.emails_destinataires) AS u(e)
      JOIN signalements_qr_gestionnaires g
        ON signalements_qr_saisie_de_la_fiche(u.e, g.id, g.email,
             ARRAY(SELECT d.domaine FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = g.cabinet_id),
             c.cabinet_id, NULL)`
  const EXCLUSION_1111 = 'SELECT g.id, g.email, false, true FROM signalements_qr_coproprietes c JOIN signalements_qr_gestionnaires g ON g.email = ANY (c.emails_destinataires)'

  it('exclusions : la garde (règle pour la fiche, domaines de SON cabinet ; autres fiches du cabinet de la copropriété) ; la saisie reconnue est rendue', () => {
    expect(compacter(nouvelle().corps)).toContain(compacter(EXCLUSION))
    expect(nouvelle().corps).not.toMatch(/regexp_replace|split_part/)
    expect(nouvelle().corps).not.toMatch(/g\.email = ANY \(c\.emails_destinataires\)/)
    expect(nouvelle().corps).not.toMatch(/signalements_qr_adresse_de_fiche\(/)
  })

  it('définie APRÈS la règle et la garde qu’elle appelle (fonction SQL : corps contrôlé à la création)', () => {
    expect(code.indexOf('FUNCTION signalements_qr_emails_gestionnaires')).toBeGreaterThan(code.indexOf('FUNCTION signalements_qr_saisie_de_la_fiche'))
    expect(code.indexOf('FUNCTION signalements_qr_saisie_de_la_fiche')).toBeGreaterThan(code.indexOf('FUNCTION signalements_qr_adresse_de_fiche'))
    expect(code.indexOf('FUNCTION signalements_qr_saisies_sans_fiche')).toBeGreaterThan(code.indexOf('FUNCTION signalements_qr_saisie_de_la_fiche'))
  })

  it('le reste du corps est celui de la 20261111 : même cabinet, adresse confirmée non contestée, exclusions, limite', () => {
    const avant = compacter(ancienne().corps)
    expect(avant).toContain(EXCLUSION_1111)
    const attendu = avant.replace('false AS acces_ouvert', compacter(ACCES_REEL)).replace(EXCLUSION_1111, compacter(EXCLUSION))
    expect(compacter(nouvelle().corps)).toBe(attendu)
    expect(nouvelle().corps).toMatch(/g\.cabinet_id = c\.cabinet_id/)
    expect(nouvelle().corps).toMatch(/NOT g\.actif OR g\.adresse_contestee_le IS NOT NULL/)
    expect(nouvelle().corps).toMatch(/ORDER BY t\.exclu DESC, t\.gestionnaire_id\s+LIMIT 100/)
  })

  // La jointure appelle la règle avec les domaines du cabinet de CHAQUE fiche ; le code (adressesDeFichesQr) reçoit, lui,
  // la correspondance « domaine → cabinet » : les deux formes donnent la même réponse, fiche par fiche, tous cabinets
  // mêlés (la règle elle-même est comparée cas par cas dans tests/lib/aj-signalement-adresse-de-fiche.test.ts).
  it('appel de la jointure (domaines du cabinet de la fiche) et adressesDeFichesQr (domaine → cabinet) : même réponse', () => {
    const CAB = 'ca000000-0000-4000-8000-000000000001'
    const CAB_AUTRE = 'ca000000-0000-4000-8000-000000000002'
    const domaines: Record<string, string> = { 'exemple.test': CAB, 'exemple-bis.test': CAB, 'autre-exemple.test': CAB_AUTRE }
    const domainesDuCabinet = (cabinetId: string) => Object.keys(domaines).filter((d) => domaines[d] === cabinetId)
    const exclueSql = (saisie: string, fiche: { email: string; cabinetId: string }) =>
      estAdresseDeFicheQr(saisie, fiche.email, domainesDuCabinet(fiche.cabinetId))
    const cabinets = new Map(Object.entries(domaines))
    const fiches = [
      { id: 'g1', email: 'marie.exemple@exemple.test', cabinetId: CAB },
      { id: 'g2', email: 'paul+aj@exemple.test', cabinetId: CAB },
      { id: 'g3', email: 'jeanne@gmail.com', cabinetId: CAB },
      { id: 'g4', email: 'luc@autre-exemple.test', cabinetId: CAB_AUTRE },
    ]
    const saisies = [
      'marie.exemple@exemple.test', 'Marie.Exemple+Suivi@Exemple-Bis.test', 'marie.exemple@autre-exemple.test', 'marie.exemple@externe.test',
      'paul@exemple-bis.test', 'paul+x@exemple.test', 'jeanne@exemple-bis.test', 'jeanne@outlook.fr', 'luc@exemple.test', 'luc+y@autre-exemple.test',
      'accueil@exemple-bis.test', '+suivi@exemple.test',
    ]
    for (const saisie of saisies) {
      for (const fiche of fiches) {
        expect(exclueSql(saisie, fiche), `${saisie} / ${fiche.email}`).toBe(adressesDeFichesQr([saisie], [fiche], cabinets).length > 0)
      }
    }
  })
})

describe(`Migration ${FICHIER} : « Ce n’est pas moi » depuis un lien d’accès (signalements_qr_contester_adresse, corps élargi)`, () => {
  const nouvelle = () => fonction('signalements_qr_contester_adresse')
  const ancienne = () => fonction('signalements_qr_contester_adresse', fonctionsDefinies(code1111))

  it('même signature et même en-tête que la 20261111 (RETURNS boolean, SECURITY INVOKER)', () => {
    expect(nouvelle().types).toBe(ancienne().types)
    expect(compacter(nouvelle().entete)).toBe(compacter(ancienne().entete))
  })

  // Corrections de la PR 1 après l'essai PGlite du 11/11 (13eae891, 299762c9) : la 20261111 comparée est bien la version
  // corrigée, et le corps élargi les garde (sinon la 20261112, appliquée après, les annulerait en production).
  const VERROU_FICHE = 'PERFORM 1 FROM signalements_qr_gestionnaires g WHERE g.id = (SELECT i.gestionnaire_id FROM signalements_qr_invitations i WHERE i.id = p_invitation) FOR NO KEY UPDATE;'
  const TOUS_LES_JETONS = 'UPDATE signalements_qr_invitations SET invite_token = NULL WHERE gestionnaire_id = v_g AND invite_token IS NOT NULL;'
  const ANCIEN_EFFACEMENT = 'UPDATE signalements_qr_invitations SET invite_token = NULL WHERE gestionnaire_id = v_g AND accepted_at IS NULL AND invite_token IS NOT NULL;'

  it('la 20261111 de référence est la version corrigée de la PR 1 : fiche verrouillée d’abord, jetons de TOUS ses envois effacés', () => {
    const avant = compacter(ancienne().corps)
    expect(avant).toContain(VERROU_FICHE)
    expect(avant).toContain(TOUS_LES_JETONS)
    expect(avant).not.toContain(ANCIEN_EFFACEMENT)
  })

  it('envoi de confirmation OU d’accès, fiche SANS compte relié, objet de l’envoi au journal ; le reste du corps est celui de la 20261111', () => {
    const remplacements: Array<[string, string]> = [
      ['v_cab uuid; BEGIN', 'v_cab uuid; v_objet text; BEGIN'],
      ["i.objet = 'confirmation_adresse'", "i.objet IN ('confirmation_adresse', 'acces')"],
      ['g.email = i.email) RETURNING i.gestionnaire_id INTO v_g;', 'g.email = i.email AND g.user_id IS NULL) RETURNING i.gestionnaire_id, i.objet INTO v_g, v_objet;'],
      [
        "(cabinet_id, acteur_profil, acteur_gestionnaire_id, action, gestionnaire_id) VALUES (v_cab, 'gestionnaire', v_g, 'gestionnaire.adresse_contestee', v_g);",
        "(cabinet_id, acteur_profil, acteur_gestionnaire_id, action, gestionnaire_id, details) VALUES (v_cab, 'gestionnaire', v_g, 'gestionnaire.adresse_contestee', v_g, jsonb_build_object('objet', v_objet));",
      ],
    ]
    let attendu = compacter(ancienne().corps)
    for (const [avant, apres] of remplacements) {
      expect(attendu, avant).toContain(avant)
      attendu = attendu.replace(avant, apres)
    }
    expect(compacter(nouvelle().corps)).toBe(attendu)
  })

  it('toujours : 7 jours, envoi non accepté ni refusé, jeton présent ; fiche figée et tous ses liens caducs', () => {
    const corps = compacter(nouvelle().corps)
    expect(corps).toContain("i.created_at > now() - interval '7 days'")
    expect(corps).toContain('i.accepted_at IS NULL AND i.refus IS NULL AND i.invite_token IS NOT NULL')
    expect(corps).toContain('UPDATE signalements_qr_gestionnaires SET adresse_contestee_le = now() WHERE id = v_g')
    // Tous ses liens, celui d'un envoi déjà accepté compris (« C'est moi » garde le jeton : accepted_at fait foi).
    expect(corps).toContain(TOUS_LES_JETONS)
    expect(corps).not.toContain(ANCIEN_EFFACEMENT)
  })

  it('ordre unique des verrous (PR 1) : la fiche d’abord, puis ses envois, comme le départ et « C’est moi »', () => {
    const corps = compacter(nouvelle().corps)
    const verrou = corps.indexOf(VERROU_FICHE)
    expect(verrou).toBeGreaterThan(0)
    expect(verrou).toBeLessThan(corps.indexOf("UPDATE signalements_qr_invitations i SET refus = 'pas_moi'"))
  })

  it('définie APRÈS l’ajout de la colonne user_id qu’elle lit (même fichier, ordre d’application)', () => {
    expect(code.indexOf('FUNCTION signalements_qr_contester_adresse')).toBeGreaterThan(code.indexOf('ADD COLUMN IF NOT EXISTS user_id'))
  })
})

// ── Contrôle 2, constat C1 : une variante de l'adresse d'une fiche (étiquette « + », même partie locale sur un autre
// domaine du cabinet) restée dans les saisies d'une copropriété doit en sortir au départ ET à l'effacement, par la
// MÊME règle que l'exclusion à l'envoi, avant que l'adresse de la fiche ne disparaisse (après l'effacement, plus rien
// ne l'exclurait : la jointure d'exclusion porte sur g.email).

describe(`Migration ${FICHIER} : une seule règle « adresse d’une fiche » (signalements_qr_adresse_de_fiche)`, () => {
  it('la boîte (regexp_replace, lower, btrim) n’est calculée QUE dans la règle ; aucun array_remove ni comparaison exacte des saisies', () => {
    const regle = fonction('signalements_qr_adresse_de_fiche').corps
    const total = [...code.matchAll(/regexp_replace\(lower\(btrim\(/g)].length
    expect(total).toBe(2)
    expect([...regle.matchAll(/regexp_replace\(lower\(btrim\(/g)]).toHaveLength(total)
    expect(code).not.toMatch(/array_remove\s*\(/)
    expect(code).not.toMatch(/=\s*ANY\s*\(\s*(?:c\.)?emails_destinataires\s*\)/)
  })

  // Contre-vérification du 12/11 : chaque écriture passe par la garde (signalements_qr_saisies_sans_fiche, qui retire les
  // saisies de la fiche SEULE), et la copropriété n'est retouchée (journal, bilan) que si la garde y trouve une saisie, avec
  // les MÊMES arguments ; les verrous, eux, cherchent par la règle (plus large : verrouiller plus ne retire rien).
  it('chaque écriture des saisies passe par la garde, et la copropriété n’est retouchée que si la garde y retire une saisie (mêmes arguments)', () => {
    let ecrituresVues = 0
    for (const f of FONCTIONS) {
      const corps = compacter(f.corps)
      for (const m of corps.matchAll(/SET emails_destinataires = ([^;]*?) WHERE ([^;]*?)(?: RETURNING [^;]*?)?(?:;| LOOP)/g)) {
        ecrituresVues += 1
        const appel = /^signalements_qr_saisies_sans_fiche\(c\.emails_destinataires, ([a-z_.]+, [a-z_.]+, v_domaines, c\.cabinet_id, (?:NULL|c\.id))\)$/.exec(m[1])
        expect(appel, `${f.nom} : ${m[1]}`).not.toBeNull()
        expect(m[2], f.nom).toContain(`EXISTS (SELECT 1 FROM unnest(c.emails_destinataires) AS u(e) WHERE signalements_qr_saisie_de_la_fiche(u.e, ${appel?.[1]}))`)
      }
      for (const m of corps.matchAll(/PERFORM 1 FROM signalements_qr_coproprietes c[^;]*?unnest\(c\.emails_destinataires\) AS u\(e\) WHERE (signalements_qr_[a-z_]+)\(/g)) {
        expect(m[1], f.nom).toBe('signalements_qr_adresse_de_fiche')
      }
    }
    expect(ecrituresVues).toBe(4)
  })

  it('départ, effacement et exclusion : toute autre fiche active du cabinet de la copropriété garde (NULL) ; retraits d’attribution : seulement si elle y est attribuée (c.id)', () => {
    for (const nom of ['signalements_qr_desactiver_gestionnaire', 'signalements_qr_pseudonymiser_gestionnaire']) {
      expect(compacter(fonction(nom).corps), nom).toMatch(/signalements_qr_saisies_sans_fiche\(c\.emails_destinataires, p_id, [a-z_.]+, v_domaines, c\.cabinet_id, NULL\)/)
    }
    expect(compacter(fonction('signalements_qr_remplacer_attributions').corps))
      .toContain('signalements_qr_saisies_sans_fiche(c.emails_destinataires, v_perdu, v_email, v_domaines, c.cabinet_id, c.id)')
    expect(compacter(fonction('signalements_qr_attribuer_au_gestionnaire').corps))
      .toContain('signalements_qr_saisies_sans_fiche(c.emails_destinataires, p_gestionnaire, v_email, v_domaines, c.cabinet_id, c.id)')
  })

  it('la règle : immuable, sans accès aux tables (les domaines lui sont passés) ; la garde et les saisies sans la fiche : STABLE, ne lisent que fiches, attributions et domaines', () => {
    expect(fonction('signalements_qr_adresse_de_fiche').entete).toMatch(/LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER/)
    expect(fonction('signalements_qr_adresse_de_fiche').corps).not.toMatch(/\bsignalements_qr_[a-z_]+/)
    for (const nom of ['signalements_qr_saisie_de_la_fiche', 'signalements_qr_saisies_sans_fiche']) {
      expect(fonction(nom).entete, nom).toMatch(/LANGUAGE sql STABLE SECURITY INVOKER/)
      const lus = new Set([...fonction(nom).corps.matchAll(/\bsignalements_qr_[a-z_]+/g)].map((m) => m[0]))
      for (const l of lus) {
        expect(['signalements_qr_adresse_de_fiche', 'signalements_qr_saisie_de_la_fiche', 'signalements_qr_gestionnaires',
          'signalements_qr_attributions', 'signalements_qr_domaines_autorises'], `${nom} : ${l}`).toContain(l)
      }
      expect(fonction(nom).corps, nom).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/)
    }
  })
})

/** Corps de la 20261111 (corrigée, PR 1) modifié par des remplacements exacts, chacun présent une seule fois. */
function corpsAttendu(nom: string, remplacements: ReadonlyArray<readonly [string, string]>): string {
  let attendu = compacter(fonction(nom, fonctionsDefinies(code1111)).corps)
  for (const [avant, apres] of remplacements) {
    expect(attendu.split(avant).length - 1, `${nom} : « ${avant} »`).toBe(1)
    attendu = attendu.replace(avant, apres)
  }
  return attendu
}

const DOMAINES_CABINET = 'v_domaines := ARRAY(SELECT d.domaine FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = v_cab ORDER BY d.domaine);'
/** Recherche par la règle (verrous) : toute saisie que la règle rattache à la fiche. */
const variante = (email: string) =>
  `EXISTS (SELECT 1 FROM unnest(c.emails_destinataires) AS u(e) WHERE signalements_qr_adresse_de_fiche(u.e, ${email}, v_domaines))`
/** Écriture par la garde (contre-vérification du 12/11) : les saisies de la fiche SEULE, et la recherche qui l'accompagne. */
const garde = (fiche: string, email: string, copropriete: 'NULL' | 'c.id') => `${fiche}, ${email}, v_domaines, c.cabinet_id, ${copropriete}`
const sansFiche = (fiche: string, email: string, copropriete: 'NULL' | 'c.id') =>
  `signalements_qr_saisies_sans_fiche(c.emails_destinataires, ${garde(fiche, email, copropriete)})`
const deLaFicheSeule = (fiche: string, email: string, copropriete: 'NULL' | 'c.id') =>
  `EXISTS (SELECT 1 FROM unnest(c.emails_destinataires) AS u(e) WHERE signalements_qr_saisie_de_la_fiche(u.e, ${garde(fiche, email, copropriete)}))`
const JOURNAL_DEPART = "VALUES (v_ccab, p_acteur, 'super_admin', 'copropriete.modifiee', v_c, p_id, ARRAY['emails_destinataires'], '{\"motif\": \"depart\"}'::jsonb);"

describe(`Migration ${FICHIER} : départ (signalements_qr_desactiver_gestionnaire, corps de la 20261111 corrigée)`, () => {
  const nouvelle = () => fonction('signalements_qr_desactiver_gestionnaire')
  const ancienne = () => fonction('signalements_qr_desactiver_gestionnaire', fonctionsDefinies(code1111))

  it('même signature et même en-tête que la 20261111', () => {
    expect(nouvelle().types).toBe(ancienne().types)
    expect(compacter(nouvelle().entete)).toBe(compacter(ancienne().entete))
  })

  it('corps de la 20261111 corrigée (verrous, borne de 1 000, jetons) ; seuls changent la recherche et le retrait des saisies', () => {
    const attendu = corpsAttendu('signalements_qr_desactiver_gestionnaire', [
      ["v_successeurs uuid[] := '{}'; BEGIN", "v_successeurs uuid[] := '{}'; v_domaines text[]; BEGIN"],
      ["IF NOT v_trouvee OR NOT v_actif THEN RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001'; END IF;",
        `IF NOT v_trouvee OR NOT v_actif THEN RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001'; END IF; ${DOMAINES_CABINET}`],
      ['OR (v_email IS NOT NULL AND v_email = ANY (c.emails_destinataires))', `OR (v_email IS NOT NULL AND ${variante('v_email')})`],
      ['UPDATE signalements_qr_coproprietes SET emails_destinataires = array_remove(emails_destinataires, v_email) WHERE v_email = ANY(emails_destinataires) RETURNING id, cabinet_id',
        `UPDATE signalements_qr_coproprietes c SET emails_destinataires = ${sansFiche('p_id', 'v_email', 'NULL')} WHERE ${deLaFicheSeule('p_id', 'v_email', 'NULL')} RETURNING c.id, c.cabinet_id`],
    ])
    expect(compacter(nouvelle().corps)).toBe(attendu)
  })

  it('les copropriétés aux variantes sont verrouillées avec les autres, AVANT tout retrait (ordre fiches puis copropriétés)', () => {
    const corps = compacter(nouvelle().corps)
    const verrou = corps.indexOf(`OR (v_email IS NOT NULL AND ${variante('v_email')}) ORDER BY c.id FOR NO KEY UPDATE;`)
    expect(verrou).toBeGreaterThan(corps.indexOf('FOR UPDATE;'))
    expect(verrou).toBeLessThan(corps.indexOf('SET emails_destinataires'))
    expect(corps.indexOf(DOMAINES_CABINET)).toBeLessThan(verrou)
  })

  it('journal inchangé : une ligne copropriete.modifiee (motif depart) par copropriété retouchée, cabinet de la copropriété', () => {
    expect(compacter(nouvelle().corps)).toContain(JOURNAL_DEPART)
  })
})

describe(`Migration ${FICHIER} : effacement RGPD (signalements_qr_pseudonymiser_gestionnaire)`, () => {
  const corps = () => compacter(fonction('signalements_qr_pseudonymiser_gestionnaire').corps)
  const RETRAIT = `UPDATE signalements_qr_coproprietes c SET emails_destinataires = ${sansFiche('p_id', 'v_g.email', 'NULL')} WHERE ${deLaFicheSeule('p_id', 'v_g.email', 'NULL')} RETURNING c.id, c.cabinet_id`
  const EFFACEMENT = 'UPDATE signalements_qr_gestionnaires SET nom = NULL, email = NULL, pseudonymise_le = now() WHERE id = p_id;'

  it('fonction appelée par la route (clé service), plpgsql, rendue en jsonb', () => {
    expect(fonction('signalements_qr_pseudonymiser_gestionnaire').entete).toMatch(/RETURNS jsonb\s+LANGUAGE plpgsql SECURITY INVOKER/)
    expect(corps()).toContain("IF p_id IS NULL OR p_acteur IS NULL THEN RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023'; END IF;")
  })

  it('la fiche verrouillée d’abord ; active → a_reverifier (le départ d’abord) ; déjà effacée → rien (relance)', () => {
    expect(corps()).toContain('SELECT * INTO v_g FROM signalements_qr_gestionnaires g WHERE g.id = p_id FOR UPDATE;')
    expect(corps()).toContain("IF NOT FOUND OR v_g.actif THEN RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001'; END IF;")
    expect(corps()).toContain("IF v_g.pseudonymise_le IS NOT NULL THEN RETURN jsonb_build_object('pseudonymisee', false, 'adressesRetirees', 0); END IF;")
  })

  it('domaines du cabinet de la fiche, copropriétés verrouillées par identifiant, saisies retirées par la règle, PUIS adresse effacée', () => {
    const c = corps()
    const domaines = c.indexOf('v_domaines := ARRAY(SELECT d.domaine FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = v_g.cabinet_id ORDER BY d.domaine);')
    const verrou = c.indexOf(`PERFORM 1 FROM signalements_qr_coproprietes c WHERE ${variante('v_g.email')} ORDER BY c.id FOR NO KEY UPDATE;`)
    const retrait = c.indexOf(RETRAIT)
    const effacement = c.indexOf(EFFACEMENT)
    expect(c.indexOf('FOR UPDATE;')).toBeLessThan(domaines)
    expect(domaines).toBeGreaterThan(0)
    expect(verrou).toBeGreaterThan(domaines)
    expect(retrait).toBeGreaterThan(verrou)
    expect(effacement).toBeGreaterThan(retrait)
    expect(c.split(EFFACEMENT).length - 1).toBe(1)
  })

  it('journal comme au départ : copropriete.modifiee (motif depart) par copropriété retouchée ; bilan rendu', () => {
    expect(corps()).toContain(JOURNAL_DEPART)
    expect(corps()).toContain("RETURN jsonb_build_object('pseudonymisee', true, 'adressesRetirees', v_retirees);")
  })

  it('ni envois ni ligne gestionnaire.pseudonymise ici : la route les écrit, comme en PR 1', () => {
    expect(corps()).not.toMatch(/signalements_qr_invitations/)
    expect(corps()).not.toMatch(/gestionnaire\.pseudonymise/)
  })
})

// ── Contrôle 2, constat C3 : un retrait d'attribution (fiche de la copropriété, page profil du gestionnaire) ne
// retirait des saisies que l'adresse EXACTE de la fiche ; ses variantes y restaient (destinataires « saisis »).

const DOMAINES_CABINET_C3 = 'v_domaines := ARRAY(SELECT d.domaine FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = v_cab ORDER BY d.domaine);'

describe(`Migration ${FICHIER} : retrait d’attribution (signalements_qr_remplacer_attributions, corps de la 20261111 corrigée)`, () => {
  const nouvelle = () => fonction('signalements_qr_remplacer_attributions')
  const ancienne = () => fonction('signalements_qr_remplacer_attributions', fonctionsDefinies(code1111))

  it('même signature et même en-tête que la 20261111', () => {
    expect(nouvelle().types).toBe(ancienne().types)
    expect(compacter(nouvelle().entete)).toBe(compacter(ancienne().entete))
  })

  it('corps de la 20261111 corrigée (verrous, borne de 1 000, journal) ; seul change le retrait des saisies d’une fiche qui perd la copropriété', () => {
    const attendu = corpsAttendu('signalements_qr_remplacer_attributions', [
      ['v_retirees int := 0; BEGIN', 'v_retirees int := 0; v_domaines text[]; v_perdu uuid; BEGIN'],
      ['FOR v_email IN SELECT g.email FROM signalements_qr_gestionnaires g WHERE g.id = ANY (v_perdus) AND g.email IS NOT NULL LOOP UPDATE signalements_qr_coproprietes SET emails_destinataires = array_remove(emails_destinataires, v_email) WHERE id = p_copropriete AND v_email = ANY (emails_destinataires);',
        `${DOMAINES_CABINET_C3} FOR v_perdu, v_email IN SELECT g.id, g.email FROM signalements_qr_gestionnaires g WHERE g.id = ANY (v_perdus) AND g.email IS NOT NULL LOOP UPDATE signalements_qr_coproprietes c SET emails_destinataires = ${sansFiche('v_perdu', 'v_email', 'c.id')} WHERE c.id = p_copropriete AND ${deLaFicheSeule('v_perdu', 'v_email', 'c.id')};`],
    ])
    expect(compacter(nouvelle().corps)).toBe(attendu)
  })
})

describe(`Migration ${FICHIER} : retrait d’attribution (signalements_qr_attribuer_au_gestionnaire, corps de la 20261111 corrigée)`, () => {
  const nouvelle = () => fonction('signalements_qr_attribuer_au_gestionnaire')
  const ancienne = () => fonction('signalements_qr_attribuer_au_gestionnaire', fonctionsDefinies(code1111))

  it('même signature et même en-tête que la 20261111', () => {
    expect(nouvelle().types).toBe(ancienne().types)
    expect(compacter(nouvelle().entete)).toBe(compacter(ancienne().entete))
  })

  it('corps de la 20261111 corrigée (fiche puis copropriétés verrouillées, « à tous » épargné) ; seul change le retrait des saisies', () => {
    const attendu = corpsAttendu('signalements_qr_attribuer_au_gestionnaire', [
      ['v_retirees int := 0; BEGIN', 'v_retirees int := 0; v_domaines text[]; BEGIN'],
      ['IF v_email IS NOT NULL AND cardinality(v_perdues) > 0 THEN FOR v_c IN UPDATE signalements_qr_coproprietes SET emails_destinataires = array_remove(emails_destinataires, v_email) WHERE id = ANY (v_perdues) AND NOT attribuee_a_tous AND v_email = ANY (emails_destinataires) RETURNING id LOOP',
        `IF v_email IS NOT NULL AND cardinality(v_perdues) > 0 THEN ${DOMAINES_CABINET_C3} FOR v_c IN UPDATE signalements_qr_coproprietes c SET emails_destinataires = ${sansFiche('p_gestionnaire', 'v_email', 'c.id')} WHERE c.id = ANY (v_perdues) AND NOT c.attribuee_a_tous AND ${deLaFicheSeule('p_gestionnaire', 'v_email', 'c.id')} RETURNING c.id LOOP`],
    ])
    expect(compacter(nouvelle().corps)).toBe(attendu)
  })
})

// ── Contre-vérification du 12/11 : en amont, aucune boîte partagée entre deux fiches ──
// La création ne vérifiait que l'égalité exacte (index unique) et l'enregistrement d'un cabinet acceptait un domaine porté
// par une fiche d'un autre cabinet : deux fiches pouvaient partager une boîte selon la règle.

/** Verrou d'un domaine : même clé à la création d'une fiche et à l'enregistrement des domaines d'un cabinet. */
const VERROU_DOMAINE = (valeur: string) => `PERFORM pg_advisory_xact_lock(hashtext('signalements_qr_domaine:' || ${valeur}));`
const VERROU_BOITE = "PERFORM pg_advisory_xact_lock(hashtext('signalements_qr_boite:' || split_part(split_part(v_email, '@', 1), '+', 1)));"
const DOMAINES_FICHE_O = 'ARRAY(SELECT d.domaine FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = o.cabinet_id)'
const DOMAINES_NOUVELLE = 'ARRAY(SELECT d.domaine FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = v_cab)'
// Reprise de la garde, constat 6 : refus seulement si l'adresse de l'une est une adresse de l'autre fiche (la règle dans
// les deux sens, domaines du cabinet de chacune) ; deux fiches forcées d'un cabinet, sur deux boîtes distinctes de même
// partie locale, ne sont plus refusées. DETAIL : la fiche de même boîte d'abord, puis la plus petite par identifiant.
const MEME_BOITE = 'SELECT o.id INTO v_existante FROM signalements_qr_gestionnaires o WHERE o.email IS NOT NULL'
  + ` AND (signalements_qr_adresse_de_fiche(v_email, o.email, ${DOMAINES_FICHE_O})`
  + ` OR signalements_qr_adresse_de_fiche(o.email, v_email, ${DOMAINES_NOUVELLE}))`
  + " ORDER BY signalements_qr_adresse_de_fiche(v_email, o.email, '{}'::text[]) DESC, o.id LIMIT 1;"
  + " IF FOUND THEN RAISE EXCEPTION 'existe_deja' USING ERRCODE = 'P0001', DETAIL = v_existante::text; END IF;"

describe(`Migration ${FICHIER} : création d’une fiche (signalements_qr_inviter_gestionnaire, corps de la 20261111 corrigée)`, () => {
  const nouvelle = () => fonction('signalements_qr_inviter_gestionnaire')
  const ancienne = () => fonction('signalements_qr_inviter_gestionnaire', fonctionsDefinies(code1111))

  it('même signature et même en-tête que la 20261111', () => {
    expect(nouvelle().types).toBe(ancienne().types)
    expect(compacter(nouvelle().entete)).toBe(compacter(ancienne().entete))
  })

  it('corps de la 20261111 corrigée ; seuls s’ajoutent les verrous (domaine, puis boîte) et le refus d’une boîte déjà portée par une fiche', () => {
    const attendu = corpsAttendu('signalements_qr_inviter_gestionnaire', [
      ['WHERE t.x IS NOT NULL); BEGIN', 'WHERE t.x IS NOT NULL); v_existante uuid; BEGIN'],
      ["OR NOT EXISTS (SELECT 1 FROM signalements_qr_cabinets k WHERE k.id = v_cab) THEN RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001'; END IF;",
        `OR NOT EXISTS (SELECT 1 FROM signalements_qr_cabinets k WHERE k.id = v_cab) THEN RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001'; END IF; ${VERROU_DOMAINE("split_part(v_email, '@', 2)")} ${VERROU_BOITE}`],
      ['INSERT INTO signalements_qr_gestionnaires (id, cabinet_id, nom, email, domaine_force, cree_par)',
        `${MEME_BOITE} INSERT INTO signalements_qr_gestionnaires (id, cabinet_id, nom, email, domaine_force, cree_par)`],
    ])
    expect(compacter(nouvelle().corps)).toBe(attendu)
  })

  it('les verrous AVANT le contrôle du domaine d’un autre cabinet et la recherche de la boîte ; le refus AVANT toute écriture', () => {
    const corps = compacter(nouvelle().corps)
    const domaine = corps.indexOf(VERROU_DOMAINE("split_part(v_email, '@', 2)"))
    expect(domaine).toBeGreaterThan(0)
    expect(corps.indexOf(VERROU_BOITE)).toBeGreaterThan(domaine)
    expect(corps.indexOf("'domaine_autre_cabinet'")).toBeGreaterThan(corps.indexOf(VERROU_BOITE))
    expect(corps.indexOf(MEME_BOITE)).toBeGreaterThan(corps.indexOf(VERROU_BOITE))
    expect(corps.indexOf('INSERT INTO')).toBeGreaterThan(corps.indexOf(MEME_BOITE))
  })
})

describe(`Migration ${FICHIER} : domaines d’un cabinet (signalements_qr_enregistrer_cabinet, corps de la 20261111 corrigée)`, () => {
  const nouvelle = () => fonction('signalements_qr_enregistrer_cabinet')
  const ancienne = () => fonction('signalements_qr_enregistrer_cabinet', fonctionsDefinies(code1111))
  const DOMAINE_D_UNE_FICHE = `IF v_domaines IS NOT NULL THEN FOREACH v_d IN ARRAY v_domaines LOOP ${VERROU_DOMAINE('v_d')} END LOOP;`
    + ' IF EXISTS (SELECT 1 FROM signalements_qr_gestionnaires g WHERE g.email IS NOT NULL AND g.cabinet_id IS DISTINCT FROM p_id'
    + " AND split_part(g.email, '@', 2) = ANY (v_domaines)"
    + " AND NOT EXISTS (SELECT 1 FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = p_id AND d.domaine = split_part(g.email, '@', 2)))"
    + " THEN RAISE EXCEPTION 'domaine_pris' USING ERRCODE = 'P0001'; END IF; END IF;"

  it('même signature et même en-tête que la 20261111', () => {
    expect(nouvelle().types).toBe(ancienne().types)
    expect(compacter(nouvelle().entete)).toBe(compacter(ancienne().entete))
  })

  it('corps de la 20261111 corrigée ; seul s’ajoute le refus d’un NOUVEAU domaine porté par une fiche d’un autre cabinet (verrous par domaine, triés)', () => {
    const attendu = corpsAttendu('signalements_qr_enregistrer_cabinet', [
      ["v_avant text[] := '{}'; BEGIN", "v_avant text[] := '{}'; v_d text; BEGIN"],
      ["d.cabinet_id IS DISTINCT FROM p_id) THEN RAISE EXCEPTION 'domaine_pris' USING ERRCODE = 'P0001'; END IF;",
        `d.cabinet_id IS DISTINCT FROM p_id) THEN RAISE EXCEPTION 'domaine_pris' USING ERRCODE = 'P0001'; END IF; ${DOMAINE_D_UNE_FICHE}`],
    ])
    expect(compacter(nouvelle().corps)).toBe(attendu)
    // Domaines triés (ORDER BY 1) : les verrous se prennent toujours dans le même ordre.
    expect(compacter(nouvelle().corps)).toContain("WHERE nullif(btrim(t.x), '') IS NOT NULL ORDER BY 1);")
  })
})
