import { defineMessages } from '@/lib/syndic/v54/i18n'
import { TYPES_FR_PAR_CODE } from './ModSeguroObr.messages'

/** Statut d'un sinistre (valeur stockée par /api/syndic/sinistros, inchangée ; le libellé dépend de la langue). */
export type StatutSinistre = 'declarado' | 'atribuido' | 'peritagem' | 'resolucao' | 'indemnizado' | 'encerrado'

/** Textes de l'écran « Pipeline Sinistros » / « Suivi des sinistres ». */
interface SinistrosTextes {
  titre: string
  chapeau: string
  nouveau: string
  kpi: { actifs: string; urgences: string; montant: string; indemnisations: string }
  panneau: string
  /** Libellés des étapes du pipeline (et des options du statut dans le formulaire). */
  etapes: Record<StatutSinistre, string>
  /** Libellés courts des pastilles de statut de la liste. */
  statuts: Record<StatutSinistre, string>
  vide: { titre: string; desc: string; action: string }
  sinistreParDefaut: string
  /**
   * Type affiché dans la liste. Le type est saisi librement ici, mais le module « Assurance
   * obligatoire » enregistre des codes (incendio, agua, rouge, rc, outros) : le PT les affiche
   * bruts (inchangé), le FR les traduit, avec repli sur la valeur saisie.
   */
  typeAffiche: (tipo: string) => string
  formulaire: {
    titre: string
    type: string
    typePlaceholder: string
    immeuble: string
    facultatif: string
    description: string
    descriptionPlaceholder: string
    assureur: string
    montant: string
    statut: string
    urgent: string
    non: string
    oui: string
    annuler: string
    declarer: string
  }
  erreurType: string
  toasts: {
    declare: string
    erreurDeclaration: string
    reessayerPlusTard: string
    declareDemo: string
    connexionRequise: string
  }
}

export const SINISTROS_MESSAGES = defineMessages<SinistrosTextes>({
  'pt-PT': {
    titre: 'Pipeline Sinistros',
    chapeau: 'Declaração → Profissional → Peritagem → Indemnização → Encerramento',
    nouveau: '+ Novo sinistro',
    kpi: { actifs: 'Sinistros ativos', urgences: 'Urgências', montant: 'Montante estimado', indemnisations: 'Indemnizações' },
    panneau: 'VISTA DO PIPELINE',
    etapes: {
      declarado: 'Declarado',
      atribuido: 'Profissional atribuído',
      peritagem: 'Em peritagem',
      resolucao: 'Resolução',
      indemnizado: 'Indemnizado',
      encerrado: 'Encerrado',
    },
    statuts: { declarado: 'Declarado', atribuido: 'Atribuído', peritagem: 'Peritagem', resolucao: 'Resolução', indemnizado: 'Indemnizado', encerrado: 'Encerrado' },
    vide: {
      titre: 'Nenhum sinistro',
      desc: 'Declare e acompanhe os seus sinistros do início ao fim — da declaração à indemnização.',
      action: '+ Declarar um sinistro',
    },
    sinistreParDefaut: 'Sinistro',
    typeAffiche: (tipo) => tipo,
    formulaire: {
      titre: 'Novo sinistro',
      type: 'Tipo',
      typePlaceholder: 'Ex.: Inundação, Incêndio…',
      immeuble: 'Edifício',
      facultatif: 'Opcional',
      description: 'Descrição',
      descriptionPlaceholder: 'Descreva o sinistro…',
      assureur: 'Seguradora',
      montant: 'Montante estimado (€)',
      statut: 'Estado',
      urgent: 'Urgente',
      non: 'Não',
      oui: 'Sim',
      annuler: 'Cancelar',
      declarer: 'Declarar',
    },
    erreurType: 'O tipo é obrigatório.',
    toasts: {
      declare: 'Sinistro declarado',
      erreurDeclaration: 'Erro ao declarar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      declareDemo: 'Sinistro declarado (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  'fr-FR': {
    titre: 'Suivi des sinistres',
    chapeau: 'Déclaration → Prestataire → Expertise → Indemnisation → Clôture',
    nouveau: '+ Nouveau sinistre',
    kpi: { actifs: 'Sinistres en cours', urgences: 'Urgences', montant: 'Montant estimé', indemnisations: 'Indemnisations' },
    panneau: 'SUIVI PAR ÉTAPE',
    etapes: {
      declarado: 'Déclaré',
      atribuido: 'Prestataire missionné',
      peritagem: 'En expertise',
      resolucao: 'Remise en état',
      indemnizado: 'Indemnisé',
      encerrado: 'Clos',
    },
    statuts: { declarado: 'Déclaré', atribuido: 'Missionné', peritagem: 'Expertise', resolucao: 'Remise en état', indemnizado: 'Indemnisé', encerrado: 'Clos' },
    vide: {
      titre: 'Aucun sinistre',
      desc: "Déclarez et suivez vos sinistres de bout en bout, de la déclaration à l'indemnisation.",
      action: '+ Déclarer un sinistre',
    },
    sinistreParDefaut: 'Sinistre',
    typeAffiche: (tipo) => TYPES_FR_PAR_CODE[tipo] ?? tipo,
    formulaire: {
      titre: 'Nouveau sinistre',
      type: 'Type',
      typePlaceholder: 'Ex. : Dégât des eaux, Incendie…',
      immeuble: 'Immeuble',
      facultatif: 'Facultatif',
      description: 'Description',
      descriptionPlaceholder: 'Décrivez le sinistre…',
      assureur: 'Assureur',
      montant: 'Montant estimé (€)',
      statut: 'Statut',
      urgent: 'Urgent',
      non: 'Non',
      oui: 'Oui',
      annuler: 'Annuler',
      declarer: 'Déclarer',
    },
    erreurType: 'Le type est obligatoire.',
    toasts: {
      declare: 'Sinistre déclaré',
      erreurDeclaration: 'Erreur lors de la déclaration',
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      declareDemo: 'Sinistre déclaré (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
