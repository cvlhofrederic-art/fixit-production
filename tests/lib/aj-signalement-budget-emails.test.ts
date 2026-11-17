// tests/lib/aj-signalement-budget-emails.test.ts
//
// Budget d'e-mails (RG-06 ter, SPEC § 1.7.2, Q6 retenue par Hugo le 10/11/2026 : 60 messages par heure et par
// copropriété, 300 par heure et par cabinet). La réservation atomique est faite en base par
// signalements_qr_reserver_emails, seule à décider (aucune copie TypeScript : relecture 10) ; ce module porte les
// plafonds et les textes : mention des signalements retenus, erreur enregistrée, alerte au super admin (sans nom ni
// coordonnées). Au-delà du budget, le dépôt reste enregistré : seul l'e-mail est retenu.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  ALERTE_LIMITE_ENVOI_QR, BUDGET_EMAILS_CABINET_HEURE, BUDGET_EMAILS_COPRO_HEURE, ERREUR_LIMITE_ENVOI_QR,
  alerteBudgetEmailsQr, mentionSignalementsRetenusQr,
} from '@/lib/aj-signalement/budget-emails'

describe('plafonds', () => {
  it('60 messages par heure et par copropriété, 300 par heure et par cabinet', () => {
    expect(BUDGET_EMAILS_COPRO_HEURE).toBe(60)
    expect(BUDGET_EMAILS_CABINET_HEURE).toBe(300)
  })

  it('même règle que la fonction SQL : accordé si somme + nombre ≤ plafond, pour la copropriété ET le cabinet', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261111_signalements_qr_gestionnaires.sql'), 'utf-8')
    expect(sql).toMatch(/IF v_somme_copro \+ p_nombre <= p_max_copro AND v_somme_cabinet \+ p_nombre <= p_max_cabinet THEN/)
    expect(sql).toMatch(/v_depuis\s+timestamptz := now\(\) - interval '1 hour'/)
  })
})

describe('aucune copie TypeScript de la décision (relecture 10)', () => {
  it('la règle n’existe qu’en base (signalements_qr_reserver_emails, contrôlée sur son texte par le test de la migration)', async () => {
    const exports = await import('@/lib/aj-signalement/budget-emails')
    expect(Object.keys(exports)).not.toContain('decisionBudgetEmailsQr')
  })
})

describe('textes : mention, erreur enregistrée, alerte', () => {
  it('mention des signalements retenus dans le prochain e-mail, sans leur contenu ; aucune mention sans retenu', () => {
    expect(mentionSignalementsRetenusQr(0)).toBeNull()
    expect(mentionSignalementsRetenusQr(1)).toBe('1 autre signalement reçu pendant la limite d’envoi : à consulter dans AJ Signalement.')
    expect(mentionSignalementsRetenusQr(3)).toBe('3 autres signalements reçus pendant la limite d’envoi : à consulter dans AJ Signalement.')
    expect(mentionSignalementsRetenusQr(-2)).toBeNull()
  })

  it('erreur enregistrée sur le signalement retenu : « Limite d’envoi atteinte : e-mail non envoyé. »', () => {
    expect(ERREUR_LIMITE_ENVOI_QR).toBe('Limite d’envoi atteinte : e-mail non envoyé.')
  })

  it('alerte au super admin : sans nom, sans adresse, sans coordonnées', () => {
    expect(ALERTE_LIMITE_ENVOI_QR.objet).toMatch(/limite d’envoi/i)
    expect(ALERTE_LIMITE_ENVOI_QR.texte).toBe('Limite d’envoi atteinte sur une copropriété : signalements à consulter dans AJ Signalement.')
    for (const texte of Object.values(ALERTE_LIMITE_ENVOI_QR)) {
      expect(texte).not.toMatch(/@|\d/)
    }
  })

  it('une seule alerte : au premier dépôt retenu depuis le dernier e-mail parti (retenus = 0 avant ce dépôt)', () => {
    expect(alerteBudgetEmailsQr({ accorde: false, retenus: 0 })).toBe(true)
    expect(alerteBudgetEmailsQr({ accorde: false, retenus: 2 })).toBe(false)
    expect(alerteBudgetEmailsQr({ accorde: true, retenus: 0 })).toBe(false)
    expect(alerteBudgetEmailsQr({ accorde: true, retenus: 4 })).toBe(false)
  })
})
