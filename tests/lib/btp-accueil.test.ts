// tests/lib/btp-accueil.test.ts
//
// Accueil du tableau de bord BTP pro : chiffres des tuiles et alertes (lib/btp/accueil.ts).
// Audit des fondations du 11/11/2026 : le « CA total chantiers » collait les budgets bout à bout (le hook les livre
// en texte), marge et acomptes affichaient un zéro trompeur, et les alertes lisaient une clé du navigateur vide.
// Relecture adverse du 14/11/2026 : statut des documents pris en compte (brouillon, annulé), brouillon sans numéro
// nommé sans référence, entrées illisibles ignorées, un seul calcul du retard pour l'alerte et pour le tableau.
// Le rendu du composant est couvert par tests/components/home-section-btp.test.tsx.

import { describe, it, expect } from 'vitest'
import {
  alertesChantiers, chiffresChantiers, clientsAvecDevis, finDepassee, jourLocal, libelleDevisBrouillon, nombreOuNul,
  type DocumentAccueil,
} from '@/lib/btp/accueil'

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

  it('finDepassee : strictement avant le jour local ; date absente ou illisible : jamais dépassée', () => {
    expect(finDepassee('2026-11-10', maintenant)).toBe(true)
    expect(finDepassee('2026-11-11', maintenant)).toBe(false) // dernier jour du chantier
    expect(finDepassee('2026-11-12', maintenant)).toBe(false)
    expect(finDepassee('2026-11-01T00:00:00+00:00', maintenant)).toBe(true)
    for (const valeur of ['', null, undefined, 'bientôt', '10/11/2026']) expect(finDepassee(valeur, maintenant)).toBe(false)
  })

  it('terminé sans facture : seulement si aucune facture émise ne porte ce client', () => {
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

  describe('terminé sans facture — seule une facture émise et non annulée compte', () => {
    const termine = [chantier('c1', 'Terminé', '2026-10-01', 'Mme Dupré')]
    const signales = (documents: DocumentAccueil[]) => alertesChantiers(termine, documents, maintenant).terminesSansFacture.map(c => c.id)
    const facture = (status?: string): DocumentAccueil => ({ id: 'f1', docType: 'facture', clientName: 'Mme Dupré', status })

    it.each([
      ['en brouillon (navigateur)', 'brouillon'],
      ['en brouillon (base)', 'draft'],
      ['sans statut (la liste l’affiche « Brouillon »)', undefined],
      ['au statut vide', ''],
      ['annulée (navigateur)', 'annule'],
      ['annulée (base)', 'cancelled'],
    ])('facture %s : rien n’est facturé, le chantier reste signalé', (_cas, status) => {
      expect(signales([facture(status)])).toEqual(['c1'])
    })

    it.each([
      ['émise (navigateur)', 'envoye'],
      ['émise (base)', 'pending'],
      ['payée', 'paid'],
      ['en retard', 'overdue'],
    ])('facture %s : le chantier n’est plus signalé', (_cas, status) => {
      expect(signales([facture(status)])).toEqual([])
    })

    it('une facture émise suffit, même à côté d’un brouillon et d’une facture annulée du même client', () => {
      expect(signales([facture('brouillon'), facture('annule'), facture('envoye')])).toEqual([])
    })

    it('facture d’acompte ou avoir émis : comptés comme une facture (règle inchangée, décision laissée au propriétaire)', () => {
      const acompte = [{ ...facture('envoye'), factureSubType: 'acompte', docNumber: 'AC-2026-001' }]
      const avoir = [{ ...facture('envoye'), factureSubType: 'avoir', docNumber: 'AV-2026-001' }]
      expect(signales(acompte)).toEqual([])
      expect(signales(avoir)).toEqual([])
    })
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

  it('devis en brouillon : un devis sans statut compte (la liste l’affiche « Brouillon »), pas un devis annulé ni accepté', () => {
    const documents = [
      { id: '1', docType: 'devis' },
      { id: '2', docType: 'devis', status: '' },
      { id: '3', docType: 'devis', status: 'annule' },
      { id: '4', docType: 'devis', status: 'cancelled' },
      { id: '5', docType: 'devis', status: 'accepte' },
    ]
    expect(alertesChantiers([], documents, maintenant).devisBrouillon.map(d => d.id)).toEqual(['1', '2'])
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

  it('clientsAvecDevis : un devis annulé ne compte pas (il est masqué de la liste des devis)', () => {
    const clients = clientsAvecDevis([
      { docType: 'devis', clientName: 'Mme Dupré', status: 'annule' },
      { docType: 'devis', clientName: 'SCI Les Lilas', status: 'cancelled' },
      { docType: 'devis', clientName: 'M. Roche', status: 'brouillon' },
    ])
    expect([...clients]).toEqual(['m. roche'])
  })

  it('entrées illisibles dans la liste des documents (nulle, texte, nombre) : ignorées, sans erreur', () => {
    const documents = [
      null, undefined, 'devis', 42,
      { id: '1', docType: 'devis', status: 'brouillon', clientName: 'Mme Dupré' },
      { id: '2', docType: 'facture', status: 'envoye', clientName: 3 },
    ] as unknown as DocumentAccueil[]
    const chantiers = [chantier('c1', 'Terminé', '2026-10-01', 'SCI Les Lilas')]
    const alertes = alertesChantiers(chantiers, documents, maintenant)
    expect(alertes.devisBrouillon.map(d => d.id)).toEqual(['1'])
    expect(alertes.terminesSansFacture.map(c => c.id)).toEqual(['c1'])
    expect([...clientsAvecDevis(documents)]).toEqual(['mme dupré'])
  })
})

describe('libelleDevisBrouillon — texte de l’alerte « devis en brouillon »', () => {
  // Un brouillon BTP n'a pas de numéro avant sa validation ; son identifiant technique n'est affiché nulle part.
  const brouillon: DocumentAccueil = {
    id: '7a1e0d55-1111-4222-8333-9c0b1a2d3e4f', docType: 'devis', status: 'brouillon', docNumber: '', clientName: 'SCI Les Lilas',
  }

  it('sans numéro : aucune référence, jamais un morceau de l’identifiant', () => {
    expect(libelleDevisBrouillon(brouillon, false)).toBe('Devis en brouillon — à envoyer (SCI Les Lilas)')
    expect(libelleDevisBrouillon(brouillon, true)).toBe('Orçamento em rascunho, por enviar (SCI Les Lilas)')
  })

  it('avec un numéro (provisoire d’un ancien brouillon) : celui que montre la liste des devis', () => {
    const numerote = { ...brouillon, docNumber: 'BR-2026-001' }
    expect(libelleDevisBrouillon(numerote, false)).toBe('Devis BR-2026-001 en brouillon — à envoyer (SCI Les Lilas)')
    expect(libelleDevisBrouillon(numerote, true)).toBe('Orçamento BR-2026-001 em rascunho, por enviar (SCI Les Lilas)')
  })

  it('sans client : « client » ; identifiant numérique d’un ancien document : pas d’erreur', () => {
    expect(libelleDevisBrouillon({ docType: 'devis' }, false)).toBe('Devis en brouillon — à envoyer (client)')
    expect(libelleDevisBrouillon({ docType: 'devis' }, true)).toBe('Orçamento em rascunho, por enviar (cliente)')
    const ancien = { id: 1779539827817, docType: 'devis', status: 'brouillon' } as unknown as DocumentAccueil
    expect(libelleDevisBrouillon(ancien, false)).toBe('Devis en brouillon — à envoyer (client)')
  })
})
