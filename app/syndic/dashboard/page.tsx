'use client'

import React, { useState, useEffect, useRef, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { POLL_MISSIONS, TOAST_SHORT, TOAST_DEFAULT } from '@/lib/constants'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import { MaxAvatar } from '@/components/common/RobotAvatars'
import { useTranslation, useLocale } from '@/lib/i18n/context'

// ─── Types (from shared types file) ──────────────────────────────────────────
import type {
  Page, Immeuble, Artisan, SyndicMessage, CanalInterneMsg, Mission,
  Alerte, PlanningEvent, Coproprio, EcheanceReglementaire,
} from '@/components/syndic-dashboard/types'
import {
  ROLE_COLORS, getRoleLabel,
  Badge, PrioriteBadge,
} from '@/components/syndic-dashboard/types'
import { ROLE_PAGES, SYNDIC_MODULES, EVENT_COLORS } from '@/components/syndic-dashboard/config'

// ─── Lazy-loaded Section Components (code-splitting) ─────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const d = (loader: () => Promise<any>) => dynamic(loader, { ssr: false })
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

// ─── Données démo ─────────────────────────────────────────────────────────────

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
  const [user, setUser] = useState<any>(null)
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
  // ── Immeuble management ─────────────────────────────────────────────────────
  const [showModalImmeuble, setShowModalImmeuble] = useState(false)
  const [editingImmeuble, setEditingImmeuble] = useState<Immeuble | null>(null)
  const [immeubleForm, setImmeubleForm] = useState<Partial<Immeuble>>({ nom: '', adresse: '', ville: '', codePostal: '', nbLots: 1, anneeConstruction: 2000, typeImmeuble: 'Copropriété', gestionnaire: '', budgetAnnuel: 0, depensesAnnee: 0, nbInterventions: 0 })
  // ── Missions filter ─────────────────────────────────────────────────────────
  const [missionsFilter, setMissionsFilter] = useState<'Toutes' | 'Urgentes' | 'En cours' | 'Terminées'>('Toutes')
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null)
  const [showMissionDetails, setShowMissionDetails] = useState(false)
  // ── Planning navigation ─────────────────────────────────────────────────────
  const [planningDate, setPlanningDate] = useState(new Date())
  const [planningEvents, setPlanningEvents] = useState<PlanningEvent[]>(PLANNING_EVENTS_DEMO)
  const [showPlanningModal, setShowPlanningModal] = useState(false)
  const [selectedPlanningDay, setSelectedPlanningDay] = useState<string | null>(null)
  const [planningViewFilter, setPlanningViewFilter] = useState('tous')
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
  const [syndicSignature, setSyndicSignature] = useState<{ svg_data: string; signataire: string; timestamp: string; document_ref: string; hash_sha256: string } | null>(null)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [notifSettings, setNotifSettings] = useState([
    { label: locale === 'pt' ? 'Alertas RC Pro expirados' : 'Alertes RC Pro expirées', checked: true },
    { label: locale === 'pt' ? 'Controlos regulamentares iminentes' : 'Contrôles réglementaires imminents', checked: true },
    { label: locale === 'pt' ? 'Novas missões criadas' : 'Nouvelles missions créées', checked: true },
    { label: locale === 'pt' ? 'Sinalizações de condóminos' : 'Signalements copropriétaires', checked: false },
    { label: locale === 'pt' ? 'Resumo semanal' : 'Résumé hebdomadaire', checked: true },
  ])
  const [paramSaved, setParamSaved] = useState(false)
  // ── PDF Modal ──────────────────────────────────────────────────────────────
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [pendingDocData, setPendingDocData] = useState<any>(null)
  const [pdfSelectedImmeuble, setPdfSelectedImmeuble] = useState('')
  const [pdfSelectedCopro, setPdfSelectedCopro] = useState<any>(null)
  const [pdfObjet, setPdfObjet] = useState('')
  const [pdfGenerating, setPdfGenerating] = useState(false)
  // ── Artisan management ──────────────────────────────────────────────────────
  const [showModalArtisan, setShowModalArtisan] = useState(false)
  const [artisanForm, setArtisanForm] = useState({ email: '', nom: '', prenom: '', telephone: '', metier: '', siret: '' })
  const [artisanSearchResult, setArtisanSearchResult] = useState<{ found: boolean; name?: string; role?: string } | null>(null)
  const [artisanSearchLoading, setArtisanSearchLoading] = useState(false)
  const [artisanSubmitting, setArtisanSubmitting] = useState(false)
  const [artisanError, setArtisanError] = useState('')
  const [artisanSuccess, setArtisanSuccess] = useState('')
  const [artisansLoaded, setArtisansLoaded] = useState(false)
  // ── Canal communication ─────────────────────────────────────────────────────
  const [selectedArtisanChat, setSelectedArtisanChat] = useState<Artisan | null>(null)
  const [messages, setMessages] = useState<SyndicMessage[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [msgLoading, setMsgLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [iaMessages, setIaMessages] = useState<{ role: 'user' | 'assistant'; content: string; action?: any; actionStatus?: 'pending' | 'confirmed' | 'cancelled' | 'error' }[]>([
    { role: 'assistant', content: 'Bonjour ! Je suis **Fixy** 🤖, votre assistant d\'action Vitfix Pro.\n\nJ\'ai accès à **toutes vos données en temps réel** et je peux **agir directement** : créer missions, naviguer, générer courriers, alertes...\n\n🎙️ Cliquez sur le micro pour les commandes vocales !\n\nQue puis-je faire pour vous ?' }
  ])
  const [iaInput, setIaInput] = useState('')
  const [iaLoading, setIaLoading] = useState(false)
  const [iaPendingAction, setIaPendingAction] = useState<{ action: any; iaToken: string } | null>(null)
  const iaEndRef = useRef<HTMLDivElement>(null)
  // ── Voice & Speech ─────────────────────────────────────────────────────────
  const [iaVoiceActive, setIaVoiceActive] = useState(false)
  const [iaVoiceSupported, setIaVoiceSupported] = useState(false)
  const [iaSpeechEnabled, setIaSpeechEnabled] = useState(false)
  const [iaSpeaking, setIaSpeaking] = useState(false)
  const iaRecognitionRef = useRef<any>(null)
  const iaSendTimerRef = useRef<any>(null)
  // ── Voice V2 — états enrichis ──────────────────────────────────────────────
  const [iaVoiceDuration, setIaVoiceDuration] = useState(0)
  const [iaVoiceInterim, setIaVoiceInterim] = useState('')
  const [iaVoiceHelp, setIaVoiceHelp] = useState(false)
  const [iaVoiceSendTrigger, setIaVoiceSendTrigger] = useState<string | null>(null)
  const [iaVoiceConfidence, setIaVoiceConfidence] = useState(0)
  const [iaAvailableVoices, setIaAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const iaVoiceDurationRef = useRef<any>(null)
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
  const [maxTab, setMaxTab] = useState<'chat' | 'conformite' | 'documents'>('chat')
  const [maxFavorites, setMaxFavorites] = useState<string[]>([])
  const [maxSelectedImmeuble, setMaxSelectedImmeuble] = useState<string>('all')
  const [fixyPanelOpen, setFixyPanelOpen] = useState(false)
  // ── Token admin isolé par onglet (résout le conflit de session multi-comptes) ──
  const adminSessionRef = useRef<{ access_token: string; refresh_token: string; expires_at: number } | null>(null)

  useEffect(() => {
    // Vérifier support Web Speech API
    if (typeof window !== 'undefined') {
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
      let errorCount = 0
      const MAX_CHANNEL_ERRORS = 3
      channel = supabase
        .channel(`syndic_notifs_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'syndic_notifications',
          filter: `syndic_id=eq.${user.id}`,
        }, (payload) => {
          const n = payload.new as any
          setNotifs(prev => [{ id: n.id, title: n.title, body: n.body, type: n.type, read: false, created_at: n.created_at }, ...prev])
        })
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') {
            errorCount++
            if (errorCount <= MAX_CHANNEL_ERRORS) {
              if (process.env.NODE_ENV !== 'production') console.warn(`[syndic/dashboard] Realtime channel error (${errorCount}/${MAX_CHANNEL_ERRORS}):`, err?.message)
            }
            if (errorCount >= MAX_CHANNEL_ERRORS) {
              if (process.env.NODE_ENV !== 'production') console.warn('[syndic/dashboard] Realtime disabled after repeated errors')
              if (channel) supabase.removeChannel(channel)
            }
          }
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
      const userRole = freshUser?.user_metadata?.role || ''
      const isAdminOverride = freshUser?.user_metadata?._admin_override === true
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
            const real = parsed.filter((m: any) =>
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
            const real = parsed.filter((i: any) =>
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
            const hasFake = parsed.some((m: any) =>
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
            const real = parsed.filter((e: any) => !FAKE_PERSON_NAMES.includes(e.assigneA))
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
            const mapped = (coprosData.coproprios || []).map((row: any) => ({
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
      } catch (e) { console.warn('[dashboard] coproprios load failed:', e) }

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
              const mappedEarly: Artisan[] = artDataEarly.artisans.map((a: any) => ({
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
              setArtisansLoaded(true)
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
            const fakeMissions = dbMissions.filter((m: any) => FAKE_BUILDING_NAMES_DB.includes(m.immeuble))
            const realMissions = dbMissions.filter((m: any) => !FAKE_BUILDING_NAMES_DB.includes(m.immeuble))
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
            const fakeImmeubles = dbImmeubles.filter((i: any) => FAKE_BUILDING_NAMES.includes(i.nom))
            const realImmeubles = dbImmeubles.filter((i: any) => !FAKE_BUILDING_NAMES.includes(i.nom))
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
              const noms = realImmeubles.map((i: any) => i.nom).filter(Boolean)
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
            const converted: CanalInterneMsg[] = dbMsgs.map((m: any) => {
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
          if (members) setTeamMembers(members.filter((m: any) => m.is_active !== false))
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
            const converted: CanalInterneMsg[] = dbMsgs.map((m: any) => {
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

  // ── Rafraîchir les artisans quand on ouvre la page artisans (force re-sync RC Pro etc.) ──
  useEffect(() => {
    if (page === 'artisans' && user) {
      fetchArtisans()
    }
  }, [page, user, artisansLoaded])

  const fetchArtisans = async () => {
    try {
      const token = await getAdminToken()
      const res = await fetch('/api/syndic/artisans', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.artisans && data.artisans.length > 0) {
          // Convertir format API → format Artisan local
          const mapped: Artisan[] = data.artisans.map((a: Artisan) => ({
            ...a,
            nom: a.nom || `${a.prenom || ''} ${a.nom_famille || ''}`.trim(),
            rcProValide: a.rc_pro_valide ?? a.rcProValide ?? false,
            rcProExpiration: a.rc_pro_expiration ?? a.rcProExpiration ?? '',
            nbInterventions: a.nb_interventions ?? a.nbInterventions ?? 0,
            vitfixCertifie: a.vitfix_certifie ?? a.vitfixCertifie ?? false,
          }))
          setArtisans(mapped)
        }
        setArtisansLoaded(true)
      }
    } catch { /* silencieux */ }
  }

  // ── Charger messages du canal de communication ────────────────────────────────
  const fetchMessages = async (artisan: Artisan) => {
    if (!artisan.artisan_user_id) return
    setMsgLoading(true)
    try {
      const token = await getAdminToken()
      const res = await fetch(`/api/syndic/messages?artisan_id=${artisan.artisan_user_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch { /* silencieux */ }
    setMsgLoading(false)
  }

  const sendMessage = async () => {
    if (!msgInput.trim() || !selectedArtisanChat?.artisan_user_id) return
    const content = msgInput.trim()
    setMsgInput('')
    try {
      const token = await getAdminToken()
      await fetch('/api/syndic/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content,
          artisan_user_id: selectedArtisanChat.artisan_user_id,
        })
      })
      await fetchMessages(selectedArtisanChat)
    } catch { /* silencieux */ }
  }

  // ── Ajouter/créer un artisan ─────────────────────────────────────────────────
  const handleArtisanEmailSearch = async (email: string) => {
    if (!email || !email.includes('@')) return
    setArtisanSearchLoading(true)
    setArtisanSearchResult(null)
    try {
      const token = await getAdminToken()
      const res = await fetch(`/api/syndic/artisans/search?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setArtisanSearchResult(data)
        if (data.found) {
          // Auto-remplir les champs avec les infos du compte existant
          const fullName = data.name || ''
          const parts = fullName.trim().split(' ')
          // "Lepore Sebastien" ou "Sebastien Lepore" — le prénom est généralement le 1er mot
          const prenom = parts.length > 1 ? parts[0] : ''
          const nom = parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || ''
          setArtisanForm(f => ({
            ...f,
            nom,
            prenom,
            ...(data.telephone ? { telephone: data.telephone } : {}),
            ...(data.metier ? { metier: data.metier } : {}),
            ...(data.siret ? { siret: data.siret } : {}),
          }))
        }
      } else {
        // Même si l'API renvoie une erreur, on affiche "non trouvé"
        setArtisanSearchResult({ found: false })
      }
    } catch {
      setArtisanSearchResult({ found: false })
    }
    setArtisanSearchLoading(false)
  }

  const handleAddArtisan = async (createAccount: boolean) => {
    setArtisanError('')
    setArtisanSuccess('')
    setArtisanSubmitting(true)
    try {
      const token = await getAdminToken()
      const res = await fetch('/api/syndic/artisans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...artisanForm, action: createAccount ? 'create' : 'link' })
      })
      const data = await res.json()
      if (!res.ok) {
        setArtisanError(data.error || (locale === 'pt' ? 'Erro ao adicionar' : 'Erreur lors de l\'ajout'))
      } else {
        setArtisanSuccess(data.message || (locale === 'pt' ? 'Artesão adicionado com sucesso!' : 'Artisan ajouté avec succès !'))
        setArtisansLoaded(false) // Forcer rechargement
        setTimeout(() => {
          setShowModalArtisan(false)
          setArtisanForm({ email: '', nom: '', prenom: '', telephone: '', metier: '', siret: '' })
          setArtisanSearchResult(null)
          setArtisanSuccess('')
          fetchArtisans()
        }, 1500)
      }
    } catch {
      setArtisanError(locale === 'pt' ? 'Ocorreu um erro' : 'Une erreur est survenue')
    }
    setArtisanSubmitting(false)
  }

  const handleDeleteArtisan = async (artisanId: string, artisanNom: string) => {
    if (!window.confirm(locale === 'pt' ? `Remover ${artisanNom} do seu gabinete? Esta ação é irreversível.` : `Supprimer ${artisanNom} de votre cabinet ? Cette action est irréversible.`)) return
    try {
      const token = await getAdminToken()
      const res = await fetch(`/api/syndic/artisans?artisan_id=${artisanId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setArtisans(prev => prev.filter(a => a.id !== artisanId))
      } else {
        const data = await res.json()
        alert(data.error || (locale === 'pt' ? 'Erro ao eliminar' : 'Erreur lors de la suppression'))
      }
    } catch {
      alert(locale === 'pt' ? 'Ocorreu um erro' : 'Une erreur est survenue')
    }
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
  }

  // ── Gestion Immeubles ────────────────────────────────────────────────────────
  const openAddImmeuble = () => {
    setEditingImmeuble(null)
    setImmeubleForm({ nom: '', adresse: '', ville: '', codePostal: '', nbLots: 1, anneeConstruction: 2000, typeImmeuble: 'Copropriété', gestionnaire: '', budgetAnnuel: 0, depensesAnnee: 0, nbInterventions: 0 })
    setShowModalImmeuble(true)
  }
  const openEditImmeuble = (imm: Immeuble) => {
    setEditingImmeuble(imm)
    setImmeubleForm({ ...imm })
    setShowModalImmeuble(true)
  }
  const handleSaveImmeuble = async () => {
    if (!immeubleForm.nom?.trim() || !immeubleForm.adresse?.trim()) return
    enregistrerBatiment(immeubleForm.nom || '')

    // Optimistic update local
    if (editingImmeuble) {
      setImmeubles(prev => prev.map(i => i.id === editingImmeuble.id ? { ...i, ...immeubleForm } as Immeuble : i))
    } else {
      const newImm: Immeuble = {
        id: Date.now().toString(),
        nom: immeubleForm.nom || '',
        adresse: immeubleForm.adresse || '',
        ville: immeubleForm.ville || '',
        codePostal: immeubleForm.codePostal || '',
        nbLots: immeubleForm.nbLots || 1,
        anneeConstruction: immeubleForm.anneeConstruction || 2000,
        typeImmeuble: immeubleForm.typeImmeuble || 'Copropriété',
        gestionnaire: immeubleForm.gestionnaire || '',
        prochainControle: immeubleForm.prochainControle,
        nbInterventions: 0,
        budgetAnnuel: immeubleForm.budgetAnnuel || 0,
        depensesAnnee: immeubleForm.depensesAnnee || 0,
      }
      setImmeubles(prev => [newImm, ...prev])
    }
    setShowModalImmeuble(false)

    // Sync Supabase en arrière-plan
    try {
      const token = await getAdminToken()
      if (!token) return
      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      if (editingImmeuble) {
        await fetch('/api/syndic/immeubles', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ id: editingImmeuble.id, ...immeubleForm }),
        })
      } else {
        const res = await fetch('/api/syndic/immeubles', {
          method: 'POST',
          headers,
          body: JSON.stringify(immeubleForm),
        })
        if (res.ok) {
          const { immeuble } = await res.json()
          // Remplacer l'ID local par l'UUID Supabase
          if (immeuble?.id) {
            setImmeubles(prev => prev.map(i => i.nom === immeubleForm.nom && !i.id?.includes('-') ? { ...i, id: immeuble.id } : i))
          }
        }
      }
    } catch { /* silencieux */ }
  }
  const handleDeleteImmeuble = async (id: string) => {
    if (!confirm(locale === 'pt' ? 'Eliminar este edifício? Esta ação é irreversível.' : 'Supprimer cet immeuble ? Cette action est irréversible.')) return
    setImmeubles(prev => prev.filter(i => i.id !== id))
    // Sync Supabase
    try {
      const token = await getAdminToken()
      if (!token) return
      await fetch(`/api/syndic/immeubles?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
    } catch { /* silencieux */ }
  }

  // ── Gestion Missions ─────────────────────────────────────────────────────────
  const getFilteredMissions = () => {
    switch (missionsFilter) {
      case 'Urgentes': return missions.filter(m => m.priorite === 'urgente')
      case 'En cours': return missions.filter(m => m.statut === 'en_cours' || m.statut === 'acceptee')
      case 'Terminées': return missions.filter(m => m.statut === 'terminee')
      default: return missions
    }
  }
  const handleValiderMission = (id: string) => {
    setMissions(prev => prev.map(m => m.id === id ? { ...m, statut: 'acceptee' as const } : m))
  }

  const handleDeleteMission = async (id: string) => {
    if (!confirm(locale === 'pt' ? 'Eliminar esta missão definitivamente? Esta ação é irreversível.' : 'Supprimer cette mission définitivement ? Cette action est irréversible.')) return
    // Suppression immédiate de l'état local
    setMissions(prev => prev.filter(m => m.id !== id))
    // Suppression localStorage
    try {
      const stored = JSON.parse(localStorage.getItem(`fixit_syndic_missions_${user?.id}`) || '[]')
      localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(stored.filter((m: any) => m.id !== id)))
    } catch {}
    // Suppression Supabase
    try { await fetch(`/api/syndic/missions?id=${encodeURIComponent(id)}`, { method: 'DELETE' }) } catch {}
  }

  const handleDeletePlanningEvent = async (id: string) => {
    if (!confirm(locale === 'pt' ? 'Eliminar este evento do planeamento?' : 'Supprimer cet événement du planning ?')) return
    setPlanningEvents(prev => prev.filter(e => e.id !== id))
    // Supprimer en DB aussi
    try {
      const token = await getAdminToken()
      if (token) {
        await fetch(`/api/syndic/planning-events?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        })
      }
    } catch {}
  }

  // ── Gestion Alertes ──────────────────────────────────────────────────────────
  const handleTraiterAlerte = (id: string) => {
    setAlertes(prev => prev.filter(a => a.id !== id))
  }

  // ── Planning navigation ──────────────────────────────────────────────────────
  const planningYear = planningDate.getFullYear()
  const planningMonth = planningDate.getMonth()
  const planningMonthLabel = planningDate.toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { month: 'long', year: 'numeric' })
  const planningDaysInMonth = new Date(planningYear, planningMonth + 1, 0).getDate()
  const planningFirstDay = new Date(planningYear, planningMonth, 1).getDay() // 0=dim
  const planningOffset = planningFirstDay === 0 ? 6 : planningFirstDay - 1 // lundi=0
  const todayDay = new Date().getDate()
  const isCurrentMonth = planningYear === new Date().getFullYear() && planningMonth === new Date().getMonth()

  // ── Paramètres ───────────────────────────────────────────────────────────────
  const handleSaveParams = () => {
    if (user) {
      if (cabinetAddress) localStorage.setItem(`fixit_syndic_address_${user.id}`, cabinetAddress)
      if (cabinetLogo) localStorage.setItem(`fixit_syndic_logo_${user.id}`, cabinetLogo)
      if (syndicSignature) localStorage.setItem(`fixit_syndic_signature_${user.id}`, JSON.stringify(syndicSignature))
    }
    setParamSaved(true)
    setTimeout(() => setParamSaved(false), TOAST_SHORT)
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200 * 1024) {
      alert(locale === 'pt' ? 'O logo deve ter menos de 200KB' : 'Le logo doit faire moins de 200KB')
      return
    }
    if (!file.type.startsWith('image/')) {
      alert(locale === 'pt' ? 'Apenas imagens (PNG, JPG)' : 'Images uniquement (PNG, JPG)')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string
      setCabinetLogo(b64)
      if (user) localStorage.setItem(`fixit_syndic_logo_${user.id}`, b64)
    }
    reader.readAsDataURL(file)
  }

  // ── Parse [DOC_PDF] blocks from Max responses ──────────────────────────────
  const parseDocPDF = (content: string): { text: string; docData: any | null } => {
    const match = content.match(/\[DOC_PDF\]([\s\S]*?)\[\/DOC_PDF\]/)
    if (!match) return { text: content, docData: null }
    try {
      const docData = JSON.parse(match[1].trim())
      const text = content.replace(/\[DOC_PDF\][\s\S]*?\[\/DOC_PDF\]/, '').trim()
      return { text, docData }
    } catch { return { text: content, docData: null } }
  }

  // ── Generate professional PDF from Max document data ──────────────────────
  const generateMaxPDF = async (docData: any) => {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, M = 18, textW = W - 2 * M
    const isPt = locale === 'pt'
    let y = M

    // Helper: check page break
    const checkPageBreak = (needed: number) => {
      if (y + needed > 275) { pdf.addPage(); y = M }
    }

    // ── 1. HEADER: Logo + Cabinet Info ──
    const logoB64 = cabinetLogo
    if (logoB64) {
      try { pdf.addImage(logoB64, 'JPEG', M, y, 25, 25); } catch {}
    }
    const headerX = logoB64 ? M + 30 : M
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.setTextColor(13, 27, 46) // #0D1B2E
    pdf.text(cabinetNom || (isPt ? 'Gabinete' : 'Cabinet'), headerX, y + 6)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    if (cabinetAddress) {
      const addrLines = cabinetAddress.split('\n')
      addrLines.forEach((line, i) => {
        pdf.text(line.trim(), headerX, y + 12 + i * 4)
      })
      y += 12 + addrLines.length * 4
    } else {
      y += 14
    }
    if (cabinetEmail) {
      pdf.text(cabinetEmail, headerX, y)
      y += 5
    }
    y = Math.max(y, logoB64 ? M + 28 : y) + 4

    // ── Separator line ──
    pdf.setDrawColor(201, 168, 76) // #C9A84C gold
    pdf.setLineWidth(0.8)
    pdf.line(M, y, W - M, y)
    y += 8

    // ── 2. DOCUMENT TITLE ──
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.setTextColor(13, 27, 46)
    const title = (docData.title || docData.type || 'DOCUMENT').toUpperCase()
    pdf.text(title, W / 2, y, { align: 'center' })
    y += 8

    // Reference & Date
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    const refNum = `DOC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
    const dateStr = new Date().toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    pdf.text(`${isPt ? 'Referência' : 'Référence'}: ${refNum}`, M, y)
    pdf.text(`${isPt ? 'Data' : 'Date'}: ${dateStr}`, W - M, y, { align: 'right' })
    y += 10

    // ── 3. RECIPIENT ──
    if (docData.destinataire) {
      const d = docData.destinataire
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(13, 27, 46)
      pdf.text(isPt ? 'DESTINATÁRIO:' : 'DESTINATAIRE:', M, y)
      y += 5
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      if (d.prenom || d.nom) pdf.text(`${d.prenom || ''} ${d.nom || ''}`.trim(), M, y)
      y += 5
      const addrParts: string[] = []
      if (d.immeuble) addrParts.push(d.immeuble)
      if (d.batiment) addrParts.push(`${isPt ? 'Bloco' : 'Bât.'} ${d.batiment}`)
      if (d.etage) addrParts.push(`${d.etage}${isPt ? 'º andar' : 'e étage'}`)
      if (d.porte) addrParts.push(`${isPt ? 'Porta' : 'Porte'} ${d.porte}`)
      if (addrParts.length > 0) { pdf.text(addrParts.join(', '), M, y); y += 5 }
      y += 5
    }

    // ── 4. OBJET ──
    if (docData.objet) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(13, 27, 46)
      pdf.text(`${isPt ? 'Assunto' : 'Objet'}: ${docData.objet}`, M, y)
      y += 8
    }

    // ── 5. BODY ──
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(40, 40, 40)
    const corps = docData.corps || []
    for (const paragraph of corps) {
      checkPageBreak(15)
      const lines = pdf.splitTextToSize(paragraph, textW)
      lines.forEach((line: string) => {
        checkPageBreak(6)
        pdf.text(line, M, y)
        y += 5
      })
      y += 3 // Inter-paragraph spacing
    }

    // ── 6. LEGAL REFERENCES ──
    if (docData.references && docData.references.length > 0) {
      checkPageBreak(15)
      y += 3
      pdf.setFont('helvetica', 'italic')
      pdf.setFontSize(8)
      pdf.setTextColor(100, 100, 100)
      pdf.text(`${isPt ? 'Referências legais' : 'Références légales'}: ${docData.references.join(' · ')}`, M, y)
      y += 8
    }

    // ── 7. CLOSING FORMULA ──
    if (docData.formule_politesse) {
      checkPageBreak(10)
      y += 3
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(40, 40, 40)
      const fpLines = pdf.splitTextToSize(docData.formule_politesse, textW)
      fpLines.forEach((line: string) => { pdf.text(line, M, y); y += 5 })
      y += 5
    }

    // ── 8. SIGNATURE ──
    checkPageBreak(50)
    y += 5
    // Signature SVG → image
    if (syndicSignature?.svg_data) {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 160
        const ctx2d = canvas.getContext('2d')
        if (ctx2d) {
          ctx2d.fillStyle = '#ffffff'
          ctx2d.fillRect(0, 0, 400, 160)
          const img = new Image()
          const svgBlob = new Blob([syndicSignature.svg_data], { type: 'image/svg+xml' })
          const svgUrl = URL.createObjectURL(svgBlob)
          await new Promise<void>((resolve) => {
            img.onload = () => {
              ctx2d.drawImage(img, 0, 0)
              URL.revokeObjectURL(svgUrl)
              resolve()
            }
            img.onerror = () => { URL.revokeObjectURL(svgUrl); resolve() }
            img.src = svgUrl
          })
          const sigDataUrl = canvas.toDataURL('image/png')
          pdf.addImage(sigDataUrl, 'PNG', W - M - 60, y, 50, 20)
          y += 22
        }
      } catch { y += 5 }
    }

    // Signer name + role + timestamp
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(13, 27, 46)
    pdf.text(userName, W - M, y, { align: 'right' })
    y += 5
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(100, 100, 100)
    pdf.text(getRoleLabel(userRole, isPt ? 'pt' : 'fr'), W - M, y, { align: 'right' })
    y += 4
    const nowStr = new Date().toLocaleString(isPt ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    pdf.text(`${isPt ? 'Assinado em' : 'Fait le'} ${nowStr}`, W - M, y, { align: 'right' })
    y += 4
    if (syndicSignature?.hash_sha256) {
      pdf.setFontSize(6)
      pdf.text(`SHA-256: ${syndicSignature.hash_sha256.substring(0, 32)}...`, W - M, y, { align: 'right' })
      y += 5
    }

    // ── 9. FOOTER ──
    const pageCount = pdf.getNumberOfPages()
    for (let p = 1; p <= pageCount; p++) {
      pdf.setPage(p)
      pdf.setDrawColor(201, 168, 76)
      pdf.setLineWidth(0.5)
      pdf.line(M, 285, W - M, 285)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(150, 150, 150)
      pdf.text(`${cabinetNom || (isPt ? 'Gabinete' : 'Cabinet')}${cabinetAddress ? ' — ' + cabinetAddress.split('\n')[0] : ''}`, W / 2, 289, { align: 'center' })
      pdf.text(`${p}/${pageCount}`, W - M, 289, { align: 'right' })
    }

    // ── Save ──
    const fileName = `${docData.type || 'document'}_${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(fileName)
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
  const logAiAction = (actionType: string, actionData: any, result: 'success' | 'error' | 'cancelled', details?: string) => {
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

    recognition.onresult = (event: any) => {
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

    recognition.onerror = (event: any) => {
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
  const executeIaAction = async (action: any, iaToken: string) => {
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
                const emergencyMapped = emergencyData.artisans.map((a: any) => ({
                  ...a,
                  nom: a.nom || `${a.prenom || ''} ${a.nom_famille || ''}`.trim(),
                  rcProValide: a.rc_pro_valide ?? a.rcProValide ?? false,
                  rcProExpiration: a.rc_pro_expiration ?? a.rcProExpiration ?? '',
                  nbInterventions: a.nb_interventions ?? a.nbInterventions ?? 0,
                  vitfixCertifie: a.vitfix_certifie ?? a.vitfixCertifie ?? false,
                }))
                setArtisans(emergencyMapped)
                setArtisansLoaded(true)
                // Re-tenter findLocalArtisan avec les données fraîches
                const retryArtisan = emergencyMapped.find((a: Artisan) => {
                  const n = norm(action.artisan)
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

        const updatePayload: Record<string, any> = { id: action.mission_id }
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
          urgence: action.urgence || 'moyenne',
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
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') console.error('[Fixy] Action execution error:', err)
      logAiAction(action.type, action, 'error', err.message)
      setIaMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ **Erreur lors de l'exécution** : ${err.message || 'Erreur inconnue'}. Réessayez ou créez la mission manuellement.`,
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
              const mappedReload: Artisan[] = artReloadData.artisans.map((a: any) => ({
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
              setArtisansLoaded(true)
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
        ctx.immeubles = ctx.immeubles.filter((i: any) => i.nom === maxSelectedImmeuble)
        ctx.missions = ctx.missions.filter((m: any) => m.immeuble === maxSelectedImmeuble)
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

  const userRole = user?.user_metadata?.role || 'syndic'
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
    { id: 'communication_demat', emoji: '📱', label: 'Communication démat.', category: 'copropriete_fr' },
    // ── OUTILS FR ──
    { id: 'vote_correspondance', emoji: '🗳️', label: 'Vote correspondance', category: 'outils_fr' },
    { id: 'pv_assemblee_ia', emoji: '📝', label: 'PV d\'AG assisté IA', category: 'outils_fr' },
    { id: 'saisie_ia_factures', emoji: '🤖', label: 'Saisie IA Factures', category: 'outils_fr' },
    { id: 'appels_fonds', emoji: '💰', label: 'Appels de fonds', category: 'outils_fr' },
    { id: 'mise_en_concurrence', emoji: '📋', label: 'Mise en concurrence', category: 'outils_fr' },
    { id: 'recouvrement_enrichi_fr', emoji: '⚖️', label: 'Recouvrement enrichi', category: 'outils_fr' },
    { id: 'irve_bornes', emoji: '🔌', label: 'IRVE / Bornes VE', category: 'outils_fr' },
    { id: 'suivi_energetique_fr', emoji: '📈', label: 'Suivi énergétique', category: 'outils_fr' },
    { id: 'ged_certifiee', emoji: '🗄️', label: 'GED certifiée', category: 'outils_fr' },
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

  const isAdminOverride = user?.user_metadata?._admin_override === true

  return (
    <div id="syndic-dashboard" className="flex h-screen bg-[#F7F4EE] overflow-hidden">

      {/* ── BOUTON RETOUR ADMIN ── */}
      {isAdminOverride && (
        <div className="fixed top-3 right-3 z-[9999]">
          <button
            onClick={async () => {
              await supabase.auth.updateUser({ data: { ...user?.user_metadata, role: 'super_admin', _admin_override: false } })
              await supabase.auth.refreshSession()
              window.location.href = '/admin/dashboard'
            }}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-xs px-4 py-2 rounded-full shadow-lg transition"
          >
            ⚡ {t('syndicDash.sidebar.backAdmin')}
          </button>
        </div>
      )}

      {/* ── SIDEBAR ── */}
      <aside
        style={{ width: sidebarOpen ? 240 : 64, background: 'var(--sd-navy)', flexShrink: 0, display: 'flex', flexDirection: 'column', transition: 'width 0.25s ease', borderRight: '1px solid var(--sd-border-dark)', position: 'relative', overflowY: 'auto' }}
      >
        {/* Grid texture overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ padding: '0 20px', height: 80, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--sd-border-dark)', position: 'relative', gap: 12, flexShrink: 0 }}>
          {/* Logo mark — always visible */}
          <div
            style={{ width: 36, height: 36, background: 'linear-gradient(135deg,var(--sd-gold),#A8842A)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display',serif", color: 'var(--sd-navy)', fontSize: 17, fontWeight: 600, boxShadow: '0 4px 12px rgba(201,168,76,0.3)', flexShrink: 0, cursor: 'pointer' }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? t('syndicDash.sidebar.collapse') : t('syndicDash.sidebar.expand')}
          >V</div>
          {sidebarOpen && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", color: '#fff', fontSize: 16, lineHeight: 1.1, letterSpacing: '0.5px' }}>VitFix Pro</div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--sd-gold)', marginTop: 3 }}>
                {t(`syndicDash.roles.${userRole}`) || 'Gestionnaire Pro'}
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 8, paddingBottom: 8, overflowY: 'auto', position: 'relative' }}>
          {/* ── Catégories sidebar groupées ── */}
          {SIDEBAR_CATEGORIES.map(cat => {
            const catItems = navItems.filter(item => item.category === cat.key)
            if (catItems.length === 0) return null
            return (
              <div key={cat.key}>
                {sidebarOpen && (
                  <div style={{ padding: '20px 24px 6px', fontSize: 9, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}>
                    {cat.label}
                  </div>
                )}
                {catItems.map(item => {
                  const isActive = page === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setPage(item.id)}
                      style={{
                        width: 'calc(100% - 16px)', display: 'flex', alignItems: 'center', gap: 11,
                        padding: '10px 16px', margin: '1px 8px',
                        borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 500 : 400,
                        fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
                        transition: 'all 0.18s ease', border: isActive ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent', textAlign: 'left',
                        background: isActive ? 'var(--sd-gold-dim)' : 'transparent',
                        color: isActive ? 'var(--sd-gold-light)' : 'rgba(255,255,255,0.45)',
                        position: 'relative',
                      }}
                      onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)' } }}
                      onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' } }}
                    >
                      {isActive && <div style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, background: 'var(--sd-gold)', borderRadius: '0 3px 3px 0' }} />}
                      <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0, filter: isActive ? 'none' : 'grayscale(30%)' }}>{item.emoji}</span>
                      {sidebarOpen && (
                        <>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span style={{ marginLeft: 'auto', background: isActive ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.1)', color: isActive ? 'var(--sd-gold-light)' : 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>
                              {item.badge}
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
            style={{ width: 'calc(100% - 16px)', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px', margin: '1px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, background: 'transparent', border: '1px solid transparent', color: 'rgba(255,255,255,0.45)', textAlign: 'left', transition: 'all 0.15s', fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(192,57,43,0.15)'; (e.currentTarget as HTMLElement).style.color = '#e74c3c' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' }}
          >
            <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>🚪</span>
            {sidebarOpen && <span>{t('syndicDash.sidebar.logout')}</span>}
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
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: '0.4px', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t(`syndicDash.roles.${userRole}`) || getRoleLabel(userRole, locale) || 'Admin Cabinet'}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── CONTENU PRINCIPAL ── */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--sd-cream)' }}>
        {/* Topbar */}
        <header style={{ background: '#fff', borderBottom: '1px solid var(--sd-border)', padding: '0 36px', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 0 var(--sd-border), 0 4px 16px rgba(13,27,46,0.04)' }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 400, color: 'var(--sd-navy)', letterSpacing: '0.2px' }}>
              {navItems.find(n => n.id === page)?.emoji} {navItems.find(n => n.id === page)?.label}
            </h1>
            <p style={{ fontSize: 11, color: 'var(--sd-ink-3)', letterSpacing: '0.3px' }}>
              {companyName} · {new Date().toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Alertes urgentes */}
            {alertes.filter(a => a.urgence === 'haute').length > 0 && (
              <button
                onClick={() => setPage('alertes')}
                title={t('syndicDash.accueil.urgentAlerts')}
                style={{ width: 38, height: 38, border: '1px solid var(--sd-border)', background: 'var(--sd-red-soft)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--sd-red)" strokeWidth="1.5"><path d="M8 2a5 5 0 00-5 5v2l-1 2h12l-1-2V7a5 5 0 00-5-5z"/><path d="M6.5 13a1.5 1.5 0 003 0"/></svg>
                <span style={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, background: 'var(--sd-red)', border: '2px solid #fff', borderRadius: '50%' }} />
              </button>
            )}
            {/* ── Bouton Notifications (style Facebook) ── */}
            <div style={{ position: 'relative' }} ref={notifBtnRef}>
              <button
                onClick={() => setNotifPanelOpen(!notifPanelOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg, var(--sd-gold), #A8842A)', color: 'var(--sd-navy)', border: 'none', padding: '9px 18px', borderRadius: 9, fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.2px', boxShadow: '0 2px 8px rgba(201,168,76,0.35)', position: 'relative' }}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--sd-navy)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5a4.5 4.5 0 00-4.5 4.5v2.5L2 10.5h12L12.5 8.5V6A4.5 4.5 0 008 1.5z"/><path d="M6.5 12.5a1.5 1.5 0 003 0"/></svg>
                {t('syndicDash.common.notifications')}
                {notifUnread > 0 && (
                  <span style={{ background: '#e74c3c', color: '#fff', fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', marginLeft: 2 }}>
                    {notifUnread > 9 ? '9+' : notifUnread}
                  </span>
                )}
              </button>
              {/* Panel dropdown notifications */}
              {notifPanelOpen && (
                <div style={{ position: 'absolute', right: 0, top: 48, width: 360, background: '#fff', borderRadius: 14, boxShadow: '0 8px 32px rgba(13,27,46,0.18)', border: '1px solid var(--sd-border)', zIndex: 50, overflow: 'hidden' }}>
                  <div style={{ background: 'var(--sd-navy)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>🔔 {t('syndicDash.common.notifications')}</span>
                    <button onClick={() => setNotifPanelOpen(false)} aria-label={t('syndicDash.common.close')} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
                  </div>
                  <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                    {notifs.length === 0 ? (
                      <div style={{ padding: 32, textAlign: 'center', color: 'var(--sd-ink-3)', fontSize: 13 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                        {t('syndicDash.common.noNotification')}
                      </div>
                    ) : notifs.slice(0, 20).map(n => {
                      // Temps relatif
                      const diff = Date.now() - new Date(n.created_at).getTime()
                      const mins = Math.floor(diff / 60000)
                      const hrs = Math.floor(diff / 3600000)
                      const days = Math.floor(diff / 86400000)
                      const timeAgo = mins < 1 ? (locale === 'pt' ? 'agora' : "à l'instant") : mins < 60 ? (locale === 'pt' ? `há ${mins}min` : `il y a ${mins}min`) : hrs < 24 ? (locale === 'pt' ? `há ${hrs}h` : `il y a ${hrs}h`) : (locale === 'pt' ? `há ${days}j` : `il y a ${days}j`)
                      // Navigation cible
                      const targetPage: Page = n.type === 'rapport_intervention' || n.type === 'new_mission' || n.type === 'mission_completed' ? 'missions' : 'alertes'
                      return (
                        <div
                          key={n.id}
                          onClick={() => { setPage(targetPage); setNotifPanelOpen(false) }}
                          style={{ padding: '12px 16px', borderBottom: '1px solid var(--sd-border)', background: !n.read ? 'rgba(201,168,76,0.06)' : '#fff', cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = !n.read ? 'rgba(201,168,76,0.12)' : 'rgba(0,0,0,0.02)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = !n.read ? 'rgba(201,168,76,0.06)' : '#fff' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                              {n.type === 'rapport_intervention' ? '📋' : n.type === 'new_mission' ? '✅' : n.type === 'mission_completed' ? '🏁' : '📣'}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: !n.read ? 600 : 500, color: 'var(--sd-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</p>
                              {n.body && <p style={{ fontSize: 12, color: 'var(--sd-ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</p>}
                              <p style={{ fontSize: 11, color: 'var(--sd-gold)', marginTop: 4, fontWeight: 500 }}>{timeAgo}</p>
                            </div>
                            {!n.read && <div style={{ width: 8, height: 8, background: 'var(--sd-gold)', borderRadius: '50%', flexShrink: 0, marginTop: 6 }} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {notifs.length > 0 && (
                    <div style={{ padding: '10px 16px', borderTop: '1px solid var(--sd-border)', display: 'flex', justifyContent: 'center' }}>
                      <button onClick={() => { markAllNotifsRead(); setNotifPanelOpen(false) }} style={{ fontSize: 12, color: 'var(--sd-gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        ✓ {t('syndicDash.common.markAllRead')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={page === 'canal' ? '' : 'p-6'}>

          {/* ── ACCUEIL ── */}
          {page === 'accueil' && (() => {
            const totalLots = immeubles.reduce((a, i) => a + (i.nbLots || 0), 0)
            const missionsActives = missions.filter(m => ['en_cours', 'acceptee'].includes(m.statut)).length
            const missionsEnAttente = missions.filter(m => m.statut === 'en_attente').length
            const artisansActifs = artisans.filter(a => a.statut === 'actif').length
            const artisansCertifies = artisans.filter(a => a.vitfixCertifie).length
            const alertesUrgentes = alertes.filter(a => a.urgence === 'haute')
            const budgetPct = totalBudget > 0 ? Math.min((totalDepenses / totalBudget) * 100, 100) : 0
            const solde = totalBudget - totalDepenses
            const locStr = locale === 'pt' ? 'pt-PT' : 'fr-FR'
            const dateLabel = new Date().toLocaleDateString(locStr, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* ── Hero band ── */}
                <div style={{ background: 'var(--sd-navy)', borderRadius: 16, padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
                  {/* Background decorations */}
                  <div style={{ position: 'absolute', top: -50, right: -30, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(201,168,76,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
                  <div style={{ position: 'relative' }}>
                    <div style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sd-gold)', fontWeight: 600, marginBottom: 6 }}>
                      {dateLabel}
                    </div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: '#fff', fontWeight: 400, lineHeight: 1.2 }}>
                      {t('syndicDash.accueil.hello') || 'Bonjour,'} <em style={{ fontStyle: 'italic', color: 'var(--sd-gold-light)' }}>{userName}</em>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
                      {t('syndicDash.accueil.portfolioStatus') || 'Voici l\'état de votre portefeuille immobilier aujourd\'hui.'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 32, position: 'relative' }}>
                    {[
                      { val: totalLots, lbl: t('syndicDash.accueil.lotsTotal') || 'Fractions gérées' },
                      { val: missionsActives, lbl: t('syndicDash.accueil.activeMissions') || 'Missions actives' },
                      { val: `${totalBudget.toLocaleString(locStr)} €`, lbl: `${t('syndicDash.accueil.budget') || 'Budget'} ${new Date().getFullYear()}` },
                    ].map((s, idx) => (
                      <div key={idx} style={{ textAlign: 'right', paddingLeft: 32, borderLeft: idx > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: '#fff', lineHeight: 1 }}>{s.val}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4, letterSpacing: '0.3px' }}>{s.lbl}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── KPI row ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                  {[
                    {
                      ico: '🏢', icoColor: 'rgba(13,27,46,0.07)',
                      trend: '+0%', trendType: 'up',
                      val: immeubles.length, lbl: t('syndicDash.accueil.managedBuildings') || 'Édifices gérés',
                      sub: `${totalLots} ${t('syndicDash.accueil.lotsTotal') || 'fractions'}`
                    },
                    {
                      ico: '🔧', icoColor: 'var(--sd-gold-dim)',
                      trend: artisansActifs > 0 ? `${artisansActifs}` : '0', trendType: 'flat',
                      val: artisansActifs, lbl: t('syndicDash.accueil.activeArtisans') || 'Professionnels actifs',
                      sub: `${artisansCertifies} ${t('syndicDash.accueil.vitfixCertified') || 'certifiés VitFix'}`
                    },
                    {
                      ico: '📋', icoColor: 'var(--sd-teal-soft)',
                      trend: missionsEnAttente > 0 ? `${missionsEnAttente} ${t('syndicDash.accueil.pending') || 'en attente'}` : '—', trendType: missionsEnAttente > 0 ? 'warn' : 'flat',
                      val: missionsActives, lbl: t('syndicDash.accueil.ongoingMissions') || 'Missions en cours',
                      sub: `${missionsEnAttente} ${t('syndicDash.accueil.pending') || 'en attente'}`
                    },
                    {
                      ico: '🔔', icoColor: alertesUrgentes.length > 0 ? 'var(--sd-red-soft)' : 'var(--sd-teal-soft)',
                      trend: alertesUrgentes.length > 0 ? `${t('syndicDash.accueil.toWatch') || 'À surveiller'}` : 'OK', trendType: alertesUrgentes.length > 0 ? 'alert' : 'up',
                      val: alertes.length, lbl: t('syndicDash.accueil.activeAlerts') || 'Alertes actives',
                      sub: `${alertesUrgentes.length} ${t('syndicDash.accueil.urgent') || 'urgentes'}`
                    },
                  ].map((kpi, idx) => {
                    const trendColors: Record<string, { bg: string; color: string }> = {
                      up:    { bg: 'var(--sd-teal-soft)',   color: 'var(--sd-teal)' },
                      flat:  { bg: 'var(--sd-cream-dark)', color: 'var(--sd-ink-3)' },
                      warn:  { bg: 'var(--sd-amber-soft)', color: 'var(--sd-amber)' },
                      alert: { bg: 'var(--sd-red-soft)',   color: 'var(--sd-red)' },
                    }
                    const tc = trendColors[kpi.trendType] || trendColors.flat
                    return (
                      <div key={idx} style={{ background: '#fff', border: '1px solid var(--sd-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <div style={{ width: 38, height: 38, borderRadius: 9, background: kpi.icoColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{kpi.ico}</div>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 6, letterSpacing: '0.3px', background: tc.bg, color: tc.color }}>{kpi.trend}</span>
                        </div>
                        <div>
                          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 34, color: 'var(--sd-navy)', lineHeight: 1 }}>{kpi.val}</div>
                          <div style={{ fontSize: 13, color: 'var(--sd-ink-2)', fontWeight: 400, marginTop: 4 }}>{kpi.lbl}</div>
                          <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2 }}>{kpi.sub}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* ── Budget section ── */}
                <div style={{ background: '#fff', border: '1px solid var(--sd-border)', borderRadius: 14, padding: '26px 28px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                    <div>
                      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 400, color: 'var(--sd-navy)' }}>
                        {t('syndicDash.accueil.globalBudget') || 'Budget global'} — {t('syndicDash.accueil.fiscalYear') || 'Exercice'} {new Date().getFullYear()}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2, letterSpacing: '0.3px' }}>
                        {t('syndicDash.accueil.budgetSubtitle') || 'Suivi des dépenses et solde disponible'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--sd-gold-dim)', border: '1px solid rgba(201,168,76,0.25)', color: '#8A6A20', fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 20, letterSpacing: '0.5px' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sd-gold)' }} />
                      {t('syndicDash.accueil.inProgress') || 'En cours'}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0, marginBottom: 20 }}>
                    {[
                      { lbl: t('syndicDash.accueil.totalBudget') || 'Budget total', val: `${totalBudget.toLocaleString(locStr)} €`, note: `${t('syndicDash.accueil.fiscalYear') || 'Exercice'} ${new Date().getFullYear()}`, color: 'var(--sd-navy)' },
                      { lbl: t('syndicDash.accueil.spent') || 'Dépensé', val: `${totalDepenses.toLocaleString(locStr)} €`, note: `${Math.round(budgetPct)}% ${t('syndicDash.accueil.consumed') || 'consommé'}`, color: 'var(--sd-amber)' },
                      { lbl: t('syndicDash.accueil.remaining') || 'Solde restant', val: `${solde.toLocaleString(locStr)} €`, note: t('syndicDash.accueil.available') || 'Disponible', color: 'var(--sd-teal)' },
                    ].map((fig, idx) => (
                      <div key={idx} style={{ paddingRight: idx < 2 ? 24 : 0, paddingLeft: idx > 0 ? 24 : 0, borderRight: idx < 2 ? '1px solid var(--sd-border)' : 'none' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--sd-ink-3)', marginBottom: 8 }}>{fig.lbl}</div>
                        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: fig.color, lineHeight: 1 }}>{fig.val}</div>
                        <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 5 }}>{fig.note}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--sd-ink-3)', marginBottom: 6, letterSpacing: '0.3px' }}>
                      <span>{Math.round(budgetPct)}% {t('syndicDash.accueil.consumed') || 'consommé'}</span>
                      <span>{t('syndicDash.accueil.available') || 'Budget disponible'}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--sd-cream-dark)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'linear-gradient(90deg,var(--sd-navy),var(--sd-navy-soft))', borderRadius: 10, width: `${budgetPct}%`, transition: 'width 1.2s cubic-bezier(.4,0,.2,1)' }} />
                    </div>
                  </div>
                </div>

                {/* ── Bottom grid : alertes + missions ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 18 }}>

                  {/* Panel alertes urgentes */}
                  <div style={{ background: '#fff', border: '1px solid var(--sd-border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--sd-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--sd-red-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🔴</div>
                        <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 400, color: 'var(--sd-navy)' }}>{t('syndicDash.accueil.urgentAlerts') || 'Alertes urgentes'}</span>
                      </div>
                      <button onClick={() => setPage('alertes')} style={{ fontSize: 11, color: 'var(--sd-gold)', textDecoration: 'none', fontWeight: 600, letterSpacing: '0.3px', background: 'none', border: 'none', cursor: 'pointer' }}>
                        {t('syndicDash.common.seeAll') || 'Voir tout'} →
                      </button>
                    </div>
                    {alertesUrgentes.length === 0 ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
                        <div style={{ color: 'var(--sd-ink-3)', fontSize: 13, lineHeight: 1.5 }}>{t('syndicDash.accueil.noUrgentAlert') || 'Aucune alerte urgente.'}<br />{t('syndicDash.accueil.allUnderControl') || 'Tout est sous contrôle.'}</div>
                      </div>
                    ) : (
                      <div style={{ flex: 1 }}>
                        {alertesUrgentes.map(a => (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 20px', borderBottom: '1px solid var(--sd-border)', cursor: 'pointer' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sd-red)', boxShadow: '0 0 0 3px var(--sd-red-soft)', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--sd-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message}</div>
                              <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2 }}>{a.date}</div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'var(--sd-red-soft)', color: 'var(--sd-red)', letterSpacing: '0.3px' }}>{t('syndicDash.accueil.urgent') || 'Urgent'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Panel missions récentes */}
                  <div style={{ background: '#fff', border: '1px solid var(--sd-border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--sd-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(13,27,46,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>📋</div>
                        <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 400, color: 'var(--sd-navy)' }}>{t('syndicDash.accueil.recentMissions') || 'Missions récentes'}</span>
                      </div>
                      <button onClick={() => setPage('missions')} style={{ fontSize: 11, color: 'var(--sd-gold)', fontWeight: 600, letterSpacing: '0.3px', background: 'none', border: 'none', cursor: 'pointer' }}>
                        {t('syndicDash.accueil.seeAllMissions') || 'Voir tout'} →
                      </button>
                    </div>
                    {missions.length === 0 ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                        <div style={{ color: 'var(--sd-ink-3)', fontSize: 13 }}>{t('syndicDash.accueil.noMission') || 'Aucune mission en cours.'}</div>
                      </div>
                    ) : (
                      <div style={{ flex: 1 }}>
                        {missions.slice(0, 4).map(m => {
                          const isUrgent = m.priorite === 'urgente'
                          return (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 20px', borderBottom: '1px solid var(--sd-border)', cursor: 'pointer' }} onClick={() => { setSelectedMission(m); setShowMissionDetails(true) }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: isUrgent ? 'var(--sd-red)' : 'var(--sd-amber)', boxShadow: isUrgent ? '0 0 0 3px var(--sd-red-soft)' : '0 0 0 3px var(--sd-amber-soft)' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--sd-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.immeuble}</div>
                                <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2 }}>{m.type} · {m.artisan || t('syndicDash.missions.unassigned') || 'Non assigné'}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                                {isUrgent && <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'var(--sd-red-soft)', color: 'var(--sd-red)', letterSpacing: '0.3px' }}>{t('syndicDash.accueil.urgent') || 'Urgent'}</span>}
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'var(--sd-amber-soft)', color: 'var(--sd-amber)', letterSpacing: '0.3px' }}>{m.statut === 'en_cours' ? (t('syndicDash.missions.inProgress') || 'En cours') : (t('syndicDash.missions.pending') || 'En attente')}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Immeubles aperçu ── */}
                {immeubles.length > 0 && (
                  <div style={{ background: '#fff', border: '1px solid var(--sd-border)', borderRadius: 14, padding: '26px 28px' }}>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 400, color: 'var(--sd-navy)', marginBottom: 20 }}>🏢 {t('syndicDash.accueil.myBuildings') || 'Mes immeubles'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
                      {immeubles.map(i => {
                        const pct = i.budgetAnnuel > 0 ? Math.min((i.depensesAnnee / i.budgetAnnuel) * 100, 100) : 0
                        return (
                          <div key={i.id} style={{ border: '1px solid var(--sd-border)', borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'border-color 0.15s' }} onClick={() => setPage('immeubles')}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--sd-gold)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--sd-border)'}
                          >
                            <div style={{ fontWeight: 500, color: 'var(--sd-navy)', fontSize: 14, marginBottom: 4 }}>{i.nom}</div>
                            <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginBottom: 12 }}>{i.adresse}{i.ville ? `, ${i.ville}` : ''}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--sd-ink-2)', marginBottom: 8 }}>
                              <span>🏠 {i.nbLots} {t('syndicDash.accueil.lots') || 'lots'}</span>
                              <span>📋 {i.nbInterventions || 0} {t('syndicDash.accueil.interventions') || 'interventions'}</span>
                            </div>
                            <div style={{ height: 4, background: 'var(--sd-cream-dark)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: 'linear-gradient(90deg,var(--sd-navy),var(--sd-navy-soft))', borderRadius: 4, width: `${pct}%` }} />
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--sd-ink-3)', marginTop: 4 }}>{t('syndicDash.accueil.budget') || 'Budget'} : {Math.round(pct)}% {t('syndicDash.accueil.consumed') || 'consommé'}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

              </div>
            )
          })()}

          {/* ── IMMEUBLES ── */}
          {page === 'immeubles' && (() => {
            const totalLots = immeubles.reduce((a, im) => a + (im.nbLots || 0), 0)
            const totalInterventions = immeubles.reduce((a, im) => a + (im.nbInterventions || 0), 0)
            const docsManquants = immeubles.filter(im => !im.reglementTexte && !im.reglementPdfNom).length
            return (
            <div>
              {/* ── Hero ── */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                  <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 400, color: 'var(--sd-navy)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                    🏢 {t('syndicDash.sidebar.buildings')}
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--sd-ink-3)' }}>
                    <span style={{ color: 'var(--sd-ink-2)' }}>{immeubles.length} {t('syndicDash.immeubles.inPortfolio')}</span> · <span style={{ color: 'var(--sd-ink-2)' }}>{totalLots} {t('syndicDash.immeubles.totalLots', 'lots totaux')}</span>
                  </p>
                </div>
                <button
                  onClick={openAddImmeuble}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--sd-navy)', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 3px 12px rgba(13,27,46,0.22)', whiteSpace: 'nowrap' }}
                >
                  <span style={{ color: 'var(--sd-gold)', fontSize: 18, fontWeight: 300, lineHeight: 1 }}>+</span> {t('syndicDash.immeubles.addBuilding')}
                </button>
              </div>

              {/* ── KPI Strip ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 26 }}>
                {[
                  { num: immeubles.length, label: t('syndicDash.immeubles.managedBuildings', 'Immeubles gérés'), sub: t('syndicDash.immeubles.activePortfolio', 'Portefeuille actif'), color: 'var(--sd-navy)', barColor: 'var(--sd-navy)' },
                  { num: totalLots, label: t('syndicDash.immeubles.totalLots', 'Lots totaux'), sub: t('syndicDash.immeubles.totalFractions', 'Fractions totales'), color: 'var(--sd-gold)', barColor: 'var(--sd-gold)' },
                  { num: totalInterventions, label: t('syndicDash.immeubles.activeInterventions', 'Interventions actives'), sub: t('syndicDash.immeubles.ongoing', 'En cours'), color: '#1A7A6E', barColor: '#1A7A6E' },
                  { num: docsManquants, label: t('syndicDash.immeubles.missingDocs', 'Docs manquants'), sub: t('syndicDash.immeubles.regulationsToAdd', 'Règlements à ajouter'), color: '#D4830A', barColor: '#D4830A' },
                ].map((kpi, idx) => (
                  <div key={idx} style={{ background: '#fff', border: '1px solid var(--sd-border)', borderRadius: 14, padding: '20px 22px', position: 'relative', overflow: 'hidden', transition: 'transform 0.18s, box-shadow 0.18s', cursor: 'default' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 28px rgba(13,27,46,0.08)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                  >
                    <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 38, lineHeight: 1, color: kpi.color }}>{kpi.num}</p>
                    <p style={{ fontSize: 12, color: 'var(--sd-ink-3)', marginTop: 6 }}>{kpi.label}</p>
                    <p style={{ fontSize: 10, color: 'var(--sd-ink-3)', marginTop: 2 }}>{kpi.sub}</p>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: kpi.barColor, borderRadius: '0 0 14px 14px' }} />
                  </div>
                ))}
              </div>

              {/* ── Building Cards ── */}
              {immeubles.map(i => {
                const budgetPct = i.budgetAnnuel > 0 ? Math.min((i.depensesAnnee / i.budgetAnnuel) * 100, 100) : 0
                return (
                <div key={i.id} style={{ background: '#fff', border: '1px solid var(--sd-border)', borderRadius: 16, overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 6px rgba(13,27,46,0.05)', transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(13,27,46,0.09)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,168,76,0.28)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 6px rgba(13,27,46,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--sd-border)' }}
                >
                  {/* Card Header */}
                  <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--sd-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(135deg, var(--sd-cream-dark, #EDE8DF), #D4CCBE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flexShrink: 0, border: '1px solid var(--sd-border)' }}>🏛️</div>
                      <div>
                        <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: 'var(--sd-navy)', marginBottom: 3 }}>{i.nom}</h3>
                        <p style={{ fontSize: 12, color: 'var(--sd-ink-3)', marginBottom: 8 }}>📍 {i.adresse}, {i.codePostal} {i.ville}</p>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'rgba(13,27,46,0.05)', color: 'var(--sd-navy)', border: '1px solid rgba(13,27,46,0.1)' }}>
                            🏠 {i.nbLots} {t('syndicDash.immeubles.nbLots')}
                          </span>
                          {i.anneeConstruction > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'var(--sd-cream)', color: 'var(--sd-ink-2)', border: '1px solid var(--sd-border)' }}>
                              🗓 {t('syndicDash.immeubles.builtIn', 'Construit en')} {i.anneeConstruction}
                            </span>
                          )}
                          {!i.reglementTexte && !i.reglementPdfNom && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#FEF5E4', color: '#D4830A', border: '1px solid rgba(212,131,10,0.2)' }}>
                              ⚠️ {t('syndicDash.immeubles.missingRegulation', 'Règlement manquant')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => openEditImmeuble(i)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'var(--sd-cream)', color: 'var(--sd-ink-2)', border: '1px solid var(--sd-border)', fontFamily: "'Outfit',sans-serif", transition: 'all 0.14s' }}>
                        ✏️ {t('syndicDash.immeubles.editBtn')}
                      </button>
                      <button onClick={() => handleDeleteImmeuble(i.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, fontSize: 14, cursor: 'pointer', background: '#FDECEA', color: '#C0392B', border: '1px solid rgba(192,57,43,0.18)', transition: 'all 0.14s' }}>
                        🗑
                      </button>
                      <button onClick={() => setShowModalMission(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'var(--sd-navy)', color: '#fff', border: '1px solid var(--sd-navy)', fontFamily: "'Outfit',sans-serif", transition: 'all 0.14s' }}>
                        + Mission
                      </button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid var(--sd-border)' }}>
                    {[
                      { val: String(i.nbLots), label: t('syndicDash.immeubles.nbLots').toUpperCase(), sub: t('syndicDash.immeubles.totalFractions', 'Fractions totales') },
                      { val: String(i.anneeConstruction || '—'), label: t('syndicDash.immeubles.yearBuilt').toUpperCase(), sub: '' },
                      { val: String(i.nbInterventions), label: t('syndicDash.accueil.interventions').toUpperCase(), sub: t('syndicDash.immeubles.ongoing', 'En cours') },
                      { val: i.prochainControle ? new Date(i.prochainControle).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'short' }) : 'N/A', label: t('syndicDash.immeubles.nextControl').toUpperCase(), sub: i.prochainControle ? '' : t('syndicDash.immeubles.notPlanned', 'Non planifié'), muted: !i.prochainControle },
                    ].map((s, idx) => (
                      <div key={idx} style={{ padding: '16px 22px', borderRight: idx < 3 ? '1px solid var(--sd-border)' : 'none' }}>
                        <p style={{ fontFamily: s.muted ? "'Outfit',sans-serif" : "'Playfair Display',serif", fontSize: s.muted ? 18 : 24, color: s.muted ? 'var(--sd-ink-3)' : 'var(--sd-navy)', lineHeight: 1, marginBottom: 3, fontStyle: s.muted ? 'italic' : 'normal' }}>{s.val}</p>
                        <p style={{ fontSize: 11, color: 'var(--sd-ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</p>
                        {s.sub && <p style={{ fontSize: 10, color: 'var(--sd-ink-3)', marginTop: 2 }}>{s.sub}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Budget Row */}
                  <div style={{ padding: '13px 24px', background: 'var(--sd-cream)', borderBottom: '1px solid var(--sd-border)', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 12, color: 'var(--sd-ink-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>📊 {t('syndicDash.accueil.budget')} {new Date().getFullYear()}</span>
                    <div style={{ flex: 1, height: 5, background: 'var(--sd-cream)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--sd-border)' }}>
                      <div style={{ height: '100%', borderRadius: 10, background: budgetPct > 85 ? '#C0392B' : 'linear-gradient(90deg, var(--sd-gold), #E2B84A)', width: `${budgetPct}%` }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--sd-navy)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {i.depensesAnnee.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} € <span style={{ color: 'var(--sd-ink-3)', fontWeight: 400 }}>/ {i.budgetAnnuel.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</span>
                    </span>
                  </div>

                  {/* Footer */}
                  <div style={{ padding: '11px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {(!i.reglementTexte && !i.reglementPdfNom) ? (
                      <button onClick={() => openEditImmeuble(i)} style={{ fontSize: 12, color: '#D4830A', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'Outfit',sans-serif", transition: 'opacity 0.15s' }}>
                        📄 {t('syndicDash.immeubles.addRegulation')}
                      </button>
                    ) : (
                      <button onClick={() => openEditImmeuble(i)} style={{ fontSize: 12, color: 'var(--sd-gold)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'Outfit',sans-serif" }}>
                        📜 {t('syndicDash.immeubles.coproRegulation')}
                      </button>
                    )}
                    <div style={{ display: 'flex', gap: 18 }}>
                      <button onClick={() => setPage('coproprios')} style={{ fontSize: 12, color: 'var(--sd-ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', fontFamily: "'Outfit',sans-serif", transition: 'color 0.14s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sd-navy)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sd-ink-3)' }}
                      >👥 {t('syndicDash.sidebar.coowners')}</button>
                      <button onClick={() => setPage('documents')} style={{ fontSize: 12, color: 'var(--sd-ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', fontFamily: "'Outfit',sans-serif", transition: 'color 0.14s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sd-navy)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sd-ink-3)' }}
                      >📁 {t('syndicDash.sidebar.documents')}</button>
                      <button onClick={() => setPage('docs_interventions')} style={{ fontSize: 12, color: 'var(--sd-ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', fontFamily: "'Outfit',sans-serif", transition: 'color 0.14s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sd-navy)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sd-ink-3)' }}
                      >🔧 {t('syndicDash.immeubles.history', 'Historique')}</button>
                    </div>
                  </div>
                </div>
              )})}

              {/* ── Add Building Placeholder ── */}
              <div
                onClick={openAddImmeuble}
                style={{ border: '2px dashed rgba(201,168,76,0.3)', borderRadius: 16, minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', color: 'var(--sd-ink-3)', fontSize: 13, transition: 'all 0.18s', background: 'rgba(201,168,76,0.02)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--sd-gold)'; (e.currentTarget as HTMLElement).style.color = 'var(--sd-navy)'; (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.06)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,168,76,0.3)'; (e.currentTarget as HTMLElement).style.color = 'var(--sd-ink-3)'; (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.02)' }}
              >
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(201,168,76,0.14)', color: 'var(--sd-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 300 }}>+</div>
                <div>
                  <div style={{ fontWeight: 500 }}>{t('syndicDash.immeubles.addBuilding')}</div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>{t('syndicDash.immeubles.managePortfolio', 'Gérez votre portefeuille immobilier')}</div>
                </div>
              </div>
            </div>
          )})()}

          {/* ── ARTISANS ── */}
          {page === 'artisans' && !selectedArtisanChat && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-500 text-sm">
                  {artisans.length} artisans référencés · {artisans.filter(a => a.vitfixCertifie || a.vitfix_certifie).length} certifiés Vitfix
                  · {artisans.filter(a => a.rcProValide || a.rc_pro_valide).length} RC Pro valides
                  · {artisans.filter(a => a.decennaleValide || a.assurance_decennale_valide).length} Décennales valides
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setArtisansLoaded(false) }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1"
                    title={locale === 'pt' ? 'Atualizar a conformidade a partir da carteira do artesão' : 'Rafraîchir la conformité depuis le wallet artisan'}
                  >
                    🔄 {locale === 'pt' ? 'Sincro conformidade' : 'Synchro conformité'}
                  </button>
                  <button onClick={() => { setShowModalArtisan(true); setArtisanForm({ email: '', nom: '', prenom: '', telephone: '', metier: '', siret: '' }); setArtisanSearchResult(null); setArtisanError(''); setArtisanSuccess(''); }} className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
                    + {locale === 'pt' ? 'Adicionar um artesão' : 'Ajouter un artisan'}
                  </button>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {artisans.map(a => {
                  const certifie = a.vitfixCertifie || a.vitfix_certifie
                  const rcOk = a.rcProValide || a.rc_pro_valide
                  const rcExp = a.rcProExpiration || a.rc_pro_expiration || ''
                  const decOk = a.decennaleValide || a.assurance_decennale_valide
                  const decExp = a.decennaleExpiration || a.assurance_decennale_expiration || ''
                  const nbInterv = a.nbInterventions || a.nb_interventions || 0
                  const hasChat = !!(a.artisan_user_id)
                  return (
                    <div key={a.id} className={`bg-white rounded-2xl shadow-sm p-6 border-2 ${a.statut === 'suspendu' ? 'border-red-200' : 'border-gray-100'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900">{a.nom}</h3>
                            {certifie && <span className="text-xs bg-[#FFC107] text-gray-900 px-2 py-0.5 rounded-full font-bold">⚡ {locale === 'pt' ? 'Certificado' : 'Certifié'}</span>}
                            {a.compte_existant && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">🔗 {locale === 'pt' ? 'Sincronizado' : 'Synchronisé'}</span>}
                          </div>
                          <p className="text-sm text-gray-500">{a.metier}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-[#FFC107]">★ {a.note || '—'}</div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            a.statut === 'actif' ? 'bg-green-100 text-green-700' :
                            a.statut === 'suspendu' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {a.statut === 'actif' ? (locale === 'pt' ? 'Ativo' : 'Actif') : a.statut === 'suspendu' ? (locale === 'pt' ? 'Suspenso' : 'Suspendu') : (locale === 'pt' ? 'Pendente' : 'En attente')}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 mb-3">
                        <div>📞 {a.telephone || '—'}</div>
                        <div>📧 {a.email}</div>
                        <div>📋 {nbInterv} {locale === 'pt' ? 'intervenções' : 'interventions'}</div>
                        <div className={`${rcOk ? 'text-green-600' : 'text-red-500 font-semibold'}`}>
                          {rcOk ? (locale === 'pt' ? '✅ RC Pro válido' : '✅ RC Pro valide') : (locale === 'pt' ? '❌ RC Pro em falta' : '❌ RC Pro manquante')}
                        </div>
                      </div>
                      {/* ── RC Pro status ── */}
                      {rcOk && rcExp && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700 mb-2 flex items-center gap-2">
                          <span>📄 RC Pro valide jusqu&apos;au {new Date(rcExp).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>
                          {new Date(rcExp) < new Date(Date.now() + 60 * 86400000) && (
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">Expire bientôt</span>
                          )}
                        </div>
                      )}
                      {!rcOk && rcExp && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600 mb-2">
                          ⚠️ RC Pro expirée le {new Date(rcExp).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}
                        </div>
                      )}
                      {!rcOk && !rcExp && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700 mb-2">
                          💡 L&apos;artisan doit uploader sa RC Pro dans son Wallet Conformité
                        </div>
                      )}
                      {/* ── Décennale status ── */}
                      {decOk && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700 mb-3 flex items-center gap-2">
                          <span>🛡️ Décennale valide{decExp ? ` jusqu'au ${new Date(decExp).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}` : ''}</span>
                          {decExp && new Date(decExp) < new Date(Date.now() + 60 * 86400000) && (
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">Expire bientôt</span>
                          )}
                        </div>
                      )}
                      {!decOk && decExp && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600 mb-3">
                          ⚠️ Décennale expirée le {new Date(decExp).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}
                        </div>
                      )}
                      {!decOk && !decExp && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700 mb-3">
                          💡 L&apos;artisan doit uploader sa RC Décennale dans son Wallet
                        </div>
                      )}
                      <div className="flex gap-2">
                        {hasChat ? (
                          <button onClick={() => { setSelectedArtisanChat(a); fetchMessages(a) }} className="flex-1 text-xs bg-[#0D1B2E] text-white py-1.5 rounded-lg hover:bg-[#152338] transition flex items-center justify-center gap-1">
                            💬 {locale === 'pt' ? 'Canal dedicado' : 'Canal dédié'}
                          </button>
                        ) : (
                          <button className="flex-1 text-xs border border-gray-200 text-gray-500 py-1.5 rounded-lg cursor-not-allowed" title={locale === 'pt' ? 'Conta Vitfix não ligada' : 'Compte Vitfix non lié'}>
                            💬 {locale === 'pt' ? 'Sem conta ligada' : 'Pas de compte lié'}
                          </button>
                        )}
                        <button onClick={() => setShowModalMission(true)} className="flex-1 text-xs bg-[#0D1B2E] text-white py-1.5 rounded-lg hover:bg-[#152338] transition">{locale === 'pt' ? 'Criar missão' : 'Créer mission'}</button>
                        <button
                          onClick={() => handleDeleteArtisan(a.id, a.nom)}
                          className="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-1.5 px-2 rounded-lg transition"
                          title={locale === 'pt' ? 'Remover este artesão do gabinete' : 'Retirer cet artisan du cabinet'}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── CANAL COMMUNICATION ARTISAN ── */}
          {page === 'artisans' && selectedArtisanChat && (
            <div className="flex flex-col h-[calc(100vh-200px)]">
              {/* Header canal */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex items-center gap-3">
                <button onClick={() => { setSelectedArtisanChat(null); setMessages([]) }} className="text-gray-500 hover:text-gray-600 transition">
                  ← Retour
                </button>
                <div className="w-10 h-10 bg-[#F7F4EE] rounded-full flex items-center justify-center text-lg font-bold text-[#C9A84C]">
                  {selectedArtisanChat.nom.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{selectedArtisanChat.nom}</h3>
                  <p className="text-xs text-gray-500">{selectedArtisanChat.metier} · Canal dédié interventions</p>
                </div>
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setShowModalMission(true)} className="text-xs bg-[#0D1B2E] text-white px-3 py-1.5 rounded-lg hover:bg-[#152338] transition">
                    + Nouvelle mission
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 overflow-y-auto space-y-3 mb-4">
                {msgLoading && (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!msgLoading && messages.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">💬</div>
                    <p className="font-medium">Canal de communication dédié</p>
                    <p className="text-sm mt-1">Envoyez votre premier message à {selectedArtisanChat.nom}</p>
                    <p className="text-xs mt-2 text-gray-300">Les missions assignées, rapports et proof of work apparaîtront ici</p>
                  </div>
                )}
                {messages.map(msg => {
                  const isMine = msg.sender_role === 'syndic'
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMine ? 'bg-[#0D1B2E] text-white' : 'bg-gray-100 text-gray-900'}`}>
                        {!isMine && <p className="text-xs font-semibold mb-1 text-[#C9A84C]">{msg.sender_name}</p>}
                        {msg.message_type === 'proof_of_work' && <p className="text-xs font-bold mb-1">📸 Proof of Work</p>}
                        {msg.message_type === 'rapport' && <p className="text-xs font-bold mb-1">📋 Rapport d'intervention</p>}
                        {msg.message_type === 'devis' && <p className="text-xs font-bold mb-1">💶 Devis</p>}
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${isMine ? 'text-[#E4DDD0]' : 'text-gray-500'}`}>
                          {new Date(msg.created_at).toLocaleTimeString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {isMine && msg.read_at && ' · Lu'}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Zone de saisie */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex gap-2">
                <input
                  type="text"
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={locale === 'pt' ? `Mensagem para ${selectedArtisanChat.nom}...` : `Message à ${selectedArtisanChat.nom}...`}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                />
                <button
                  onClick={sendMessage}
                  disabled={!msgInput.trim()}
                  className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-40"
                >
                  {locale === 'pt' ? 'Enviar' : 'Envoyer'}
                </button>
              </div>
            </div>
          )}

          {/* ── MISSIONS ── */}
          {page === 'missions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  {(['Toutes', 'Urgentes', 'En cours', 'Terminées'] as const).map(f => {
                    const filterLabel = locale === 'pt'
                      ? { 'Toutes': 'Todas', 'Urgentes': 'Urgentes', 'En cours': 'Em curso', 'Terminées': 'Concluídas' }[f]
                      : f
                    return (
                    <button key={f} onClick={() => setMissionsFilter(f)} className={`text-sm px-3 py-1.5 rounded-lg border transition ${missionsFilter === f ? 'border-[#C9A84C] bg-[#F7F4EE] text-[#C9A84C] font-semibold' : 'border-gray-200 hover:border-[#C9A84C] hover:text-[#C9A84C]'}`}>
                      {filterLabel}
                      {f === 'Urgentes' && <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{missions.filter(m => m.priorite === 'urgente').length}</span>}
                      {f === 'En cours' && <span className="ml-1.5 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">{missions.filter(m => m.statut === 'en_cours' || m.statut === 'acceptee').length}</span>}
                    </button>
                    )
                  })}
                </div>
                <button onClick={() => setShowModalMission(true)} className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
                  + {locale === 'pt' ? 'Nova missão' : 'Nouvelle mission'}
                </button>
              </div>
              {getFilteredMissions().length === 0 && (
                <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-2xl">
                  {locale === 'pt' ? 'Nenhuma missão para este filtro' : 'Aucune mission pour ce filtre'}
                </div>
              )}
              <div className="space-y-3">
                {getFilteredMissions().map(m => (
                  <div key={m.id} className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 hover:border-[#E4DDD0] transition">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <PrioriteBadge p={m.priorite} />
                          <Badge statut={m.statut} locale={locale} />
                          <span className="text-xs text-gray-500">#{m.id}</span>
                          {m.locataire && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">👤 {m.locataire}</span>}
                          {m.etage && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">🏢 {m.batiment ? `Bât. ${m.batiment} · ` : ''}Ét. {m.etage}</span>}
                        </div>
                        <h3 className="font-bold text-gray-900">{m.immeuble}</h3>
                        <p className="text-sm text-gray-600">{m.type} · {m.description}</p>
                        {m.numLot && <p className="text-xs text-gray-500 mt-0.5">Lot {m.numLot}</p>}
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        {m.montantDevis && <p className="text-sm font-semibold text-gray-900">{m.montantDevis.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</p>}
                        {m.montantFacture && <p className="text-xs text-green-600">Facturé : {m.montantFacture.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center gap-4">
                        <span>🔧 {m.artisan}</span>
                        {m.dateIntervention && <span>📅 {new Date(m.dateIntervention).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>}
                        {(m.canalMessages?.length || 0) > 0 && <span className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-2 py-0.5 rounded-full">💬 {m.canalMessages!.length} msg</span>}
                      </div>
                      <div className="flex gap-2">
                        {m.statut === 'en_attente' && (
                          <button onClick={() => handleValiderMission(m.id)} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-lg hover:bg-green-200 transition font-medium">✅ Valider</button>
                        )}
                        {m.statut === 'terminee' && (
                          <button onClick={() => { setSelectedMission(m); setShowMissionDetails(true) }} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 transition font-medium">📄 Rapport</button>
                        )}
                        <button onClick={() => { setSelectedMission(m); setShowMissionDetails(true) }} className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-3 py-1 rounded-lg hover:bg-[#EDE8DF] transition font-medium">📋 Ouvrir</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteMission(m.id) }} className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg hover:bg-red-200 transition font-medium" title={t('syndicDash.common.delete')} aria-label={t('syndicDash.common.delete')}>🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
          {page === 'planning' && (() => {
            const canAssign = userRole === 'syndic_secretaire' || userRole === 'syndic' || userRole === 'syndic_admin'
            const filteredEvents = planningViewFilter === 'tous'
              ? planningEvents
              : planningEvents.filter(e => e.assigneA === planningViewFilter || e.creePar === planningViewFilter)
            const monthEvents = filteredEvents.filter(e => {
              const d = new Date(e.date + 'T00:00:00')
              return d.getFullYear() === planningYear && d.getMonth() === planningMonth
            })
            // Les missions artisans ne sont PAS affichées dans le planning (agenda secrétaire uniquement)
            return (
              <div className="space-y-4">
                {/* Banner migration DB si table pas encore créée */}
                {planningNeedsMigration && (
                  <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <p className="font-semibold text-amber-800 text-sm">{t('syndicDash.planning.migrationRequired')}</p>
                      <p className="text-xs text-amber-700 mt-1">{t('syndicDash.planning.migrationDesc')} <a href="https://supabase.com/dashboard" target="_blank" className="underline font-medium">Supabase SQL Editor</a> :</p>
                      <pre className="mt-2 bg-amber-100 text-amber-900 text-xs rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS syndic_planning_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cabinet_id UUID NOT NULL,
  titre TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'autre',
  date DATE NOT NULL,
  heure TEXT NOT NULL DEFAULT '09:00',
  duree_min INTEGER DEFAULT 60,
  assigne_a TEXT NOT NULL DEFAULT '',
  assigne_role TEXT DEFAULT '',
  description TEXT DEFAULT '',
  cree_par TEXT NOT NULL DEFAULT '',
  statut TEXT DEFAULT 'planifie',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_planning_events_cabinet ON syndic_planning_events(cabinet_id);`}</pre>
                    </div>
                  </div>
                )}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900 capitalize">Planning — {planningMonthLabel}</h2>
                      <button
                        onClick={() => { setSelectedPlanningDay(new Date().toISOString().slice(0,10)); setShowPlanningModal(true) }}
                        className="flex items-center gap-1 text-xs bg-[#0D1B2E] hover:bg-[#152338] text-white px-3 py-1.5 rounded-lg transition font-medium"
                      >
                        + Ajouter
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Filtre employé — visible secrétaire/admin */}
                      {canAssign && (
                        <select
                          value={planningViewFilter}
                          onChange={e => setPlanningViewFilter(e.target.value)}
                          className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#C9A84C] bg-white"
                        >
                          <option value="tous">👥 {locale === 'pt' ? 'Toda a equipa' : 'Toute l\'équipe'}</option>
                          {teamMembers.map(m => (
                            <option key={m.id} value={m.full_name}>{m.full_name}{m.role ? ` — ${getRoleLabel(m.role, locale)}` : ''}</option>
                          ))}
                        </select>
                      )}
                      <button onClick={() => setPlanningDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition">←</button>
                      <button onClick={() => setPlanningDate(new Date())} className={`text-sm px-3 py-1.5 rounded-lg transition ${isCurrentMonth ? 'border border-[#C9A84C] bg-[#F7F4EE] text-[#C9A84C] hover:bg-[#F7F4EE]' : 'border border-gray-200 hover:bg-gray-50 text-gray-700'}`}>{locale === 'pt' ? 'Hoje' : 'Aujourd\'hui'}</button>
                      <button onClick={() => setPlanningDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition">→</button>
                    </div>
                  </div>

                  {/* Légende types */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Object.entries(locale === 'pt'
                      ? { reunion: 'Reunião', visite: 'Visita', rdv: 'Reunião', tache: 'Tarefa', autre: 'Outro' }
                      : { reunion: 'Réunion', visite: 'Visite', rdv: 'RDV', tache: 'Tâche', autre: 'Autre' }
                    ).map(([k, v]) => (
                      <span key={k} className={`text-xs px-2 py-0.5 rounded-full font-medium ${EVENT_COLORS[k].bg} ${EVENT_COLORS[k].text}`}>{v}</span>
                    ))}
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#F7F4EE] text-[#C9A84C]">🔧 {locale === 'pt' ? 'Missão artesão' : 'Mission artisan'}</span>
                  </div>

                  {/* Grille calendrier */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {(locale === 'pt' ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']).map(d => (
                      <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: planningOffset }, (_, i) => (
                      <div key={`empty-${i}`} className="min-h-20 p-1 rounded-lg" />
                    ))}
                    {Array.from({ length: planningDaysInMonth }, (_, i) => i + 1).map(day => {
                      const dateStr = `${planningYear}-${String(planningMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const dayEvents = filteredEvents.filter(e => e.date === dateStr)
                      const isToday = isCurrentMonth && day === todayDay
                      const total = dayEvents.length // missions artisans exclues du planning
                      return (
                        <div
                          key={day}
                          onClick={() => { setSelectedPlanningDay(dateStr); setPlanningEventForm(f => ({ ...f, heure: '09:00' })); setShowPlanningModal(true) }}
                          className={`min-h-20 p-1 rounded-lg border text-xs cursor-pointer transition group relative ${isToday ? 'border-[#C9A84C] bg-[#F7F4EE]' : 'border-gray-100 hover:border-[#C9A84C] hover:bg-[#F7F4EE]/40'}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-semibold text-xs ${isToday ? 'text-[#C9A84C]' : 'text-gray-700'}`}>{day}</span>
                            {total > 0 && <span className="text-gray-500 text-xs">{total}</span>}
                          </div>
                          {/* Events */}
                          {dayEvents.slice(0, 2).map(e => (
                            <div key={e.id} className={`text-xs px-1 py-0.5 rounded mb-0.5 flex items-center gap-0.5 font-medium ${EVENT_COLORS[e.type].bg} ${EVENT_COLORS[e.type].text}`} title={`${e.heure} — ${e.titre} (${e.assigneA})`}>
                              <span className="truncate flex-1">{e.heure} {e.titre}</span>
                              <button onClick={ev => { ev.stopPropagation(); handleDeletePlanningEvent(e.id) }} className="flex-shrink-0 opacity-60 hover:opacity-100 font-bold leading-none text-xs" title={t('syndicDash.common.delete')} aria-label={t('syndicDash.common.delete')}>×</button>
                            </div>
                          ))}
                          {/* Missions artisans volontairement exclues du planning (agenda secrétaire) */}
                          {total > 2 && <div className="text-gray-500 text-xs">+{total - 2}</div>}
                          {/* "+" hint on hover */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
                            <span className="text-[#C9A84C] text-lg font-light">+</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Liste mensuelle */}
                <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                  <h3 className="font-bold text-gray-900 mb-3">📋 Agenda du mois — {planningMonthLabel}</h3>
                  {monthEvents.length === 0 && (
                    <p className="text-sm text-gray-500 py-6 text-center border-2 border-dashed border-gray-200 rounded-xl">Aucun événement ce mois</p>
                  )}
                  <div className="space-y-2">
                    {[
                      ...monthEvents.map(e => ({ key: `e-${e.id}`, date: e.date, heure: e.heure, label: e.titre, sub: e.assigneA, color: `${EVENT_COLORS[e.type].bg} ${EVENT_COLORS[e.type].text}`, tag: e.type, statut: e.statut, onClick: () => {}, onDelete: () => handleDeletePlanningEvent(e.id) })),
                    ].sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure)).map(item => (
                      <div key={item.key} onClick={item.onClick} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-[#F7F4EE] rounded-xl text-sm cursor-pointer transition">
                        <div className="text-center w-14 flex-shrink-0">
                          <p className="font-bold text-[#C9A84C] text-xs">{new Date(item.date + 'T00:00:00').toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'short' })}</p>
                          <p className="text-gray-500 text-xs">{item.heure}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${item.color}`}>{item.tag}</span>
                        <span className="flex-1 font-medium truncate text-gray-800">{item.label}</span>
                        <span className="text-gray-500 text-xs flex-shrink-0 hidden md:block">{item.sub}</span>
                        <button onClick={ev => { ev.stopPropagation(); item.onDelete() }} className="flex-shrink-0 text-xs bg-red-100 text-red-500 hover:bg-red-200 px-2 py-0.5 rounded-lg transition font-medium" title={t('syndicDash.common.delete')} aria-label={t('syndicDash.common.delete')}>🗑️</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

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
            <div className="space-y-3">
              {alertes.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-5xl mb-3">✅</div>
                  <p className="font-semibold text-gray-600">{t('syndicDash.alertes.allProcessed')}</p>
                </div>
              )}
              {alertes.map(a => (
                <div key={a.id} className={`bg-white rounded-2xl shadow-sm p-5 border-l-4 ${
                  a.urgence === 'haute' ? 'border-l-red-500' :
                  a.urgence === 'moyenne' ? 'border-l-amber-500' : 'border-l-gray-300'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">
                        {a.type === 'rc_pro' ? '📄' : a.type === 'controle' ? '⚙️' : a.type === 'budget' ? '💶' : '📁'}
                      </span>
                      <div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          a.urgence === 'haute' ? 'bg-red-100 text-red-700' :
                          a.urgence === 'moyenne' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {a.urgence === 'haute' ? (locale === 'pt' ? '🔴 Urgente' : '🔴 Urgente') : a.urgence === 'moyenne' ? (locale === 'pt' ? '🟡 Média' : '🟡 Moyenne') : (locale === 'pt' ? '🟢 Baixa' : '🟢 Basse')}
                        </span>
                        <p className="text-gray-900 font-medium mt-2">{a.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{a.date}</p>
                      </div>
                    </div>
                    <button onClick={() => handleTraiterAlerte(a.id)} className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-3 py-1.5 rounded-lg hover:bg-[#EDE8DF] transition font-medium ml-4 flex-shrink-0">
                      ✓ {locale === 'pt' ? 'Tratar' : 'Traiter'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── EMAILS MAX IA ── */}
          {page === 'emails' && user && <EmailsSection syndicId={user.id} onNavigateParams={() => setPage('parametres')} />}

          {/* ── MAX EXPERT-CONSEIL ── */}
          {page === 'ia' && (
            <div className="sd-mx-zone">
              <div className="sd-mx-inner">

                {/* ── Identity Banner ── */}
                <div className="sd-mx-banner">
                  <div className="sd-mx-id-left">
                    <div className="sd-mx-monogram" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
                      <MaxAvatar size={54} />
                    </div>
                    <div>
                      <div className="sd-mx-title-row">
                        <div className="sd-mx-title">{t('syndicDash.ai.maxTitleFull')}</div>
                        <span className="sd-mx-ia-chip">IA</span>
                      </div>
                      <div className="sd-mx-expertise">
                        {locale === 'pt' ? (
                          <>
                            <span className="sd-mx-exp-tag">Condomínio</span>
                            <span className="sd-mx-exp-tag">Legislação PT</span>
                            <span className="sd-mx-exp-tag">Regulamentação</span>
                            <span className="sd-mx-exp-tag">Contabilidade</span>
                            <span className="sd-mx-exp-tag">Contencioso</span>
                          </>
                        ) : (
                          <>
                            <span className="sd-mx-exp-tag">Copropriété</span>
                            <span className="sd-mx-exp-tag">Droit ALUR / ELAN</span>
                            <span className="sd-mx-exp-tag">Réglementation</span>
                            <span className="sd-mx-exp-tag">Comptabilité</span>
                            <span className="sd-mx-exp-tag">Contentieux</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="sd-mx-banner-right">
                    <div className="sd-mx-stat">
                      <div className="sd-mx-stat-num">{maxMessages.length}</div>
                      <div className="sd-mx-stat-lbl">Messages</div>
                    </div>
                    <div className="sd-mx-stat">
                      <div className="sd-mx-stat-num">∞</div>
                      <div className="sd-mx-stat-lbl">{locale === 'pt' ? 'Disponível' : 'Disponible'}</div>
                    </div>
                    <button
                      className="sd-mx-clear"
                      onClick={() => { const cleared = [{ role: 'assistant' as const, content: t('syndicDash.ai.cleared') }]; setMaxMessages(cleared); try { localStorage.setItem(`fixit_max_history_${user?.id}`, JSON.stringify(cleared)) } catch {} }}
                      title={locale === 'pt' ? 'Nova conversa' : 'Nouvelle conversation'}
                      aria-label={locale === 'pt' ? 'Nova conversa' : 'Nouvelle conversation'}
                    >✕</button>
                  </div>
                </div>

                {/* ── Tab Bar (Chat / Conformité / Documents) ── */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--sd-border)', marginBottom: 0, background: '#fff' }}>
                  {([
                    { id: 'chat' as const, icon: '💬', label: locale === 'pt' ? 'Consultor' : 'Consultant' },
                    { id: 'conformite' as const, icon: '✅', label: locale === 'pt' ? 'Conformidade' : 'Conformité' },
                    { id: 'documents' as const, icon: '📄', label: locale === 'pt' ? 'Documentos' : 'Documents' },
                  ]).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setMaxTab(tab.id)}
                      style={{
                        flex: 1, padding: '12px 8px', fontSize: 13, fontWeight: maxTab === tab.id ? 600 : 400,
                        color: maxTab === tab.id ? 'var(--sd-gold)' : 'var(--sd-ink-3)',
                        borderBottom: maxTab === tab.id ? '2px solid var(--sd-gold)' : '2px solid transparent',
                        background: 'transparent', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
                      }}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>

                {/* ═══════════════════════════════════════════════════════
                    TAB: CHAT (Consultant)
                ═══════════════════════════════════════════════════════ */}
                {maxTab === 'chat' && (
                  <>
                    {/* ── Sélecteur immeuble contextuel ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderBottom: '1px solid var(--sd-border)', background: 'var(--sd-cream)' }}>
                      <span style={{ fontSize: 11, color: 'var(--sd-ink-3)', fontWeight: 500 }}>🏢 {locale === 'pt' ? 'Contexto' : 'Contexte'} :</span>
                      <select
                        value={maxSelectedImmeuble}
                        onChange={e => setMaxSelectedImmeuble(e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--sd-border)', background: '#fff', color: 'var(--sd-navy)', fontFamily: "var(--font-outfit), 'Outfit', sans-serif", cursor: 'pointer' }}
                      >
                        <option value="all">{locale === 'pt' ? 'Todos os edifícios' : 'Tous les immeubles'}</option>
                        {immeubles.map(i => <option key={i.nom} value={i.nom}>{i.nom}</option>)}
                      </select>
                    </div>

                    {/* ── Messages Area ── */}
                    <div className="sd-mx-messages">
                      {maxMessages.map((msg, i) => (
                        msg.role === 'assistant' ? (() => {
                          const { text: msgText, docData } = parseDocPDF(msg.content)
                          return (
                          <div key={i} className="sd-mx-msg-max">
                            <div className="sd-mx-msg-av"><MaxAvatar size={34} /></div>
                            <div className="sd-mx-msg-inner">
                              <div className="sd-mx-msg-label">Max <span></span> {locale === 'pt' ? 'Consultor Especialista IA' : 'Expert-Conseil IA'}</div>
                              <div className="sd-mx-msg-bubble" suppressHydrationWarning>
                                <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(msgText) }} />
                              </div>
                              {/* ── Copy + Fixy + PDF action buttons ── */}
                              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(msgText); }}
                                  style={{ fontSize: 11, color: 'var(--sd-ink-3)', background: 'transparent', border: '1px solid var(--sd-border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', transition: 'all 0.15s' }}
                                  title={locale === 'pt' ? 'Copiar' : 'Copier'}
                                >📋 {locale === 'pt' ? 'Copiar' : 'Copier'}</button>
                                <button
                                  onClick={() => { setFixyPanelOpen(true); }}
                                  style={{ fontSize: 11, color: 'var(--sd-gold)', background: 'transparent', border: '1px solid var(--sd-gold)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', transition: 'all 0.15s' }}
                                  title={locale === 'pt' ? 'Enviar ao Fixy para executar' : 'Envoyer à Fixy pour exécuter'}
                                >🤖 {locale === 'pt' ? 'Fixy →' : 'Fixy →'}</button>
                                {docData && (
                                  <button
                                    onClick={() => {
                                      setPendingDocData(docData)
                                      setPdfObjet(docData.objet || '')
                                      // Pre-select immeuble if specified by Max
                                      if (docData.destinataire?.immeuble) {
                                        const match = immeubles.find(im => im.nom.toLowerCase().includes(docData.destinataire.immeuble.toLowerCase()))
                                        setPdfSelectedImmeuble(match ? match.nom : '')
                                      } else {
                                        setPdfSelectedImmeuble(immeubles.length === 1 ? immeubles[0].nom : '')
                                      }
                                      setPdfSelectedCopro(null)
                                      setShowPdfModal(true)
                                    }}
                                    style={{ fontSize: 11, color: '#ffffff', background: '#0D1B2E', border: '1px solid #0D1B2E', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 600 }}
                                    title={locale === 'pt' ? 'Descarregar PDF oficial' : 'Télécharger le PDF officiel'}
                                  >📄 {locale === 'pt' ? 'Descarregar PDF' : 'Télécharger PDF'}</button>
                                )}
                              </div>
                            </div>
                          </div>
                          )
                        })() : (
                          <div key={i} className="sd-mx-msg-user">
                            <div className="sd-mx-msg-user-inner">
                              <div className="sd-mx-msg-user-bubble">{msg.content}</div>
                              <button
                                onClick={() => {
                                  if (!maxFavorites.includes(msg.content)) {
                                    const newFavs = [...maxFavorites, msg.content]
                                    setMaxFavorites(newFavs)
                                    try { localStorage.setItem(`fixit_max_favorites_${user?.id}`, JSON.stringify(newFavs)) } catch {}
                                  }
                                }}
                                style={{ fontSize: 10, color: maxFavorites.includes(msg.content) ? 'var(--sd-gold)' : 'var(--sd-ink-3)', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0, textAlign: 'right' as const, width: '100%' }}
                                title={locale === 'pt' ? 'Guardar como favorito' : 'Enregistrer en favori'}
                              >{maxFavorites.includes(msg.content) ? '⭐' : '☆'} {locale === 'pt' ? 'Favorito' : 'Favori'}</button>
                            </div>
                          </div>
                        )
                      ))}

                      {maxLoading && (
                        <div className="sd-mx-typing">
                          <div className="sd-mx-msg-av"><MaxAvatar size={34} /></div>
                          <div className="sd-mx-typing-bubble">
                            <div className="sd-mx-tdot" />
                            <div className="sd-mx-tdot" />
                            <div className="sd-mx-tdot" />
                            <span style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginLeft: 8 }}>{locale === 'pt' ? 'Max a analisar...' : 'Max analyse...'}</span>
                          </div>
                        </div>
                      )}
                      <div ref={maxEndRef} />
                    </div>

                    {/* ── Ornamental Separator ── */}
                    <div className="sd-mx-orn">
                      <div className="sd-mx-orn-line" />
                      <div className="sd-mx-orn-diamond">◆ ◆ ◆</div>
                      <div className="sd-mx-orn-line" />
                    </div>

                    {/* ── Dynamic + Static Pills ── */}
                    <div className="sd-mx-pills">
                      {/* Dynamic context pills based on real data */}
                      {(() => {
                        const ctx = buildSyndicContext()
                        const dynamicPills: { icon: string; text: string; priority: boolean }[] = []
                        const rcExpired = ctx.artisans.filter(a => !a.rcProValide)
                        if (rcExpired.length > 0) dynamicPills.push({ icon: '🔴', text: locale === 'pt' ? `${rcExpired.length} RC Pro expirado(s) — que fazer?` : `${rcExpired.length} RC Pro expirée(s) — que faire ?`, priority: true })
                        const urgentMissions = ctx.missions.filter(m => m.priorite === 'urgente' && m.statut !== 'terminee')
                        if (urgentMissions.length > 0) dynamicPills.push({ icon: '⚡', text: locale === 'pt' ? `${urgentMissions.length} missão(ões) urgente(s) — prioridades?` : `${urgentMissions.length} mission(s) urgente(s) — priorités ?`, priority: true })
                        const overBudget = ctx.immeubles.filter(i => i.budgetAnnuel > 0 && i.depensesAnnee / i.budgetAnnuel > 0.85)
                        if (overBudget.length > 0) dynamicPills.push({ icon: '💸', text: locale === 'pt' ? `Orçamento ${overBudget[0].nom} a ${Math.round(overBudget[0].depensesAnnee / overBudget[0].budgetAnnuel * 100)}%` : `Budget ${overBudget[0].nom} à ${Math.round(overBudget[0].depensesAnnee / overBudget[0].budgetAnnuel * 100)}%`, priority: true })
                        const highAlerts = ctx.alertes.filter(a => a.urgence === 'haute')
                        if (highAlerts.length > 0) dynamicPills.push({ icon: '🚨', text: locale === 'pt' ? `${highAlerts.length} alerta(s) urgente(s) — análise` : `${highAlerts.length} alerte(s) urgente(s) — analyse`, priority: true })
                        return dynamicPills.map(p => (
                          <button key={p.text} className="sd-mx-qpill" style={{ border: '1px solid var(--sd-red)', color: 'var(--sd-red)', background: 'var(--sd-red-soft)' }} onClick={() => sendMaxMessage(p.text)}>
                            <span>{p.icon}</span> {p.text}
                          </button>
                        ))
                      })()}
                      {/* Favorites pills */}
                      {maxFavorites.map(fav => (
                        <button key={fav} className="sd-mx-qpill" style={{ border: '1px solid var(--sd-gold)', background: 'var(--sd-gold-dim)' }} onClick={() => sendMaxMessage(fav)}>
                          <span>⭐</span> {fav}
                        </button>
                      ))}
                      {/* Static pills */}
                      {[
                        { icon: '⚖️', text: t('syndicDash.ai.pillAG') },
                        { icon: '🏗', text: t('syndicDash.ai.pillDPE') },
                        { icon: '💶', text: t('syndicDash.ai.pillCharges') },
                        { icon: '🔧', text: t('syndicDash.ai.pillElevator') },
                        { icon: '📋', text: t('syndicDash.ai.pillFormalNotice') },
                        { icon: '📜', text: t('syndicDash.ai.pillALUR') },
                        { icon: '⚔️', text: t('syndicDash.ai.pillRecovery') },
                      ].map(s => (
                        <button
                          key={s.text}
                          className="sd-mx-qpill"
                          onClick={() => sendMaxMessage(s.text)}
                        >
                          <span>{s.icon}</span> {s.text}
                        </button>
                      ))}
                    </div>

                    {/* ── Compose ── */}
                    <div className="sd-mx-compose">
                      <div className="sd-mx-compose-box">
                        <textarea
                          id="max-input"
                          className="sd-mx-compose-input"
                          value={maxInput}
                          onChange={e => setMaxInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey && !maxLoading) { e.preventDefault(); sendMaxMessage() }
                          }}
                          placeholder={locale === 'pt' ? 'Faça uma pergunta jurídica, técnica ou contabilística ao Max…' : 'Posez une question juridique, technique ou comptable à Max…'}
                          rows={1}
                          disabled={maxLoading}
                          onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 150) + 'px'; }}
                        />
                        <button
                          className="sd-mx-compose-send"
                          onClick={() => sendMaxMessage()}
                          disabled={maxLoading || !maxInput.trim()}
                        >
                          {maxLoading ? (
                            <span style={{ width: 16, height: 16, border: '2px solid var(--sd-navy)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                          ) : '↑'}
                        </button>
                      </div>
                      <div className="sd-mx-compose-foot">
                        <span className="sd-mx-compose-hint">{t('syndicDash.ai.maxHint')} <strong>Fixy</strong></span>
                      </div>
                    </div>
                  </>
                )}

                {/* ═══════════════════════════════════════════════════════
                    TAB: CONFORMITÉ (Checklist)
                ═══════════════════════════════════════════════════════ */}
                {maxTab === 'conformite' && (
                  <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <div>
                        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy)', margin: 0 }}>
                          {locale === 'pt' ? '✅ Checklist de Conformidade' : '✅ Checklist de Conformité'}
                        </h2>
                        <p style={{ fontSize: 12, color: 'var(--sd-ink-3)', marginTop: 4 }}>
                          {locale === 'pt' ? 'Análise automática do estado do gabinete' : 'Analyse automatique de l\'état du cabinet'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(() => {
                          const checks = buildConformiteChecklist()
                          const ok = checks.filter(c => c.status === 'ok').length
                          const warn = checks.filter(c => c.status === 'warning').length
                          const err = checks.filter(c => c.status === 'error').length
                          return (
                            <>
                              <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'var(--sd-teal-soft)', color: 'var(--sd-teal)', fontWeight: 600 }}>✅ {ok}</span>
                              {warn > 0 && <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'var(--sd-amber-soft)', color: 'var(--sd-amber)', fontWeight: 600 }}>⚠️ {warn}</span>}
                              {err > 0 && <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'var(--sd-red-soft)', color: 'var(--sd-red)', fontWeight: 600 }}>❌ {err}</span>}
                            </>
                          )
                        })()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {buildConformiteChecklist().map(check => (
                        <div
                          key={check.id}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                            background: '#fff', borderRadius: 10, border: `1px solid ${check.status === 'error' ? 'var(--sd-red)' : check.status === 'warning' ? 'var(--sd-amber)' : 'var(--sd-border)'}`,
                            boxShadow: check.status === 'error' ? '0 0 0 1px rgba(192,57,43,0.1)' : 'none',
                          }}
                        >
                          <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                            {check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️' : check.status === 'error' ? '❌' : 'ℹ️'}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy)' }}>{check.label}</div>
                            <div style={{ fontSize: 12, color: 'var(--sd-ink-2)', marginTop: 2 }}>{check.detail}</div>
                            {check.action && (
                              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                <button
                                  onClick={() => { setMaxTab('chat'); sendMaxMessage(locale === 'pt' ? `Analisa o problema: ${check.label}. ${check.detail}` : `Analyse le problème : ${check.label}. ${check.detail}`) }}
                                  style={{ fontSize: 11, color: 'var(--sd-navy)', background: 'var(--sd-cream)', border: '1px solid var(--sd-border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}
                                >🎓 {locale === 'pt' ? 'Perguntar ao Max' : 'Demander à Max'}</button>
                                <button
                                  onClick={() => setFixyPanelOpen(true)}
                                  style={{ fontSize: 11, color: 'var(--sd-gold)', background: 'var(--sd-gold-dim)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}
                                >🤖 {locale === 'pt' ? 'Fixy → ação' : 'Fixy → action'}</button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Score global */}
                    <div style={{ marginTop: 20, padding: '16px 20px', background: 'var(--sd-navy)', borderRadius: 12, color: '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>
                            {locale === 'pt' ? 'Pontuação de conformidade' : 'Score de conformité'}
                          </div>
                          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, fontWeight: 400, color: 'var(--sd-gold)', marginTop: 4 }}>
                            {(() => {
                              const checks = buildConformiteChecklist()
                              const scored = checks.filter(c => c.status !== 'info')
                              const ok = scored.filter(c => c.status === 'ok').length
                              return scored.length > 0 ? Math.round(ok / scored.length * 100) : 100
                            })()}%
                          </div>
                        </div>
                        <button
                          onClick={() => { setMaxTab('chat'); sendMaxMessage(locale === 'pt' ? 'Faz uma análise completa da conformidade do meu gabinete e recomendações prioritárias' : 'Fais une analyse complète de la conformité de mon cabinet et recommandations prioritaires') }}
                          style={{ fontSize: 12, color: 'var(--sd-navy)', background: 'var(--sd-gold)', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontWeight: 600, fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}
                        >🎓 {locale === 'pt' ? 'Análise detalhada Max' : 'Analyse détaillée Max'}</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════
                    TAB: DOCUMENTS (Générateur)
                ═══════════════════════════════════════════════════════ */}
                {maxTab === 'documents' && (
                  <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
                    <div style={{ marginBottom: 20 }}>
                      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy)', margin: 0 }}>
                        {locale === 'pt' ? '📄 Gerador de Documentos' : '📄 Générateur de Documents'}
                      </h2>
                      <p style={{ fontSize: 12, color: 'var(--sd-ink-3)', marginTop: 4 }}>
                        {locale === 'pt' ? 'Max gera modelos prontos a usar adaptados à legislação portuguesa' : 'Max génère des modèles prêts à l\'emploi adaptés à la législation française'}
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
                      {(locale === 'pt' ? [
                        { icon: '📩', title: 'Convocatória AG', desc: 'Art.º 1432.º CC — convocatória assembleia geral', prompt: 'Gera um modelo completo de convocatória para Assembleia Geral de condomínio, com todos os elementos obrigatórios segundo o Art.º 1432.º do Código Civil e Lei 8/2022' },
                        { icon: '📝', title: 'Ata de AG', desc: 'Modelo de ata assembleia geral', prompt: 'Gera um modelo completo de ata de Assembleia Geral de condomínio, incluindo deliberações, votações por maioria (Art.º 1432.º/1433.º CC)' },
                        { icon: '⚠️', title: 'Notificação formal', desc: 'Cobrança de quotas em atraso', prompt: 'Gera um modelo de notificação formal para cobrança de quotas de condomínio em atraso, com prazo e referência legal (Art.º 310.º CC prescrição 5 anos)' },
                        { icon: '📋', title: 'Contrato manutenção', desc: 'Elevador, limpeza, jardim', prompt: 'Gera um modelo de contrato de manutenção para condomínio (elevador/limpeza/jardim), com cláusulas obrigatórias, SLA e penalizações' },
                        { icon: '📊', title: 'Declaração de encargos', desc: 'Lei 8/2022 — obrigatória', prompt: 'Gera um modelo de declaração anual de encargos de condomínio conforme exigido pela Lei 8/2022 (regime do condomínio)' },
                        { icon: '📜', title: 'Regulamento condomínio', desc: 'Modelo de regulamento interno', prompt: 'Gera um modelo de regulamento interno de condomínio conforme a Lei 8/2022 e Código Civil' },
                        { icon: '🔧', title: 'Ordem de serviço', desc: 'Para artesão/prestador', prompt: 'Gera um modelo de ordem de serviço para artesão/prestador de serviços em condomínio, com escopo, prazo, valor e condições' },
                        { icon: '💰', title: 'Orçamento previsional', desc: 'Modelo para AG aprovação', prompt: 'Gera um modelo de orçamento previsional para condomínio, com rubricas obrigatórias, fundo de reserva (≥10% DL 268/94), e formato para aprovação em AG' },
                      ] : [
                        { icon: '📩', title: 'Convocation AG', desc: 'Art. 9-1 décret 17/03/1967 — délai 21 jours minimum', prompt: 'Génère un modèle complet de convocation d\'Assemblée Générale de copropriété conforme au droit français. Mentions obligatoires : lieu, date, heure, ordre du jour détaillé (art. 9 et 9-1 décret n°67-223 du 17/03/1967), délai d\'envoi 21 jours minimum (art. 9 al. 2 modifié par loi ALUR 2014), notification par LRAR ou remise contre émargement (art. 64 décret 1967), joindre documents annexes obligatoires (art. 11 décret 1967 : comptes, budget prévisionnel, devis travaux). Prévoir les pouvoirs/mandats de représentation (art. 22 loi 10/07/1965). Indiquer les règles de majorité applicables (art. 24/25/25-1/26 loi 1965).' },
                        { icon: '📝', title: 'PV d\'Assemblée', desc: 'Art. 17 décret 1967 — procès-verbal AG', prompt: 'Génère un modèle complet de procès-verbal d\'Assemblée Générale de copropriété conforme au droit français. Éléments obligatoires : date, lieu, feuille de présence (art. 14 décret 1967), constat du quorum, désignation président de séance/scrutateurs/secrétaire (art. 15 décret 1967), résumé des délibérations, texte exact de chaque résolution et résultat du vote avec majorité appliquée (art. 24 majorité simple, art. 25 majorité absolue, art. 25-1 passerelle, art. 26 double majorité, unanimité — loi 10/07/1965). Mentionner les noms et tantièmes des opposants et abstentionnistes (art. 17 décret 1967). Signature du président, scrutateurs et secrétaire. Notification aux absents et opposants dans le mois (art. 42 al. 2 loi 1965, délai contestation 2 mois).' },
                        { icon: '⚠️', title: 'Mise en demeure', desc: 'Art. 19 loi 1965 — recouvrement charges impayées', prompt: 'Génère un modèle de mise en demeure pour charges de copropriété impayées conforme au droit français. Référencer : art. 19 loi n°65-557 du 10/07/1965 (solidarité des charges, privilège immobilier spécial du syndicat), art. 19-1 loi 1965 (les frais de recouvrement sont à la charge du débiteur), art. 19-2 loi 1965 (hypothèque légale du syndicat). Mentionner : détail des charges dues (provisionnelles et arrêtées), période concernée, montant total, délai de régularisation (8 à 15 jours), intérêts de retard (taux légal), conséquences en cas de non-paiement (procédure d\'injonction de payer tribunal judiciaire, art. 1405 CPC, ou saisie immobilière). Envoyer par LRAR.' },
                        { icon: '📋', title: 'Contrat maintenance', desc: 'Art. 18 loi 1965 — obligation du syndic', prompt: 'Génère un modèle de contrat de maintenance pour copropriété (ascenseur/nettoyage/espaces verts) conforme au droit français. Le syndic est tenu d\'assurer la conservation de l\'immeuble (art. 18 loi 10/07/1965). Inclure : objet et périmètre de la prestation, durée et conditions de renouvellement, obligations de résultat/moyens, SLA et délais d\'intervention, pénalités de retard, montant et révision de prix (indexation), assurances du prestataire (RC Pro, décennale si applicable), clause de résiliation. Pour les ascenseurs spécifiquement : référencer le décret n°2004-964 du 09/09/2004 (contrôle technique quinquennal obligatoire), décret n°2012-674 (entretien). Mise en concurrence obligatoire si > seuil fixé en AG (art. 21 loi 1965, art. 19-2 décret 1967).' },
                        { icon: '📊', title: 'Budget prévisionnel', desc: 'Art. 14-1 loi 1965 + fonds travaux ALUR', prompt: 'Génère un modèle de budget prévisionnel de copropriété conforme au droit français. Budget voté en AG (art. 14-1 loi 10/07/1965, majorité art. 24). Postes obligatoires : charges générales (entretien parties communes, assurance MRI, honoraires syndic, frais bancaires) et charges spéciales (ascenseur, chauffage collectif — art. 10 al. 1 et 2 loi 1965, répartition selon utilité). Fonds de travaux obligatoire : cotisation ≥5% du budget prévisionnel (art. 14-2 loi 1965 modifié par loi ALUR 2014, obligatoire copros >10 lots). Appels de fonds trimestriels : provisions exigibles au 1er jour de chaque trimestre (art. 14-1 al. 2). Prévoir comparatif N-1/N, écart budget/réalisé. Régularisation annuelle des charges (art. 18-2 loi 1965).' },
                        { icon: '📜', title: 'Règlement copropriété', desc: 'Art. 8 loi 1965 — loi ELAN/ALUR', prompt: 'Génère un modèle de règlement intérieur de copropriété conforme au droit français. Fondement : art. 8 loi n°65-557 du 10/07/1965 (le règlement de copropriété détermine la destination des parties privatives et communes, les conditions de leur jouissance). Inclure : description de l\'immeuble et répartition lots/tantièmes (état descriptif de division), distinction parties communes générales/spéciales (art. 3 et 6-2 loi 1965 modifié par loi ELAN 2018), destination de l\'immeuble (habitation/mixte/commercial), règles de jouissance des parties privatives et communes, répartition des charges (art. 10 loi 1965), clause d\'habitation bourgeoise si applicable. Mise en conformité obligatoire avec loi ELAN avant le 23/11/2021 (art. 209 II loi ELAN — actualisation de la répartition des tantièmes).' },
                        { icon: '🔧', title: 'Ordre de mission', desc: 'Art. 18 loi 1965 — travaux urgents', prompt: 'Génère un modèle d\'ordre de mission/bon de commande pour artisan ou prestataire intervenant en copropriété, conforme au droit français. Le syndic peut engager des travaux urgents nécessaires à la sauvegarde de l\'immeuble sans vote AG (art. 18 al. 2 loi 10/07/1965). Au-delà du seuil voté en AG, mise en concurrence obligatoire (art. 21 loi 1965, art. 19-2 décret 1967). Inclure : identification des parties (syndicat des copropriétaires / prestataire), description précise des travaux, localisation dans l\'immeuble, délai d\'exécution, montant HT et TTC (TVA 10% travaux rénovation ou 20% standard, art. 279-0 bis CGI), conditions de paiement, garanties (décennale, biennale — art. 1792 et 1792-3 Code civil, loi Spinetta 04/01/1978), réception des travaux (art. 1792-6 Code civil).' },
                        { icon: '💰', title: 'Appel de charges', desc: 'Art. 14-1 loi 1965 — appel trimestriel', prompt: 'Génère un modèle d\'appel de charges trimestriel pour copropriété conforme au droit français. Fondement : les provisions sont exigibles le 1er jour de chaque trimestre (art. 14-1 al. 2 loi 10/07/1965). Détailler : charges générales (quote-part selon tantièmes généraux, art. 10 al. 1 loi 1965), charges spéciales (répartition selon utilité, art. 10 al. 2), cotisation fonds de travaux (art. 14-2 loi ALUR, ≥5% du budget prévisionnel). Mentionner le budget voté en AG (date et n° résolution), le montant annuel total du copropriétaire, le 1/4 trimestriel, l\'éventuel solde créditeur/débiteur de la régularisation N-1 (art. 18-2 loi 1965). Inclure RIB du syndicat et date limite de paiement. Rappeler que les intérêts de retard courent sans mise en demeure préalable si le règlement le prévoit (art. 36 décret 1967).' },
                      ]).map(doc => (
                        <button
                          key={doc.title}
                          onClick={() => { setMaxTab('chat'); sendMaxMessage(doc.prompt) }}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', textAlign: 'left' as const,
                            background: '#fff', borderRadius: 10, border: '1px solid var(--sd-border)', cursor: 'pointer',
                            transition: 'all 0.15s', fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--sd-gold)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(201,168,76,0.15)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--sd-border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                        >
                          <span style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{doc.icon}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy)' }}>{doc.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2 }}>{doc.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

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
            <div className="max-w-4xl mx-auto">
              {(() => {
                // Modules autorisés pour ce rôle uniquement — filtré par locale
                const roleAllowedKeys = (ROLE_PAGES[userRole] || ROLE_PAGES['syndic']) as readonly string[]
                const roleModules = SYNDIC_MODULES.filter(m => {
                  if (!roleAllowedKeys.includes(m.key)) return false
                  if ('locale' in m && m.locale && m.locale !== locale) return false
                  return true
                })

                // Groupes avec filtrage par rôle — adapté FR/PT
                const GROUPS = locale === 'pt' ? [
                  {
                    title: '📋 Gestão Corrente',
                    keys: ['missions', 'canal', 'planning', 'facturation', 'emails', 'ia'],
                  },
                  {
                    title: '🔧 Terreno & Intervenções',
                    keys: ['pointage', 'docs_interventions', 'comptabilite_tech', 'analyse_devis', 'carnet_entretien', 'sinistres'],
                  },
                  {
                    title: '🏛️ Condomínio & AG',
                    keys: ['compta_copro', 'ag_digitale', 'impayés', 'extranet', 'recouvrement'],
                  },
                  {
                    title: '🇵🇹 Obrigações Legais PT',
                    keys: ['declaracao_encargos', 'seguro_condominio', 'fundo_reserva', 'obrigacoes_legais', 'certificacao_energetica'],
                  },
                  {
                    title: '🏠 Gestão Condóminos',
                    keys: ['portal_condomino', 'quadro_avisos', 'enquetes', 'reserva_espacos', 'ocorrencias', 'whatsapp_condominos'],
                  },
                  {
                    title: '🔧 Ferramentas PT',
                    keys: ['relatorio_gestao', 'preparador_assembleia', 'plano_manutencao', 'vistoria_tecnica', 'votacao_online', 'atas_ia', 'pagamentos_digitais', 'mapa_quotas', 'orcamentos_obras', 'cobranca_judicial', 'carregamento_ve', 'monitorizacao_consumos', 'arquivo_digital'],
                  },
                ] : [
                  {
                    title: '📋 Gestion courante',
                    keys: ['missions', 'canal', 'planning', 'facturation', 'emails', 'ia'],
                  },
                  {
                    title: '🔧 Terrain & Interventions',
                    keys: ['pointage', 'docs_interventions', 'comptabilite_tech', 'analyse_devis', 'carnet_entretien', 'sinistres'],
                  },
                  {
                    title: '🏛️ Copropriété & AG',
                    keys: ['compta_copro', 'ag_digitale', 'impayés', 'extranet', 'recouvrement', 'preparateur_ag'],
                  },
                  {
                    title: '⚖️ Réglementaire',
                    keys: ['reglementaire', 'rapport', 'echéances', 'pppt', 'dpe_collectif', 'visite_technique'],
                  },
                  {
                    title: '🏠 Gestion Copropriétaires',
                    keys: ['extranet_enrichi', 'panneau_affichage', 'sondages_fr', 'reservation_espaces_fr', 'signalements_fr', 'communication_demat'],
                  },
                  {
                    title: '🔧 Outils FR',
                    keys: ['vote_correspondance', 'pv_assemblee_ia', 'saisie_ia_factures', 'appels_fonds', 'mise_en_concurrence', 'recouvrement_enrichi_fr', 'irve_bornes', 'suivi_energetique_fr', 'ged_certifiee'],
                  },
                ]

                return (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">🧩 {t('syndicDash.modulesPage.title')}</h2>
                        <p className="text-sm text-gray-500 mt-1">{t('syndicDash.modulesPage.subtitle')}</p>
                      </div>
                      <div className="bg-[#F7F4EE] text-[#0D1B2E] px-4 py-2 rounded-full text-sm font-bold">
                        {roleModules.filter(m => isModuleEnabled(m.key)).length}/{roleModules.length} {t('syndicDash.modulesPage.active')}
                      </div>
                    </div>

                    <div className="space-y-6">
                      {GROUPS.map(group => {
                        const groupMods = roleModules.filter(m => group.keys.includes(m.key))
                        if (groupMods.length === 0) return null
                        return (
                          <div key={group.title}>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">{group.title}</h3>
                            <div className="grid gap-3 md:grid-cols-2">
                              {groupMods.map(mod => {
                                const enabled = isModuleEnabled(mod.key)
                                return (
                                  <div key={mod.key} className={`bg-white rounded-2xl p-4 border-2 transition-all ${enabled ? 'border-[#C9A84C] shadow-sm' : 'border-gray-200 opacity-70'}`}>
                                    <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${enabled ? 'bg-[#F7F4EE]' : 'bg-gray-100'}`}>{mod.icon}</div>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm text-gray-900">{t(`syndicDash.modules.${mod.key}.label`, mod.label)}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{t(`syndicDash.modules.${mod.key}.desc`, mod.description)}</div>
                                      </div>
                                      <button onClick={() => toggleModule(mod.key)} className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${enabled ? 'bg-[#0D1B2E]' : 'bg-gray-200'}`}>
                                        <div className="w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-all" style={{ left: enabled ? '24px' : '4px' }} />
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
              })()}

              {/* ── Ordre du menu — groupé par catégorie ── */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">↕️ {t('syndicDash.modulesConfig.menuOrder')}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{t('syndicDash.modulesConfig.dragHint')}</p>
                  </div>
                  <button
                    onClick={() => saveNavOrder(allNavItems.map(n => n.id as string))}
                    className="text-xs text-gray-500 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
                  >
                    ↺ {t('syndicDash.modulesConfig.reset')}
                  </button>
                </div>
                {SIDEBAR_CATEGORIES.map(cat => {
                  const catItems = navItems.filter(item => item.category === cat.key && item.id !== 'modules')
                  if (catItems.length === 0) return null
                  const catIds = catItems.map(n => n.id as string)
                  return (
                    <div key={cat.key} className="mb-5">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">{cat.label}</div>
                      <div className="flex flex-col gap-2">
                        {catItems.map((item, idx) => {
                          const isMod = SYNDIC_MODULES.some(m => m.key === item.id)
                          return (
                            <div
                              key={item.id}
                              className={`flex items-center gap-3 bg-white border-2 rounded-xl px-4 py-3 transition-all group ${isMod ? 'border-[#E4DDD0] hover:border-[#C9A84C]' : 'border-gray-200 hover:border-gray-400'}`}
                            >
                              <span className="text-gray-300 group-hover:text-gray-500 select-none text-lg leading-none font-mono">⠿</span>
                              <span className="text-xl w-6 text-center">{item.emoji}</span>
                              <span className="flex-1 font-semibold text-sm text-gray-800">{item.label}</span>
                              {!isMod && (
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{locale === 'pt' ? 'fixo' : 'fixe'}</span>
                              )}
                              <span className="text-xs text-gray-500 font-mono w-5 text-center">{idx + 1}</span>
                              <div className="flex flex-col gap-0.5">
                                <button
                                  onClick={() => moveNavItemUp(item.id as string, catIds)}
                                  disabled={idx === 0}
                                  className="w-6 h-5 flex items-center justify-center rounded text-gray-500 hover:text-[#C9A84C] hover:bg-[#F7F4EE] disabled:opacity-20 disabled:cursor-not-allowed transition text-xs font-bold"
                                >▲</button>
                                <button
                                  onClick={() => moveNavItemDown(item.id as string, catIds)}
                                  disabled={idx === catItems.length - 1}
                                  className="w-6 h-5 flex items-center justify-center rounded text-gray-500 hover:text-[#C9A84C] hover:bg-[#F7F4EE] disabled:opacity-20 disabled:cursor-not-allowed transition text-xs font-bold"
                                >▼</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">💡</span>
                  <div>
                    <div className="font-semibold text-blue-800 text-sm">{locale === 'pt' ? 'Dica' : 'Astuce'}</div>
                    <div className="text-xs text-blue-600 mt-0.5">{locale === 'pt' ? 'Os módulos desativados desaparecem da barra lateral mas permanecem acessíveis a qualquer momento. Os seus dados nunca são eliminados.' : 'Les modules désactivés disparaissent de la barre latérale mais restent accessibles à tout moment. Vos données ne sont jamais supprimées.'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PARAMÈTRES ── */}
          {page === 'parametres' && (
            <div className="max-w-2xl space-y-6">

              {/* ── Section Mon Profil (visible par TOUS les utilisateurs) ── */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-xl">👤</span> {locale === 'pt' ? 'O Meu Perfil' : 'Mon Profil'}
                </h2>
                <div className="space-y-4">
                  {/* Nom + Rôle */}
                  <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-4">
                    <div className="w-12 h-12 rounded-full bg-[#0D1B2E] text-white flex items-center justify-center font-bold text-lg">{initials}</div>
                    <div>
                      <p className="font-semibold text-gray-900">{userName}</p>
                      <span className={`inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${ROLE_COLORS[userRole] || 'bg-gray-100 text-gray-800'}`}>
                        {getRoleLabel(userRole, locale === 'pt' ? 'pt' : 'fr')}
                      </span>
                    </div>
                  </div>
                  {/* Ma signature digitale */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'A minha assinatura digital' : 'Ma signature digitale'}</label>
                    <div className="flex items-center gap-4">
                      {syndicSignature ? (
                        <div className="relative">
                          <div className="border border-gray-200 rounded-lg bg-white p-2" style={{ width: 200, height: 80 }} dangerouslySetInnerHTML={{ __html: syndicSignature.svg_data.replace(/width="400"/, 'width="200"').replace(/height="160"/, 'height="80"') }} />
                          <div className="text-[10px] text-gray-500 mt-1">{syndicSignature.signataire} — {new Date(syndicSignature.timestamp).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</div>
                          <button onClick={() => { setSyndicSignature(null); if (user) localStorage.removeItem(`fixit_syndic_signature_${user.id}`) }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">×</button>
                        </div>
                      ) : null}
                      <button
                        onClick={() => setShowSignatureModal(true)}
                        className="bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-600 transition"
                      >
                        ✍️ {syndicSignature ? (locale === 'pt' ? 'Refazer assinatura' : 'Refaire la signature') : (locale === 'pt' ? 'Desenhar a minha assinatura' : 'Dessiner ma signature')}
                      </button>
                    </div>
                    {!syndicSignature && (
                      <p className="text-xs text-amber-600 mt-2">⚠️ {locale === 'pt' ? 'Nenhuma assinatura configurada — os PDFs gerados não terão assinatura.' : 'Aucune signature configurée — les PDF générés n\'auront pas de signature.'}</p>
                    )}
                  </div>
                  <button onClick={() => { if (syndicSignature && user) { localStorage.setItem(`fixit_syndic_signature_${user.id}`, JSON.stringify(syndicSignature)); setParamSaved(true); setTimeout(() => setParamSaved(false), TOAST_SHORT) } }} className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-5 py-2 rounded-lg font-semibold transition text-sm">
                    {locale === 'pt' ? 'Guardar assinatura' : 'Enregistrer la signature'}
                  </button>
                </div>
              </div>

              {/* ── Section Mon Cabinet (admin=syndic/syndic_admin uniquement) ── */}
              {(userRole === 'syndic' || userRole === 'syndic_admin') && (
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-xl">🏢</span> {locale === 'pt' ? 'O Meu Gabinete' : 'Mon Cabinet'}
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Nome do gabinete' : 'Nom du cabinet'}</label>
                    <input
                      type="text"
                      value={cabinetNom}
                      onChange={e => setCabinetNom(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none"
                      placeholder={locale === 'pt' ? 'Ex: Administração Silva & Associados' : 'Ex : Syndic Dupont & Associés'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={cabinetEmail}
                      onChange={e => setCabinetEmail(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Morada do gabinete' : 'Adresse du cabinet'}</label>
                    <textarea
                      value={cabinetAddress}
                      onChange={e => setCabinetAddress(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none resize-none"
                      placeholder={locale === 'pt' ? 'Ex: Rua das Flores 123, 1000-001 Lisboa' : 'Ex : 12 rue de la Paix, 75002 Paris'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Logo do gabinete' : 'Logo du cabinet'}</label>
                    <div className="flex items-center gap-4">
                      {cabinetLogo && (
                        <div className="relative">
                          <img src={cabinetLogo} alt="Logo" loading="lazy" width={64} height={64} className="w-16 h-16 object-contain border border-gray-200 rounded-lg bg-white p-1" />
                          <button onClick={() => { setCabinetLogo(null); if (user) localStorage.removeItem(`fixit_syndic_logo_${user.id}`) }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">×</button>
                        </div>
                      )}
                      <label className="cursor-pointer bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-600 transition">
                        📷 {cabinetLogo ? (locale === 'pt' ? 'Alterar logo' : 'Changer le logo') : (locale === 'pt' ? 'Carregar logo (PNG/JPG, max 200KB)' : 'Charger un logo (PNG/JPG, max 200KB)')}
                        <input type="file" accept="image/png,image/jpeg" onChange={handleLogoUpload} className="hidden" />
                      </label>
                    </div>
                    {!cabinetLogo && (
                      <p className="text-xs text-amber-600 mt-2">⚠️ {locale === 'pt' ? 'Nenhum logo configurado — os PDFs gerados não terão logo.' : 'Aucun logo configuré — les PDF générés n\'auront pas de logo.'}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={handleSaveParams} className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-6 py-2.5 rounded-lg font-semibold transition">
                      {t('syndicDash.settings.saveChanges')}
                    </button>
                    {paramSaved && (
                      <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                        ✅ {t('syndicDash.common.save')} !
                      </span>
                    )}
                  </div>
                </div>
              </div>
              )}

              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">{locale === 'pt' ? 'Subscrição' : 'Abonnement'}</h2>
                <div className="bg-[#F7F4EE] border border-[#E4DDD0] rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[#0D1B2E]">{locale === 'pt' ? 'Teste gratuito' : 'Essai gratuit'}</p>
                      <p className="text-sm text-[#C9A84C]">{locale === 'pt' ? '14 dias restantes · Acesso completo' : '14 jours restants · Accès complet'}</p>
                    </div>
                    <span className="bg-[#0D1B2E] text-white text-xs font-bold px-3 py-1 rounded-full">TRIAL</span>
                  </div>
                </div>
                <button className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-lg font-bold transition">
                  {locale === 'pt' ? 'Escolher uma subscrição → a partir de 49€/mês' : 'Choisir un abonnement → à partir de 49€/mois'}
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">📧 {locale === 'pt' ? 'Agente Email Fixy' : 'Agent Email Fixy'}</h2>
                <p className="text-sm text-gray-500 mb-4">{locale === 'pt' ? 'Conecte a sua caixa Gmail para que o Fixy analise automaticamente os seus emails: urgências, tipos de pedidos, sugestões de ações.' : 'Connectez votre boîte Gmail pour que Fixy analyse automatiquement vos emails : urgences, types de demandes, suggestions d\'actions.'}</p>
                <GmailConnectButton syndicId={user?.id} userEmail={user?.email} />
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">{t('syndicDash.common.notifications')}</h2>
                {notifSettings.map((n, idx) => (
                  <div key={n.label} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-700">{n.label}</span>
                    <button
                      onClick={() => setNotifSettings(prev => prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item))}
                      className={`w-11 h-6 rounded-full transition-all cursor-pointer relative ${n.checked ? 'bg-[#0D1B2E]' : 'bg-gray-200'}`}
                      aria-label={`Activer/désactiver ${n.label}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all`} style={{ left: n.checked ? '22px' : '2px' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
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
          onAdd={async (m) => {
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
            if ((m as any).demandeurEmail || (m as any).locataire) {
              const demandeurKey = `canal_demandeur_${((m as any).demandeurEmail || (m as any).locataire || '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
              const now = new Date()
              const dateIntervStr = m.dateIntervention
                ? new Date(m.dateIntervention).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : null
              const heureStr = (m as any).heureIntervention || null
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
                      adresse: (m as any).adresseImmeuble || '',
                      priorite: m.priorite || 'normale',
                      notes: (m as any).locataire ? `Locataire : ${(m as any).locataire}` : '',
                    }),
                  })
                  const assignData = await assignRes.json().catch(() => ({}))
                  console.info('[SYNDIC onAdd] assign-mission status:', assignRes.status, assignData)
                  if (assignRes.status === 401) {
                    // Session expirée ou conflit de compte — recharger
                    window.alert(locale === 'pt' ? '⚠️ Sessão expirada. Atualize a página e reconecte-se como administrador síndico.' : '⚠️ Session expirée. Veuillez actualiser la page et vous reconnecter en tant qu\'administrateur syndic.')
                  } else if (!assignData.artisan_found) {
                    if (process.env.NODE_ENV !== 'production') console.warn('[SYNDIC onAdd] Artisan non trouvé en base :', m.artisan, assignData)
                  }
                }
              } catch (err) { if (process.env.NODE_ENV !== 'production') console.error('[SYNDIC onAdd] assign-mission failed:', err) }
            }
          }}
        />
      )}

      {/* ── Modal Ajouter un Artisan ── */}
      {showModalArtisan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">🔧 {locale === 'pt' ? 'Adicionar um artesão' : 'Ajouter un artisan'}</h2>
                <button onClick={() => setShowModalArtisan(false)} aria-label={t('syndicDash.common.close')} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">×</button>
              </div>

              {artisanSuccess ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-3">✅</div>
                  <p className="text-green-700 font-semibold text-lg">{artisanSuccess}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Étape 1 : email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Email do artesão *' : 'Email de l\'artisan *'}</label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={artisanForm.email}
                        onChange={e => { setArtisanForm(f => ({ ...f, email: e.target.value })); setArtisanSearchResult(null) }}
                        placeholder="artisan@exemple.fr"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                      />
                      <button
                        onClick={() => handleArtisanEmailSearch(artisanForm.email)}
                        disabled={artisanSearchLoading || !artisanForm.email.includes('@')}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition disabled:opacity-40"
                      >
                        {artisanSearchLoading ? '⏳' : (locale === 'pt' ? '🔍 Verificar' : '🔍 Vérifier')}
                      </button>
                    </div>
                    {artisanSearchResult && (
                      <div className={`mt-2 p-3 rounded-lg text-sm ${artisanSearchResult.found ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'}`}>
                        {artisanSearchResult.found
                          ? <>✅ {locale === 'pt' ? 'Conta Vitfix encontrada' : 'Compte Vitfix trouvé'} — <strong>{artisanSearchResult.name}</strong> ({artisanSearchResult.role === 'artisan' ? (locale === 'pt' ? 'artesão certificado' : 'artisan certifié') : artisanSearchResult.role})<br/><span className="text-xs">{locale === 'pt' ? 'Será sincronizado com o seu gabinete.' : 'Il sera synchronisé avec votre cabinet.'}</span></>
                          : <>{locale === 'pt' ? '⚠️ Nenhuma conta Vitfix. Pode criar uma conta de artesão ou adicioná-lo sem conta.' : '⚠️ Aucun compte Vitfix. Vous pouvez créer un compte artisan ou l\'ajouter sans compte.'}</>
                        }
                      </div>
                    )}
                  </div>

                  {/* Infos artisan */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Nome próprio' : 'Prénom'}</label>
                      <input type="text" value={artisanForm.prenom} onChange={e => setArtisanForm(f => ({ ...f, prenom: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" placeholder="Jean" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Apelido *' : 'Nom *'}</label>
                      <input type="text" value={artisanForm.nom} onChange={e => setArtisanForm(f => ({ ...f, nom: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" placeholder="Dupont" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Telefone' : 'Téléphone'}</label>
                      <input type="tel" value={artisanForm.telephone} onChange={e => setArtisanForm(f => ({ ...f, telephone: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" placeholder="06 12 34 56 78" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Área profissional' : 'Corps de métier'}</label>
                      <select value={artisanForm.metier} onChange={e => setArtisanForm(f => ({ ...f, metier: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]">
                        <option value="">{locale === 'pt' ? 'Selecionar...' : 'Sélectionner...'}</option>
                        <option>{locale === 'pt' ? 'Canalização' : 'Plomberie'}</option>
                        <option>{locale === 'pt' ? 'Eletricidade' : 'Électricité'}</option>
                        <option>{locale === 'pt' ? 'Pintura' : 'Peinture'}</option>
                        <option>{locale === 'pt' ? 'Carpintaria' : 'Menuiserie'}</option>
                        <option>{locale === 'pt' ? 'Aquecimento / Climatização' : 'Chauffage / Climatisation'}</option>
                        <option>{locale === 'pt' ? 'Serralharia' : 'Serrurerie'}</option>
                        <option>{locale === 'pt' ? 'Alvenaria' : 'Maçonnerie'}</option>
                        <option>{locale === 'pt' ? 'Telhados' : 'Toiture'}</option>
                        <option>{locale === 'pt' ? 'Elevador' : 'Ascenseur'}</option>
                        <option>{locale === 'pt' ? 'Jardinagem / Espaços verdes' : 'Jardinage / Espaces verts'}</option>
                        <option>{locale === 'pt' ? 'Limpeza' : 'Nettoyage'}</option>
                        <option>{locale === 'pt' ? 'Multi-serviços' : 'Multi-services'}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'NIF (opcional)' : 'SIRET (optionnel)'}</label>
                    <input type="text" value={artisanForm.siret} onChange={e => setArtisanForm(f => ({ ...f, siret: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" placeholder="12345678901234" maxLength={14} />
                  </div>

                  {artisanError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{artisanError}</div>
                  )}

                  {/* Boutons d'action */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowModalArtisan(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
                      {locale === 'pt' ? 'Cancelar' : 'Annuler'}
                    </button>
                    {artisanSearchResult?.found ? (
                      <button
                        onClick={() => handleAddArtisan(false)}
                        disabled={artisanSubmitting || !artisanForm.email || !artisanForm.nom}
                        className="flex-1 px-4 py-2 bg-[#0D1B2E] hover:bg-[#152338] text-white rounded-lg text-sm font-semibold transition disabled:opacity-40"
                      >
                        {artisanSubmitting ? (locale === 'pt' ? 'Sincronização...' : 'Synchronisation...') : (locale === 'pt' ? '🔗 Sincronizar com o meu gabinete' : '🔗 Synchroniser avec mon cabinet')}
                      </button>
                    ) : artisanSearchResult && !artisanSearchResult.found ? (
                      <div className="flex-1 flex flex-col gap-2">
                        <button
                          onClick={() => handleAddArtisan(true)}
                          disabled={artisanSubmitting || !artisanForm.email || !artisanForm.nom}
                          className="w-full px-4 py-2 bg-[#0D1B2E] hover:bg-[#152338] text-white rounded-lg text-sm font-semibold transition disabled:opacity-40"
                        >
                          {artisanSubmitting ? (locale === 'pt' ? 'Criação...' : 'Création...') : (locale === 'pt' ? '+ Criar a conta artesão' : '+ Créer le compte artisan')}
                        </button>
                        <button
                          onClick={() => handleAddArtisan(false)}
                          disabled={artisanSubmitting || !artisanForm.email || !artisanForm.nom}
                          className="w-full px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-40"
                        >
                          {locale === 'pt' ? 'Adicionar sem conta Vitfix' : 'Ajouter sans compte Vitfix'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddArtisan(false)}
                        disabled={artisanSubmitting || !artisanForm.email || !artisanForm.nom}
                        className="flex-1 px-4 py-2 bg-[#0D1B2E] hover:bg-[#152338] text-white rounded-lg text-sm font-semibold transition disabled:opacity-40"
                      >
                        {artisanSubmitting ? (locale === 'pt' ? 'A adicionar...' : 'Ajout...') : (locale === 'pt' ? '+ Adicionar o artesão' : '+ Ajouter l\'artisan')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Ajouter/Modifier un Immeuble ── */}
      {showModalImmeuble && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingImmeuble ? (locale === 'pt' ? '✏️ Modificar o edifício' : '✏️ Modifier l\'immeuble') : (locale === 'pt' ? '🏢 Adicionar um edifício' : '🏢 Ajouter un immeuble')}
                </h2>
                <button onClick={() => setShowModalImmeuble(false)} aria-label={t('syndicDash.common.close')} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">×</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Nome do edifício *' : 'Nom de l\'immeuble *'}</label>
                  <input
                    type="text"
                    value={immeubleForm.nom || ''}
                    onChange={e => setImmeubleForm(f => ({ ...f, nom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                    placeholder={locale === 'pt' ? 'Residência As Acácias' : 'Résidence Les Acacias'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Morada *' : 'Adresse *'}</label>
                  <input
                    type="text"
                    value={immeubleForm.adresse || ''}
                    onChange={e => setImmeubleForm(f => ({ ...f, adresse: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                    placeholder={locale === 'pt' ? 'Rua das Acácias, 12' : '12 rue des Acacias'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Código postal' : 'Code postal'}</label>
                    <input
                      type="text"
                      value={immeubleForm.codePostal || ''}
                      onChange={e => setImmeubleForm(f => ({ ...f, codePostal: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                      placeholder="75008"
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Cidade' : 'Ville'}</label>
                    <input
                      type="text"
                      value={immeubleForm.ville || ''}
                      onChange={e => setImmeubleForm(f => ({ ...f, ville: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                      placeholder={locale === 'pt' ? 'Lisboa' : 'Paris'}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Número de frações' : 'Nombre de lots'}</label>
                    <input
                      type="number"
                      min={1}
                      value={immeubleForm.nbLots || 1}
                      onChange={e => setImmeubleForm(f => ({ ...f, nbLots: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Ano de construção' : 'Année de construction'}</label>
                    <input
                      type="number"
                      min={1800}
                      max={new Date().getFullYear()}
                      value={immeubleForm.anneeConstruction || 2000}
                      onChange={e => setImmeubleForm(f => ({ ...f, anneeConstruction: parseInt(e.target.value) || 2000 }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Tipo' : 'Type'}</label>
                    <select
                      value={immeubleForm.typeImmeuble || (locale === 'pt' ? 'Condomínio' : 'Copropriété')}
                      onChange={e => setImmeubleForm(f => ({ ...f, typeImmeuble: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                    >
                      <option>{locale === 'pt' ? 'Condomínio' : 'Copropriété'}</option>
                      <option>{locale === 'pt' ? 'Residência' : 'Résidence'}</option>
                      <option>{locale === 'pt' ? 'Edifício misto' : 'Immeuble mixte'}</option>
                      <option>{locale === 'pt' ? 'Parque residencial' : 'Parc résidentiel'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Gestor' : 'Gestionnaire'}</label>
                    <input
                      type="text"
                      value={immeubleForm.gestionnaire || ''}
                      onChange={e => setImmeubleForm(f => ({ ...f, gestionnaire: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                      placeholder={locale === 'pt' ? 'João Silva' : 'Jean Dupont'}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Orçamento anual (€)' : 'Budget annuel (€)'}</label>
                    <input
                      type="number"
                      min={0}
                      value={immeubleForm.budgetAnnuel || 0}
                      onChange={e => setImmeubleForm(f => ({ ...f, budgetAnnuel: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Próximo controlo' : 'Prochain contrôle'}</label>
                    <input
                      type="date"
                      value={immeubleForm.prochainControle || ''}
                      onChange={e => setImmeubleForm(f => ({ ...f, prochainControle: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>
                </div>
                {/* ── Section Règlement de copropriété ── */}
                <div className="border-t border-gray-100 pt-4 mt-2">
                  <p className="text-sm font-semibold text-gray-700 mb-3">📜 {locale === 'pt' ? 'Regulamento de condomínio' : 'Règlement de copropriété'}</p>
                  <div className="space-y-3">
                    {/* Upload PDF ou texte */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{locale === 'pt' ? 'Importar o regulamento (PDF ou texto)' : 'Importer le règlement (PDF ou texte)'}</label>
                      <div className="flex gap-2 items-center">
                        <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed border-[#C9A84C] bg-[#F7F4EE] hover:bg-[#F7F4EE] rounded-lg text-xs text-[#C9A84C] font-medium transition flex-1">
                          <span>📄</span>
                          <span>{immeubleForm.reglementPdfNom || (locale === 'pt' ? 'Escolher um PDF…' : 'Choisir un PDF…')}</span>
                          <input
                            type="file"
                            accept=".pdf,.txt,.doc,.docx"
                            className="hidden"
                            onChange={async e => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              setImmeubleForm(f => ({ ...f, reglementPdfNom: file.name, reglementDateMaj: new Date().toISOString().split('T')[0] }))
                              // Lire le fichier texte si c'est un .txt
                              if (file.type === 'text/plain') {
                                const text = await file.text()
                                setImmeubleForm(f => ({ ...f, reglementTexte: text }))
                              }
                            }}
                          />
                        </label>
                        {immeubleForm.reglementPdfNom && (
                          <button onClick={() => setImmeubleForm(f => ({ ...f, reglementPdfNom: '', reglementTexte: '' }))} aria-label={t('syndicDash.common.delete')} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                        )}
                      </div>
                    </div>
                    {/* Texte libre */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{locale === 'pt' ? 'Texto do regulamento' : 'Texte du règlement'} <span className="text-gray-500">{locale === 'pt' ? '(colar ou digitar)' : '(coller ou saisir)'}</span></label>
                      <textarea
                        rows={5}
                        value={immeubleForm.reglementTexte || ''}
                        onChange={e => setImmeubleForm(f => ({ ...f, reglementTexte: e.target.value, reglementDateMaj: new Date().toISOString().split('T')[0] }))}
                        placeholder={locale === 'pt' ? 'Cole aqui o texto do regulamento de condomínio, ou os artigos importantes (repartição de encargos, maiorias AG, fundo de reserva…)' : 'Collez ici le texte du règlement de copropriété, ou les articles importants (répartition des charges, majorités AG, fonds de travaux…)'}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#C9A84C] resize-none font-mono leading-relaxed"
                      />
                    </div>
                    {/* Métadonnées clés */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{locale === 'pt' ? 'Repartição de encargos' : 'Répartition des charges'}</label>
                        <input
                          type="text"
                          value={immeubleForm.reglementChargesRepartition || ''}
                          onChange={e => setImmeubleForm(f => ({ ...f, reglementChargesRepartition: e.target.value }))}
                          placeholder={locale === 'pt' ? 'Ex: permilagem / milésimos' : 'Ex: tantièmes / millièmes'}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#C9A84C]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{locale === 'pt' ? 'Maiorias AG (art. 24/25/26)' : 'Majorités AG (art. 24/25/26)'}</label>
                        <input
                          type="text"
                          value={immeubleForm.reglementMajoriteAG || ''}
                          onChange={e => setImmeubleForm(f => ({ ...f, reglementMajoriteAG: e.target.value }))}
                          placeholder={locale === 'pt' ? 'Ex: art.24 maioria simples…' : 'Ex: art.24 majorité simple…'}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#C9A84C]"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!immeubleForm.reglementFondsTravaux}
                          onChange={e => setImmeubleForm(f => ({ ...f, reglementFondsTravaux: e.target.checked }))}
                          className="rounded"
                        />
                        {locale === 'pt' ? 'Fundo de reserva obrigatório (art. 14-2)' : 'Fonds de travaux obligatoire (art. 14-2)'}
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">{locale === 'pt' ? 'Fundo maneio (%)' : 'Fonds roulement (%)'}</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={immeubleForm.reglementFondsRoulementPct ?? ''}
                          onChange={e => setImmeubleForm(f => ({ ...f, reglementFondsRoulementPct: parseFloat(e.target.value) || 0 }))}
                          placeholder="0"
                          className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#C9A84C]"
                        />
                      </div>
                    </div>
                    {immeubleForm.reglementDateMaj && (
                      <p className="text-xs text-gray-500">{locale === 'pt' ? 'Última atualização' : 'Dernière mise à jour'} : {new Date(immeubleForm.reglementDateMaj).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowModalImmeuble(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
                    {locale === 'pt' ? 'Cancelar' : 'Annuler'}
                  </button>
                  <button
                    onClick={handleSaveImmeuble}
                    disabled={!immeubleForm.nom?.trim() || !immeubleForm.adresse?.trim()}
                    className="flex-1 px-4 py-2 bg-[#0D1B2E] hover:bg-[#152338] text-white rounded-lg text-sm font-semibold transition disabled:opacity-40"
                  >
                    {editingImmeuble ? (locale === 'pt' ? '✅ Guardar' : '✅ Sauvegarder') : (locale === 'pt' ? '+ Adicionar o edifício' : '+ Ajouter l\'immeuble')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
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
                disabled={!planningEventForm.titre.trim()}
                className="flex-1 py-2.5 bg-[#0D1B2E] hover:bg-[#152338] text-white rounded-xl text-sm font-bold transition disabled:opacity-40 shadow-sm"
              >
                ✅ {locale === 'pt' ? 'Adicionar' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Fixy — Assistant d'Action (panneau flottant) ─── */}
      {user && !fixyPanelOpen && (
        <button
          onClick={() => setFixyPanelOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#FFC107] hover:bg-[#FFD54F] rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
          title={locale === 'pt' ? 'Abrir Fixy — Assistente de Ação' : 'Ouvrir Fixy — Assistant d\'Action'}
        >
          <svg width={32} height={32} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="25" y="45" width="50" height="35" rx="8" fill="#FFC107"/><rect x="28" y="18" width="44" height="30" rx="10" fill="#FFD54F"/>
            <circle cx="40" cy="30" r="5" fill="#1a1a2e"/><circle cx="60" cy="30" r="5" fill="#1a1a2e"/>
            <circle cx="42" cy="28" r="1.5" fill="white"/><circle cx="62" cy="28" r="1.5" fill="white"/>
            <path d="M42 38 Q50 44 58 38" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <line x1="50" y1="18" x2="50" y2="8" stroke="#FFC107" strokeWidth="3" strokeLinecap="round"/><circle cx="50" cy="6" r="4" fill="#FF9800"/>
            <rect x="12" y="50" width="13" height="6" rx="3" fill="#FFD54F"/>
            <rect x="33" y="80" width="10" height="12" rx="4" fill="#FFD54F"/><rect x="57" y="80" width="10" height="12" rx="4" fill="#FFD54F"/>
            <rect x="30" y="62" width="40" height="4" rx="2" fill="#FF9800"/><circle cx="50" cy="55" r="3" fill="#FF9800"/>
          </svg>
          {iaPendingAction && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white" />
          )}
        </button>
      )}

      {user && fixyPanelOpen && (
        <div
          role="dialog"
          aria-label={locale === 'pt' ? 'Fixy — Assistente de Ação' : 'Fixy — Assistant d\'Action'}
          onKeyDown={(e) => { if (e.key === 'Escape') setFixyPanelOpen(false) }}
          className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: 'min(680px, calc(100vh - 4rem))' }}
        >

          {/* ── Header Fixy ── */}
          <div className="bg-gradient-to-r from-[#FFC107] to-[#FFD54F] p-3 flex items-center gap-2.5 flex-shrink-0">
            <svg width={36} height={36} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="25" y="45" width="50" height="35" rx="8" fill="#FFC107"/><rect x="28" y="18" width="44" height="30" rx="10" fill="#FFD54F"/>
              <circle cx="40" cy="30" r="5" fill="#1a1a2e"/><circle cx="60" cy="30" r="5" fill="#1a1a2e"/>
              <circle cx="42" cy="28" r="1.5" fill="white"/><circle cx="62" cy="28" r="1.5" fill="white"/>
              <path d="M42 38 Q50 44 58 38" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <line x1="50" y1="18" x2="50" y2="8" stroke="#FFC107" strokeWidth="3" strokeLinecap="round"/><circle cx="50" cy="6" r="4" fill="#FF9800"/>
              <rect x="12" y="50" width="13" height="6" rx="3" fill="#FFD54F"/>
              <rect x="33" y="80" width="10" height="12" rx="4" fill="#FFD54F"/><rect x="57" y="80" width="10" height="12" rx="4" fill="#FFD54F"/>
              <rect x="30" y="62" width="40" height="4" rx="2" fill="#FF9800"/><circle cx="50" cy="55" r="3" fill="#FF9800"/>
            </svg>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-sm">{locale === 'pt' ? 'Fixy — Assistente de Ação' : 'Fixy — Assistant d\u0027Action'}</h3>
              <p className="text-amber-800 text-xs">{locale === 'pt' ? 'Voz · Missões · Navegação · Alertas · Documentos' : 'Voix · Missions · Navigation · Alertes · Documents'}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={toggleSpeechEnabled} title={iaSpeechEnabled ? (locale === 'pt' ? 'Desativar voz Fixy' : 'Désactiver voix Fixy') : (locale === 'pt' ? 'Ativar voz Fixy' : 'Activer voix Fixy')} className={`p-1.5 rounded-lg transition text-sm ${iaSpeechEnabled ? 'bg-amber-600/20 text-amber-900' : 'text-amber-700 hover:text-amber-900'}`}>
                {iaSpeechEnabled ? '🔊' : '🔇'}
              </button>
              <button onClick={() => setIaMessages([{ role: 'assistant', content: locale === 'pt' ? 'Conversa apagada. O que posso fazer por si?' : 'Conversation effacée. Que puis-je faire pour vous ?' }])} title={locale === 'pt' ? 'Apagar' : 'Effacer'} className="p-1.5 rounded-lg text-amber-700 hover:text-amber-900 transition text-sm">🗑️</button>
              <button onClick={() => setFixyPanelOpen(false)} title={locale === 'pt' ? 'Fechar Fixy' : 'Fermer Fixy'} className="p-1.5 rounded-lg text-amber-700 hover:text-amber-900 transition text-base font-bold">×</button>
            </div>
          </div>

          {/* ── Bandeau vocal Fixy ── */}
          {iaVoiceActive && (
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-200 px-3 py-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5 items-center flex-shrink-0">
                  {[0, 1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="w-1 bg-red-500 rounded-full" style={{ height: `${6 + Math.sin((Date.now() / 200) + i) * 8 + (i % 3) * 4}px`, animation: `pulse 0.${4 + (i % 3)}s ease-in-out infinite alternate`, animationDelay: `${i * 0.08}s` }} />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-red-700 text-xs font-semibold">🎙️ {locale === 'pt' ? 'Fixy a ouvir' : 'Fixy écoute'}</span>
                    <span className="text-red-400 text-xs font-mono bg-red-100 px-1 py-0.5 rounded">{String(Math.floor(iaVoiceDuration / 60)).padStart(2, '0')}:{String(iaVoiceDuration % 60).padStart(2, '0')}</span>
                    {iaVoiceConfidence > 0 && <span className={`text-xs px-1 py-0.5 rounded ${iaVoiceConfidence > 80 ? 'bg-green-100 text-green-700' : iaVoiceConfidence > 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>{iaVoiceConfidence}%</span>}
                  </div>
                  <div className="mt-0.5 text-xs truncate">
                    {iaInput ? (<><span className="text-gray-800">{iaInput.replace(iaVoiceInterim, '')}</span>{iaVoiceInterim && <span className="text-gray-400 italic">{iaVoiceInterim}</span>}</>) : (<span className="text-red-400 italic">{locale === 'pt' ? 'Fale agora...' : 'Parlez maintenant...'}</span>)}
                  </div>
                </div>
                <button onClick={() => { iaRecognitionRef.current?.stop(); setIaVoiceActive(false); clearInterval(iaVoiceDurationRef.current); setIaVoiceDuration(0); setIaVoiceInterim(''); setIaVoiceConfidence(0) }} className="flex-shrink-0 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-2 py-1 rounded-lg transition">⏹</button>
              </div>
            </div>
          )}

          {/* ── Messages Fixy ── */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {iaMessages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 bg-amber-100 rounded-xl flex items-center justify-center text-sm flex-shrink-0 mt-0.5">🤖</div>
                )}
                <div className="max-w-[85%] flex flex-col gap-1">
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#FFC107] text-gray-900 rounded-tr-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(msg.content) }} />
                    ) : msg.content}
                  </div>
                  {/* Carte de confirmation action */}
                  {msg.action && (
                    <div className="mt-1">
                      {msg.actionStatus === 'pending' ? (
                        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-2.5 space-y-1.5">
                          <p className="text-xs font-semibold text-amber-800">
                            ⚡ {msg.action.type === 'create_mission' ? (locale === 'pt' ? 'Criar missão' : 'Créer mission') : msg.action.type === 'assign_mission' ? (locale === 'pt' ? `Atribuir ${msg.action.artisan || ''}` : `Assigner ${msg.action.artisan || ''}`) : (locale === 'pt' ? 'Atualizar missão' : 'Mise à jour mission')}
                          </p>
                          <div className="text-xs text-amber-700 space-y-0.5">
                            {(msg.action.immeuble || msg.action.lieu) && <p>📍 {msg.action.immeuble || msg.action.lieu}</p>}
                            {msg.action.artisan && <p>👤 {msg.action.artisan}</p>}
                            {msg.action.description && <p>📋 {msg.action.description}</p>}
                            {msg.action.type_travaux && <p>🔧 {msg.action.type_travaux}</p>}
                            {msg.action.date_intervention && <p>📅 {new Date(msg.action.date_intervention).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
                            {msg.action.priorite && <p>⚡ {msg.action.priorite}</p>}
                            {msg.action.statut && <p>📊 → {msg.action.statut}</p>}
                          </div>
                          <div className="flex gap-2 mt-1.5">
                            <button onClick={handleConfirmIaAction} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1.5 rounded-lg font-semibold transition">✓ {locale === 'pt' ? 'Confirmar' : 'Confirmer'}</button>
                            <button onClick={handleCancelIaAction} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs py-1.5 rounded-lg font-semibold transition">✕ {locale === 'pt' ? 'Cancelar' : 'Annuler'}</button>
                          </div>
                        </div>
                      ) : msg.actionStatus === 'confirmed' ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
                          ✅ {msg.action.type === 'create_mission' ? (locale === 'pt' ? `Missão criada — ${msg.action.immeuble || ''}` : `Mission créée — ${msg.action.immeuble || ''}`) : msg.action.type === 'assign_mission' ? (locale === 'pt' ? `Atribuída — ${msg.action.artisan || ''}` : `Assignée — ${msg.action.artisan || ''}`) : (locale === 'pt' ? 'Atualização' : 'Mise à jour')}
                        </span>
                      ) : msg.actionStatus === 'cancelled' ? (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">🚫 {locale === 'pt' ? 'Cancelada' : 'Annulée'}</span>
                      ) : msg.actionStatus === 'error' ? (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">❌ {locale === 'pt' ? 'Erro' : 'Erreur'}</span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
                          ⚡ {msg.action.type === 'navigate' ? `→ ${msg.action.page}` : msg.action.type === 'create_alert' ? (locale === 'pt' ? 'Alerta criado' : 'Alerte créée') : msg.action.type === 'send_message' ? (locale === 'pt' ? 'Mensagem enviada' : 'Message envoyé') : msg.action.type === 'create_document' ? (locale === 'pt' ? 'Documento gerado' : 'Document généré') : `${msg.action.type}`}
                        </span>
                      )}
                    </div>
                  )}
                  {msg.role === 'assistant' && !iaSpeaking && msg.content.length > 20 && (
                    <button onClick={() => speakResponse(msg.content)} className="self-start text-xs text-gray-400 hover:text-amber-600 transition flex items-center gap-1 px-1">🔊 {locale === 'pt' ? 'Ler' : 'Lire'}</button>
                  )}
                </div>
              </div>
            ))}

            {iaLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 bg-amber-100 rounded-xl flex items-center justify-center text-sm flex-shrink-0">🤖</div>
                <div className="bg-white border border-gray-200 px-3 py-2 rounded-2xl rounded-tl-sm">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-xs text-gray-500 ml-1.5">{locale === 'pt' ? 'Fixy a pensar...' : 'Fixy réfléchit...'}</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={iaEndRef} />
          </div>

          {/* ── Suggestions Fixy ── */}
          <div className="px-3 py-1.5 border-t border-gray-100 flex gap-1.5 overflow-x-auto flex-shrink-0">
            {(locale === 'pt' ? [
              { icon: '📋', text: 'Cria uma missão urgente' },
              { icon: '🔴', text: 'Alertas?' },
              { icon: '💶', text: 'Orçamento' },
              { icon: '📄', text: 'RC Pro expirado?' },
              { icon: '✉️', text: 'Convocatória AG' },
              { icon: '📊', text: 'Resumo gabinete' },
            ] : [
              { icon: '📋', text: 'Crée une mission urgente' },
              { icon: '🔴', text: 'Alertes ?' },
              { icon: '💶', text: 'Budget' },
              { icon: '📄', text: 'RC Pro expirée ?' },
              { icon: '✉️', text: 'Courrier convocation AG' },
              { icon: '📊', text: 'Résumé cabinet' },
            ]).map(s => (
              <button key={s.text} onClick={() => { setIaInput(s.text); setTimeout(() => document.getElementById('fixy-input')?.focus(), 50) }}
                className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1 rounded-full whitespace-nowrap hover:bg-amber-100 transition flex-shrink-0">
                {s.icon} {s.text}
              </button>
            ))}
          </div>

          {/* ── Voice Help Overlay ── */}
          {iaVoiceHelp && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 rounded-2xl p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 text-sm">🎙️ {locale === 'pt' ? 'Comandos vocais Fixy' : 'Commandes vocales Fixy'}</h3>
                <button onClick={() => setIaVoiceHelp(false)} aria-label={t('syndicDash.common.close')} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
              </div>
              <div className="space-y-2.5 text-xs">
                {locale === 'pt' ? (<>
                <div><h4 className="font-semibold text-amber-700 mb-0.5">📋 Criar uma missão</h4><p className="text-gray-600 italic">&quot;Cria uma missão canalização para Silva, urgente&quot;</p></div>
                <div><h4 className="font-semibold text-amber-700 mb-0.5">👷 Atribuir um artesão</h4><p className="text-gray-600 italic">&quot;Silva João, jardinagem, 10 março, Parque Corot&quot;</p></div>
                <div><h4 className="font-semibold text-amber-700 mb-0.5">✏️ Atualizar</h4><p className="text-gray-600 italic">&quot;Passa a missão de Silva para concluída&quot;</p></div>
                <div><h4 className="font-semibold text-amber-700 mb-0.5">🧭 Navegação</h4><p className="text-gray-600 italic">&quot;Vai para missões&quot; · &quot;Mostra os alertas&quot;</p></div>
                <div className="pt-1.5 border-t border-gray-200"><p className="text-gray-500 text-xs">💡 Navegação instantânea. Missões e alertas pedem confirmação.</p></div>
                </>) : (<>
                <div><h4 className="font-semibold text-amber-700 mb-0.5">📋 Créer une mission</h4><p className="text-gray-600 italic">&quot;Crée une mission plomberie pour Dupont, urgente&quot;</p></div>
                <div><h4 className="font-semibold text-amber-700 mb-0.5">👷 Assigner un artisan</h4><p className="text-gray-600 italic">&quot;Lepore Sébastien, élagage, 10 mars, Parc Corot&quot;</p></div>
                <div><h4 className="font-semibold text-amber-700 mb-0.5">✏️ Mettre à jour</h4><p className="text-gray-600 italic">&quot;Passe la mission de Lepore en terminée&quot;</p></div>
                <div><h4 className="font-semibold text-amber-700 mb-0.5">🧭 Navigation</h4><p className="text-gray-600 italic">&quot;Va aux missions&quot; · &quot;Montre les alertes&quot;</p></div>
                <div className="pt-1.5 border-t border-gray-200"><p className="text-gray-500 text-xs">💡 Navigation instantanée. Missions et alertes demandent confirmation.</p></div>
                </>)}
              </div>
            </div>
          )}

          {/* ── Input Fixy + Micro ── */}
          <div className="p-3 border-t border-gray-100 bg-white flex-shrink-0 relative">
            <div className="flex gap-1.5">
              {iaVoiceSupported && (
                <button onClick={startVoiceRecognition} title={iaVoiceActive ? (locale === 'pt' ? 'Parar' : 'Arrêter') : (locale === 'pt' ? 'Falar com Fixy' : 'Parler à Fixy')}
                  className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all text-base relative ${
                    iaVoiceActive ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-600'
                  }`}>
                  {iaVoiceActive ? (<><span className="absolute inset-0 rounded-xl bg-red-400 animate-ping opacity-30" /><span className="relative">⏹</span></>) : '🎙️'}
                </button>
              )}
              <div className="flex-1 relative">
                <input id="fixy-input" type="text" value={iaInput} onChange={e => setIaInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !iaLoading && !iaPendingAction) sendIaMessage() }}
                  placeholder={iaVoiceActive ? (locale === 'pt' ? '🎙️ Fale — envio automático...' : '🎙️ Parlez — envoi auto...') : (locale === 'pt' ? 'Diga uma ação ao Fixy...' : 'Dites une action à Fixy...')}
                  className={`w-full px-3 py-2 border-2 rounded-xl focus:outline-none text-sm pr-8 transition ${
                    iaVoiceActive ? 'border-red-300 bg-red-50 text-red-800' : 'border-gray-200 focus:border-amber-400'
                  }`}
                  disabled={iaLoading || !!iaPendingAction} />
                {iaInput && !iaVoiceActive && (
                  <button onClick={() => setIaInput('')} aria-label={t('syndicDash.common.close')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">×</button>
                )}
              </div>
              <button id="ia-send-btn" onClick={() => sendIaMessage()} disabled={iaLoading || !iaInput.trim() || !!iaPendingAction || iaVoiceActive}
                className="flex-shrink-0 w-10 h-10 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 rounded-xl flex items-center justify-center font-bold text-base transition disabled:opacity-40">
                {iaLoading ? <span className="w-3.5 h-3.5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /> : '↑'}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-500">
                {iaVoiceActive ? (locale === 'pt' ? '🔴 Envio automático após silêncio' : '🔴 Envoi auto après silence') : iaVoiceSupported ? (locale === 'pt' ? '🎙️ Voz disponível · Fixy executa em tempo real' : '🎙️ Voix disponible · Fixy exécute en temps réel') : (locale === 'pt' ? '🤖 Fixy executa as suas ações em tempo real' : '🤖 Fixy exécute vos actions en temps réel')}
              </p>
              {iaVoiceSupported && !iaVoiceActive && (
                <button onClick={() => setIaVoiceHelp(p => !p)} className="text-xs text-amber-600 hover:text-amber-800 transition flex-shrink-0 ml-2" title={locale === 'pt' ? 'Ajuda vocal' : 'Aide vocale'}>❓</button>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── Signature Modal ── */}
      {showSignatureModal && (
        <SignatureModal
          documentRef={`CABINET_${cabinetNom.replace(/\s/g, '_')}`}
          signataire={userName}
          onClose={() => setShowSignatureModal(false)}
          onSign={(sigData) => {
            setSyndicSignature(sigData)
            if (user) localStorage.setItem(`fixit_syndic_signature_${user.id}`, JSON.stringify(sigData))
            setShowSignatureModal(false)
          }}
        />
      )}

      {/* ── PDF Generation Modal ── */}
      {showPdfModal && pendingDocData && (() => {
        const isPt = locale === 'pt'
        const todayStr = new Date().toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        // Get copropriétaires filtered by selected immeuble
        const allCopros = coproprios
        const filteredCopros = pdfSelectedImmeuble
          ? allCopros.filter((c: any) => (c.immeuble || '').toLowerCase().includes(pdfSelectedImmeuble.toLowerCase()))
          : allCopros
        const docTypeLabel = (pendingDocData.title || pendingDocData.type || 'Document').replace(/_/g, ' ')

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={() => !pdfGenerating && setShowPdfModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    📄 {isPt ? 'Gerar o documento' : 'Générer le document'}
                  </h2>
                  <button onClick={() => !pdfGenerating && setShowPdfModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
                </div>

                {/* Type + Date */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-600">{isPt ? 'Tipo' : 'Type'} :</span>
                    <span className="font-semibold text-gray-900">{docTypeLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-600">{isPt ? 'Data' : 'Date'} :</span>
                    <span className="text-gray-800">{todayStr}</span>
                  </div>
                </div>

                {/* Immeuble selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">🏢 {isPt ? 'Condomínio' : 'Immeuble'} *</label>
                  <select
                    value={pdfSelectedImmeuble}
                    onChange={e => { setPdfSelectedImmeuble(e.target.value); setPdfSelectedCopro(null) }}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white"
                  >
                    <option value="">{isPt ? '— Selecionar um condomínio —' : '— Sélectionner un immeuble —'}</option>
                    {immeubles.map(im => <option key={im.id} value={im.nom}>{im.nom}{im.adresse ? ` — ${im.adresse}` : ''}</option>)}
                  </select>
                </div>

                {/* Destinataire (copropriétaire) selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">👤 {isPt ? 'Destinatário' : 'Destinataire'} *</label>
                  <select
                    value={pdfSelectedCopro ? JSON.stringify(pdfSelectedCopro) : ''}
                    onChange={e => { try { setPdfSelectedCopro(e.target.value ? JSON.parse(e.target.value) : null) } catch { setPdfSelectedCopro(null) } }}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white"
                    disabled={!pdfSelectedImmeuble}
                  >
                    <option value="">{!pdfSelectedImmeuble ? (isPt ? 'Selecione primeiro um condomínio' : 'Sélectionnez d\'abord un immeuble') : (isPt ? '— Selecionar um destinatário —' : '— Sélectionner un destinataire —')}</option>
                    {/* Option "Tous les copropriétaires" for AG/charges docs */}
                    {pdfSelectedImmeuble && ['convocation_ag', 'appel_charges', 'convocation', 'assemblee'].some(t => (pendingDocData.type || '').toLowerCase().includes(t)) && (
                      <option value={JSON.stringify({ _all: true, nom: isPt ? 'Todos os condóminos' : 'Tous les copropriétaires', prenom: '' })}>
                        {isPt ? '👥 Todos os condóminos' : '👥 Tous les copropriétaires'}
                      </option>
                    )}
                    {filteredCopros.map((c: any, idx: number) => {
                      const label = `${c.prenomProprietaire || c.prenom || ''} ${c.nomProprietaire || c.nom || ''}`.trim()
                      const details: string[] = []
                      if (c.batiment) details.push(`${isPt ? 'Bl.' : 'Bât.'} ${c.batiment}`)
                      if (c.etage) details.push(`${c.etage}${isPt ? 'º' : 'e'} ${isPt ? 'andar' : 'ét.'}`)
                      if (c.numeroPorte || c.porte) details.push(`${isPt ? 'Porta' : 'Porte'} ${c.numeroPorte || c.porte}`)
                      return (
                        <option key={idx} value={JSON.stringify(c)}>
                          {label}{details.length > 0 ? ` — ${details.join(', ')}` : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>

                {/* Objet */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">📝 {isPt ? 'Assunto' : 'Objet'}</label>
                  <input
                    type="text"
                    value={pdfObjet}
                    onChange={e => setPdfObjet(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm"
                    placeholder={isPt ? 'Assunto do documento...' : 'Objet du document...'}
                  />
                </div>

                {/* Status indicators */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span>{cabinetLogo ? '✅' : '⚠️'}</span>
                    <span className="text-gray-700">Logo :</span>
                    {cabinetLogo ? (
                      <span className="text-green-600 font-medium">{isPt ? 'Configurado' : 'Configuré'}</span>
                    ) : (
                      <button onClick={() => { setShowPdfModal(false); setPage('parametres') }} className="text-amber-600 font-medium hover:underline">
                        {isPt ? 'Não configurado → Configurar' : 'Non configuré → Configurer'}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span>{syndicSignature ? '✅' : '⚠️'}</span>
                    <span className="text-gray-700">{isPt ? 'Assinatura' : 'Signature'} :</span>
                    {syndicSignature ? (
                      <span className="text-green-600 font-medium">{isPt ? 'Configurada' : 'Configurée'}</span>
                    ) : (
                      <button onClick={() => { setShowPdfModal(false); setPage('parametres') }} className="text-amber-600 font-medium hover:underline">
                        {isPt ? 'Não configurada → Mon Profil' : 'Non configurée → Mon Profil'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowPdfModal(false)}
                    disabled={pdfGenerating}
                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
                  >
                    {isPt ? 'Cancelar' : 'Annuler'}
                  </button>
                  <button
                    onClick={async () => {
                      if (!pdfSelectedImmeuble) { alert(isPt ? 'Selecione um condomínio' : 'Sélectionnez un immeuble'); return }
                      if (!pdfSelectedCopro) { alert(isPt ? 'Selecione um destinatário' : 'Sélectionnez un destinataire'); return }
                      setPdfGenerating(true)
                      try {
                        // Merge modal selections into docData
                        const mergedDocData = { ...pendingDocData }
                        if (pdfObjet) mergedDocData.objet = pdfObjet
                        // Build destinataire from selected copro
                        const copro = pdfSelectedCopro
                        if (copro && !copro._all) {
                          mergedDocData.destinataire = {
                            ...(mergedDocData.destinataire || {}),
                            nom: copro.nomProprietaire || copro.nom || '',
                            prenom: copro.prenomProprietaire || copro.prenom || '',
                            immeuble: pdfSelectedImmeuble,
                            batiment: copro.batiment || '',
                            etage: copro.etage || '',
                            porte: copro.numeroPorte || copro.porte || '',
                          }
                        } else if (copro?._all) {
                          mergedDocData.destinataire = {
                            ...(mergedDocData.destinataire || {}),
                            nom: copro.nom,
                            prenom: '',
                            immeuble: pdfSelectedImmeuble,
                          }
                        }
                        await generateMaxPDF(mergedDocData)
                        setShowPdfModal(false)
                      } catch (err) {
                        console.error('[PDF Modal] Error:', err)
                        alert(isPt ? 'Erro ao gerar o PDF' : 'Erreur lors de la génération du PDF')
                      } finally {
                        setPdfGenerating(false)
                      }
                    }}
                    disabled={pdfGenerating || !pdfSelectedImmeuble || !pdfSelectedCopro}
                    className="px-6 py-2.5 text-sm font-bold text-white bg-[#0D1B2E] hover:bg-[#152338] rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pdfGenerating ? (
                      <><span className="animate-spin">⏳</span> {isPt ? 'A gerar...' : 'Génération...'}</>
                    ) : (
                      <>📄 {isPt ? 'Gerar o PDF' : 'Générer le PDF'}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
