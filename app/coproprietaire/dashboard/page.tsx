'use client'

import React, { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatPrice, formatDate } from '@/lib/utils'
import { useLocale } from '@/lib/i18n/context'
import {
  PROFILE_DEMO, CHARGES_DEMO, PAIEMENTS_DEMO, DOCUMENTS_DEMO, ANNONCES_DEMO,
  AG_DEMO, ECHEANCES_DEMO, NOTIFICATIONS_DEMO, HISTORIQUE_DEMO, PARAMS_DEMO,
  type CoproProfile, type ChargesMensuelles, type Paiement, type DocumentCopro,
  type Annonce, type AssembleeGenerale, type Echeance, type CoproNotification,
  type HistoriqueEntry, type ParamConfidentialite,
} from '@/lib/copro-demo-data'

// ─── Dynamic imports for extracted page sections ─────────────────────────────
const d = (loader: () => Promise<any>) => dynamic(loader, { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" /></div> }) as React.ComponentType<any>

const CoproAccueilSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproAccueilSection'))
const CoproDocumentsSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproDocumentsSection'))
const CoproPaiementsSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproPaiementsSection'))
const CoproAnnoncesSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproAnnoncesSection'))
const CoproSignalementSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproSignalementSection'))
const CoproAssembleesSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproAssembleesSection'))
const CoproHistoriqueSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproHistoriqueSection'))
const CoproModulesSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproModulesSection'))
const CoproParametresSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproParametresSection'))
const CoproAssistantSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproAssistantSection'))
const CoproMesInterventionsSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproMesInterventionsSection'))
const CoproMesChargesSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproMesChargesSection'))
const CoproQuittancesSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproQuittancesSection'))
const CoproMonBailSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproMonBailSection'))

// ─── Types ────────────────────────────────────────────────────────────────────

type CoproPage = 'accueil' | 'documents' | 'paiements' | 'annonces' | 'signalement' | 'assemblees' | 'historique' | 'parametres' | 'assistant' | 'interventions_suivi' | 'mes_charges' | 'quittances' | 'mon_bail' | 'modules'

interface CanalMessage {
  auteur: string
  role: string
  texte: string
  date: string
  type?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  pv_ag: { label: 'PV Assemblée', emoji: '📋' },
  compte_annuel: { label: 'Comptes annuels', emoji: '📊' },
  budget: { label: 'Budget', emoji: '💰' },
  contrat: { label: 'Contrat', emoji: '📑' },
  reglement: { label: 'Règlement', emoji: '📜' },
  appel_charges: { label: 'Appel de charges', emoji: '🧾' },
  autre: { label: 'Autre', emoji: '📄' },
}

const NOTIF_TYPE_EMOJI: Record<string, string> = {
  rappel: '⏰',
  alerte: '⚠️',
  document: '📄',
  message: '💬',
  vote: '🗳️',
}

const ECHEANCE_TYPE_EMOJI: Record<string, string> = {
  paiement: '💶',
  assemblee: '🏛️',
  maintenance: '🔧',
  document: '📄',
}

const HISTORIQUE_TYPE_EMOJI: Record<string, string> = {
  paiement: '💶',
  vote: '🗳️',
  document: '📄',
  signalement: '🔔',
  message: '💬',
}

const MAJORITE_LABELS: Record<string, { label: string; color: string }> = {
  art24: { label: 'Art. 24', color: 'bg-blue-100 text-blue-700' },
  art25: { label: 'Art. 25', color: 'bg-[rgba(201,168,76,0.15)] text-[#A8842A]' },
  art26: { label: 'Art. 26', color: 'bg-orange-100 text-orange-700' },
  unanimite: { label: 'Unanimité', color: 'bg-red-100 text-red-700' },
}

// ─── Signalement data ─────────────────────────────────────────────────────────

const TYPES_INTERVENTION = [
  '🔧 Plomberie (fuite, colonne, robinetterie)',
  '⚡ Électricité (panne, tableau, prise)',
  '🪟 Menuiserie (porte, fenêtre, serrure)',
  '🎨 Peinture / revêtement',
  '🏗️ Gros œuvre (fissure, infiltration)',
  '🌡️ Chauffage / climatisation',
  '🛗 Ascenseur',
  '🧹 Nettoyage / entretien',
  '🔥 Sinistre (dégât des eaux, incendie)',
  '🚨 Urgence sécurité',
  '🌿 Espaces verts',
  '💡 Éclairage parties communes',
  '🚪 Interphone / digicode',
  '📦 Autre',
]

const ZONES_COMMUNES = [
  'Hall d\'entrée',
  'Couloir / palier',
  'Escalier',
  'Cave / sous-sol',
  'Parking / garage',
  'Toiture / terrasse',
  'Jardin / espace vert',
  'Local poubelles',
  'Local vélos',
  'Façade extérieure',
  'Boîtes aux lettres',
  'Ascenseur',
  'Chaufferie',
  'Compteurs communs',
]

// ─── Nav items ────────────────────────────────────────────────────────────────

// ─── Traductions FR / PT ────────────────────────────────────────────────────────

const T = {
  fr: {
    // Nav items
    nav_accueil: 'Tableau de bord',
    nav_documents: 'Documents',
    nav_paiements: 'Paiements',
    nav_mes_charges: 'Mes Charges',
    nav_quittances: 'Quittances loyer',
    nav_mon_bail: 'Mon Bail',
    nav_interventions: 'Mes Interventions',
    nav_annonces: 'Annonces',
    nav_signalement: 'Signalement',
    nav_assemblees: 'Assemblées & Votes',
    nav_historique: 'Historique',
    nav_modules: 'Modules',
    nav_parametres: 'Paramètres',
    nav_assistant: 'Assistant Fixy',
    // Sidebar categories
    cat_general: 'GÉNÉRAL',
    cat_financier: 'FINANCIER',
    cat_gestion: 'GESTION',
    cat_juridique: 'JURIDIQUE',
    cat_outils: 'OUTILS',
    // Module descriptions
    mod_documents: 'Accès aux PV, comptes et documents copro',
    mod_paiements: 'Suivi et historique de vos paiements',
    mod_mes_charges: 'Détail mensuel de vos charges',
    mod_quittances: 'Vos quittances de loyer mensuelles',
    mod_mon_bail: 'Informations de votre bail et renouvellement',
    mod_interventions: 'Suivi des travaux dans votre immeuble',
    mod_annonces: 'Annonces du syndic et de la copro',
    mod_signalement: 'Signaler un problème dans l\'immeuble',
    mod_assemblees: 'AG, résolutions et votes en ligne',
    mod_historique: 'Historique de toutes vos actions',
    mod_assistant: 'Posez vos questions à Fixy',
    // Header / loading
    loading: 'Chargement de votre espace...',
    retourAdmin: '⚡ Retour Admin',
    deconnexion: 'Déconnexion',
    reduire: 'Réduire',
    developper: 'Développer',
    coproLot: 'Copropriétaire · Lot',
    notifications: 'Notifications',
    bat: 'Bât.',
    lot: 'Lot',
    etage: 'Étage',
    // Accueil
    chargesDuMois: 'Charges du mois',
    payee: '✓ Payée',
    enAttente: 'En attente',
    soldeAPayer: 'Solde à payer',
    paiementsEnAttente: 'paiement(s) en attente',
    tantiemes: 'Tantièmes',
    quotePart: 'Quote-part',
    nonLues: 'non lue(s)',
    faireSignalement: '🔔 Faire un signalement',
    mesPaiements: '💶 Mes paiements',
    mesDocuments: '📁 Mes documents',
    voterAG: '🗳️ Voter en AG',
    prochainesEcheances: '📅 Prochaines échéances',
    urgent: 'Urgent',
    toutMarquerLu: 'Tout marquer lu',
    dernieresAnnonces: '📢 Dernières annonces',
    voirTout: 'Voir tout →',
    info: 'Info',
    important: 'Important',
    // Documents
    tousLesTypes: 'Tous les types',
    toutesLesAnnees: 'Toutes les années',
    rechercherDoc: '🔍 Rechercher un document...',
    nouveau: 'Nouveau',
    publique: 'Public',
    personnel: 'Personnel',
    ajouteLe: 'Ajouté le',
    consulteLe: '✓ Consulté le',
    telecharger: '📥 Télécharger',
    marquerLu: '👁️ Marquer comme lu',
    derniersConsultes: '👁️ Derniers documents consultés',
    // Paiements
    totalPaye: 'Total payé (année en cours)',
    enRetard: 'En retard',
    aPayer: 'À payer',
    historiquePaiements: 'Historique',
    reference: 'Référence',
    description: 'Description',
    montant: 'Montant',
    echeance: 'Échéance',
    statut: 'Statut',
    actions: 'Actions',
    statutPaye: '✓ Payé',
    statutEnRetard: '⚠ En retard',
    statutEnAttente: '⏳ En attente',
    recu: '📥 Reçu',
    // Annonces (badge)
    urgentLabel: '🔴 Urgent',
    importantLabel: '🟠 Important',
    infoLabel: '🔵 Info',
    par: 'Par',
    // Signalement
    nouveauSignalement: '🔔 Nouveau signalement',
    signalerProbleme: 'Signalez un problème à votre gestionnaire de copropriété',
    signalementEnvoye: 'Signalement envoyé !',
    signalementConfirm: 'Votre gestionnaire a été notifié. Un suivi apparaîtra dans votre historique.',
    voirHistorique: 'Voir l\'historique →',
    localisationAuto: '📍 Votre localisation (auto-remplie)',
    partieCommune: 'Partie commune ?',
    partieCommuneDesc: 'Cave, couloir, ascenseur, toiture, hall…',
    zoneConcernee: 'Zone concernée',
    selectionnerZone: 'Sélectionner une zone…',
    autrePreciser: 'Autre (préciser dans la description)',
    typeIntervention: 'Type d\'intervention *',
    choisirType: 'Choisir le type…',
    descriptionProbleme: 'Description du problème *',
    decrivezProbleme: 'Décrivez précisément le problème constaté...',
    niveauUrgence: 'Niveau d\'urgence',
    urgenceNormale: '🟡 Normale',
    urgenceNormaleDesc: 'Sous 48h',
    urgenceUrgent: '🔴 Urgent',
    urgenceUrgentDesc: 'Immédiat',
    urgencePlanifiee: '🟢 Planifiée',
    urgencePlanifieeDesc: 'À programmer',
    envoyerSignalement: '📤 Envoyer le signalement au syndic',
    signalementTransmis: 'Votre signalement sera transmis à votre gestionnaire de copropriété.',
    // AG
    agOrdinaire: 'AG Ordinaire',
    agExtraordinaire: 'AG Extraordinaire',
    cloturee: '✓ Clôturée',
    enCours: '● En cours',
    convoquee: '📩 Convoquée',
    planifiee: '📅 Planifiée',
    resolutions: 'résolution(s) · Cliquer pour détails',
    infosPratiques: '📋 Informations pratiques',
    date: 'Date',
    lieu: 'Lieu',
    type: 'Type',
    visioconference: 'Visioconférence',
    lienDispo: '🎥 Lien disponible',
    ordreDuJour: '📝 Ordre du jour',
    resolutionsTitle: '🗳️ Résolutions',
    vosTantiemes: 'Vos tantièmes',
    votezCliquant: '— Votez en cliquant sur votre choix',
    monVote: 'Mon vote :',
    votePour: '✓ POUR',
    voteContre: '✗ CONTRE',
    voteAbstention: '○ ABSTENTION',
    pour: 'Pour',
    contre: 'Contre',
    abstention: 'Abstention',
    totalExprime: 'tantièmes exprimés',
    adoptee: '✓ Adoptée',
    rejetee: '✗ Rejetée',
    contestationAG: 'Contestation de l\'AG',
    joursRestants: 'jour(s) restant(s)',
    contestationDelai: 'pour contester (délai légal : 2 mois après l\'AG, art. 42 loi du 10/07/1965)',
    contestationEcoulee: 'Le délai de contestation de 2 mois est écoulé.',
    rappelJuridique: 'Rappel juridique :',
    rappelJuridiqueTexte: 'Tout copropriétaire opposant ou défaillant peut contester une décision d\'AG dans un délai de 2 mois à compter de la notification du PV (article 42 de la loi du 10 juillet 1965). La contestation doit être faite par LRAR au syndic, puis si nécessaire devant le Tribunal judiciaire.',
    copierTemplate: '📋 Copier le template de mise en demeure',
    deadline: 'Deadline',
    envoiLRAR: '· Envoi par LRAR recommandé',
    // Historique
    totalPaye2025: 'Total payé 2025',
    evenements: 'Événements',
    enregistres: 'enregistrés',
    evolutionCharges: '📊 Évolution des charges (12 derniers mois)',
    chartPayee: 'Payée',
    chartEnAttente: 'En attente',
    tous: 'Tous',
    desCharges: 'des charges',
    // Modules
    mesModules: '🧩 Mes modules',
    mesModulesDesc: 'Personnalisez votre espace en activant les fonctionnalités utiles',
    actifs: 'actifs',
    astuce: 'Astuce',
    astuceTexte: 'Désactivez les modules que vous n\'utilisez pas pour simplifier votre espace. Les données ne sont pas supprimées — vous pouvez les réactiver à tout moment.',
    // Paramètres
    monProfil: '👤 Mon profil',
    modifier: '✏️ Modifier',
    nomComplet: 'Nom complet',
    email: 'Email',
    telephone: 'Téléphone',
    immeuble: 'Immeuble',
    localisation: 'Localisation',
    tantièmesQuotePart: 'Tantièmes / Quote-part',
    prenom: 'Prénom',
    nom: 'Nom',
    enregistrer: 'Enregistrer',
    annuler: 'Annuler',
    prefsNotif: '🔔 Préférences de notification',
    notifEmail: 'Notifications par email',
    notifEmailDesc: 'Recevoir les alertes et rappels par email',
    notifPush: 'Notifications push',
    notifPushDesc: 'Recevoir les alertes sur votre téléphone',
    mailingAG: 'Convocations AG',
    mailingAGDesc: 'Recevoir les convocations d\'assemblée générale',
    alertesPaiement: 'Alertes paiement',
    alertesPaiementDesc: 'Rappels d\'échéances de paiement',
    alertesTravaux: 'Alertes travaux',
    alertesTravauxDesc: 'Informations sur les travaux en cours',
    resumeHebdo: 'Résumé hebdomadaire',
    resumeHebdoDesc: 'Synthèse des événements de la semaine',
    exportTelecharge: '📥 Export & téléchargements',
    recapAnnuel: 'Récapitulatif annuel',
    recapAnnuelDesc: 'Synthèse charges et paiements',
    mesVotesAG: 'Mes votes AG',
    mesVotesAGDesc: 'Historique de tous vos votes',
    attestationCopro: 'Attestation copropriété',
    portailSignalements: 'Portail signalements',
    portailSignalementsDesc: 'Accéder au portail de signalement',
    // Assistant
    assistantTitre: 'Fixy — Assistant IA',
    assistantDesc: 'Je connais toute votre copropriété. Posez-moi n\'importe quelle question !',
    nouvelleConversation: 'Nouvelle conversation',
    bonjourPrenom: 'Bonjour',
    assistantIntro: 'Je suis Fixy, votre assistant personnel pour la copropriété',
    assistantIntro2: '. Je peux répondre à toutes vos questions — même si vous n\'êtes pas à l\'aise avec la technologie !',
    questionsFréquentes: 'Questions fréquentes :',
    assistantQ1: 'Combien je dois payer ce mois ?',
    assistantQ2: 'Quelle est la prochaine assemblée générale ?',
    assistantQ3: 'Quels documents puis-je télécharger ?',
    assistantQ4: 'Quel est mon solde actuel ?',
    assistantQ5: 'Comment voter pour une résolution ?',
    assistantQ6: 'Y a-t-il des travaux prévus ?',
    assistantQ7: 'Quand est la prochaine coupure d\'eau ?',
    assistantQ8: 'C\'est quoi les tantièmes ?',
    suggestionQ1: 'Mes paiements en attente',
    suggestionQ2: 'Prochaine AG',
    suggestionQ3: 'Mes documents',
    suggestionQ4: 'Mon solde',
    placeholderInput: 'Posez votre question à Fixy…',
    assistantPied: 'Fixy peut répondre à toutes vos questions sur votre copropriété',
    // Interventions
    interventionsEnCours: 'intervention(s) en cours',
    aucuneIntervention: 'Aucune intervention pour ce filtre',
    toutes: 'Toutes',
    planifiees: '📅 Planifiées',
    enRoute: '🚗 En route',
    surPlace: '🔧 Sur place',
    terminees: '✅ Terminées',
    noter: '✍️ Noter',
    preuve: '✅ Preuve',
    signe: '+ signé',
    progression: 'Progression',
    demarrage: 'Démarrage',
    enCoursLabel: 'En cours',
    termine: 'Terminé',
    positionTempsReel: '📍 POSITION EN TEMPS RÉEL',
    signalGPS: 'Signal GPS actif',
    preuveIntervention: '📸 PREUVE D\'INTERVENTION',
    photosAvant: 'photo(s) avant',
    photosApres: 'photo(s) après',
    votreAvis: 'VOTRE AVIS',
    donnerAvis: '⭐ Donner mon avis sur cette intervention',
    evaluerIntervention: '⭐ Évaluer l\'intervention',
    votreNote: 'Votre note',
    tresSatisfait: 'Très satisfait',
    satisfait: 'Satisfait',
    correct: 'Correct',
    insatisfait: 'Insatisfait',
    tresInsatisfait: 'Très insatisfait',
    commentaireOpt: 'Commentaire (optionnel)',
    decrivezExperience: 'Décrivez votre expérience...',
    envoyerAvis: 'Envoyer l\'avis',
    // Doc types
    docPvAg: 'PV Assemblée',
    docCompteAnnuel: 'Comptes annuels',
    docBudget: 'Budget',
    docContrat: 'Contrat',
    docReglement: 'Règlement',
    docAppelCharges: 'Appel de charges',
    docAutre: 'Autre',
    // Majorité
    unanimite: 'Unanimité',
    // Statuts intervention
    statutPlanifie: 'Planifié',
    statutEnRoute: 'En route',
    statutSurPlace: 'Sur place',
    statutTermine: 'Terminé',
    statutAnnule: 'Annulé',
    // Date locale
    dateLocale: 'fr-FR',
  },
  pt: {
    // Nav items
    nav_accueil: 'Painel',
    nav_documents: 'Documentos',
    nav_paiements: 'Pagamentos',
    nav_mes_charges: 'Minhas Quotas',
    nav_quittances: 'Recibos de renda',
    nav_mon_bail: 'Meu Contrato',
    nav_interventions: 'Minhas Intervenções',
    nav_annonces: 'Avisos',
    nav_signalement: 'Ocorrência',
    nav_assemblees: 'Assembleias & Votos',
    nav_historique: 'Histórico',
    nav_modules: 'Módulos',
    nav_parametres: 'Definições',
    nav_assistant: 'Assistente Fixy',
    // Sidebar categories
    cat_general: 'GERAL',
    cat_financier: 'FINANCEIRO',
    cat_gestion: 'GESTÃO',
    cat_juridique: 'JURÍDICO',
    cat_outils: 'FERRAMENTAS',
    // Module descriptions
    mod_documents: 'Acesso às atas, contas e documentos do condomínio',
    mod_paiements: 'Acompanhamento e histórico dos seus pagamentos',
    mod_mes_charges: 'Detalhe mensal das suas quotas',
    mod_quittances: 'Os seus recibos de renda mensais',
    mod_mon_bail: 'Informações do seu contrato e renovação',
    mod_interventions: 'Acompanhamento das obras no seu edifício',
    mod_annonces: 'Avisos do administrador e do condomínio',
    mod_signalement: 'Reportar um problema no edifício',
    mod_assemblees: 'Assembleias, deliberações e votações online',
    mod_historique: 'Histórico de todas as suas ações',
    mod_assistant: 'Faça as suas perguntas ao Fixy',
    // Header / loading
    loading: 'A carregar o seu espaço...',
    retourAdmin: '⚡ Voltar Admin',
    deconnexion: 'Terminar sessão',
    reduire: 'Minimizar',
    developper: 'Expandir',
    coproLot: 'Condómino · Fração',
    notifications: 'Notificações',
    bat: 'Bloco',
    lot: 'Fração',
    etage: 'Piso',
    // Accueil
    chargesDuMois: 'Quotas do mês',
    payee: '✓ Paga',
    enAttente: 'Pendente',
    soldeAPayer: 'Saldo a pagar',
    paiementsEnAttente: 'pagamento(s) pendente(s)',
    tantiemes: 'Permilagem',
    quotePart: 'Quota-parte',
    nonLues: 'não lida(s)',
    faireSignalement: '🔔 Reportar ocorrência',
    mesPaiements: '💶 Meus pagamentos',
    mesDocuments: '📁 Meus documentos',
    voterAG: '🗳️ Votar em Assembleia',
    prochainesEcheances: '📅 Próximos vencimentos',
    urgent: 'Urgente',
    toutMarquerLu: 'Marcar tudo como lido',
    dernieresAnnonces: '📢 Últimos avisos',
    voirTout: 'Ver tudo →',
    info: 'Info',
    important: 'Importante',
    // Documents
    tousLesTypes: 'Todos os tipos',
    toutesLesAnnees: 'Todos os anos',
    rechercherDoc: '🔍 Pesquisar documento...',
    nouveau: 'Novo',
    publique: 'Público',
    personnel: 'Pessoal',
    ajouteLe: 'Adicionado em',
    consulteLe: '✓ Consultado em',
    telecharger: '📥 Descarregar',
    marquerLu: '👁️ Marcar como lido',
    derniersConsultes: '👁️ Últimos documentos consultados',
    // Paiements
    totalPaye: 'Total pago (ano corrente)',
    enRetard: 'Em atraso',
    aPayer: 'A pagar',
    historiquePaiements: 'Histórico',
    reference: 'Referência',
    description: 'Descrição',
    montant: 'Valor',
    echeance: 'Vencimento',
    statut: 'Estado',
    actions: 'Ações',
    statutPaye: '✓ Pago',
    statutEnRetard: '⚠ Em atraso',
    statutEnAttente: '⏳ Pendente',
    recu: '📥 Recibo',
    // Annonces (badge)
    urgentLabel: '🔴 Urgente',
    importantLabel: '🟠 Importante',
    infoLabel: '🔵 Info',
    par: 'Por',
    // Signalement
    nouveauSignalement: '🔔 Nova ocorrência',
    signalerProbleme: 'Reporte um problema ao administrador do condomínio',
    signalementEnvoye: 'Ocorrência enviada!',
    signalementConfirm: 'O administrador foi notificado. O acompanhamento aparecerá no seu histórico.',
    voirHistorique: 'Ver histórico →',
    localisationAuto: '📍 A sua localização (preenchimento automático)',
    partieCommune: 'Parte comum?',
    partieCommuneDesc: 'Cave, corredor, elevador, cobertura, hall…',
    zoneConcernee: 'Zona em causa',
    selectionnerZone: 'Selecionar uma zona…',
    autrePreciser: 'Outra (especificar na descrição)',
    typeIntervention: 'Tipo de intervenção *',
    choisirType: 'Escolher o tipo…',
    descriptionProbleme: 'Descrição do problema *',
    decrivezProbleme: 'Descreva com precisão o problema constatado...',
    niveauUrgence: 'Nível de urgência',
    urgenceNormale: '🟡 Normal',
    urgenceNormaleDesc: 'Em 48h',
    urgenceUrgent: '🔴 Urgente',
    urgenceUrgentDesc: 'Imediato',
    urgencePlanifiee: '🟢 Planeada',
    urgencePlanifieeDesc: 'A programar',
    envoyerSignalement: '📤 Enviar ocorrência ao administrador',
    signalementTransmis: 'A sua ocorrência será transmitida ao administrador do condomínio.',
    // AG
    agOrdinaire: 'Assembleia Ordinária',
    agExtraordinaire: 'Assembleia Extraordinária',
    cloturee: '✓ Encerrada',
    enCours: '● Em curso',
    convoquee: '📩 Convocada',
    planifiee: '📅 Planeada',
    resolutions: 'deliberação(ões) · Clique para detalhes',
    infosPratiques: '📋 Informações práticas',
    date: 'Data',
    lieu: 'Local',
    type: 'Tipo',
    visioconference: 'Videoconferência',
    lienDispo: '🎥 Link disponível',
    ordreDuJour: '📝 Ordem do dia',
    resolutionsTitle: '🗳️ Deliberações',
    vosTantiemes: 'A sua permilagem',
    votezCliquant: '— Vote clicando na sua escolha',
    monVote: 'Meu voto:',
    votePour: '✓ A FAVOR',
    voteContre: '✗ CONTRA',
    voteAbstention: '○ ABSTENÇÃO',
    pour: 'A favor',
    contre: 'Contra',
    abstention: 'Abstenção',
    totalExprime: 'permilagens expressas',
    adoptee: '✓ Aprovada',
    rejetee: '✗ Rejeitada',
    contestationAG: 'Impugnação da Assembleia',
    joursRestants: 'dia(s) restante(s)',
    contestationDelai: 'para impugnar (prazo legal: 60 dias após a assembleia, art. 1433.º CC)',
    contestationEcoulee: 'O prazo de impugnação de 60 dias expirou.',
    rappelJuridique: 'Nota jurídica:',
    rappelJuridiqueTexte: 'Qualquer condómino que tenha ficado vencido pode impugnar as deliberações da assembleia no prazo de 60 dias a contar da deliberação (para os presentes) ou da comunicação (para os ausentes), nos termos do art. 1433.º do Código Civil.',
    copierTemplate: '📋 Copiar modelo de impugnação',
    deadline: 'Prazo limite',
    envoiLRAR: '· Envio por carta registada com AR',
    // Historique
    totalPaye2025: 'Total pago 2025',
    evenements: 'Eventos',
    enregistres: 'registados',
    evolutionCharges: '📊 Evolução das quotas (últimos 12 meses)',
    chartPayee: 'Paga',
    chartEnAttente: 'Pendente',
    tous: 'Todos',
    desCharges: 'das quotas',
    // Modules
    mesModules: '🧩 Meus módulos',
    mesModulesDesc: 'Personalize o seu espaço ativando as funcionalidades úteis',
    actifs: 'ativos',
    astuce: 'Dica',
    astuceTexte: 'Desative os módulos que não utiliza para simplificar o seu espaço. Os dados não são apagados — pode reativá-los a qualquer momento.',
    // Paramètres
    monProfil: '👤 Meu perfil',
    modifier: '✏️ Editar',
    nomComplet: 'Nome completo',
    email: 'Email',
    telephone: 'Telefone',
    immeuble: 'Edifício',
    localisation: 'Localização',
    tantièmesQuotePart: 'Permilagem / Quota-parte',
    prenom: 'Nome próprio',
    nom: 'Apelido',
    enregistrer: 'Guardar',
    annuler: 'Cancelar',
    prefsNotif: '🔔 Preferências de notificação',
    notifEmail: 'Notificações por email',
    notifEmailDesc: 'Receber alertas e lembretes por email',
    notifPush: 'Notificações push',
    notifPushDesc: 'Receber alertas no seu telemóvel',
    mailingAG: 'Convocatórias de assembleia',
    mailingAGDesc: 'Receber convocatórias de assembleia geral',
    alertesPaiement: 'Alertas de pagamento',
    alertesPaiementDesc: 'Lembretes de vencimento de pagamento',
    alertesTravaux: 'Alertas de obras',
    alertesTravauxDesc: 'Informações sobre obras em curso',
    resumeHebdo: 'Resumo semanal',
    resumeHebdoDesc: 'Síntese dos eventos da semana',
    exportTelecharge: '📥 Exportar & descarregar',
    recapAnnuel: 'Resumo anual',
    recapAnnuelDesc: 'Síntese de quotas e pagamentos',
    mesVotesAG: 'Meus votos AG',
    mesVotesAGDesc: 'Histórico de todos os seus votos',
    attestationCopro: 'Declaração de condomínio',
    portailSignalements: 'Portal de ocorrências',
    portailSignalementsDesc: 'Aceder ao portal de ocorrências',
    // Assistant
    assistantTitre: 'Fixy — Assistente IA',
    assistantDesc: 'Conheço todo o seu condomínio. Faça-me qualquer pergunta!',
    nouvelleConversation: 'Nova conversa',
    bonjourPrenom: 'Olá',
    assistantIntro: 'Sou o Fixy, o seu assistente pessoal do condomínio',
    assistantIntro2: '. Posso responder a todas as suas perguntas — mesmo que não esteja à vontade com a tecnologia!',
    questionsFréquentes: 'Perguntas frequentes:',
    assistantQ1: 'Quanto tenho de pagar este mês?',
    assistantQ2: 'Quando é a próxima assembleia?',
    assistantQ3: 'Que documentos posso descarregar?',
    assistantQ4: 'Qual é o meu saldo atual?',
    assistantQ5: 'Como votar numa deliberação?',
    assistantQ6: 'Há obras previstas?',
    assistantQ7: 'Quando é o próximo corte de água?',
    assistantQ8: 'O que é a permilagem?',
    suggestionQ1: 'Meus pagamentos pendentes',
    suggestionQ2: 'Próxima assembleia',
    suggestionQ3: 'Meus documentos',
    suggestionQ4: 'Meu saldo',
    placeholderInput: 'Faça a sua pergunta ao Fixy…',
    assistantPied: 'O Fixy pode responder a todas as perguntas sobre o seu condomínio',
    // Interventions
    interventionsEnCours: 'intervenção(ões) em curso',
    aucuneIntervention: 'Nenhuma intervenção para este filtro',
    toutes: 'Todas',
    planifiees: '📅 Planeadas',
    enRoute: '🚗 A caminho',
    surPlace: '🔧 No local',
    terminees: '✅ Concluídas',
    noter: '✍️ Avaliar',
    preuve: '✅ Prova',
    signe: '+ assinado',
    progression: 'Progresso',
    demarrage: 'Início',
    enCoursLabel: 'Em curso',
    termine: 'Concluído',
    positionTempsReel: '📍 POSIÇÃO EM TEMPO REAL',
    signalGPS: 'Sinal GPS ativo',
    preuveIntervention: '📸 PROVA DE INTERVENÇÃO',
    photosAvant: 'foto(s) antes',
    photosApres: 'foto(s) depois',
    votreAvis: 'A SUA AVALIAÇÃO',
    donnerAvis: '⭐ Avaliar esta intervenção',
    evaluerIntervention: '⭐ Avaliar a intervenção',
    votreNote: 'A sua nota',
    tresSatisfait: 'Muito satisfeito',
    satisfait: 'Satisfeito',
    correct: 'Razoável',
    insatisfait: 'Insatisfeito',
    tresInsatisfait: 'Muito insatisfeito',
    commentaireOpt: 'Comentário (opcional)',
    decrivezExperience: 'Descreva a sua experiência...',
    envoyerAvis: 'Enviar avaliação',
    // Doc types
    docPvAg: 'Ata da Assembleia',
    docCompteAnnuel: 'Contas anuais',
    docBudget: 'Orçamento',
    docContrat: 'Contrato',
    docReglement: 'Regulamento',
    docAppelCharges: 'Aviso de quotas',
    docAutre: 'Outro',
    // Majorité
    unanimite: 'Unanimidade',
    // Statuts intervention
    statutPlanifie: 'Planeado',
    statutEnRoute: 'A caminho',
    statutSurPlace: 'No local',
    statutTermine: 'Concluído',
    statutAnnule: 'Cancelado',
    // Date locale
    dateLocale: 'pt-PT',
  },
} as const

type TKey = keyof typeof T['fr']
type TDict = Record<TKey, string>

// ─── Helper : get translation function based on locale ──────────────────────────

function getT(locale: string): TDict {
  return (locale === 'pt' ? T.pt : T.fr) as TDict
}

// ─── Signalement data (locale-aware) ─────────────────────────────────────────

function getTypesIntervention(locale: string): string[] {
  if (locale === 'pt') return [
    '🔧 Canalização (fuga, coluna, torneira)',
    '⚡ Eletricidade (avaria, quadro, tomada)',
    '🪟 Carpintaria (porta, janela, fechadura)',
    '🎨 Pintura / revestimento',
    '🏗️ Obra pesada (fissura, infiltração)',
    '🌡️ Aquecimento / climatização',
    '🛗 Elevador',
    '🧹 Limpeza / manutenção',
    '🔥 Sinistro (inundação, incêndio)',
    '🚨 Urgência de segurança',
    '🌿 Espaços verdes',
    '💡 Iluminação partes comuns',
    '🚪 Intercomunicador / código',
    '📦 Outro',
  ]
  return TYPES_INTERVENTION
}

function getZonesCommunes(locale: string): string[] {
  if (locale === 'pt') return [
    'Entrada / hall',
    'Corredor / patamar',
    'Escadas',
    'Cave / subsolo',
    'Estacionamento / garagem',
    'Cobertura / terraço',
    'Jardim / espaço verde',
    'Sala do lixo',
    'Sala de bicicletas',
    'Fachada exterior',
    'Caixas de correio',
    'Elevador',
    'Central térmica',
    'Contadores comuns',
  ]
  return ZONES_COMMUNES
}

// ─── Sidebar categories ──────────────────────────────────────────────────────

type NavCategory = { label: string; items: CoproPage[] }

function getNavCategories(t: TDict): NavCategory[] {
  return [
    { label: t.cat_general, items: ['accueil'] },
    { label: t.cat_financier, items: ['paiements', 'mes_charges', 'quittances'] },
    { label: t.cat_gestion, items: ['documents', 'mon_bail', 'interventions_suivi', 'annonces', 'signalement'] },
    { label: t.cat_juridique, items: ['assemblees', 'historique'] },
    { label: t.cat_outils, items: ['modules', 'parametres', 'assistant'] },
  ]
}

// ─── Doc type labels (locale-aware) ──────────────────────────────────────────

function getDocTypeLabels(t: TDict): Record<string, { label: string; emoji: string }> {
  return {
    pv_ag: { label: t.docPvAg, emoji: '📋' },
    compte_annuel: { label: t.docCompteAnnuel, emoji: '📊' },
    budget: { label: t.docBudget, emoji: '💰' },
    contrat: { label: t.docContrat, emoji: '📑' },
    reglement: { label: t.docReglement, emoji: '📜' },
    appel_charges: { label: t.docAppelCharges, emoji: '🧾' },
    autre: { label: t.docAutre, emoji: '📄' },
  }
}

// ─── Majorité labels (locale-aware) ──────────────────────────────────────────

function getMajoriteLabels(locale: string): Record<string, { label: string; color: string }> {
  if (locale === 'pt') return {
    art24: { label: 'Maioria simples', color: 'bg-blue-100 text-blue-700' },
    art25: { label: '2/3 do valor', color: 'bg-[rgba(201,168,76,0.15)] text-[#A8842A]' },
    art26: { label: 'Dupla maioria', color: 'bg-orange-100 text-orange-700' },
    unanimite: { label: 'Unanimidade', color: 'bg-red-100 text-red-700' },
  }
  return MAJORITE_LABELS
}

// ─── Modules configurables (locale-aware) ─────────────────────────────────────

function getCoproModules(t: TDict) {
  return [
    { key: 'documents' as const, label: t.nav_documents, icon: '📁', description: t.mod_documents, default: true },
    { key: 'paiements' as const, label: t.nav_paiements, icon: '💶', description: t.mod_paiements, default: true },
    { key: 'mes_charges' as const, label: t.nav_mes_charges, icon: '💰', description: t.mod_mes_charges, default: true },
    { key: 'quittances' as const, label: t.nav_quittances, icon: '🧾', description: t.mod_quittances, default: false },
    { key: 'mon_bail' as const, label: t.nav_mon_bail, icon: '📜', description: t.mod_mon_bail, default: false },
    { key: 'interventions_suivi' as const, label: t.nav_interventions, icon: '🔧', description: t.mod_interventions, default: true },
    { key: 'annonces' as const, label: t.nav_annonces, icon: '📢', description: t.mod_annonces, default: true },
    { key: 'signalement' as const, label: t.nav_signalement, icon: '🔔', description: t.mod_signalement, default: true },
    { key: 'assemblees' as const, label: t.nav_assemblees, icon: '🏛️', description: t.mod_assemblees, default: true },
    { key: 'historique' as const, label: t.nav_historique, icon: '📈', description: t.mod_historique, default: false },
    { key: 'assistant' as const, label: t.nav_assistant, icon: '🤖', description: t.mod_assistant, default: true },
  ]
}

// ─── Navigation items (locale-aware) ────────────────────────────────────────

function getNavItems(t: TDict): { id: CoproPage; emoji: string; label: string }[] {
  return [
    { id: 'accueil', emoji: '📊', label: t.nav_accueil },
    { id: 'documents', emoji: '📁', label: t.nav_documents },
    { id: 'paiements', emoji: '💶', label: t.nav_paiements },
    { id: 'mes_charges', emoji: '💰', label: t.nav_mes_charges },
    { id: 'quittances', emoji: '🧾', label: t.nav_quittances },
    { id: 'mon_bail', emoji: '📜', label: t.nav_mon_bail },
    { id: 'interventions_suivi', emoji: '🔧', label: t.nav_interventions },
    { id: 'annonces', emoji: '📢', label: t.nav_annonces },
    { id: 'signalement', emoji: '🔔', label: t.nav_signalement },
    { id: 'assemblees', emoji: '🏛️', label: t.nav_assemblees },
    { id: 'historique', emoji: '📈', label: t.nav_historique },
    { id: 'modules', emoji: '🧩', label: t.nav_modules },
    { id: 'parametres', emoji: '⚙️', label: t.nav_parametres },
    { id: 'assistant', emoji: '🤖', label: t.nav_assistant },
  ]
}

// ─── Modules configurables (static, for default loading) ─────────────────────

const COPRO_MODULES = [
  { key: 'documents', label: 'Documents', icon: '📁', description: 'Accès aux PV, comptes et documents copro', default: true },
  { key: 'paiements', label: 'Paiements', icon: '💶', description: 'Suivi et historique de vos paiements', default: true },
  { key: 'mes_charges', label: 'Mes Charges', icon: '💰', description: 'Détail mensuel de vos charges', default: true },
  { key: 'quittances', label: 'Quittances loyer', icon: '🧾', description: 'Vos quittances de loyer mensuelles', default: false },
  { key: 'mon_bail', label: 'Mon Bail', icon: '📜', description: 'Informations de votre bail et renouvellement', default: false },
  { key: 'interventions_suivi', label: 'Mes Interventions', icon: '🔧', description: 'Suivi des travaux dans votre immeuble', default: true },
  { key: 'annonces', label: 'Annonces', icon: '📢', description: 'Annonces du syndic et de la copro', default: true },
  { key: 'signalement', label: 'Signalement', icon: '🔔', description: 'Signaler un problème dans l\'immeuble', default: true },
  { key: 'assemblees', label: 'Assemblées & Votes', icon: '🏛️', description: 'AG, résolutions et votes en ligne', default: true },
  { key: 'historique', label: 'Historique', icon: '📈', description: 'Historique de toutes vos actions', default: false },
  { key: 'assistant', label: 'Assistant Fixy', icon: '🤖', description: 'Posez vos questions à Fixy', default: true },
] as const
type CoproModuleKey = typeof COPRO_MODULES[number]['key']

// ─── Navigation (static, for reference) ────────────────────────────────────────

const NAV_ITEMS: { id: CoproPage; emoji: string; label: string }[] = [
  { id: 'accueil', emoji: '📊', label: 'Tableau de bord' },
  { id: 'documents', emoji: '📁', label: 'Documents' },
  { id: 'paiements', emoji: '💶', label: 'Paiements' },
  { id: 'mes_charges', emoji: '💰', label: 'Mes Charges' },
  { id: 'quittances', emoji: '🧾', label: 'Quittances loyer' },
  { id: 'mon_bail', emoji: '📜', label: 'Mon Bail' },
  { id: 'interventions_suivi', emoji: '🔧', label: 'Mes Interventions' },
  { id: 'annonces', emoji: '📢', label: 'Annonces' },
  { id: 'signalement', emoji: '🔔', label: 'Signalement' },
  { id: 'assemblees', emoji: '🏛️', label: 'Assemblées & Votes' },
  { id: 'historique', emoji: '📈', label: 'Historique' },
  { id: 'modules', emoji: '🧩', label: 'Modules' },
  { id: 'parametres', emoji: '⚙️', label: 'Paramètres' },
  { id: 'assistant', emoji: '🤖', label: 'Assistant Fixy' },
]

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CoproprietaireDashboard() {
  // ── Locale ──
  const locale = useLocale()
  const t = useMemo(() => getT(locale), [locale])
  const navItems = useMemo(() => getNavItems(t), [t])
  const navCategories = useMemo(() => getNavCategories(t), [t])
  const coproModules = useMemo(() => getCoproModules(t), [t])
  const docTypeLabels = useMemo(() => getDocTypeLabels(t), [t])
  const majoriteLabels = useMemo(() => getMajoriteLabels(locale), [locale])
  const typesIntervention = useMemo(() => getTypesIntervention(locale), [locale])
  const zonesCommunes = useMemo(() => getZonesCommunes(locale), [locale])
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  // Auth
  const [user, setUser] = useState<any>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [loading, setLoading] = useState(true)

  // Navigation
  const [page, setPage] = useState<CoproPage>('accueil')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // ── Modules personnalisables ──
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({})

  // Données
  const [profile, setProfile] = useState<CoproProfile>(PROFILE_DEMO)
  const [charges, setCharges] = useState<ChargesMensuelles[]>(CHARGES_DEMO)
  const [paiements, setPaiements] = useState<Paiement[]>(PAIEMENTS_DEMO)
  const [documents, setDocuments] = useState<DocumentCopro[]>(DOCUMENTS_DEMO)
  const [annonces, setAnnonces] = useState<Annonce[]>(ANNONCES_DEMO)
  const [ags, setAgs] = useState<AssembleeGenerale[]>(AG_DEMO)
  const [echeances, setEcheances] = useState<Echeance[]>(ECHEANCES_DEMO)
  const [notifications, setNotifications] = useState<CoproNotification[]>(NOTIFICATIONS_DEMO)
  const [historique, setHistorique] = useState<HistoriqueEntry[]>(HISTORIQUE_DEMO)
  const [params, setParams] = useState<ParamConfidentialite>(PARAMS_DEMO)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)

  // Signalement (mini form dans Communication)
  const [signalemType, setSignalemType] = useState('')
  const [signalemDesc, setSignalemDesc] = useState('')
  const [signalemUrgence, setSignalemUrgence] = useState<'normale' | 'urgente' | 'planifiee'>('normale')
  const [signalemPartieCommune, setSignalemPartieCommune] = useState(false)
  const [signalemZone, setSignalemZone] = useState('')
  const [signalemEnvoye, setSignalemEnvoye] = useState(false)

  // (docFilterType, docFilterAnnee, docSearch internalized in CoproDocumentsSection)
  // (paiementTab internalized in CoproPaiementsSection)
  // (selectedAG internalized in CoproAssembleesSection)
  // (histoFilter internalized in CoproHistoriqueSection)

  // Paramètres
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ nom: '', prenom: '', email: '', telephone: '' })

  // (assistantMessages, assistantInput, assistantLoading, assistantEndRef internalized in CoproAssistantSection)

  // ── Auth ──
  useEffect(() => {
    const check = async () => {
      await supabase.auth.refreshSession()
      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) {
        setUser(u)
        // Load localStorage data
        const uid = u.id
        try {
          const k = (key: string) => localStorage.getItem(`fixit_copro_${key}_${uid}`)
          const p = (key: string, fallback: any) => {
            const raw = k(key)
            return raw ? JSON.parse(raw) : fallback
          }
          setProfile(p('profile', PROFILE_DEMO))
          setCharges(p('charges', CHARGES_DEMO))
          setPaiements(p('paiements', PAIEMENTS_DEMO))
          setDocuments(p('documents', DOCUMENTS_DEMO))
          setAnnonces(p('annonces', ANNONCES_DEMO))
          setAgs(p('ags', AG_DEMO))
          setEcheances(p('echeances', ECHEANCES_DEMO))
          setNotifications(p('notifications', NOTIFICATIONS_DEMO))
          setHistorique(p('historique', HISTORIQUE_DEMO))
          setParams(p('params', PARAMS_DEMO))
          // Load enabled modules
          try {
            const savedModules = localStorage.getItem(`fixit_modules_copro_${uid}`)
            if (savedModules) {
              setEnabledModules(JSON.parse(savedModules))
            } else {
              const defaults: Record<string, boolean> = {}
              COPRO_MODULES.forEach(m => { defaults[m.key] = m.default })
              setEnabledModules(defaults)
            }
          } catch (e) {
            console.warn('[dashboard] localStorage modules read failed (private browsing?)', e)
          }
        } catch (e) {
          console.warn('[dashboard] localStorage data load failed (private browsing?)', e)
        }
      } else {
        // Mode démo sans auth
        setIsDemoMode(true)
        setProfile(PROFILE_DEMO)
        const defaults: Record<string, boolean> = {}
        COPRO_MODULES.forEach(m => { defaults[m.key] = m.default })
        setEnabledModules(defaults)
      }
      setDataLoaded(true)
      setLoading(false)
    }
    check()
  }, [])

  // ── Save to localStorage ──
  useEffect(() => {
    if (!dataLoaded) return
    const uid = user?.id || 'demo'
    const s = (key: string, data: any) => {
      try { localStorage.setItem(`fixit_copro_${key}_${uid}`, JSON.stringify(data)) } catch (e) {
        console.warn(`[dashboard] localStorage.setItem fixit_copro_${key} failed (private browsing?)`, e)
      }
    }
    s('profile', profile)
    s('charges', charges)
    s('paiements', paiements)
    s('documents', documents)
    s('annonces', annonces)
    s('ags', ags)
    s('echeances', echeances)
    s('notifications', notifications)
    s('historique', historique)
    s('params', params)
  }, [profile, charges, paiements, documents, annonces, ags, echeances, notifications, historique, params, dataLoaded, user])

  // ── Computed ──
  const chargesDuMois = charges.find(c => c.mois === new Date().toISOString().slice(0, 7))
  const solde = paiements.filter(p => p.statut !== 'payee').reduce((sum, p) => sum + p.montant, 0)
  const paiementsEnAttente = paiements.filter(p => p.statut === 'en_attente').length
  const notifNonLues = notifications.filter(n => !n.lu).length
  const annoncesNonLues = annonces.filter(a => !a.lu).length

  const userName = `${profile.prenom} ${profile.nom}`
  const initials = `${profile.prenom[0]}${profile.nom[0]}`
  const isAdminOverride = user?.user_metadata?._admin_override === true

  // ── Actions ──
  const handleLogout = async () => {
    setLogoutLoading(true)
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const markNotifRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
  }

  const markAllNotifsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
  }

  const markAnnonceRead = (id: string) => {
    setAnnonces(prev => prev.map(a => a.id === id ? { ...a, lu: true } : a))
  }

  const markDocConsulte = (id: string) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, consulte: true, dateConsultation: new Date().toISOString().slice(0, 10) } : d))
  }

  const handleEnvoyerSignalement = () => {
    if (!signalemType || !signalemDesc) return
    const locationLabel = signalemPartieCommune
      ? `Partie commune — ${signalemZone || 'Zone non précisée'}`
      : `${profile.immeuble} · Bât. ${profile.batiment} · Ét. ${profile.etage} · Lot ${profile.numLot}`
    const msgTexte = `📋 SIGNALEMENT — ${signalemType}\n\n👤 De : ${profile.prenom} ${profile.nom} (Copropriétaire)\n📍 Localisation : ${locationLabel}\n🔔 Urgence : ${signalemUrgence === 'urgente' ? '🔴 URGENT' : signalemUrgence === 'planifiee' ? '🟢 Planifiée' : '🟡 Normale'}\n\n📝 Description :\n${signalemDesc}`
    const newMsg: CanalMessage = {
      auteur: `${profile.prenom} ${profile.nom}`,
      role: 'coproprio',
      texte: msgTexte,
      date: new Date().toISOString(),
      type: 'signalement',
    }
    // Sauvegarder dans le canal partagé avec le portail
    const canalKey = `canal_demandeur_${profile.prenom}_${profile.nom}`
    try {
      const existing = JSON.parse(localStorage.getItem(canalKey) || '[]')
      localStorage.setItem(canalKey, JSON.stringify([...existing, newMsg]))
    } catch (e) {
      console.warn('[dashboard] localStorage canal write failed (private browsing?)', e)
    }
    // Créer la mission dans les données syndic
    const missionData = {
      id: Date.now().toString(),
      type: signalemType,
      description: signalemDesc,
      priorite: signalemUrgence,
      statut: 'en_attente',
      dateCreation: new Date().toISOString(),
      immeuble: signalemPartieCommune ? signalemZone : profile.immeuble,
      batiment: profile.batiment,
      etage: profile.etage,
      numLot: profile.numLot,
      artisan: '',
      locataire: `${profile.prenom} ${profile.nom}`,
      telephoneLocataire: profile.telephone,
      demandeurNom: `${profile.prenom} ${profile.nom}`,
      demandeurRole: 'coproprio',
      demandeurEmail: profile.email,
      estPartieCommune: signalemPartieCommune,
      zoneSignalee: signalemZone,
      demandeurMessages: [newMsg],
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('fixit_syndic_missions_')) continue
      try {
        const existing = JSON.parse(localStorage.getItem(key) || '[]')
        existing.unshift(missionData)
        localStorage.setItem(key, JSON.stringify(existing))
        break
      } catch (e) {
        console.warn('[dashboard] localStorage syndic missions write failed (private browsing?)', e)
      }
    }
    // Ajouter à l'historique
    const newEntry: HistoriqueEntry = {
      id: Date.now().toString(),
      type: 'signalement',
      titre: `Signalement — ${signalemType.split(' ').slice(1).join(' ')}`,
      description: signalemDesc.slice(0, 80) + (signalemDesc.length > 80 ? '…' : ''),
      date: new Date().toISOString().slice(0, 10),
    }
    setHistorique(prev => [newEntry, ...prev])
    setSignalemEnvoye(true)
    setSignalemType('')
    setSignalemDesc('')
    setSignalemUrgence('normale')
    setSignalemPartieCommune(false)
    setSignalemZone('')
    setTimeout(() => setSignalemEnvoye(false), 3000)
  }

  const handleVote = (agId: string, resId: string, vote: 'pour' | 'contre' | 'abstention') => {
    setAgs(prev => prev.map(ag => {
      if (ag.id !== agId) return ag
      return {
        ...ag,
        resolutions: ag.resolutions.map(r => {
          if (r.id !== resId || r.monVote) return r
          return {
            ...r,
            monVote: vote,
            votePour: r.votePour + (vote === 'pour' ? profile.tantiemes : 0),
            voteContre: r.voteContre + (vote === 'contre' ? profile.tantiemes : 0),
            voteAbstention: r.voteAbstention + (vote === 'abstention' ? profile.tantiemes : 0),
          }
        })
      }
    }))
  }

  const saveProfile = () => {
    setProfile(prev => ({
      ...prev,
      nom: profileForm.nom || prev.nom,
      prenom: profileForm.prenom || prev.prenom,
      email: profileForm.email || prev.email,
      telephone: profileForm.telephone || prev.telephone,
    }))
    setEditProfile(false)
  }

  // ── Assistant IA ──
  const buildCoproSystemPrompt = () => {
    const paiementsAttente = paiements.filter(p => p.statut === 'en_attente')
    const docsListe = documents.map(d => `- ${d.nom} (${d.annee}, ${docTypeLabels[d.type]?.label || d.type})`).join('\n')
    const isPT = locale === 'pt'
    return isPT
      ? `Tu és o Fixy, o assistente IA pessoal de ${profile.prenom} ${profile.nom}, condómino no ${profile.immeuble}, bloco ${profile.batiment}, piso ${profile.etage}, fração n.º ${profile.numLot}. Tens acesso a todas as informações do condomínio. Responde de forma clara, simpática e acessível — algumas pessoas não estão à vontade com a tecnologia. Responde sempre em português.

=== PERFIL DO CONDÓMINO ===
Nome: ${profile.prenom} ${profile.nom}
Email: ${profile.email} | Telefone: ${profile.telephone}
Edifício: ${profile.immeuble} | Bloco: ${profile.batiment} | Piso: ${profile.etage} | Fração: ${profile.numLot}
Permilagem: ${profile.tantiemes}/10 000 | Quota-parte: ${profile.quotePart}%

=== SITUAÇÃO FINANCEIRA ===
Quotas do mês: ${chargesDuMois?.montant || 285}€ — ${chargesDuMois?.statut === 'payee' ? 'PAGA' : 'PENDENTE'}
Saldo total a pagar: ${solde}€ (${paiementsAttente.length} pagamento(s) pendente(s))
Detalhe pagamentos pendentes:
${paiementsAttente.map(p => `- ${p.description}: ${p.montant}€ (vencimento ${formatDate(p.dateEcheance)}, ref: ${p.reference})`).join('\n') || '- Nenhum pagamento pendente'}

=== PRÓXIMOS VENCIMENTOS ===
${echeances.sort((a, b) => a.date.localeCompare(b.date)).map(e => `- [${formatDate(e.date)}] ${e.titre}: ${e.description}${e.urgent ? ' ⚠️ URGENTE' : ''}`).join('\n')}

=== DOCUMENTOS DISPONÍVEIS (separador Documentos) ===
${docsListe}

=== AVISOS DO ADMINISTRADOR ===
${annonces.map(a => `- [${a.date}] ${a.importance.toUpperCase()} — ${a.titre}: ${a.contenu}`).join('\n')}

=== ASSEMBLEIAS GERAIS ===
${ags.map(ag => {
  const resLines = ag.resolutions.map(r =>
    `  • ${r.titre}: ${r.description.slice(0, 120)} | Meu voto: ${r.monVote || 'ainda não votou'} | Resultado: ${r.resultat || (r.statut === 'ouverte' ? 'votação em curso' : 'N/A')} | A favor: ${r.votePour} permilagens, Contra: ${r.voteContre}, Abstenção: ${r.voteAbstention}`
  ).join('\n')
  return `AG: ${ag.titre} — ${formatDate(ag.date)}, ${ag.lieu}\nEstado: ${ag.statut}\nOrdem do dia:${ag.ordreDuJour.map(o => `\n  • ${o}`).join('')}\nDeliberações:\n${resLines}`
}).join('\n\n---\n\n')}

=== HISTÓRICO RECENTE ===
${historique.slice(0, 15).map(h => `- [${h.date}] ${h.titre}: ${h.description}${h.montant !== undefined ? ` (${h.montant >= 0 ? '+' : ''}${h.montant}€)` : ''}`).join('\n')}

=== REGRAS DE RESPOSTA ===
- Sê preciso com os números e datas dos dados acima.
- Para descarregar um documento → direcionar para o separador "Documentos" do menu.
- Para votar em AG → separador "Assembleias & Votos".
- Para pagar → separador "Pagamentos".
- Para uma ocorrência → separador "Ocorrência".
- Ajuda as pessoas menos à vontade com a tecnologia com explicações simples e acolhedoras.
- Podes responder a TODAS as perguntas: finanças, regulamento do condomínio, obras, votos, contabilidade, direitos do condómino, etc.`
      : `Tu es Fixy, l'assistant IA personnel de ${profile.prenom} ${profile.nom}, copropriétaire au ${profile.immeuble}, bâtiment ${profile.batiment}, étage ${profile.etage}, lot n°${profile.numLot}. Tu as accès à toutes les informations de sa copropriété. Réponds de façon claire, conviviale et accessible — certaines personnes ne sont pas à l'aise avec la technologie. Réponds toujours en français.

=== PROFIL COPROPRIÉTAIRE ===
Nom: ${profile.prenom} ${profile.nom}
Email: ${profile.email} | Téléphone: ${profile.telephone}
Immeuble: ${profile.immeuble} | Bâtiment: ${profile.batiment} | Étage: ${profile.etage} | Lot: ${profile.numLot}
Tantièmes: ${profile.tantiemes}/10 000 | Quote-part: ${profile.quotePart}%

=== SITUATION FINANCIÈRE ===
Charges du mois: ${chargesDuMois?.montant || 285}€ — ${chargesDuMois?.statut === 'payee' ? 'PAYÉE' : 'EN ATTENTE'}
Solde total à régler: ${solde}€ (${paiementsAttente.length} paiement(s) en attente)
Détail paiements en attente:
${paiementsAttente.map(p => `- ${p.description}: ${p.montant}€ (échéance ${formatDate(p.dateEcheance)}, réf: ${p.reference})`).join('\n') || '- Aucun paiement en attente'}

=== PROCHAINES ÉCHÉANCES ===
${echeances.sort((a, b) => a.date.localeCompare(b.date)).map(e => `- [${formatDate(e.date)}] ${e.titre}: ${e.description}${e.urgent ? ' ⚠️ URGENT' : ''}`).join('\n')}

=== DOCUMENTS DISPONIBLES (onglet Documents) ===
${docsListe}

=== ANNONCES DU SYNDIC ===
${annonces.map(a => `- [${a.date}] ${a.importance.toUpperCase()} — ${a.titre}: ${a.contenu}`).join('\n')}

=== ASSEMBLÉES GÉNÉRALES ===
${ags.map(ag => {
  const resLines = ag.resolutions.map(r =>
    `  • ${r.titre}: ${r.description.slice(0, 120)} | Mon vote: ${r.monVote || 'pas encore voté'} | Résultat: ${r.resultat || (r.statut === 'ouverte' ? 'vote en cours' : 'N/A')} | Pour: ${r.votePour} tantièmes, Contre: ${r.voteContre}, Abstention: ${r.voteAbstention}`
  ).join('\n')
  return `AG: ${ag.titre} — ${formatDate(ag.date)}, ${ag.lieu}\nStatut: ${ag.statut}\nOrdre du jour:${ag.ordreDuJour.map(o => `\n  • ${o}`).join('')}\nRésolutions:\n${resLines}`
}).join('\n\n---\n\n')}

=== HISTORIQUE RÉCENT ===
${historique.slice(0, 15).map(h => `- [${h.date}] ${h.titre}: ${h.description}${h.montant !== undefined ? ` (${h.montant >= 0 ? '+' : ''}${h.montant}€)` : ''}`).join('\n')}

=== RÈGLES DE RÉPONSE ===
- Sois précis avec les chiffres et les dates issus des données ci-dessus.
- Pour télécharger un document → orienter vers l'onglet "Documents" du menu.
- Pour voter en AG → onglet "Assemblées & Votes".
- Pour payer → onglet "Paiements".
- Pour un signalement → onglet "Signalement".
- Aide les personnes peu à l'aise avec la technologie avec des explications simples et bienveillantes.
- Tu peux répondre à TOUTES les questions: finances, règlement de copropriété, travaux, votes, comptabilité, droits du copropriétaire, etc.`
  }

  // (sendAssistantMessage internalized in CoproAssistantSection)

  // ── Module helpers ──
  const isModuleEnabled = (key: string): boolean => {
    if (Object.keys(enabledModules).length === 0) {
      return COPRO_MODULES.find(m => m.key === key)?.default ?? true
    }
    return enabledModules[key] ?? COPRO_MODULES.find(m => m.key === key)?.default ?? true
  }

  const toggleModule = (key: string) => {
    const updated = { ...enabledModules, [key]: !isModuleEnabled(key) }
    setEnabledModules(updated)
    if (user) localStorage.setItem(`fixit_modules_copro_${user.id}`, JSON.stringify(updated))
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F4EE]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#4A5E78] font-medium">{t.loading}</p>
        </div>
      </div>
    )
  }

  // ── Rendu ──
  return (
    <div id="copro-dashboard" className="flex h-screen bg-[#F7F4EE] overflow-hidden">

      {/* ── BOUTON RETOUR ADMIN ── */}
      {isAdminOverride && (
        <div className="fixed top-3 right-3 z-[9999]">
          <button
            onClick={async () => {
              setAdminLoading(true)
              await supabase.auth.updateUser({ data: { ...user?.user_metadata, role: 'super_admin', _admin_override: false } })
              await supabase.auth.refreshSession()
              window.location.href = '/admin/dashboard'
            }}
            disabled={adminLoading}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-[#0D1B2E] font-bold text-xs px-4 py-2 rounded-full shadow-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {adminLoading ? '...' : t.retourAdmin}
          </button>
        </div>
      )}

      {/* ── MOBILE BACKDROP ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        role="navigation"
        aria-label={t.navigation || 'Navigation'}
        className={`fixed md:relative z-50 md:z-auto transition-transform duration-300 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ width: sidebarOpen ? 240 : 64, background: 'var(--sd-navy)', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--sd-border-dark)', overflowY: 'auto', height: '100vh', top: 0, left: 0 }}
      >
        {/* Grid texture overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ padding: '0 20px', height: 80, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--sd-border-dark)', position: 'relative', gap: 12, flexShrink: 0 }}>
          <div
            style={{ width: 36, height: 36, background: 'linear-gradient(135deg,var(--sd-gold),#A8842A)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display',serif", color: 'var(--sd-navy)', fontSize: 17, fontWeight: 600, boxShadow: '0 4px 12px rgba(201,168,76,0.3)', flexShrink: 0, cursor: 'pointer' }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? t.reduire : t.developper}
          >V</div>
          {sidebarOpen && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", color: '#fff', fontSize: 16, lineHeight: 1.1, letterSpacing: '0.5px' }}>VitFix Copro</div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '2.5px', textTransform: 'uppercase' as const, color: 'var(--sd-gold)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {profile.immeuble}
              </div>
            </div>
          )}
        </div>

        {/* Nav — categorized */}
        <nav style={{ flex: 1, paddingTop: 8, paddingBottom: 8, overflowY: 'auto', position: 'relative' }}>
          {navCategories.map((cat, ci) => {
            const visibleItems = navItems.filter(item => cat.items.includes(item.id) && (['accueil', 'parametres', 'modules'].includes(item.id) || isModuleEnabled(item.id)))
            if (visibleItems.length === 0) return null
            return (
              <div key={ci}>
                {/* Category label */}
                {sidebarOpen && (
                  <div style={{ padding: '10px 24px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.25)', fontFamily: "var(--font-outfit), 'Outfit', sans-serif", marginTop: ci > 0 ? 8 : 0 }}>
                    {cat.label}
                  </div>
                )}
                {!sidebarOpen && ci > 0 && (
                  <div style={{ margin: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }} />
                )}
                {visibleItems.map(item => {
                  const isActive = page === item.id
                  const badge = item.id === 'annonces' ? annoncesNonLues : item.id === 'accueil' ? notifNonLues : 0
                  return (
                    <button
                      key={item.id}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => { setPage(item.id); if (window.innerWidth < 768) setSidebarOpen(false) }}
                      style={{
                        width: 'calc(100% - 16px)', display: 'flex', alignItems: 'center', gap: 11,
                        padding: '10px 16px', margin: '1px 8px',
                        borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 500 : 400,
                        fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
                        transition: 'all 0.18s ease', border: isActive ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent', textAlign: 'left' as const,
                        background: isActive ? 'var(--sd-gold-dim)' : 'transparent',
                        color: isActive ? 'var(--sd-gold-light)' : 'rgba(255,255,255,0.45)',
                        position: 'relative' as const,
                      }}
                      onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)' } }}
                      onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' } }}
                    >
                      {isActive && <div style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, background: 'var(--sd-gold)', borderRadius: '0 3px 3px 0' }} />}
                      <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0, filter: isActive ? 'none' : 'grayscale(30%)' }}>{item.emoji}</span>
                      {sidebarOpen && (
                        <>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.label}</span>
                          {badge > 0 && (
                            <span style={{ marginLeft: 'auto', background: isActive ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.1)', color: isActive ? 'var(--sd-gold-light)' : 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>
                              {badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
          <button
            onClick={handleLogout}
            disabled={logoutLoading}
            style={{ width: 'calc(100% - 16px)', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px', margin: '1px 8px', borderRadius: 8, cursor: logoutLoading ? 'not-allowed' : 'pointer', fontSize: 13, background: 'transparent', border: '1px solid transparent', color: 'rgba(255,255,255,0.45)', textAlign: 'left' as const, transition: 'all 0.15s', fontFamily: "var(--font-outfit), 'Outfit', sans-serif", opacity: logoutLoading ? 0.6 : 1 }}
            onMouseEnter={e => { if (!logoutLoading) { (e.currentTarget as HTMLElement).style.background = 'rgba(192,57,43,0.15)'; (e.currentTarget as HTMLElement).style.color = '#e74c3c' } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' }}
          >
            <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>🚪</span>
            {sidebarOpen && <span>{logoutLoading ? '...' : t.deconnexion}</span>}
          </button>
        </nav>

        {/* User footer */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--sd-border-dark)', position: 'relative', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'default' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,var(--sd-gold),#A8842A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sd-navy)', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {initials}
            </div>
            {sidebarOpen && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{userName}</div>
                <div style={{ color: 'var(--sd-gold)', fontSize: 10, letterSpacing: '0.4px', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {t.coproLot} {profile.numLot}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── CONTENU PRINCIPAL ── */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--sd-cream)' }}>
        {/* Demo mode banner */}
        {isDemoMode && (
          <div style={{ background: '#FFF3CD', borderBottom: '1px solid #FFECB5', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: '#664D03' }}>
            <span>Mode démonstration</span>
            <span style={{ fontSize: 11, opacity: 0.8 }}>Les données affichées sont fictives. Connectez-vous pour accéder à votre espace.</span>
          </div>
        )}
        {/* Header */}
        <header style={{ background: '#fff', borderBottom: '1px solid var(--sd-border)', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 0 var(--sd-border), 0 4px 16px rgba(13,27,46,0.04)' }} className="px-4 md:px-9">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg border border-[var(--sd-border)] bg-white"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sd-navy)" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            <div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 400, color: 'var(--sd-navy)', letterSpacing: '0.2px' }}>
              {navItems.find(n => n.id === page)?.emoji} {navItems.find(n => n.id === page)?.label}
            </h1>
            <p style={{ fontSize: 11, color: 'var(--sd-ink-3)', letterSpacing: '0.3px' }} className="hidden sm:block">
              {profile.immeuble} · {t.bat} {profile.batiment} · {t.lot} {profile.numLot} · {new Date().toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setPage('accueil')}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg, var(--sd-gold), #A8842A)', color: 'var(--sd-navy)', border: 'none', padding: '9px 18px', borderRadius: 9, fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.2px', boxShadow: '0 2px 8px rgba(201,168,76,0.35)', position: 'relative' }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--sd-navy)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5a4.5 4.5 0 00-4.5 4.5v2.5L2 10.5h12L12.5 8.5V6A4.5 4.5 0 008 1.5z"/><path d="M6.5 12.5a1.5 1.5 0 003 0"/></svg>
              {t.notifications}
              {notifNonLues > 0 && (
                <span style={{ background: '#e74c3c', color: '#fff', fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', marginLeft: 2 }}>
                  {notifNonLues > 9 ? '9+' : notifNonLues}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Contenu pages */}
        <div className="p-6">

          {/* PAGE : ACCUEIL */}
          {page === 'accueil' && (
            <CoproAccueilSection
              t={t} locale={locale} profile={profile} chargesDuMois={chargesDuMois} solde={solde}
              paiementsEnAttente={paiementsEnAttente} notifNonLues={notifNonLues}
              echeances={echeances} notifications={notifications} annonces={annonces}
              setPage={setPage} markNotifRead={markNotifRead} markAllNotifsRead={markAllNotifsRead}
            />
          )}

          {/* PAGE : DOCUMENTS */}
          {page === 'documents' && (
            <CoproDocumentsSection t={t} locale={locale} documents={documents} docTypeLabels={docTypeLabels} markDocConsulte={markDocConsulte} />
          )}

          {/* PAGE : PAIEMENTS */}
          {page === 'paiements' && (
            <CoproPaiementsSection t={t} locale={locale} paiements={paiements} />
          )}

          {/* PAGE : ANNONCES */}
          {page === 'annonces' && (
            <CoproAnnoncesSection t={t} annonces={annonces} markAnnonceRead={markAnnonceRead} />
          )}

          {/* PAGE : SIGNALEMENT */}
          {page === 'signalement' && (
            <CoproSignalementSection
              t={t} profile={profile} typesIntervention={typesIntervention} zonesCommunes={zonesCommunes}
              setPage={setPage} handleEnvoyerSignalement={handleEnvoyerSignalement}
              signalemType={signalemType} setSignalemType={setSignalemType}
              signalemDesc={signalemDesc} setSignalemDesc={setSignalemDesc}
              signalemUrgence={signalemUrgence} setSignalemUrgence={setSignalemUrgence}
              signalemPartieCommune={signalemPartieCommune} setSignalemPartieCommune={setSignalemPartieCommune}
              signalemZone={signalemZone} setSignalemZone={setSignalemZone}
              signalemEnvoye={signalemEnvoye}
            />
          )}

          {/* PAGE : ASSEMBLEES & VOTES */}
          {page === 'assemblees' && (
            <CoproAssembleesSection t={t} locale={locale} ags={ags} profile={profile} majoriteLabels={majoriteLabels} handleVote={handleVote} />
          )}

          {/* PAGE : HISTORIQUE & REPORTING */}
          {page === 'historique' && (
            <CoproHistoriqueSection t={t} locale={locale} profile={profile} charges={charges} historique={historique} />
          )}

          {/* PAGE : MODULES */}
          {page === 'modules' && (
            <CoproModulesSection t={t} coproModules={coproModules} isModuleEnabled={isModuleEnabled} toggleModule={toggleModule} />
          )}

          {/* PAGE : PARAMETRES */}
          {page === 'parametres' && (
            <CoproParametresSection
              t={t} locale={locale} profile={profile} params={params} setParams={setParams}
              saveProfile={saveProfile} editProfile={editProfile} setEditProfile={setEditProfile}
              profileForm={profileForm} setProfileForm={setProfileForm}
            />
          )}

          {/* PAGE : ASSISTANT IA SOFIA */}
          {page === 'assistant' && (
            <CoproAssistantSection t={t} profile={profile} buildCoproSystemPrompt={buildCoproSystemPrompt} />
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : MES INTERVENTIONS — SUIVI TEMPS RÉEL
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'interventions_suivi' && (
            <CoproMesInterventionsSection profile={profile} />
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : QUITTANCES DE LOYER
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'quittances' && (
            <CoproQuittancesSection profile={profile} />
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : MON BAIL
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'mon_bail' && (
            <CoproMonBailSection profile={profile} />
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : MES CHARGES — BREAKDOWN ANNUEL
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'mes_charges' && (
            <CoproMesChargesSection profile={profile} paiements={paiements} charges={charges} />
          )}

        </div>

        {/* Bouton flottant Fixy */}
        {page !== 'assistant' && (
          <button
            onClick={() => setPage('assistant')}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#C9A84C] hover:bg-[#F0D898] text-[#0D1B2E] font-bold px-5 py-3 rounded-full shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="25" y="45" width="50" height="35" rx="8" fill="#C9A84C"/>
              <rect x="28" y="18" width="44" height="30" rx="10" fill="#F0D898"/>
              <circle cx="40" cy="30" r="5" fill="#1a1a2e"/><circle cx="60" cy="30" r="5" fill="#1a1a2e"/>
              <path d="M42 38 Q50 44 58 38" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <line x1="50" y1="18" x2="50" y2="8" stroke="#C9A84C" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="50" cy="6" r="4" fill="#FF9800"/>
            </svg>
            <span className="text-sm">Fixy</span>
          </button>
        )}

      </main>
    </div>
  )
}
