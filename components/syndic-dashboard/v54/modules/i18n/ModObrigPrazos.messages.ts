import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Type d'obligation : code technique envoyé tel quel à l'API (champ tipo de syndic_prazos). */
export type TipoObrigacao = 'conservacao' | 'gas' | 'elevador' | 'eletrica' | 'seguro' | 'ag' | 'certif' | 'inc'

/** Statut calculé d'après les jours restants avant l'échéance. */
export type BucketPrazo = 'expirado' | 'urgente' | 'proximo' | 'emdia'

interface ObrigPrazosTextes {
  titre: string
  chapeau: string
  filtreImmeubleAria: string
  tousImmeubles: string
  filtreStatutAria: string
  tousStatuts: string
  ajouter: string
  alerteTitre: string
  alerteTexte: string
  kpi: Record<BucketPrazo, string>
  statuts: Record<BucketPrazo, string>
  colonnes: { immeuble: string; type: string; description: string; echeance: string; statut: string }
  vide: string
  /** Libellé complet de chaque type (référence légale entre parenthèses, retirée dans le tableau). */
  types: Record<TipoObrigacao, string>
  referencesTitre: string
  /** Cartes de références légales : [intitulé, texte et périodicité], dans l'ordre des icônes. */
  references: [string, string][]
  formulaire: {
    titre: string
    immeuble: string
    immeublePlaceholder: string
    type: string
    description: string
    descriptionPlaceholder: string
    dateLimite: string
    notes: string
    annuler: string
    ajouter: string
  }
  erreurs: { immeuble: string; description: string; echeance: string }
  toasts: {
    enregistree: string
    erreur: string
    reessayerPlusTard: string
    enregistreeDemo: string
    connexionRequise: string
  }
}

