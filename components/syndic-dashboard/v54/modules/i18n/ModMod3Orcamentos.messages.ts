import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { Obra } from '@/lib/syndic/v54/api'

/** Étape d'un chantier (code de l'API, inchangé dans les deux langues). */
type EtapeObra = Obra['estado']

/**
 * Textes de l'écran « Orçamentos & Obras » (règle PT des 3 devis, Lei 8/2022) /
 * « Travaux & mise en concurrence » (art. 21 de la loi du 10 juillet 1965 : seuil de
 * mise en concurrence fixé par l'AG ; art. 19-2 du décret du 17 mars 1967).
 */
interface Mod3OrcamentosTextes {
  titre: string
  chapeau: string
  kpi: { actifs: string; consultation: string; vote: string; execution: string; termines: string; totalDevis: string }
  onglets: { cur: string; cmp: string; arq: string; reg: string }
  nouveau: string
  /** Titres des colonnes du kanban et options du sélecteur d'étape. */
  colonnes: Record<EtapeObra, string>
  aucun: string
  carte: { echeance: string; montant: string; nbDevis: string; comparer: string; etapeAria: string }
  comparaison: {
    titre: string
    rappel: string
    aucunDevis: string
    entreprise: string
    montant: string
    delai: string
    recommande: string
    moinsDisant: string
    jours: (n: number) => string
    nomEntreprise: string
    montantEuros: string
    delaiJours: string
    ajouter: string
    ajoute: string
    fermer: string
  }
  formulaire: {
    titre: string
    intitule: string
    intitulePlaceholder: string
    type: string
    typePlaceholder: string
    etape: string
    description: string
    lieu: string
    lieuPlaceholder: string
    echeance: string
    montant: string
    montantAide: string
    nbDevis: string
    nbDevisAide: string
    entreprise: string
    entreprisePlaceholder: string
    annuler: string
    creer: string
  }
  erreurIntitule: string
  cree: string
  /** Chantiers de démonstration (preview anonyme). */
  demo: Obra[]
}

