import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { PillKind } from '../../primitives/pill'
import type { IconName } from '@/lib/syndic/icon-names'

/** Échéance affichée (démonstration ou vraie obligation du cabinet). */
export interface PrazoLigne {
  id: string | null
  icon: IconName
  titulo: string
  edificio: string
  data: string
  prazo: string
  kind: PillKind
  realizado: boolean
}

interface PrazosLegaisTextes {
  titre: string
  chapeau: string
  autoDemarrage: string
  ajouter: string
  kpi: { total: string; enRetard: string; urgent: string; realises: string }
  filtreImmeubleAria: string
  tousImmeubles: string
  filtreStatutAria: string
  tousStatuts: string
  vide: string
  /** Délai restant affiché dans la pastille (n en jours). */
  enRetard: (n: number) => string
  dans: (n: number) => string
  realise: string
  marquerRealise: string
  supprimerAria: string
  supprimer: string
  demo: PrazoLigne[]
  formulaire: {
    titre: string
    intitule: string
    intitulePlaceholder: string
    immeuble: string
    facultatif: string
    dateLimite: string
    datePlaceholder: string
    type: string
    typePlaceholder: string
    annuler: string
    ajouter: string
  }
  erreurs: { intitule: string }
  toasts: {
    ajoutee: string
    erreurAjout: string
    reessayerPlusTard: string
    ajouteeDemo: string
    connexionRequise: string
    marquee: string
    erreur: string
    marqueeDemo: string
    supprimee: string
    erreurSuppression: string
    supprimeeDemo: string
  }
}

