import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d55) — navigation shell vers Reserva de Espaços Comuns. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Reserva de Espaços Comuns', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Reserva de Espaços Comuns (titre + calendrier + reservas)', async ({ page }) => {
    await page.getByRole('button', { name: 'Reserva Espaços', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Reserva de Espaços Comuns', level: 1 })).toBeVisible()
    await expect(page.getByText('Maio 2026')).toBeVisible()
    await expect(page.getByText('Próximas reservas')).toBeVisible()
    await expect(page.getByText('Ginásio Condominial')).toBeVisible()
  })
})
