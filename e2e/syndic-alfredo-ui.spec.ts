/**
 * E2E — Syndic Alfredo UI (Lot 5)
 *
 * Pré-requis :
 *   1. Migrations Alfredo appliquées
 *   2. Dev server lancé (`npm run dev`)
 *   3. Compte de test syndic_admin disponible avec `test_role=syndic_admin`
 *
 * Tests skippés par défaut tant que `RUN_AGENTS_IA_E2E=1` n'est pas activé.
 */
import { test, expect } from '@playwright/test'

const SHOULD_RUN = process.env.RUN_AGENTS_IA_E2E === '1'

test.describe('Alfredo UI — Empty State (non connecté)', () => {
  test.skip(!SHOULD_RUN, 'RUN_AGENTS_IA_E2E pas activé')

  test('affiche mascotte + greeting + CTA Connecter Gmail si non connecté', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&page=emails')
    await expect(page.getByRole('img', { name: /alfredo/i })).toBeVisible()
    await expect(page.getByText(/Bonjour, je suis Alfredo/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Connecter Gmail/i })).toBeVisible()
  })

  test('affiche la grille de 8 prompts suggérés', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&page=emails')
    await expect(page.getByText(/Résume mes emails du jour/i)).toBeVisible()
    await expect(page.getByText(/Combien d.emails à traiter/i)).toBeVisible()
  })
})

test.describe('Alfredo UI — Loaded State (boîte connectée + drafts)', () => {
  test.skip(!SHOULD_RUN, 'RUN_AGENTS_IA_E2E pas activé ou pas de fixture de drafts')

  test('affiche header avec status badge et inbox', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&page=emails&seed=alfredo_drafts')
    await expect(page.getByText(/Alfredo/).first()).toBeVisible()
    await expect(page.getByText(/brouillons à valider/i)).toBeVisible()
  })

  test('chat sidebar : bouton ouvre/ferme la sidebar', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&page=emails&seed=alfredo_drafts')
    const openBtn = page.getByRole('button', { name: /Discuter avec Alfredo/i })
    await expect(openBtn).toBeVisible()
    await openBtn.click()
    await expect(page.getByRole('button', { name: /Fermer la discussion/i })).toBeVisible()
  })
})

test.describe('Alfredo UI — Sidebar rename', () => {
  test.skip(!SHOULD_RUN, 'RUN_AGENTS_IA_E2E pas activé')

  test('sidebar syndic affiche "Alfredo" (et plus "Emails Fixy")', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin')
    await expect(page.getByRole('button', { name: /^Alfredo$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Emails Fixy/i })).toHaveCount(0)
  })
})
