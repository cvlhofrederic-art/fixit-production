import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Statut d'une visite (codes de l'API : em_curso | concluida | enviada). */
export type StatutVistoria = 'em_curso' | 'concluida' | 'enviada'

interface VistoriaTextes {
  titre: string
  chapeau: string
  nouvelleVisite: string
  kpi: { realisees: string; aSurveiller: string; defaillants: string }
  onglets: { todas: string; conc: string; curso: string; env: string }
  vide: { titre: string; desc: string }
  /** Titre affiché quand la visite n'en a pas. */
  titreParDefaut: string
  /** Suffixes des pastilles « n points » (accolés au nombre, espace initiale comprise). */
  suffixeASurveiller: (n: number) => string
  suffixeDefaillants: (n: number) => string
  statuts: Record<StatutVistoria, string>
  modal: {
    titre: string
    champTitre: string
    titrePlaceholder: string
    immeuble: string
    facultatif: string
    statut: string
    aSurveiller: string
    defaillants: string
    date: string
    datePlaceholder: string
    annuler: string
    creer: string
  }
  erreurTitre: string
  toasts: {
    creee: string
    erreurCreation: string
    reessayerPlusTard: string
    creeeDemo: string
    connexionRequise: string
  }
}

export const VISTORIA_MESSAGES = defineMessages<VistoriaTextes>({
  'pt-PT': {
    titre: 'Vistoria Técnica',
    chapeau: 'Checklist de terreno → Relatório PDF · DL 555/99 · DL 97/2017 · DL 320/2002',
    nouvelleVisite: '+ Nova vistoria',
    kpi: { realisees: 'Vistorias realizadas', aSurveiller: 'Pontos a vigiar', defaillants: 'Pontos deficientes' },
    onglets: { todas: 'Todas', conc: 'Concluídas', curso: 'Em curso', env: 'Enviadas' },
    vide: { titre: 'Nenhuma vistoria registada', desc: 'Comece a sua primeira vistoria técnica.' },
    titreParDefaut: 'Vistoria',
    suffixeASurveiller: () => ' a vigiar',
    suffixeDefaillants: () => ' deficientes',
    statuts: { em_curso: 'Em curso', concluida: 'Concluída', enviada: 'Enviada' },
    modal: {
      titre: 'Nova vistoria',
      champTitre: 'Título',
      titrePlaceholder: 'Ex.: Vistoria anual partes comuns',
      immeuble: 'Edifício',
      facultatif: 'Opcional',
      statut: 'Estado',
      aSurveiller: 'Pontos a vigiar',
      defaillants: 'Pontos deficientes',
      date: 'Data da vistoria',
      datePlaceholder: 'AAAA-MM-DD',
      annuler: 'Cancelar',
      creer: 'Criar',
    },
    erreurTitre: 'O título é obrigatório.',
    toasts: {
      creee: 'Vistoria criada',
      erreurCreation: 'Erro ao criar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      creeeDemo: 'Vistoria criada (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  'fr-FR': {
    titre: 'Visites techniques',
    chapeau: "Checklist de visite → rapport PDF · Carnet d'entretien (art. 18 de la loi du 10 juillet 1965) · Ascenseurs (CCH, art. R134-1 et s.) · Sécurité incendie (arrêté du 31 janvier 1986)",
    nouvelleVisite: '+ Nouvelle visite',
    kpi: { realisees: 'Visites réalisées', aSurveiller: 'Points à surveiller', defaillants: 'Points défaillants' },
    onglets: { todas: 'Toutes', conc: 'Terminées', curso: 'En cours', env: 'Envoyées' },
    vide: { titre: 'Aucune visite enregistrée', desc: 'Commencez votre première visite technique.' },
    titreParDefaut: 'Visite',
    suffixeASurveiller: () => ' à surveiller',
    suffixeDefaillants: (n) => (n > 1 ? ' défaillants' : ' défaillant'),
    statuts: { em_curso: 'En cours', concluida: 'Terminée', enviada: 'Envoyée' },
    modal: {
      titre: 'Nouvelle visite',
      champTitre: 'Titre',
      titrePlaceholder: 'Ex. : Visite annuelle des parties communes',
      immeuble: 'Immeuble',
      facultatif: 'Facultatif',
      statut: 'Statut',
      aSurveiller: 'Points à surveiller',
      defaillants: 'Points défaillants',
      date: 'Date de la visite',
      datePlaceholder: 'AAAA-MM-JJ',
      annuler: 'Annuler',
      creer: 'Créer',
    },
    erreurTitre: 'Le titre est obligatoire.',
    toasts: {
      creee: 'Visite créée',
      erreurCreation: 'Erreur lors de la création',
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      creeeDemo: 'Visite créée (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
