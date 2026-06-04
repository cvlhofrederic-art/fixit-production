import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d43) — navigation shell vers Fundo Comum de Reserva (stateful). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Fundo Comum de Reserva', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Fundo Comum de Reserva (titre + état vide + ouverture modal)', async ({ page }) => {
    await page.getByRole('button', { name: 'Fundo Comum de Reserva', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Fundo Comum de Reserva', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhum edifício configurado', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Novo Edifício' }).first().click()
    await expect(page.getByText('Adicionar edifício ao FCR', { exact: true })).toBeVisible()
  })
})
