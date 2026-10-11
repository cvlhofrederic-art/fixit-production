// @vitest-environment node
// tests/lib/copro-demo-data.test.ts
//
// Données de démonstration de l'espace Copropriétaire, rafraîchies pour la
// démo du lundi 12 octobre 2026 : historique dans les mois précédents,
// échéances d'octobre à décembre 2026, prochaine AG à venir. Le module est lu
// côté serveur par Fixy (environnement `node` : aucun accès au navigateur).

import { describe, it, expect } from 'vitest'

import {
  AG_DEMO, ANNONCES_DEMO, BAIL_DEMO, CHARGES_DEMO, DOCUMENTS_DEMO, ECHEANCES_DEMO,
  HISTORIQUE_DEMO, INTERVENTIONS_DEMO, NOTIFICATIONS_DEMO, PAIEMENTS_DEMO,
  PROFILE_DEMO, QUITTANCES_DEMO,
} from '@/lib/copro-demo-data'

const DEMO = '2026-10-12'
const jour = (iso: string) => iso.slice(0, 10)

describe('données de démo copropriétaire — dates autour du 12/10/2026', () => {
  it('échéances toutes à venir, entre le jour de la démo et fin décembre 2026', () => {
    expect(ECHEANCES_DEMO.length).toBeGreaterThan(0)
    for (const e of ECHEANCES_DEMO) {
      expect(e.date >= DEMO && e.date <= '2026-12-31', `${e.titre} ${e.date}`).toBe(true)
    }
  })

  it('prochaine AG convoquée après la démo, avec des résolutions ouvertes', () => {
    const aVenir = AG_DEMO.filter(ag => ag.statut === 'convoquee')
    expect(aVenir).toHaveLength(1)
    expect(jour(aVenir[0].date) > DEMO).toBe(true)
    expect(aVenir[0].resolutions.length).toBeGreaterThan(0)
    expect(aVenir[0].resolutions.every(r => r.statut === 'ouverte' && !r.monVote)).toBe(true)
    expect(ECHEANCES_DEMO.some(e => e.type === 'assemblee' && e.date === jour(aVenir[0].date))).toBe(true)
  })

  it('AG clôturées dans le passé, avec un résultat pour chaque résolution', () => {
    for (const ag of AG_DEMO.filter(a => a.statut === 'cloturee')) {
      expect(jour(ag.date) < DEMO, ag.titre).toBe(true)
      expect(ag.resolutions.every(r => r.statut === 'cloturee' && r.resultat)).toBe(true)
    }
  })

  it('charges du mois d’octobre 2026 présentes (carte « Charges du mois » du tableau de bord)', () => {
    const octobre = CHARGES_DEMO.find(c => c.mois === '2026-10')
    expect(octobre?.statut).toBe('en_attente')
    expect(CHARGES_DEMO.filter(c => c.statut === 'payee').every(c => c.mois < '2026-10')).toBe(true)
  })

  it('paiements : réglés avant la démo, à régler après', () => {
    for (const p of PAIEMENTS_DEMO) {
      if (p.statut === 'payee') expect(p.datePaiement && p.datePaiement <= DEMO, p.reference).toBeTruthy()
      else expect(p.dateEcheance >= DEMO, p.reference).toBe(true)
    }
  })

  it('historique, annonces, notifications et documents antérieurs à la démo', () => {
    for (const h of HISTORIQUE_DEMO) expect(h.date <= DEMO, h.titre).toBe(true)
    for (const a of ANNONCES_DEMO) expect(a.date <= DEMO, a.titre).toBe(true)
    for (const n of NOTIFICATIONS_DEMO) expect(jour(n.date) <= DEMO, n.titre).toBe(true)
    for (const d of DOCUMENTS_DEMO) expect(d.dateUpload <= DEMO, d.nom).toBe(true)
  })

  it('l’historique garde des paiements 2025 (carte « Total payé 2025 »)', () => {
    expect(HISTORIQUE_DEMO.some(h => h.type === 'paiement' && h.date.startsWith('2025') && (h.montant ?? 0) > 0)).toBe(true)
  })

  it('interventions : terminée avant la démo, planifiée après', () => {
    for (const i of INTERVENTIONS_DEMO) {
      if (i.statut === 'termine') expect(i.dateRdv < DEMO).toBe(true)
      if (i.statut === 'planifie') expect(i.dateRdv > DEMO).toBe(true)
    }
  })

  it('bail et quittances à jour', () => {
    expect(BAIL_DEMO.derniereRevision < DEMO && BAIL_DEMO.prochaineRevision > DEMO).toBe(true)
    expect(QUITTANCES_DEMO[0].mois).toBe('2026-10')
  })

  it('appel de fonds ravalement = moitié de la quote-part du reste à financer', () => {
    // 85 000 € TTC dont 20 000 € pris sur le fonds de travaux, en deux appels.
    const ravalement = PAIEMENTS_DEMO.find(p => p.type === 'travaux')
    expect(ravalement?.montant).toBe((85_000 - 20_000) * (PROFILE_DEMO.tantiemes / 10_000) / 2)
  })
})
