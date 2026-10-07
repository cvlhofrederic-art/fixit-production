import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { PlanoMan } from '@/lib/syndic/v54/api'

type EtatPlan = PlanoMan['estado']

interface PlanoManTextes {
  titre: string
  chapeau: string
  nouveauPlan: string
  cadre: { titre: string; texte: string }
  kpi: { crees: string; adoptes: string; enPreparation: string; budgetTotal: string }
  vide: { titre: string; desc: string; action: string }
  colonnes: { titre: string; immeuble: string; debut: string; periodicite: string; budget: string; statut: string }
  etats: Record<EtatPlan, string>
  modal: {
    titre: string
    champTitre: string
    titrePlaceholder: string
    immeuble: string
    immeublePlaceholder: string
    statut: string
    /** Libellés des options du statut (l'option « aprovado » précise « en AG »). */
    options: Record<EtatPlan, string>
    anneeDebut: string
    periodicite: string
    /** Valeur proposée par défaut et exemple du champ « périodicité » (texte libre). */
    periodiciteDefaut: string
    budget: string
    budgetAide: string
    description: string
    descriptionPlaceholder: string
    annuler: string
    creer: string
  }
  erreurTitre: string
  cree: string
}

export const PLANO_MAN_MESSAGES = defineMessages<PlanoManTextes>({
  'pt-PT': {
    titre: 'Plano de Manutenção',
    chapeau: 'Conservação obrigatória 8 anos — DL 555/99 art. 89.°',
    nouveauPlan: '+ Novo plano',
    cadre: {
      titre: 'Obrigação Legal — DL 555/99 art. 89.°',
      texte: 'Os edifícios devem ser objeto de obras de conservação pelo menos uma vez em cada período de 8 anos. A câmara municipal pode determinar a execução de obras de conservação necessárias.',
    },
    kpi: { crees: 'Planos criados', adoptes: 'Aprovados em AG', enPreparation: 'Em preparação', budgetTotal: 'Orçamento total' },
    vide: {
      titre: 'Nenhum plano de manutenção',
      desc: 'Comece por criar o plano de conservação para os seus edifícios.',
      action: '+ Criar plano',
    },
    colonnes: { titre: 'Título', immeuble: 'Edifício', debut: 'Início', periodicite: 'Periodicidade', budget: 'Orçamento', statut: 'Estado' },
    etats: { preparacao: 'Em preparação', aprovado: 'Aprovado', concluido: 'Concluído' },
    modal: {
      titre: 'Novo plano de manutenção',
      champTitre: 'Título',
      titrePlaceholder: 'Ex.: Conservação fachada e cobertura',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Edifício…',
      statut: 'Estado',
      options: { preparacao: 'Em preparação', aprovado: 'Aprovado em AG', concluido: 'Concluído' },
      anneeDebut: 'Ano de início',
      periodicite: 'Periodicidade',
      periodiciteDefaut: '8 anos',
      budget: 'Orçamento',
      budgetAide: 'Valor em euros',
      description: 'Descrição',
      descriptionPlaceholder: 'Obras de conservação previstas…',
      annuler: 'Cancelar',
      creer: 'Criar plano',
    },
    erreurTitre: 'Indique o título do plano.',
    cree: 'Plano criado',
  },
  'fr-FR': {
    titre: 'Plan pluriannuel de travaux',
    chapeau: "Projet établi sur la base d'un diagnostic de l'immeuble, adopté en AG — art. 14-2 de la loi du 10 juillet 1965",
    nouveauPlan: '+ Nouveau plan',
    cadre: {
      titre: 'Obligation légale — art. 14-2 de la loi du 10 juillet 1965',
      texte: "Dans les immeubles à destination totale ou partielle d'habitation, à l'expiration d'un délai de 15 ans après la réception des travaux de construction, un projet de plan pluriannuel de travaux est élaboré par un professionnel qualifié, à partir d'une analyse du bâti et des équipements, du diagnostic de performance énergétique et, le cas échéant, du diagnostic technique global. Il liste et chiffre les travaux à prévoir sur dix ans, les hiérarchise et propose un échéancier ; il est actualisé tous les dix ans, puis soumis à l'adoption de l'assemblée générale. Le fonds de travaux est alors alimenté d'au moins 2,5 % du montant des travaux du plan adopté (art. 14-2-1).",
    },
    kpi: { crees: 'Plans créés', adoptes: 'Adoptés en AG', enPreparation: 'En préparation', budgetTotal: 'Budget total estimé' },
    vide: {
      titre: 'Aucun plan pluriannuel de travaux',
      desc: 'Commencez par créer le projet de plan pluriannuel de travaux de vos immeubles.',
      action: '+ Créer un plan',
    },
    colonnes: { titre: 'Titre', immeuble: 'Immeuble', debut: 'Début', periodicite: 'Périodicité', budget: 'Budget estimé', statut: 'Statut' },
    etats: { preparacao: 'En préparation', aprovado: 'Adopté', concluido: 'Réalisé' },
    modal: {
      titre: 'Nouveau plan pluriannuel de travaux',
      champTitre: 'Titre',
      titrePlaceholder: 'Ex. : Ravalement de façade et réfection de la toiture',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Immeuble…',
      statut: 'Statut',
      options: { preparacao: 'En préparation', aprovado: 'Adopté en AG', concluido: 'Réalisé' },
      anneeDebut: 'Année de début',
      periodicite: 'Périodicité',
      periodiciteDefaut: '10 ans',
      budget: 'Budget estimé',
      budgetAide: 'Montant en euros',
      description: 'Description',
      descriptionPlaceholder: 'Travaux de conservation, de sécurité et de performance énergétique prévus…',
      annuler: 'Annuler',
      creer: 'Créer le plan',
    },
    erreurTitre: 'Indiquez le titre du plan.',
    cree: 'Plan créé',
  },
})
