import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Codes de type de police (valeurs envoyées à /api/syndic/seguros). */
type TypePolice = 'multirriscos' | 'responsabilidade_civil' | 'incendio' | 'outros'

/** Textes de l'écran « Gestão de Seguros » / « Gestion des assurances ». */
interface SegurosTextes {
  titre: string
  chapeau: string
  nouvellePolice: string
  kpi: { actives: string; expirees: string; aEcheance: string; primes: string; capital: string }
  onglets: { vg: string; ap: string; sn: string; al: string }
  filtreAria: string
  tousImmeubles: string
  vide: string
  types: Record<TypePolice, string>
  statuts: { expirada: string; renovacao: string; ativa: string }
  /** Suffixes et préfixes de la liste (mêmes nœuds texte qu'à l'origine). */
  liste: { parAn: string; capital: string; fin: string }
  formulaire: {
    titre: string
    assureur: string
    assureurPlaceholder: string
    type: string
    numero: string
    facultatif: string
    prime: string
    capital: string
    immeuble: string
    dateFin: string
    dateFinPlaceholder: string
    annuler: string
    ajouter: string
  }
  erreurAssureur: string
  toasts: {
    ajoutee: string
    erreurAjout: string
    reessayerPlusTard: string
    ajouteeDemo: string
    connexionRequise: string
  }
}

export const SEGUROS_MESSAGES = defineMessages<SegurosTextes>({
  'pt-PT': {
    titre: 'Gestão de Seguros',
    chapeau: 'Apólices, coberturas, sinistros e alertas por edifício',
    nouvellePolice: '+ Nova Apólice',
    kpi: { actives: 'Apólices Ativas', expirees: 'Expiradas', aEcheance: 'A Expirar (60d)', primes: 'Total Prémios/Ano', capital: 'Capital Total' },
    onglets: { vg: 'Visão Geral', ap: 'Apólices', sn: 'Sinistros', al: 'Alertas' },
    filtreAria: 'Filtrar por edifício',
    tousImmeubles: 'Todos os edifícios',
    vide: 'Nenhum edifício registado',
    types: { multirriscos: 'Multirriscos', responsabilidade_civil: 'Responsabilidade Civil', incendio: 'Incêndio', outros: 'Outros' },
    statuts: { expirada: 'Expirada', renovacao: 'Renovação', ativa: 'Ativa' },
    liste: { parAn: '/ano', capital: 'Capital: ', fin: 'Fim: ' },
    formulaire: {
      titre: 'Nova apólice',
      assureur: 'Seguradora',
      assureurPlaceholder: 'Ex.: Fidelidade, Tranquilidade…',
      type: 'Tipo',
      numero: 'N.º apólice',
      facultatif: 'Opcional',
      prime: 'Prémio anual (€)',
      capital: 'Capital seguro (€)',
      immeuble: 'Edifício',
      dateFin: 'Data de fim',
      dateFinPlaceholder: 'AAAA-MM-DD',
      annuler: 'Cancelar',
      ajouter: 'Adicionar',
    },
    erreurAssureur: 'A seguradora é obrigatória.',
    toasts: {
      ajoutee: 'Apólice adicionada',
      erreurAjout: 'Erro ao adicionar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      ajouteeDemo: 'Apólice adicionada (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  'fr-FR': {
    titre: 'Gestion des assurances',
    chapeau: 'Polices, garanties, sinistres et alertes par immeuble',
    nouvellePolice: '+ Nouvelle police',
    kpi: { actives: 'Polices actives', expirees: 'Expirées', aEcheance: 'Échéance sous 60 jours', primes: 'Total des primes annuelles', capital: 'Capital total' },
    onglets: { vg: "Vue d'ensemble", ap: 'Polices', sn: 'Sinistres', al: 'Alertes' },
    filtreAria: 'Filtrer par immeuble',
    tousImmeubles: 'Tous les immeubles',
    vide: "Aucune police d'assurance enregistrée",
    types: { multirriscos: 'Multirisque immeuble', responsabilidade_civil: 'Responsabilité civile', incendio: 'Incendie', outros: 'Autres' },
    statuts: { expirada: 'Expirée', renovacao: 'À renouveler', ativa: 'Active' },
    liste: { parAn: '/an', capital: 'Capital : ', fin: 'Échéance : ' },
    formulaire: {
      titre: 'Nouvelle police',
      assureur: 'Assureur',
      assureurPlaceholder: 'Ex. : Mutuelle Rhodanienne, Assurances du Lyonnais…',
      type: 'Type',
      numero: 'N° de police',
      facultatif: 'Facultatif',
      prime: 'Prime annuelle (€)',
      capital: 'Capital assuré (€)',
      immeuble: 'Immeuble',
      dateFin: "Date d'échéance",
      dateFinPlaceholder: 'AAAA-MM-JJ',
      annuler: 'Annuler',
      ajouter: 'Ajouter',
    },
    erreurAssureur: "L'assureur est obligatoire.",
    toasts: {
      ajoutee: 'Police ajoutée',
      erreurAjout: "Erreur lors de l'ajout",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      ajouteeDemo: 'Police ajoutée (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
