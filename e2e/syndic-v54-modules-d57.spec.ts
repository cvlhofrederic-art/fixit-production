import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d57) — navigation shell vers les 5 modules net-new. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

async function goToDashboard(page: Page) {
  await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
  await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
}

test.describe('Syndic v54 — Modules net-new (d57)', () => {
  test.beforeEach(async ({ page }: { page: Page }) => { await goToDashboard(page) })

  test('Urgências Técnicas', async ({ page }) => {
    await page.getByRole('button', { name: 'Urgências Técnicas', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Urgências Técnicas', level: 1 })).toBeVisible()
    await expect(page.getByText('Despacho automático ativo')).toBeVisible()
  })

  test('Histórico Edifício', async ({ page }) => {
    await page.getByRole('button', { name: 'Histórico Edifício', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Histórico Edifício', level: 1 })).toBeVisible()
    await expect(page.getByText('Intervenções recentes')).toBeVisible()
  })

  test('Chatbot WhatsApp 24/7', async ({ page }) => {
    await page.getByRole('button', { name: 'Chatbot WhatsApp 24/7', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Chatbot WhatsApp 24/7', level: 1 })).toBeVisible()
    await expect(page.getByText('Conversas recentes')).toBeVisible()
  })

  test('Acompanhamento de Infrações', async ({ page }) => {
    await page.getByRole('button', { name: 'Acompanhamento de Infrações', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Acompanhamento de Infrações', level: 1 })).toBeVisible()
    await expect(page.getByText('Infrações em curso')).toBeVisible()
  })

  test('Benchmarking Imóveis', async ({ page }) => {
    await page.getByRole('button', { name: 'Benchmarking Imóveis', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Benchmarking Imóveis', level: 1 })).toBeVisible()
    await expect(page.getByText('Ranking de edifícios')).toBeVisible()
  })
})
