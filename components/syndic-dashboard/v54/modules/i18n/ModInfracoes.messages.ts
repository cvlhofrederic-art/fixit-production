import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { Infracao } from '@/lib/syndic/v54/api'

/** Étape d'une infraction (code de l'API, inchangé dans les deux langues). */
type Etapa = Infracao['etapa']

/**
 * Textes de l'écran « Acompanhamento de Infrações » / « Suivi des infractions au règlement ».
 * En France, ni le syndic ni le syndicat n'ont de pouvoir d'amende : le syndic fait respecter
 * le règlement de copropriété (loi du 10 juillet 1965, art. 18), par mise en demeure puis, au
 * besoin, par une action en justice du syndicat autorisée par l'AG (décret du 17 mars 1967,
 * art. 55). L'étape technique « multa » et le champ « multa » de l'API sont conservés ; en
 * français, ils désignent l'action en justice engagée et le montant réclamé (réparation).
 */
interface InfracoesTextes {
  titre: string
  chapeau: string
  nouvelle: string
  onglets: { pipeline: string; infracoes: string; modelos: string; hist: string }
  alerte: { titre: string; texte: string }
  kpi: { ouvertes: string; enCours: string; montants: string; resolues: string }
  /** Montant affiché (le nombre est déjà formaté selon la langue). */
  montant: (n: string) => string
  panneauEtapes: string
  /** Libellés du panneau « par étape ». */
  etapesPipeline: Record<Etapa, string>
  /** Libellés d'étape d'une infraction (pastilles et liste déroulante) ; repli sur la valeur brute. */
  etapes: Record<Etapa, string>
  panneauModeles: string
  modeles: string[]
  panneauListe: string
  vide: { titre: string; desc: string }
  colonnes: { type: string; coproprietaire: string; immeuble: string; etape: string; montant: string }
  demo: Infracao[]
  formulaire: {
    titre: string
    type: string
    typePlaceholder: string
    coproprietaire: string
    coproprietairePlaceholder: string
    immeuble: string
    immeublePlaceholder: string
    etape: string
    montant: string
    montantAide: string
    description: string
    descriptionPlaceholder: string
    annuler: string
    enregistrer: string
  }
  erreurType: string
  toasts: {
    enregistree: string
    erreur: string
    reessayerPlusTard: string
    enregistreeDemo: string
    connexionRequise: string
  }
}

