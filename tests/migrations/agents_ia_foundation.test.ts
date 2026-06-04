import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Migration agents_ia_foundation.sql', () => {
  const migrationPath = join(process.cwd(), 'supabase/migrations/20260511_agents_ia_foundation.sql')
  const sql = readFileSync(migrationPath, 'utf-8')

  it('crée la table syndic_ai_conversations', () => {
    expect(sql).toMatch(/CREATE TABLE syndic_ai_conversations/)
  })

  it('crée la table syndic_ai_messages', () => {
    expect(sql).toMatch(/CREATE TABLE syndic_ai_messages/)
  })

  it('crée la table syndic_ai_audit', () => {
    expect(sql).toMatch(/CREATE TABLE syndic_ai_audit/)
  })

  it('crée la table syndic_alfredo_learning', () => {
    expect(sql).toMatch(/CREATE TABLE syndic_alfredo_learning/)
  })

  it('active RLS sur les 4 tables', () => {
    expect(sql).toMatch(/ALTER TABLE syndic_ai_conversations ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/ALTER TABLE syndic_ai_messages ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/ALTER TABLE syndic_ai_audit ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/ALTER TABLE syndic_alfredo_learning ENABLE ROW LEVEL SECURITY/)
  })

  it('définit les policies RLS auth.uid()', () => {
    expect(sql).toMatch(/CREATE POLICY syndic_own_conversations[\s\S]*?auth\.uid\(\)/)
    expect(sql).toMatch(/CREATE POLICY syndic_own_messages[\s\S]*?auth\.uid\(\)/)
  })

  it('contrainte CHECK agent_id à 4 valeurs', () => {
    expect(sql).toMatch(/agent_id text NOT NULL CHECK \(agent_id IN \('fixy','max','lea','alfredo'\)\)/)
  })

  it('contrainte CHECK locale à 2 valeurs', () => {
    expect(sql).toMatch(/locale text NOT NULL CHECK \(locale IN \('fr','pt'\)\)/)
  })

  it('cascade DELETE sur syndic_id auth.users', () => {
    expect(sql).toMatch(/syndic_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/)
  })

  it('trigger maintenance update_conv_metadata', () => {
    expect(sql).toMatch(/CREATE TRIGGER trg_update_conv_on_message/)
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION update_conv_metadata/)
  })

  it('fonction update_conv_metadata avec SET search_path = public (sécurité SECURITY DEFINER)', () => {
    expect(sql).toMatch(/LANGUAGE plpgsql SECURITY DEFINER SET search_path = public/)
  })
})
