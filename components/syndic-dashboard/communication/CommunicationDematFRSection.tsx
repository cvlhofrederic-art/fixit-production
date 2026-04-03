'use client'

import { useState, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

type TypeCommunication = 'convocation' | 'relance' | 'information' | 'urgence'
type StatutMessage = 'envoye' | 'distribue' | 'lu'
type CanalPreference = 'email' | 'courrier'

interface MessageEnvoye {
  id: string
  copropriétaireId: string
  copropriétaireNom: string
  copropriétaireLot: string
  type: TypeCommunication
  sujet: string
  contenu: string
  dateEnvoi: string
  statut: StatutMessage
  canal: CanalPreference
  immeubleId: string
  immeubleNom: string
  modeleId?: string
}

interface ModeleMessage {
  id: string
  nom: string
  type: TypeCommunication
  sujet: string
  contenu: string
  referenceJuridique: string
  isCustom: boolean
  createdAt: string
}

interface EnvoiGroupe {
  id: string
  modeleId?: string
  sujet: string
  contenu: string
  destinataires: string[]   // copropriétaire IDs
  dateEnvoi: string
  dateProgrammee?: string
  statut: 'brouillon' | 'programme' | 'envoye'
  stats: { envoyes: number; distribues: number; lus: number }
}

interface Copropriétaire {
  id: string
  nom: string
  lot: string
  tantiemes: number
  immeubleId: string
  immeubleNom: string
  email: string
  canalPrefere: CanalPreference
  statutPaiement: 'a_jour' | 'en_retard'
}

interface ParametresComm {
  autoRappelJours: number
  frequenceResume: 'hebdo' | 'mensuel'
  signaturePersonnalisee: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPE_COMM_CONFIG: Record<TypeCommunication, { label: string; icon: string; color: string }> = {
  convocation: { label: 'Convocation AG', icon: '📋', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  relance:     { label: 'Relance charges', icon: '💶', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  information: { label: 'Information', icon: '📣', color: 'bg-green-50 text-green-700 border-green-200' },
  urgence:     { label: 'Urgence', icon: '🚨', color: 'bg-red-50 text-red-700 border-red-200' },
}

const STATUT_MSG_CONFIG: Record<StatutMessage, { label: string; dot: string; icon: string }> = {
  envoye:   { label: 'Envoyé',    dot: 'bg-gray-400', icon: '✉️' },
  distribue:{ label: 'Distribué', dot: 'bg-blue-400', icon: '📬' },
  lu:       { label: 'Lu',        dot: 'bg-green-400', icon: '👁️' },
}

const VARIABLE_PLACEHOLDERS = [
  { key: '{nom}',       label: 'Nom du copropriétaire' },
  { key: '{lot}',       label: 'Numéro de lot' },
  { key: '{tantièmes}', label: 'Tantièmes' },
  { key: '{montant}',   label: 'Montant' },
  { key: '{date}',      label: 'Date' },
]

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return s }
}

const formatDateShort = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return s }
}

// ─── Demo data ────────────────────────────────────────────────────────────────

