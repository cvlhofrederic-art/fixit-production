import { test, expect, type Page } from '@playwright/test'

/**
 * Showcase AgentChatPage (batch 8). Page composite : sidebar Conversas + chat.
 * Focus : interactions hydratées (envoi -> toast, suggestion -> champ, nouvelle
 * conversa, sélection, docs) + responsive ≤1100 (stack). Validée build prod
 * (cf. .claude/rules/testing.md). Les toasts sont info/success (role=status),
 * pas de conflit avec le route-announcer ; on assert par texte unique.
 */

test.describe.configure({ timeout: 120_000 })

async function gotoPrimitive(page: Page, slug: string) {
  await page.goto(`/fr/syndic/dev/primitives/${slug}/`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
}

const INPUT = 'Pergunta a Max Lavandeira'

test.describe('Syndic v54 — AgentChatPage showcase', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPrimitive(page, 'agent-chat-page')
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('rend la page : sidebar Conversas + main (nom + badge IA)', async ({ page }) => {
    await expect(page.getByText('CONVERSAS')).toBeVisible()
    await expect(page.getByText('Max Lavandeira')).toBeVisible()
    await expect(page.getByText('IA', { exact: true })).toBeVisible()
    await expect(page.getByRole('combobox')).toBeVisible()
  })

  test('envoi : saisie active Enviar -> toast', async ({ page }) => {
    const send = page.getByRole('button', { name: 'Enviar' })
    await expect(send).toBeDisabled()
    await page.getByLabel(INPUT).fill('Quanto custa o elevador?')
    await expect(send).toBeEnabled()
    await send.click()
    await expect(page.getByText('Pergunta enviada a Lavandeira')).toBeVisible()
  })

  test('suggestion : remplit le champ', async ({ page }) => {
    await page.getByRole('button', { name: 'Resumir a última ata da assembleia' }).click()
    await expect(page.getByLabel(INPUT)).toHaveValue('Resumir a última ata da assembleia')
  })

  test('+ Nova conversa -> toast success', async ({ page }) => {
    await page.getByRole('button', { name: '+ Nova conversa' }).click()
    await expect(page.getByText('Conversa iniciada com Lavandeira')).toBeVisible()
  })

  test('clic conversa -> toast', async ({ page }) => {
    await page.getByRole('button', { name: /Orçamento substituição elevador/ }).click()
    await expect(page.getByText('Conversa carregada')).toBeVisible()
  })

  test('Documentos -> toast', async ({ page }) => {
    await page.getByRole('button', { name: 'Documentos' }).click()
    await expect(page.getByText('Documentos do condomínio')).toBeVisible()
  })

  test('responsive : stack ≤1100px (grille 1 colonne)', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 })
    const cols = await page
      .locator('[aria-label="Histórico de conversas"]')
      .evaluate((el) => getComputedStyle(el.parentElement as HTMLElement).gridTemplateColumns)
    // ≤1100px : une seule colonne (pas de prefixe "320px ...").
    expect(cols.trim().split(/\s+/).length).toBe(1)
  })
})
