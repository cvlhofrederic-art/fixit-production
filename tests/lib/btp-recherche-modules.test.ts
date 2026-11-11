// tests/lib/btp-recherche-modules.test.ts
//
// Recherche d'un module dans la barre latérale BTP pro : logique pure (lib/btp/recherche-modules.ts).
// Trois passes — nom du module, puis nom de la rubrique, puis description — sans accents ni casse.

import { describe, it, expect } from 'vitest'
import { cleDeRecherche, rechercherModules, type ModuleCherchable } from '@/lib/btp/recherche-modules'

// Extrait du menu BTP, dans l'ordre d'affichage (libellés réels de hooks/useModulesConfig.ts).
const MENU: ModuleCherchable[] = [
  { id: 'home', libelle: 'Tableau de bord', rubrique: 'Pilotage', description: "Vue d'ensemble de l'activité" },
  { id: 'gestion_comptes', libelle: 'Comptes utilisateurs', rubrique: 'Pilotage', description: 'Gérants, conducteurs, chefs de chantier' },
  { id: 'revenus', libelle: 'Revenus', rubrique: 'Pilotage', description: "Suivi du chiffre d'affaires" },
  { id: 'meteo', libelle: 'Météo chantiers', rubrique: 'Chantiers', description: 'Prévisions météo par chantier' },
  { id: 'chantiers', libelle: 'Chantiers', rubrique: 'Chantiers', description: 'Gestion des chantiers en cours' },
  { id: 'gantt', libelle: 'Planification Gantt', rubrique: 'Chantiers', description: 'Planning visuel des chantiers' },
  { id: 'equipes', libelle: 'Équipes', rubrique: 'Chantiers', description: 'Gestion des équipes terrain' },
  { id: 'pointage', libelle: 'Pointage équipes', rubrique: 'Chantiers', description: 'Pointage GPS temps réel' },
  { id: 'pipeline', libelle: 'Pipeline', rubrique: 'Commercial', description: 'Suivi commercial des devis' },
  { id: 'rfq_btp', libelle: 'Devis Fournisseurs', rubrique: 'Sous-traitance & Achats', description: 'Demandes de prix fournisseurs' },
  { id: 'devis', libelle: 'Devis', rubrique: 'Commercial', description: 'Création et envoi de devis' },
  { id: 'dpgf', libelle: "Appels d'offres / DPGF", rubrique: 'Commercial', description: "Réponse aux appels d'offres" },
  { id: 'factures', libelle: 'Factures', rubrique: 'Facturation', description: 'Facturation et suivi paiements' },
  { id: 'situations', libelle: 'Situations de travaux', rubrique: 'Facturation', description: 'Avancement et facturation progressive' },
  { id: 'sous_traitance', libelle: 'Sous-traitance DC4', rubrique: 'Sous-traitance & Achats', description: 'Formulaires DC4 réglementaires' },
  { id: 'sous_traitance_offres', libelle: 'Recruter sous-traitants', rubrique: 'Sous-traitance & Achats', description: 'Recherche de sous-traitants' },
  { id: 'compta_btp', libelle: 'Compta Intelligente', rubrique: 'Finances', description: 'Comptabilité assistée par IA' },
  { id: 'rentabilite', libelle: 'Rentabilité Chantier', rubrique: 'Finances', description: 'Budget prévu vs réalisé' },
  { id: 'comptabilite', libelle: 'Comptabilité', rubrique: 'Finances', description: 'Revenus, dépenses, TVA' },
  { id: 'settings', libelle: 'Mon profil', rubrique: 'Compte', description: 'Paramètres du compte' },
]

describe('cleDeRecherche', () => {
  it('retire accents, casse et ponctuation', () => {
    expect(cleDeRecherche('Équipes')).toBe('equipes')
    expect(cleDeRecherche("Appels d'offres / DPGF")).toBe('appels d offres dpgf')
    expect(cleDeRecherche('  Sous-traitance   & Achats ')).toBe('sous traitance achats')
    expect(cleDeRecherche('Orçamentos')).toBe('orcamentos')
    expect(cleDeRecherche("Main-d'œuvre")).toBe('main d oeuvre')
  })

  it('une saisie sans lettre ni chiffre donne une clé vide', () => {
    expect(cleDeRecherche('')).toBe('')
    expect(cleDeRecherche('   ')).toBe('')
    expect(cleDeRecherche(' - / ')).toBe('')
  })
})

