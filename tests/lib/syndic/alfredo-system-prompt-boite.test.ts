// Contexte du chat Alfredo : la boîte du cabinet peut être Gmail ou Outlook / Microsoft 365,
// le prompt ne doit plus affirmer « Gmail connecté » quand la boîte est chez Microsoft.

import { describe, it, expect } from 'vitest'
import { buildAlfredoSystemPromptFR, type AlfredoChatContext } from '@/lib/syndic/prompts/alfredo/system-prompt-fr'
import { buildAlfredoSystemPromptPT } from '@/lib/syndic/prompts/alfredo/system-prompt-pt'

const base: AlfredoChatContext = { role: 'syndic', inbox_pending_count: 2, inbox_total_count: 12, gmail_connected: true }

describe('prompt système Alfredo — boîte e-mail connectée', () => {
  it('FR : nomme le fournisseur de la boîte connectée', () => {
    const prompt = buildAlfredoSystemPromptFR({ ...base, boite_fournisseur: 'Outlook / Microsoft 365' })
    expect(prompt).toContain('- Boîte e-mail connectée : oui (Outlook / Microsoft 365)')
    expect(prompt).not.toContain('Gmail connecté')
  })

  it('FR : sans fournisseur connu, « oui » seul ; boîte non connectée, « non »', () => {
    expect(buildAlfredoSystemPromptFR(base)).toContain('- Boîte e-mail connectée : oui\n')
    expect(buildAlfredoSystemPromptFR({ ...base, gmail_connected: false, boite_fournisseur: 'Gmail / Google Workspace' })).toContain('- Boîte e-mail connectée : non')
  })

  it('PT : caixa de email ligada', () => {
    expect(buildAlfredoSystemPromptPT({ ...base, boite_fournisseur: 'Gmail / Google Workspace' })).toContain('- Caixa de email ligada : sim (Gmail / Google Workspace)')
    expect(buildAlfredoSystemPromptPT({ ...base, gmail_connected: false })).toContain('- Caixa de email ligada : não')
  })
})
