import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { Obrigacao } from '@/lib/syndic/v54/api'

interface CalRegTextes {
  titre: string
  chapeau: string
  filtres: { immeubleAria: string; immeubleTous: string; statutAria: string; statutTous: string }
  ajouter: string
  kpi: { expirees: string; urgentes: string; proches: string; aJour: string }
  vide: { titre: string; description: string; bouton: string }
  colonnes: { immeuble: string; type: string; description: string; echeance: string; statut: string }
  relatif: { realisee: string; ilYa: (jours: number) => string; dans: (jours: number) => string }
  formulaire: {
    titre: string
    type: string
    typePlaceholder: string
    immeuble: string
    immeublePlaceholder: string
    description: string
    descriptionPlaceholder: string
    echeance: string
    realisee: string
    non: string
    oui: string
    annuler: string
    ajouter: string
  }
  erreurs: { type: string }
  obligationAjoutee: string
  /** Obligations de démonstration (aperçu anonyme). */
  demo: Obrigacao[]
}

export const CAL_REG_MESSAGES = defineMessages<CalRegTextes>({
  'pt-PT': {
    titre: 'Calendário Regulamentar',
    chapeau: 'Acompanhamento das obrigações legais e regulamentares',
    filtres: { immeubleAria: 'Filtrar por edifício', immeubleTous: 'Todos os edifícios', statutAria: 'Filtrar por estado', statutTous: 'Todos os estados' },
    ajouter: 'Adicionar',
    kpi: { expirees: 'Expirados', urgentes: 'Urgentes (< 30d)', proches: 'Próximos (< 90d)', aJour: 'Em dia' },
    vide: {
      titre: 'Sem obrigações registadas',
      description: 'Adicione as obrigações legais e regulamentares dos seus edifícios para as acompanhar.',
      bouton: 'Adicionar obrigação',
    },
    colonnes: { immeuble: 'Edifício', type: 'Tipo', description: 'Descrição', echeance: 'Prazo', statut: 'Estado' },
    relatif: { realisee: 'Concluído', ilYa: (jours) => `Há ${jours}d`, dans: (jours) => `Dentro de ${jours}d` },
    formulaire: {
      titre: 'Nova obrigação regulamentar',
      type: 'Tipo',
      typePlaceholder: 'Inspeção elevador, AG…',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Edifício…',
      description: 'Descrição',
      descriptionPlaceholder: 'Ex.: Inspeção 6 anos elevador',
      echeance: 'Prazo',
      realisee: 'Concluído',
      non: 'Não',
      oui: 'Sim',
      annuler: 'Cancelar',
      ajouter: 'Adicionar',
    },
    erreurs: { type: 'Indique o tipo de obrigação.' },
    obligationAjoutee: 'Obrigação adicionada',
    demo: [
      { id: 'c1', edificio: 'Edifício Foz Douro', tipo: 'Assembleia Geral', descricao: 'AG Anual', prazo: '2026-04-15', concluido: false },
      { id: 'c2', edificio: 'Edifício Foz Douro', tipo: 'Inspeção elevador', descricao: 'Inspeção 2 anos elevador', prazo: '2026-04-30', concluido: false },
      { id: 'c3', edificio: 'Residencial Cedofeita', tipo: 'Renovação seguro', descricao: 'Renovação seguro condomínio', prazo: '2026-06-30', concluido: false },
      { id: 'c4', edificio: 'Condomínio Boavista Center', tipo: 'Inspeção gás', descricao: 'Inspeção 5 anos gás', prazo: '2026-07-20', concluido: false },
      { id: 'c5', edificio: 'Residencial Cedofeita', tipo: 'Verificação elétrica', descricao: 'Verificação instalação elétrica', prazo: '2026-08-10', concluido: false },
      { id: 'c6', edificio: 'Edifício Atlântico', tipo: 'Inspeção elevador', descricao: 'Inspeção 6 anos elevador', prazo: '2026-09-15', concluido: false },
      { id: 'c7', edificio: 'Edifício Atlântico', tipo: 'Assembleia Geral', descricao: 'AG Anual obrigatória', prazo: '2027-03-31', concluido: false },
      { id: 'c8', edificio: 'Condomínio Boavista Center', tipo: 'Manutenção fachada', descricao: 'Manutenção fachada (8 anos)', prazo: '2027-05-30', concluido: false },
    ],
  },
  'fr-FR': {
    titre: 'Calendrier réglementaire',
    chapeau: 'Suivi des obligations légales et réglementaires',
    filtres: { immeubleAria: 'Filtrer par immeuble', immeubleTous: 'Tous les immeubles', statutAria: 'Filtrer par statut', statutTous: 'Tous les statuts' },
    ajouter: 'Ajouter',
    kpi: { expirees: 'En retard', urgentes: 'Urgentes (< 30 j)', proches: 'À venir (< 90 j)', aJour: 'À jour' },
    vide: {
      titre: 'Aucune obligation enregistrée',
      description: 'Ajoutez les obligations légales et réglementaires de vos immeubles pour en assurer le suivi.',
      bouton: 'Ajouter une obligation',
    },
    colonnes: { immeuble: 'Immeuble', type: 'Type', description: 'Description', echeance: 'Échéance', statut: 'Statut' },
    relatif: { realisee: 'Réalisée', ilYa: (jours) => `Il y a ${jours} j`, dans: (jours) => `Dans ${jours} j` },
    formulaire: {
      titre: 'Nouvelle obligation réglementaire',
      type: 'Type',
      typePlaceholder: 'Contrôle ascenseur, AG…',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Immeuble…',
      description: 'Description',
      descriptionPlaceholder: "Ex. : contrôle technique quinquennal de l'ascenseur",
      echeance: 'Échéance',
      realisee: 'Réalisée',
      non: 'Non',
      oui: 'Oui',
      annuler: 'Annuler',
      ajouter: 'Ajouter',
    },
    erreurs: { type: "Indiquez le type d'obligation." },
    obligationAjoutee: 'Obligation ajoutée',
    // Échéancier français : AG annuelle (décret n° 67-223 du 17 mars 1967), contrôle technique
    // quinquennal des ascenseurs (CCH, art. R134-1 et s.), assurance RC du syndicat (art. 9-1 de la
    // loi n° 65-557), DPE collectif (loi Climat et résilience), mandat du syndic (3 ans au plus),
    // plan pluriannuel de travaux actualisé tous les 10 ans (art. 14-2). Mêmes dates qu'en PT.
    demo: [
      { id: 'c1', edificio: 'Résidence Les Berges du Rhône', tipo: 'Assemblée générale', descricao: 'AG annuelle — approbation des comptes et vote du budget', prazo: '2026-04-15', concluido: false },
      { id: 'c2', edificio: 'Résidence Les Berges du Rhône', tipo: 'Contrôle ascenseur', descricao: "Contrôle technique quinquennal de l'ascenseur", prazo: '2026-04-30', concluido: false },
      { id: 'c3', edificio: 'Résidence Croix-Rousse', tipo: 'Renouvellement assurance', descricao: "Renouvellement de l'assurance RC du syndicat", prazo: '2026-06-30', concluido: false },
      { id: 'c4', edificio: 'Copropriété Bellecour Center', tipo: 'Chaufferie collective', descricao: 'Entretien annuel de la chaudière collective', prazo: '2026-07-20', concluido: false },
      { id: 'c5', edificio: 'Résidence Croix-Rousse', tipo: 'DPE collectif', descricao: 'Réalisation du DPE collectif', prazo: '2026-08-10', concluido: false },
      { id: 'c6', edificio: 'Résidence Atlantique', tipo: 'Mandat du syndic', descricao: 'Fin du mandat du syndic — renouvellement à inscrire en AG', prazo: '2026-09-15', concluido: false },
      { id: 'c7', edificio: 'Résidence Atlantique', tipo: 'Assemblée générale', descricao: 'AG annuelle obligatoire', prazo: '2027-03-31', concluido: false },
      { id: 'c8', edificio: 'Copropriété Bellecour Center', tipo: 'Plan pluriannuel de travaux', descricao: 'Actualisation du plan pluriannuel de travaux (tous les 10 ans)', prazo: '2027-05-30', concluido: false },
    ],
  },
})
