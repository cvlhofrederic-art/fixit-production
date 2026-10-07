import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { Deliberacao } from '@/lib/syndic/v54/api'

/** Couleur d'une étape du pipeline IA (code interne). */
export type CouleurEtape = 'sage' | 'gold' | 'amber'

/** Étape du pipeline d'extraction (contenu éducatif ; l'icône reste dans le module). */
export interface EtapeTexte {
  titre: string
  desc: string
}

type EstadoDelib = Deliberacao['estado']

interface TrackerDelibsTextes {
  surtitre: string
  titre: string
  chapeau: string
  reextraire: string
  nouvelleAction: string
  toastReextraction: { titre: string; desc: string }
  cadre: { titre: string; avantGras: string; gras: string; apresGras: string }
  kpi: { extraites: string; enCours: string; proches: string; enRetard: string; executees: string; bloquees: string }
  onglets: { todas: string; pen: string; em: string; atr: string; conc: string }
  /** Pastilles des assemblées (la première = toutes). */
  ags: string[]
  vide: { titre: string; desc: string }
  vueVide: string
  colonnes: { deliberation: string; ag: string; responsable: string; echeance: string; statut: string }
  estados: Record<EstadoDelib, string>
  pipeline: { titre: string; sousTitre: string; etapes: [EtapeTexte, EtapeTexte, EtapeTexte] }
  modal: {
    titre: string
    deliberation: string
    deliberationPlaceholder: string
    assemblee: string
    assembleePlaceholder: string
    responsable: string
    responsablePlaceholder: string
    echeance: string
    statut: string
    annuler: string
    ajouter: string
  }
  erreurDeliberation: string
  ajoutee: string
}

