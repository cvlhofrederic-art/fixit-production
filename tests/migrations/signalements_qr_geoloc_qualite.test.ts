// tests/migrations/signalements_qr_geoloc_qualite.test.ts
//
// Migration 20261106_signalements_qr_geoloc_qualite.sql (AJ Signalement, demandes de Hugo du 06/11/2026) :
// qualité du déclarant, adresse proposée d'après sa position, lien vers un signalement déjà fait au même endroit.
// Additive et rejouable : colonnes ajoutées si elles manquent, contraintes nommées créées seulement si elles
// manquent (NOT VALID puis VALIDATE), index de la recherche des signalements semblables ; ni DROP, ni écriture de
// données. Appliquée après 20261106_signalements_qr_confirmation.sql (ordre alphabétique du dossier).

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const FICHIER = '20261106_signalements_qr_geoloc_qualite.sql'
const sql = readFileSync(join(process.cwd(), 'supabase/migrations', FICHIER), 'utf-8')
/** Le SQL sans ses commentaires, pour les contrôles « jamais ». */
const code = sql.replace(/--[^\n]*/g, '')

describe(`Migration ${FICHIER}`, () => {
  it('ajoute les trois colonnes, nullables, seulement si elles manquent', () => {
    expect(code).toMatch(/ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS qualite_declarant TEXT;/)
    expect(code).toMatch(/ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS adresse_proposee TEXT;/)
    expect(code).toMatch(/ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS signalement_lie_id UUID;/)
    expect(code).not.toMatch(/ADD COLUMN IF NOT EXISTS \w+ \w+ (NOT NULL|DEFAULT)/)
  })

  it('aucune suppression ni écriture de données', () => {
    expect(code).not.toMatch(/\bDROP\b/i)
    expect(code).not.toMatch(/\bUPDATE\s+signalements_qr\b/i)
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(code).not.toMatch(/\bTRUNCATE\b/i)
    expect(code).not.toMatch(/\bINSERT\b/i)
  })

  it.each([
    ['signalements_qr_qualite_declarant_valeurs', /CHECK \(qualite_declarant IS NULL OR qualite_declarant IN \('proprietaire', 'locataire'\)\) NOT VALID/],
    ['signalements_qr_adresse_proposee_longueur', /CHECK \(adresse_proposee IS NULL OR char_length\(adresse_proposee\) <= 300\) NOT VALID/],
    ['signalements_qr_signalement_lie_fk', /FOREIGN KEY \(signalement_lie_id\) REFERENCES signalements_qr\(id\) ON DELETE SET NULL NOT VALID/],
    ['signalements_qr_signalement_lie_distinct', /CHECK \(signalement_lie_id IS NULL OR signalement_lie_id <> id\) NOT VALID/],
  ])('contrainte %s : créée seulement si absente de pg_constraint, NOT VALID puis VALIDATE', (nom, definition) => {
    expect(code).toMatch(new RegExp(`conname = '${nom}'\\s+AND conrelid = 'signalements_qr'::regclass`))
    expect(code).toMatch(new RegExp(`ADD CONSTRAINT ${nom}\\s`))
    expect(code).toMatch(definition)
    expect(code).toMatch(new RegExp(`ALTER TABLE signalements_qr VALIDATE CONSTRAINT ${nom};`))
  })

  it('index de la recherche des signalements semblables (partiel, mêmes statuts ouverts que la route) et du lien', () => {
    expect(code).toMatch(/CREATE INDEX IF NOT EXISTS idx_signalements_qr_semblables\s+ON signalements_qr \(copropriete_id, zone_signalee, created_at DESC\)\s+WHERE est_partie_commune AND statut IN \('en_attente', 'acceptee', 'en_cours'\);/)
    expect(code).toMatch(/CREATE INDEX IF NOT EXISTS idx_signalements_qr_signalement_lie\s+ON signalements_qr \(signalement_lie_id\)\s+WHERE signalement_lie_id IS NOT NULL;/)
  })

  it('commente les colonnes et demande à PostgREST de relire le schéma', () => {
    for (const colonne of ['qualite_declarant', 'adresse_proposee', 'signalement_lie_id']) {
      expect(code).toMatch(new RegExp(`COMMENT ON COLUMN signalements_qr\\.${colonne} IS`))
    }
    expect(code).toMatch(/NOTIFY pgrst, 'reload schema';\s*$/)
  })

  it('passe après la migration de la confirmation au déclarant', () => {
    const fichiers = readdirSync(join(process.cwd(), 'supabase/migrations')).sort((a, b) => a.localeCompare(b))
    expect(fichiers.indexOf(FICHIER)).toBeGreaterThan(fichiers.indexOf('20261106_signalements_qr_confirmation.sql'))
    expect(fichiers.indexOf('20261106_signalements_qr_confirmation.sql')).toBeGreaterThan(fichiers.indexOf('20261104_signalements_qr.sql'))
  })
})
