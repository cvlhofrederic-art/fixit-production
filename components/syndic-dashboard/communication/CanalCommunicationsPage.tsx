'use client'

import React, { useState, useRef, useEffect } from 'react'
import type { Mission, Artisan, CanalInterneMsg, PlanningEvent } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CanalCommunicationsPage({
  missions,
  artisans,
  userRole,
  user,
  onUpdateMission,
  onAddMission,
  onOpenMission,
  onCreateMission,
  // Canal Interne props
  canalInterneMessages,
  setCanalInterneMessages,
  canalInterneInput,
  setCanalInterneInput,
  canalInterneType,
  setCanalInterneType,
  canalPlanDate,
  setCanalPlanDate,
  canalPlanHeure,
  setCanalPlanHeure,
  canalPlanResident,
  setCanalPlanResident,
  canalPlanResidence,
  setCanalPlanResidence,
  canalTacheAssignee,
  setCanalTacheAssignee,
  canalTachePriorite,
  setCanalTachePriorite,
  onSendCanalInterne,
  onMarkCanalInterneRead,
  userName,
  onAddPlanningEvent,
}: {
  missions: Mission[]
  artisans: Artisan[]
  userRole: string
  user: User
  onUpdateMission: (m: Mission) => void
  onAddMission: (m: Mission) => void
  onOpenMission: (m: Mission) => void
  onCreateMission: () => void
  // Canal Interne
  canalInterneMessages: CanalInterneMsg[]
  setCanalInterneMessages: React.Dispatch<React.SetStateAction<CanalInterneMsg[]>>
  canalInterneInput: string
  setCanalInterneInput: (v: string) => void
  canalInterneType: 'message' | 'tache' | 'planning'
  setCanalInterneType: (v: 'message' | 'tache' | 'planning') => void
  canalPlanDate: string
  setCanalPlanDate: (v: string) => void
  canalPlanHeure: string
  setCanalPlanHeure: (v: string) => void
  canalPlanResident: string
  setCanalPlanResident: (v: string) => void
  canalPlanResidence: string
  setCanalPlanResidence: (v: string) => void
  canalTacheAssignee: string
  setCanalTacheAssignee: (v: string) => void
  canalTachePriorite: 'normale' | 'urgente'
  setCanalTachePriorite: (v: 'normale' | 'urgente') => void
  onSendCanalInterne: () => Promise<void> | void
  onMarkCanalInterneRead: () => void
  userName: string
  onAddPlanningEvent: (evt: PlanningEvent) => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)
  const [channelView, setChannelView] = useState<'artisans' | 'interne' | 'demandeurs'>('artisans')
  const [sending, setSending] = useState(false)
  const [canalTab, setCanalTab] = useState<'artisan' | 'demandeur'>('artisan')
  const [newMsg, setNewMsg] = useState('')
  const [newMsgDemandeur, setNewMsgDemandeur] = useState('')
  const [authorName] = useState(
    userRole === 'syndic_tech' ? 'Technicien' : userRole === 'syndic_gestionnaire' ? 'Gestionnaire' : 'Gestionnaire'
  )
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const canalInterneEndRef = useRef<HTMLDivElement>(null)

  // ── Modal transfert artisan ──
  const [showTransfert, setShowTransfert] = useState(false)
  const [transfertArtisanId, setTransfertArtisanId] = useState('')
  const [transfertDate, setTransfertDate] = useState('')
  const [transfertDescription, setTransfertDescription] = useState('')
  const [transfertPriorite, setTransfertPriorite] = useState<'urgente' | 'normale' | 'planifiee'>('normale')
  const [transfertLoading, setTransfertLoading] = useState(false)
  const [transfertSuccess, setTransfertSuccess] = useState('')

  const openTransfert = (m: Mission) => {
    setTransfertArtisanId('')
    setTransfertDate(new Date().toISOString().split('T')[0])
    setTransfertDescription(m.description || '')
    setTransfertPriorite(m.priorite || 'normale')
    setTransfertSuccess('')
    setShowTransfert(true)
  }

  const handleTransfert = async () => {
    if (!selectedMission || !transfertArtisanId) return
    const artisan = artisans.find(a => a.id === transfertArtisanId)
    if (!artisan) return
    setTransfertLoading(true)

    const nouvelleM: Mission = {
      id: Date.now().toString(),
      immeuble: selectedMission.immeuble || '',
      artisan: artisan.nom || `${artisan.prenom || ''} ${artisan.nom || ''}`.trim(),
      type: selectedMission.type || artisan.metier || 'Intervention',
      description: transfertDescription,
      priorite: transfertPriorite,
      statut: 'en_attente',
      dateCreation: new Date().toISOString().split('T')[0],
      dateIntervention: transfertDate || undefined,
      batiment: selectedMission.batiment,
      etage: selectedMission.etage,
      numLot: selectedMission.numLot,
      locataire: selectedMission.demandeurNom || selectedMission.locataire,
      telephoneLocataire: selectedMission.telephoneLocataire,
      accesLogement: selectedMission.accesLogement,
      estPartieCommune: selectedMission.estPartieCommune,
      zoneSignalee: selectedMission.zoneSignalee,
      demandeurNom: selectedMission.demandeurNom,
      demandeurRole: selectedMission.demandeurRole,
      demandeurEmail: selectedMission.demandeurEmail,
      canalMessages: [{
        auteur: 'Systeme',
        role: 'system',
        texte: `Mission créée depuis le signalement de ${selectedMission.demandeurNom || 'un résident'}.\n${selectedMission.immeuble}${selectedMission.estPartieCommune ? ` - ${selectedMission.zoneSignalee}` : selectedMission.etage ? ` - Et. ${selectedMission.etage}` : ''}\n${transfertDescription}`,
        date: new Date().toISOString(),
      }],
    }

    if (artisan.artisan_user_id || artisan.email) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        await fetch('/api/syndic/assign-mission', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            artisan_email: artisan.email,
            artisan_user_id: artisan.artisan_user_id,
            artisan_name: artisan.nom,
            description: transfertDescription,
            date_intervention: transfertDate,
            immeuble: selectedMission.immeuble,
            priorite: transfertPriorite,
            notes: `Signalement de ${selectedMission.demandeurNom || 'résident'} - ${selectedMission.estPartieCommune ? selectedMission.zoneSignalee : `Lot ${selectedMission.numLot || 'N/A'}`}`,
          }),
        })
      } catch { /* continue */ }
    }

    onAddMission(nouvelleM)

    const artisanNom = artisan.nom || `${artisan.prenom || ''} ${artisan.nom || ''}`.trim()
    const sysMsg = {
      auteur: 'Gestionnaire',
      role: 'system',
      texte: `Votre demande a été transférée à ${artisanNom} (${artisan.metier}).\nIntervention prévue : ${transfertDate ? new Date(transfertDate).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : 'A confirmer'}\nUn ordre de mission a été créé.`,
      date: new Date().toISOString(),
    }
    onUpdateMission({
      ...selectedMission,
      artisan: artisanNom,
      statut: 'acceptee',
      demandeurMessages: [...(selectedMission.demandeurMessages || []), sysMsg],
    })

    setTransfertLoading(false)
    setTransfertSuccess(`Ordre de mission créé et assigné à ${artisanNom} !`)
    setTimeout(() => { setShowTransfert(false); setTransfertSuccess('') }, 2000)
  }

  // ─── Missions filtrees ───
  const missionsAvecCanal = missions.filter(m => {
    const matchSearch = !search ||
      m.artisan.toLowerCase().includes(search.toLowerCase()) ||
      m.immeuble.toLowerCase().includes(search.toLowerCase()) ||
      m.type.toLowerCase().includes(search.toLowerCase()) ||
      (m.locataire || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.demandeurNom || '').toLowerCase().includes(search.toLowerCase())
    const matchStatut = filterStatut === 'all' || m.statut === filterStatut
    return matchSearch && matchStatut
  })

  const listeVue = channelView === 'demandeurs' ? 'demandeurs' : 'artisans'
  const missionsArtisan = missionsAvecCanal.filter(m => m.artisan && m.artisan.trim() !== '')
  const missionsDemandeur = missionsAvecCanal.filter(m => (m.demandeurNom || m.locataire) && m.demandeurNom !== undefined || (m.demandeurMessages && m.demandeurMessages.length > 0))

  const nbArtisanMsgs = missions.reduce((s, m) => s + (m.canalMessages?.length || 0), 0)
  const nbDemandeurMsgs = missions.reduce((s, m) => s + (m.demandeurMessages?.length || 0), 0)
  const nbInterneMsgs = canalInterneMessages.filter(m => !m.lu).length

  const selectedMission = missions.find(m => m.id === selectedMissionId) || null
  const listeActive = listeVue === 'artisans' ? missionsArtisan : missionsDemandeur

  // ─── Envoi messages ───
  const sendMsg = () => {
    if (!newMsg.trim() || !selectedMission) return
    const msg = { auteur: authorName, role: userRole, texte: newMsg.trim(), date: new Date().toISOString() }
    const updated = { ...selectedMission, canalMessages: [...(selectedMission.canalMessages || []), msg] }
    onUpdateMission(updated)
    setNewMsg('')
  }

  const sendMsgDemandeur = () => {
    if (!newMsgDemandeur.trim() || !selectedMission) return
    const msg = { auteur: authorName, role: userRole, texte: newMsgDemandeur.trim(), date: new Date().toISOString() }
    const updated = {
      ...selectedMission,
      demandeurMessages: [...(selectedMission.demandeurMessages || []), msg],
    }
    onUpdateMission(updated)
    if (selectedMission.demandeurNom || selectedMission.locataire) {
      const rawKey = (selectedMission.demandeurNom || selectedMission.locataire || '').replace(/\s+/g, '_').toLowerCase()
      const demandeurKey = `canal_demandeur_${rawKey}`
      try {
        const existing = JSON.parse(localStorage.getItem(demandeurKey) || '[]')
        existing.push({ ...msg, type: 'gestionnaire_reply' })
        localStorage.setItem(demandeurKey, JSON.stringify(existing))
      } catch { /* ignore */ }
    }
    setNewMsgDemandeur('')
  }

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedMission?.canalMessages?.length, selectedMission?.demandeurMessages?.length, canalTab])

  // Auto-scroll canal interne
  useEffect(() => {
    if (channelView === 'interne') {
      setTimeout(() => canalInterneEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [canalInterneMessages.length, channelView])

  // ─── Status tag mapping (mission list) ───
  const getStatutTag = (statut: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      en_attente: { label: 'En attente', cls: 'sd-tag sd-tag-wait' },
      acceptee:   { label: 'Acceptée',   cls: 'sd-tag sd-tag-ok' },
      en_cours:   { label: 'En cours',   cls: 'sd-tag sd-tag-new' },
      terminee:   { label: 'Terminée',   cls: 'sd-tag sd-tag-ok' },
      annulee:    { label: 'Annulée',    cls: 'sd-tag sd-tag-wait' },
    }
    return map[statut] || { label: statut, cls: 'sd-tag sd-tag-wait' }
  }

  // ─── Status tag for detail panel (longer labels) ───
  const getStatutTagDetail = (statut: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      en_attente: { label: 'En attente validation', cls: 'sd-tag sd-tag-wait' },
      acceptee:   { label: 'Acceptée',              cls: 'sd-tag sd-tag-ok' },
      en_cours:   { label: 'En cours',              cls: 'sd-tag sd-tag-new' },
      terminee:   { label: 'Terminée',              cls: 'sd-tag sd-tag-ok' },
      annulee:    { label: 'Annulée',               cls: 'sd-tag sd-tag-wait' },
    }
    return map[statut] || { label: statut, cls: 'sd-tag sd-tag-wait' }
  }

  const getPrioriteTag = (p?: string) => {
    if (p === 'urgente') return { label: 'Urgent', cls: 'sd-tag sd-tag-urg' }
    if (p === 'planifiee') return { label: 'Planifié', cls: 'sd-tag sd-tag-ok' }
    return { label: 'Normale', cls: 'sd-tag sd-tag-norm' }
  }

  // ─── Format mission display ID (#MSN-YYYY-XXXX) ───
  const formatMissionDisplayId = (id: string, dateCreation?: string) => {
    const year = dateCreation ? new Date(dateCreation).getFullYear() : new Date().getFullYear()
    const numericPart = id.replace(/[^0-9]/g, '')
    const code = numericPart.length >= 4
      ? numericPart.substring(numericPart.length - 4)
      : id.replace(/-/g, '').substring(0, 4).toUpperCase()
    return `#MSN-${year}-${code.padStart(4, '0')}`
  }

  // Helpers
  const demandeurRoleLabel = selectedMission?.demandeurRole === 'coproprio' ? 'Coproprietaire'
    : selectedMission?.demandeurRole === 'locataire' ? 'Locataire'
    : selectedMission?.demandeurRole === 'technicien' ? 'Technicien bâtiment'
    : selectedMission?.locataire ? 'Locataire / Résident'
    : 'Demandeur'

  const demandeurIcon = selectedMission?.demandeurRole === 'coproprio' ? '🏠'
    : selectedMission?.demandeurRole === 'locataire' ? '🔑'
    : selectedMission?.demandeurRole === 'technicien' ? '🔧'
    : '👤'

  const formatTime = (d: string) => new Date(d).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  // Active messages
  const activeMessages = canalTab === 'artisan'
    ? (selectedMission?.canalMessages || [])
    : (selectedMission?.demandeurMessages || [])

  // Quick-reply pills per tab
  const quickReplies = canalTab === 'artisan'
    ? (locale === 'pt'
        ? ['A caminho', 'Confirmado', 'Info em falta', 'Acesso necessário', 'Orçamento enviado']
        : ['En route', 'Confirmé', 'Info manquante', 'Accès requis', 'Devis envoyé'])
    : (locale === 'pt'
        ? ['Pedido tratado', 'Profissional confirmado', 'Visita agendada', 'Intervenção concluída', 'Esclarecimentos necessários']
        : ['Demande traitée', 'Artisan confirmé', 'RDV planifié', 'Intervention terminée', 'Précisions requises'])

  const currentMsg = canalTab === 'artisan' ? newMsg : newMsgDemandeur
  const setCurrentMsg = canalTab === 'artisan' ? setNewMsg : setNewMsgDemandeur
  const sendCurrentMsg = canalTab === 'artisan' ? sendMsg : sendMsgDemandeur

  // Timeline steps for detail panel (5 steps — matching HTML mockup)
  const getTimelineSteps = (m: Mission) => {
    const steps = [
      { label: 'Mission créée',           date: m.dateCreation,        done: true },
      { label: 'Artisan assigné',          date: m.artisan ? m.dateCreation : undefined, done: !!m.artisan },
      { label: 'Intervention démarrée',    date: (m.statut === 'en_cours' || m.statut === 'terminee') ? m.dateIntervention : undefined, done: m.statut === 'en_cours' || m.statut === 'terminee' },
      { label: 'En attente de validation', date: m.statut === 'terminee' ? m.dateIntervention : undefined, done: m.statut === 'terminee' },
      { label: 'Mission clôturée',         date: undefined,             done: false },
    ]
    const currentIdx = steps.findIndex(s => !s.done)
    return steps.map((s, i) => ({
      ...s,
      status: s.done ? 'done' as const : i === currentIdx ? 'current' as const : 'pending' as const,
    }))
  }

  // ─── Show missions panel? ───
  const showMissionsPanel = channelView !== 'interne'

  return (
    <>
      <div className="sd-canal-page flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 80px)' }}>

        {/* ══════ CHANNEL TABS BAR (navy) ══════ */}
        <div className="sd-channel-bar">
          <button
            onClick={() => { setChannelView('artisans'); setSelectedMissionId(null); setCanalTab('artisan') }}
            className={`sd-channel-tab ${channelView === 'artisans' ? 'active' : ''}`}
          >
            <span className="sd-tab-icon">🔧</span> Pro
            {nbArtisanMsgs > 0 && <span className="sd-channel-badge">{nbArtisanMsgs}</span>}
          </button>
          <button
            onClick={() => { setChannelView('interne'); setSelectedMissionId(null); onMarkCanalInterneRead() }}
            className={`sd-channel-tab ${channelView === 'interne' ? 'active' : ''}`}
          >
            <span className="sd-tab-icon">🏢</span> Interne
            {nbInterneMsgs > 0 && channelView !== 'interne' && <span className="sd-channel-badge" style={{ background: 'var(--sd-red-soft)', color: 'var(--sd-red)', borderColor: 'rgba(192,57,43,0.3)' }}>{nbInterneMsgs}</span>}
          </button>
          <button
            onClick={() => { setChannelView('demandeurs'); setSelectedMissionId(null); setCanalTab('demandeur') }}
            className={`sd-channel-tab ${channelView === 'demandeurs' ? 'active' : ''}`}
          >
            <span className="sd-tab-icon">👥</span> Résidents
            {nbDemandeurMsgs > 0 && <span className="sd-channel-badge">{nbDemandeurMsgs}</span>}
          </button>
        </div>

        {/* ══════ THREE-PANEL BODY ══════ */}
        <div className="flex flex-1 overflow-hidden">

          {/* ─── LEFT PANEL: Mission list (320px) ─── */}
          {showMissionsPanel && (
            <div className="w-80 flex-shrink-0 bg-white flex flex-col overflow-hidden" style={{ borderRight: '1px solid var(--sd-border)' }}>

              {/* Header */}
              <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--sd-border)' }}>
                <div className="flex items-center justify-between mb-[14px]">
                  <span className="sd-mp-title">Missions</span>
                </div>

                {/* Segment tabs */}
                <div className="sd-seg-tabs mb-3">
                  <button
                    onClick={() => setChannelView('artisans')}
                    className={`sd-seg-tab ${channelView === 'artisans' ? 'active' : ''}`}
                  >
                    <span>🔧</span> Artisans
                    <span className="sd-seg-count">{missionsArtisan.length}</span>
                  </button>
                  <button
                    onClick={() => setChannelView('demandeurs')}
                    className={`sd-seg-tab ${channelView === 'demandeurs' ? 'active' : ''}`}
                  >
                    <span>👤</span> Résidents
                    <span className="sd-seg-count">{missionsDemandeur.length}</span>
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <svg className="absolute top-1/2 -translate-y-1/2 pointer-events-none" style={{ left: 11 }} width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--sd-ink-3)" strokeWidth="1.6"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={listeVue === 'artisans' ? 'Rechercher artisan, résidence...' : 'Rechercher résident, immeuble...'}
                    className="w-full rounded-lg outline-none"
                    style={{ padding: '9px 14px 9px 36px', background: 'var(--sd-cream)', border: '1px solid var(--sd-border)', color: 'var(--sd-navy)', fontSize: 12 }}
                    onFocus={e => (e.target.style.borderColor = 'var(--sd-gold)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--sd-border)')}
                  />
                </div>
              </div>

              {/* Filter strip */}
              <div className="flex gap-1.5 px-5 py-2.5 overflow-x-auto" style={{ borderBottom: '1px solid var(--sd-border)', scrollbarWidth: 'none' }}>
                {[
                  { val: 'all', label: 'Toutes', dot: undefined },
                  { val: 'en_attente', label: 'Urgent', dot: 'var(--sd-red)' },
                  { val: 'en_cours', label: 'En cours', dot: 'var(--sd-teal)' },
                  { val: 'terminée', label: 'En attente', dot: 'var(--sd-ink-3)' },
                ].map(f => (
                  <button
                    key={f.val}
                    onClick={() => setFilterStatut(f.val)}
                    className={`sd-chip ${filterStatut === f.val ? 'active' : ''}`}
                  >
                    {f.dot && <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: filterStatut === f.val ? 'var(--sd-gold-light)' : f.dot }} />}
                    {f.label}
                  </button>
                ))}
                <button onClick={onCreateMission} className="sd-chip">+ Mission</button>
              </div>

              {/* Mission list */}
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--sd-border) transparent' }}>
                {listeActive.length === 0 ? (
                  <div className="text-center py-16 px-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-3xl" style={{ background: 'white', border: '1px solid var(--sd-border)', boxShadow: '0 4px 16px rgba(13,27,46,0.06)' }}>
                      {listeVue === 'artisans' ? '🔧' : '👥'}
                    </div>
                    <p className="sd-ch-mission" style={{ fontSize: 15 }}>
                      {listeVue === 'artisans' ? 'Aucun ordre de mission' : 'Aucune demande'}
                    </p>
                    <p className="text-xs mt-2" style={{ color: 'var(--sd-ink-3)' }}>
                      {listeVue === 'artisans'
                        ? 'Créez un ordre de mission pour commencer'
                        : 'Les demandes arrivent depuis le portail copropriétaire'}
                    </p>
                    {listeVue === 'artisans' && (
                      <button onClick={onCreateMission} className="mt-4 text-xs font-medium hover:underline" style={{ color: 'var(--sd-gold)' }}>
                        + Créer un ordre de mission
                      </button>
                    )}
                  </div>
                ) : listeActive.map(m => {
                  const lastMsg = listeVue === 'artisans'
                    ? (m.canalMessages && m.canalMessages.length > 0 ? m.canalMessages[m.canalMessages.length - 1] : null)
                    : (m.demandeurMessages && m.demandeurMessages.length > 0 ? m.demandeurMessages[m.demandeurMessages.length - 1] : null)
                  const msgCount = listeVue === 'artisans' ? (m.canalMessages?.length || 0) : (m.demandeurMessages?.length || 0)
                  const isSelected = m.id === selectedMissionId
                  const displayName = listeVue === 'artisans' ? m.artisan : (m.demandeurNom || m.locataire || 'Résident')

                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedMissionId(m.id)
                        setCanalTab(listeVue === 'artisans' ? 'artisan' : 'demandeur')
                      }}
                      className={`sd-mission-item ${isSelected ? 'active' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-1.5" style={{ gap: 8 }}>
                        <span style={{ color: 'var(--sd-navy)', fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                          {m.immeuble}
                          {m.batiment && ` — Bât ${m.batiment}`}
                        </span>
                        <span className="flex-shrink-0 whitespace-nowrap" style={{ color: 'var(--sd-ink-3)', fontSize: 10, marginTop: 1 }}>
                          {lastMsg ? new Date(lastMsg.date).toLocaleTimeString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>

                      <div className="flex items-center mb-2" style={{ gap: 5 }}>
                        <span className="inline-block w-4 h-4 rounded-full flex-shrink-0" style={{ background: 'var(--sd-cream-dark)' }} />
                        <span style={{ color: 'var(--sd-ink-2)', fontSize: 11 }}>{displayName}</span>
                      </div>

                      {lastMsg && (
                        <p className="mb-2 overflow-hidden" style={{
                          color: 'var(--sd-ink-3)', fontSize: 11, lineHeight: 1.45,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                        }}>
                          {lastMsg.texte.substring(0, 80)}{lastMsg.texte.length > 80 ? '...' : ''}
                        </p>
                      )}

                      <div className="flex items-center flex-wrap" style={{ gap: 5 }}>
                        {m.priorite === 'urgente' && <span className="sd-tag sd-tag-urg">Urgent</span>}
                        <span className={getStatutTag(m.statut).cls}>{getStatutTag(m.statut).label}</span>
                        {msgCount > 0 && (
                          <span className="ml-auto text-xs font-bold rounded-full flex items-center justify-center"
                            style={{ width: 18, height: 18, background: 'var(--sd-navy)', color: 'var(--sd-gold-light)', fontSize: 9 }}>
                            {msgCount}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── CENTER PANEL ─── */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--sd-cream)' }}>

            {/* ═══ CANAL INTERNE VIEW ═══ */}
            {channelView === 'interne' ? (
              <>
                {/* Header Canal Interne */}
                <div className="bg-white flex items-center justify-between flex-shrink-0" style={{ padding: '16px 28px', borderBottom: '1px solid var(--sd-border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="sd-av-gestionnaire" style={{ width: 36, height: 36, fontSize: 14 }}>🏢</div>
                    <div>
                      <div className="sd-ch-mission">
                        Canal Interne
                      </div>
                      <div className="text-xs" style={{ color: 'var(--sd-ink-3)' }}>
                        Equipe Syndic &middot; Taches, planning, coordination
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--sd-teal-soft)', color: 'var(--sd-teal)', fontWeight: 600 }}>
                      {canalInterneMessages.length} messages
                    </span>
                  </div>
                </div>

                {/* Messages Canal Interne */}
                <div className="flex-1 overflow-y-auto px-7 py-6 flex flex-col gap-3"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--sd-border) transparent' }}>

                  {canalInterneMessages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                        style={{ background: 'white', border: '1px solid var(--sd-border)', boxShadow: '0 4px 16px rgba(13,27,46,0.06)' }}>
                        🏢
                      </div>
                      <p className="sd-ch-mission">
                        Canal interne vide
                      </p>
                      <p className="text-xs text-center" style={{ color: 'var(--sd-ink-3)', maxWidth: 280, lineHeight: 1.6 }}>
                        Envoyez un message, assignez des tâches ou planifiez des rendez-vous avec votre équipe.
                      </p>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        let lastDateKeyInterne = ''
                        return [...canalInterneMessages].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(msg => {
                        const isMine = msg.de === userName
                        const msgDateInterne = new Date(msg.date)
                        const dateKeyInterne = msgDateInterne.toLocaleDateString('fr-FR', { year: 'numeric', month: 'numeric', day: 'numeric' })
                        const showDateSepInterne = dateKeyInterne !== lastDateKeyInterne
                        if (showDateSepInterne) lastDateKeyInterne = dateKeyInterne
                        const dateLabelInterne = msgDateInterne.toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
                        return (
                          <React.Fragment key={msg.id}>
                            {showDateSepInterne && (
                              <div className="sd-date-sep">
                                <span>{dateLabelInterne}</span>
                              </div>
                            )}
                          <div className={`flex gap-2.5 items-end mb-0.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                            {!isMine && (
                              <div className="sd-av-artisan">
                                {msg.de.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            {isMine && (
                              <div className="sd-av-gestionnaire">
                                {msg.de.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className={`flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`} style={{ maxWidth: '68%' }}>
                              {!isMine && (
                                <span className="text-xs px-1" style={{ color: 'var(--sd-ink-3)', fontSize: 10, fontWeight: 600 }}>
                                  {msg.de} &middot; <span style={{ color: 'var(--sd-gold)' }}>{msg.deRole}</span>
                                </span>
                              )}

                              {/* Planning card */}
                              {msg.type === 'planning' && (
                                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--sd-border)', boxShadow: '0 2px 8px rgba(13,27,46,0.06)' }}>
                                  <div className="flex items-center gap-2 px-4 py-2" style={{ background: 'var(--sd-navy)', color: 'white' }}>
                                    <span>📅</span>
                                    <span className="text-xs font-bold tracking-wide">AJOUT AU PLANNING</span>
                                  </div>
                                  <div className="px-4 py-3" style={{ background: 'var(--sd-cream)' }}>
                                    <p className="font-bold text-sm" style={{ color: 'var(--sd-navy)' }}>{msg.planningResident}</p>
                                    <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--sd-gold)' }}>{msg.planningHeure} &middot; {msg.planningResidence}</p>
                                    {msg.contenu && <p className="text-xs mt-1 italic" style={{ color: 'var(--sd-ink-3)' }}>{msg.contenu}</p>}
                                    <p className="text-xs mt-1" style={{ color: 'var(--sd-ink-3)' }}>
                                      {msg.planningDate && new Date(msg.planningDate + 'T00:00:00').toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </p>
                                    {msg.planningMissionCreee ? (
                                      <span className="inline-flex items-center gap-1 mt-2 text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'var(--sd-teal-soft)', color: 'var(--sd-teal)' }}>
                                        ✓ Ajouté au planning
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          const newEvent: PlanningEvent = {
                                            id: `ce-btn-${msg.id}`,
                                            titre: `Visite — ${msg.planningResident}`,
                                            type: 'rdv',
                                            date: msg.planningDate || new Date().toISOString().slice(0, 10),
                                            heure: msg.planningHeure || '09:00',
                                            dureeMin: 60,
                                            assigneA: userName,
                                            assigneRole: userRole,
                                            description: msg.contenu || `Visite ${msg.planningResident}, ${msg.planningResidence}`,
                                            creePar: msg.de,
                                            statut: 'planifie',
                                          }
                                          onAddPlanningEvent(newEvent)
                                          setCanalInterneMessages(prev => prev.map(m => m.id === msg.id ? { ...m, planningMissionCreee: true } : m))
                                        }}
                                        className="inline-flex items-center gap-1 mt-2 text-xs px-3 py-1.5 rounded-full font-medium transition"
                                        style={{ background: 'var(--sd-gold-dim)', color: 'var(--sd-gold)', border: '1px solid rgba(201,168,76,0.3)' }}
                                      >
                                        + Ajouter au planning
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Tache card */}
                              {msg.type === 'tache' && (
                                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${msg.tachePriorite === 'urgente' ? 'rgba(192,57,43,0.2)' : 'var(--sd-border)'}`, boxShadow: '0 2px 8px rgba(13,27,46,0.06)' }}>
                                  <div className="flex items-center gap-2 px-4 py-2" style={{ background: msg.tachePriorite === 'urgente' ? 'var(--sd-red)' : 'var(--sd-navy)', color: 'white' }}>
                                    <span>✅</span>
                                    <span className="text-xs font-bold tracking-wide">TÂCHE{msg.tachePriorite === 'urgente' ? ' — URGENTE' : ''}</span>
                                  </div>
                                  <div className="px-4 py-3" style={{ background: msg.tachePriorite === 'urgente' ? 'var(--sd-red-soft)' : 'white' }}>
                                    <p className="text-sm font-medium" style={{ color: 'var(--sd-navy)' }}>{msg.contenu}</p>
                                    {msg.tacheAssignee && <p className="text-xs mt-1" style={{ color: 'var(--sd-ink-3)' }}>👤 Pour : <span className="font-medium">{msg.tacheAssignee}</span></p>}
                                    <button
                                      onClick={() => setCanalInterneMessages(prev => prev.map(m =>
                                        m.id === msg.id ? { ...m, tacheStatut: m.tacheStatut === 'terminee' ? 'en_attente' : 'terminee' } : m
                                      ))}
                                      className="inline-flex items-center gap-1 mt-2 text-xs px-3 py-1.5 rounded-full font-medium transition cursor-pointer"
                                      style={{
                                        background: msg.tacheStatut === 'terminee' ? 'var(--sd-teal-soft)' : 'var(--sd-cream)',
                                        color: msg.tacheStatut === 'terminee' ? 'var(--sd-teal)' : 'var(--sd-ink-2)',
                                      }}
                                    >
                                      {msg.tacheStatut === 'terminee' ? '✓ Terminée — cliquer pour rouvrir' : 'En attente — marquer terminée'}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Message simple */}
                              {msg.type === 'message' && (
                                <div className={isMine ? 'sd-bubble-out' : 'sd-bubble-in'}>
                                  {msg.contenu}
                                </div>
                              )}

                              <span className="text-xs px-1" style={{ color: 'var(--sd-ink-3)', fontSize: 10 }}>
                                {new Date(msg.date).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                          </React.Fragment>
                        )
                      })
                      })()}
                      <div ref={canalInterneEndRef} />
                    </>
                  )}
                </div>

                {/* Compose Canal Interne */}
                <div className="bg-white flex-shrink-0" style={{ borderTop: '1px solid var(--sd-border)', padding: '16px 28px' }}>
                  {/* Type selector */}
                  <div className="flex gap-2 mb-3">
                    {(['message', 'planning', 'tache'] as const).map(tp => (
                      <button
                        key={tp}
                        onClick={() => setCanalInterneType(tp)}
                        className={`sd-chip ${canalInterneType === tp ? 'active' : ''}`}
                      >
                        {tp === 'message' ? '💬 Message' : tp === 'planning' ? '📅 Planning' : '✅ Tache'}
                      </button>
                    ))}
                  </div>

                  {/* Planning fields */}
                  {canalInterneType === 'planning' && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <input type="text" placeholder="Résident (ex: Mme Lebrun)" value={canalPlanResident} onChange={e => setCanalPlanResident(e.target.value)}
                        className="px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid var(--sd-border)', background: 'white', color: 'var(--sd-navy)' }}
                        onFocus={e => (e.target.style.borderColor = 'var(--sd-gold)')} onBlur={e => (e.target.style.borderColor = 'var(--sd-border)')} />
                      <input type="text" placeholder="Résidence (ex: Les Acacias)" value={canalPlanResidence} onChange={e => setCanalPlanResidence(e.target.value)}
                        className="px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid var(--sd-border)', background: 'white', color: 'var(--sd-navy)' }}
                        onFocus={e => (e.target.style.borderColor = 'var(--sd-gold)')} onBlur={e => (e.target.style.borderColor = 'var(--sd-border)')} />
                      <input type="date" value={canalPlanDate} onChange={e => setCanalPlanDate(e.target.value)}
                        className="px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid var(--sd-border)', background: 'white', color: 'var(--sd-navy)' }}
                        onFocus={e => (e.target.style.borderColor = 'var(--sd-gold)')} onBlur={e => (e.target.style.borderColor = 'var(--sd-border)')} />
                      <input type="time" value={canalPlanHeure} onChange={e => setCanalPlanHeure(e.target.value)}
                        className="px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid var(--sd-border)', background: 'white', color: 'var(--sd-navy)' }}
                        onFocus={e => (e.target.style.borderColor = 'var(--sd-gold)')} onBlur={e => (e.target.style.borderColor = 'var(--sd-border)')} />
                    </div>
                  )}

                  {/* Tache fields */}
                  {canalInterneType === 'tache' && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <input type="text" placeholder="Assignée à (ex: Gestionnaire Tech)" value={canalTacheAssignee} onChange={e => setCanalTacheAssignee(e.target.value)}
                        className="px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid var(--sd-border)', background: 'white', color: 'var(--sd-navy)' }}
                        onFocus={e => (e.target.style.borderColor = 'var(--sd-gold)')} onBlur={e => (e.target.style.borderColor = 'var(--sd-border)')} />
                      <select value={canalTachePriorite} onChange={e => setCanalTachePriorite(e.target.value as 'normale' | 'urgente')}
                        className="px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid var(--sd-border)', background: 'white', color: 'var(--sd-navy)' }}>
                        <option value="normale">Priorite normale</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </div>
                  )}

                  {/* Input + Send */}
                  <div className="sd-compose-box">
                    <textarea
                      className="sd-compose-input"
                      placeholder={
                        canalInterneType === 'planning' ? 'Note complémentaire (optionnel)...'
                        : canalInterneType === 'tache' ? 'Description de la tâche...'
                        : "Message à l'équipe..."
                      }
                      value={canalInterneInput}
                      rows={1}
                      onChange={e => setCanalInterneInput(e.target.value)}
                      onKeyDown={async e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setSending(true); await onSendCanalInterne(); setSending(false) } }}
                    />
                    <button className="sd-send-btn" disabled={sending} onClick={async () => { setSending(true); await onSendCanalInterne(); setSending(false) }} title="Envoyer">
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M14 8L2 2l2.5 6L2 14l12-6z" fill="currentColor"/></svg>
                    </button>
                  </div>
                </div>
              </>
            ) : !selectedMission ? (
              /* Empty state — Artisans / Demandeurs */
              <div className="flex-1 flex flex-col items-center justify-center gap-4 px-10">
                <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: 'white', border: '1px solid var(--sd-border)', boxShadow: '0 4px 16px rgba(13,27,46,0.06)' }}>
                  💬
                </div>
                <p className="sd-ch-mission" style={{ fontSize: 18, textAlign: 'center' }}>
                  Canal Communications
                </p>
                <p className="text-xs text-center" style={{ color: 'var(--sd-ink-3)', maxWidth: 240, lineHeight: 1.6 }}>
                  Selectionnez une mission dans la liste pour acceder au fil de discussion
                </p>
                <button onClick={onCreateMission}
                  className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--sd-navy)', color: 'white', boxShadow: '0 2px 8px rgba(13,27,46,0.2)' }}>
                  <span style={{ color: 'var(--sd-gold)', fontSize: 17, fontWeight: 300 }}>+</span>
                  Nouvelle mission
                </button>
              </div>
            ) : (
              /* ═══ MISSION CHAT VIEW (Artisans / Demandeurs) ═══ */
              <>
                {/* Chat header */}
                <div className="bg-white flex items-center justify-between flex-shrink-0" style={{ padding: '16px 28px', borderBottom: '1px solid var(--sd-border)' }}>
                  <div className="flex flex-col" style={{ gap: 3 }}>
                    <div className="sd-ch-mission">
                      {selectedMission.immeuble}
                      {selectedMission.batiment && ` — Bât ${selectedMission.batiment}`}
                      {selectedMission.type && <span style={{ color: 'var(--sd-ink-3)', fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 400 }}> · {selectedMission.type}</span>}
                    </div>
                    <div className="flex items-center text-xs" style={{ color: 'var(--sd-ink-3)', gap: 12 }}>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--sd-teal)' }} />
                        {selectedMission.artisan || selectedMission.demandeurNom || selectedMission.locataire || 'Sans artisan'}
                      </span>
                      <span style={{ opacity: 0.4 }}>&middot;</span>
                      <span>Mission #{selectedMission.id.substring(0, 8)}</span>
                      {(selectedMission.demandeurNom || selectedMission.locataire) && (
                        <>
                          <span style={{ opacity: 0.4 }}>&middot;</span>
                          <button onClick={() => setCanalTab(canalTab === 'artisan' ? 'demandeur' : 'artisan')}
                            className="underline" style={{ color: canalTab === 'demandeur' ? 'var(--sd-gold)' : 'var(--sd-ink-3)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontSize: 11 }}>
                            {canalTab === 'artisan' ? `Vue: Artisan →` : `Vue: ${demandeurRoleLabel} →`}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="sd-header-btn">
                      📎 Documents
                    </button>
                    <button onClick={() => onOpenMission(selectedMission)} className="sd-header-btn">
                      📋 Détails
                    </button>
                    <button onClick={() => onOpenMission(selectedMission)} className="sd-header-btn primary">
                      ✅ Valider mission
                    </button>
                  </div>
                </div>

                {/* Demandeur info bar (only in demandeur tab) */}
                {canalTab === 'demandeur' && (selectedMission.demandeurNom || selectedMission.locataire) && (
                  <div className="flex items-center gap-3 px-7 py-3 flex-shrink-0" style={{ background: 'var(--sd-cream)', borderBottom: '1px solid var(--sd-border)' }}>
                    <div className="sd-av-artisan" style={{ width: 32, height: 32, fontSize: 12 }}>
                      {(selectedMission.demandeurNom || selectedMission.locataire || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: 'var(--sd-navy)' }}>{selectedMission.demandeurNom || selectedMission.locataire}</span>
                        <span className="sd-tag sd-tag-new">{demandeurRoleLabel}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--sd-ink-3)' }}>
                        <span>🏢 {selectedMission.immeuble}</span>
                        {selectedMission.telephoneLocataire && <span>📞 {selectedMission.telephoneLocataire}</span>}
                      </div>
                    </div>
                    <button onClick={() => openTransfert(selectedMission)}
                      className="sd-header-btn primary flex-shrink-0 text-xs">
                      🔨 Transférer artisan
                    </button>
                  </div>
                )}

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto px-7 flex flex-col gap-1"
                  style={{ paddingTop: 28, paddingBottom: 16, scrollbarWidth: 'thin', scrollbarColor: 'var(--sd-border) transparent' }}>

                  {activeMessages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                        style={{ background: 'white', border: '1px solid var(--sd-border)', boxShadow: '0 4px 16px rgba(13,27,46,0.06)' }}>
                        {canalTab === 'artisan' ? '🔧' : '👤'}
                      </div>
                      <p className="sd-ch-mission">
                        {canalTab === 'artisan' ? 'Canal artisan ouvert' : 'Canal demandeur'}
                      </p>
                      <p className="text-xs text-center" style={{ color: 'var(--sd-ink-3)', maxWidth: 280, lineHeight: 1.6 }}>
                        {canalTab === 'artisan'
                          ? `L'ordre de mission a été envoyé à ${selectedMission.artisan}. Envoyez un message pour demarrer la conversation.`
                          : (selectedMission.demandeurNom || selectedMission.locataire)
                            ? `${selectedMission.demandeurNom || selectedMission.locataire} peut vous contacter via le portail copropriétaire.`
                            : 'Aucun demandeur associé à cette mission.'}
                      </p>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        let lastDateKey = ''
                        return activeMessages.map((msg, i) => {
                          const isMe = msg.role === userRole || msg.role === 'syndic' || msg.role === 'syndic_tech' || msg.role === 'syndic_gestionnaire'
                          const isSystem = msg.role === 'system'
                          const msgDate = new Date(msg.date)
                          const dateKey = msgDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'numeric', day: 'numeric' })
                          const showDateSep = dateKey !== lastDateKey
                          if (showDateSep) lastDateKey = dateKey
                          const dateLabel = msgDate.toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()

                          return (
                            <React.Fragment key={i}>
                              {showDateSep && (
                                <div className="sd-date-sep">
                                  <span>{dateLabel}</span>
                                </div>
                              )}
                              {isSystem ? (
                                <div className={`flex my-2.5 ${msg.texte?.includes('Statut') || msg.texte?.includes('terminée') || msg.texte?.includes('terminée') || msg.texte?.includes('En cours') ? '' : 'justify-center'}`}>
                                  {msg.texte?.includes('Statut') || msg.texte?.includes('terminée') || msg.texte?.includes('terminée') || msg.texte?.includes('En cours') ? (
                                    <div className="sd-status-update">
                                      <div className="sd-status-icon">⚠️</div>
                                      <div>
                                        <div className="sd-status-title">Statut mis à jour</div>
                                        <div className="sd-status-sub">{msg.texte}</div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="sd-bubble-sys">
                                      <span>🔔</span>
                                      <span className="whitespace-pre-line">{msg.texte}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className={`flex gap-2.5 items-end mb-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                                  <div className={isMe ? 'sd-av-gestionnaire' : 'sd-av-artisan'}>
                                    {msg.auteur.charAt(0).toUpperCase()}
                                  </div>
                                  <div className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`} style={{ maxWidth: '68%' }}>
                                    <span className="text-xs px-1" style={{ color: 'var(--sd-ink-3)', fontSize: 10, fontWeight: 600, letterSpacing: 0.3 }}>
                                      {isMe ? 'Vous' : msg.auteur}
                                    </span>
                                    <div className={isMe ? 'sd-bubble-out' : 'sd-bubble-in'}>
                                      <span className="whitespace-pre-line">{msg.texte}</span>
                                    </div>
                                    <span className="text-xs px-1" style={{ color: 'var(--sd-ink-3)', fontSize: 10 }}>
                                      {formatTime(msg.date)}{isMe && ' · Lu'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </React.Fragment>
                          )
                        })
                      })()}
                      <div ref={chatEndRef} />
                    </>
                  )}
                </div>

                {/* Compose area */}
                <div className="bg-white flex-shrink-0" style={{ borderTop: '1px solid var(--sd-border)', padding: '16px 28px' }}>
                  <div className="sd-compose-box">
                    <button className="sd-compose-btn" title="Joindre un fichier">📎</button>
                    <button className="sd-compose-btn" title="Photo">📷</button>
                    <textarea
                      className="sd-compose-input"
                      placeholder={`Repondre a ${canalTab === 'artisan' ? (selectedMission.artisan || 'l\'artisan') : (selectedMission.demandeurNom || selectedMission.locataire || 'au demandeur')}...`}
                      value={currentMsg}
                      rows={1}
                      onChange={e => setCurrentMsg(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendCurrentMsg())}
                    />
                    <button
                      className="sd-send-btn"
                      disabled={!currentMsg.trim()}
                      onClick={sendCurrentMsg}
                      title="Envoyer"
                    >
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M14 8L2 2l2.5 6L2 14l12-6z" fill="currentColor"/></svg>
                    </button>
                  </div>
                  <div className="flex items-center mt-2 px-0.5" style={{ gap: 14 }}>
                    <span style={{ color: 'var(--sd-ink-3)', fontSize: 10 }}>Entrée pour envoyer · Maj+Entrée pour saut de ligne</span>
                    <div className="flex gap-1.5 ml-auto">
                      <button onClick={() => onOpenMission(selectedMission)} className="sd-quick-pill">✅ Valider</button>
                      <button className="sd-quick-pill">🔄 Demander révision</button>
                      <button className="sd-quick-pill">📋 Modèles</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ─── RIGHT PANEL: Details (300px) ─── */}
          {channelView !== 'interne' && selectedMission && (
            <div className="w-[300px] flex-shrink-0 bg-white flex flex-col overflow-y-auto"
              style={{ borderLeft: '1px solid var(--sd-border)', scrollbarWidth: 'thin', scrollbarColor: 'var(--sd-border) transparent' }}>

              {/* Mission info */}
              <div className="sd-dp-section">
                <div className="sd-dp-label">Mission</div>
                <div className="sd-dp-mission-title">
                  {selectedMission.type} — {selectedMission.immeuble}
                  {selectedMission.batiment && ` Bât ${selectedMission.batiment}`}
                </div>
                <div className="sd-dp-mission-id">
                  {formatMissionDisplayId(selectedMission.id, selectedMission.dateCreation)}
                </div>
                <div className="dp-tag-row flex flex-wrap" style={{ gap: 5, marginTop: 12 }}>
                  <span className={getPrioriteTag(selectedMission.priorite).cls}>{getPrioriteTag(selectedMission.priorite).label}</span>
                  <span className={getStatutTagDetail(selectedMission.statut).cls}>{getStatutTagDetail(selectedMission.statut).label}</span>
                </div>
              </div>

              {/* Informations */}
              <div className="sd-dp-section">
                <div className="sd-dp-label">Informations</div>
                <div className="flex flex-col" style={{ gap: 10 }}>
                  {/* Résidence — lien teal */}
                  <div className="flex items-start gap-2.5">
                    <div className="sd-dp-icon">🏢</div>
                    <div>
                      <div style={{ color: 'var(--sd-ink-3)', fontWeight: 500, fontSize: 10, marginBottom: 1 }}>Résidence</div>
                      <div className="sd-dp-info-link" style={{ fontWeight: 500, fontSize: 12 }}>
                        {selectedMission.immeuble}{selectedMission.batiment ? ` — Bât ${selectedMission.batiment}` : ''}
                      </div>
                    </div>
                  </div>
                  {/* Corps de métier */}
                  <div className="flex items-start gap-2.5">
                    <div className="sd-dp-icon">🔧</div>
                    <div>
                      <div style={{ color: 'var(--sd-ink-3)', fontWeight: 500, fontSize: 10, marginBottom: 1 }}>Corps de métier</div>
                      <div style={{ color: 'var(--sd-navy)', fontWeight: 500, fontSize: 12 }}>{selectedMission.type}</div>
                    </div>
                  </div>
                  {/* Date d'intervention */}
                  <div className="flex items-start gap-2.5">
                    <div className="sd-dp-icon">📅</div>
                    <div>
                      <div style={{ color: 'var(--sd-ink-3)', fontWeight: 500, fontSize: 10, marginBottom: 1 }}>{"Date d'intervention"}</div>
                      <div style={{ color: 'var(--sd-navy)', fontWeight: 500, fontSize: 12 }}>{formatDate(selectedMission.dateIntervention)}</div>
                    </div>
                  </div>
                  {/* Durée estimée */}
                  <div className="flex items-start gap-2.5">
                    <div className="sd-dp-icon">⏱</div>
                    <div>
                      <div style={{ color: 'var(--sd-ink-3)', fontWeight: 500, fontSize: 10, marginBottom: 1 }}>Durée estimée</div>
                      <div style={{ color: 'var(--sd-navy)', fontWeight: 500, fontSize: 12 }}>
                        {(selectedMission as any).dureeIntervention || '—'}
                      </div>
                    </div>
                  </div>
                  {/* Montant HT */}
                  <div className="flex items-start gap-2.5">
                    <div className="sd-dp-icon">💶</div>
                    <div>
                      <div style={{ color: 'var(--sd-ink-3)', fontWeight: 500, fontSize: 10, marginBottom: 1 }}>Montant HT</div>
                      <div style={{ color: 'var(--sd-navy)', fontWeight: 500, fontSize: 12 }}>
                        {(selectedMission as any).montantDevis
                          ? `${(selectedMission as any).montantDevis.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`
                          : '—'}
                      </div>
                    </div>
                  </div>
                  {/* Demandeur (conditionnel) */}
                  {selectedMission.demandeurNom && (
                    <div className="flex items-start gap-2.5">
                      <div className="sd-dp-icon">👤</div>
                      <div>
                        <div style={{ color: 'var(--sd-ink-3)', fontWeight: 500, fontSize: 10, marginBottom: 1 }}>Demandeur</div>
                        <div style={{ color: 'var(--sd-navy)', fontWeight: 500, fontSize: 12 }}>{selectedMission.demandeurNom}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="sd-dp-section">
                <div className="sd-dp-label">Avancement</div>
                <div className="flex flex-col">
                  {getTimelineSteps(selectedMission).map((step, i, arr) => (
                    <div key={i} className="flex gap-3" style={{ paddingBottom: i < arr.length - 1 ? 14 : 0 }}>
                      <div className="flex flex-col items-center">
                        <div className={`sd-tl-dot ${step.status}`} />
                        {i < arr.length - 1 && <div className="sd-tl-line" />}
                      </div>
                      <div>
                        <div className="text-xs font-medium" style={{ color: step.status === 'pending' ? 'var(--sd-ink-3)' : 'var(--sd-navy)', fontSize: 12, lineHeight: 1.35 }}>
                          {step.label}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--sd-ink-3)', fontSize: 10, marginTop: 2 }}>
                          {step.date ? formatDate(step.date) : '—'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Participants */}
              <div className="sd-dp-section">
                <div className="sd-dp-label">Participants</div>
                <div className="flex flex-col gap-2.5">
                  {/* Gestionnaire */}
                  <div className="flex items-center gap-2.5">
                    <div className="sd-av-gestionnaire" style={{ width: 32, height: 32, fontSize: 11 }}>
                      {(user?.user_metadata?.name || authorName || 'G').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium" style={{ color: 'var(--sd-navy)', fontSize: 12 }}>{user?.user_metadata?.name || authorName}</div>
                      <div className="text-xs" style={{ color: 'var(--sd-ink-3)', fontSize: 10, marginTop: 1 }}>Gestionnaire technique</div>
                    </div>
                    <div className="w-2 h-2 rounded-full" style={{ background: 'var(--sd-teal)' }} />
                  </div>
                  {/* Artisan */}
                  {selectedMission.artisan && (
                    <div className="flex items-center gap-2.5">
                      <div className="sd-av-artisan" style={{ width: 32, height: 32, fontSize: 11 }}>
                        {selectedMission.artisan.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-medium" style={{ color: 'var(--sd-navy)', fontSize: 12 }}>{selectedMission.artisan}</div>
                        <div className="text-xs" style={{ color: 'var(--sd-ink-3)', fontSize: 10, marginTop: 1 }}>Artisan certifié VitFix</div>
                      </div>
                      <div className="w-2 h-2 rounded-full" style={{ background: 'var(--sd-teal)' }} />
                    </div>
                  )}
                  {/* Demandeur */}
                  {(selectedMission.demandeurNom || selectedMission.locataire) && (
                    <div className="flex items-center gap-2.5">
                      <div className="sd-av-artisan" style={{ width: 32, height: 32, fontSize: 11 }}>
                        {(selectedMission.demandeurNom || selectedMission.locataire || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-medium" style={{ color: 'var(--sd-navy)', fontSize: 12 }}>{selectedMission.demandeurNom || selectedMission.locataire}</div>
                        <div className="text-xs" style={{ color: 'var(--sd-ink-3)', fontSize: 10, marginTop: 1 }}>{demandeurRoleLabel}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions rapides */}
              <div className="sd-dp-section">
                <div className="sd-dp-label">Actions rapides</div>
                <div className="flex flex-col gap-2">
                  <button className="sd-action-btn gold" onClick={() => onOpenMission(selectedMission)}>
                    <span style={{ fontSize: 15 }}>✅</span> Valider & clôturer la mission
                  </button>
                  <button className="sd-action-btn" onClick={() => onOpenMission(selectedMission)}>
                    <span style={{ fontSize: 15 }}>📄</span> Générer rapport PDF
                  </button>
                  <button className="sd-action-btn" onClick={() => onOpenMission(selectedMission)}>
                    <span style={{ fontSize: 15 }}>💶</span> Créer facture
                  </button>
                  <button className="sd-action-btn">
                    <span style={{ fontSize: 15 }}>🔄</span> Demander une révision
                  </button>
                  <button className="sd-action-btn danger">
                    <span style={{ fontSize: 15 }}>🚫</span> Annuler la mission
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL — TRANSFERER A UN ARTISAN                          */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showTransfert && selectedMission && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--sd-border)' }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--sd-navy)' }}>🔨 Transférer à un artisan</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--sd-ink-3)' }}>Crée un ordre de mission depuis ce signalement</p>
              </div>
              <button onClick={() => setShowTransfert(false)} className="text-2xl leading-none" style={{ color: 'var(--sd-ink-3)' }}>&times;</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Resume signalement */}
              <div className="rounded-xl p-3 space-y-1" style={{ background: 'var(--sd-cream)', border: '1px solid var(--sd-border)' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--sd-navy)' }}>📋 Signalement de {selectedMission.demandeurNom || selectedMission.locataire}</p>
                <p className="text-xs" style={{ color: 'var(--sd-ink-2)' }}>🏢 {selectedMission.immeuble}{selectedMission.estPartieCommune ? ` - ${selectedMission.zoneSignalee}` : ''}{selectedMission.etage ? ` - Et. ${selectedMission.etage}` : ''}{selectedMission.numLot ? ` - Lot ${selectedMission.numLot}` : ''}</p>
                <p className="text-xs" style={{ color: 'var(--sd-ink-2)' }}>🔧 Type : {selectedMission.type || 'Non défini'}</p>
                {selectedMission.demandeurEmail && <p className="text-xs" style={{ color: 'var(--sd-ink-2)' }}>✉️ {selectedMission.demandeurEmail}</p>}
              </div>

              {/* Selection artisan */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--sd-navy)' }}>Artisan *</label>
                {artisans.filter(a => a.statut === 'actif').length === 0 ? (
                  <p className="text-xs italic" style={{ color: 'var(--sd-ink-3)' }}>Aucun artisan actif disponible</p>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {artisans.filter(a => a.statut === 'actif').map(a => (
                      <label key={a.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition"
                        style={{
                          border: `2px solid ${transfertArtisanId === a.id ? 'var(--sd-gold)' : 'var(--sd-border)'}`,
                          background: transfertArtisanId === a.id ? 'var(--sd-gold-dim)' : 'white',
                        }}>
                        <input type="radio" name="artisan" value={a.id} checked={transfertArtisanId === a.id}
                          onChange={() => setTransfertArtisanId(a.id)} style={{ accentColor: '#C9A84C' }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold" style={{ color: 'var(--sd-navy)' }}>{a.nom}</p>
                            {(a.vitfixCertifie || a.vitfix_certifie) && <span className="sd-tag sd-tag-new">✓ Certifie</span>}
                          </div>
                          <p className="text-xs" style={{ color: 'var(--sd-ink-3)' }}>{a.metier} - {a.telephone}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-bold" style={{ color: 'var(--sd-gold)' }}>⭐ {a.note}</p>
                          <p className="text-xs" style={{ color: 'var(--sd-ink-3)' }}>{a.nbInterventions || a.nb_interventions} missions</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--sd-navy)' }}>Description de l&apos;intervention</label>
                <textarea
                  rows={3} value={transfertDescription} onChange={e => setTransfertDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none"
                  style={{ border: '1px solid var(--sd-border)' }}
                  placeholder="Décrivez le travail a effectuer..."
                  onFocus={e => (e.target.style.borderColor = 'var(--sd-gold)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--sd-border)')}
                />
              </div>

              {/* Priorite + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--sd-navy)' }}>Priorite</label>
                  <select value={transfertPriorite} onChange={e => setTransfertPriorite(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ border: '1px solid var(--sd-border)' }}>
                    <option value="urgente">🔴 Urgente</option>
                    <option value="normale">🟡 Normale</option>
                    <option value="planifiee">🟢 Planifiée</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--sd-navy)' }}>Date d&apos;intervention</label>
                  <input type="date" value={transfertDate} onChange={e => setTransfertDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ border: '1px solid var(--sd-border)' }} />
                </div>
              </div>

              {/* Succes */}
              {transfertSuccess && (
                <div className="rounded-xl px-4 py-3 text-sm font-medium text-center"
                  style={{ background: 'var(--sd-teal-soft)', border: '1px solid rgba(26,122,110,0.2)', color: 'var(--sd-teal)' }}>
                  ✅ {transfertSuccess}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowTransfert(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
                style={{ border: '1px solid var(--sd-border)', color: 'var(--sd-ink-2)' }}>
                Annuler
              </button>
              <button onClick={handleTransfert}
                disabled={!transfertArtisanId || transfertLoading || !!transfertSuccess}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-40"
                style={{ background: 'var(--sd-navy)', color: 'var(--sd-gold-light)', boxShadow: '0 2px 8px rgba(13,27,46,0.2)' }}>
                {transfertLoading ? 'Création...' : '🔨 Créer l\'ordre de mission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
