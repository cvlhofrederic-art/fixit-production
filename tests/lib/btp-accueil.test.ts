// tests/lib/btp-accueil.test.ts
//
// Accueil du tableau de bord BTP pro : chiffres des tuiles et alertes (lib/btp/accueil.ts).
// Audit des fondations du 11/11/2026 : le « CA total chantiers » collait les budgets bout à bout (le hook les livre
// en texte), marge et acomptes affichaient un zéro trompeur, et les alertes lisaient une clé du navigateur vide.

import { describe, it, expect } from 'vitest'
import { alertesChantiers, chiffresChantiers, clientsAvecDevis, jourLocal, nombreOuNul } from '@/lib/btp/accueil'

describe('nombreOuNul', () => {
  it('lit un nombre de base, un texte de formulaire, une virgule décimale', () => {
    expect(nombreOuNul(28500)).toBe(28500)
    expect(nombreOuNul('45000.00')).toBe(45000)
    expect(nombreOuNul('1250,5')).toBe(1250.5)
  })

  it('absent, vide ou illisible : null', () => {
    for (const valeur of [null, undefined, '', 'abc', Number.NaN]) expect(nombreOuNul(valeur)).toBeNull()
  })
})

describe('chiffresChantiers — tuiles de l’accueil', () => {
  it('deux budgets en texte s’additionnent (ils étaient collés : 2 850 045 000 au lieu de 73 500)', () => {
    const chiffres = chiffresChantiers([
      { id: 'a', statut: 'En cours', budget: '28500' },
      { id: 'b', statut: 'En attente', budget: '45000.00' },
    ])
    expect(chiffres.caTotal).toBe(73500)
  })

  it('le montant facturé remplace le budget quand il est renseigné ; un chantier annulé ne compte pas', () => {
    const chiffres = chiffresChantiers([
      { id: 'a', statut: 'Terminé', budget: '10000', montant_facture: 11200.5 },
      { id: 'b', statut: 'En cours', budget: 8000, montant_facture: 0 },
      { id: 'c', statut: 'Annulé', budget: '99999' },
      { id: 'd', statut: 'En cours' },
    ])
    expect(chiffres.caTotal).toBe(19200.5)
  })

  it('acomptes et marge : null quand aucun chantier n’en porte (l’écran affiche « — », pas un zéro)', () => {
    const chiffres = chiffresChantiers([
      { id: 'a', statut: 'En cours', budget: '10000', acompte_recu: 0, marge_prevue_pct: null },
      { id: 'b', statut: 'En cours', budget: '5000' },
    ])
    expect(chiffres).toEqual({ caTotal: 15000, acomptes: null, margeMoyenne: null })
    expect(chiffresChantiers([])).toEqual({ caTotal: 0, acomptes: null, margeMoyenne: null })
  })

  it('acomptes additionnés ; marge = moyenne des seules marges renseignées', () => {
    const chiffres = chiffresChantiers([
      { id: 'a', statut: 'En cours', budget: 10000, acompte_recu: '3000', marge_prevue_pct: 20 },
      { id: 'b', statut: 'En cours', budget: 5000, acompte_recu: 1500.25, marge_prevue_pct: '31' },
      { id: 'c', statut: 'En cours', budget: 5000 },
      { id: 'd', statut: 'Annulé', budget: 5000, acompte_recu: 900, marge_prevue_pct: 90 },
    ])
    expect(chiffres.acomptes).toBe(4500.25)
    expect(chiffres.margeMoyenne).toBe(26) // (20 + 31) / 2 = 25,5 → 26 ; ni le chantier sans marge ni l'annulé ne comptent
  })
})

describe('alertesChantiers', () => {
  const maintenant = new Date(2026, 10, 11, 15, 30) // 11 novembre 2026, heure locale
  const chantier = (id: string, statut: string, dateFin: string | null, client = '') => ({ id, titre: `Chantier ${id}`, statut, dateFin, client })

  it('jourLocal rend le jour du fuseau de la machine', () => {
    expect(jourLocal(maintenant)).toBe('2026-11-11')
    expect(jourLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('en retard : date de fin passée, ni terminé ni annulé ; le dernier jour n’est pas un retard', () => {
    const { enRetard } = alertesChantiers([
      chantier('hier', 'En cours', '2026-11-10'),
      chantier('aujourdhui', 'En cours', '2026-11-11'),
      chantier('demain', 'En cours', '2026-11-12'),
      chantier('termine', 'Terminé', '2026-10-01'),
      chantier('annule', 'Annulé', '2026-10-01'),
      chantier('sans-date', 'En cours', null),
      chantier('horodate', 'En attente', '2026-11-01T00:00:00+00:00'),
    ], [], maintenant)
    expect(enRetard.map(c => c.id)).toEqual(['hier', 'horodate'])
  })

  it('terminé sans facture : seulement si aucune facture enregistrée ne porte ce client', () => {
    const chantiers = [
      chantier('facture', 'Terminé', '2026-10-01', 'Mme Dupré '),
      chantier('non-facture', 'Terminé', '2026-10-01', 'SCI Les Lilas'),
      chantier('en-cours', 'En cours', '2026-12-01', 'M. Roche'),
      chantier('sans-client', 'Terminé', '2026-10-01', ''),
    ]
    const documents = [
      { id: '1', docType: 'facture', clientName: 'mme dupré', status: 'envoye' },
      { id: '2', docType: 'devis', clientName: 'SCI Les Lilas', status: 'envoye' },
    ]
    expect(alertesChantiers(chantiers, documents, maintenant).terminesSansFacture.map(c => c.id)).toEqual(['non-facture'])
    // Sans aucun document chargé, tous les chantiers terminés qui ont un client sont signalés.
    expect(alertesChantiers(chantiers, [], maintenant).terminesSansFacture.map(c => c.id)).toEqual(['facture', 'non-facture'])
  })

  it('devis en brouillon : les brouillons seulement, pas les devis envoyés ni les factures en brouillon', () => {
    const documents = [
      { id: '1', docType: 'devis', status: 'brouillon', docNumber: 'BR-2026-001' },
      { id: '2', docType: 'devis', status: 'envoye' },
      { id: '3', docType: 'facture', status: 'brouillon' },
      { id: '4', type: 'devis', status: 'draft' },
    ]
    expect(alertesChantiers([], documents, maintenant).devisBrouillon.map(d => d.id)).toEqual(['1', '4'])
  })

  it('clientsAvecDevis : noms comparables, toutes écritures du champ client', () => {
    const clients = clientsAvecDevis([
      { docType: 'devis', clientName: '  Mme Dupré ' },
      { type: 'devis', client_name: 'SCI Les Lilas' },
      { docType: 'devis', client: 'M. Roche' },
      { docType: 'facture', clientName: 'Autre' },
      { docType: 'devis' },
    ])
    expect([...clients].sort((a, b) => a.localeCompare(b))).toEqual(['m. roche', 'mme dupré', 'sci les lilas'])
  })
})