export const PRAZOS_LEGAIS_MESSAGES = defineMessages<PrazosLegaisTextes>({
  'pt-PT': {
    titre: 'Prazos Legais',
    chapeau: 'Acompanhamento das obrigações regulamentares multi-edifícios',
    autoDemarrage: 'Auto-iniciar',
    ajouter: '+ Adicionar',
    kpi: { total: 'Total', enRetard: 'Em atraso', urgent: 'Urgente < 30d', realises: 'Realizados' },
    filtreImmeubleAria: 'Filtrar por edifício',
    tousImmeubles: 'Todos os edifícios',
    filtreStatutAria: 'Filtrar por estado',
    tousStatuts: 'Todos os estados',
    vide: 'Nenhuma obrigação registada.',
    enRetard: (n) => `Em atraso ${n}d`,
    dans: (n) => `Dentro de ${n}d`,
    realise: 'Realizado',
    marquerRealise: 'Marcar como realizado',
    supprimerAria: 'Eliminar prazo legal',
    supprimer: 'Eliminar',
    demo: [
      { id: null, icon: 'flame', titulo: 'Limpeza de chaminés', edificio: 'Edifício Atlântico', data: '21 de novembro de 2026', prazo: 'Dentro de 181d', kind: 'sage', realizado: false },
      { id: null, icon: 'flame', titulo: 'Limpeza de chaminés', edificio: 'Condomínio Boavista Center', data: '21 de novembro de 2026', prazo: 'Dentro de 181d', kind: 'sage', realizado: false },
      { id: null, icon: 'flame', titulo: 'Limpeza de chaminés', edificio: 'Residencial Cedofeita', data: '21 de novembro de 2026', prazo: 'Dentro de 181d', kind: 'sage', realizado: false },
      { id: null, icon: 'flame', titulo: 'Limpeza de chaminés', edificio: 'Edifício Foz Douro', data: '21 de novembro de 2026', prazo: 'Dentro de 181d', kind: 'sage', realizado: false },
      { id: null, icon: 'bank', titulo: 'AG anual', edificio: 'Edifício Atlântico', data: '21 de maio de 2027', prazo: 'Dentro de 362d', kind: 'sage', realizado: false },
      { id: null, icon: 'chart', titulo: 'Orçamento previsional', edificio: 'Edifício Atlântico', data: '21 de maio de 2027', prazo: 'Dentro de 362d', kind: 'sage', realizado: false },
      { id: null, icon: 'flame', titulo: 'Verificação de extintores', edificio: 'Edifício Atlântico', data: '21 de maio de 2027', prazo: 'Dentro de 362d', kind: 'sage', realizado: false },
      { id: null, icon: 'alert', titulo: 'Plano de gestão de amianto', edificio: 'Edifício Atlântico', data: '21 de maio de 2029', prazo: 'Dentro de 1093d', kind: 'amber', realizado: false },
      { id: null, icon: 'alert', titulo: 'Plano de gestão de amianto', edificio: 'Condomínio Boavista Center', data: '21 de maio de 2029', prazo: 'Dentro de 1093d', kind: 'amber', realizado: false },
      { id: null, icon: 'alert', titulo: 'Plano de gestão de amianto', edificio: 'Residencial Cedofeita', data: '21 de maio de 2029', prazo: 'Dentro de 1093d', kind: 'amber', realizado: false },
      { id: null, icon: 'alert', titulo: 'Plano de gestão de amianto', edificio: 'Edifício Foz Douro', data: '21 de maio de 2029', prazo: 'Dentro de 1093d', kind: 'amber', realizado: false },
      { id: null, icon: 'elevator', titulo: 'Inspeção elevador', edificio: 'Edifício Atlântico', data: '21 de maio de 2031', prazo: 'Dentro de 1823d', kind: 'gold', realizado: false },
    ],
    formulaire: {
      titre: 'Adicionar obrigação',
      intitule: 'Título',
      intitulePlaceholder: 'Ex.: Inspeção elevador',
      immeuble: 'Edifício',
      facultatif: 'Opcional',
      dateLimite: 'Data limite',
      datePlaceholder: 'AAAA-MM-DD',
      type: 'Tipo',
      typePlaceholder: 'Ex.: Segurança, AG, Manutenção…',
      annuler: 'Cancelar',
      ajouter: 'Adicionar',
    },
    erreurs: { intitule: 'O título é obrigatório.' },
    toasts: {
      ajoutee: 'Obrigação adicionada',
      erreurAjout: 'Erro ao adicionar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      ajouteeDemo: 'Obrigação adicionada (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
      marquee: 'Marcado como realizado',
      erreur: 'Erro',
      marqueeDemo: 'Marcado (demo)',
      supprimee: 'Obrigação eliminada',
      erreurSuppression: 'Erro ao eliminar',
      supprimeeDemo: 'Eliminado (demo)',
    },
  },
  'fr-FR': {
    titre: 'Délais légaux',
    chapeau: 'Suivi des obligations réglementaires de toutes vos copropriétés',
    autoDemarrage: 'Démarrage auto',
    ajouter: '+ Ajouter',
    kpi: { total: 'Total', enRetard: 'En retard', urgent: 'Urgentes < 30 j', realises: 'Réalisées' },
    filtreImmeubleAria: 'Filtrer par immeuble',
    tousImmeubles: 'Tous les immeubles',
    filtreStatutAria: 'Filtrer par statut',
    tousStatuts: 'Tous les statuts',
    vide: 'Aucune obligation enregistrée.',
    enRetard: (n) => `En retard de ${n} j`,
    dans: (n) => `Dans ${n} j`,
    realise: 'Réalisée',
    marquerRealise: 'Marquer comme réalisée',
    supprimerAria: "Supprimer l'échéance",
    supprimer: 'Supprimer',
    demo: [
      { id: null, icon: 'flame', titulo: 'Ramonage des conduits de fumée', edificio: 'Résidence Atlantique', data: '21 novembre 2026', prazo: 'Dans 181 j', kind: 'sage', realizado: false },
      { id: null, icon: 'flame', titulo: 'Ramonage des conduits de fumée', edificio: 'Copropriété Bellecour Center', data: '21 novembre 2026', prazo: 'Dans 181 j', kind: 'sage', realizado: false },
      { id: null, icon: 'flame', titulo: 'Ramonage des conduits de fumée', edificio: 'Résidence Croix-Rousse', data: '21 novembre 2026', prazo: 'Dans 181 j', kind: 'sage', realizado: false },
      { id: null, icon: 'flame', titulo: 'Ramonage des conduits de fumée', edificio: 'Résidence Les Berges du Rhône', data: '21 novembre 2026', prazo: 'Dans 181 j', kind: 'sage', realizado: false },
      { id: null, icon: 'bank', titulo: 'AG annuelle', edificio: 'Résidence Atlantique', data: '21 mai 2027', prazo: 'Dans 362 j', kind: 'sage', realizado: false },
      { id: null, icon: 'chart', titulo: 'Budget prévisionnel', edificio: 'Résidence Atlantique', data: '21 mai 2027', prazo: 'Dans 362 j', kind: 'sage', realizado: false },
      { id: null, icon: 'flame', titulo: 'Vérification des extincteurs', edificio: 'Résidence Atlantique', data: '21 mai 2027', prazo: 'Dans 362 j', kind: 'sage', realizado: false },
      { id: null, icon: 'alert', titulo: 'Dossier technique amiante (DTA)', edificio: 'Résidence Atlantique', data: '21 mai 2029', prazo: 'Dans 1093 j', kind: 'amber', realizado: false },
      { id: null, icon: 'alert', titulo: 'Dossier technique amiante (DTA)', edificio: 'Copropriété Bellecour Center', data: '21 mai 2029', prazo: 'Dans 1093 j', kind: 'amber', realizado: false },
      { id: null, icon: 'alert', titulo: 'Dossier technique amiante (DTA)', edificio: 'Résidence Croix-Rousse', data: '21 mai 2029', prazo: 'Dans 1093 j', kind: 'amber', realizado: false },
      { id: null, icon: 'alert', titulo: 'Dossier technique amiante (DTA)', edificio: 'Résidence Les Berges du Rhône', data: '21 mai 2029', prazo: 'Dans 1093 j', kind: 'amber', realizado: false },
      { id: null, icon: 'elevator', titulo: "Contrôle technique quinquennal de l'ascenseur", edificio: 'Résidence Atlantique', data: '21 mai 2031', prazo: 'Dans 1823 j', kind: 'gold', realizado: false },
    ],
    formulaire: {
      titre: 'Ajouter une obligation',
      intitule: 'Intitulé',
      intitulePlaceholder: "Ex. : Contrôle technique de l'ascenseur",
      immeuble: 'Immeuble',
      facultatif: 'Facultatif',
      dateLimite: 'Date limite',
      datePlaceholder: 'AAAA-MM-JJ',
      type: 'Type',
      typePlaceholder: 'Ex. : Sécurité, AG, Entretien…',
      annuler: 'Annuler',
      ajouter: 'Ajouter',
    },
    erreurs: { intitule: "L'intitulé est obligatoire." },
    toasts: {
      ajoutee: 'Obligation ajoutée',
      erreurAjout: "Erreur lors de l'ajout",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      ajouteeDemo: 'Obligation ajoutée (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
      marquee: 'Obligation marquée comme réalisée',
      erreur: 'Erreur',
      marqueeDemo: 'Obligation marquée (démonstration)',
      supprimee: 'Obligation supprimée',
      erreurSuppression: 'Erreur lors de la suppression',
      supprimeeDemo: 'Obligation supprimée (démonstration)',
    },
  },
})
