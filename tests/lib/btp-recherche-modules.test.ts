// tests/lib/btp-recherche-modules.test.ts
//
// Recherche d'un module dans la barre latérale BTP pro : logique pure (lib/btp/recherche-modules.ts).
// Trois passes — nom du module, puis nom de la rubrique, puis description — sans accents ni casse ;
// chaque mot saisi doit être le début d'un mot du texte.

import { describe, it, expect } from 'vitest'
import { cleDeRecherche, rechercherModules, type ModuleCherchable } from '@/lib/btp/recherche-modules'

// Extrait du menu BTP : identifiant | nom affiché | rubrique | description (libellés réels de
// hooks/useModulesConfig.ts). L'ordre n'est PAS celui du menu : « Météo chantiers » précède « Chantiers » et
// « Devis Fournisseurs » précède « Devis », pour éprouver le choix de la meilleure correspondance.
const MENU: ModuleCherchable[] = `
home|Tableau de bord|Pilotage|Vue d'ensemble de l'activité
gestion_comptes|Comptes utilisateurs|Pilotage|Gérants, conducteurs, chefs de chantier
revenus|Revenus|Pilotage|Suivi du chiffre d'affaires
meteo|Météo chantiers|Chantiers|Prévisions météo par chantier
chantiers|Chantiers|Chantiers|Gestion des chantiers en cours
gantt|Planification Gantt|Chantiers|Planning visuel des chantiers
equipes|Équipes|Chantiers|Gestion des équipes terrain
pointage|Pointage équipes|Chantiers|Pointage GPS temps réel
estimation_materiaux|Estimation matériaux|Chantiers|Quantitatifs DTU et pertes calculées
rapports|Rapports de chantier|Chantiers|Rapports journaliers et hebdomadaires
pipeline|Pipeline|Commercial|Suivi commercial des devis
rfq_btp|Devis Fournisseurs|Sous-traitance & Achats|Demandes de prix fournisseurs
devis|Devis|Commercial|Création et envoi de devis
dpgf|Appels d'offres / DPGF|Commercial|Réponse aux appels d'offres
factures|Factures|Facturation|Facturation et suivi paiements
situations|Situations de travaux|Facturation|Avancement et facturation progressive
sous_traitance|Sous-traitance DC4|Sous-traitance & Achats|Formulaires DC4 réglementaires
sous_traitance_offres|Recruter sous-traitants|Sous-traitance & Achats|Recherche de sous-traitants
compta_btp|Compta Intelligente|Finances|Comptabilité assistée par IA
rentabilite|Rentabilité Chantier|Finances|Budget prévu vs réalisé
comptabilite|Comptabilité|Finances|Revenus, dépenses, TVA
settings|Mon profil|Compte|Paramètres du compte
`.trim().split('\n').map(ligne => {
  const [id, libelle, rubrique, description] = ligne.split('|')
  return { id, libelle, rubrique, description }
})

const ids = (saisie: string) => rechercherModules(saisie, MENU).ids
const meilleur = (saisie: string) => rechercherModules(saisie, MENU).meilleur

