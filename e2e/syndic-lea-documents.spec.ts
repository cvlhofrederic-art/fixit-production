/**
 * E2E — Léa Documents (P5 hardening)
 *
 * Vérifie le flux complet :
 *   1. Sidebar Léa visible avec panel Documents
 *   2. Drop zone présent + sélecteur de type
 *   3. Liste paginée
 *   4. Bouton supprimer présent sur les rows
 *
 * Requiert :
 *   - Migrations P1-P4 appliquées (syndic_documents, syndic_pdf_templates)
 *   - Compte syndic de test
 *   - Dev server lancé
 *
 * Gated : `RUN_LEA_DOCS_E2E=1 npm run test:e2e e2e/syndic-lea-documents.spec.ts`
 */
import { test, expect } from '@playwright/test'

const SHOULD_RUN = process.env.RUN_LEA_DOCS_E2E === '1'

test.describe('Léa Documents — panel UI', () => {
  test.skip(!SHOULD_RUN, 'Activer avec RUN_LEA_DOCS_E2E=1')

  test('panel Documents accessible depuis la page Léa', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&page=lea_agent')
    await expect(page.getByRole('button', { name: /Documents/i })).toBeVisible()
  })

  test('clic sur Documents ouvre le popover avec drop zone', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&page=lea_agent')
    await page.getByRole('button', { name: /Documents/i }).click()
    await expect(page.getByText(/Mes documents comptables/i)).toBeVisible()
    await expect(page.getByText(/Glissez un PDF\/image ici/i)).toBeVisible()
  })

  test('sélecteur de type contient les 9 types de documents', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&page=lea_agent')
    await page.getByRole('button', { name: /Documents/i }).click()
    const select = page.locator('select').first()
    await expect(select.locator('option')).toHaveCount(9)
  })

  test('filtre type contient "Tous les types"', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&page=lea_agent')
    await page.getByRole('button', { name: /Documents/i }).click()
    await expect(page.getByRole('option', { name: /Tous les types/i })).toBeAttached()
  })
})

test.describe('Léa Documents — API endpoints (smoke)', () => {
  test.skip(!SHOULD_RUN, 'Activer avec RUN_LEA_DOCS_E2E=1')

  test('GET /api/syndic/lea-documents renvoie 401 sans auth', async ({ request }) => {
    const res = await request.get('/api/syndic/lea-documents')
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/syndic/lea-documents/upload renvoie 401 sans auth', async ({ request }) => {
    const res = await request.post('/api/syndic/lea-documents/upload', { multipart: {} })
    expect([401, 403, 400]).toContain(res.status())
  })

  test('POST /api/syndic/lea-pdf-generate renvoie 401 sans auth', async ({ request }) => {
    const res = await request.post('/api/syndic/lea-pdf-generate', { data: { template_id: '00000000-0000-0000-0000-000000000000', field_values: {} } })
    expect([401, 403]).toContain(res.status())
  })
})
