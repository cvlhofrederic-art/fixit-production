'use client'

import React, { useState, useRef } from 'react'
import type { Artisan, SyndicMessage } from '@/components/syndic-dashboard/types'
import type { User } from '@supabase/supabase-js'

interface ArtisansPageSectionProps {
  artisans: Artisan[]
  setArtisans: React.Dispatch<React.SetStateAction<Artisan[]>>
  user: User | null
  locale: string
  t: (key: string, fallback?: string) => string
  getAdminToken: () => Promise<string>
  setShowModalMission: (show: boolean) => void
}

export default function ArtisansPageSection({
  artisans,
  setArtisans,
  user,
  locale,
  t,
  getAdminToken,
  setShowModalMission,
}: ArtisansPageSectionProps) {
  // ── Artisan management state ──
  const [showModalArtisan, setShowModalArtisan] = useState(false)
  const [artisanForm, setArtisanForm] = useState({ email: '', nom: '', prenom: '', telephone: '', metier: '', siret: '' })
  const [artisanSearchResult, setArtisanSearchResult] = useState<{ found: boolean; name?: string; role?: string; telephone?: string; metier?: string; siret?: string } | null>(null)
  const [artisanSearchLoading, setArtisanSearchLoading] = useState(false)
  const [artisanSubmitting, setArtisanSubmitting] = useState(false)
  const [artisanError, setArtisanError] = useState('')
  const [artisanSuccess, setArtisanSuccess] = useState('')
  const [artisansLoaded, setArtisansLoaded] = useState(false)

  // ── Canal communication state ──
  const [selectedArtisanChat, setSelectedArtisanChat] = useState<Artisan | null>(null)
  const [messages, setMessages] = useState<SyndicMessage[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [msgLoading, setMsgLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ── Fetch artisans ──
  const fetchArtisans = async () => {
    try {
      const token = await getAdminToken()
      const res = await fetch('/api/syndic/artisans', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.artisans && data.artisans.length > 0) {
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

  // ── Fetch messages ──
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

  // ── Send message ──
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

  // ── Email search ──
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
          const fullName = data.name || ''
          const parts = fullName.trim().split(' ')
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
        setArtisanSearchResult({ found: false })
      }
    } catch {
      setArtisanSearchResult({ found: false })
    }
    setArtisanSearchLoading(false)
  }

  // ── Add artisan ──
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
        setArtisansLoaded(false)
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

  // ── Delete artisan ──
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

  return (
    <>
      {/* ── ARTISANS LIST ── */}
      {!selectedArtisanChat && (
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
      {selectedArtisanChat && (
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
                    {msg.message_type === 'rapport' && <p className="text-xs font-bold mb-1">📋 Rapport d&apos;intervention</p>}
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
    </>
  )
}
