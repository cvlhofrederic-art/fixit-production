import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d10) — navigation shell vers PrepAss / PlanoMan / Vistoria / Contacto. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — modules d10', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Preparador Assembleia (titre + état vide)', async ({ page }) => {
    await page.getByRole('button', { name: 'Preparador Assembleia', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Preparador de Assembleia', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhuma assembleia preparada')).toBeVisible()
  })

  test('Plano Manutenção (titre + état vide)', async ({ page }) => {
    await page.getByRole('button', { name: 'Plano Manutenção', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Plano de Manutenção', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhum plano de manutenção')).toBeVisible()
  })

  test('Vistoria Técnica (titre + état vide)', async ({ page }) => {
    await page.getByRole('button', { name: 'Vistoria Técnica', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Vistoria Técnica', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhuma vistoria registada')).toBeVisible()
  })

  test('Contacto Proativo (titre + état vide)', async ({ page }) => {
    await page.getByRole('button', { name: 'Contacto Proativo', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Contacto Proativo IA', level: 1 })).toBeVisible()
    await expect(page.getByText('Sem campanhas')).toBeVisible()
  })
})
