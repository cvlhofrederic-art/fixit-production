import { test, expect, type Page } from '@playwright/test'

/**
 * Version française du dashboard syndic classique v54.
 *  - /fr/syndic/v54/ (route servie en production) s'affiche en français ;
 *  - /pt/syndic/v54/ reste en portugais ;
 *  - la sandbox /syndic/dev/dashboard-fr/ (gated localhost) navigue en français.
 * Hydratation React requise : build prod uniquement (cf. .claude/rules/testing.md).
 */

test.describe.configure({ timeout: 120_000 })

/** Orthographe impossible en français : í ó ú ã õ (repère de texte portugais oublié). */
const ORTHOGRAPHE_PT = /[íóúãõ]/

async function ouvrir(page: Page, chemin: string) {
  await page.goto(chemin, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
  await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
}

test.describe('Syndic v54 — version française', () => {
  test('/fr/syndic/v54/ : shell et tableau de bord en français', async ({ page }) => {
    await ouvrir(page, '/fr/syndic/v54/')
    await expect(page.locator('aside[aria-label="Navigation principale"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tableau de bord', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nouvelle mission' }).first()).toBeVisible()
    const texte = await page.locator('#syndic-dashboard-v54').innerText()
    expect(texte).not.toMatch(ORTHOGRAPHE_PT)
  })

  test('/pt/syndic/v54/ : la version portugaise est inchangée', async ({ page }) => {
    await ouvrir(page, '/pt/syndic/v54/')
    await expect(page.getByRole('button', { name: /Painel de controlo/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nova missão' }).first()).toBeVisible()
  })

  test('sandbox FR : un module, sa modale et sa validation en français', async ({ page }) => {
    await ouvrir(page, '/fr/syndic/dev/dashboard-fr/')
    await page.getByRole('button', { name: /Ordres de service/ }).click()
    await expect(page.getByRole('heading', { name: 'Ordres de service', level: 1 })).toBeVisible()
    await page.getByRole('region', { name: 'Page' }).getByRole('button', { name: /Nouvelle mission/ }).click()
    await page.getByRole('button', { name: 'Créer la mission' }).click()
    await expect(page.getByText("L'immeuble est obligatoire.")).toBeVisible()
    const texte = await page.locator('body').innerText()
    expect(texte).not.toMatch(ORTHOGRAPHE_PT)
  })

  test('sandbox FR : e-Fatura AT absente de la sidebar française', async ({ page }) => {
    await ouvrir(page, '/fr/syndic/dev/dashboard-fr/')
    await expect(page.getByRole('button', { name: /Facturation électronique|e-Fatura/ })).toHaveCount(0)
  })
})
