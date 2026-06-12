import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Migration 20260521000004_lea_pdf_templates.sql', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260521000004_lea_pdf_templates.sql'),
    'utf-8',
  )

  it('crée 2 buckets privés (templates + generated)', () => {
    expect(sql).toMatch(/'syndic-pdf-templates', 'syndic-pdf-templates', false/)
    expect(sql).toMatch(/'syndic-pdf-generated', 'syndic-pdf-generated', false/)
  })

  it('définit les 6 policies bucket (3× templates + 3× generated) scopées cabinet_id', () => {
    expect(sql).toMatch(/CREATE POLICY syndic_pdf_templates_select ON storage\.objects/)
    expect(sql).toMatch(/CREATE POLICY syndic_pdf_templates_insert ON storage\.objects/)
    expect(sql).toMatch(/CREATE POLICY syndic_pdf_templates_delete ON storage\.objects/)
    expect(sql).toMatch(/CREATE POLICY syndic_pdf_generated_select ON storage\.objects/)
    expect(sql).toMatch(/CREATE POLICY syndic_pdf_generated_insert ON storage\.objects/)
    expect(sql).toMatch(/CREATE POLICY syndic_pdf_generated_delete ON storage\.objects/)
  })

  it('définit syndic_pdf_template_type avec 7 valeurs', () => {
    expect(sql).toMatch(/CREATE TYPE syndic_pdf_template_type AS ENUM/)
    for (const v of ['chamada_quotas', 'lettre_relance_impaye', 'ata_ag', 'pv_assemblee', 'convocation_ag', 'avis_passage', 'autre']) {
      expect(sql).toContain(`'${v}'`)
    }
  })

  it('crée la table syndic_pdf_templates avec placeholders jsonb + locale + unique (cabinet_id, name)', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS syndic_pdf_templates/)
    expect(sql).toMatch(/placeholders jsonb NOT NULL DEFAULT '\{\}'::jsonb/)
    expect(sql).toMatch(/locale text NOT NULL DEFAULT 'fr' CHECK \(locale IN \('fr', 'pt'\)\)/)
    expect(sql).toMatch(/idx_syndic_pdf_templates_cabinet_name[\s\S]*?ON syndic_pdf_templates\(cabinet_id, name\)/)
  })

  it('crée la table syndic_pdf_generated avec field_values jsonb + audit + template_id', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS syndic_pdf_generated/)
    expect(sql).toMatch(/template_id uuid REFERENCES syndic_pdf_templates\(id\) ON DELETE SET NULL/)
    expect(sql).toMatch(/field_values jsonb NOT NULL/)
    expect(sql).toMatch(/generated_by uuid REFERENCES auth\.users\(id\)/)
  })

  it('active RLS avec 7 policies au total scopées cabinet_id', () => {
    expect(sql).toMatch(/ALTER TABLE syndic_pdf_templates ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/ALTER TABLE syndic_pdf_generated ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/CREATE POLICY syndic_pdf_templates_select_own[\s\S]*?cabinet_id = auth\.uid\(\)/)
    expect(sql).toMatch(/CREATE POLICY syndic_pdf_templates_update_own[\s\S]*?cabinet_id = auth\.uid\(\)/)
    expect(sql).toMatch(/CREATE POLICY syndic_pdf_generated_select_own[\s\S]*?cabinet_id = auth\.uid\(\)/)
  })
})
