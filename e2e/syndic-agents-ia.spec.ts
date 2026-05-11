/**
 * E2E — Syndic Agents IA (Plan A Tasks 20 + 27)
 *
 * Ces tests requièrent :
 *   1. La migration SQL `supabase/migrations/20260511_agents_ia_foundation.sql` appliquée
 *   2. Le dev server lancé (`npm run dev`)
 *   3. Des comptes de test avec différents rôles syndic
 *
 * Tant que la migration n'est pas appliquée, les tests sont skippés par défaut.
 * Pour les activer : `RUN_AGENTS_IA_E2E=1 npm run test:e2e e2e/syndic-agents-ia.spec.ts`
 */
import { test, expect } from '@playwright/test'

const SHOULD_RUN = process.env.RUN_AGENTS_IA_E2E === '1'

test.describe('Syndic Agents IA — sidebar RBAC (Task 20)', () => {
  test.skip(!SHOULD_RUN, 'Migration agents_ia_foundation pas encore appliquée')

  test('syndic_admin voit Fixy, Max et Léa', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin')
    await expect(page.getByRole('button', { name: /Fixy/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Max/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Léa/i })).toBeVisible()
  })

  test('syndic_comptable ne voit pas Max', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_comptable')
    await expect(page.getByRole('button', { name: /Léa/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Max$/i })).not.toBeVisible()
  })

  test('syndic_juriste ne voit pas Léa', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_juriste')
    await expect(page.getByRole('button', { name: /Max/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Léa/i })).not.toBeVisible()
  })

  test('syndic_tech ne voit ni Max ni Léa', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_tech')
    await expect(page.getByRole('button', { name: /Fixy/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Max$/i })).not.toBeVisible()
    await expect(page.getByRole('button', { name: /Léa/i })).not.toBeVisible()
  })

  test('click sur Fixy ouvre la page chat plein écran', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin')
    await page.getByRole('button', { name: /Fixy/i }).click()
    await expect(page.getByPlaceholder(/Tape ou parle/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Nouvelle conversation/i })).toBeVisible()
  })
})

test.describe('Syndic Agents IA — isolation locale FR/PT (Task 25 + 26)', () => {
  test.skip(!SHOULD_RUN, 'Migration agents_ia_foundation pas encore appliquée')

  test('Max FR refuse de citer une loi PT', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&test_locale=fr')
    await page.getByRole('button', { name: /Max/i }).click()
    await page.getByPlaceholder(/Tape ou parle/i).fill(
      'Quelles sont les majorités en copropriété selon la Lei 8/2022 ?'
    )
    await page.keyboard.press('Enter')
    const response = page.locator('[data-role="assistant"]').last()
    await expect(response).toContainText(
      /cadre français uniquement|droit de la copropriété portugais/i,
      { timeout: 30000 }
    )
  })

  test('Léa FR refuse TVA portugaise', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_comptable&test_locale=fr')
    await page.getByRole('button', { name: /Léa/i }).click()
    await page.getByPlaceholder(/Tape ou parle/i).fill(
      'Quel est le taux de TVA à 23% applicable à mes travaux ?'
    )
    await page.keyboard.press('Enter')
    const response = page.locator('[data-role="assistant"]').last()
    await expect(response).toContainText(/cadre français|TVA française|20%/i, {
      timeout: 30000,
    })
  })
})

test.describe('Syndic Agents IA — parcours complet (Task 27)', () => {
  test.skip(!SHOULD_RUN, 'Migration agents_ia_foundation pas encore appliquée')

  test('Fixy : créer conversation, envoyer message, recevoir réponse', async ({ page }) => {
    await page.goto('/syndic/dashboard?test_role=syndic_admin&test_locale=fr')
    await page.getByRole('button', { name: /Fixy/i }).click()
    await expect(page.getByPlaceholder(/Tape ou parle/i)).toBeVisible()

    await page.getByRole('button', { name: /Nouvelle conversation/i }).click()

    const input = page.getByPlaceholder(/Tape ou parle/i)
    await input.fill("Combien d'immeubles je gère ?")
    await page.keyboard.press('Enter')

    await expect(page.locator('[data-role="assistant"]')).toBeVisible({
      timeout: 30000,
    })

    await expect(
      page.locator('aside').getByText(/Combien d'immeubles/i)
    ).toBeVisible()
  })
})
