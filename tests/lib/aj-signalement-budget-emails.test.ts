// tests/lib/aj-signalement-budget-emails.test.ts
//
// Budget d'e-mails (RG-06 ter, SPEC § 1.7.2, Q6 retenue par Hugo le 10/11/2026 : 60 messages par heure et par
// copropriété, 300 par heure et par cabinet). La réservation atomique est faite en base par
// signalements_qr_reserver_emails ; la règle pure de lib/aj-signalement/budget-emails.ts est la même (vérifié sur le
// texte SQL) et porte les textes : mention des signalements retenus, erreur enregistrée, alerte au super admin (sans
// nom ni coordonnées). Au-delà du budget, le dépôt reste enregistré : seul l'e-mail est retenu.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  ALERTE_LIMITE_ENVOI_QR, BUDGET_EMAILS_CABINET_HEURE, BUDGET_EMAILS_COPRO_HEURE, ERREUR_LIMITE_ENVOI_QR,
  alerteBudgetEmailsQr, decisionBudgetEmailsQr, mentionSignalementsRetenusQr,
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

describe('decisionBudgetEmailsQr', () => {
  it('sous les deux plafonds : accordé ; pile au plafond : accordé', () => {
    expect(decisionBudgetEmailsQr({ sommeCopropriete: 0, sommeCabinet: 0, nombre: 3 })).toEqual({ accorde: true })
    expect(decisionBudgetEmailsQr({ sommeCopropriete: 45, sommeCabinet: 285, nombre: 15 })).toEqual({ accorde: true })
  })

  it('plafond de la copropriété dépassé : retenu (limite « copropriete »), avant celui du cabinet', () => {
    expect(decisionBudgetEmailsQr({ sommeCopropriete: 50, sommeCabinet: 290, nombre: 11 })).toEqual({ accorde: false, limite: 'copropriete' })
  })

  it('plafond du cabinet dépassé par l’ensemble de ses copropriétés : retenu (limite « cabinet »)', () => {
    expect(decisionBudgetEmailsQr({ sommeCopropriete: 10, sommeCabinet: 295, nombre: 6 })).toEqual({ accorde: false, limite: 'cabinet' })
  })

  it('aucun message à envoyer : accordé (rien ne compte)', () => {
    expect(decisionBudgetEmailsQr({ sommeCopropriete: 60, sommeCabinet: 300, nombre: 0 })).toEqual({ accorde: true })
  })

  it('plafonds passés en paramètre (valeurs à revoir avec le vrai parc)', () => {
    expect(decisionBudgetEmailsQr({ sommeCopropriete: 0, sommeCabinet: 0, nombre: 5 }, { copropriete: 4, cabinet: 100 })).toEqual({ accorde: false, limite: 'copropriete' })
  })

  it('copropriété « à tous » à 15 gestionnaires confirmés : 4 dépôts envoyés dans l’heure, le 5e retenu', () => {
    let somme = 0
    const decisions = Array.from({ length: 5 }, () => {
      const d = decisionBudgetEmailsQr({ sommeCopropriete: somme, sommeCabinet: somme, nombre: 15 })
      if (d.accorde) somme += 15
      return d.accorde
    })
    expect(decisions).toEqual([true, true, true, true, false])
    expect(somme).toBe(60)
  })

  it('budget du cabinet atteint par deux copropriétés : le dépôt suivant d’une troisième est retenu', () => {
    let cabinet = 0
    const sommes = new Map<string, number>()
    const deposer = (copro: string, nombre: number) => {
      const d = decisionBudgetEmailsQr({ sommeCopropriete: sommes.get(copro) ?? 0, sommeCabinet: cabinet, nombre })
      if (d.accorde) {
        sommes.set(copro, (sommes.get(copro) ?? 0) + nombre)
        cabinet += nombre
      }
      return d
    }
    for (let i = 0; i < 5; i += 1) {
      expect(deposer('copro-a', 12).accorde).toBe(true)
      expect(deposer('copro-b', 12).accorde).toBe(true)
    }
    for (let i = 0; i < 5; i += 1) {
      expect(deposer(`copro-${i}`, 18).accorde).toBe(true)
    }
    expect(cabinet).toBe(210)
    for (let i = 5; i < 10; i += 1) deposer(`copro-${i}`, 18)
    expect(cabinet).toBe(300)
    expect(deposer('copro-c', 1)).toEqual({ accorde: false, limite: 'cabinet' })
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
