// tests/lib/messagerie-pro.test.ts
//
// Messagerie Pro (prestataire ↔ donneur d'ordre) — règle de côté et documents.
// En démo, le syndic et le prestataire sont le MÊME compte (même user id) : le côté
// d'un message ne peut plus se déduire du seul sender_id.

import { describe, it, expect } from 'vitest'
import {
  coteDuMessage,
  formaterMontantDocumentPro,
  libelleDocumentPro,
  lireDocumentPro,
  notificationOuvreMessagerie,
  resumeDocumentPro,
} from '@/lib/messagerie-pro'

const MEME_COMPTE = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const SYNDIC = '22222222-2222-4222-8222-222222222222'

describe('coteDuMessage — règle de côté du contrat', () => {
  it('metadata.cote fait foi, même si sender_id = artisan de la conversation', () => {
    expect(coteDuMessage({ type: 'text', sender_id: MEME_COMPTE, metadata: { cote: 'donneur_ordre' } }, MEME_COMPTE)).toBe('donneur_ordre')
    expect(coteDuMessage({ type: 'text', sender_id: SYNDIC, metadata: { cote: 'artisan' } }, MEME_COMPTE)).toBe('artisan')
  })

  it("un ordre de mission sans cote vient toujours du donneur d'ordre (même compte compris)", () => {
    expect(coteDuMessage({ type: 'ordre_mission', sender_id: MEME_COMPTE, metadata: {} }, MEME_COMPTE)).toBe('donneur_ordre')
    expect(coteDuMessage({ type: 'ordre_mission', sender_id: MEME_COMPTE }, MEME_COMPTE)).toBe('donneur_ordre')
  })

  it('sans cote : sender_id = artisan de la conversation → artisan, sinon donneur d\'ordre (historique)', () => {
    expect(coteDuMessage({ type: 'text', sender_id: MEME_COMPTE, metadata: {} }, MEME_COMPTE)).toBe('artisan')
    expect(coteDuMessage({ type: 'system', sender_id: MEME_COMPTE, metadata: null }, MEME_COMPTE)).toBe('artisan')
    expect(coteDuMessage({ type: 'text', sender_id: SYNDIC, metadata: {} }, MEME_COMPTE)).toBe('donneur_ordre')
  })

  it('une valeur de cote inconnue est ignorée (retour à la règle par défaut)', () => {
    expect(coteDuMessage({ type: 'text', sender_id: SYNDIC, metadata: { cote: 'admin' } }, MEME_COMPTE)).toBe('donneur_ordre')
  })
})

describe('documents — lecture, libellés, résumé', () => {
  const DEVIS = { type: 'devis' as const, reference: 'D-2026-014', montant_ttc: 640, description: 'Remplacement colonne EF', date: '2026-10-12' }

  it('résumé lisible du contrat (content)', () => {
    expect(resumeDocumentPro(DEVIS)).toBe('📄 Devis D-2026-014 — 640,00 € TTC — Remplacement colonne EF')
    expect(resumeDocumentPro({ type: 'rapport', reference: 'R-12', description: 'Fuite colmatée', date: '2026-10-12' }))
      .toBe("📝 Rapport d'intervention R-12 — Fuite colmatée")
    expect(resumeDocumentPro({ ...DEVIS, type: 'facture', reference: 'F-2026-003' }, 'pt'))
      .toBe('🧾 Fatura F-2026-003 — 640,00 € c/ IVA — Remplacement colonne EF')
  })

  it('libellés et montant', () => {
    expect(libelleDocumentPro('rapport')).toBe("Rapport d'intervention")
    expect(libelleDocumentPro('devis', 'pt')).toBe('Orçamento')
    expect(formaterMontantDocumentPro(12.5)).toBe('12,50 € TTC')
  })

  it('lireDocumentPro : pièce valide → objet, sinon null (repli sur le texte)', () => {
    expect(lireDocumentPro({ cote: 'artisan', document: DEVIS })).toEqual(DEVIS)
    expect(lireDocumentPro({ document: { type: 'rapport', reference: 'R-1', description: 'x', date: '2026-10-12' } }))
      .toEqual({ type: 'rapport', reference: 'R-1', description: 'x', date: '2026-10-12' })
    expect(lireDocumentPro({})).toBeNull()
    expect(lireDocumentPro(null)).toBeNull()
    expect(lireDocumentPro({ document: { type: 'avoir', reference: 'A-1' } })).toBeNull()
    expect(lireDocumentPro({ document: { type: 'devis', reference: '  ' } })).toBeNull()
    // Montant illisible ignoré, la carte reste affichable
    expect(lireDocumentPro({ document: { ...DEVIS, montant_ttc: '640' } })).toEqual({ ...DEVIS, montant_ttc: undefined })
  })
})

describe('notificationOuvreMessagerie — cloche du prestataire', () => {
  const ordre = { conversation_id: 'conv-1', message_type: 'ordre_mission' }

  it("new_mission accompagnée d'un ordre de mission → Messagerie (objet ou texte JSON)", () => {
    expect(notificationOuvreMessagerie({ type: 'new_mission', data_json: ordre })).toBe(true)
    expect(notificationOuvreMessagerie({ type: 'new_mission', data_json: JSON.stringify(ordre) })).toBe(true)
  })

  it('mission sans conversation, autre type ou data_json illisible → navigation historique', () => {
    expect(notificationOuvreMessagerie({ type: 'new_mission', data_json: { booking_id: 'b-1' } })).toBe(false)
    expect(notificationOuvreMessagerie({ type: 'new_mission', data_json: { ...ordre, conversation_id: null } })).toBe(false)
    expect(notificationOuvreMessagerie({ type: 'planning_change', data_json: ordre })).toBe(false)
    expect(notificationOuvreMessagerie({ type: 'new_mission', data_json: '{pas du json' })).toBe(false)
    expect(notificationOuvreMessagerie({ type: 'new_mission', data_json: null })).toBe(false)
  })
})