export const OBRIG_PRAZOS_MESSAGES = defineMessages<ObrigPrazosTextes>({
  'pt-PT': {
    titre: 'Obrigações Legais',
    chapeau: 'Calendário de obrigações · Prazos legais · Lei 8/2022 · DL 555/99',
    filtreImmeubleAria: 'Filtrar por edifício',
    tousImmeubles: 'Todos os edifícios',
    filtreStatutAria: 'Filtrar por estado',
    tousStatuts: 'Todos os estados',
    ajouter: '+ Adicionar',
    alerteTitre: 'Enquadramento Legal Português',
    alerteTexte: 'Conservação obrigatória a cada 8 anos (DL 555/99) · Inspeção de gás a cada 5 anos (DL 97/2017) · Elevadores a cada 2-6 anos (DL 320/2002) · Assembleia anual obrigatória (CC art. 1431.°) · Lei 8/2022',
    kpi: { expirado: 'Expirados', urgente: 'Urgentes', proximo: 'Próximos', emdia: 'Em dia' },
    statuts: { expirado: 'Expirado', urgente: 'Urgente', proximo: 'Próximo', emdia: 'Em dia' },
    colonnes: { immeuble: 'Edifício', type: 'Tipo', description: 'Descrição', echeance: 'Prazo', statut: 'Estado' },
    vide: 'Nenhuma obrigação registada. Clique em "+ Adicionar" para começar.',
    types: {
      conservacao: 'Conservação obrigatória (DL 555/99)',
      gas: 'Inspeção de gás (DL 97/2017)',
      elevador: 'Inspeção de elevadores (DL 320/2002)',
      eletrica: 'Inspeção elétrica (RTIEBT)',
      seguro: 'Seguro do edifício (DL 267/94)',
      ag: 'Assembleia geral anual (CC art. 1431.°)',
      certif: 'Certificado energético (DL 101-D/2020)',
      inc: 'Segurança contra incêndios (DL 220/2008)',
    },
    referencesTitre: 'Referências Legais Portuguesas',
    references: [
      ['Conservação obrigatória', 'DL 555/99 art. 89.° — 8 anos'],
      ['Inspeção de gás', 'DL 97/2017 — 5 anos'],
      ['Inspeção de elevadores', 'DL 320/2002 — 2 a 6 anos'],
      ['Inspeção elétrica', 'RTIEBT — 10 anos'],
      ['Seguro do edifício', 'DL 267/94 — anual'],
      ['Assembleia geral anual', 'CC art. 1431.° — anual'],
      ['Certificado energético', 'DL 101-D/2020 — 10 anos'],
      ['Segurança contra incêndios', 'DL 220/2008 — anual'],
    ],
    formulaire: {
      titre: 'Adicionar obrigação legal',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Residência…',
      type: 'Tipo de obrigação',
      description: 'Descrição',
      descriptionPlaceholder: 'Ex.: Inspeção de elevador do bloco A',
      dateLimite: 'Prazo limite',
      notes: 'Notas',
      annuler: 'Cancelar',
      ajouter: 'Adicionar',
    },
    erreurs: { immeuble: 'O edifício é obrigatório.', description: 'Descreva a obrigação.', echeance: 'O prazo é obrigatório.' },
    toasts: {
      enregistree: 'Obrigação registada',
      erreur: 'Erro ao registar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      enregistreeDemo: 'Obrigação registada (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  'fr-FR': {
    titre: 'Obligations & échéances',
    chapeau: "Calendrier des obligations · Échéances légales · Loi du 10 juillet 1965 · Code de la construction et de l'habitation",
    filtreImmeubleAria: 'Filtrer par immeuble',
    tousImmeubles: 'Tous les immeubles',
    filtreStatutAria: 'Filtrer par statut',
    tousStatuts: 'Tous les statuts',
    ajouter: '+ Ajouter',
    alerteTitre: 'Cadre légal français',
    alerteTexte: "Plan pluriannuel de travaux actualisé tous les 10 ans (loi de 1965, art. 14-2) · Contrôle technique de l'ascenseur tous les 5 ans (CCH, art. R134-1 et s.) · DPE collectif (loi Climat et résilience) · Assemblée générale au moins une fois par an (décret de 1967, art. 7) · Assurance de responsabilité civile du syndicat (loi de 1965, art. 9-1)",
    kpi: { expirado: 'En retard', urgente: 'Urgentes', proximo: 'Proches', emdia: 'À jour' },
    statuts: { expirado: 'En retard', urgente: 'Urgente', proximo: 'Proche', emdia: 'À jour' },
    colonnes: { immeuble: 'Immeuble', type: 'Type', description: 'Description', echeance: 'Échéance', statut: 'Statut' },
    vide: 'Aucune obligation enregistrée. Cliquez sur « + Ajouter » pour commencer.',
    types: {
      conservacao: 'Plan pluriannuel de travaux (loi de 1965, art. 14-2)',
      gas: 'Chaudière collective et ramonage (entretien annuel)',
      elevador: "Contrôle technique de l'ascenseur (CCH, art. R134-1 et s.)",
      eletrica: 'Installations électriques des parties communes (vérification)',
      seguro: 'Assurance RC du syndicat (loi de 1965, art. 9-1)',
      ag: 'Assemblée générale annuelle (décret de 1967, art. 7)',
      certif: 'DPE collectif (CCH, art. L126-31)',
      inc: 'Sécurité incendie (arrêté du 31 janvier 1986)',
    },
    referencesTitre: 'Références légales françaises',
    references: [
      ['Plan pluriannuel de travaux', 'Loi de 1965, art. 14-2 — actualisé tous les 10 ans'],
      ['Chaudière et ramonage', "Code de l'environnement, art. R224-41-4 et s. · règlement sanitaire départemental — annuel"],
      ["Contrôle technique de l'ascenseur", 'CCH, art. R134-1 et s. — tous les 5 ans'],
      ['Installations électriques', 'Pas de contrôle périodique général imposé — vérification conseillée'],
      ['Assurance RC du syndicat', 'Loi de 1965, art. 9-1 — échéance annuelle du contrat'],
      ['Assemblée générale annuelle', 'Décret de 1967, art. 7 — au moins une fois par an'],
      ['DPE collectif', 'CCH, art. L126-31 — tous les 10 ans'],
      ['Sécurité incendie', 'Arrêté du 31 janvier 1986 — entretien des équipements'],
    ],
    formulaire: {
      titre: 'Ajouter une obligation légale',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Résidence…',
      type: "Type d'obligation",
      description: 'Description',
      descriptionPlaceholder: "Ex. : Contrôle technique de l'ascenseur du bâtiment A",
      dateLimite: 'Date limite',
      notes: 'Notes',
      annuler: 'Annuler',
      ajouter: 'Ajouter',
    },
    erreurs: { immeuble: "L'immeuble est obligatoire.", description: "Décrivez l'obligation.", echeance: "L'échéance est obligatoire." },
    toasts: {
      enregistree: 'Obligation enregistrée',
      erreur: "Erreur lors de l'enregistrement",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      enregistreeDemo: 'Obligation enregistrée (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
