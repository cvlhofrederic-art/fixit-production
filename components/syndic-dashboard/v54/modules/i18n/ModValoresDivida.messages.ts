import { defineMessages } from '@/lib/syndic/v54/i18n'

interface ValoresDividaTextes {
  titre: string
  chapeau: string
  nouvelImpaye: string
  onglets: { ac: string; cf: string }
  kpi: { total: string; inc: string; n1: string; n2: string; ct: string }
  filtres: {
    tous: string
    inc: (n: number) => string
    n1: (n: number) => string
    n2: (n: number) => string
    ct: (n: number) => string
    liq: (n: number) => string
  }
  videTitre: string
  videDesc: string
  colonnes: { condomino: string; fracao: string; edificio: string; vencimento: string; montante: string; estado: string }
  pastilleImpaye: string
  formulaire: {
    titre: string
    condomino: string
    condominoPlaceholder: string
    fracao: string
    fracaoPlaceholder: string
    montante: string
    edificio: string
    edificioPlaceholder: string
    vencimento: string
    notas: string
    notasAide: string
    annuler: string
    enregistrer: string
  }
  erreurs: { condomino: string; montante: string }
  toastEnregistre: string
}

export const VALORES_DIVIDA_MESSAGES = defineMessages<ValoresDividaTextes>({
  'pt-PT': {
    titre: 'Valores em dívida',
    chapeau: 'Acompanhamento de incumprimentos e chamadas de fundos — Notificações graduais, cartas de interpelação, contencioso',
    nouvelImpaye: '+ Incumprimento',
    onglets: { ac: 'Acompanhamento de Incumprimentos', cf: 'Chamadas de Fundos' },
    kpi: { total: 'Total de incumprimentos em curso', inc: 'Em incumprimento', n1: 'Notificação 1', n2: 'Notificação 2', ct: 'Contencioso' },
    filtres: {
      tous: 'Todos',
      inc: (n) => `● Em incumprimento (${n})`,
      n1: (n) => `● Notificação 1 (${n})`,
      n2: (n) => `● Notificação 2 (${n})`,
      ct: (n) => `● Contencioso (${n})`,
      liq: (n) => `Liquidado (${n})`,
    },
    videTitre: 'Nenhum incumprimento',
    videDesc: 'Operação nominal',
    colonnes: { condomino: 'Condómino', fracao: 'Fração', edificio: 'Edifício', vencimento: 'Vencimento', montante: 'Montante', estado: 'Estado' },
    pastilleImpaye: 'Em incumprimento',
    formulaire: {
      titre: 'Registar um incumprimento',
      condomino: 'Condómino',
      condominoPlaceholder: 'Nome do condómino',
      fracao: 'Fração',
      fracaoPlaceholder: 'Apt 12',
      montante: 'Montante',
      edificio: 'Edifício',
      edificioPlaceholder: 'Residência…',
      vencimento: 'Data de vencimento',
      notas: 'Notas',
      notasAide: 'Informações complementares',
      annuler: 'Cancelar',
      enregistrer: 'Registar',
    },
    erreurs: { condomino: 'O condómino é obrigatório.', montante: 'Indique um montante superior a 0 €.' },
    toastEnregistre: 'Incumprimento registado',
  },
  'fr-FR': {
    titre: 'Impayés de charges',
    chapeau: 'Suivi des impayés et des appels de fonds — relance amiable, mise en demeure, recouvrement contentieux (art. 19-2 de la loi du 10 juillet 1965)',
    nouvelImpaye: '+ Impayé',
    onglets: { ac: 'Suivi des impayés', cf: 'Appels de fonds' },
    kpi: { total: 'Total des impayés en cours', inc: 'Impayés non relancés', n1: 'Relance amiable', n2: 'Mise en demeure', ct: 'Contentieux' },
    filtres: {
      tous: 'Tous',
      inc: (n) => `● Non relancé (${n})`,
      n1: (n) => `● Relance amiable (${n})`,
      n2: (n) => `● Mise en demeure (${n})`,
      ct: (n) => `● Contentieux (${n})`,
      liq: (n) => `Soldé (${n})`,
    },
    videTitre: 'Aucun impayé',
    videDesc: 'Tous les copropriétaires sont à jour de leurs charges',
    colonnes: { condomino: 'Copropriétaire', fracao: 'Lot', edificio: 'Immeuble', vencimento: 'Échéance', montante: 'Montant', estado: 'Statut' },
    pastilleImpaye: 'Impayé',
    formulaire: {
      titre: 'Enregistrer un impayé',
      condomino: 'Copropriétaire',
      condominoPlaceholder: 'Nom du copropriétaire',
      fracao: 'Lot',
      fracaoPlaceholder: 'Lot 12',
      montante: 'Montant',
      edificio: 'Immeuble',
      edificioPlaceholder: 'Résidence…',
      vencimento: "Date d'échéance",
      notas: 'Notes',
      notasAide: 'Informations complémentaires',
      annuler: 'Annuler',
      enregistrer: 'Enregistrer',
    },
    erreurs: { condomino: 'Indiquez le nom du copropriétaire.', montante: 'Indiquez un montant supérieur à 0 €.' },
    toastEnregistre: 'Impayé enregistré',
  },
})
