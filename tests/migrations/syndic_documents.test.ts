import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Migration 20260521000002_lea_documents.sql', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260521000002_lea_documents.sql'),
    'utf-8',
  )

  it('crée le bucket privé syndic-documents', () => {
    expect(sql).toMatch(/INSERT INTO storage\.buckets[\s\S]*?\('syndic-documents', 'syndic-documents', false\)/)
  })

  it('définit les policies bucket scopées par cabinet_id (premier folder)', () => {
    expect(sql).toMatch(/CREATE POLICY syndic_documents_select ON storage\.objects/)
    expect(sql).toMatch(/CREATE POLICY syndic_documents_insert ON storage\.objects/)
    expect(sql).toMatch(/CREATE POLICY syndic_documents_delete ON storage\.objects/)
    expect(sql).toMatch(/auth\.uid\(\)::text = \(storage\.foldername\(name\)\)\[1\]/)
  })

  it('définit syndic_document_type avec 9 valeurs', () => {
    expect(sql).toMatch(/CREATE TYPE syndic_document_type AS ENUM/)
    const types = ['facture_artisan', 'facture_syndic', 'devis', 'contrat', 'rib', 'ata_ag', 'releve_bancaire', 'pv_assemblee', 'autre']
    for (const t of types) {
      expect(sql).toContain(`'${t}'`)
    }
  })

  it('définit syndic_document_status avec 4 valeurs', () => {
    expect(sql).toMatch(/CREATE TYPE syndic_document_status AS ENUM/)
    for (const s of ['pending', 'processing', 'processed', 'error']) {
      expect(sql).toContain(`'${s}'`)
    }
  })

  it('crée la table syndic_documents avec colonnes attendues', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS syndic_documents/)
    expect(sql).toMatch(/cabinet_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/)
    expect(sql).toMatch(/immeuble_id uuid REFERENCES syndic_immeubles\(id\) ON DELETE SET NULL/)
    expect(sql).toMatch(/storage_path text NOT NULL UNIQUE/)
    expect(sql).toMatch(/extracted_text text/)
    expect(sql).toMatch(/extracted_metadata jsonb/)
    expect(sql).toMatch(/embedding vector\(1024\)/)
  })

  it('crée les indexes de performance + FTS + HNSW', () => {
    expect(sql).toMatch(/idx_syndic_documents_cabinet/)
    expect(sql).toMatch(/idx_syndic_documents_type/)
    expect(sql).toMatch(/idx_syndic_documents_status[\s\S]*?WHERE status IN \('pending', 'processing'\)/)
    expect(sql).toMatch(/idx_syndic_documents_immeuble[\s\S]*?WHERE immeuble_id IS NOT NULL/)
    expect(sql).toMatch(/idx_syndic_documents_fts_fr[\s\S]*?gin\(to_tsvector\('french'/)
    expect(sql).toMatch(/idx_syndic_documents_fts_pt[\s\S]*?gin\(to_tsvector\('portuguese'/)
    expect(sql).toMatch(/idx_syndic_documents_embedding_hnsw[\s\S]*?USING hnsw \(embedding vector_cosine_ops\)/)
  })

  it('active RLS avec 4 policies scopées par cabinet_id', () => {
    expect(sql).toMatch(/ALTER TABLE syndic_documents ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/CREATE POLICY syndic_documents_select_own[\s\S]*?cabinet_id = auth\.uid\(\)/)
    expect(sql).toMatch(/CREATE POLICY syndic_documents_insert_own[\s\S]*?cabinet_id = auth\.uid\(\)/)
    expect(sql).toMatch(/CREATE POLICY syndic_documents_update_own[\s\S]*?cabinet_id = auth\.uid\(\)/)
    expect(sql).toMatch(/CREATE POLICY syndic_documents_delete_own[\s\S]*?cabinet_id = auth\.uid\(\)/)
  })
})
