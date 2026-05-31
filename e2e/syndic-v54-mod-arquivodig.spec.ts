import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d56) — navigation shell vers Arquivo Digital Certificado. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Arquivo Digital', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Arquivo Digital (titre + árvore + sous-section Projeto Aprovado)', async ({ page }) => {
    await page.getByRole('button', { name: 'Arquivo Digital', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Arquivo Digital Certificado', level: 1 })).toBeVisible()
    await expect(page.getByText('Árvore de documentos')).toBeVisible()
    await expect(page.getByText('Ata AG Ordinária 2025.pdf')).toBeVisible()
    await expect(page.getByText('Arquivo Projeto Aprovado & Licenças')).toBeVisible()
    await expect(page.getByText('Arquivo vazio')).toBeVisible()
  })
})
