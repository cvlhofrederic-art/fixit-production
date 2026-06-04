import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d47) — navigation shell vers WhatsApp/SMS + Enquetes. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — d47 (Whatsapp + Enquetes)', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('WhatsApp/SMS (titre + liste)', async ({ page }) => {
    await page.getByRole('button', { name: 'WhatsApp/SMS', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Comunicação com Condóminos', level: 1 })).toBeVisible()
    await expect(page.getByText('Ana Silva', { exact: true })).toBeVisible()
  })

  test('Enquetes (titre + sondages)', async ({ page }) => {
    await page.getByRole('button', { name: 'Enquetes', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Enquetes & Sondagens', level: 1 })).toBeVisible()
    await expect(page.getByText('Horário de recolha de lixo', { exact: true })).toBeVisible()
  })
})
