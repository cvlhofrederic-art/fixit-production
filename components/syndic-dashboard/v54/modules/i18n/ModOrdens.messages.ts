import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Statut affiché d'un ordre de service (code interne ; le libellé dépend de la langue). */
export type StatutOrdre = 'pendente' | 'curso' | 'concluida'

/** Ligne de démonstration : statut, référence, immeuble, intervention, localisation, prestataire, date. */
export interface OrdreDemo {
  statut: StatutOrdre
  ref: string
  immeuble: string
  intervention: string
  lieu: string
  prestataire: string
  date: string
}

interface OrdensTextes {
  titre: string
  chapeau: string
  filtres: string
  nouvelleMission: string
  onglets: { todas: string; urg: string; curso: string; conc: string }
  rechercheAria: string
  recherchePlaceholder: string
  aucunResultat: string
  prioriteNormale: string
  statuts: Record<StatutOrdre, string>
  valider: string
  ouvrir: string
  lot: (numero: string) => string
  demo: OrdreDemo[]
  formulaire: {
    immeuble: string
    selectionner: string
    nomImmeuble: string
    type: string
    typeExemple: string
    priorite: string
    priorites: { basse: string; normale: string; haute: string; urgente: string }
    description: string
    descriptionPlaceholder: string
    prestataireOptionnel: string
    prestataire: string
    nomPrestataire: string
    annuler: string
    creer: string
    gerer: string
    statut: string
    enregistrer: string
  }
  erreurs: { immeuble: string; type: string; description: string }
  toasts: {
    creee: string
    erreurCreation: string
    reessayerPlusTard: string
    creeeDemo: string
    connexionRequise: string
    miseAJour: string
    erreurMiseAJour: string
    miseAJourDemo: string
  }
}

