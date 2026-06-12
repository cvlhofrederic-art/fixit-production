import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Migration 20260521000003_lea_documents_hybrid_search.sql', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260521000003_lea_documents_hybrid_search.sql'),
    'utf-8',
  )

  it('crée la fonction search_syndic_documents_hybrid', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION search_syndic_documents_hybrid/)
  })

  it('accepte cabinet_id + query_text + query_embedding + locale + filters + match_count', () => {
    expect(sql).toMatch(/p_cabinet_id uuid/)
    expect(sql).toMatch(/query_text text/)
    expect(sql).toMatch(/query_embedding vector\(1024\)/)
    expect(sql).toMatch(/query_locale text DEFAULT 'french'/)
    expect(sql).toMatch(/filter_type syndic_document_type DEFAULT NULL/)
    expect(sql).toMatch(/filter_immeuble_id uuid DEFAULT NULL/)
    expect(sql).toMatch(/match_count integer DEFAULT 5/)
  })

  it('combine vector_results + fts_results via FULL OUTER JOIN', () => {
    expect(sql).toMatch(/WITH vector_results AS/)
    expect(sql).toMatch(/fts_results AS/)
    expect(sql).toMatch(/FULL OUTER JOIN fts_results/)
  })

  it('applique RRF avec constante 60', () => {
    expect(sql).toMatch(/1\.0 \/ \(60 \+ v\.rank\)/)
    expect(sql).toMatch(/1\.0 \/ \(60 \+ f\.rank\)/)
  })

  it('scope les résultats par cabinet_id (defense-in-depth)', () => {
    expect(sql).toMatch(/d\.cabinet_id = p_cabinet_id/)
    // Au moins 3 occurrences (vector, fts, final WHERE)
    expect((sql.match(/cabinet_id = p_cabinet_id/g) || []).length).toBeGreaterThanOrEqual(3)
  })

  it('génère un snippet via ts_headline pour preview', () => {
    expect(sql).toMatch(/ts_headline\(query_locale::regconfig/)
  })

  it('ordonne par rrf_score DESC et limite à match_count', () => {
    expect(sql).toMatch(/ORDER BY c\.rrf_score DESC/)
    expect(sql).toMatch(/LIMIT match_count/)
  })
})
