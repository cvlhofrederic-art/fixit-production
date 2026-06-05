import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Migration alfredo_drafts.sql', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260513_alfredo_drafts.sql'),
    'utf-8',
  )

  it('ajoute 8 colonnes draft_*', () => {
    expect(sql).toMatch(/ADD COLUMN draft_subject text/)
    expect(sql).toMatch(/ADD COLUMN draft_body_html text/)
    expect(sql).toMatch(/ADD COLUMN draft_body_text text/)
    expect(sql).toMatch(/ADD COLUMN draft_status text/)
    expect(sql).toMatch(/ADD COLUMN draft_meta jsonb/)
    expect(sql).toMatch(/ADD COLUMN draft_generated_at timestamptz/)
    expect(sql).toMatch(/ADD COLUMN draft_reviewed_at timestamptz/)
    expect(sql).toMatch(/ADD COLUMN draft_reviewed_by uuid/)
  })

  it('définit les 8 valeurs valides de draft_status', () => {
    expect(sql).toMatch(/CHECK \(draft_status IN \('none', 'generating', 'pending_review', 'approved', 'sent', 'edited_sent', 'skipped', 'expired'\)\)/)
  })

  it('crée 2 indexes performants', () => {
    expect(sql).toMatch(/CREATE INDEX idx_emails_pending_alfredo[\s\S]*?WHERE draft_status = 'pending_review'/)
    expect(sql).toMatch(/CREATE INDEX idx_emails_alfredo_status/)
  })

  it('ajoute FK syndic_alfredo_learning.email_id → syndic_emails_analysed.id', () => {
    expect(sql).toMatch(/ADD CONSTRAINT fk_syndic_alfredo_learning_email/)
    expect(sql).toMatch(/FOREIGN KEY \(email_id\) REFERENCES syndic_emails_analysed\(id\)/)
  })
})