export const ORDENS_MESSAGES = defineMessages<OrdensTextes>({
  'pt-PT': {
    titre: 'Ordens de serviço',
    chapeau: 'Acompanhamento das missões em curso, pedidos pendentes e histórico',
    filtres: 'Filtros',
    nouvelleMission: 'Nova missão',
    onglets: { todas: 'Todas', urg: 'Urgentes', curso: 'Em curso', conc: 'Concluídas' },
    rechercheAria: 'Pesquisar ordens',
    recherchePlaceholder: 'Pesquisar por edifício, descrição, profissional…',
    aucunResultat: 'Nenhuma ordem corresponde aos filtros.',
    prioriteNormale: 'Normal',
    statuts: { pendente: 'Pendente', curso: 'Em curso', concluida: 'Concluída' },
    valider: 'Validar',
    ouvrir: 'Abrir',
    lot: (numero) => `Fração ${numero}`,
    demo: [
      { statut: 'pendente', ref: '#ORD-2026-001', immeuble: 'Edifício Foz Douro', intervention: 'Canalização · Fuga de água apartamento', lieu: 'Fração 4B', prestataire: 'Bruno Tavares', date: '22/05/2026' },
      { statut: 'curso', ref: '#ORD-2026-002', immeuble: 'Condomínio Boavista Center', intervention: 'Coordenação de obras · Acompanhamento da impermeabilização da cobertura', lieu: '', prestataire: 'Bruno Tavares', date: '20/05/2026' },
      { statut: 'concluida', ref: '#ORD-2026-003', immeuble: 'Residencial Cedofeita', intervention: 'Inspeção técnica · Verificação periódica do sistema de gás das partes comuns', lieu: '', prestataire: 'Bruno Tavares', date: '12/04/2026' },
      { statut: 'pendente', ref: '#ORD-2026-004', immeuble: 'Condomínio Boavista Center', intervention: 'Pequenas reparações · Substituição de 4 lâmpadas LED na garagem', lieu: '', prestataire: 'Diogo Pereira', date: '18/05/2026' },
      { statut: 'curso', ref: '#ORD-2026-005', immeuble: 'Edifício Foz Douro', intervention: 'Pequenas reparações · Pintura de retoque na zona da entrada', lieu: 'And. 2.°', prestataire: 'Tiago Mendes', date: '16/05/2026' },
      { statut: 'pendente', ref: '#ORD-2026-006', immeuble: 'Edifício Foz Douro', intervention: 'Manutenção corrente · Portão automático da garagem fecha muito devagar', lieu: 'And. -1', prestataire: '—', date: '—' },
      { statut: 'pendente', ref: '#ORD-2026-007', immeuble: 'Edifício Foz Douro', intervention: 'Eletricidade · Iluminação do corredor do 2.° pisca constantemente', lieu: 'And. 2.°', prestataire: '—', date: '—' },
      { statut: 'pendente', ref: '#ORD-2026-008', immeuble: 'Residencial Cedofeita', intervention: 'Construção · Fissura nova no muro lateral do edifício, lado norte', lieu: 'And. Exterior', prestataire: '—', date: '—' },
      { statut: 'pendente', ref: '#ORD-2026-009', immeuble: 'Residencial Cedofeita', intervention: 'Manutenção corrente · Reparação de campainha avariada no R/C esquerdo', lieu: 'Bl. A · And. R/C', prestataire: 'Tiago Mendes', date: '21/05/2026' },
    ],
    formulaire: {
      immeuble: 'Edifício',
      selectionner: 'Selecione…',
      nomImmeuble: 'Nome do edifício',
      type: 'Tipo',
      typeExemple: 'Ex.: Canalização',
      priorite: 'Prioridade',
      priorites: { basse: 'Baixa', normale: 'Normal', haute: 'Alta', urgente: 'Urgente' },
      description: 'Descrição',
      descriptionPlaceholder: 'Descreva a intervenção…',
      prestataireOptionnel: 'Profissional (opcional)',
      prestataire: 'Profissional',
      nomPrestataire: 'Nome do profissional',
      annuler: 'Cancelar',
      creer: 'Criar missão',
      gerer: 'Gerir a missão',
      statut: 'Estado',
      enregistrer: 'Guardar',
    },
    erreurs: { immeuble: 'O edifício é obrigatório.', type: 'O tipo é obrigatório.', description: 'A descrição é obrigatória.' },
    toasts: {
      creee: 'Missão criada',
      erreurCreation: 'Erro ao criar a missão',
      reessayerPlusTard: 'Tente novamente mais tarde',
      creeeDemo: 'Missão criada (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
      miseAJour: 'Missão atualizada',
      erreurMiseAJour: 'Erro ao atualizar',
      miseAJourDemo: 'Missão atualizada (demo)',
    },
  },
  'fr-FR': {
    titre: 'Ordres de service',
    chapeau: "Suivi des missions en cours, des demandes en attente et de l'historique",
    filtres: 'Filtres',
    nouvelleMission: 'Nouvelle mission',
    onglets: { todas: 'Tous', urg: 'Urgents', curso: 'En cours', conc: 'Terminés' },
    rechercheAria: 'Rechercher un ordre de service',
    recherchePlaceholder: 'Rechercher par immeuble, description, prestataire…',
    aucunResultat: 'Aucun ordre de service ne correspond aux filtres.',
    prioriteNormale: 'Normale',
    statuts: { pendente: 'En attente', curso: 'En cours', concluida: 'Terminé' },
    valider: 'Valider',
    ouvrir: 'Ouvrir',
    lot: (numero) => `Lot ${numero}`,
    demo: [
      { statut: 'pendente', ref: '#OS-2026-001', immeuble: 'Résidence Les Berges du Rhône', intervention: "Plomberie · Fuite d'eau dans un appartement", lieu: 'Lot 4B', prestataire: 'Bruno Tessier', date: '22/05/2026' },
      { statut: 'curso', ref: '#OS-2026-002', immeuble: 'Copropriété Bellecour Center', intervention: 'Suivi de chantier · Étanchéité de la toiture-terrasse', lieu: '', prestataire: 'Bruno Tessier', date: '20/05/2026' },
      { statut: 'concluida', ref: '#OS-2026-003', immeuble: 'Résidence Croix-Rousse', intervention: 'Contrôle technique · Vérification périodique des installations gaz des parties communes', lieu: '', prestataire: 'Bruno Tessier', date: '12/04/2026' },
      { statut: 'pendente', ref: '#OS-2026-004', immeuble: 'Copropriété Bellecour Center', intervention: 'Petits travaux · Remplacement de 4 ampoules LED au parking', lieu: '', prestataire: 'Damien Perrin', date: '18/05/2026' },
      { statut: 'curso', ref: '#OS-2026-005', immeuble: 'Résidence Les Berges du Rhône', intervention: "Petits travaux · Retouches de peinture dans le hall d'entrée", lieu: '2e étage', prestataire: 'Thomas Ménard', date: '16/05/2026' },
      { statut: 'pendente', ref: '#OS-2026-006', immeuble: 'Résidence Les Berges du Rhône', intervention: 'Entretien courant · Portail automatique du parking trop lent à la fermeture', lieu: 'Niveau -1', prestataire: '—', date: '—' },
      { statut: 'pendente', ref: '#OS-2026-007', immeuble: 'Résidence Les Berges du Rhône', intervention: 'Électricité · Éclairage du couloir du 2e étage qui clignote en permanence', lieu: '2e étage', prestataire: '—', date: '—' },
      { statut: 'pendente', ref: '#OS-2026-008', immeuble: 'Résidence Croix-Rousse', intervention: "Gros œuvre · Nouvelle fissure sur le mur latéral de l'immeuble, côté nord", lieu: 'Extérieur', prestataire: '—', date: '—' },
      { statut: 'pendente', ref: '#OS-2026-009', immeuble: 'Résidence Croix-Rousse', intervention: "Entretien courant · Réparation d'une sonnette défectueuse au rez-de-chaussée gauche", lieu: 'Bât. A · RDC', prestataire: 'Thomas Ménard', date: '21/05/2026' },
    ],
    formulaire: {
      immeuble: 'Immeuble',
      selectionner: 'Sélectionnez…',
      nomImmeuble: "Nom de l'immeuble",
      type: 'Type',
      typeExemple: 'Ex. : Plomberie',
      priorite: 'Priorité',
      priorites: { basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: 'Urgente' },
      description: 'Description',
      descriptionPlaceholder: "Décrivez l'intervention…",
      prestataireOptionnel: 'Prestataire (facultatif)',
      prestataire: 'Prestataire',
      nomPrestataire: 'Nom du prestataire',
      annuler: 'Annuler',
      creer: 'Créer la mission',
      gerer: 'Gérer la mission',
      statut: 'Statut',
      enregistrer: 'Enregistrer',
    },
    erreurs: { immeuble: "L'immeuble est obligatoire.", type: 'Le type est obligatoire.', description: 'La description est obligatoire.' },
    toasts: {
      creee: 'Mission créée',
      erreurCreation: 'Erreur lors de la création de la mission',
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      creeeDemo: 'Mission créée (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
      miseAJour: 'Mission mise à jour',
      erreurMiseAJour: 'Erreur lors de la mise à jour',
      miseAJourDemo: 'Mission mise à jour (démonstration)',
    },
  },
})