export const INFRACOES_MESSAGES = defineMessages<InfracoesTextes>({
  'pt-PT': {
    titre: 'Acompanhamento de Infrações',
    chapeau: 'Infrações ao regulamento · Pipeline sinalização → multa · Provas · Histórico · Modelos de carta',
    nouvelle: 'Nova infração',
    onglets: { pipeline: 'Pipeline', infracoes: 'Infrações', modelos: 'Modelos de carta', hist: 'Histórico' },
    alerte: {
      titre: 'Procedimento conforme o regulamento do condomínio',
      texte: 'Cada infração segue o pipeline sinalização → análise → notificação → multa, com registo de provas e modelos de carta gerados automaticamente.',
    },
    kpi: { ouvertes: 'Infrações abertas', enCours: 'Em processo', montants: 'Multas aplicadas', resolues: 'Resolvidas' },
    montant: (n) => `€ ${n}`,
    panneauEtapes: 'Pipeline por etapa',
    etapesPipeline: {
      sinalizada: 'Sinalização',
      analise: 'Análise & provas',
      notificacao: 'Notificação',
      multa: 'Multa aplicada',
      resolvida: 'Resolvida',
    },
    etapes: {
      sinalizada: 'Sinalizada',
      analise: 'Em análise',
      notificacao: 'Notificação enviada',
      multa: 'Multa aplicada',
      resolvida: 'Resolvida',
    },
    panneauModeles: 'Modelos de carta',
    modeles: ['Notificação de infração', 'Advertência formal', 'Aplicação de multa', 'Resolução amigável'],
    panneauListe: 'Infrações em curso',
    vide: { titre: 'Sem infrações registadas', desc: 'Sinalize a primeira infração ao regulamento do condomínio' },
    colonnes: { type: 'Tipo', coproprietaire: 'Condómino', immeuble: 'Edifício', etape: 'Etapa', montant: 'Multa' },
    demo: [
      { id: 'p1', tipo: 'Ruído fora de horas', condomino: 'Carlos Mendes — Fração 4B', edificio: 'Edifício Aurora', etapa: 'notificacao', multa: 75, descricao: '' },
      { id: 'p2', tipo: 'Estacionamento indevido', condomino: 'Ana Silva — Fração 2A', edificio: 'Edifício Bela Vista', etapa: 'sinalizada', multa: 0, descricao: '' },
      { id: 'p3', tipo: 'Lixo fora do contentor', condomino: 'Pedro Costa — Fração 1C', edificio: 'Residencial Cedofeita', etapa: 'multa', multa: 50, descricao: '' },
      { id: 'p4', tipo: 'Obras sem autorização', condomino: 'Rita Oliveira — Fração 5A', edificio: 'Condomínio Boavista Center', etapa: 'resolvida', multa: 150, descricao: '' },
    ],
    formulaire: {
      titre: 'Nova infração',
      type: 'Tipo de infração',
      typePlaceholder: 'Ex.: Ruído fora de horas',
      coproprietaire: 'Condómino',
      coproprietairePlaceholder: 'Nome — Fração',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Edifício…',
      etape: 'Etapa',
      montant: 'Multa',
      montantAide: 'Valor em euros',
      description: 'Descrição / provas',
      descriptionPlaceholder: 'Contexto, provas, testemunhos…',
      annuler: 'Cancelar',
      enregistrer: 'Registar',
    },
    erreurType: 'Indique o tipo de infração.',
    toasts: {
      enregistree: 'Infração registada',
      erreur: 'Erro ao registar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      enregistreeDemo: 'Infração registada (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  'fr-FR': {
    titre: 'Suivi des infractions au règlement',
    chapeau: "Manquements au règlement de copropriété · Étapes du signalement à l'action en justice · Preuves · Historique · Modèles de lettres",
    nouvelle: 'Nouvelle infraction',
    onglets: { pipeline: 'Étapes', infracoes: 'Infractions', modelos: 'Modèles de lettres', hist: 'Historique' },
    alerte: {
      titre: 'Faire respecter le règlement de copropriété',
      texte: "Le syndic est chargé d'assurer l'exécution du règlement de copropriété (art. 18 de la loi du 10 juillet 1965), mais il ne peut infliger aucune amende. Chaque infraction suit les étapes signalement → constat → mise en demeure puis, si nécessaire, action en justice du syndicat, en principe autorisée par l'assemblée générale (art. 55 du décret du 17 mars 1967). Les preuves sont conservées et les modèles de lettres générés automatiquement.",
    },
    kpi: { ouvertes: 'Infractions ouvertes', enCours: 'En cours de traitement', montants: 'Montants réclamés', resolues: 'Résolues' },
    montant: (n) => `${n} €`,
    panneauEtapes: 'Infractions par étape',
    etapesPipeline: {
      sinalizada: 'Signalement',
      analise: 'Constat & preuves',
      notificacao: 'Mise en demeure',
      multa: 'Action en justice',
      resolvida: 'Résolution',
    },
    etapes: {
      sinalizada: 'Signalée',
      analise: 'Constat en cours',
      notificacao: 'Mise en demeure envoyée',
      multa: 'Action en justice engagée',
      resolvida: 'Résolue',
    },
    panneauModeles: 'Modèles de lettres',
    modeles: ['Rappel au règlement de copropriété', 'Mise en demeure (LRAR)', "Saisine de l'avocat du syndicat", 'Proposition de résolution amiable'],
    panneauListe: 'Infractions en cours',
    vide: { titre: 'Aucune infraction enregistrée', desc: 'Signalez la première infraction au règlement de copropriété' },
    colonnes: { type: 'Type', coproprietaire: 'Copropriétaire', immeuble: 'Immeuble', etape: 'Étape', montant: 'Montant réclamé' },
    demo: [
      { id: 'p1', tipo: 'Nuisances sonores nocturnes', condomino: 'Claude Mercier — Lot 4B', edificio: 'Résidence Aurore', etapa: 'notificacao', multa: 75, descricao: '' },
      { id: 'p2', tipo: 'Stationnement sur les parties communes', condomino: 'Anne Simon — Lot 2A', edificio: 'Résidence Belle Vue', etapa: 'sinalizada', multa: 0, descricao: '' },
      { id: 'p3', tipo: 'Encombrants déposés dans les parties communes', condomino: 'Pierre Coste — Lot 1C', edificio: 'Résidence Croix-Rousse', etapa: 'multa', multa: 50, descricao: '' },
      { id: 'p4', tipo: "Travaux sans autorisation de l'AG", condomino: 'Rose Olivier — Lot 5A', edificio: 'Copropriété Bellecour Center', etapa: 'resolvida', multa: 150, descricao: '' },
    ],
    formulaire: {
      titre: 'Nouvelle infraction',
      type: "Type d'infraction",
      typePlaceholder: 'Ex. : Nuisances sonores nocturnes',
      coproprietaire: 'Copropriétaire',
      coproprietairePlaceholder: 'Nom — Lot',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Immeuble…',
      etape: 'Étape',
      montant: 'Montant réclamé',
      montantAide: 'Réparation ou remise en état, en euros',
      description: 'Description / preuves',
      descriptionPlaceholder: 'Contexte, preuves, témoignages…',
      annuler: 'Annuler',
      enregistrer: 'Enregistrer',
    },
    erreurType: "Indiquez le type d'infraction.",
    toasts: {
      enregistree: 'Infraction enregistrée',
      erreur: "Erreur lors de l'enregistrement",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      enregistreeDemo: 'Infraction enregistrée (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