describe('rechercherModules — saisie vide', () => {
  it('rien de saisi (ou seulement des espaces et de la ponctuation) : recherche inactive', () => {
    for (const saisie of ['', '   ', '-', ' / ']) {
      expect(rechercherModules(saisie, MENU)).toEqual({ active: false, ids: [], meilleur: null })
    }
  })
})

describe('rechercherModules — passe 1 : le nom du module', () => {
  it('début de nom : « fact » → Factures seulement', () => {
    expect(rechercherModules('fact', MENU)).toEqual({ active: true, ids: ['factures'], meilleur: 'factures' })
  })

  it('sans accents ni casse : « EQUIPES », « meteo »', () => {
    expect(rechercherModules('EQUIPES', MENU).ids).toEqual(['equipes', 'pointage'])
    expect(rechercherModules('EQUIPES', MENU).meilleur).toBe('equipes')
    expect(rechercherModules('meteo', MENU).ids).toEqual(['meteo'])
  })

  it('le nom exact passe devant, quel que soit l’ordre du menu : « devis » → Devis avant Devis Fournisseurs', () => {
    const resultat = rechercherModules('devis', MENU)
    // Ordre du menu conservé pour l'affichage…
    expect(resultat.ids).toEqual(['rfq_btp', 'devis'])
    // …mais Entrée ouvre le module dont c'est le nom.
    expect(resultat.meilleur).toBe('devis')
  })

  it('un nom qui commence par la saisie passe devant un nom qui la contient plus loin', () => {
    const resultat = rechercherModules('chantier', MENU)
    expect(resultat.ids).toEqual(['meteo', 'chantiers', 'rentabilite'])
    expect(resultat.meilleur).toBe('chantiers')
  })

  it('à qualité égale, le premier du menu : « compt » → Comptes utilisateurs', () => {
    const resultat = rechercherModules('compt', MENU)
    expect(resultat.ids).toEqual(['gestion_comptes', 'compta_btp', 'comptabilite'])
    expect(resultat.meilleur).toBe('gestion_comptes')
  })

  it('plusieurs mots : tous doivent figurer dans le nom', () => {
    expect(rechercherModules('sous traitance', MENU).ids).toEqual(['sous_traitance'])
    expect(rechercherModules('appel offre', MENU).ids).toEqual(['dpgf'])
    expect(rechercherModules('devis fournisseurs', MENU)).toEqual({ active: true, ids: ['rfq_btp'], meilleur: 'rfq_btp' })
  })

  it('un nom trouvé écarte la rubrique et la description : « devis » ne remonte pas Pipeline', () => {
    // Pipeline a « devis » dans sa description, Gantt est dans la rubrique « Chantiers ».
    expect(rechercherModules('devis', MENU).ids).not.toContain('pipeline')
    expect(rechercherModules('chantier', MENU).ids).not.toContain('gantt')
  })
})

describe('rechercherModules — passe 2 : le nom de la rubrique', () => {
  it('« finances » → les modules de la rubrique, Entrée ouvre le premier', () => {
    expect(rechercherModules('finances', MENU)).toEqual({
      active: true,
      ids: ['compta_btp', 'rentabilite', 'comptabilite'],
      meilleur: 'compta_btp',
    })
  })

  it('« facturation » → Factures et Situations de travaux', () => {
    expect(rechercherModules('facturation', MENU).ids).toEqual(['factures', 'situations'])
  })

  it('nom + rubrique : « achats devis » → Devis Fournisseurs', () => {
    expect(rechercherModules('achats devis', MENU).ids).toEqual(['rfq_btp'])
  })
})

describe('rechercherModules — passe 3 : la description', () => {
  it('« tva » → Comptabilité ; « gps » → Pointage ; « paramètres » → Mon profil', () => {
    expect(rechercherModules('tva', MENU).ids).toEqual(['comptabilite'])
    expect(rechercherModules('gps', MENU).ids).toEqual(['pointage'])
    expect(rechercherModules('paramètres', MENU)).toEqual({ active: true, ids: ['settings'], meilleur: 'settings' })
  })

  it("« chiffre d'affaires » → Revenus", () => {
    expect(rechercherModules("chiffre d'affaires", MENU).ids).toEqual(['revenus'])
  })
})

describe('rechercherModules — rien trouvé', () => {
  it('recherche active, aucun résultat, rien à ouvrir', () => {
    expect(rechercherModules('zzzz', MENU)).toEqual({ active: true, ids: [], meilleur: null })
  })

  it('liste vide', () => {
    expect(rechercherModules('devis', [])).toEqual({ active: true, ids: [], meilleur: null })
  })
})
