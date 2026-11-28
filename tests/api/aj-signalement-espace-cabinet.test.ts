// tests/api/aj-signalement-espace-cabinet.test.ts
//
// Espace de chaque cabinet (PR 2, lot 4) : lecture serveur du cabinet du chemin pour les pages /<identifiant>/connexion/
// et /<identifiant>/suivi/ (lireCabinetDuCheminQr, lib/aj-signalement/serveur.ts), sur la base simulée.
// Règle de sûreté (Hugo fusionne lui-même) : fusionnée AVANT la migration 20261111, la table des cabinets manque
// (PGRST205, ou 42703 sur une colonne) : aucun cabinet ne peut exister, la page répond 404 (« aucun cabinet »), le repli est
// journalisé une seule fois par isolat ; rien d'autre ne change (aucune page existante ne lit cette table ainsi).
// Toute autre erreur est rendue (la page lève : page d'erreur), journalisée sans donnée personnelle.
// Données fictives (tests/helpers/aj-signalement-acces.ts).

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr, simulerProductionAvant1111Qr } = await import('../helpers/aj-signalement-base')
const { reinitialiserSimulQr, simulQr } = await import('../helpers/aj-signalement-routes')
const A = await import('../helpers/aj-signalement-acces')
const { lireCabinetDuCheminQr, reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  A.poserJeuAccesQr()
})

const avertissements = () => simulQr.logger.warn.mock.calls.filter((c) => String(c[0]).includes('11/11/2026'))

describe('lireCabinetDuCheminQr', () => {
  it('cabinet connu : identifiant et nom seulement (ni id, ni langue, ni domaines)', async () => {
    expect(await lireCabinetDuCheminQr('cabinet-exemple')).toEqual({ ok: true, cabinet: { identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple' } })
    expect(baseQr.etat.lectures.map((l) => l.table)).toEqual(['signalements_qr_cabinets'])
    expect(baseQr.etat.lectures[0].filtres.join(' ')).toContain('cabinet-exemple')
  })

  it('cabinet inconnu : aucun cabinet', async () => {
    expect(await lireCabinetDuCheminQr('cabinet-inconnu')).toEqual({ ok: true, cabinet: null })
  })

  it.each(['Cabinet-Exemple', 'ab', 'aj-signalement', 'api', 'a--b', ''])('identifiant invalide ou réservé (« %s ») : aucun cabinet, aucune lecture', async (id) => {
    expect(await lireCabinetDuCheminQr(id)).toEqual({ ok: true, cabinet: null })
    expect(baseQr.etat.lectures).toEqual([])
  })

  it.each(['PGRST205', '42P01'] as const)('sans la migration 20261111 (%s) : aucun cabinet, repli journalisé une fois, aucune erreur', async (code) => {
    simulerProductionAvant1111Qr(baseQr, code)
    expect(await lireCabinetDuCheminQr('cabinet-exemple')).toEqual({ ok: true, cabinet: null })
    expect(await lireCabinetDuCheminQr('autre-cabinet')).toEqual({ ok: true, cabinet: null })
    expect(baseQr.etat.tablesAbsentesLues).toEqual(['signalements_qr_cabinets', 'signalements_qr_cabinets'])
    expect(avertissements()).toHaveLength(1)
    expect(simulQr.logger.error).not.toHaveBeenCalled()
  })

  it('colonne absente (42703) : même repli', async () => {
    baseQr.etat.colonnesAbsentes.signalements_qr_cabinets = ['nom']
    expect(await lireCabinetDuCheminQr('cabinet-exemple')).toEqual({ ok: true, cabinet: null })
    expect(avertissements()).toHaveLength(1)
  })

  it('toute autre erreur : rendue (la page lève), journalisée avec le code seulement', async () => {
    baseQr.etat.erreursPonctuelles.signalements_qr_cabinets = { code: 'XX000', message: 'panne interne avec marie.exemple@exemple.test' }
    expect(await lireCabinetDuCheminQr('cabinet-exemple')).toEqual({ ok: false })
    expect(simulQr.logger.error).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(simulQr.logger.error.mock.calls)).not.toContain('marie.exemple')
    expect(JSON.stringify(simulQr.logger.error.mock.calls)).toContain('XX000')
  })
})