export const TRACKER_DELIBS_MESSAGES = defineMessages<TrackerDelibsTextes>({
  'pt-PT': {
    surtitre: 'OBRIGAÇÃO LEGAL · CC ART. 1436.° f) i)',
    titre: 'Tracker de Deliberações',
    chapeau: 'Executar deliberações em 15 dias úteis · Extração IA · Calendário de execução · Calendário PT férias-aware',
    reextraire: 'Reextrair com Fixy',
    nouvelleAction: '+ Nova ação manual',
    toastReextraction: { titre: 'Reextração IA', desc: 'Importe uma ata via Atas IA para extrair as deliberações' },
    cadre: {
      titre: 'Obrigação legal — CC art. 1436.° alínea i)',
      avantGras: 'O administrador deve executar as deliberações da assembleia em ',
      gras: '15 dias úteis',
      apresGras: '. Fixy extrai cada deliberação da ata final, atribui prazo automaticamente e envia alertas escalados (J-3 · J-1 · J0 · J+1).',
    },
    kpi: {
      extraites: 'Deliberações extraídas IA',
      enCours: 'Em curso (no prazo)',
      proches: 'Próximos do prazo (≤3d)',
      enRetard: 'Atrasadas (responsabilidade civil)',
      executees: 'Concluídas no prazo',
      bloquees: 'Bloqueadas (justificadas)',
    },
    onglets: { todas: 'Todas as deliberações', pen: 'Pendentes', em: 'Em curso', atr: 'Atrasadas', conc: 'Concluídas' },
    ags: ['Todas as AGs', 'AG Ord 2026', 'AG Extra Mar 2026', 'AG Ord 2025'],
    vide: {
      titre: 'Nenhuma deliberação para acompanhar',
      desc: 'Quando uma ata for finalizada com Atas IA, as deliberações são extraídas automaticamente e atribuídas com prazos legais.',
    },
    vueVide: 'Sem deliberações nesta vista.',
    colonnes: { deliberation: 'Deliberação', ag: 'AG', responsable: 'Responsável', echeance: 'Prazo', statut: 'Estado' },
    estados: { pendente: 'Pendente', em_curso: 'Em curso', concluida: 'Concluída', atrasada: 'Atrasada', bloqueada: 'Bloqueada' },
    pipeline: {
      titre: 'Como Fixy extrai as deliberações',
      sousTitre: 'Pipeline IA pós-ata · Edge cases incluídos',
      etapes: [
        { titre: 'Análise semântica', desc: 'Detecta verbos no infinitivo + objeto + responsável implícito ou explícito' },
        { titre: 'Cálculo prazo', desc: 'data_AG + 15 dias úteis (calendário PT, feriados Porto incluídos)' },
        { titre: 'Escalation alertas', desc: 'J-3 / J-1 / J0 / J+1 — emails + push + Canal IA' },
      ],
    },
    modal: {
      titre: 'Nova ação / deliberação',
      deliberation: 'Deliberação',
      deliberationPlaceholder: 'Ex.: Executar a reparação do telhado do bloco B',
      assemblee: 'Assembleia',
      assembleePlaceholder: 'AG Ord 2026',
      responsable: 'Responsável',
      responsablePlaceholder: 'Síndico, prestador…',
      echeance: 'Prazo de execução',
      statut: 'Estado',
      annuler: 'Cancelar',
      ajouter: 'Adicionar',
    },
    erreurDeliberation: 'Descreva a deliberação.',
    ajoutee: 'Deliberação adicionada',
  },
  'fr-FR': {
    surtitre: 'OBLIGATION LÉGALE · ART. 18 ET 42 DE LA LOI DU 10 JUILLET 1965',
    titre: "Suivi des résolutions d'AG",
    chapeau: "Exécution des résolutions votées · Extraction IA · Calendrier d'exécution · Délai de recours de deux mois (art. 42)",
    reextraire: 'Réextraire avec Fixy',
    nouvelleAction: '+ Nouvelle action manuelle',
    toastReextraction: { titre: 'Réextraction IA', desc: 'Importez un procès-verbal via « Procès-verbaux IA » pour en extraire les résolutions' },
    cadre: {
      titre: 'Obligation légale — art. 18 et 42 de la loi du 10 juillet 1965',
      avantGras: "Le syndic assure l'exécution des résolutions de l'assemblée générale (art. 18) et notifie le procès-verbal aux copropriétaires opposants ou défaillants ",
      gras: 'dans le mois',
      apresGras: " qui suit l'AG (art. 42). Ceux-ci disposent de deux mois pour contester ; sauf urgence, les travaux votés aux art. 25 et 26 ne sont pas exécutés avant l'expiration de ce délai. Fixy extrait chaque résolution du procès-verbal définitif, lui attribue une échéance et envoie des alertes graduées (J-3 · J-1 · J0 · J+1).",
    },
    kpi: {
      extraites: "Résolutions extraites par l'IA",
      enCours: 'En cours (dans les délais)',
      proches: 'Échéance proche (≤ 3 j)',
      enRetard: 'En retard (responsabilité du syndic)',
      executees: 'Exécutées dans les délais',
      bloquees: 'Bloquées (justifiées)',
    },
    onglets: { todas: 'Toutes les résolutions', pen: 'En attente', em: 'En cours', atr: 'En retard', conc: 'Exécutées' },
    ags: ['Toutes les AG', 'AGO 2026', 'AGE mars 2026', 'AGO 2025'],
    vide: {
      titre: 'Aucune résolution à suivre',
      desc: "Dès qu'un procès-verbal est finalisé dans « Procès-verbaux IA », ses résolutions sont extraites automatiquement et assorties d'une échéance d'exécution.",
    },
    vueVide: 'Aucune résolution dans cette vue.',
    colonnes: { deliberation: 'Résolution', ag: 'AG', responsable: 'Responsable', echeance: 'Échéance', statut: 'Statut' },
    estados: { pendente: 'En attente', em_curso: 'En cours', concluida: 'Exécutée', atrasada: 'En retard', bloqueada: 'Bloquée' },
    pipeline: {
      titre: 'Comment Fixy extrait les résolutions',
      sousTitre: 'Traitement IA après le procès-verbal · Cas particuliers inclus',
      etapes: [
        { titre: 'Analyse sémantique', desc: "Repère le verbe d'action, l'objet et le responsable, implicite ou explicite" },
        { titre: "Calcul de l'échéance", desc: "Date de l'AG + notification du PV dans le mois + délai de recours de deux mois (art. 42), en tenant compte des jours fériés" },
        { titre: 'Alertes graduées', desc: 'J-3 / J-1 / J0 / J+1 — e-mails + notifications push + canal de communication' },
      ],
    },
    modal: {
      titre: 'Nouvelle action / résolution',
      deliberation: 'Résolution',
      deliberationPlaceholder: 'Ex. : Faire réaliser la réfection de la toiture du bâtiment B',
      assemblee: 'Assemblée',
      assembleePlaceholder: 'AGO 2026',
      responsable: 'Responsable',
      responsablePlaceholder: 'Syndic, prestataire…',
      echeance: "Échéance d'exécution",
      statut: 'Statut',
      annuler: 'Annuler',
      ajouter: 'Ajouter',
    },
    erreurDeliberation: 'Décrivez la résolution.',
    ajoutee: 'Résolution ajoutée',
  },
})
