'use client'

import React, { useState, useEffect, useRef, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { subscribeWithReconnect } from '@/lib/realtime-reconnect'
import { toast } from 'sonner'
import { POLL_MISSIONS, TOAST_SHORT, TOAST_DEFAULT } from '@/lib/constants'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import { MaxAvatar } from '@/components/common/RobotAvatars'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { generateMaxPDF as generateMaxPDFUtil, parseDocPDF as parseDocPDFUtil } from '@/lib/syndic-pdf'
import type { User } from '@supabase/supabase-js'

// ─── Types (from shared types file) ──────────────────────────────────────────
import type {
  Page, Immeuble, Artisan, SyndicMessage, CanalInterneMsg, Mission,
  Alerte, PlanningEvent, Coproprio, EcheanceReglementaire, SignatureData,
} from '@/components/syndic-dashboard/types'
import {
  ROLE_COLORS, getRoleLabel,
  Badge, PrioriteBadge,
} from '@/components/syndic-dashboard/types'
import { ROLE_PAGES, SYNDIC_MODULES, EVENT_COLORS } from '@/components/syndic-dashboard/config'

// ─── Lazy-loaded Section Components (code-splitting) ─────────────────────────
// Dynamic import helper — cast as ComponentType<any> since loader erases prop types
// Components with complex typed callbacks should use static imports instead (see above)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const d = (loader: () => Promise<any>) => dynamic(loader, { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" /></div> }) as React.ComponentType<any>
const EquipeSection = d(() => import('@/components/syndic-dashboard/misc/EquipeSection'))
const AnalyseDevisSection = d(() => import('@/components/syndic-dashboard/reporting/AnalyseDevisSection'))
const DocsInterventionsSection = d(() => import('@/components/syndic-dashboard/operations/DocsInterventionsSection'))
const ComptabiliteTechSection = d(() => import('@/components/syndic-dashboard/financial/ComptabiliteTechSection'))
const EmailsSection = d(() => import('@/components/syndic-dashboard/communication/EmailsSection'))
const ModalNouveilleMission = d(() => import('@/components/syndic-dashboard/operations/ModalNouveilleMission'))
const GEDSection = d(() => import('@/components/syndic-dashboard/operations/GEDSection'))
const CopropriosSection = d(() => import('@/components/syndic-dashboard/residents/CopropriosSection'))
const CalendrierReglementaireSection = d(() => import('@/components/syndic-dashboard/legal/CalendrierReglementaireSection'))
const RapportMensuelSection = d(() => import('@/components/syndic-dashboard/reporting/RapportMensuelSection'))
const EcheancesSection = d(() => import('@/components/syndic-dashboard/legal/EcheancesSection'))
const RecouvrementSection = d(() => import('@/components/syndic-dashboard/financial/RecouvrementSection'))
const PreparateurAGSection = d(() => import('@/components/syndic-dashboard/governance/PreparateurAGSection'))
const ComptaCoproSection = d(() => import('@/components/syndic-dashboard/financial/ComptaCoproSection'))
const AGDigitaleSection = d(() => import('@/components/syndic-dashboard/governance/AGDigitaleSection'))
const ImpayésSection = d(() => import('@/components/syndic-dashboard/financial/ImpayesSection'))
const CarnetEntretienSection = d(() => import('@/components/syndic-dashboard/technical/CarnetEntretienSection'))
const SinistresSection = d(() => import('@/components/syndic-dashboard/operations/SinistresSection'))
const PointageSection = d(() => import('@/components/syndic-dashboard/operations/PointageSection'))
const ExtranetSection = d(() => import('@/components/syndic-dashboard/residents/ExtranetSection'))
const PPPTSection = d(() => import('@/components/syndic-dashboard/technical/PPPTSection'))
const HistoriqueImmeubleSection = d(() => import('@/components/syndic-dashboard/reporting/HistoriqueImmeubleSection'))
const UrgencesSection = d(() => import('@/components/syndic-dashboard/operations/UrgencesSection'))
const DPECollectifSection = d(() => import('@/components/syndic-dashboard/technical/DPECollectifSection'))
const VisiteTechniqueSection = d(() => import('@/components/syndic-dashboard/technical/VisiteTechniqueSection'))
const DeclaracaoEncargosSection = d(() => import('@/components/syndic-dashboard/financial/DeclaracaoEncargosSection'))
const SeguroCondominioSection = d(() => import('@/components/syndic-dashboard/legal/SeguroCondominioSection'))
const FundoReservaSection = d(() => import('@/components/syndic-dashboard/financial/FundoReservaSection'))
const VotacaoOnlineSection = d(() => import('@/components/syndic-dashboard/governance/VotacaoOnlineSection'))
const PortalCondominoSection = d(() => import('@/components/syndic-dashboard/residents/PortalCondominoSection'))
const PagamentosDigitaisSection = d(() => import('@/components/syndic-dashboard/financial/PagamentosDigitaisSection'))
const CarregamentoVESection = d(() => import('@/components/syndic-dashboard/technical/CarregamentoVESection'))
const ReservaEspacosSection = d(() => import('@/components/syndic-dashboard/residents/ReservaEspacosSection'))
const OcorrenciasSection = d(() => import('@/components/syndic-dashboard/operations/OcorrenciasSection'))
const EnquetesSection = d(() => import('@/components/syndic-dashboard/misc/EnquetesSection'))
const QuadroAvisosSection = d(() => import('@/components/syndic-dashboard/communication/QuadroAvisosSection'))
const AtasIASection = d(() => import('@/components/syndic-dashboard/governance/AtasIASection'))
const MapaQuotasSection = d(() => import('@/components/syndic-dashboard/financial/MapaQuotasSection'))
const OrcamentosObrasSection = d(() => import('@/components/syndic-dashboard/financial/OrcamentosObrasSection'))
const CobrancaJudicialSection = d(() => import('@/components/syndic-dashboard/financial/CobrancaJudicialSection'))
const MonitorizacaoConsumosSection = d(() => import('@/components/syndic-dashboard/technical/MonitorizacaoConsumosSection'))
const WhatsAppCondominosSection = d(() => import('@/components/syndic-dashboard/communication/WhatsAppCondominosSection'))
const ArquivoDigitalSection = d(() => import('@/components/syndic-dashboard/misc/ArquivoDigitalSection'))
// ── FR ──
const VoteCorrespondanceSection = d(() => import('@/components/syndic-dashboard/governance/VoteCorrespondanceSection'))
const ExtranetEnrichiSection = d(() => import('@/components/syndic-dashboard/residents/ExtranetEnrichiSection'))
const IRVESection = d(() => import('@/components/syndic-dashboard/technical/IRVESection'))
const SaisieIAFacturesSection = d(() => import('@/components/syndic-dashboard/financial/SaisieIAFacturesSection'))
const ReservationEspacesFRSection = d(() => import('@/components/syndic-dashboard/residents/ReservationEspacesFRSection'))
const SignalementsFRSection = d(() => import('@/components/syndic-dashboard/operations/SignalementsFRSection'))
const SondagesFRSection = d(() => import('@/components/syndic-dashboard/governance/SondagesFRSection'))
const PanneauAffichageSection = d(() => import('@/components/syndic-dashboard/communication/PanneauAffichageSection'))
const PVAssembleeIASection = d(() => import('@/components/syndic-dashboard/governance/PVAssembleeIASection'))
const AppelsFondsSection = d(() => import('@/components/syndic-dashboard/financial/AppelsFondsSection'))
const MiseEnConcurrenceSection = d(() => import('@/components/syndic-dashboard/misc/MiseEnConcurrenceSection'))
const RecouvrementEnrichiFRSection = d(() => import('@/components/syndic-dashboard/financial/RecouvrementEnrichiFRSection'))
const SuiviEnergetiqueFRSection = d(() => import('@/components/syndic-dashboard/technical/SuiviEnergetiqueFRSection'))
const CommunicationDematFRSection = d(() => import('@/components/syndic-dashboard/communication/CommunicationDematFRSection'))
const GEDCertifieeFRSection = d(() => import('@/components/syndic-dashboard/operations/GEDCertifieeFRSection'))
// Static imports for components with complex typed props (callbacks)
import MissionDetailsModal from '@/components/syndic-dashboard/operations/MissionDetailsModal'
import FacturationPageWithTransferts from '@/components/syndic-dashboard/financial/FacturationPageWithTransferts'
import CanalCommunicationsPage from '@/components/syndic-dashboard/communication/CanalCommunicationsPage'
const GmailConnectButton = d(() => import('@/components/syndic-dashboard/communication/GmailConnectButton'))
const SignatureModal = d(() => import('@/components/syndic-dashboard/misc/SignatureModal'))
// ── PT ──
const ObrigacoesLegaisSection = d(() => import('@/components/syndic-dashboard/legal/ObrigacoesLegaisSection'))
const RelatorioGestaoSection = d(() => import('@/components/syndic-dashboard/reporting/RelatorioGestaoSection'))
const PreparadorAssembleiaSection = d(() => import('@/components/syndic-dashboard/governance/PreparadorAssembleiaSection'))
const PlanoManutencaoSection = d(() => import('@/components/syndic-dashboard/technical/PlanoManutencaoSection'))
const CertificacaoEnergeticaSection = d(() => import('@/components/syndic-dashboard/technical/CertificacaoEnergeticaSection'))
// ── Extracted page sections ──
const AccueilSection = d(() => import('@/components/syndic-dashboard/pages/AccueilSection'))
const ImmeublesPageSection = d(() => import('@/components/syndic-dashboard/pages/ImmeublesSection'))
const ArtisansPageSection = d(() => import('@/components/syndic-dashboard/pages/ArtisansPageSection'))
const MissionsPageSection = d(() => import('@/components/syndic-dashboard/pages/MissionsPageSection'))
const PlanningSectionPage = d(() => import('@/components/syndic-dashboard/pages/PlanningSection'))
const AlertesSection = d(() => import('@/components/syndic-dashboard/pages/AlertesSection'))
const ModulesPageSection = d(() => import('@/components/syndic-dashboard/pages/ModulesSection'))
const ParametresPageSection = d(() => import('@/components/syndic-dashboard/pages/ParametresSection'))
const VistoriaTecnicaPTSection = d(() => import('@/components/syndic-dashboard/technical/VistoriaTecnicaSection'))
const PontuacaoSaudeSection = d(() => import('@/components/syndic-dashboard/reporting/PontuacaoSaudeSection'))
const OrcamentoAnualIASection = d(() => import('@/components/syndic-dashboard/financial/OrcamentoAnualIASection'))
const ContactoProativoIASection = d(() => import('@/components/syndic-dashboard/communication/ContactoProativoIASection'))
const OcorrenciasIASection = d(() => import('@/components/syndic-dashboard/operations/OcorrenciasIASection'))
const GestaoSegurosSection = d(() => import('@/components/syndic-dashboard/legal/GestaoSegurosSection'))
const ChecklistsIASection = d(() => import('@/components/syndic-dashboard/misc/ChecklistsIASection'))
const ProcessamentosLoteSection = d(() => import('@/components/syndic-dashboard/misc/ProcessamentosLoteSection'))
const AGLiveDigitalSection = d(() => import('@/components/syndic-dashboard/governance/AGLiveDigitalSection'))
const MarketplaceArtisansSection = d(() => import('@/components/syndic-dashboard/operations/MarketplaceArtisansSection'))
const PredicaoManutencaoSection = d(() => import('@/components/syndic-dashboard/technical/PredicaoManutencaoSection'))
const QRCodeFracaoSection = d(() => import('@/components/syndic-dashboard/residents/QRCodeFracaoSection'))
const DashboardCondominoRTSection = d(() => import('@/components/syndic-dashboard/residents/DashboardCondominoRTSection'))
const ComparadorEnergiaSection = d(() => import('@/components/syndic-dashboard/technical/ComparadorEnergiaSection'))
const AssinaturaCMDSection = d(() => import('@/components/syndic-dashboard/legal/AssinaturaCMDSection'))
const DashboardMultiImmeublesSection = d(() => import('@/components/syndic-dashboard/reporting/DashboardMultiImmeublesSection'))
const EFaturaATSection = d(() => import('@/components/syndic-dashboard/financial/EFaturaATSection'))
// ── Nouveaux modules internationaux ──
const InfractionsSection = d(() => import('@/components/syndic-dashboard/legal/InfractionsSection'))
const ReconciliationBancaireSection = d(() => import('@/components/syndic-dashboard/financial/ReconciliationBancaireSection'))
const BenchmarkingSection = d(() => import('@/components/syndic-dashboard/reporting/BenchmarkingSection'))
const ChatbotWhatsAppSection = d(() => import('@/components/syndic-dashboard/communication/ChatbotWhatsAppSection'))
const FixyAgentPage = d(() => import('@/components/syndic-dashboard/agents-ia/pages/FixyAgentPage'))
const MaxAgentPage = d(() => import('@/components/syndic-dashboard/agents-ia/pages/MaxAgentPage'))
const LeaAgentPage = d(() => import('@/components/syndic-dashboard/agents-ia/pages/LeaAgentPage'))
// ── Extracted layout + misc components ──
const Sidebar = d(() => import('@/components/syndic-dashboard/layout/Sidebar'))
const Header = d(() => import('@/components/syndic-dashboard/layout/Header'))
const MaxExpertSection = d(() => import('@/components/syndic-dashboard/pages/MaxExpertSection'))
const FixyPanel = d(() => import('@/components/syndic-dashboard/pages/FixyPanel'))
const PDFGenerationModal = d(() => import('@/components/syndic-dashboard/misc/PDFGenerationModal'))

// ─── Web Speech API types (not in standard TS lib — no @types/dom-speech-recognition) ──
interface SpeechRecognitionResultItem {
  transcript: string
  confidence: number
}
interface SpeechRecognitionResult {
  readonly length: number
  isFinal: boolean
  [index: number]: SpeechRecognitionResultItem
}
interface SpeechRecognitionEvent extends Event {
  readonly results: { readonly length: number; [index: number]: SpeechRecognitionResult }
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
}

// ─── Inline interfaces for syndic-specific types ─────────────────────────────

/** Document data extracted from Max AI [DOC_PDF] blocks */
interface DocPDFData {
  title?: string
  type?: string
  objet?: string
  destinataire?: {
    nom?: string
    prenom?: string
    immeuble?: string
    batiment?: string
    etage?: string | number
    porte?: string
    _all?: boolean
    [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  corps?: string[]
  references?: string[]
  formule_politesse?: string
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** An IA action produced by the Fixy assistant */
interface IaAction {
  type: string
  artisan?: string
  artisan_email?: string
  artisan_user_id?: string | null
  immeuble?: string
  lieu?: string
  description?: string
  priorite?: string
  statut?: string
  mission_id?: string
  date_intervention?: string
  type_travaux?: string
  page?: string
  content?: string
  message?: string
  urgence?: string
  contenu?: string
  type_doc?: string
  montant_devis?: number
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** A single message in the Fixy IA chat */
interface IaMessage {
  role: 'user' | 'assistant'
  content: string
  action?: IaAction
  actionStatus?: 'pending' | 'confirmed' | 'cancelled' | 'error'
}

/** A copropriétaire row returned by the API (snake_case) */
interface CoproAPIRow {
  id: string
  immeuble?: string
  batiment?: string
  etage?: number
  numero_porte?: string
  nom_proprietaire?: string
  prenom_proprietaire?: string
  email_proprietaire?: string
  tel_proprietaire?: string
  nom_locataire?: string
  prenom_locataire?: string
  email_locataire?: string
  tel_locataire?: string
  est_occupe?: boolean
  notes?: string
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** A raw artisan row returned by the API (mixed snake_case / camelCase) */
interface ArtisanAPIRow {
  id: string
  nom?: string
  prenom?: string
  nom_famille?: string
  metier: string
  telephone: string
  email: string
  siret: string
  rc_pro_valide?: boolean
  rcProValide?: boolean
  rc_pro_expiration?: string
  rcProExpiration?: string
  assurance_decennale_valide?: boolean
  decennaleValide?: boolean
  assurance_decennale_expiration?: string
  decennaleExpiration?: string
  nb_interventions?: number
  nbInterventions?: number
  vitfix_certifie?: boolean
  vitfixCertifie?: boolean
  note: number
  statut: 'actif' | 'suspendu' | 'en_attente'
  artisan_user_id?: string | null
  compte_existant?: boolean
  cabinet_id?: string
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** A canal-interne message row returned from the API */
interface CanalInterneAPIRow {
  id: string
  texte: string
  auteur?: string
  auteurRole?: string
  createdAt?: string
  lu?: boolean
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** A team member row from the API */
interface TeamMemberRow {
  id: string
  full_name: string
  role: string
  is_active?: boolean
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

// ─── Données démo (empty arrays) ──────────────────────────────────────────────
const ARTISANS_DEMO: Artisan[] = []
const MISSIONS_DEMO: Mission[] = []
const ALERTES_DEMO: Alerte[] = []
const PLANNING_EVENTS_DEMO: PlanningEvent[] = []
const CANAL_INTERNE_DEMO: CanalInterneMsg[] = []
const ECHEANCES_DEMO: EcheanceReglementaire[] = []

// ─── Dashboard Principal ───────────────────────────────────────────────────────

export default function SyndicDashboard() {
  const { t } = useTranslation()
  const locale = useLocale()
  const [page, setPageRaw] = useState<Page>('accueil')
  const [isPageTransitioning, startPageTransition] = useTransition()
  const setPage = (p: Page) => startPageTransition(() => setPageRaw(p))
  // ── Modules personnalisables ──
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({})
  const [moduleOrder, setModuleOrder] = useState<string[]>([])
  const [customAllowedPages, setCustomAllowedPages] = useState<string[] | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  // ── Données persistées en localStorage (clé par user.id, chargées après auth) ──
  const [immeubles, setImmeubles] = useState<Immeuble[]>([])
  const [artisans, setArtisans] = useState<Artisan[]>(ARTISANS_DEMO)
  const [missions, setMissions] = useState<Mission[]>(MISSIONS_DEMO)
  const [alertes, setAlertes] = useState<Alerte[]>(ALERTES_DEMO)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [coproprios, setCoproprios] = useState<Coproprio[]>([])
  const [showModalMission, setShowModalMission] = useState(false)
  // ── Bâtiments connus (champ libre avec suggestions) ──────────────────────────
  const [batimentsConnus, setBatimentsConnus] = useState<string[]>([])
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null)
  const [showMissionDetails, setShowMissionDetails] = useState(false)
  // ── Planning navigation ─────────────────────────────────────────────────────
  const [planningEvents, setPlanningEvents] = useState<PlanningEvent[]>(PLANNING_EVENTS_DEMO)
  const [showPlanningModal, setShowPlanningModal] = useState(false)
  const [selectedPlanningDay, setSelectedPlanningDay] = useState<string | null>(null)
  const [planningNeedsMigration, setPlanningNeedsMigration] = useState(false)
  // ── Membres de l'équipe (chargés depuis Supabase) ────────────────────────────
  const [teamMembers, setTeamMembers] = useState<{ id: string; full_name: string; role: string }[]>([])
  const [planningEventForm, setPlanningEventForm] = useState({
    titre: '',
    type: 'visite' as PlanningEvent['type'],
    heure: '09:00',
    dureeMin: 60,
    assigneA: '',
    description: '',
  })
  // ── Canal Interne ────────────────────────────────────────────────────────────
  const [canalInterneMessages, setCanalInterneMessages] = useState<CanalInterneMsg[]>(CANAL_INTERNE_DEMO)
  const [canalInterneInput, setCanalInterneInput] = useState('')
  const [canalInterneType, setCanalInterneType] = useState<'message' | 'tache' | 'planning'>('message')
  const [canalPlanDate, setCanalPlanDate] = useState(new Date().toISOString().slice(0, 10))
  const [canalPlanHeure, setCanalPlanHeure] = useState('09:00')
  const [canalPlanResident, setCanalPlanResident] = useState('')
  const [canalPlanResidence, setCanalPlanResidence] = useState('')
  const [canalTacheAssignee, setCanalTacheAssignee] = useState('')
  const [canalTachePriorite, setCanalTachePriorite] = useState<'normale' | 'urgente'>('normale')
  // ── Paramètres ──────────────────────────────────────────────────────────────
  const [cabinetNom, setCabinetNom] = useState('')
  const [cabinetEmail, setCabinetEmail] = useState('')
  const [cabinetAddress, setCabinetAddress] = useState('')
  const [cabinetLogo, setCabinetLogo] = useState<string | null>(null)
  const [syndicSignature, setSyndicSignature] = useState<SignatureData | null>(null)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  // ── PDF Modal ──────────────────────────────────────────────────────────────
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [pendingDocData, setPendingDocData] = useState<DocPDFData | null>(null)
  const [pdfSelectedImmeuble, setPdfSelectedImmeuble] = useState('')
  const [pdfSelectedCopro, setPdfSelectedCopro] = useState<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [pdfObjet, setPdfObjet] = useState('')
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const fixyInitialMsg = locale === 'pt'
    ? 'Olá! Sou o **Fixy** 🤖, o seu assistente de ação Vitfix Pro.\n\nTenho acesso a **todos os seus dados em tempo real** e posso **agir diretamente**: criar missões, navegar, gerar comunicações, alertas...\n\n🎙️ Carregue no microfone para os comandos por voz!\n\nO que posso fazer por si?'
    : 'Bonjour ! Je suis **Fixy** 🤖, votre assistant d\'action Vitfix Pro.\n\nJ\'ai accès à **toutes vos données en temps réel** et je peux **agir directement** : créer missions, naviguer, générer courriers, alertes...\n\n🎙️ Cliquez sur le micro pour les commandes vocales !\n\nQue puis-je faire pour vous ?'
  const [iaMessages, setIaMessages] = useState<IaMessage[]>([
    { role: 'assistant', content: fixyInitialMsg }
  ])
  const [iaInput, setIaInput] = useState('')
  const [iaLoading, setIaLoading] = useState(false)
  const [iaPendingAction, setIaPendingAction] = useState<{ action: IaAction; iaToken: string } | null>(null)
  const iaEndRef = useRef<HTMLDivElement>(null)
  // ── Voice & Speech ─────────────────────────────────────────────────────────
  const [iaVoiceActive, setIaVoiceActive] = useState(false)
  const [iaVoiceSupported, setIaVoiceSupported] = useState(false)
  const [iaSpeechEnabled, setIaSpeechEnabled] = useState(false)
  const [iaSpeaking, setIaSpeaking] = useState(false)
  const iaRecognitionRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const iaSendTimerRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  // ── Voice V2 — états enrichis ──────────────────────────────────────────────
  const [iaVoiceDuration, setIaVoiceDuration] = useState(0)
  const [iaVoiceInterim, setIaVoiceInterim] = useState('')
  const [iaVoiceHelp, setIaVoiceHelp] = useState(false)
  const [iaVoiceSendTrigger, setIaVoiceSendTrigger] = useState<string | null>(null)
  const [iaVoiceConfidence, setIaVoiceConfidence] = useState(0)
  const [iaAvailableVoices, setIaAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const iaVoiceDurationRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const iaTranscriptRef = useRef('')

  // ── Max — Expert-Conseil (lecture seule) ───────────────────────────────────
  const maxInitialMsg = locale === 'pt'
    ? 'Olá! Sou o **Max** 🎓, o vosso consultor especialista IA.\n\nEspecializado em **direito do condomínio** português, regulamentação técnica, gestão de artesãos e contabilidade.\n\nPara **executar uma ação** (criar missão, navegar...), utilizem o **Fixy** 🤖 (bolha amarela no canto inferior direito).\n\nQue questão posso esclarecer?'
    : 'Bonjour ! Je suis **Max** 🎓, votre expert-conseil IA.\n\nSpécialisé en **droit de la copropriété**, réglementation technique, gestion d\'artisans et comptabilité syndic.\n\nPour **exécuter une action** (créer mission, naviguer...), utilisez **Fixy** 🤖 (bulle jaune en bas à droite).\n\nQuelle question puis-je éclaircir ?'
  const [maxMessages, setMaxMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: maxInitialMsg }
  ])
  const [maxInput, setMaxInput] = useState('')
  const [maxLoading, setMaxLoading] = useState(false)
  const maxEndRef = useRef<HTMLDivElement>(null)
  const [adminLoading, setAdminLoading] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [planningAddLoading, setPlanningAddLoading] = useState(false)
  const [maxTab, setMaxTab] = useState<'chat' | 'conformite' | 'documents'>('chat')
  const [maxFavorites, setMaxFavorites] = useState<string[]>([])
  const [maxSelectedImmeuble, setMaxSelectedImmeuble] = useState<string>('all')
  const [fixyPanelOpen, setFixyPanelOpen] = useState(false)
  // ── Token admin isolé par onglet (résout le conflit de session multi-comptes) ──
  const adminSessionRef = useRef<{ access_token: string; refresh_token: string; expires_at: number } | null>(null)

  useEffect(() => {
    // Vérifier support Web Speech API
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supported = !!(
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
      )
      setIaVoiceSupported(supported)

      // Charger préférence TTS
      try {
        const savedPref = localStorage.getItem(`fixit_tts_enabled_${user?.id}`)
        if (savedPref === 'true') setIaSpeechEnabled(true)
      } catch {}

      // Charger voix disponibles
      if (window.speechSynthesis) {
        const loadVoices = () => {
          const voices = window.speechSynthesis.getVoices()
          if (voices.length) setIaAvailableVoices(voices)
        }
        loadVoices()
        window.speechSynthesis.onvoiceschanged = loadVoices
      }
    }
  }, [user?.id])

  // ── Notifications in-app ──────────────────────────────────────────────────
  const [notifPanelOpen, setNotifPanelOpen] = useState(false)
  const [notifs, setNotifs] = useState<{ id: string; title: string; body: string; type: string; read: boolean; created_at: string }[]>([])
  const notifUnread = notifs.filter(n => !n.read).length
  const notifBtnRef = useRef<HTMLDivElement>(null)

  // Close notification panel on click outside
  useEffect(() => {
    if (!notifPanelOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (notifBtnRef.current && !notifBtnRef.current.contains(e.target as Node)) setNotifPanelOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifPanelOpen])

  // ── Load persisted Max conversations & favorites ──
  useEffect(() => {
    if (!user?.id) return
    try {
      const saved = localStorage.getItem(`fixit_max_history_${user.id}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) setMaxMessages(parsed)
      }
    } catch {}
    try {
      const favs = localStorage.getItem(`fixit_max_favorites_${user.id}`)
      if (favs) setMaxFavorites(JSON.parse(favs))
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    // Charger les notifs existantes
    const loadNotifs = async (): Promise<boolean> => {
      try {
        const res = await fetch(`/api/syndic/notify-artisan?syndic_id=${user.id}&limit=20`)
        if (res.ok) {
          const data = await res.json()
          if (data.notifications) setNotifs(data.notifications)
          return true
        }
        return false
      } catch { return false }
    }
    // Supabase Realtime — subscribe only if initial fetch succeeds (table exists + RLS OK)
    let channel: ReturnType<typeof supabase.channel> | null = null
    loadNotifs().then((ok) => {
      if (!ok) return // table doesn't exist or RLS blocked — skip Realtime
      channel = supabase
        .channel(`syndic_notifs_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'syndic_notifications',
          filter: `syndic_id=eq.${user.id}`,
        }, (payload) => {
          const n = payload.new as any // eslint-disable-line @typescript-eslint/no-explicit-any
          setNotifs(prev => [{ id: n.id, title: n.title, body: n.body, type: n.type, read: false, created_at: n.created_at }, ...prev])
        })

      subscribeWithReconnect(channel, (status, err) => {
        if (process.env.NODE_ENV !== 'production') console.warn(`[syndic/dashboard] Realtime ${status}:`, err)
      })
    })

    return () => { if (channel) supabase.removeChannel(channel) }
  }, [user?.id])

  // ── Persistance canal interne ──
  useEffect(() => {
    if (!user?.id) return
    try {
      localStorage.setItem(`fixit_canal_interne_${user.id}`, JSON.stringify(canalInterneMessages))
    } catch {}
  }, [canalInterneMessages, user?.id])

  // ── Persistance planning events ──
  useEffect(() => {
    if (!user?.id) return
    try {
      localStorage.setItem(`fixit_planning_events_${user.id}`, JSON.stringify(planningEvents))
    } catch {}
  }, [planningEvents, user?.id])

  const markAllNotifsRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    if (!user?.id) return
    try {
      await fetch(`/api/syndic/notify-artisan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syndic_id: user.id, mark_all_read: true }),
      })
    } catch { /* silencieux */ }
  }

  // ── Obtenir le token admin en contournant le cookie partagé ──────────────────
  // Si un autre compte (ex: artisan) se connecte dans le même navigateur,
  // cette fonction garde le token de l'admin syndic stocké dans adminSessionRef.
  const getAdminToken = async (): Promise<string> => {
    const stored = adminSessionRef.current
    if (stored) {
      const now = Math.floor(Date.now() / 1000)
      if (stored.expires_at - now > 60) return stored.access_token
      // Token expiré : rafraîchir en utilisant le refresh_token stocké (bypass du cookie)
      try {
        const refreshRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
            body: JSON.stringify({ refresh_token: stored.refresh_token }),
          }
        )
        if (refreshRes.ok) {
          const d = await refreshRes.json()
          adminSessionRef.current = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || 0 }
          return d.access_token
        }
      } catch { /* silencieux */ }
    }
    // Fallback au cookie actuel
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  useEffect(() => {
    const getUser = async () => {
      // Forcer le rafraîchissement du token pour obtenir les user_metadata à jour
      await supabase.auth.refreshSession()
      // getUser() fait un appel réseau frais (contrairement à getSession() qui lit les cookies)
      const { data: { user: freshUser } } = await supabase.auth.getUser()
      const userRole = freshUser?.app_metadata?.role || ''
      const isAdminOverride = freshUser?.app_metadata?._admin_override === true
      const isSyndic = userRole === 'syndic' || userRole.startsWith('syndic_') || isAdminOverride
      if (!freshUser || !isSyndic) {
        window.location.href = '/syndic/login'
        return
      }
      setUser(freshUser)
      setCabinetNom(freshUser?.user_metadata?.company_name || freshUser?.user_metadata?.full_name || '')
      setCabinetEmail(freshUser?.email || '')
      // Load cabinet logo, address, signature from localStorage
      try {
        const savedAddr = localStorage.getItem(`fixit_syndic_address_${freshUser.id}`)
        if (savedAddr) setCabinetAddress(savedAddr)
        const savedLogo = localStorage.getItem(`fixit_syndic_logo_${freshUser.id}`)
        if (savedLogo) setCabinetLogo(savedLogo)
        const savedSig = localStorage.getItem(`fixit_syndic_signature_${freshUser.id}`)
        if (savedSig) setSyndicSignature(JSON.parse(savedSig))
      } catch {}
      // ── Sauvegarder la session admin dans un ref isolé par onglet ──
      // Permet de garder le bon token même si un autre compte se connecte dans le même navigateur
      const { data: { session: adminSess } } = await supabase.auth.getSession()
      if (adminSess) {
        adminSessionRef.current = {
          access_token: adminSess.access_token,
          refresh_token: adminSess.refresh_token,
          expires_at: adminSess.expires_at || 0,
        }
      }

      // ── Charger données : localStorage d'abord (rapide), puis Supabase (sync) ──
      const uid = freshUser.id

      // ── Noms des faux immeubles de démo — utilisés pour filtrer partout ──────
      const FAKE_BUILDING_NAMES = ['Résidence Les Acacias', 'Le Clos Vendôme', 'Tour Horizon']

      // ── Purge one-shot v6 : efface TOUT l'ancien localStorage syndic ─────────
      // Flag UID-spécifique → chaque utilisateur est purgé une seule fois indépendamment
      // v6 : force re-purge pour éliminer toutes les fausses données persistantes
      if (!localStorage.getItem(`fixit_clean_v6_${uid}`)) {
        const keysToNuke = [
          `fixit_syndic_missions_${uid}`,
          `fixit_syndic_immeubles_${uid}`,
          `fixit_syndic_batiments_${uid}`,
          `fixit_canal_interne_${uid}`,
          `fixit_planning_events_${uid}`,
          `fixit_copros_${uid}`,
          `fixit_ged_${uid}`,
          `fixit_cal_regl_${uid}`,
          // Anciens flags
          `fixit_clean_v5_${uid}`,
          'fixit_clean_v4',
          'fixit_clean_v3',
        ]
        keysToNuke.forEach(k => localStorage.removeItem(k))
        // Purger toutes les clés liées à cet uid (balayage complet)
        Object.keys(localStorage)
          .filter(k =>
            k.startsWith('canal_missions_') ||
            k.startsWith('fixit_copros_local') ||
            k.startsWith('syndic_transferts_') ||
            (k.includes(uid) && (
              k.startsWith('fixit_') ||
              k.startsWith('vitfix_') ||
              k.startsWith('canal_')
            ))
          )
          .forEach(k => localStorage.removeItem(k))
        localStorage.setItem(`fixit_clean_v6_${uid}`, '1')
      }

      try {
        const savedMissions = localStorage.getItem(`fixit_syndic_missions_${uid}`)
        if (savedMissions) {
          try {
            const parsed = JSON.parse(savedMissions)
            // Filtre les missions référençant des faux immeubles OU IDs courts
            const FAKE_IDS = ['1','2','3','4','5']
            const real = parsed.filter((m: Mission) =>
              !FAKE_IDS.includes(String(m.id)) &&
              !FAKE_BUILDING_NAMES.includes(m.immeuble)
            )
            if (real.length < parsed.length) {
              localStorage.setItem(`fixit_syndic_missions_${uid}`, JSON.stringify(real))
            }
            setMissions(real)
          } catch { localStorage.removeItem(`fixit_syndic_missions_${uid}`) }
        }

        const savedImmeubles = localStorage.getItem(`fixit_syndic_immeubles_${uid}`)
        if (savedImmeubles) {
          try {
            const parsed = JSON.parse(savedImmeubles)
            const real = parsed.filter((i: Immeuble) =>
              !['1','2','3'].includes(String(i.id)) &&
              !FAKE_BUILDING_NAMES.includes(i.nom)
            )
            if (real.length < parsed.length) {
              localStorage.setItem(`fixit_syndic_immeubles_${uid}`, JSON.stringify(real))
            }
            setImmeubles(real)
          } catch { localStorage.removeItem(`fixit_syndic_immeubles_${uid}`) }
        }

        const savedBatiments = localStorage.getItem(`fixit_syndic_batiments_${uid}`)
        if (savedBatiments) {
          try {
            const parsed = JSON.parse(savedBatiments)
            const real = parsed.filter((n: string) => !FAKE_BUILDING_NAMES.includes(n))
            if (real.length < parsed.length) {
              localStorage.setItem(`fixit_syndic_batiments_${uid}`, JSON.stringify(real))
            }
            setBatimentsConnus(real)
          } catch { setBatimentsConnus([]) }
        }

        const savedCanalInterne = localStorage.getItem(`fixit_canal_interne_${uid}`)
        if (savedCanalInterne) {
          try {
            const parsed = JSON.parse(savedCanalInterne)
            // Purge si contient des IDs de démo ou des références à de faux immeubles
            const hasFake = parsed.some((m: Record<string, unknown>) =>
              /^(ci|pe)-\d+$/.test(String(m.id)) ||
              ['ci-1','ci-2','ci-3'].includes(String(m.id)) ||
              FAKE_BUILDING_NAMES.some(n => String(m.texte || '').includes(n) || String(m.sujet || '').includes(n))
            )
            if (hasFake) {
              localStorage.removeItem(`fixit_canal_interne_${uid}`)
            } else {
              setCanalInterneMessages(parsed)
            }
          } catch { localStorage.removeItem(`fixit_canal_interne_${uid}`) }
        }

        const savedPlanningEvents = localStorage.getItem(`fixit_planning_events_${uid}`)
        if (savedPlanningEvents) {
          try {
            const parsed = JSON.parse(savedPlanningEvents)
            // Filtrer les events assignés à de faux membres (IDs courts)
            const FAKE_PERSON_NAMES = ['Jean-Pierre Martin','Marie Dupont','Sophie Leroy','Bernard Petit','Directeur Général']
            const real = parsed.filter((e: PlanningEvent) => !FAKE_PERSON_NAMES.includes(e.assigneA))
            setPlanningEvents(real)
            if (real.length < parsed.length) {
              localStorage.setItem(`fixit_planning_events_${uid}`, JSON.stringify(real))
            }
          } catch { localStorage.removeItem(`fixit_planning_events_${uid}`) }
        }

        // Load enabled modules
        const savedModules = localStorage.getItem(`fixit_modules_syndic_${uid}`)
        if (savedModules) setEnabledModules(JSON.parse(savedModules))
        // Load module order
        const savedOrder = localStorage.getItem(`fixit_modules_order_syndic_${uid}`)
        if (savedOrder) setModuleOrder(JSON.parse(savedOrder))
      } catch { /* silencieux */ }
      setDataLoaded(true)

      // ── Charger les copropriétaires depuis Supabase ────────────────────────
      try {
        const _coprosToken = await getAdminToken()
        if (_coprosToken) {
          const coprosRes = await fetch('/api/syndic/coproprios', {
            headers: { Authorization: `Bearer ${_coprosToken}` },
          })
          if (coprosRes.ok) {
            const coprosData = await coprosRes.json()
            const mapped = (coprosData.coproprios || []).map((row: CoproAPIRow) => ({
              id: row.id,
              immeuble: row.immeuble || '',
              batiment: row.batiment || '',
              etage: row.etage ?? 0,
              numeroPorte: row.numero_porte || '',
              nomProprietaire: row.nom_proprietaire || '',
              prenomProprietaire: row.prenom_proprietaire || '',
              emailProprietaire: row.email_proprietaire || '',
              telephoneProprietaire: row.tel_proprietaire || '',
              nomLocataire: row.nom_locataire || undefined,
              prenomLocataire: row.prenom_locataire || undefined,
              emailLocataire: row.email_locataire || undefined,
              telephoneLocataire: row.tel_locataire || undefined,
              estOccupe: row.est_occupe ?? false,
              notes: row.notes || undefined,
            }))
            setCoproprios(mapped)
          }
        }
      } catch (e) {
        console.warn('[dashboard] coproprios load failed:', e)
        toast.error('Impossible de charger les copropriétaires')
      }

      // ── Charger les modules personnalisés si c'est un membre d'équipe ──────
      const cabinetId = freshUser.user_metadata?.cabinet_id
      if (cabinetId) {
        try {
          const { supabase } = await import('@/lib/supabase')
          const { data: memberData } = await supabase
            .from('syndic_team_members')
            .select('custom_modules')
            .eq('user_id', uid)
            .maybeSingle()
          if (memberData?.custom_modules && Array.isArray(memberData.custom_modules)) {
            setCustomAllowedPages(memberData.custom_modules)
          }
        } catch { /* silencieux — fallback aux défauts du rôle */ }
      }

      // ── Sync Supabase en arrière-plan ──────────────────────────────────────
      try {
        const token = await getAdminToken()
        if (!token) return

        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

        // ── ARTISANS : chargement PRIORITAIRE et INDÉPENDANT ──────────────────
        // Critique pour Fixy : doit être chargé AVANT toute interaction IA
        // Séparé des autres fetches pour ne pas être bloqué par leurs erreurs
        try {
          const artResEarly = await fetch('/api/syndic/artisans', { headers })
          if (artResEarly.ok) {
            const artDataEarly = await artResEarly.json()
            if (artDataEarly.artisans && artDataEarly.artisans.length > 0) {
              const mappedEarly: Artisan[] = artDataEarly.artisans.map((a: ArtisanAPIRow) => ({
                ...a,
                nom: a.nom || `${a.prenom || ''} ${a.nom_famille || ''}`.trim(),
                rcProValide: a.rc_pro_valide ?? a.rcProValide ?? false,
                rcProExpiration: a.rc_pro_expiration ?? a.rcProExpiration ?? '',
                decennaleValide: a.assurance_decennale_valide ?? a.decennaleValide ?? false,
                decennaleExpiration: a.assurance_decennale_expiration ?? a.decennaleExpiration ?? '',
                nbInterventions: a.nb_interventions ?? a.nbInterventions ?? 0,
                vitfixCertifie: a.vitfix_certifie ?? a.vitfixCertifie ?? false,
              }))
              setArtisans(mappedEarly)
              console.info(`[DASHBOARD] ✅ Artisans chargés au mount : ${mappedEarly.length} artisans`, mappedEarly.map(a => `${a.nom} <${a.email}>`))
            } else {
              if (process.env.NODE_ENV !== 'production') console.warn(`[DASHBOARD] API artisans OK mais liste vide`)
            }
          } else {
            if (process.env.NODE_ENV !== 'production') console.error(`[DASHBOARD] API artisans erreur HTTP ${artResEarly.status}`)
          }
        } catch (artErr) {
          if (process.env.NODE_ENV !== 'production') console.error(`[DASHBOARD] Fetch artisans échoué :`, artErr)
        }

        // Charger missions, immeubles, planning, canal interne, équipe depuis Supabase
        const [mRes, iRes, peRes, ciRes, teamRes] = await Promise.all([
          fetch('/api/syndic/missions', { headers }),
          fetch('/api/syndic/immeubles', { headers }),
          fetch('/api/syndic/planning-events', { headers }),
          fetch('/api/syndic/canal-interne', { headers }),
          fetch('/api/syndic/team', { headers }),
        ])

        if (mRes.ok) {
          const { missions: dbMissions } = await mRes.json()
          if (dbMissions) {
            // Séparer vraies missions des fausses missions de démo
            const FAKE_BUILDING_NAMES_DB = ['Résidence Les Acacias', 'Le Clos Vendôme', 'Tour Horizon']
            const fakeMissions = dbMissions.filter((m: Mission) => FAKE_BUILDING_NAMES_DB.includes(m.immeuble))
            const realMissions = dbMissions.filter((m: Mission) => !FAKE_BUILDING_NAMES_DB.includes(m.immeuble))
            // AUTO-CLEANUP DB : supprimer définitivement les fausses missions de Supabase
            if (fakeMissions.length > 0) {
              for (const fm of fakeMissions) {
                try {
                  await fetch(`/api/syndic/missions?id=${encodeURIComponent(fm.id)}`, { method: 'DELETE', headers })
                } catch {}
              }
            }
            setMissions(realMissions)
            try { localStorage.setItem(`fixit_syndic_missions_${uid}`, JSON.stringify(realMissions)) } catch {}
          }
        }

        if (iRes.ok) {
          const { immeubles: dbImmeubles } = await iRes.json()
          if (dbImmeubles) {
            // Séparer vrais immeubles des faux immeubles de démo
            const FAKE_BUILDING_NAMES = ['Résidence Les Acacias', 'Le Clos Vendôme', 'Tour Horizon']
            const fakeImmeubles = dbImmeubles.filter((i: Immeuble) => FAKE_BUILDING_NAMES.includes(i.nom))
            const realImmeubles = dbImmeubles.filter((i: Immeuble) => !FAKE_BUILDING_NAMES.includes(i.nom))
            // AUTO-CLEANUP DB : supprimer définitivement les faux immeubles de Supabase
            if (fakeImmeubles.length > 0) {
              for (const fi of fakeImmeubles) {
                try {
                  await fetch(`/api/syndic/immeubles?id=${encodeURIComponent(fi.id)}`, { method: 'DELETE', headers })
                } catch {}
              }
            }
            if (realImmeubles.length > 0) {
              setImmeubles(realImmeubles)
              // Mettre à jour les bâtiments connus depuis Supabase (sans faux noms)
              const noms = realImmeubles.map((i: Immeuble) => i.nom).filter(Boolean)
              if (noms.length > 0) {
                setBatimentsConnus((prev: string[]) => {
                  const merged = Array.from(new Set([...prev, ...noms])).sort()
                  try { localStorage.setItem(`fixit_syndic_batiments_${uid}`, JSON.stringify(merged)) } catch {}
                  return merged
                })
              }
              try { localStorage.setItem(`fixit_syndic_immeubles_${uid}`, JSON.stringify(realImmeubles)) } catch {}
            }
          }
        }
        // Charger planning events depuis Supabase (partagés entre tous les membres)
        if (peRes.ok) {
          const { events: dbEvents, needsMigration } = await peRes.json()
          if (needsMigration) {
            setPlanningNeedsMigration(true)
          } else if (dbEvents) {
            setPlanningEvents(dbEvents)
            try { localStorage.setItem(`fixit_planning_events_${uid}`, JSON.stringify(dbEvents)) } catch {}
          }
        }

        // Charger canal interne depuis Supabase (partagé entre tous les membres)
        if (ciRes.ok) {
          const { messages: dbMsgs } = await ciRes.json()
          if (dbMsgs && dbMsgs.length > 0) {
            const converted: CanalInterneMsg[] = dbMsgs.map((m: CanalInterneAPIRow) => {
              // Le contenu est un JSON sérialisé du CanalInterneMsg complet
              try {
                const parsed = JSON.parse(m.texte)
                if (parsed && parsed.contenu) return { ...parsed, id: m.id, lu: m.lu ?? true }
              } catch {}
              return { id: m.id, de: m.auteur, deRole: m.auteurRole || '', type: 'message' as const, contenu: m.texte, date: m.createdAt, lu: m.lu ?? true }
            })
            setCanalInterneMessages(converted)
          }
        }

        // Charger membres de l'équipe depuis Supabase
        if (teamRes.ok) {
          const { members } = await teamRes.json()
          if (members) setTeamMembers(members.filter((m: TeamMemberRow) => m.is_active !== false))
        }

        // Artisans déjà chargés en priorité plus haut (avant le Promise.all)

      } catch { /* silencieux — Supabase optionnel */ }
    }
    getUser()
  }, [])

  // ── Polling toutes les 15s — sync planning + canal interne entre membres équipe ─
  useEffect(() => {
    if (!dataLoaded || !user?.id) return
    const poll = async () => {
      try {
        const token = await getAdminToken()
        if (!token) return
        const h = { 'Authorization': `Bearer ${token}` }

        const [peRes, ciRes] = await Promise.all([
          fetch('/api/syndic/planning-events', { headers: h }),
          fetch('/api/syndic/canal-interne', { headers: h }),
        ])

        if (peRes.ok) {
          const { events } = await peRes.json()
          if (events) setPlanningEvents(events)
        }
        if (ciRes.ok) {
          const { messages: dbMsgs } = await ciRes.json()
          if (dbMsgs && dbMsgs.length > 0) {
            const converted: CanalInterneMsg[] = dbMsgs.map((m: CanalInterneAPIRow) => {
              try {
                const p = JSON.parse(m.texte)
                if (p?.contenu) return { ...p, id: m.id, lu: m.lu ?? true }
              } catch {}
              return { id: m.id, de: m.auteur, deRole: m.auteurRole || '', type: 'message' as const, contenu: m.texte, date: m.createdAt, lu: m.lu ?? true }
            })
            setCanalInterneMessages(converted)
          }
        }
      } catch { /* silencieux */ }
    }
    const interval = setInterval(poll, POLL_MISSIONS)
    return () => clearInterval(interval)
  }, [dataLoaded, user?.id])

  // ── Sauvegarder missions dans localStorage à chaque changement ───────────────
  useEffect(() => {
    if (!dataLoaded || !user?.id) return
    try { localStorage.setItem(`fixit_syndic_missions_${user.id}`, JSON.stringify(missions)) } catch {}
  }, [missions, dataLoaded, user?.id])

  // ── Migration automatique : envoyer les missions sans bookingId vers Supabase ──
  // S'exécute une seule fois au chargement du dashboard, en arrière-plan
  useEffect(() => {
    if (!dataLoaded || !user?.id || missions.length === 0) return
    const migrationKey = `fixit_missions_migrated_v1_${user.id}`
    if (localStorage.getItem(migrationKey)) return // déjà migré
    const migrateUnsynced = async () => {
      try {
        const token = await getAdminToken()
        if (!token) return
        const unsynced = missions.filter(m =>
          m.artisan && m.artisan.trim() !== '' && m.statut === 'en_attente'
        )
        if (unsynced.length === 0) { localStorage.setItem(migrationKey, '1'); return }
        let ok = 0
        for (const m of unsynced) {
          try {
            const res = await fetch('/api/syndic/assign-mission', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                artisan_name: m.artisan,
                artisan_email: artisans.find(a => a.nom === m.artisan)?.email || '',
                description: m.description || m.type || 'Mission',
                type_travaux: m.type || 'Intervention',
                date_intervention: m.dateIntervention || undefined,
                immeuble: m.immeuble || '',
                priorite: m.priorite || 'normale',
                notes: `Migration depuis historique syndic — ID ${m.id}`,
              }),
            })
            const data = await res.json()
            if (data.success && data.artisan_found) ok++
          } catch { /* silencieux */ }
        }
        if (ok > 0) console.info(`[SyndicDash] Migration : ${ok}/${unsynced.length} missions envoyées à Supabase`)
        localStorage.setItem(migrationKey, '1')
      } catch { /* silencieux */ }
    }
    // Délai de 3s pour ne pas bloquer le chargement initial
    const t = setTimeout(migrateUnsynced, TOAST_DEFAULT)
    return () => clearTimeout(t)
  }, [dataLoaded, user?.id])

  // ── Sauvegarder immeubles dans localStorage à chaque changement ──────────────
  useEffect(() => {
    if (!dataLoaded || !user?.id) return
    try { localStorage.setItem(`fixit_syndic_immeubles_${user.id}`, JSON.stringify(immeubles)) } catch {}
  }, [immeubles, dataLoaded, user?.id])

  // ── Sauvegarder bâtiments connus dans localStorage ───────────────────────────
  useEffect(() => {
    if (!user?.id || batimentsConnus.length === 0) return
    try { localStorage.setItem(`fixit_syndic_batiments_${user.id}`, JSON.stringify(batimentsConnus)) } catch {}
  }, [batimentsConnus, user?.id])

  // ── Helper : mémoriser un bâtiment saisi ────────────────────────────────────
  const enregistrerBatiment = (nom: string) => {
    const n = nom.trim()
    if (!n) return
    setBatimentsConnus(prev => prev.includes(n) ? prev : [...prev, n].sort())
  }


  useEffect(() => {
    iaEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [iaMessages])

  const handleLogout = async () => {
    setMaxMessages([])
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const sendCanalInterne = async () => {
    const contenuOk = canalInterneInput.trim() ||
      (canalInterneType === 'planning' && canalPlanResident.trim())
    if (!contenuOk) return

    const autoContenu = canalInterneType === 'planning' && !canalInterneInput.trim()
      ? `Visite ${canalPlanResident} à ${canalPlanHeure} — ${canalPlanResidence}`
      : canalInterneInput.trim()

    const msg: CanalInterneMsg = {
      id: Date.now().toString(),
      de: userName,
      deRole: getRoleLabel(userRole, locale),
      type: canalInterneType,
      contenu: autoContenu,
      date: new Date().toISOString(),
      lu: true,
      ...(canalInterneType === 'planning' ? {
        planningDate: canalPlanDate,
        planningHeure: canalPlanHeure,
        planningResident: canalPlanResident,
        planningResidence: canalPlanResidence,
        planningMissionCreee: false,
      } : {}),
      ...(canalInterneType === 'tache' ? {
        tacheAssignee: canalTacheAssignee,
        tachePriorite: canalTachePriorite,
        tacheStatut: 'en_attente' as const,
      } : {}),
    }

    // Planning canal interne → ajout direct dans le calendrier (PAS dans les missions artisans)
    if (canalInterneType === 'planning' && canalPlanDate && canalPlanResident.trim()) {
      const newEvent: PlanningEvent = {
        id: `ce-${Date.now()}`,
        titre: `Visite — ${canalPlanResident}`,
        type: 'rdv',
        date: canalPlanDate,
        heure: canalPlanHeure || '09:00',
        dureeMin: 60,
        assigneA: userName,
        assigneRole: userRole,
        description: canalInterneInput.trim() || `Visite ${canalPlanResident}, ${canalPlanResidence}`,
        creePar: userName,
        statut: 'planifie',
      }
      setPlanningEvents(prev => [...prev, newEvent])
      msg.planningMissionCreee = true // champ réutilisé comme flag "ajouté au planning"
    }

    setCanalInterneMessages(prev => [...prev, msg])
    setCanalInterneInput('')
    if (canalInterneType === 'planning') {
      setCanalPlanResident('')
      setCanalPlanResidence('')
    }
    if (canalInterneType === 'tache') setCanalTacheAssignee('')

    // Sauvegarder en DB pour partage entre membres équipe
    try {
      const token = await getAdminToken()
      if (token) {
        await fetch('/api/syndic/canal-interne', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auteur: msg.de,
            auteurRole: msg.deRole,
            // Stocker le JSON complet du message pour préserver les champs spéciaux
            texte: JSON.stringify(msg),
            sujet: '',
          }),
        })
      }
    } catch { /* silencieux — l'optimistic update est déjà en place */ }
  }

  const addPlanningEvent = async () => {
    if (!planningEventForm.titre.trim() || !selectedPlanningDay) return
    setPlanningAddLoading(true)
    const assignedMember = teamMembers.find(m => m.full_name === planningEventForm.assigneA)
    const newEvent: PlanningEvent = {
      id: `tmp-${Date.now()}`,
      titre: planningEventForm.titre.trim(),
      date: selectedPlanningDay,
      heure: planningEventForm.heure,
      dureeMin: planningEventForm.dureeMin,
      type: planningEventForm.type,
      assigneA: planningEventForm.assigneA || userName,
      assigneRole: planningEventForm.assigneA
        ? (assignedMember ? getRoleLabel(assignedMember.role, locale) : '')
        : getRoleLabel(userRole, locale),
      description: planningEventForm.description,
      creePar: userName,
      statut: 'planifie',
    }
    // Optimistic update local
    setPlanningEvents(prev => [...prev, newEvent])
    setShowPlanningModal(false)
    setPlanningEventForm({ titre: '', type: 'visite', heure: '09:00', dureeMin: 60, assigneA: '', description: '' })

    // Sauvegarder en DB pour partage entre membres équipe
    try {
      const token = await getAdminToken()
      if (token) {
        const res = await fetch('/api/syndic/planning-events', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(newEvent),
        })
        if (res.ok) {
          const { event } = await res.json()
          // Remplacer l'ID temporaire par l'UUID Supabase
          if (event?.id) {
            setPlanningEvents(prev => prev.map(e => e.id === newEvent.id ? { ...e, id: event.id } : e))
          }
        } else if ((await res.json().catch(() => ({}))).error === 'needsMigration') {
          setPlanningNeedsMigration(true)
        }
      }
    } catch { /* silencieux — optimistic update déjà en place */ }
    finally { setPlanningAddLoading(false) }
  }

  // ── Gestion Missions ─────────────────────────────────────────────────────────
  const handleValiderMission = (id: string) => {
    setMissions(prev => prev.map(m => m.id === id ? { ...m, statut: 'acceptee' as const } : m))
  }



  // ── Gestion Alertes ──────────────────────────────────────────────────────────
  const handleTraiterAlerte = (id: string) => {
    setAlertes(prev => prev.filter(a => a.id !== id))
  }


  // ── Paramètres ───────────────────────────────────────────────────────────────

  // ── Parse [DOC_PDF] blocks from Max responses ──────────────────────────────
  const parseDocPDF = (content: string) => {
    const result = parseDocPDFUtil(content)
    return { text: result.text, docData: result.docData as DocPDFData | null }
  }

  // ── Generate professional PDF from Max document data ──────────────────────
  // ── PDF generation — extracted to lib/syndic-pdf.ts ──
  const generateMaxPDF = async (docData: DocPDFData) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- local DocPDFData compatible with lib type
    await generateMaxPDFUtil(docData as any, {
      locale,
      cabinetLogo,
      cabinetNom,
      cabinetAddress,
      cabinetEmail,
      userName,
      userRole,
      syndicSignature,
    })
  }

  // ── Contexte complet cabinet ─────────────────────────────────────────────────
  const buildSyndicContext = () => ({
    cabinet: { nom: companyName, gestionnaire: userName },
    immeubles: immeubles.map(i => ({
      nom: i.nom, ville: i.ville, nbLots: i.nbLots,
      budgetAnnuel: i.budgetAnnuel, depensesAnnee: i.depensesAnnee,
      pctBudget: i.budgetAnnuel > 0 ? Math.round(i.depensesAnnee / i.budgetAnnuel * 100) : 0,
    })),
    artisans: artisans.map(a => ({
      nom: a.nom, metier: a.metier, statut: a.statut,
      email: a.email, // IMPORTANT : pour l'attribution vocale de missions
      telephone: a.telephone,
      rcProValide: a.rc_pro_valide ?? a.rcProValide,
      rcProExpiration: a.rc_pro_expiration ?? a.rcProExpiration,
      decennaleValide: a.assurance_decennale_valide ?? a.decennaleValide ?? false,
      decennaleExpiration: a.assurance_decennale_expiration ?? a.decennaleExpiration ?? '',
      note: a.note, vitfixCertifie: a.vitfix_certifie ?? a.vitfixCertifie,
      artisan_user_id: a.artisan_user_id,
    })),
    missions: missions.map(m => ({
      immeuble: m.immeuble, artisan: m.artisan, type: m.type,
      description: m.description, priorite: m.priorite, statut: m.statut,
      dateIntervention: m.dateIntervention, montantDevis: m.montantDevis,
    })),
    alertes: alertes.map(a => ({ type: a.type, message: a.message, urgence: a.urgence })),
    echeances: ECHEANCES_DEMO,
    coproprios: coproprios.map(c => ({ nom: c.nomProprietaire, prenom: c.prenomProprietaire, email: c.emailProprietaire, telephone: c.telephoneProprietaire, immeuble: c.immeuble, batiment: c.batiment, etage: c.etage, porte: c.numeroPorte, locataire: c.nomLocataire ? `${c.prenomLocataire || ''} ${c.nomLocataire}`.trim() : null })),
    stats: {
      totalBudget: immeubles.reduce((s, i) => s + i.budgetAnnuel, 0),
      totalDepenses: immeubles.reduce((s, i) => s + i.depensesAnnee, 0),
      missionsUrgentes: missions.filter(m => m.priorite === 'urgente' && m.statut !== 'terminee').length,
      artisansRcExpiree: artisans.filter(a => !a.rcProValide).length,
      artisansDecennaleManquante: artisans.filter(a => !a.decennaleValide).length,
    },
  })

  // ── Refresh missions depuis la DB (après mutation IA) ───────────────────────
  const refreshMissionsFromDB = async () => {
    try {
      const _sToken = await getAdminToken()
      if (!_sToken) return
      const res = await fetch('/api/syndic/missions', {
        headers: { Authorization: `Bearer ${_sToken}` },
      })
      if (res.ok) {
        const { missions: dbMissions } = await res.json()
        if (dbMissions) {
          setMissions(dbMissions)
          try { localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(dbMissions)) } catch {}
        }
      }
    } catch { /* silencieux */ }
  }

  // ── Journal d'audit actions IA ──────────────────────────────────────────────
  const logAiAction = (actionType: string, actionData: IaAction, result: 'success' | 'error' | 'cancelled', details?: string) => {
    try {
      const key = `fixit_syndic_audit_${user?.id}`
      const existing = JSON.parse(localStorage.getItem(key) || '[]')
      existing.unshift({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        actionType, actionData, result,
        details: details || '',
        user: userName,
      })
      if (existing.length > 200) existing.length = 200
      localStorage.setItem(key, JSON.stringify(existing))
    } catch {}
    console.info(`[Fixy Audit] ${result.toUpperCase()}: ${actionType}`, actionData)
  }

  // ── NLP Pré-traitement vocal — détection d'intention + normalisation ────────
  const preprocessVoiceCommand = (transcript: string): { type: 'navigate' | 'ai_query'; text: string; page?: string } => {
    const t = transcript.toLowerCase().trim()

    // Navigation rapide (exécution instantanée, sans IA)
    const navPatternsFr: [RegExp, string][] = [
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:missions?|interventions?)/, 'missions'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:alertes?|urgences?)/, 'alertes'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:artisans?|prestataires?)/, 'artisans'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:immeubles?|bâtiments?|résidences?)/, 'immeubles'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:budget|comptabilité|finances?|compta)/, 'facturation'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:documents?|courriers?)/, 'documents'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:accueil|tableau de bord|dashboard)/, 'accueil'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:échéances?|réglementaire|contrôles?)/, 'reglementaire'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:canal|messagerie|messages?)/, 'canal'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:planning|agenda|calendrier)/, 'planning'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:paramètres?|réglages?|settings?)/, 'parametres'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:équipe|collaborateurs?|personnel)/, 'equipe'],
    ]

    const navPatternsPt: [RegExp, string][] = [
      [/(?:vai|ir|mostra|abre|acede)[^\n]*(?:miss[õo]es?|intervenç[õo]es?)/, 'missions'],
      [/(?:vai|ir|mostra|abre|acede)[^\n]*(?:alertas?|urgências?)/, 'alertes'],
      [/(?:vai|ir|mostra|abre|acede)[^\n]*(?:profissionais?|prestadores?)/, 'artisans'],
      [/(?:vai|ir|mostra|abre|acede)[^\n]*(?:im[óo]veis?|edif[ií]cios?|resid[êe]ncias?)/, 'immeubles'],
      [/(?:vai|ir|mostra|abre|acede)[^\n]*(?:orçamento|contabilidade|finanças?)/, 'facturation'],
      [/(?:vai|ir|mostra|abre|acede)[^\n]*(?:documentos?|correspond[êe]ncias?)/, 'documents'],
      [/(?:vai|ir|mostra|abre|acede)[^\n]*(?:in[ií]cio|painel|dashboard)/, 'accueil'],
      [/(?:vai|ir|mostra|abre|acede)[^\n]*(?:prazos?|regulamentar|controlos?)/, 'reglementaire'],
      [/(?:vai|ir|mostra|abre|acede)[^\n]*(?:canal|mensagens?)/, 'canal'],
      [/(?:vai|ir|mostra|abre|acede)[^\n]*(?:planning|agenda|calend[áa]rio)/, 'planning'],
      [/(?:vai|ir|mostra|abre|acede)[^\n]*(?:definiç[õo]es?|configuraç[õo]es?|settings?)/, 'parametres'],
      [/(?:vai|ir|mostra|abre|acede)[^\n]*(?:equipa|colaboradores?|pessoal)/, 'equipe'],
    ]

    const navPatterns = locale === 'pt' ? navPatternsPt : navPatternsFr

    for (const [pattern, page] of navPatterns) {
      if (pattern.test(t)) {
        return { type: 'navigate', text: transcript, page }
      }
    }

    // Normalisation des erreurs STT courantes en gestion immobilière
    const dateFmt = locale === 'pt' ? 'pt-PT' : 'fr-FR'
    let normalized = transcript

    if (locale === 'pt') {
      // Portuguese STT normalization
      // Termos profissionais
      normalized = normalized
        .replace(/\bpart[es]?\s*comun[s]?\b/gi, 'parte comum')
        .replace(/\bcanalizaç[ãa]o\b/gi, 'canalização')
        .replace(/\beletricidade?\b/gi, 'eletricidade')
        .replace(/\bserralharia?\b/gi, 'serralharia')
        .replace(/\binundaç[ãa]o\b/gi, 'inundação')
        .replace(/\besquenta?dor\b/gi, 'esquentador')
        // Prioridades faladas
        .replace(/\b(?:muito\s+)?urgente?\b/gi, 'urgente')
        .replace(/\bnormal?\b/gi, 'normal')
        // Datas faladas
        .replace(/\bprimeiro\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/gi, '1 de $1')
        .replace(/\bamanh[ãa]\b/gi, new Date(Date.now() + 86400000).toLocaleDateString(dateFmt, { day: 'numeric', month: 'long' }))
        .replace(/\bdepois\s+de\s+amanh[ãa]\b/gi, new Date(Date.now() + 172800000).toLocaleDateString(dateFmt, { day: 'numeric', month: 'long' }))
        .replace(/\bsegunda[\s-]feira\s+pr[óo]xima\b/gi, (() => {
          const d = new Date(); d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7))
          return d.toLocaleDateString(dateFmt, { weekday: 'long', day: 'numeric', month: 'long' })
        })())
    } else {
      // French STT normalization (original)
      normalized = normalized
        // Noms propres fréquents déformés par le STT
        .replace(/\ble?\s*port\b/gi, 'Lepore')
        .replace(/\bpar\s*corot?\b/gi, 'Parc Corot')
        .replace(/\bla\s*cacia[s]?\b/gi, 'Les Acacias')
        // Termes métier
        .replace(/\bpart[ie]?\s*commun[es]?\b/gi, 'partie commune')
        .replace(/\bélagage?\b/gi, 'élagage')
        .replace(/\bplombe?rie?\b/gi, 'plomberie')
        .replace(/\bélectricit[ée]?\b/gi, 'électricité')
        .replace(/\bserrur[ie]+r?\b/gi, 'serrurerie')
        .replace(/\bdégâts?\s*des?\s*eaux?\b/gi, 'dégât des eaux')
        .replace(/\bchauffe?\s*eau\b/gi, 'chauffe-eau')
        .replace(/\bdigicode?\b/gi, 'digicode')
        // Priorités parlées
        .replace(/\b(?:très\s+)?urgent[e]?\b/gi, 'urgente')
        .replace(/\bnormal[e]?\b/gi, 'normale')
        // Dates parlées (le STT écrit souvent le mot au lieu du chiffre)
        .replace(/\bpremier\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/gi, '1er $1')
        .replace(/\bdemain\b/gi, new Date(Date.now() + 86400000).toLocaleDateString(dateFmt, { day: 'numeric', month: 'long' }))
        .replace(/\baprès[\s-]demain\b/gi, new Date(Date.now() + 172800000).toLocaleDateString(dateFmt, { day: 'numeric', month: 'long' }))
        .replace(/\blundi\s+prochain\b/gi, (() => {
          const d = new Date(); d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7))
          return d.toLocaleDateString(dateFmt, { weekday: 'long', day: 'numeric', month: 'long' })
        })())
    }

    return { type: 'ai_query', text: normalized }
  }

  // ── Synthèse vocale V2 — voix HD + chunked speech ─────────────────────────────
  const speakResponse = (text: string) => {
    if (!iaSpeechEnabled || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()

    // Nettoyer le markdown pour la parole
    const cleanText = text
      .replace(/##ACTION##[\s\S]*?##/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#+\s/g, '')
      .replace(/\|[^\n]+\|/g, '')
      .replace(/[-•]\s/g, '')
      .replace(/✅|❌|🔔|⚡|📋|📍|👤|🔧|📅|🚫|🔴/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\s{2,}/g, ' ')
      .trim()

    if (!cleanText) return

    // Sélection de voix optimale (préférer les voix HD/Natural)
    const selectBestVoice = (): SpeechSynthesisVoice | null => {
      const voices = iaAvailableVoices.length ? iaAvailableVoices : window.speechSynthesis.getVoices()
      const langPrefix = locale === 'pt' ? 'pt' : 'fr'
      const langVoices = voices.filter(v => v.lang.startsWith(langPrefix))
      if (!langVoices.length) return null

      // Priorité : Google HD > Google > Premium > Enhanced > Default
      const priorities = locale === 'pt'
        ? ['Google', 'Premium', 'Enhanced', 'Natural', 'Joana', 'Cristiano']
        : ['Google', 'Premium', 'Enhanced', 'Natural', 'Amelie', 'Thomas']
      for (const prio of priorities) {
        const match = langVoices.find(v => v.name.includes(prio))
        if (match) return match
      }
      // Préférer les voix locales (moins de latence)
      return langVoices.find(v => v.localService) || langVoices[0]
    }

    // Chunked speech : découper en phrases pour les longs textes
    const chunks = cleanText.length > 300
      ? cleanText.match(/[^.!?]+[.!?]+\s*/g) || [cleanText]
      : [cleanText]

    // Limiter à 800 caractères max total
    let totalChars = 0
    const limitedChunks: string[] = []
    for (const chunk of chunks) {
      if (totalChars + chunk.length > 800) break
      limitedChunks.push(chunk.trim())
      totalChars += chunk.length
    }
    if (!limitedChunks.length) limitedChunks.push(cleanText.substring(0, 800))

    const selectedVoice = selectBestVoice()

    limitedChunks.forEach((chunk, idx) => {
      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.lang = locale === 'pt' ? 'pt-PT' : 'fr-FR'
      utterance.rate = 1.05
      utterance.pitch = 1.0
      if (selectedVoice) utterance.voice = selectedVoice

      if (idx === 0) utterance.onstart = () => setIaSpeaking(true)
      if (idx === limitedChunks.length - 1) {
        utterance.onend = () => setIaSpeaking(false)
        utterance.onerror = () => setIaSpeaking(false)
      }

      window.speechSynthesis.speak(utterance)
    })
  }

  // ── Stop voice recognition (used by FixyPanel) ─────────────────────────────
  const stopVoiceRecognition = () => {
    iaRecognitionRef.current?.stop()
    setIaVoiceActive(false)
    clearInterval(iaVoiceDurationRef.current)
    setIaVoiceDuration(0)
    setIaVoiceInterim('')
    setIaVoiceConfidence(0)
  }

  // Sauvegarder préférence TTS
  const toggleSpeechEnabled = () => {
    setIaSpeechEnabled(prev => {
      const next = !prev
      try { localStorage.setItem(`fixit_tts_enabled_${user?.id}`, String(next)) } catch {}
      if (!next && iaSpeaking) window.speechSynthesis?.cancel()
      return next
    })
  }

  // ── Reconnaissance vocale V2 — latence optimisée + NLP + auto-restart ────────
  const startVoiceRecognition = () => {
    if (typeof window === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    // Toggle off si déjà actif
    if (iaVoiceActive && iaRecognitionRef.current) {
      iaRecognitionRef.current.stop()
      setIaVoiceActive(false)
      clearInterval(iaVoiceDurationRef.current)
      setIaVoiceDuration(0)
      setIaVoiceInterim('')
      setIaVoiceConfidence(0)
      return
    }

    // Couper la synthèse vocale en cours (écouter > parler)
    if (iaSpeaking && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      setIaSpeaking(false)
    }

    const recognition = new SpeechRecognition()
    recognition.lang = locale === 'pt' ? 'pt-PT' : 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 3

    let finalTranscript = ''
    let restartCount = 0
    const MAX_RESTARTS = 3

    recognition.onstart = () => {
      setIaVoiceActive(true)
      setIaVoiceDuration(0)
      setIaVoiceInterim('')
      setIaVoiceConfidence(0)
      iaTranscriptRef.current = ''
      // Timer durée d'enregistrement
      clearInterval(iaVoiceDurationRef.current)
      iaVoiceDurationRef.current = setInterval(() => {
        setIaVoiceDuration(prev => prev + 1)
      }, 1000)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      finalTranscript = ''

      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        } else {
          interim += event.results[i][0].transcript
        }
      }

      const displayText = (finalTranscript + (interim ? ' ' + interim : '')).trim()
      setIaInput(displayText)
      setIaVoiceInterim(interim)
      iaTranscriptRef.current = displayText

      // Confidence (0-1)
      const lastResult = event.results[event.results.length - 1]
      if (lastResult?.[0]?.confidence) {
        setIaVoiceConfidence(Math.round(lastResult[0].confidence * 100))
      }

      // Résultat final → auto-send après 800ms de silence
      if (lastResult?.isFinal && finalTranscript.trim()) {
        clearTimeout(iaSendTimerRef.current)
        iaSendTimerRef.current = setTimeout(() => {
          const text = iaTranscriptRef.current.trim()
          if (!text) return

          // Stop recognition
          try { recognition.stop() } catch {}
          clearInterval(iaVoiceDurationRef.current)
          setIaVoiceActive(false)
          setIaVoiceDuration(0)
          setIaVoiceInterim('')
          setIaVoiceConfidence(0)

          // NLP pré-traitement
          const processed = preprocessVoiceCommand(text)

          if (processed.type === 'navigate' && processed.page) {
            // Navigation instantanée — pas besoin de l'IA
            setPage(processed.page as Page)
            setIaInput('')
            setIaMessages(prev => [...prev,
              { role: 'user', content: `🎙️ ${text}` },
              { role: 'assistant', content: `✅ Navigation vers **${processed.page}**`, action: { type: 'navigate', page: processed.page } },
            ])
          } else {
            // Envoyer à Fixy via le trigger (évite les problèmes de closure)
            setIaVoiceSendTrigger(processed.text)
          }
        }, 800)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (process.env.NODE_ENV !== 'production') console.warn('Speech recognition error:', event.error)

      // Auto-restart sur timeout "no-speech" (micro ouvert mais pas de voix)
      if (event.error === 'no-speech' && restartCount < MAX_RESTARTS) {
        restartCount++
        try { recognition.start() } catch {}
        return
      }

      // Micro refusé → désactiver la feature
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setIaVoiceSupported(false)
      }

      setIaVoiceActive(false)
      clearInterval(iaVoiceDurationRef.current)
      setIaVoiceDuration(0)
      setIaVoiceInterim('')
      setIaVoiceConfidence(0)
    }

    recognition.onend = () => {
      setIaVoiceActive(false)
      clearInterval(iaVoiceDurationRef.current)
      setIaVoiceDuration(0)
    }

    iaRecognitionRef.current = recognition
    try {
      recognition.start()
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('Failed to start voice recognition:', err)
      setIaVoiceActive(false)
    }
  }

  // Cleanup : arrêter la reconnaissance si le composant démonte
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      if (iaRecognitionRef.current) try { iaRecognitionRef.current.stop() } catch {}
      clearInterval(iaVoiceDurationRef.current)
      clearTimeout(iaSendTimerRef.current)
      if (window.speechSynthesis) window.speechSynthesis.cancel()
    }
  }, [])

  // ── Helper : retrouver artisan local par nom (fuzzy match) ───────────────────
  // Normalise un texte : minuscule + suppression accents (é→e, ç→c, etc.)
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

  const findLocalArtisan = (name: string) => {
    if (!name) return null
    const n = norm(name)
    // Match exact (sans accents)
    let found = artisans.find(a => norm(a.nom || '') === n || norm(`${a.prenom || ''} ${a.nom_famille || ''}`) === n)
    // Match partiel (chaque mot présent dans le nom complet)
    if (!found) {
      const parts = n.split(/\s+/)
      found = artisans.find(a => {
        const full = norm(`${a.prenom || ''} ${a.nom_famille || ''} ${a.nom || ''}`)
        return parts.every(p => full.includes(p))
      })
    }
    // Match par inclusion (sans accents)
    if (!found) found = artisans.find(a => norm(a.nom || '').includes(n) || n.includes(norm(a.nom || '')))
    // Match souple : au moins le nom de famille matche
    if (!found) {
      const parts = n.split(/\s+/)
      found = artisans.find(a => {
        const nomF = norm(a.nom_famille || a.nom || '')
        return parts.some(p => p.length > 2 && nomF.includes(p))
      })
    }
    return found || null
  }

  // ── Exécution réelle des actions IA (écriture DB) ─────────────────────────────
  const executeIaAction = async (action: IaAction, iaToken: string) => {
    try {
      console.info(`[FIXY EXEC] ── Action reçue : type=${action.type} artisan="${action.artisan}" email="${action.artisan_email}" user_id="${action.artisan_user_id}" date="${action.date_intervention}"`)
      console.info(`[FIXY EXEC] État artisans local : ${artisans.length} artisans en mémoire`)

      // Résolution artisan : enrichir l'action avec email + user_id depuis la liste locale
      if (action.artisan && (action.type === 'create_mission' || action.type === 'assign_mission')) {
        const localArtisan = findLocalArtisan(action.artisan)
        console.info(`[FIXY EXEC] findLocalArtisan("${action.artisan}") → ${localArtisan ? `TROUVÉ: "${localArtisan.nom}" <${localArtisan.email}> uid=${localArtisan.artisan_user_id}` : 'NULL (pas trouvé dans la liste locale)'}`)

        if (localArtisan) {
          if (!action.artisan_email) action.artisan_email = localArtisan.email
          if (!action.artisan_user_id) action.artisan_user_id = localArtisan.artisan_user_id
          action.artisan = localArtisan.nom || action.artisan
          console.info(`[FIXY EXEC] Action enrichie : email="${action.artisan_email}" user_id="${action.artisan_user_id}" nom="${action.artisan}"`)
        } else if (artisans.length === 0) {
          // Dernier recours : la liste est vide, essayer de recharger
          if (process.env.NODE_ENV !== 'production') console.warn(`[FIXY EXEC] artisans.length === 0, force-reload...`)
          try {
            const emergencyRes = await fetch('/api/syndic/artisans', {
              headers: { 'Authorization': `Bearer ${iaToken}`, 'Content-Type': 'application/json' },
            })
            if (emergencyRes.ok) {
              const emergencyData = await emergencyRes.json()
              if (emergencyData.artisans?.length > 0) {
                const emergencyMapped = emergencyData.artisans.map((a: ArtisanAPIRow) => ({
                  ...a,
                  nom: a.nom || `${a.prenom || ''} ${a.nom_famille || ''}`.trim(),
                  rcProValide: a.rc_pro_valide ?? a.rcProValide ?? false,
                  rcProExpiration: a.rc_pro_expiration ?? a.rcProExpiration ?? '',
                  nbInterventions: a.nb_interventions ?? a.nbInterventions ?? 0,
                  vitfixCertifie: a.vitfix_certifie ?? a.vitfixCertifie ?? false,
                }))
                setArtisans(emergencyMapped)
                  // Re-tenter findLocalArtisan avec les données fraîches
                const retryArtisan = emergencyMapped.find((a: Artisan) => {
                  const n = norm(action.artisan || '')
                  const aN = norm(a.nom || '')
                  const aParts = norm(`${a.prenom || ''} ${a.nom_famille || ''} ${a.nom || ''}`)
                  return aN === n || aParts.includes(n) || n.split(/\s+/).every((p: string) => aParts.includes(p))
                })
                if (retryArtisan) {
                  if (!action.artisan_email) action.artisan_email = retryArtisan.email
                  if (!action.artisan_user_id) action.artisan_user_id = retryArtisan.artisan_user_id
                  action.artisan = retryArtisan.nom || action.artisan
                  console.info(`[FIXY EXEC] ✅ Force-reload réussi ! Artisan retrouvé : "${retryArtisan.nom}" <${retryArtisan.email}>`)
                }
              }
            }
          } catch (e) { if (process.env.NODE_ENV !== 'production') console.error('[FIXY EXEC] Force-reload failed:', e) }
        }
      }

      if (action.type === 'create_mission' || action.type === 'assign_mission') {
        // ── PATH UNIFIÉ : création mission + assignation artisan ──────────────
        // Que le LLM ait choisi create_mission ou assign_mission,
        // on fait la même chose : créer en DB + assigner si artisan présent
        const dateIntervention = action.date_intervention || new Date().toISOString().split('T')[0]

        // 1. Persister en base via POST /api/syndic/missions
        const missionRes = await fetch('/api/syndic/missions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaToken}` },
          body: JSON.stringify({
            immeuble: action.immeuble || action.lieu || '',
            artisan: action.artisan || '',
            type: action.type_travaux || 'Intervention',
            description: action.description || '',
            priorite: action.priorite || 'normale',
            statut: 'en_attente',
            dateCreation: new Date().toISOString().split('T')[0],
            dateIntervention: dateIntervention,
          }),
        })
        if (!missionRes.ok) throw new Error('Erreur création mission en base')
        const { mission } = await missionRes.json()

        // 2. Si artisan mentionné → TOUJOURS assigner sur son agenda
        //    Plus de guard sur date_intervention : on default à aujourd'hui
        //    L'API résout par email, user_id OU nom (multi-stratégie)
        if (action.artisan) {
          console.info(`[FIXY EXEC] Appel assign-mission : artisan="${action.artisan}" email="${action.artisan_email}" user_id="${action.artisan_user_id}" date="${dateIntervention}"`)
          try {
            const assignRes = await fetch('/api/syndic/assign-mission', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaToken}` },
              body: JSON.stringify({
                artisan_email: action.artisan_email || '',
                artisan_user_id: action.artisan_user_id || null,
                artisan_name: action.artisan,
                description: action.description || '',
                type_travaux: action.type_travaux || 'Intervention',
                date_intervention: dateIntervention,
                immeuble: action.immeuble || action.lieu || '',
                priorite: action.priorite || 'normale',
                notes: action.notes || '',
              }),
            })
            const d = await assignRes.json()
            console.info(`[FIXY EXEC] Réponse assign-mission :`, JSON.stringify(d))
            if (d.success && d.artisan_found) {
              const dateStr = new Date(dateIntervention).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
              setIaMessages(prev => [...prev, {
                role: 'assistant',
                content: `✅ **Mission assignée !**\n\n📅 **${action.type_travaux || action.description}** — ${action.immeuble || action.lieu || ''}\n👤 **${action.artisan}** — ${dateStr}\n\nNotification envoyée — la mission apparaît sur son agenda.`,
              }])
              speakResponse(`Mission assignée à ${action.artisan}.`)
            } else {
              setIaMessages(prev => [...prev, {
                role: 'assistant',
                content: `⚠️ Mission créée en base pour **${action.artisan}** mais l'artisan n'a pas pu être lié automatiquement.\n\nVérifiez qu'il est bien ajouté dans l'onglet **Artisans** avec un email correct.`,
              }])
              speakResponse(`Mission créée mais l'artisan n'a pas été trouvé automatiquement.`)
            }
          } catch (assignErr) {
            if (process.env.NODE_ENV !== 'production') console.error('[FIXY] Assign error:', assignErr)
            setIaMessages(prev => [...prev, {
              role: 'assistant',
              content: `✅ Mission créée en base pour **${action.artisan}** — L'assignation automatique a échoué, vérifiez manuellement.`,
            }])
          }
        } else {
          // Pas d'artisan mentionné
          setIaMessages(prev => [...prev, {
            role: 'assistant',
            content: `✅ **Mission créée en base** — ${action.type_travaux || 'Intervention'} à ${action.immeuble || 'N/A'}`,
          }])
        }

        // 3. Refresh depuis DB pour cohérence
        await refreshMissionsFromDB()
        logAiAction(action.type, action, 'success', `Mission ${mission?.id} créée${action.artisan ? `, assignée à ${action.artisan}` : ''}`)

      } else if (action.type === 'update_mission') {
        // Mise à jour d'une mission existante
        if (!action.mission_id) {
          // Chercher par artisan + immeuble si pas d'ID
          const found = missions.find(m =>
            (action.artisan && m.artisan?.toLowerCase().includes(action.artisan.toLowerCase())) ||
            (action.immeuble && m.immeuble?.toLowerCase().includes(action.immeuble.toLowerCase()))
          )
          if (found) action.mission_id = found.id
        }

        if (!action.mission_id) {
          setIaMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Impossible de mettre à jour : mission non trouvée. Précisez l\'artisan ou l\'immeuble.' }])
          logAiAction('update_mission', action, 'error', 'mission_id non résolu')
          return
        }

        const updatePayload: Record<string, unknown> = { id: action.mission_id }
        if (action.statut) updatePayload.statut = action.statut
        if (action.artisan) updatePayload.artisan = action.artisan
        if (action.priorite) updatePayload.priorite = action.priorite
        if (action.description) updatePayload.description = action.description
        if (action.date_intervention) updatePayload.dateIntervention = action.date_intervention

        const res = await fetch('/api/syndic/missions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaToken}` },
          body: JSON.stringify(updatePayload),
        })
        if (!res.ok) throw new Error('Erreur mise à jour mission')

        await refreshMissionsFromDB()

        const statusLabels: Record<string, string> = { en_cours: 'en cours', terminee: 'terminée', annulee: 'annulée', acceptee: 'acceptée', en_attente: 'en attente' }
        setIaMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ **Mission mise à jour** — ${action.statut ? `Statut → ${statusLabels[action.statut] || action.statut}` : 'Modifiée avec succès'}`,
        }])
        logAiAction('update_mission', action, 'success', `Mission ${action.mission_id} mise à jour`)

      } else if (action.type === 'create_alert') {
        const newAlerte: Alerte = {
          id: Date.now().toString(),
          type: 'mission',
          message: action.message || 'Alerte créée par Fixy',
          urgence: (action.urgence as 'haute' | 'moyenne' | 'basse') || 'moyenne',
          date: new Date().toISOString().split('T')[0],
        }
        setAlertes(prev => [newAlerte, ...prev])
        try {
          const key = `fixit_syndic_alertes_${user?.id}`
          const existing = JSON.parse(localStorage.getItem(key) || '[]')
          existing.unshift(newAlerte)
          localStorage.setItem(key, JSON.stringify(existing))
        } catch {}

        setIaMessages(prev => [...prev, {
          role: 'assistant',
          content: `🔔 **Alerte créée** — [${newAlerte.urgence.toUpperCase()}] ${newAlerte.message}`,
        }])
        logAiAction('create_alert', action, 'success', `Alerte ${newAlerte.id}`)

      } else if (action.type === 'navigate') {
        if (action.page) setPage(action.page as Page)
        logAiAction('navigate', action, 'success', `→ ${action.page}`)

      } else if (action.type === 'send_message') {
        const targetArtisan = artisans.find(a =>
          a.nom.toLowerCase().includes((action.artisan || '').toLowerCase()) ||
          (action.artisan || '').toLowerCase().includes(a.nom.toLowerCase())
        )
        if (targetArtisan?.artisan_user_id && action.content) {
          await fetch('/api/syndic/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaToken}` },
            body: JSON.stringify({
              content: action.content,
              artisan_user_id: targetArtisan.artisan_user_id,
            }),
          })
          setIaMessages(prev => [...prev, {
            role: 'assistant',
            content: `✅ **Message envoyé à ${action.artisan}**`,
          }])
        }
        logAiAction('send_message', action, 'success', `→ ${action.artisan}`)

      } else if (action.type === 'create_document') {
        if (action.contenu) {
          setIaMessages(prev => [...prev, {
            role: 'assistant',
            content: `📄 **Document généré — ${action.type_doc || 'Courrier'}**\n\n---\n\n${action.contenu}`,
          }])
        }
        logAiAction('create_document', action, 'success', `Type: ${action.type_doc}`)
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (process.env.NODE_ENV !== 'production') console.error('[Fixy] Action execution error:', err)
      logAiAction(action.type, action, 'error', errMsg)
      setIaMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ **Erreur lors de l'exécution** : ${errMsg || 'Erreur inconnue'}. Réessayez ou créez la mission manuellement.`,
      }])
    }
  }

  // ── Envoi message Fixy ─────────────────────────────────────────────────────
  const sendIaMessage = async (overrideText?: string) => {
    const msgText = overrideText || iaInput
    if (!msgText.trim() || iaLoading) return
    const userMsg = msgText.trim()
    setIaInput('')
    setIaMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setIaLoading(true)

    try {
      const iaToken = await getAdminToken()

      // ── GARDE ARTISANS : si la liste est vide, forcer un rechargement ──
      // Critique : sans artisans, le LLM ne peut pas résoudre les noms
      let currentArtisans = artisans
      if (currentArtisans.length === 0 && iaToken) {
        if (process.env.NODE_ENV !== 'production') console.warn('[FIXY] artisans vide, force-loading avant envoi...')
        try {
          const artReload = await fetch('/api/syndic/artisans', {
            headers: { 'Authorization': `Bearer ${iaToken}`, 'Content-Type': 'application/json' },
          })
          if (artReload.ok) {
            const artReloadData = await artReload.json()
            if (artReloadData.artisans && artReloadData.artisans.length > 0) {
              const mappedReload: Artisan[] = artReloadData.artisans.map((a: ArtisanAPIRow) => ({
                ...a,
                nom: a.nom || `${a.prenom || ''} ${a.nom_famille || ''}`.trim(),
                rcProValide: a.rc_pro_valide ?? a.rcProValide ?? false,
                rcProExpiration: a.rc_pro_expiration ?? a.rcProExpiration ?? '',
                decennaleValide: a.assurance_decennale_valide ?? a.decennaleValide ?? false,
                decennaleExpiration: a.assurance_decennale_expiration ?? a.decennaleExpiration ?? '',
                nbInterventions: a.nb_interventions ?? a.nbInterventions ?? 0,
                vitfixCertifie: a.vitfix_certifie ?? a.vitfixCertifie ?? false,
              }))
              setArtisans(mappedReload)
              currentArtisans = mappedReload
              console.info(`[FIXY] ✅ Force-reload artisans : ${mappedReload.length} chargés`, mappedReload.map(a => `${a.nom} <${a.email}>`))
            }
          }
        } catch (reloadErr) {
          if (process.env.NODE_ENV !== 'production') console.error('[FIXY] Force-reload artisans failed:', reloadErr)
        }
      }

      // Construire le contexte avec les artisans garantis chargés
      const syndicCtx = {
        ...buildSyndicContext(),
        artisans: currentArtisans.map(a => ({
          nom: a.nom, metier: a.metier, statut: a.statut,
          email: a.email,
          telephone: a.telephone,
          rcProValide: a.rc_pro_valide ?? a.rcProValide,
          rcProExpiration: a.rc_pro_expiration ?? a.rcProExpiration,
          note: a.note, vitfixCertifie: a.vitfix_certifie ?? a.vitfixCertifie,
          artisan_user_id: a.artisan_user_id,
        })),
      }

      console.info(`[FIXY] Envoi message "${userMsg.substring(0, 60)}..." avec ${syndicCtx.artisans.length} artisans`)

      const res = await fetch('/api/syndic/fixy-syndic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaToken}` },
        body: JSON.stringify({
          message: userMsg,
          syndic_context: syndicCtx,
          conversation_history: iaMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const action = data.action || null
      // Si réponse vide mais action présente, fournir un texte par défaut
      const responseText = data.response || (action ? '✅ Action préparée — vérifiez les détails ci-dessous.' : 'Désolé, je n\'ai pas pu répondre. Réessayez.')

      setIaMessages(prev => [...prev, { role: 'assistant', content: responseText, action }])

      // ── Exécuter l'action si présente ─────────────────────────────────────
      if (action) {
        const CONFIRM_ACTIONS = ['create_mission', 'assign_mission', 'update_mission']
        if (CONFIRM_ACTIONS.includes(action.type)) {
          // Actions critiques → demander confirmation via carte interactive
          setIaMessages(prev => prev.map((msg, idx) =>
            idx === prev.length - 1 ? { ...msg, actionStatus: 'pending' as const } : msg
          ))
          setIaPendingAction({ action, iaToken: iaToken || '' })
        } else {
          // Actions non-destructives → exécuter immédiatement
          executeIaAction(action, iaToken || '')
        }
      }

      speakResponse(responseText)

    } catch {
      setIaMessages(prev => [...prev, { role: 'assistant', content: 'Erreur de connexion. Vérifiez votre réseau et réessayez.' }])
    }
    setIaLoading(false)
  }

  // ── Voice send trigger — évite les closures stales dans recognition.onresult ─
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (iaVoiceSendTrigger) {
      setIaVoiceSendTrigger(null)
      setIaInput('')
      sendIaMessage(iaVoiceSendTrigger)
    }
  }, [iaVoiceSendTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Confirmation / Annulation action IA ──────────────────────────────────────
  const handleConfirmIaAction = async () => {
    if (!iaPendingAction) return
    const { action, iaToken } = iaPendingAction
    setIaPendingAction(null)
    setIaMessages(prev => prev.map(msg =>
      msg.actionStatus === 'pending' ? { ...msg, actionStatus: 'confirmed' as const } : msg
    ))
    await executeIaAction(action, iaToken)
  }

  const handleCancelIaAction = () => {
    if (!iaPendingAction) return
    const { action } = iaPendingAction
    setIaMessages(prev => prev.map(msg =>
      msg.actionStatus === 'pending' ? { ...msg, actionStatus: 'cancelled' as const } : msg
    ))
    setIaMessages(prev => [...prev, {
      role: 'assistant',
      content: '🚫 Action annulée. Dites-moi si vous souhaitez faire autre chose.',
    }])
    logAiAction(action.type, action, 'cancelled', 'Annulé par l\'utilisateur')
    setIaPendingAction(null)
  }

  // ── Checklist Conformité PT/FR ─────────────────────────────────────────────
  const buildConformiteChecklist = () => {
    const ctx = buildSyndicContext()
    const isPt = locale === 'pt'
    const checks: { id: string; label: string; status: 'ok' | 'warning' | 'error' | 'info'; detail: string; action?: string }[] = []

    // 1. RC Pro artisans — obligation légale (FR: art. L241-1 Code des assurances / PT: seguro RC profissional)
    const rcExpired = ctx.artisans.filter(a => !a.rcProValide)
    checks.push({
      id: 'rc_pro',
      label: isPt ? 'RC Pro artesãos' : 'RC Pro artisans',
      status: rcExpired.length === 0 ? 'ok' : 'error',
      detail: rcExpired.length === 0
        ? (isPt ? 'Todos os artesãos têm RC Pro válido' : 'Tous les artisans ont une RC Pro valide (art. L241-1 Code des assurances)')
        : (isPt ? `${rcExpired.length} artesão(s) com RC Pro expirado: ${rcExpired.map(a => a.nom).join(', ')}` : `${rcExpired.length} artisan(s) avec RC Pro expirée : ${rcExpired.map(a => a.nom).join(', ')}`),
      action: rcExpired.length > 0 ? (isPt ? 'Suspender até renovação' : 'Suspendre jusqu\'au renouvellement — obligation art. L241-1') : undefined,
    })

    // 2. Décennale artisans — FR: garantie décennale obligatoire (loi Spinetta 1978, art. 1792 Code civil)
    const decMissing = ctx.artisans.filter(a => !a.decennaleValide)
    checks.push({
      id: 'decennale',
      label: isPt ? 'Seguro decenal' : 'Garantie décennale (loi Spinetta)',
      status: decMissing.length === 0 ? 'ok' : 'warning',
      detail: decMissing.length === 0
        ? (isPt ? 'Todos os artesãos têm seguro decenal válido' : 'Tous les artisans ont une décennale valide (art. 1792 Code civil)')
        : (isPt ? `${decMissing.length} artesão(s) sem seguro decenal: ${decMissing.map(a => a.nom).join(', ')}` : `${decMissing.length} artisan(s) sans décennale : ${decMissing.map(a => a.nom).join(', ')} — obligation loi Spinetta 1978`),
      action: decMissing.length > 0 ? (isPt ? 'Exigir certificado antes de qualquer obra' : 'Exiger attestation avant tout chantier') : undefined,
    })

    // 3. Budget consumption
    ctx.immeubles.forEach(i => {
      const pct = i.budgetAnnuel > 0 ? Math.round(i.depensesAnnee / i.budgetAnnuel * 100) : 0
      checks.push({
        id: `budget_${i.nom}`,
        label: isPt ? `Orçamento — ${i.nom}` : `Budget prévisionnel — ${i.nom}`,
        status: pct > 90 ? 'error' : pct > 75 ? 'warning' : 'ok',
        detail: isPt ? `${pct}% consumido (${i.depensesAnnee.toLocaleString('pt-PT')}€ / ${i.budgetAnnuel.toLocaleString('pt-PT')}€)` : `${pct}% consommé (${i.depensesAnnee.toLocaleString('fr-FR')}€ / ${i.budgetAnnuel.toLocaleString('fr-FR')}€) — art. 14-1 loi 10/07/1965`,
        action: pct > 90 ? (isPt ? 'Requer atenção imediata' : 'Nécessite attention immédiate — prévoir AG extraordinaire') : undefined,
      })
    })

    // 4. Urgent missions
    const urgentMissions = ctx.missions.filter(m => m.priorite === 'urgente' && m.statut !== 'terminee')
    checks.push({
      id: 'missions_urgentes',
      label: isPt ? 'Missões urgentes' : 'Missions urgentes',
      status: urgentMissions.length === 0 ? 'ok' : 'warning',
      detail: urgentMissions.length === 0
        ? (isPt ? 'Nenhuma missão urgente pendente' : 'Aucune mission urgente en cours')
        : (isPt ? `${urgentMissions.length} missão(ões) urgente(s) pendente(s)` : `${urgentMissions.length} mission(s) urgente(s) en cours`),
    })

    // 5. High alerts
    const highAlerts = ctx.alertes.filter(a => a.urgence === 'haute')
    checks.push({
      id: 'alertes',
      label: isPt ? 'Alertas urgentes' : 'Alertes urgentes',
      status: highAlerts.length === 0 ? 'ok' : 'error',
      detail: highAlerts.length === 0
        ? (isPt ? 'Nenhum alerta urgente' : 'Aucune alerte urgente')
        : (isPt ? `${highAlerts.length} alerta(s) urgente(s) ativo(s)` : `${highAlerts.length} alerte(s) urgente(s) active(s)`),
    })

    // 6. Fonds travaux / Fundo de reserva
    checks.push({
      id: 'fundo_reserva',
      label: isPt ? 'Fundo comum de reserva (≥10%)' : 'Fonds travaux (loi ALUR art. 14-2)',
      status: 'info',
      detail: isPt ? 'Verifique que cada condomínio tem fundo ≥10% do orçamento (DL 268/94 art.4.º)' : 'Obligation loi ALUR art. 14-2 — fonds travaux ≥5% du budget prévisionnel, cotisation annuelle obligatoire',
    })

    // 7. Assurance MRI / Seguro obrigatório
    checks.push({
      id: 'seguro',
      label: isPt ? 'Seguro obrigatório incêndio' : 'Assurance multirisque immeuble (MRI)',
      status: 'info',
      detail: isPt ? 'Art.º 1429.º CC — seguro contra incêndio obrigatório para todos os edifícios' : 'Art. 9-1 loi 10/07/1965 — assurance RC obligatoire du syndicat. Vérifiez validité MRI + dommages-ouvrage si travaux',
    })

    // 8. DPE / SCE
    checks.push({
      id: 'sce_dpe',
      label: isPt ? 'Certificação Energética SCE' : 'DPE collectif',
      status: 'info',
      detail: isPt ? 'DL 101-D/2020 — Certificado SCE obrigatório para venda/arrendamento' : 'Loi Climat 2021 — DPE collectif obligatoire. Audit énergétique si étiquette F ou G. Interdiction location G dès 2025',
    })

    // 9. Contrôles réglementaires — différents par pays
    if (locale === 'pt') {
      checks.push({
        id: 'elevador',
        label: 'Inspeção periódica elevador',
        status: 'info',
        detail: 'DL 320/2002 — Inspeção obrigatória a cada 2 anos para elevadores',
      })
    } else {
      // FR: Contrôle ascenseur
      checks.push({
        id: 'ascenseur',
        label: 'Contrôle ascenseur (décret 2004-964)',
        status: 'info',
        detail: 'Décret 2004-964 — contrôle technique quinquennal obligatoire + contrat d\'entretien (art. R125-2 CCH)',
      })
      // FR: Diagnostic amiante
      checks.push({
        id: 'amiante',
        label: 'Diagnostic amiante (DTA)',
        status: 'info',
        detail: 'Décret 2011-629 — dossier technique amiante obligatoire pour immeubles construits avant le 1er juillet 1997',
      })
      // FR: Diagnostic plomb (CREP)
      checks.push({
        id: 'plomb',
        label: 'Diagnostic plomb (CREP)',
        status: 'info',
        detail: 'Art. L1334-5 Code santé publique — CREP obligatoire parties communes immeubles avant 1949',
      })
      // FR: Contrôle installations gaz
      checks.push({
        id: 'gaz',
        label: 'Contrôle installations gaz',
        status: 'info',
        detail: 'Arrêté 2/08/1977 — vérification périodique des installations gaz parties communes',
      })
      // FR: Carnet d'entretien
      checks.push({
        id: 'carnet_entretien',
        label: 'Carnet d\'entretien (décret 2001-477)',
        status: 'info',
        detail: 'Décret 2001-477 — carnet d\'entretien obligatoire tenu par le syndic, mis à jour annuellement',
      })
    }

    // 10. RGPD
    checks.push({
      id: 'rgpd',
      label: isPt ? 'RGPD / Lei 58/2019' : 'RGPD / CNIL',
      status: 'info',
      detail: isPt ? 'Verifique conformidade RGPD e Lei 58/2019 (CNPD)' : 'Règlement UE 2016/679 + loi Informatique et Libertés — registre de traitement, DPO si nécessaire, mentions CNIL',
    })

    // 11. FR: Immatriculation registre national (loi ALUR)
    if (locale !== 'pt') {
      checks.push({
        id: 'immatriculation',
        label: 'Immatriculation registre national',
        status: 'info',
        detail: 'Loi ALUR art. 53 — immatriculation obligatoire de chaque copropriété au registre national (ANAH). Mise à jour annuelle',
      })
    }

    return checks
  }

  // ── Envoi message Max (expert-conseil lecture seule) ──────────────────────
  const sendMaxMessage = async (directMsg?: string) => {
    const userMsg = (directMsg || maxInput).trim()
    if (!userMsg || maxLoading) return
    setMaxInput('')
    setMaxMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setMaxLoading(true)
    // Save to localStorage for persistence
    try {
      const updated = [...maxMessages, { role: 'user' as const, content: userMsg }]
      localStorage.setItem(`fixit_max_history_${user?.id}`, JSON.stringify(updated.slice(-60)))
    } catch {}
    try {
      const maxToken = await getAdminToken()
      // Build context — optionally filtered by immeuble
      const ctx = buildSyndicContext()
      if (maxSelectedImmeuble !== 'all') {
        ctx.immeubles = ctx.immeubles.filter((i: { nom: string }) => i.nom === maxSelectedImmeuble)
        ctx.missions = ctx.missions.filter((m: { immeuble: string }) => m.immeuble === maxSelectedImmeuble)
      }
      const res = await fetch('/api/syndic/max-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${maxToken}` },
        body: JSON.stringify({
          message: userMsg,
          syndic_context: ctx,
          conversation_history: maxMessages.map(m => ({ role: m.role, content: m.content })),
          locale,
          stream: true,
        }),
      })

      const contentType = res.headers.get('content-type') || ''
      if (res.ok && contentType.includes('text/event-stream') && res.body) {
        // Streaming mode
        setMaxLoading(false)
        setMaxMessages(prev => [...prev, { role: 'assistant' as const, content: '' }])

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let fullText = ''
        let buffer = ''

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue
            const payload = trimmed.slice(6)
            if (payload === '[DONE]') break
            try {
              const json = JSON.parse(payload)
              if (json.text) {
                fullText += json.text
                const currentText = fullText
                setMaxMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: 'assistant', content: currentText }
                  return updated
                })
                maxEndRef.current?.scrollIntoView({ behavior: 'smooth' })
              }
            } catch { /* skip */ }
          }
        }

        // Save final to localStorage
        if (fullText) {
          setMaxMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: fullText }
            try { localStorage.setItem(`fixit_max_history_${user?.id}`, JSON.stringify(updated.slice(-60))) } catch {}
            return updated
          })
        }
      } else {
        // Fallback non-streaming
        const data = await res.json().catch(() => ({}))
        const assistantMsg = data.response || (locale === 'pt' ? 'Erro, tente novamente.' : 'Erreur, réessayez.')
        setMaxMessages(prev => {
          const newMsgs = [...prev, { role: 'assistant' as const, content: assistantMsg }]
          try { localStorage.setItem(`fixit_max_history_${user?.id}`, JSON.stringify(newMsgs.slice(-60))) } catch {}
          return newMsgs
        })
        setMaxLoading(false)
      }
    } catch {
      setMaxMessages(prev => [...prev, { role: 'assistant', content: locale === 'pt' ? '❌ Erro de conexão. Verifique a sua rede.' : '❌ Erreur de connexion. Vérifiez votre réseau.' }])
      setMaxLoading(false)
    }
  }

  const companyName = user?.user_metadata?.company_name || (locale === 'pt' ? 'O Meu Gabinete' : 'Mon Cabinet')
  const userName = user?.user_metadata?.full_name || (locale === 'pt' ? 'Gestor' : 'Gestionnaire')
  const initials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)

  const userRole = user?.app_metadata?.role || 'syndic'
  const allowedPages = customAllowedPages || ROLE_PAGES[userRole] || ROLE_PAGES['syndic']

  const isModuleEnabled = (key: string): boolean => {
    // No locale filtering — all modules (PT & FR) are always available
    const mod = SYNDIC_MODULES.find(m => m.key === key)
    if (Object.keys(enabledModules).length === 0) {
      return mod?.default ?? true
    }
    return enabledModules[key] ?? mod?.default ?? true
  }

  const toggleModule = (key: string) => {
    const updated = { ...enabledModules, [key]: !isModuleEnabled(key) }
    setEnabledModules(updated)
    if (user) localStorage.setItem(`fixit_modules_syndic_${user.id}`, JSON.stringify(updated))
  }

  // ── Ordre personnalisé — couvre TOUS les items du menu ───────────────────
  const getNavOrder = (): string[] => {
    const allIds = allNavItems.map(n => n.id as string)
    if (moduleOrder.length === 0) return allIds
    const ordered = moduleOrder.filter(k => allIds.includes(k))
    const missing = allIds.filter(k => !ordered.includes(k))
    return [...ordered, ...missing]
  }

  const saveNavOrder = (newOrder: string[]) => {
    setModuleOrder(newOrder)
    if (user) localStorage.setItem(`fixit_modules_order_syndic_${user.id}`, JSON.stringify(newOrder))
  }

  const moveNavItemUp = (id: string, visibleIds: string[]) => {
    const order = getNavOrder()
    // On bouge uniquement parmi les items visibles : trouver le précédent visible
    const visIdx = visibleIds.indexOf(id)
    if (visIdx <= 0) return
    const prevId = visibleIds[visIdx - 1]
    // Échanger dans l'ordre global
    const n = [...order]
    const a = n.indexOf(id)
    const b = n.indexOf(prevId)
    if (a === -1 || b === -1) return
    ;[n[a], n[b]] = [n[b], n[a]]
    saveNavOrder(n)
  }

  const moveNavItemDown = (id: string, visibleIds: string[]) => {
    const order = getNavOrder()
    const visIdx = visibleIds.indexOf(id)
    if (visIdx === -1 || visIdx === visibleIds.length - 1) return
    const nextId = visibleIds[visIdx + 1]
    const n = [...order]
    const a = n.indexOf(id)
    const b = n.indexOf(nextId)
    if (a === -1 || b === -1) return
    ;[n[a], n[b]] = [n[b], n[a]]
    saveNavOrder(n)
  }

  // ── Catégories sidebar ──
  const SIDEBAR_CATEGORIES = [
    { key: 'agents_ia', label: locale === 'pt' ? 'Agentes IA' : 'Agents IA' },
    { key: 'gestion', label: locale === 'pt' ? 'Gestão' : 'Gestion' },
    { key: 'patrimoine', label: locale === 'pt' ? 'Património' : 'Patrimoine' },
    { key: 'technique', label: locale === 'pt' ? 'Técnico' : 'Technique' },
    { key: 'suivi', label: locale === 'pt' ? 'Acompanhamento' : 'Suivi' },
    { key: 'copropriete', label: locale === 'pt' ? 'Condomínio' : 'Copropriété' },
    { key: 'obrigacoes', label: locale === 'pt' ? 'Obrigações Legais' : 'Obligations PT' },
    { key: 'copropriete_fr', label: 'Gestion Copropriétaires' },
    { key: 'outils_fr', label: 'Outils Avancés' },
    { key: 'condominios_pt', label: 'Gestão Condóminos' },
    { key: 'ferramentas_pt', label: 'Ferramentas Avançadas' },
    { key: 'outils_ia', label: locale === 'pt' ? 'Ferramentas IA' : 'Outils IA' },
    { key: 'compte', label: locale === 'pt' ? 'Conta' : 'Compte' },
  ]

  const allNavItems: { id: Page; emoji: string; label: string; badge?: number; category: string }[] = [
    // ── GESTION ──
    { id: 'accueil', emoji: '📊', label: t('syndicDash.sidebar.dashboard'), category: 'gestion' },
    { id: 'missions', emoji: '📋', label: t('syndicDash.sidebar.missions'), badge: missions.filter(m => m.statut === 'en_cours').length, category: 'gestion' },
    { id: 'pointage', emoji: '📍', label: t('syndicDash.sidebar.fieldTracking'), category: 'gestion' },
    { id: 'canal', emoji: '💬', label: t('syndicDash.sidebar.communications'), badge: missions.filter(m => (m.canalMessages?.length || 0) > 0).length + canalInterneMessages.filter(m => !m.lu).length, category: 'gestion' },
    { id: 'planning', emoji: '📅', label: t('syndicDash.sidebar.planning'), category: 'gestion' },
    // ── PATRIMOINE ──
    { id: 'immeubles', emoji: '🏢', label: t('syndicDash.sidebar.buildings'), badge: immeubles.length, category: 'patrimoine' },
    { id: 'artisans', emoji: '🔧', label: t('syndicDash.sidebar.artisans'), badge: artisans.filter(a => a.statut === 'actif').length, category: 'patrimoine' },
    { id: 'coproprios', emoji: '👥', label: t('syndicDash.sidebar.coowners'), category: 'patrimoine' },
    // ── TECHNIQUE ──
    { id: 'docs_interventions', emoji: '🗂️', label: t('syndicDash.sidebar.interventionDocs'), category: 'technique' },
    { id: 'comptabilite_tech', emoji: '📊', label: t('syndicDash.sidebar.technicalAccounting'), category: 'technique' },
    { id: 'analyse_devis', emoji: '🔍', label: t('syndicDash.sidebar.quoteAnalysis'), category: 'technique' },
    { id: 'facturation', emoji: '💶', label: t('syndicDash.sidebar.billing'), category: 'technique' },
    // ── SUIVI ──
    { id: 'alertes', emoji: '🔔', label: t('syndicDash.sidebar.alerts'), badge: alertes.filter(a => a.urgence === 'haute').length, category: 'suivi' },
    { id: 'rapport', emoji: '📄', label: t('syndicDash.sidebar.monthlyReport'), category: 'suivi' },
    { id: 'reglementaire', emoji: '⚖️', label: t('syndicDash.sidebar.regulatoryCalendar'), category: 'suivi' },
    { id: 'documents', emoji: '📁', label: t('syndicDash.sidebar.documents'), category: 'suivi' },
    // ── COPROPRIÉTÉ ──
    { id: 'compta_copro', emoji: '💶', label: t('syndicDash.sidebar.coproAccounting'), category: 'copropriete' },
    { id: 'ag_digitale', emoji: '🏛️', label: t('syndicDash.sidebar.digitalAG'), category: 'copropriete' },
    { id: 'impayés', emoji: '⚠️', label: t('syndicDash.sidebar.unpaid'), category: 'copropriete' },
    { id: 'carnet_entretien', emoji: '📖', label: t('syndicDash.sidebar.maintenanceLog'), category: 'copropriete' },
    { id: 'sinistres', emoji: '🚨', label: t('syndicDash.sidebar.claims'), category: 'copropriete' },
    { id: 'extranet', emoji: '👥', label: t('syndicDash.sidebar.extranet'), category: 'copropriete' },
    { id: 'echéances', emoji: '📅', label: t('syndicDash.sidebar.legalDeadlines'), category: 'copropriete' },
    { id: 'recouvrement', emoji: '💸', label: t('syndicDash.sidebar.autoRecovery'), category: 'copropriete' },
    { id: 'preparateur_ag', emoji: '📝', label: t('syndicDash.sidebar.agPreparator'), category: 'copropriete' },
    // ── OBRIGAÇÕES LEGAIS (PT-only) ──
    { id: 'declaracao_encargos', emoji: '📜', label: t('syndicDash.sidebar.declaracaoEncargos', 'Declaração de Encargos'), category: 'obrigacoes' },
    { id: 'seguro_condominio', emoji: '🛡️', label: t('syndicDash.sidebar.seguroObrigatorio', 'Seguro Obrigatório'), category: 'obrigacoes' },
    { id: 'fundo_reserva', emoji: '🏦', label: t('syndicDash.sidebar.fundoReserva', 'Fundo Comum de Reserva'), category: 'obrigacoes' },
    { id: 'obrigacoes_legais', emoji: '⚖️', label: 'Obrigações e Prazos', category: 'obrigacoes' },
    { id: 'certificacao_energetica', emoji: '⚡', label: 'Certificação Energética', category: 'obrigacoes' },
    // ── GESTION COPROPRIÉTAIRES (FR) ──
    { id: 'extranet_enrichi', emoji: '🏠', label: 'Extranet enrichi', category: 'copropriete_fr' },
    { id: 'panneau_affichage', emoji: '📌', label: 'Panneau d\'affichage', category: 'copropriete_fr' },
    { id: 'sondages_fr', emoji: '📊', label: 'Sondages', category: 'copropriete_fr' },
    { id: 'reservation_espaces_fr', emoji: '📅', label: 'Réservation espaces', category: 'copropriete_fr' },
    { id: 'signalements_fr', emoji: '🔧', label: 'Signalements', category: 'copropriete_fr' },
    // ── OUTILS FR ──
    { id: 'vote_correspondance', emoji: '🗳️', label: 'Vote correspondance', category: 'outils_fr' },
    { id: 'pv_assemblee_ia', emoji: '📝', label: 'PV d\'AG assisté IA', category: 'outils_fr' },
    { id: 'appels_fonds', emoji: '💰', label: 'Appels de fonds', category: 'outils_fr' },
    { id: 'mise_en_concurrence', emoji: '📋', label: 'Mise en concurrence', category: 'outils_fr' },
    { id: 'recouvrement_enrichi_fr', emoji: '⚖️', label: 'Recouvrement enrichi', category: 'outils_fr' },
    { id: 'irve_bornes', emoji: '🔌', label: 'IRVE / Bornes VE', category: 'outils_fr' },
    { id: 'suivi_energetique_fr', emoji: '📈', label: 'Suivi énergétique', category: 'outils_fr' },
    { id: 'ged_certifiee', emoji: '🗄️', label: 'GED certifiée', category: 'outils_fr' },
    // ── BILINGUES (FR + PT) ──
    { id: 'saisie_ia_factures', emoji: '🤖', label: locale === 'pt' ? 'Lançamento IA Faturas' : 'Saisie IA Factures', category: 'outils_ia' },
    { id: 'communication_demat', emoji: '📱', label: locale === 'pt' ? 'Comunicação digital' : 'Communication démat.', category: 'outils_ia' },
    // ── GESTÃO CONDÓMINOS (PT) ──
    { id: 'portal_condomino', emoji: '🏠', label: 'Portal do Condómino', category: 'condominios_pt' },
    { id: 'quadro_avisos', emoji: '📌', label: 'Quadro de Avisos', category: 'condominios_pt' },
    { id: 'enquetes', emoji: '📊', label: 'Enquetes', category: 'condominios_pt' },
    { id: 'reserva_espacos', emoji: '📅', label: 'Reserva Espaços', category: 'condominios_pt' },
    { id: 'ocorrencias', emoji: '🔧', label: 'Ocorrências', category: 'condominios_pt' },
    { id: 'whatsapp_condominos', emoji: '📱', label: 'WhatsApp/SMS', category: 'condominios_pt' },
    // ── FERRAMENTAS PT ──
    { id: 'relatorio_gestao', emoji: '📄', label: 'Relatório de Gestão', category: 'ferramentas_pt' },
    { id: 'preparador_assembleia', emoji: '📝', label: 'Preparador Assembleia', category: 'ferramentas_pt' },
    { id: 'plano_manutencao', emoji: '🏗️', label: 'Plano Manutenção', category: 'ferramentas_pt' },
    { id: 'vistoria_tecnica', emoji: '📋', label: 'Vistoria Técnica', category: 'ferramentas_pt' },
    { id: 'pontuacao_saude', emoji: '🏥', label: 'Pontuação Saúde', category: 'ferramentas_pt' },
    { id: 'orcamento_anual_ia', emoji: '🤖', label: 'Orçamento IA', category: 'ferramentas_pt' },
    { id: 'contacto_proativo_ia', emoji: '📡', label: 'Contacto Proativo', category: 'ferramentas_pt' },
    { id: 'ocorrencias_ia', emoji: '🤖', label: 'Ocorrências IA', category: 'ferramentas_pt' },
    { id: 'gestao_seguros', emoji: '🛡️', label: 'Gestão Seguros', category: 'ferramentas_pt' },
    { id: 'checklists_ia', emoji: '📋', label: 'Checklists IA', category: 'ferramentas_pt' },
    { id: 'processamentos_lote', emoji: '⚙️', label: 'Processamentos Lote', category: 'ferramentas_pt' },
    { id: 'ag_live_digital', emoji: '🏛️', label: 'AG Live Digital', category: 'ferramentas_pt' },
    { id: 'marketplace_artisans', emoji: '🏪', label: 'Marketplace Profissionais', category: 'ferramentas_pt' },
    { id: 'predicao_manutencao', emoji: '🤖', label: 'Predição Manutenção', category: 'ferramentas_pt' },
    { id: 'qrcode_fracao', emoji: '📱', label: 'QR Code Fração', category: 'ferramentas_pt' },
    { id: 'dashboard_condomino_rt', emoji: '👥', label: 'Dashboard Condómino', category: 'ferramentas_pt' },
    { id: 'comparador_energia', emoji: '⚡', label: 'Comparador Energia', category: 'ferramentas_pt' },
    { id: 'assinatura_cmd', emoji: '✍️', label: 'Assinatura CMD', category: 'ferramentas_pt' },
    { id: 'dashboard_multi_immeubles', emoji: '🏘️', label: 'Multi-Imóveis', category: 'ferramentas_pt' },
    { id: 'efatura_at', emoji: '🧾', label: 'e-Fatura AT', category: 'ferramentas_pt' },
    { id: 'votacao_online', emoji: '🗳️', label: 'Votação Online', category: 'ferramentas_pt' },
    { id: 'atas_ia', emoji: '📝', label: 'Atas com IA', category: 'ferramentas_pt' },
    { id: 'pagamentos_digitais', emoji: '💳', label: 'Pagamentos Digitais', category: 'ferramentas_pt' },
    { id: 'mapa_quotas', emoji: '💰', label: 'Mapa de Quotas', category: 'ferramentas_pt' },
    { id: 'orcamentos_obras', emoji: '📋', label: '3 Orçamentos', category: 'ferramentas_pt' },
    { id: 'cobranca_judicial', emoji: '⚖️', label: 'Cobrança Judicial', category: 'ferramentas_pt' },
    { id: 'carregamento_ve', emoji: '⚡', label: 'Carregamento VE', category: 'ferramentas_pt' },
    { id: 'monitorizacao_consumos', emoji: '📈', label: 'Monitorização', category: 'ferramentas_pt' },
    { id: 'arquivo_digital', emoji: '🗄️', label: 'Arquivo Digital', category: 'ferramentas_pt' },
    // ── AGENTS IA ──
    { id: 'fixy_agent' as const, emoji: '🤖', label: 'Fixy', category: 'agents_ia' },
    { id: 'max_agent' as const, emoji: '🎓', label: 'Max', category: 'agents_ia' },
    { id: 'lea_agent' as const, emoji: '👩‍💼', label: 'Léa', category: 'agents_ia' },
    // ── OUTILS IA ──
    { id: 'emails', emoji: '📧', label: t('syndicDash.sidebar.fixySyndicEmails'), category: 'outils_ia' },
    { id: 'ia', emoji: '🎓', label: t('syndicDash.sidebar.maxExpert'), category: 'outils_ia' },
    // ── COMPTE ──
    { id: 'equipe', emoji: '👤', label: t('syndicDash.sidebar.myTeam'), category: 'gestion' },
    { id: 'modules', emoji: '🧩', label: t('syndicDash.sidebar.myModules'), category: 'compte' },
    { id: 'parametres', emoji: '⚙️', label: t('syndicDash.sidebar.settings'), category: 'compte' },
  ]
  const ALWAYS_VISIBLE = ['accueil', 'immeubles', 'artisans', 'coproprios', 'alertes', 'equipe', 'parametres', 'modules', 'documents']
  const navOrder = getNavOrder()

  const navItems = allNavItems
    .filter(item => {
      // Locale-based filtering: hide FR-only modules for PT users and vice-versa
      if (locale === 'pt' && (item.category === 'copropriete_fr' || item.category === 'outils_fr')) return false
      if (locale === 'fr' && (item.category === 'condominios_pt' || item.category === 'ferramentas_pt' || item.category === 'obrigacoes')) return false
      if (!allowedPages.includes(item.id)) return false
      if (ALWAYS_VISIBLE.includes(item.id)) return true
      return isModuleEnabled(item.id)
    })
    .sort((a, b) => {
      // Ordre 100% personnalisé — s'applique à tous les items sans exception
      const aIdx = navOrder.indexOf(a.id)
      const bIdx = navOrder.indexOf(b.id)
      if (aIdx === -1 && bIdx === -1) return 0
      if (aIdx === -1) return 1
      if (bIdx === -1) return -1
      return aIdx - bIdx
    })

  const totalBudget = immeubles.reduce((a, i) => a + i.budgetAnnuel, 0)
  const totalDepenses = immeubles.reduce((a, i) => a + i.depensesAnnee, 0)

  const isAdminOverride = user?.app_metadata?.role === 'super_admin'

  // ── Page-level loading: wait for auth + initial data before rendering ──
  if (!user || !dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F7F4EE' }}>
        <div className="text-center">
          <div className="inline-flex items-center gap-3 px-6 py-4 bg-white rounded-2xl shadow-sm">
            <div className="w-5 h-5 border-2 border-[#FFC107] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-gray-600">Chargement du tableau de bord…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div id="syndic-dashboard" className="flex h-screen bg-[#F7F4EE] overflow-hidden">

      {/* Bouton Retour Admin retiré : privilege escalation via user_metadata.
          Le super_admin navigue directement sur /admin/dashboard. */}

      {/* ── SIDEBAR ── */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        page={page}
        setPage={setPage}
        navItems={navItems}
        sidebarCategories={SIDEBAR_CATEGORIES}
        userRole={userRole}
        userName={userName}
        initials={initials}
        handleLogout={handleLogout}
      />

      {/* ── CONTENU PRINCIPAL ── */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--sd-cream)' }}>
        {/* Topbar */}
        <Header
          page={page}
          setPage={setPage}
          navItems={navItems}
          companyName={companyName}
          alertes={alertes}
          notifs={notifs}
          notifUnread={notifUnread}
          notifPanelOpen={notifPanelOpen}
          setNotifPanelOpen={setNotifPanelOpen}
          notifLoading={notifLoading}
          markAllNotifsRead={markAllNotifsRead}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className={page === 'canal' ? '' : 'p-6'}>

          {/* ── ACCUEIL ── */}
          {page === 'accueil' && (
            <AccueilSection
              immeubles={immeubles} missions={missions} artisans={artisans} alertes={alertes}
              totalBudget={totalBudget} totalDepenses={totalDepenses}
              locale={locale} userName={userName} t={t}
              setPage={setPage} setSelectedMission={setSelectedMission} setShowMissionDetails={setShowMissionDetails}
            />
          )}

          {/* ── IMMEUBLES ── */}
          {page === 'immeubles' && (
            <ImmeublesPageSection
              immeubles={immeubles} setImmeubles={setImmeubles}
              locale={locale} t={t} user={user}
              setPage={setPage} setShowModalMission={setShowModalMission}
              getAdminToken={getAdminToken} enregistrerBatiment={enregistrerBatiment}
            />
          )}

          {/* ── ARTISANS ── */}
          {page === 'artisans' && (
            <ArtisansPageSection
              artisans={artisans} setArtisans={setArtisans}
              user={user} locale={locale} t={t}
              getAdminToken={getAdminToken} setShowModalMission={setShowModalMission}
            />
          )}

          {/* ── MISSIONS ── */}
          {page === 'missions' && (
            <MissionsPageSection
              missions={missions} setMissions={setMissions}
              artisans={artisans} immeubles={immeubles}
              locale={locale} t={t} user={user} setPage={setPage}
              showModalMission={showModalMission} setShowModalMission={setShowModalMission}
              selectedMission={selectedMission} setSelectedMission={setSelectedMission}
              showMissionDetails={showMissionDetails} setShowMissionDetails={setShowMissionDetails}
            />
          )}

          {/* ── CANAL COMMUNICATIONS ── */}
          {page === 'canal' && (
            <CanalCommunicationsPage
              missions={missions}
              artisans={artisans}
              userRole={userRole}
              user={user}
              onUpdateMission={(updated) => {
                setMissions(prev => prev.map(m => m.id === updated.id ? updated : m))
                try {
                  const stored = JSON.parse(localStorage.getItem(`fixit_syndic_missions_${user?.id}`) || '[]')
                  const newStored = stored.map((m: Mission) => m.id === updated.id ? updated : m)
                  if (!newStored.find((m: Mission) => m.id === updated.id)) newStored.unshift(updated)
                  localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(newStored))
                } catch {}
              }}
              onAddMission={(newM) => {
                setMissions(prev => {
                  const updated = [newM, ...prev]
                  try { localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(updated)) } catch {}
                  return updated
                })
              }}
              onOpenMission={(m) => { setSelectedMission(m); setShowMissionDetails(true) }}
              onCreateMission={() => setShowModalMission(true)}
              canalInterneMessages={canalInterneMessages}
              setCanalInterneMessages={setCanalInterneMessages}
              canalInterneInput={canalInterneInput}
              setCanalInterneInput={setCanalInterneInput}
              canalInterneType={canalInterneType}
              setCanalInterneType={setCanalInterneType}
              canalPlanDate={canalPlanDate}
              setCanalPlanDate={setCanalPlanDate}
              canalPlanHeure={canalPlanHeure}
              setCanalPlanHeure={setCanalPlanHeure}
              canalPlanResident={canalPlanResident}
              setCanalPlanResident={setCanalPlanResident}
              canalPlanResidence={canalPlanResidence}
              setCanalPlanResidence={setCanalPlanResidence}
              canalTacheAssignee={canalTacheAssignee}
              setCanalTacheAssignee={setCanalTacheAssignee}
              canalTachePriorite={canalTachePriorite}
              setCanalTachePriorite={setCanalTachePriorite}
              onSendCanalInterne={sendCanalInterne}
              onMarkCanalInterneRead={async () => {
                setCanalInterneMessages(prev => prev.map(m => ({ ...m, lu: true })))
                try {
                  const token = await getAdminToken()
                  if (token) {
                    await fetch('/api/syndic/canal-interne', {
                      method: 'PATCH',
                      headers: { 'Authorization': `Bearer ${token}` },
                    })
                  }
                } catch {}
              }}
              userName={userName}
              onAddPlanningEvent={(evt) => setPlanningEvents(prev => [...prev, evt])}
            />
          )}

          {/* ── PLANNING ── */}
          {page === 'planning' && (
            <PlanningSectionPage
              planningEvents={planningEvents} setPlanningEvents={setPlanningEvents}
              teamMembers={teamMembers} locale={locale} t={t}
              user={user} immeubles={immeubles} userRole={userRole}
              getAdminToken={getAdminToken}
            />
          )}

          {/* ── DOCUMENTS GED ── */}
          {page === 'documents' && <GEDSection immeubles={immeubles} artisans={artisans} userId={user?.id} />}

          {/* ── FACTURATION ── */}
          {page === 'facturation' && (
            <FacturationPageWithTransferts missions={missions} user={user} userRole={userRole} onOpenMission={(m) => { setSelectedMission(m); setShowMissionDetails(true) }} />
          )}

          {/* ── COPROPRIÉTAIRES ── */}
          {page === 'coproprios' && <CopropriosSection immeubles={immeubles} userId={user?.id} />}

          {/* ── CALENDRIER RÉGLEMENTAIRE ── */}
          {page === 'reglementaire' && <CalendrierReglementaireSection immeubles={immeubles} userId={user?.id} />}

          {/* ── RAPPORT MENSUEL ── */}
          {page === 'rapport' && user && (
            <RapportMensuelSection
              immeubles={immeubles}
              missions={missions}
              artisans={artisans}
              syndicId={user.id}
              coproprios={coproprios}
            />
          )}

          {/* ── ALERTES ── */}
          {page === 'alertes' && (
            <AlertesSection
              alertes={alertes} locale={locale} t={t}
              onTraiterAlerte={handleTraiterAlerte}
            />
          )}

          {/* ── EMAILS MAX IA ── */}
          {page === 'emails' && user && <EmailsSection syndicId={user.id} onNavigateParams={() => setPage('parametres')} />}

          {/* ── MAX EXPERT-CONSEIL ── */}
          {page === 'ia' && (
            <MaxExpertSection
              maxMessages={maxMessages}
              maxInput={maxInput}
              setMaxInput={setMaxInput}
              maxLoading={maxLoading}
              maxTab={maxTab}
              setMaxTab={setMaxTab}
              maxFavorites={maxFavorites}
              setMaxFavorites={setMaxFavorites}
              maxSelectedImmeuble={maxSelectedImmeuble}
              setMaxSelectedImmeuble={setMaxSelectedImmeuble}
              maxEndRef={maxEndRef}
              sendMaxMessage={sendMaxMessage}
              setFixyPanelOpen={setFixyPanelOpen}
              setMaxMessages={setMaxMessages}
              immeubles={immeubles}
              userId={user?.id}
              parseDocPDF={parseDocPDF}
              buildSyndicContext={buildSyndicContext}
              buildConformiteChecklist={buildConformiteChecklist}
              setPendingDocData={setPendingDocData}
              setPdfObjet={setPdfObjet}
              setPdfSelectedImmeuble={setPdfSelectedImmeuble}
              setPdfSelectedCopro={setPdfSelectedCopro}
              setShowPdfModal={setShowPdfModal}
            />
          )}

          {/* ── AGENTS IA ── */}
          {page === 'fixy_agent' && user && <FixyAgentPage user={user} />}
          {page === 'max_agent' && user && <MaxAgentPage user={user} />}
          {page === 'lea_agent' && user && <LeaAgentPage user={user} />}

          {/* ── MON ÉQUIPE ── */}
          {page === 'compta_copro' && user && <ComptaCoproSection user={user} userRole={userRole} immeubles={immeubles} />}

          {page === 'ag_digitale' && user && <AGDigitaleSection user={user} userRole={userRole} getToken={getAdminToken} />}
          {page === 'impayés' && user && <ImpayésSection user={user} userRole={userRole} getToken={getAdminToken} coproprios={coproprios} />}
          {page === 'carnet_entretien' && user && <CarnetEntretienSection user={user} userRole={userRole} />}
          {page === 'sinistres' && user && <SinistresSection user={user} userRole={userRole} artisans={artisans} />}
          {page === 'extranet' && user && <ExtranetSection user={user} userRole={userRole} />}
          {page === 'pppt' && user && <PPPTSection user={user} userRole={userRole} />}
          {page === 'historique_immeuble' && user && <HistoriqueImmeubleSection user={user} userRole={userRole} />}
          {page === 'urgences' && user && <UrgencesSection user={user} userRole={userRole} artisans={artisans} />}
          {page === 'dpe_collectif' && user && <DPECollectifSection user={user} userRole={userRole} />}
          {page === 'visite_technique' && user && <VisiteTechniqueSection user={user} userRole={userRole} />}
          {page === 'declaracao_encargos' && user && <DeclaracaoEncargosSection user={user} userRole={userRole} />}
          {page === 'seguro_condominio' && user && <SeguroCondominioSection user={user} userRole={userRole} />}
          {page === 'fundo_reserva' && user && <FundoReservaSection user={user} userRole={userRole} />}

          {/* ── NOVOS MÓDULOS PT ── */}
          {page === 'votacao_online' && user && <VotacaoOnlineSection user={user} userRole={userRole} />}
          {page === 'portal_condomino' && user && <PortalCondominoSection user={user} userRole={userRole} />}
          {page === 'pagamentos_digitais' && user && <PagamentosDigitaisSection user={user} userRole={userRole} />}
          {page === 'carregamento_ve' && user && <CarregamentoVESection user={user} userRole={userRole} />}
          {page === 'reserva_espacos' && user && <ReservaEspacosSection user={user} userRole={userRole} />}
          {page === 'ocorrencias' && user && <OcorrenciasSection user={user} userRole={userRole} />}
          {page === 'enquetes' && user && <EnquetesSection user={user} userRole={userRole} />}
          {page === 'quadro_avisos' && user && <QuadroAvisosSection user={user} userRole={userRole} />}
          {page === 'atas_ia' && user && <AtasIASection user={user} userRole={userRole} />}
          {page === 'mapa_quotas' && user && <MapaQuotasSection user={user} userRole={userRole} />}
          {page === 'orcamentos_obras' && user && <OrcamentosObrasSection user={user} userRole={userRole} />}
          {page === 'cobranca_judicial' && user && <CobrancaJudicialSection user={user} userRole={userRole} />}
          {page === 'monitorizacao_consumos' && user && <MonitorizacaoConsumosSection user={user} userRole={userRole} />}
          {page === 'whatsapp_condominos' && user && <WhatsAppCondominosSection user={user} userRole={userRole} />}
          {page === 'arquivo_digital' && user && <ArquivoDigitalSection user={user} userRole={userRole} />}

          {/* ═══ Novos Módulos PT (obrigações/ferramentas) ═══ */}
          {page === 'obrigacoes_legais' && user && <ObrigacoesLegaisSection user={user} userRole={userRole} />}
          {page === 'relatorio_gestao' && user && <RelatorioGestaoSection user={user} userRole={userRole} />}
          {page === 'preparador_assembleia' && user && <PreparadorAssembleiaSection user={user} userRole={userRole} />}
          {page === 'plano_manutencao' && user && <PlanoManutencaoSection user={user} userRole={userRole} />}
          {page === 'certificacao_energetica' && user && <CertificacaoEnergeticaSection user={user} userRole={userRole} />}
          {page === 'vistoria_tecnica' && user && <VistoriaTecnicaPTSection user={user} userRole={userRole} />}
          {page === 'pontuacao_saude' && user && <PontuacaoSaudeSection user={user} userRole={userRole} />}
          {page === 'orcamento_anual_ia' && user && <OrcamentoAnualIASection user={user} userRole={userRole} />}
          {page === 'contacto_proativo_ia' && user && <ContactoProativoIASection user={user} userRole={userRole} />}
          {page === 'ocorrencias_ia' && user && <OcorrenciasIASection user={user} userRole={userRole} />}
          {page === 'gestao_seguros' && user && <GestaoSegurosSection user={user} userRole={userRole} />}
          {page === 'checklists_ia' && user && <ChecklistsIASection user={user} userRole={userRole} />}
          {page === 'processamentos_lote' && user && <ProcessamentosLoteSection user={user} userRole={userRole} />}
          {page === 'ag_live_digital' && user && <AGLiveDigitalSection user={user} userRole={userRole} />}
          {page === 'marketplace_artisans' && user && <MarketplaceArtisansSection user={user} userRole={userRole} />}
          {page === 'predicao_manutencao' && user && <PredicaoManutencaoSection user={user} userRole={userRole} />}
          {page === 'qrcode_fracao' && user && <QRCodeFracaoSection user={user} userRole={userRole} />}
          {page === 'dashboard_condomino_rt' && user && <DashboardCondominoRTSection user={user} userRole={userRole} />}
          {page === 'comparador_energia' && user && <ComparadorEnergiaSection user={user} userRole={userRole} />}
          {page === 'assinatura_cmd' && user && <AssinaturaCMDSection user={user} userRole={userRole} />}
          {page === 'dashboard_multi_immeubles' && user && <DashboardMultiImmeublesSection user={user} userRole={userRole} />}
          {page === 'efatura_at' && user && <EFaturaATSection user={user} userRole={userRole} />}
          {page === 'infractions' && user && <InfractionsSection user={user} userRole={userRole} />}
          {page === 'reconciliation_bancaire' && user && <ReconciliationBancaireSection user={user} userRole={userRole} />}
          {page === 'benchmarking' && user && <BenchmarkingSection user={user} userRole={userRole} />}
          {page === 'chatbot_whatsapp' && user && <ChatbotWhatsAppSection user={user} userRole={userRole} />}

          {/* ═══ FR Modules ═══ */}
          {page === 'vote_correspondance' && user && <VoteCorrespondanceSection user={user} userRole={userRole} />}
          {page === 'extranet_enrichi' && user && <ExtranetEnrichiSection user={user} userRole={userRole} />}
          {page === 'irve_bornes' && user && <IRVESection user={user} userRole={userRole} />}
          {page === 'saisie_ia_factures' && user && <SaisieIAFacturesSection user={user} userRole={userRole} />}
          {page === 'reservation_espaces_fr' && user && <ReservationEspacesFRSection user={user} userRole={userRole} />}
          {page === 'signalements_fr' && user && <SignalementsFRSection user={user} userRole={userRole} />}
          {page === 'sondages_fr' && user && <SondagesFRSection user={user} userRole={userRole} />}
          {page === 'panneau_affichage' && user && <PanneauAffichageSection user={user} userRole={userRole} />}
          {page === 'pv_assemblee_ia' && user && <PVAssembleeIASection user={user} userRole={userRole} />}
          {page === 'appels_fonds' && user && <AppelsFondsSection user={user} userRole={userRole} />}
          {page === 'mise_en_concurrence' && user && <MiseEnConcurrenceSection user={user} userRole={userRole} />}
          {page === 'recouvrement_enrichi_fr' && user && <RecouvrementEnrichiFRSection user={user} userRole={userRole} />}
          {page === 'suivi_energetique_fr' && user && <SuiviEnergetiqueFRSection user={user} userRole={userRole} />}
          {page === 'communication_demat' && user && <CommunicationDematFRSection user={user} userRole={userRole} />}
          {page === 'ged_certifiee' && user && <GEDCertifieeFRSection user={user} userRole={userRole} />}

          {page === 'pointage' && user && <PointageSection immeubles={immeubles} user={user} onUpdateImmeuble={async (updated: Immeuble) => {
            // 1. Mise à jour React state (+ localStorage via useEffect)
            setImmeubles(prev => prev.map(i => i.id === updated.id ? updated : i))
            // 2. Sync vers Supabase (latitude, longitude, geolocActivee, rayonDetection)
            try {
              const token = await getAdminToken()
              if (token) {
                await fetch('/api/syndic/immeubles', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({
                    id: updated.id,
                    latitude: updated.latitude || null,
                    longitude: updated.longitude || null,
                    geolocActivee: !!updated.geolocActivee,
                    rayonDetection: updated.rayonDetection || 150,
                  }),
                })
              }
            } catch { /* silencieux — localStorage fait office de fallback */ }
          }} />}

          {page === 'echéances' && user && <EcheancesSection user={user} userRole={userRole} immeubles={immeubles} />}
          {page === 'recouvrement' && user && <RecouvrementSection user={user} userRole={userRole} />}
          {page === 'preparateur_ag' && user && <PreparateurAGSection user={user} userRole={userRole} immeubles={immeubles} />}

          {page === 'equipe' && user && (
            <EquipeSection
              cabinetId={user.id}
              currentUserRole={userRole}
              rolePages={ROLE_PAGES}
              modulesList={allNavItems.filter(n => n.id !== 'modules' && n.id !== 'accueil' && n.id !== 'parametres').map(n => ({ key: n.id, label: n.label, emoji: n.emoji, category: n.category }))}
            />
          )}

          {/* ── COMPTABILITÉ TECHNIQUE ── */}
          {page === 'comptabilite_tech' && user && (
            <ComptabiliteTechSection missions={missions} artisans={artisans} immeubles={immeubles} />
          )}

          {/* ── ANALYSE DEVIS / FACTURES ── */}
          {page === 'analyse_devis' && (
            <AnalyseDevisSection artisans={artisans} setPage={setPage} missions={missions} setMissions={setMissions} user={user} />
          )}

          {/* ── DOCUMENTS INTERVENTIONS ── */}
          {page === 'docs_interventions' && (
            <DocsInterventionsSection artisans={artisans} setPage={setPage} />
          )}

          {/* ── MODULES ── */}
          {page === 'modules' && (
            <ModulesPageSection
              locale={locale} t={t} userRole={userRole}
              isModuleEnabled={isModuleEnabled} toggleModule={toggleModule}
              saveNavOrder={saveNavOrder} moveNavItemUp={moveNavItemUp} moveNavItemDown={moveNavItemDown}
              allNavItems={allNavItems} navItems={navItems} sidebarCategories={SIDEBAR_CATEGORIES}
            />
          )}

          {/* ── PARAMÈTRES ── */}
          {page === 'parametres' && (
            <ParametresPageSection
              user={user} locale={locale} t={t} userRole={userRole}
              userName={userName} initials={initials}
              cabinetNom={cabinetNom} setCabinetNom={setCabinetNom}
              cabinetEmail={cabinetEmail} setCabinetEmail={setCabinetEmail}
              cabinetAddress={cabinetAddress} setCabinetAddress={setCabinetAddress}
              cabinetLogo={cabinetLogo} setCabinetLogo={setCabinetLogo}
              syndicSignature={syndicSignature} setSyndicSignature={setSyndicSignature}
              showSignatureModal={showSignatureModal} setShowSignatureModal={setShowSignatureModal}
            />
          )}

        </div>
      </main>

      {/* Modal Nouvelle Mission */}
      {showModalMission && (
        <ModalNouveilleMission
          onClose={() => setShowModalMission(false)}
          batimentsConnus={batimentsConnus}
          artisans={artisans}
          coproprios={coproprios}
          onAdd={async (m: Partial<Mission> & Record<string, unknown>) => {
            // Mémoriser le bâtiment saisi
            if (m.immeuble?.trim()) enregistrerBatiment(m.immeuble)
            const missionId = Date.now().toString()
            const newMission: Mission = { ...m, id: missionId, statut: 'en_attente', dateCreation: new Date().toISOString().split('T')[0] } as Mission
            setMissions(prev => {
              const updated = [newMission, ...prev]
              try { localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(updated)) } catch {}
              return updated
            })
            // Sync Supabase
            try {
              const token = await getAdminToken()
              if (token) {
                const res = await fetch('/api/syndic/missions', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify(newMission),
                })
                if (res.ok) {
                  const { mission } = await res.json()
                  if (mission?.id) setMissions(prev => prev.map(mi => mi.id === missionId ? { ...mi, id: mission.id } : mi))
                }
              }
            } catch { /* silencieux */ }

            // ── Notification au demandeur (canal copropriétaire) ──
            if (m.demandeurEmail || m.locataire) {
              const demandeurKey = `canal_demandeur_${(String(m.demandeurEmail || m.locataire || '')).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
              const now = new Date()
              const dateIntervStr = m.dateIntervention
                ? new Date(m.dateIntervention).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : null
              const heureStr = (m.heureIntervention as string) || null
              const notifMsg = {
                id: Date.now().toString(),
                date: now.toISOString(),
                type: 'mission_traitee',
                texte: `✅ Votre demande a bien été prise en charge.\n\n📋 Mission : ${m.type || 'Intervention'}\n🔧 Artisan : ${m.artisan || 'En cours d\'assignation'}${dateIntervStr ? `\n📅 Intervention prévue le : ${dateIntervStr}${heureStr ? ` à ${heureStr}` : ''}` : '\n📅 Date d\'intervention : en cours de planification'}\n\nVous serez informé(e) de l'évolution de la mission via ce canal.`,
                missionId,
                artisan: m.artisan,
                dateIntervention: m.dateIntervention,
              }
              try {
                const existing = JSON.parse(localStorage.getItem(demandeurKey) || '[]')
                existing.unshift(notifMsg)
                localStorage.setItem(demandeurKey, JSON.stringify(existing))
              } catch {}
            }

            // ── Canal artisan : créer/mettre à jour la file des ordres de mission ──
            if (m.artisan) {
              const artisanKey = `canal_artisan_${m.artisan.replace(/\s+/g, '_').toLowerCase()}`
              try {
                const artisanMissions = JSON.parse(localStorage.getItem(artisanKey) || '[]')
                artisanMissions.unshift({ ...newMission, id: missionId })
                localStorage.setItem(artisanKey, JSON.stringify(artisanMissions))
              } catch {}
            }

            // ── Envoyer l'ordre de mission dans la messagerie Supabase de l'artisan ──
            if (m.artisan) {
              try {
                const token = await getAdminToken()
                if (token) {
                  const artisanObj = artisans.find(a => a.nom === m.artisan || `${a.prenom || ''} ${a.nom}`.trim() === m.artisan)
                  const assignRes = await fetch('/api/syndic/assign-mission', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                      artisan_name: m.artisan,
                      artisan_email: artisanObj?.email || '',
                      artisan_user_id: artisanObj?.artisan_user_id || undefined,
                      description: m.description || m.type || 'Mission',
                      type_travaux: m.type || 'Intervention',
                      date_intervention: m.dateIntervention || undefined,
                      immeuble: m.immeuble || '',
                      adresse: (m.adresseImmeuble as string) || '',
                      priorite: m.priorite || 'normale',
                      notes: m.locataire ? `Locataire : ${m.locataire}` : '',
                    }),
                  })
                  const assignData = await assignRes.json().catch(() => ({}))
                  console.info('[SYNDIC onAdd] assign-mission status:', assignRes.status, assignData)
                  if (assignRes.status === 401) {
                    // Session expirée ou conflit de compte — recharger
                    toast.error(locale === 'pt' ? 'Sessão expirada. Atualize a página e reconecte-se como administrador síndico.' : 'Session expirée. Veuillez actualiser la page et vous reconnecter en tant qu\'administrateur syndic.')
                  } else if (!assignData.artisan_found) {
                    if (process.env.NODE_ENV !== 'production') console.warn('[SYNDIC onAdd] Artisan non trouvé en base :', m.artisan, assignData)
                  }
                }
              } catch (err) { if (process.env.NODE_ENV !== 'production') console.error('[SYNDIC onAdd] assign-mission failed:', err) }
            }
          }}
        />
      )}

      {/* ── Modal Détails Mission ── */}
      {showMissionDetails && selectedMission && (
        <MissionDetailsModal
          mission={selectedMission}
          onClose={() => setShowMissionDetails(false)}
          onUpdate={(updated) => {
            setMissions(prev => prev.map(m => m.id === updated.id ? updated : m))
            setSelectedMission(updated)
            // Persist to localStorage
            const stored = JSON.parse(localStorage.getItem(`fixit_syndic_missions_${user?.id}`) || '[]')
            const newStored = stored.map((m: Mission) => m.id === updated.id ? updated : m)
            if (!newStored.find((m: Mission) => m.id === updated.id)) newStored.push(updated)
            localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(newStored))
          }}
          onValider={() => { handleValiderMission(selectedMission.id); setShowMissionDetails(false) }}
          userRole={userRole}
        />
      )}

      {/* ── Modal Ajout Événement Planning ── */}
      {showPlanningModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPlanningModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-800">{locale === 'pt' ? 'Novo evento' : 'Nouvel événement'}</h3>
                {selectedPlanningDay && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(selectedPlanningDay + 'T12:00:00').toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                )}
              </div>
              <button onClick={() => setShowPlanningModal(false)} aria-label={t('syndicDash.common.close')} className="text-gray-500 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              {/* Titre */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{locale === 'pt' ? 'Título *' : 'Titre *'}</label>
                <input
                  type="text"
                  value={planningEventForm.titre}
                  onChange={e => setPlanningEventForm(f => ({ ...f, titre: e.target.value }))}
                  placeholder={locale === 'pt' ? 'Ex: Visita Sra. Silva, Reunião CA...' : 'Ex : Visite Mme Dupont, Réunion CA...'}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* Type + Heure */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{locale === 'pt' ? 'Tipo' : 'Type'}</label>
                  <select
                    value={planningEventForm.type}
                    onChange={e => setPlanningEventForm(f => ({ ...f, type: e.target.value as PlanningEvent['type'] }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="visite">{locale === 'pt' ? 'Visita' : 'Visite'}</option>
                    <option value="reunion">{locale === 'pt' ? 'Reunião' : 'Réunion'}</option>
                    <option value="rdv">{locale === 'pt' ? 'Reunião' : 'Rendez-vous'}</option>
                    <option value="tache">{locale === 'pt' ? 'Tarefa' : 'Tâche'}</option>
                    <option value="autre">{locale === 'pt' ? 'Outro' : 'Autre'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{locale === 'pt' ? 'Hora' : 'Heure'}</label>
                  <input
                    type="time"
                    value={planningEventForm.heure}
                    onChange={e => setPlanningEventForm(f => ({ ...f, heure: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Durée */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{locale === 'pt' ? 'Duração' : 'Durée'}</label>
                <select
                  value={planningEventForm.dureeMin}
                  onChange={e => setPlanningEventForm(f => ({ ...f, dureeMin: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value={30}>30 {locale === 'pt' ? 'minutos' : 'minutes'}</option>
                  <option value={60}>1 {locale === 'pt' ? 'hora' : 'heure'}</option>
                  <option value={90}>1h30</option>
                  <option value={120}>2 {locale === 'pt' ? 'horas' : 'heures'}</option>
                  <option value={180}>3 {locale === 'pt' ? 'horas' : 'heures'}</option>
                </select>
              </div>

              {/* Assigné à — visible secrétaire / admin / syndic */}
              {(userRole === 'syndic' || userRole === 'syndic_admin' || userRole === 'syndic_secretaire') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{locale === 'pt' ? 'Atribuído a' : 'Assigné à'}</label>
                  <select
                    value={planningEventForm.assigneA}
                    onChange={e => setPlanningEventForm(f => ({ ...f, assigneA: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">{locale === 'pt' ? 'Eu mesmo' : 'Moi-même'} ({userName})</option>
                    {teamMembers.filter(m => m.full_name !== userName).map(m => (
                      <option key={m.id} value={m.full_name}>{m.full_name}{m.role ? ` (${getRoleLabel(m.role, locale)})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{locale === 'pt' ? 'Descrição' : 'Description'} <span className="text-gray-500 font-normal">{locale === 'pt' ? '(opcional)' : '(optionnel)'}</span></label>
                <textarea
                  value={planningEventForm.description}
                  onChange={e => setPlanningEventForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={locale === 'pt' ? 'Detalhes complementares...' : 'Détails complémentaires...'}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowPlanningModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
              >
                {locale === 'pt' ? 'Cancelar' : 'Annuler'}
              </button>
              <button
                onClick={addPlanningEvent}
                disabled={!planningEventForm.titre.trim() || planningAddLoading}
                className="flex-1 py-2.5 bg-[#0D1B2E] hover:bg-[#152338] text-white rounded-xl text-sm font-bold transition disabled:opacity-40 shadow-sm"
              >
                {planningAddLoading ? '…' : `✅ ${locale === 'pt' ? 'Adicionar' : 'Ajouter'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Fixy — Assistant d'Action (panneau flottant) ─── */}
      <FixyPanel
        user={user}
        fixyPanelOpen={fixyPanelOpen}
        setFixyPanelOpen={setFixyPanelOpen}
        iaMessages={iaMessages}
        setIaMessages={setIaMessages}
        iaInput={iaInput}
        setIaInput={setIaInput}
        iaLoading={iaLoading}
        iaPendingAction={iaPendingAction}
        iaEndRef={iaEndRef}
        iaVoiceActive={iaVoiceActive}
        iaVoiceSupported={iaVoiceSupported}
        iaSpeechEnabled={iaSpeechEnabled}
        iaSpeaking={iaSpeaking}
        iaVoiceDuration={iaVoiceDuration}
        iaVoiceInterim={iaVoiceInterim}
        iaVoiceHelp={iaVoiceHelp}
        setIaVoiceHelp={setIaVoiceHelp}
        iaVoiceConfidence={iaVoiceConfidence}
        sendIaMessage={sendIaMessage}
        handleConfirmIaAction={handleConfirmIaAction}
        handleCancelIaAction={handleCancelIaAction}
        speakResponse={speakResponse}
        startVoiceRecognition={startVoiceRecognition}
        toggleSpeechEnabled={toggleSpeechEnabled}
        stopVoiceRecognition={stopVoiceRecognition}
      />

      {/* ── Signature Modal ── */}
      {showSignatureModal && (
        <SignatureModal
          documentRef={`CABINET_${cabinetNom.replace(/\s/g, '_')}`}
          signataire={userName}
          onClose={() => setShowSignatureModal(false)}
          onSign={(sigData: SignatureData) => {
            setSyndicSignature(sigData)
            if (user) localStorage.setItem(`fixit_syndic_signature_${user.id}`, JSON.stringify(sigData))
            setShowSignatureModal(false)
          }}
        />
      )}

      {/* ── PDF Generation Modal ── */}
      <PDFGenerationModal
        showPdfModal={showPdfModal}
        pendingDocData={pendingDocData}
        pdfSelectedImmeuble={pdfSelectedImmeuble}
        setPdfSelectedImmeuble={setPdfSelectedImmeuble}
        pdfSelectedCopro={pdfSelectedCopro}
        setPdfSelectedCopro={setPdfSelectedCopro}
        pdfObjet={pdfObjet}
        setPdfObjet={setPdfObjet}
        pdfGenerating={pdfGenerating}
        setPdfGenerating={setPdfGenerating}
        setShowPdfModal={setShowPdfModal}
        setPage={setPage}
        immeubles={immeubles}
        coproprios={coproprios}
        cabinetLogo={cabinetLogo}
        syndicSignature={syndicSignature}
        generateMaxPDF={generateMaxPDF}
      />
    </div>
  )
}
