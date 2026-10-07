import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Codes de type de sinistre (valeurs envoyées à /api/syndic/sinistros, inchangées). */
export type TypeSinistreObr = 'incendio' | 'agua' | 'rouge' | 'rc' | 'outros'

/** Textes de l'écran « Seguro Obrigatório de Condomínio » / « Assurance obligatoire du syndicat ». */
interface SeguroObrTextes {
  titre: string
  chapeau: string
  nouvellePolice: string
  declarerSinistre: string
  kpi: { actives: string; aRenouveler: string; expirees: string; primeTotale: string; sinistresOuverts: string; totalIndemnise: string }
  onglets: { polices: (n: number) => string; sinistres: (n: number) => string }
  vide: { titre: string; desc: string; action: string }
  colonnes: { assureur: string; numero: string; immeuble: string; debut: string; fin: string; prime: string; statut: string }
  active: string
  police: {
    titre: string
    assureur: string
    assureurPlaceholder: string
    numero: string
    numeroPlaceholder: string
    immeuble: string
    immeublePlaceholder: string
    dateDebut: string
    dateFin: string
    dateFinAide: string
    prime: string
    garantie: string
    garantieAide: string
    notes: string
    annuler: string
    enregistrer: string
  }
  sinistre: {
    titre: string
    police: string
    choisir: string
    date: string
    type: string
    types: Record<TypeSinistreObr, string>
    montant: string
    description: string
    descriptionPlaceholder: string
    annuler: string
    declarer: string
  }
  erreurs: { assureur: string; numero: string; immeuble: string; prime: string; description: string; montant: string }
  toasts: {
    policeEnregistree: string
    erreurEnregistrement: string
    reessayerPlusTard: string
    policeEnregistreeDemo: string
    connexionRequise: string
    sinistreDeclare: string
    /** Détail du toast de déclaration : type de sinistre (code envoyé) et montant formaté. */
    sinistreDetail: (type: string, montant: string) => string
    erreurDeclaration: string
    sinistreDeclareDemo: string
  }
}

const TYPES_FR: Record<TypeSinistreObr, string> = {
  incendio: 'Incendie',
  agua: 'Dégât des eaux / inondation',
  rouge: 'Vol / vandalisme',
  rc: 'Responsabilité civile',
  outros: 'Autres',
}
/**
 * Même table, interrogeable avec un code quelconque (repli sur le code brut s'il est inconnu).
 * Reprise par ModSinistros, qui affiche les sinistres déclarés depuis ce module.
 */
export const TYPES_FR_PAR_CODE: Readonly<Record<string, string | undefined>> = TYPES_FR