export const MOD3_ORCAMENTOS_MESSAGES = defineMessages<Mod3OrcamentosTextes>({
  'pt-PT': {
    titre: 'Orçamentos & Obras',
    chapeau: 'Comparação obrigatória de 3 orçamentos · Lei 8/2022 Art. 1436.° CC',
    kpi: { actifs: 'Obras Ativas', consultation: 'Em Orçamentação', vote: 'Aprovação AG', execution: 'Em Execução', termines: 'Concluídas', totalDevis: 'Total Orçamentos' },
    onglets: { cur: 'Obras em Curso', cmp: 'Comparação Orçamentos', arq: 'Arquivo', reg: 'Regras' },
    nouveau: '+ Nova Obra',
    colonnes: { orcamentacao: 'Orçamentação', aprovacao_ag: 'Aprovação AG', execucao: 'Em Execução', concluida: 'Concluída' },
    aucun: 'Nenhuma obra',
    carte: { echeance: 'Prazo: ', montant: 'Orçamento: ', nbDevis: '/3 orçamentos', comparer: 'Comparar', etapeAria: 'Estado da obra' },
    comparaison: {
      titre: 'Comparar orçamentos',
      rappel: 'Lei 8/2022 — mínimo 3 orçamentos antes da aprovação em AG.',
      aucunDevis: 'Nenhum orçamento registado. Adicione abaixo.',
      entreprise: 'Empresa',
      montant: 'Valor',
      delai: 'Prazo',
      recommande: 'Recomendado',
      moinsDisant: 'Mais baixo',
      jours: (n) => `${n} dias`,
      nomEntreprise: 'Nome da empresa',
      montantEuros: 'Valor (€)',
      delaiJours: 'Prazo (dias)',
      ajouter: 'Adicionar orçamento',
      ajoute: 'Orçamento adicionado',
      fermer: 'Fechar',
    },
    formulaire: {
      titre: 'Nova obra',
      intitule: 'Título',
      intitulePlaceholder: 'Ex.: Impermeabilização da cobertura',
      type: 'Tipo',
      typePlaceholder: 'Reparação, Renovação…',
      etape: 'Estado',
      description: 'Descrição',
      lieu: 'Local',
      lieuPlaceholder: 'Edifício / morada',
      echeance: 'Prazo',
      montant: 'Orçamento',
      montantAide: 'Valor retido (€)',
      nbDevis: 'N.º de orçamentos',
      nbDevisAide: 'Mín. 3 (Lei 8/2022)',
      entreprise: 'Empresa adjudicada',
      entreprisePlaceholder: 'Nome da empresa (se já escolhida)',
      annuler: 'Cancelar',
      creer: 'Criar obra',
    },
    erreurIntitule: 'Indique o título da obra.',
    cree: 'Obra criada',
    demo: [
      { id: 'p1', titulo: 'Impermeabilização da cobertura', tipo: 'Reparação', descricao: 'Reparação e impermeabilização completa da cobertura do edifício principal, inclu…', local: 'Edifício Av. da Liberdade, 42', prazo: '2026-06-30', estado: 'orcamentacao', orcamento: 0, empresa: '', numOrcamentos: 3 },
      { id: 'p2', titulo: 'Renovação da fachada exterior', tipo: 'Renovação', descricao: 'Pintura e restauro da fachada com tratamento anti-humidade e limpeza de cantaria…', local: 'Edifício Rua Augusta, 105', prazo: '2026-09-15', estado: 'aprovacao_ag', orcamento: 29800, empresa: 'ConstruPT Lda.', numOrcamentos: 3 },
    ],
  },
  'fr-FR': {
    titre: 'Travaux & mise en concurrence',
    chapeau: "Mise en concurrence obligatoire au-delà du seuil fixé par l'AG · art. 21 de la loi du 10 juillet 1965 · art. 19-2 du décret du 17 mars 1967",
    kpi: { actifs: 'Chantiers actifs', consultation: 'En consultation', vote: 'À voter en AG', execution: 'En cours de réalisation', termines: 'Terminés', totalDevis: 'Total des devis' },
    onglets: { cur: 'Travaux en cours', cmp: 'Comparaison des devis', arq: 'Archives', reg: 'Règles' },
    nouveau: '+ Nouveau chantier',
    colonnes: { orcamentacao: 'Consultation (devis)', aprovacao_ag: 'À voter en AG', execucao: 'En cours de réalisation', concluida: 'Terminé' },
    aucun: 'Aucun chantier',
    carte: { echeance: 'Échéance : ', montant: 'Montant retenu : ', nbDevis: ' devis', comparer: 'Comparer', etapeAria: 'Étape du chantier' },
    comparaison: {
      titre: 'Comparer les devis',
      rappel: "Au-delà du seuil voté par l'AG (art. 21 de la loi du 10 juillet 1965), plusieurs entreprises sont mises en concurrence avant le vote en AG (art. 19-2 du décret du 17 mars 1967).",
      aucunDevis: 'Aucun devis enregistré. Ajoutez-en un ci-dessous.',
      entreprise: 'Entreprise',
      montant: 'Montant',
      delai: 'Délai',
      recommande: 'Recommandé',
      moinsDisant: 'Moins-disant',
      jours: (n) => `${n} jour${n > 1 ? 's' : ''}`,
      nomEntreprise: "Nom de l'entreprise",
      montantEuros: 'Montant (€)',
      delaiJours: 'Délai (jours)',
      ajouter: 'Ajouter un devis',
      ajoute: 'Devis ajouté',
      fermer: 'Fermer',
    },
    formulaire: {
      titre: 'Nouveau chantier',
      intitule: 'Intitulé',
      intitulePlaceholder: 'Ex. : Étanchéité de la toiture-terrasse',
      type: 'Type',
      typePlaceholder: 'Réparation, rénovation…',
      etape: 'Étape',
      description: 'Description',
      lieu: 'Lieu',
      lieuPlaceholder: 'Immeuble / adresse',
      echeance: 'Échéance',
      montant: 'Montant',
      montantAide: 'Montant du devis retenu (€)',
      nbDevis: 'Nombre de devis',
      nbDevisAide: "Plusieurs devis au-delà du seuil voté en AG (art. 21 de la loi de 1965)",
      entreprise: 'Entreprise retenue',
      entreprisePlaceholder: "Nom de l'entreprise (si déjà choisie)",
      annuler: 'Annuler',
      creer: 'Créer le chantier',
    },
    erreurIntitule: "Indiquez l'intitulé du chantier.",
    cree: 'Chantier créé',
    demo: [
      { id: 'p1', titulo: 'Étanchéité de la toiture-terrasse', tipo: 'Réparation', descricao: "Réparation et réfection complète de l'étanchéité de la toiture-terrasse du bâtiment principal, y compr…", local: "Immeuble du 42, avenue de l'Opéra", prazo: '2026-06-30', estado: 'orcamentacao', orcamento: 0, empresa: '', numOrcamentos: 3 },
      { id: 'p2', titulo: 'Ravalement de la façade', tipo: 'Rénovation', descricao: 'Peinture et restauration de la façade avec traitement anti-humidité et nettoyage de la pierre de taille…', local: 'Immeuble du 105, rue de Rivoli', prazo: '2026-09-15', estado: 'aprovacao_ag', orcamento: 29800, empresa: 'ConstruRhône SAS', numOrcamentos: 3 },
    ],
  },
})