function generateDemoData(userId: string) {
  const copropriétaires: Copropriétaire[] = [
    { id: 'cp1', nom: 'Martin Dupont', lot: 'A-101', tantiemes: 125, immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', email: 'martin.dupont@email.fr', canalPrefere: 'email', statutPaiement: 'a_jour' },
    { id: 'cp2', nom: 'Sophie Laurent', lot: 'A-203', tantiemes: 98, immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', email: 'sophie.laurent@email.fr', canalPrefere: 'email', statutPaiement: 'a_jour' },
    { id: 'cp3', nom: 'Pierre Moreau', lot: 'B-102', tantiemes: 150, immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', email: 'pierre.moreau@email.fr', canalPrefere: 'courrier', statutPaiement: 'en_retard' },
    { id: 'cp4', nom: 'Claire Petit', lot: 'A-301', tantiemes: 110, immeubleId: 'imm2', immeubleNom: 'Le Parc Saint-Charles', email: 'claire.petit@email.fr', canalPrefere: 'email', statutPaiement: 'a_jour' },
    { id: 'cp5', nom: 'Jean Leroy', lot: 'B-205', tantiemes: 85, immeubleId: 'imm2', immeubleNom: 'Le Parc Saint-Charles', email: 'jean.leroy@email.fr', canalPrefere: 'email', statutPaiement: 'en_retard' },
    { id: 'cp6', nom: 'Marie Bernard', lot: 'A-102', tantiemes: 140, immeubleId: 'imm2', immeubleNom: 'Le Parc Saint-Charles', email: 'marie.bernard@email.fr', canalPrefere: 'email', statutPaiement: 'a_jour' },
  ]

  const modeles: ModeleMessage[] = [
    { id: 'mod1', nom: 'Convocation AG ordinaire', type: 'convocation', sujet: 'Convocation à l\'Assemblée Générale Ordinaire — {date}', contenu: 'Madame, Monsieur {nom},\n\nVous êtes convoqué(e) à l\'Assemblée Générale Ordinaire de la copropriété qui se tiendra le {date}.\n\nVotre lot : {lot} — Tantièmes : {tantièmes}\n\nL\'ordre du jour est joint au présent courrier.\n\nConformément à l\'article 9 du décret du 17 mars 1967, cette convocation vous est adressée au moins 21 jours avant la date de l\'assemblée.\n\nCordialement,\nLe Syndic', referenceJuridique: 'Art. 9 décret n°67-223 du 17/03/1967 — convocation 21 jours min.', isCustom: false, createdAt: '2025-01-15' },
    { id: 'mod2', nom: 'Rappel charges impayées', type: 'relance', sujet: 'Rappel — Charges de copropriété impayées', contenu: 'Madame, Monsieur {nom},\n\nNous constatons un retard de paiement sur vos charges de copropriété.\n\nMontant dû : {montant} €\nLot : {lot}\n\nNous vous prions de bien vouloir régulariser votre situation dans les meilleurs délais.\n\nÀ défaut de paiement sous 30 jours, nous serons contraints d\'engager une procédure de recouvrement conformément à la loi du 10 juillet 1965.\n\nCordialement,\nLe Syndic', referenceJuridique: 'Loi n°65-557 du 10/07/1965 — charges de copropriété', isCustom: false, createdAt: '2025-01-15' },
    { id: 'mod3', nom: 'Avis de travaux', type: 'information', sujet: 'Information — Travaux dans l\'immeuble', contenu: 'Cher(e) {nom},\n\nNous vous informons que des travaux sont programmés dans votre immeuble.\n\nLes détails seront communiqués prochainement. Nous vous remercions de votre compréhension.\n\nCordialement,\nLe Syndic', referenceJuridique: '', isCustom: false, createdAt: '2025-01-15' },
    { id: 'mod4', nom: 'Coupure eau/électricité', type: 'urgence', sujet: 'URGENT — Coupure d\'eau/électricité prévue', contenu: 'Cher(e) {nom},\n\nNous vous informons d\'une coupure d\'eau/électricité prévue dans votre immeuble.\n\nMerci de prendre vos dispositions.\n\nCordialement,\nLe Syndic', referenceJuridique: '', isCustom: false, createdAt: '2025-01-15' },
    { id: 'mod5', nom: 'Notification PV d\'AG', type: 'information', sujet: 'Procès-verbal de l\'Assemblée Générale du {date}', contenu: 'Madame, Monsieur {nom},\n\nVeuillez trouver ci-joint le procès-verbal de l\'Assemblée Générale qui s\'est tenue le {date}.\n\nConformément à l\'article 42 alinéa 2 de la loi du 10 juillet 1965, ce PV vous est notifié dans un délai d\'un mois suivant la tenue de l\'assemblée.\n\nCordialement,\nLe Syndic', referenceJuridique: 'Art. 42 al. 2 loi n°65-557 — notification PV sous 1 mois', isCustom: false, createdAt: '2025-01-15' },
  ]

  const now = new Date()
  const messages: MessageEnvoye[] = [
    { id: 'msg1', copropriétaireId: 'cp1', copropriétaireNom: 'Martin Dupont', copropriétaireLot: 'A-101', type: 'convocation', sujet: 'Convocation AG Ordinaire — 15 mars 2026', contenu: '', dateEnvoi: new Date(now.getTime() - 5 * 86400000).toISOString(), statut: 'lu', canal: 'email', immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', modeleId: 'mod1' },
    { id: 'msg2', copropriétaireId: 'cp2', copropriétaireNom: 'Sophie Laurent', copropriétaireLot: 'A-203', type: 'convocation', sujet: 'Convocation AG Ordinaire — 15 mars 2026', contenu: '', dateEnvoi: new Date(now.getTime() - 5 * 86400000).toISOString(), statut: 'distribue', canal: 'email', immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', modeleId: 'mod1' },
    { id: 'msg3', copropriétaireId: 'cp3', copropriétaireNom: 'Pierre Moreau', copropriétaireLot: 'B-102', type: 'relance', sujet: 'Rappel charges impayées — 1 280 €', contenu: '', dateEnvoi: new Date(now.getTime() - 2 * 86400000).toISOString(), statut: 'envoye', canal: 'courrier', immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', modeleId: 'mod2' },
    { id: 'msg4', copropriétaireId: 'cp4', copropriétaireNom: 'Claire Petit', copropriétaireLot: 'A-301', type: 'information', sujet: 'Information travaux ravalement façade', contenu: '', dateEnvoi: new Date(now.getTime() - 10 * 86400000).toISOString(), statut: 'lu', canal: 'email', immeubleId: 'imm2', immeubleNom: 'Le Parc Saint-Charles' },
    { id: 'msg5', copropriétaireId: 'cp5', copropriétaireNom: 'Jean Leroy', copropriétaireLot: 'B-205', type: 'relance', sujet: 'Rappel charges impayées — 950 €', contenu: '', dateEnvoi: new Date(now.getTime() - 1 * 86400000).toISOString(), statut: 'distribue', canal: 'email', immeubleId: 'imm2', immeubleNom: 'Le Parc Saint-Charles', modeleId: 'mod2' },
    { id: 'msg6', copropriétaireId: 'cp6', copropriétaireNom: 'Marie Bernard', copropriétaireLot: 'A-102', type: 'urgence', sujet: 'URGENT — Coupure eau 14/03 de 9h à 14h', contenu: '', dateEnvoi: new Date(now.getTime() - 0.5 * 86400000).toISOString(), statut: 'lu', canal: 'email', immeubleId: 'imm2', immeubleNom: 'Le Parc Saint-Charles', modeleId: 'mod4' },
  ]

  const envoisGroupes: EnvoiGroupe[] = [
    { id: 'eg1', modeleId: 'mod1', sujet: 'Convocation AG Ordinaire — 15 mars 2026', contenu: '', destinataires: ['cp1', 'cp2', 'cp3'], dateEnvoi: new Date(now.getTime() - 5 * 86400000).toISOString(), statut: 'envoye', stats: { envoyes: 3, distribues: 2, lus: 1 } },
  ]

  const parametres: ParametresComm = {
    autoRappelJours: 15,
    frequenceResume: 'hebdo',
    signaturePersonnalisee: 'Cabinet Fixit Syndic\n12 rue de la Gestion, 13001 Marseille\nTél: 04 91 XX XX XX',
  }

  return { copropriétaires, modeles, messages, envoisGroupes, parametres }
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CommunicationDematFRSection({ user, userRole }: { user: User; userRole: string }) {
  const STORAGE_KEY = `fixit_comm_fr_${user.id}`

  const [activeTab, setActiveTab] = useState<'messages' | 'modeles' | 'envoi' | 'parametres'>('messages')
  const [copropriétaires, setCopropriétaires] = useState<Copropriétaire[]>([])
  const [modeles, setModeles] = useState<ModeleMessage[]>([])
  const [messages, setMessages] = useState<MessageEnvoye[]>([])
  const [envoisGroupes, setEnvoisGroupes] = useState<EnvoiGroupe[]>([])
  const [parametres, setParametres] = useState<ParametresComm>({ autoRappelJours: 15, frequenceResume: 'hebdo', signaturePersonnalisee: '' })

  // Filters
  const [filterType, setFilterType] = useState<TypeCommunication | ''>('')
  const [filterCopro, setFilterCopro] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Modals
  const [showCreateModele, setShowCreateModele] = useState(false)
  const [modeleForm, setModeleForm] = useState<Partial<ModeleMessage>>({ type: 'information', isCustom: true })
  const [showEnvoiModal, setShowEnvoiModal] = useState(false)
  const [envoiForm, setEnvoiForm] = useState<Partial<EnvoiGroupe>>({ destinataires: [], statut: 'brouillon', stats: { envoyes: 0, distribues: 0, lus: 0 } })
  const [envoiSelectedModele, setEnvoiSelectedModele] = useState('')
  const [envoiFilterImmeuble, setEnvoiFilterImmeuble] = useState('')
  const [envoiFilterPaiement, setEnvoiFilterPaiement] = useState<'' | 'a_jour' | 'en_retard'>('')
  const [previewMode, setPreviewMode] = useState(false)

  // ── Persistance ──────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        setCopropriétaires(data.copropriétaires || [])
        setModeles(data.modeles || [])
        setMessages(data.messages || [])
        setEnvoisGroupes(data.envoisGroupes || [])
        setParametres(data.parametres || { autoRappelJours: 15, frequenceResume: 'hebdo', signaturePersonnalisee: '' })
      } else {
        const demo = generateDemoData(user.id)
        setCopropriétaires(demo.copropriétaires)
        setModeles(demo.modeles)
        setMessages(demo.messages)
        setEnvoisGroupes(demo.envoisGroupes)
        setParametres(demo.parametres)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
      }
    } catch {
      const demo = generateDemoData(user.id)
      setCopropriétaires(demo.copropriétaires)
      setModeles(demo.modeles)
      setMessages(demo.messages)
      setEnvoisGroupes(demo.envoisGroupes)
      setParametres(demo.parametres)
    }
  }, [])

  const saveAll = (upd: { copropriétaires?: Copropriétaire[]; modeles?: ModeleMessage[]; messages?: MessageEnvoye[]; envoisGroupes?: EnvoiGroupe[]; parametres?: ParametresComm }) => {
    const data = {
      copropriétaires: upd.copropriétaires ?? copropriétaires,
      modeles: upd.modeles ?? modeles,
      messages: upd.messages ?? messages,
      envoisGroupes: upd.envoisGroupes ?? envoisGroupes,
      parametres: upd.parametres ?? parametres,
    }
    if (upd.copropriétaires) setCopropriétaires(upd.copropriétaires)
    if (upd.modeles) setModeles(upd.modeles)
    if (upd.messages) setMessages(upd.messages)
    if (upd.envoisGroupes) setEnvoisGroupes(upd.envoisGroupes)
    if (upd.parametres) setParametres(upd.parametres)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  // ── Filtered messages ────────────────────────────────────────────────────────

  const filteredMessages = useMemo(() => {
    return messages.filter(m => {
      if (filterType && m.type !== filterType) return false
      if (filterCopro && !m.copropriétaireNom.toLowerCase().includes(filterCopro.toLowerCase())) return false
      if (filterDateFrom && m.dateEnvoi < filterDateFrom) return false
      if (filterDateTo && m.dateEnvoi > filterDateTo + 'T23:59:59') return false
      return true
    }).sort((a, b) => b.dateEnvoi.localeCompare(a.dateEnvoi))
  }, [messages, filterType, filterCopro, filterDateFrom, filterDateTo])

  const msgStats = useMemo(() => ({
    total: messages.length,
    envoyes: messages.filter(m => m.statut === 'envoye').length,
    distribues: messages.filter(m => m.statut === 'distribue').length,
    lus: messages.filter(m => m.statut === 'lu').length,
  }), [messages])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleCreateModele = () => {
    if (!modeleForm.nom || !modeleForm.sujet || !modeleForm.contenu) return
    const newMod: ModeleMessage = {
      id: `mod-${Date.now()}`,
      nom: modeleForm.nom || '',
      type: (modeleForm.type as TypeCommunication) || 'information',
      sujet: modeleForm.sujet || '',
      contenu: modeleForm.contenu || '',
      referenceJuridique: modeleForm.referenceJuridique || '',
      isCustom: true,
      createdAt: new Date().toISOString(),
    }
    saveAll({ modeles: [...modeles, newMod] })
    setShowCreateModele(false)
    setModeleForm({ type: 'information', isCustom: true })
  }

  const deleteModele = (id: string) => {
    if (window.confirm('Supprimer ce modèle ?')) saveAll({ modeles: modeles.filter(m => m.id !== id) })
  }

  const handleEnvoiGroupe = () => {
    if (!envoiForm.sujet || !envoiForm.destinataires?.length) return
    const destIds = envoiForm.destinataires || []
    const newEnvoi: EnvoiGroupe = {
      id: `eg-${Date.now()}`,
      modeleId: envoiSelectedModele || undefined,
      sujet: envoiForm.sujet || '',
      contenu: envoiForm.contenu || '',
      destinataires: destIds,
      dateEnvoi: new Date().toISOString(),
      dateProgrammee: envoiForm.dateProgrammee,
      statut: envoiForm.dateProgrammee ? 'programme' : 'envoye',
      stats: { envoyes: destIds.length, distribues: 0, lus: 0 },
    }

    // Create individual messages for each recipient
    const newMessages: MessageEnvoye[] = destIds.map(cpId => {
      const cp = copropriétaires.find(c => c.id === cpId)
      return {
        id: `msg-${Date.now()}-${cpId}`,
        copropriétaireId: cpId,
        copropriétaireNom: cp?.nom || '',
        copropriétaireLot: cp?.lot || '',
        type: (modeles.find(m => m.id === envoiSelectedModele)?.type || 'information') as TypeCommunication,
        sujet: envoiForm.sujet || '',
        contenu: envoiForm.contenu || '',
        dateEnvoi: new Date().toISOString(),
        statut: 'envoye' as StatutMessage,
        canal: cp?.canalPrefere || 'email',
        immeubleId: cp?.immeubleId || '',
        immeubleNom: cp?.immeubleNom || '',
        modeleId: envoiSelectedModele || undefined,
      }
    })

    saveAll({ envoisGroupes: [...envoisGroupes, newEnvoi], messages: [...messages, ...newMessages] })
    setShowEnvoiModal(false)
    setEnvoiForm({ destinataires: [], statut: 'brouillon', stats: { envoyes: 0, distribues: 0, lus: 0 } })
    setEnvoiSelectedModele('')
  }

  const selectAllDestinataires = () => {
    const filtered = copropriétaires.filter(cp => {
      if (envoiFilterImmeuble && cp.immeubleId !== envoiFilterImmeuble) return false
      if (envoiFilterPaiement && cp.statutPaiement !== envoiFilterPaiement) return false
      return true
    })
    setEnvoiForm({ ...envoiForm, destinataires: filtered.map(c => c.id) })
  }

  const toggleDestinataire = (cpId: string) => {
    const current = envoiForm.destinataires || []
    if (current.includes(cpId)) {
      setEnvoiForm({ ...envoiForm, destinataires: current.filter(id => id !== cpId) })
    } else {
      setEnvoiForm({ ...envoiForm, destinataires: [...current, cpId] })
    }
  }

  const deleteMessage = (id: string) => {
    if (window.confirm('Supprimer ce message ?')) saveAll({ messages: messages.filter(m => m.id !== id) })
  }

  const immeublesList = useMemo(() => {
    const set = new Set<string>()
    copropriétaires.forEach(cp => set.add(cp.immeubleId))
    return Array.from(set).map(id => {
      const cp = copropriétaires.find(c => c.immeubleId === id)
      return { id, nom: cp?.immeubleNom || id }
    })
  }, [copropriétaires])

  // ── Tabs ─────────────────────────────────────────────────────────────────────

  const tabs = [
    { key: 'messages' as const,   label: 'Messages',      icon: '✉️' },
    { key: 'modeles' as const,    label: 'Modèles',       icon: '📄' },
    { key: 'envoi' as const,      label: 'Envoi groupé',  icon: '📤' },
    { key: 'parametres' as const, label: 'Paramètres',    icon: '⚙️' },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header + Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === t.key ? 'bg-[var(--sd-navy,#0D1B2E)] text-white shadow' : 'bg-white border border-[var(--sd-border,#E4DDD0)] text-[var(--sd-ink-2,#555)] hover:bg-[var(--sd-cream,#F7F4EE)]'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Messages ────────────────────────────────────────────────────── */}
      {activeTab === 'messages' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total envoyés', value: msgStats.total, icon: '📊', color: 'bg-[var(--sd-cream,#F7F4EE)] border-[var(--sd-border,#E4DDD0)]' },
              { label: 'En attente', value: msgStats.envoyes, icon: '✉️', color: 'bg-gray-50 border-gray-200' },
              { label: 'Distribués', value: msgStats.distribues, icon: '📬', color: 'bg-blue-50 border-blue-200' },
              { label: 'Lus', value: msgStats.lus, icon: '👁️', color: 'bg-green-50 border-green-200' },
            ].map((s, i) => (
              <div key={i} className={`rounded-xl border-2 p-3 ${s.color}`}>
                <div className="text-lg mb-0.5">{s.icon}</div>
                <div className="text-xl font-bold text-[var(--sd-navy,#0D1B2E)]">{s.value}</div>
                <div className="text-xs text-[var(--sd-ink-3,#888)]">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
              className="px-3 py-2 border-2 border-[var(--sd-border,#E4DDD0)] rounded-lg text-sm bg-white focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
              <option value="">Tous les types</option>
              {Object.entries(TYPE_COMM_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            <input type="text" placeholder="Rechercher copropriétaire..." value={filterCopro} onChange={e => setFilterCopro(e.target.value)}
              className="px-3 py-2 border-2 border-[var(--sd-border,#E4DDD0)] rounded-lg text-sm bg-white focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none min-w-[200px]" />
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
              className="px-3 py-2 border-2 border-[var(--sd-border,#E4DDD0)] rounded-lg text-sm bg-white focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
            <span className="self-center text-xs text-gray-400">au</span>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
              className="px-3 py-2 border-2 border-[var(--sd-border,#E4DDD0)] rounded-lg text-sm bg-white focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
          </div>

          {/* Messages list */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-[var(--sd-cream,#F7F4EE)] text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <div className="col-span-2">Copropriétaire</div>
              <div className="col-span-1">Lot</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-3">Sujet</div>
              <div className="col-span-1">Canal</div>
              <div className="col-span-1">Date</div>
              <div className="col-span-1">Statut</div>
              <div className="col-span-1"></div>
            </div>
            {filteredMessages.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Aucun message trouvé</div>
            )}
            {filteredMessages.map(msg => {
              const typeCfg = TYPE_COMM_CONFIG[msg.type]
              const stCfg = STATUT_MSG_CONFIG[msg.statut]
              return (
                <div key={msg.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-50 hover:bg-[var(--sd-cream,#F7F4EE)] group items-center">
                  <div className="col-span-2 text-sm font-medium text-[var(--sd-navy,#0D1B2E)] truncate">{msg.copropriétaireNom}</div>
                  <div className="col-span-1 text-xs text-gray-500">{msg.copropriétaireLot}</div>
                  <div className="col-span-2"><span className={`text-xs font-semibold px-2 py-1 rounded-full border ${typeCfg.color}`}>{typeCfg.icon} {typeCfg.label}</span></div>
                  <div className="col-span-3 text-sm text-gray-700 truncate">{msg.sujet}</div>
                  <div className="col-span-1 text-xs text-gray-500">{msg.canal === 'email' ? '📧 Email' : '📮 Courrier'}</div>
                  <div className="col-span-1 text-xs text-gray-500">{formatDateShort(msg.dateEnvoi)}</div>
                  <div className="col-span-1 flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${stCfg.dot}`} />
                    <span className="text-xs text-gray-600">{stCfg.label}</span>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button onClick={() => deleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-sm transition">🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TAB: Modèles ─────────────────────────────────────────────────────── */}
      {activeTab === 'modeles' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[var(--sd-ink-3,#888)]">Modèles de communication — conformes aux obligations légales</p>
            <button onClick={() => setShowCreateModele(true)} className="bg-[var(--sd-navy,#0D1B2E)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition">+ Créer un modèle</button>
          </div>

          <div className="space-y-3">
            {modeles.map(mod => {
              const typeCfg = TYPE_COMM_CONFIG[mod.type]
              return (
                <div key={mod.id} className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${typeCfg.color}`}>{typeCfg.icon} {typeCfg.label}</span>
                      <h4 className="font-bold text-[var(--sd-navy,#0D1B2E)]">{mod.nom}</h4>
                      {mod.isCustom && <span className="text-[10px] bg-[var(--sd-gold,#C9A84C)] text-white px-1.5 py-0.5 rounded font-bold">Perso</span>}
                    </div>
                    {mod.isCustom && (
                      <button onClick={() => deleteModele(mod.id)} className="text-gray-400 hover:text-red-500 transition text-sm">🗑️</button>
                    )}
                  </div>
                  <div className="text-sm text-[var(--sd-navy,#0D1B2E)] font-semibold mb-1">Sujet: {mod.sujet}</div>
                  <pre className="text-xs text-gray-600 bg-[var(--sd-cream,#F7F4EE)] rounded-lg p-3 whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">{mod.contenu}</pre>
                  {mod.referenceJuridique && (
                    <div className="mt-2 text-[10px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                      <strong>Réf. juridique:</strong> {mod.referenceJuridique}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Variable placeholders info */}
          <div className="bg-[var(--sd-cream,#F7F4EE)] border border-[var(--sd-border,#E4DDD0)] rounded-xl p-3">
            <h4 className="text-xs font-bold text-[var(--sd-navy,#0D1B2E)] mb-2">Variables disponibles</h4>
            <div className="flex gap-3 flex-wrap">
              {VARIABLE_PLACEHOLDERS.map(v => (
                <span key={v.key} className="text-xs bg-white border border-[var(--sd-border,#E4DDD0)] rounded-lg px-2 py-1">
                  <code className="font-mono text-[var(--sd-gold,#C9A84C)] font-bold">{v.key}</code> — {v.label}
                </span>
              ))}
            </div>
          </div>

          {/* Create Modele Modal */}
          {showCreateModele && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModele(false)}>
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg text-[var(--sd-navy,#0D1B2E)] mb-4">Créer un modèle personnalisé</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Nom du modèle</label>
                      <input type="text" value={modeleForm.nom || ''} onChange={e => setModeleForm({ ...modeleForm, nom: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Type</label>
                      <select value={modeleForm.type || 'information'} onChange={e => setModeleForm({ ...modeleForm, type: e.target.value as TypeCommunication })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                        {Object.entries(TYPE_COMM_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Sujet</label>
                    <input type="text" value={modeleForm.sujet || ''} onChange={e => setModeleForm({ ...modeleForm, sujet: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" placeholder="Ex: Convocation AG — {date}" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Contenu (utilisez les variables: {'{nom}'}, {'{lot}'}, etc.)</label>
                    <textarea value={modeleForm.contenu || ''} onChange={e => setModeleForm({ ...modeleForm, contenu: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none font-mono" rows={8} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Référence juridique (optionnel)</label>
                    <input type="text" value={modeleForm.referenceJuridique || ''} onChange={e => setModeleForm({ ...modeleForm, referenceJuridique: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" placeholder="Ex: Art. 9 décret n°67-223..." />
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setShowCreateModele(false)} className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Annuler</button>
                  <button onClick={handleCreateModele} className="flex-1 px-4 py-2 bg-[var(--sd-navy,#0D1B2E)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition">Enregistrer</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Envoi groupé ────────────────────────────────────────────────── */}
      {activeTab === 'envoi' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-[var(--sd-ink-3,#888)]">Envoi groupé de communications aux copropriétaires</p>
              <p className="text-xs text-blue-600 mt-1">Réf. loi n°2024-322: envoi dématérialisé sans consentement préalable requis pour les copropriétés</p>
            </div>
            <button onClick={() => { setShowEnvoiModal(true); setPreviewMode(false) }} className="bg-[var(--sd-navy,#0D1B2E)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition">+ Nouvel envoi groupé</button>
          </div>

          {/* Historique envois groupés */}
          <div className="space-y-3">
            {envoisGroupes.sort((a, b) => b.dateEnvoi.localeCompare(a.dateEnvoi)).map(eg => (
              <div key={eg.id} className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-[var(--sd-navy,#0D1B2E)]">{eg.sujet}</h4>
                    <p className="text-xs text-gray-500">Envoyé le {formatDate(eg.dateEnvoi)} — {eg.destinataires.length} destinataire(s)</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${eg.statut === 'envoye' ? 'bg-green-50 text-green-700' : eg.statut === 'programme' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'}`}>
                    {eg.statut === 'envoye' ? '✅ Envoyé' : eg.statut === 'programme' ? '📅 Programmé' : '📝 Brouillon'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="text-center bg-gray-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-[var(--sd-navy,#0D1B2E)]">{eg.stats.envoyes}</div>
                    <div className="text-[10px] text-gray-500">Envoyés</div>
                  </div>
                  <div className="text-center bg-blue-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-blue-700">{eg.stats.distribues}</div>
                    <div className="text-[10px] text-gray-500">Distribués</div>
                  </div>
                  <div className="text-center bg-green-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-green-700">{eg.stats.lus}</div>
                    <div className="text-[10px] text-gray-500">Lus</div>
                  </div>
                </div>
              </div>
            ))}
            {envoisGroupes.length === 0 && (
              <div className="text-center text-sm text-gray-400 py-8 bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)]">Aucun envoi groupé</div>
            )}
          </div>

          {/* Envoi Modal */}
          {showEnvoiModal && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowEnvoiModal(false)}>
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg text-[var(--sd-navy,#0D1B2E)] mb-4">Envoi groupé</h3>

                {!previewMode ? (
                  <div className="space-y-4">
                    {/* Select recipients */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-2 block">Destinataires</label>
                      <div className="flex gap-2 mb-2">
                        <select value={envoiFilterImmeuble} onChange={e => setEnvoiFilterImmeuble(e.target.value)}
                          className="px-3 py-1.5 border-2 border-gray-200 rounded-lg text-xs focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                          <option value="">Tous immeubles</option>
                          {immeublesList.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                        </select>
                        <select value={envoiFilterPaiement} onChange={e => setEnvoiFilterPaiement(e.target.value as any)}
                          className="px-3 py-1.5 border-2 border-gray-200 rounded-lg text-xs focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                          <option value="">Tous statuts</option>
                          <option value="a_jour">✅ À jour</option>
                          <option value="en_retard">⚠️ En retard</option>
                        </select>
                        <button onClick={selectAllDestinataires} className="text-xs text-[var(--sd-gold,#C9A84C)] font-semibold hover:underline">Tout sélectionner</button>
                      </div>
                      <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                        {copropriétaires.filter(cp => {
                          if (envoiFilterImmeuble && cp.immeubleId !== envoiFilterImmeuble) return false
                          if (envoiFilterPaiement && cp.statutPaiement !== envoiFilterPaiement) return false
                          return true
                        }).map(cp => (
                          <label key={cp.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" checked={(envoiForm.destinataires || []).includes(cp.id)} onChange={() => toggleDestinataire(cp.id)} className="rounded" />
                            <span className="text-sm text-[var(--sd-navy,#0D1B2E)] font-medium">{cp.nom}</span>
                            <span className="text-xs text-gray-400">Lot {cp.lot}</span>
                            <span className="text-xs text-gray-400">{cp.immeubleNom}</span>
                            <span className={`text-[10px] ml-auto px-1.5 py-0.5 rounded-full ${cp.statutPaiement === 'a_jour' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                              {cp.statutPaiement === 'a_jour' ? 'À jour' : 'En retard'}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{(envoiForm.destinataires || []).length} destinataire(s) sélectionné(s)</p>
                    </div>

                    {/* Choose template or custom */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Modèle (optionnel)</label>
                      <select value={envoiSelectedModele} onChange={e => {
                        setEnvoiSelectedModele(e.target.value)
                        const mod = modeles.find(m => m.id === e.target.value)
                        if (mod) setEnvoiForm({ ...envoiForm, sujet: mod.sujet, contenu: mod.contenu })
                      }}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                        <option value="">— Message personnalisé —</option>
                        {modeles.map(m => <option key={m.id} value={m.id}>{TYPE_COMM_CONFIG[m.type].icon} {m.nom}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Sujet</label>
                      <input type="text" value={envoiForm.sujet || ''} onChange={e => setEnvoiForm({ ...envoiForm, sujet: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Message</label>
                      <textarea value={envoiForm.contenu || ''} onChange={e => setEnvoiForm({ ...envoiForm, contenu: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none font-mono" rows={6} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Programmer l'envoi (optionnel)</label>
                      <input type="datetime-local" value={envoiForm.dateProgrammee || ''} onChange={e => setEnvoiForm({ ...envoiForm, dateProgrammee: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                    </div>
                  </div>
                ) : (
                  /* Preview Mode */
                  <div className="space-y-3">
                    <div className="bg-[var(--sd-cream,#F7F4EE)] rounded-xl p-4">
                      <h4 className="text-sm font-bold text-[var(--sd-navy,#0D1B2E)] mb-2">Aperçu</h4>
                      <div className="text-sm font-semibold mb-1">Sujet: {envoiForm.sujet}</div>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans bg-white rounded-lg p-3 border border-[var(--sd-border,#E4DDD0)]">{envoiForm.contenu}</pre>
                      <p className="text-xs text-gray-500 mt-2">{(envoiForm.destinataires || []).length} destinataire(s) — {envoiForm.dateProgrammee ? `Programmé pour ${formatDate(envoiForm.dateProgrammee)}` : 'Envoi immédiat'}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-5">
                  <button onClick={() => setShowEnvoiModal(false)} className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Annuler</button>
                  {!previewMode ? (
                    <button onClick={() => setPreviewMode(true)} className="flex-1 px-4 py-2 bg-[var(--sd-gold,#C9A84C)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition" disabled={!(envoiForm.destinataires || []).length || !envoiForm.sujet}>
                      Aperçu
                    </button>
                  ) : (
                    <>
                      <button onClick={() => setPreviewMode(false)} className="px-4 py-2 border-2 border-[var(--sd-gold,#C9A84C)] text-[var(--sd-gold,#C9A84C)] rounded-lg text-sm font-semibold hover:bg-yellow-50 transition">Modifier</button>
                      <button onClick={handleEnvoiGroupe} className="flex-1 px-4 py-2 bg-[var(--sd-navy,#0D1B2E)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition">
                        {envoiForm.dateProgrammee ? '📅 Programmer l\'envoi' : '📤 Envoyer maintenant'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Paramètres ──────────────────────────────────────────────────── */}
      {activeTab === 'parametres' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--sd-ink-3,#888)]">Configuration des envois et préférences de communication</p>

          {/* Canal préféré par copropriétaire */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-5 shadow-sm">
            <h3 className="font-bold text-[var(--sd-navy,#0D1B2E)] mb-3">📬 Canal préféré par copropriétaire</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 text-left">Copropriétaire</th>
                    <th className="px-4 py-2 text-left">Lot</th>
                    <th className="px-4 py-2 text-left">Immeuble</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-center">Canal</th>
                  </tr>
                </thead>
                <tbody>
                  {copropriétaires.map(cp => (
                    <tr key={cp.id} className="border-b border-gray-50">
                      <td className="px-4 py-2 font-medium text-[var(--sd-navy,#0D1B2E)]">{cp.nom}</td>
                      <td className="px-4 py-2 text-gray-500">{cp.lot}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{cp.immeubleNom}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{cp.email}</td>
                      <td className="px-4 py-2 text-center">
                        <select value={cp.canalPrefere} onChange={e => {
                          const updated = copropriétaires.map(c => c.id === cp.id ? { ...c, canalPrefere: e.target.value as CanalPreference } : c)
                          saveAll({ copropriétaires: updated })
                        }}
                          className="px-2 py-1 border border-gray-200 rounded text-xs focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                          <option value="email">📧 Email</option>
                          <option value="courrier">📮 Courrier</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Auto-rappels */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-5 shadow-sm">
            <h3 className="font-bold text-[var(--sd-navy,#0D1B2E)] mb-3">🔔 Auto-rappels</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600">Rappel automatique (jours avant échéance)</label>
                <input type="number" min="1" max="90" value={parametres.autoRappelJours} onChange={e => {
                  const upd = { ...parametres, autoRappelJours: parseInt(e.target.value) }
                  saveAll({ parametres: upd })
                }}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Fréquence résumé</label>
                <select value={parametres.frequenceResume} onChange={e => {
                  const upd = { ...parametres, frequenceResume: e.target.value as 'hebdo' | 'mensuel' }
                  saveAll({ parametres: upd })
                }}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none mt-1">
                  <option value="hebdo">Hebdomadaire</option>
                  <option value="mensuel">Mensuel</option>
                </select>
              </div>
            </div>
          </div>

          {/* Signature personnalisée */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-5 shadow-sm">
            <h3 className="font-bold text-[var(--sd-navy,#0D1B2E)] mb-3">✍️ Signature personnalisée</h3>
            <textarea value={parametres.signaturePersonnalisee} onChange={e => {
              const upd = { ...parametres, signaturePersonnalisee: e.target.value }
              saveAll({ parametres: upd })
            }}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" rows={4} placeholder="Ex: Cabinet Syndic XYZ&#10;12 rue de la Gestion&#10;Tél: ..." />
            {parametres.signaturePersonnalisee && (
              <div className="mt-2 bg-[var(--sd-cream,#F7F4EE)] rounded-lg p-3">
                <p className="text-[10px] text-gray-500 mb-1">Aperçu:</p>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{parametres.signaturePersonnalisee}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
