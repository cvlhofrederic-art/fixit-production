import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d5) — navigation shell vers DocsInterv / ContabTéc / Faturação / Alertas. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — modules d5', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Documentos de Intervenções (titre + état vide)', async ({ page }) => {
    await page.getByRole('button', { name: 'Documentos de Intervenções', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Documentos de Intervenções', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhum documento')).toBeVisible()
  })

  test('Contabilidade Técnica (titre + tables)', async ({ page }) => {
    await page.getByRole('button', { name: 'Contabilidade Técnica', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Contabilidade Técnica', level: 1 })).toBeVisible()
    await expect(page.getByText('Detalhe das intervenções (12)')).toBeVisible()
    await expect(page.getByRole('table').first()).toBeVisible()
  })

  test('Faturação (titre + état vide)', async ({ page }) => {
    await page.getByRole('button', { name: 'Faturação', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Faturação & Recibos Verdes', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhuma fatura emitida')).toBeVisible()
  })

  test('Alertas (titre + état vide)', async ({ page }) => {
    await page.getByRole('button', { name: 'Alertas', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Alertas', level: 1 })).toBeVisible()
    await expect(page.getByText('Todos os alertas foram tratados!')).toBeVisible()
  })
})