describe('cleDeRecherche', () => {
  it('retire accents, casse et ponctuation', () => {
    expect(cleDeRecherche('Équipes')).toBe('equipes')
    expect(cleDeRecherche("Appels d'offres / DPGF")).toBe('appels d offres dpgf')
    expect(cleDeRecherche('  Sous-traitance   & Achats ')).toBe('sous traitance achats')
    expect(cleDeRecherche('Orçamentos')).toBe('orcamentos')
    expect(cleDeRecherche("Main-d'œuvre")).toBe('main d oeuvre')
    expect(cleDeRecherche('Curriculum vitæ')).toBe('curriculum vitae')
  })

  it('une saisie sans lettre ni chiffre, ou un texte absent, donne une clé vide', () => {
    for (const texte of ['', '   ', ' - / ', null, undefined]) expect(cleDeRecherche(texte)).toBe('')
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
    expect(ids('EQUIPES')).toEqual(['equipes', 'pointage'])
    expect(meilleur('EQUIPES')).toBe('equipes')
    expect(ids('meteo')).toEqual(['meteo'])
  })

  it('le nom exact passe devant, quel que soit l’ordre : « devis » → Devis avant Devis Fournisseurs', () => {
    // L'ordre reçu est conservé pour l'affichage…
    expect(ids('devis')).toEqual(['rfq_btp', 'devis'])
    // …mais Entrée ouvre le module dont c'est le nom.
    expect(meilleur('devis')).toBe('devis')
  })

  it('un nom qui commence par la saisie passe devant un nom qui la contient plus loin', () => {
    expect(ids('chantier')).toEqual(['meteo', 'chantiers', 'rapports', 'rentabilite'])
    expect(meilleur('chantier')).toBe('chantiers')
  })

  it('à qualité égale, le premier reçu : « compt » → Comptes utilisateurs', () => {
    expect(ids('compt')).toEqual(['gestion_comptes', 'compta_btp', 'comptabilite'])
    expect(meilleur('compt')).toBe('gestion_comptes')
  })

  it('plusieurs mots : chacun doit commencer un mot du nom, dans n’importe quel ordre', () => {
    expect(ids('sous traitance')).toEqual(['sous_traitance'])
    expect(ids('appel offre')).toEqual(['dpgf'])
    expect(ids('fournisseurs devis')).toEqual(['rfq_btp'])
    expect(rechercherModules('devis fournisseurs', MENU)).toEqual({ active: true, ids: ['rfq_btp'], meilleur: 'rfq_btp' })
  })

  it('un nom trouvé écarte la rubrique et la description : « devis » ne remonte pas Pipeline', () => {
    // Pipeline a « devis » dans sa description, Gantt est dans la rubrique « Chantiers ».
    expect(ids('devis')).not.toContain('pipeline')
    expect(ids('chantier')).not.toContain('gantt')
  })
})

describe('rechercherModules — jamais au milieu d’un mot', () => {
  it('« ia » trouve la description « assistée par IA », pas « Estimation matériaux »', () => {
    expect(rechercherModules('ia', MENU)).toEqual({ active: true, ids: ['compta_btp'], meilleur: 'compta_btp' })
  })

  it('« port » ne trouve pas « Rapports de chantier », « tabilité » ne trouve pas « Comptabilité »', () => {
    expect(ids('port')).toEqual([])
    expect(ids('tabilité')).toEqual([])
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
    expect(ids('facturation')).toEqual(['factures', 'situations'])
  })

  it('nom + rubrique : « achats devis » → Devis Fournisseurs', () => {
    expect(ids('achats devis')).toEqual(['rfq_btp'])
  })

  it('la rubrique passe avant la description', () => {
    const deux: ModuleCherchable[] = [
      { id: 'par-description', libelle: 'Alpha', rubrique: 'Divers', description: 'Outil de pilotage' },
      { id: 'par-rubrique', libelle: 'Bêta', rubrique: 'Pilotage' },
    ]
    expect(rechercherModules('pilotage', deux)).toEqual({ active: true, ids: ['par-rubrique'], meilleur: 'par-rubrique' })
  })
})

describe('rechercherModules — passe 3 : la description', () => {
  it('« tva » → Comptabilité ; « gps » → Pointage ; « paramètres » → Mon profil', () => {
    expect(ids('tva')).toEqual(['comptabilite'])
    expect(ids('gps')).toEqual(['pointage'])
    expect(rechercherModules('paramètres', MENU)).toEqual({ active: true, ids: ['settings'], meilleur: 'settings' })
  })

  it("« chiffre d'affaires » → Revenus", () => {
    expect(ids("chiffre d'affaires")).toEqual(['revenus'])
  })
})

describe('rechercherModules — rien trouvé, données abîmées', () => {
  it('recherche active, aucun résultat, rien à ouvrir', () => {
    expect(rechercherModules('zzzz', MENU)).toEqual({ active: true, ids: [], meilleur: null })
    expect(rechercherModules('devis', [])).toEqual({ active: true, ids: [], meilleur: null })
  })

  it('un module enregistré sans nom ne fait pas échouer la recherche', () => {
    const sansNom = [{ id: 'abime', libelle: undefined, rubrique: 'Chantiers' }] as unknown as ModuleCherchable[]
    expect(rechercherModules('devis', sansNom).ids).toEqual([])
    expect(rechercherModules('chantiers', sansNom).ids).toEqual(['abime'])
  })
})