export const SEGURO_OBR_MESSAGES = defineMessages<SeguroObrTextes>({
  'pt-PT': {
    titre: 'Seguro Obrigatório de Condomínio',
    chapeau: 'Seguro contra incêndio obrigatório · Art.° 1429.° Código Civil · DL 268/94',
    nouvellePolice: '+ Nova Apólice',
    declarerSinistre: 'Participar Sinistro',
    kpi: { actives: 'Apólices Ativas', aRenouveler: 'A Renovar (< 60 dias)', expirees: 'Expiradas', primeTotale: 'Prémio Anual Total', sinistresOuverts: 'Sinistros em Aberto', totalIndemnise: 'Total Indemnizado' },
    onglets: { polices: (n) => `Apólices (${n})`, sinistres: (n) => `Sinistros (${n})` },
    vide: {
      titre: 'Nenhuma apólice registada',
      desc: 'O seguro contra incêndio é obrigatório para todos os edifícios em propriedade horizontal',
      action: '+ Registar Apólice',
    },
    colonnes: { assureur: 'Seguradora', numero: 'Nº apólice', immeuble: 'Edifício', debut: 'Início', fin: 'Fim', prime: 'Prémio anual', statut: 'Estado' },
    active: 'Ativa',
    police: {
      titre: 'Nova apólice de seguro',
      assureur: 'Seguradora',
      assureurPlaceholder: 'Fidelidade, Tranquilidade…',
      numero: 'Nº apólice',
      numeroPlaceholder: 'AP-2026-…',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Residência…',
      dateDebut: 'Data início',
      dateFin: 'Data fim',
      dateFinAide: 'Anual por defeito (+1 ano)',
      prime: 'Prémio anual',
      garantie: 'Cobertura mín.',
      garantieAide: 'Valor seguro',
      notes: 'Notas',
      annuler: 'Cancelar',
      enregistrer: 'Registar apólice',
    },
    sinistre: {
      titre: 'Participar sinistro',
      police: 'Apólice associada',
      choisir: '— escolher —',
      date: 'Data do sinistro',
      type: 'Tipo de sinistro',
      types: { incendio: 'Incêndio', agua: 'Águas / inundação', rouge: 'Roubo / vandalismo', rc: 'Responsabilidade civil', outros: 'Outros' },
      montant: 'Montante estimado',
      description: 'Descrição',
      descriptionPlaceholder: 'Descreva os factos, danos e circunstâncias…',
      annuler: 'Cancelar',
      declarer: 'Participar',
    },
    erreurs: {
      assureur: 'Indique a seguradora.',
      numero: 'O nº da apólice é obrigatório.',
      immeuble: 'O edifício é obrigatório.',
      prime: 'Indique o prémio anual.',
      description: 'Descreva o sinistro.',
      montant: 'Indique o montante estimado.',
    },
    toasts: {
      policeEnregistree: 'Apólice registada',
      erreurEnregistrement: 'Erro ao registar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      policeEnregistreeDemo: 'Apólice registada (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
      sinistreDeclare: 'Sinistro participado',
      sinistreDetail: (type, montant) => `${type} · ${montant}`,
      erreurDeclaration: 'Erro ao participar',
      sinistreDeclareDemo: 'Sinistro participado (demo)',
    },
  },
  'fr-FR': {
    titre: 'Assurance obligatoire du syndicat',
    chapeau: 'Responsabilité civile obligatoire du syndicat · Art. 9-1 de la loi n° 65-557 du 10 juillet 1965 · Multirisque immeuble',
    nouvellePolice: '+ Nouvelle police',
    declarerSinistre: 'Déclarer un sinistre',
    kpi: { actives: 'Polices actives', aRenouveler: 'À renouveler (< 60 jours)', expirees: 'Expirées', primeTotale: 'Prime annuelle totale', sinistresOuverts: 'Sinistres en cours', totalIndemnise: 'Total indemnisé' },
    onglets: { polices: (n) => `Polices (${n})`, sinistres: (n) => `Sinistres (${n})` },
    vide: {
      titre: 'Aucune police enregistrée',
      desc: "Le syndicat des copropriétaires doit être assuré pour sa responsabilité civile (art. 9-1 de la loi du 10 juillet 1965) ; la multirisque immeuble couvre en outre l'incendie et les dégâts des eaux",
      action: '+ Enregistrer une police',
    },
    colonnes: { assureur: 'Assureur', numero: 'N° de police', immeuble: 'Immeuble', debut: 'Début', fin: 'Fin', prime: 'Prime annuelle', statut: 'Statut' },
    active: 'Active',
    police: {
      titre: "Nouvelle police d'assurance",
      assureur: 'Assureur',
      assureurPlaceholder: 'Mutuelle Rhodanienne, Assurances du Lyonnais…',
      numero: 'N° de police',
      numeroPlaceholder: 'MRI-2026-…',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Résidence…',
      dateDebut: 'Date de début',
      dateFin: 'Date de fin',
      dateFinAide: 'Annuelle par défaut (+1 an)',
      prime: 'Prime annuelle',
      garantie: 'Garantie min.',
      garantieAide: 'Capital assuré',
      notes: 'Notes',
      annuler: 'Annuler',
      enregistrer: 'Enregistrer la police',
    },
    sinistre: {
      titre: 'Déclarer un sinistre',
      police: 'Police concernée',
      choisir: '— choisir —',
      date: 'Date du sinistre',
      type: 'Type de sinistre',
      types: TYPES_FR,
      montant: 'Montant estimé',
      description: 'Description',
      descriptionPlaceholder: 'Décrivez les faits, les dommages et les circonstances…',
      annuler: 'Annuler',
      declarer: 'Déclarer',
    },
    erreurs: {
      assureur: "Indiquez l'assureur.",
      numero: 'Le n° de police est obligatoire.',
      immeuble: "L'immeuble est obligatoire.",
      prime: 'Indiquez la prime annuelle.',
      description: 'Décrivez le sinistre.',
      montant: 'Indiquez le montant estimé.',
    },
    toasts: {
      policeEnregistree: 'Police enregistrée',
      erreurEnregistrement: "Erreur lors de l'enregistrement",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      policeEnregistreeDemo: 'Police enregistrée (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
      sinistreDeclare: 'Sinistre déclaré',
      sinistreDetail: (type, montant) => `${TYPES_FR_PAR_CODE[type] ?? type} · ${montant}`,
      erreurDeclaration: 'Erreur lors de la déclaration',
      sinistreDeclareDemo: 'Sinistre déclaré (démonstration)',
    },
  },
})
