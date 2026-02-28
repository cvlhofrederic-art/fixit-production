'use client'

import { useState, useEffect, useRef } from 'react'

type CanalContact = { id: string; nom: string; role: string; lastSeen?: string }
type CanalMsg = {
  id: string
  sender_id: string
  sender_name: string
  sender_role: string
  content: string
  type: string
  metadata?: string
  created_at: string
  read_at?: string
}

export default function CanalProSection({ artisan, orgRole }: { artisan: any; orgRole: string }) {
  const STORAGE_KEY = `fixit_canal_contacts_${artisan?.id}`
  const [contacts, setContacts] = useState<CanalContact[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [selectedContact, setSelectedContact] = useState<CanalContact | null>(null)
  const [messages, setMessages] = useState<CanalMsg[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactForm, setContactForm] = useState({ nom: '', role: 'Artisan', identifiant: '' })
  const [isRecording, setIsRecording] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'recording' | 'processing'>('idle')
  const [attachFile, setAttachFile] = useState<File | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Vérifier support vocal
  useEffect(() => {
    const hasVoice = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    setVoiceSupported(hasVoice)
  }, [])

  // Sauvegarder contacts
  const saveContacts = (updated: CanalContact[]) => {
    setContacts(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  // Charger messages
  const loadMessages = async (contact: CanalContact) => {
    setMsgLoading(true)
    try {
      const res = await fetch(`/api/pro/channel?contact_id=${contact.id}`)
      const data = await res.json()
      if (data.messages) {
        setMessages(data.messages)
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch {
      // Fallback localStorage
      const local = localStorage.getItem(`fixit_canal_msgs_${artisan?.id}_${contact.id}`)
      if (local) setMessages(JSON.parse(local))
    }
    setMsgLoading(false)
  }

  // Polling messages toutes les 5s
  useEffect(() => {
    if (!selectedContact) return
    loadMessages(selectedContact)
    pollRef.current = setInterval(() => loadMessages(selectedContact), 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [selectedContact?.id])

  // Envoyer message texte
  const sendMessage = async (content?: string, type = 'text', metadata?: any) => {
    const msgContent = content || newMsg.trim()
    if (!msgContent && type === 'text') return
    if (!selectedContact) return
    setSending(true)

    const optimistic: CanalMsg = {
      id: Date.now().toString(),
      sender_id: artisan?.user_id || 'me',
      sender_name: artisan?.company_name || 'Moi',
      sender_role: orgRole,
      content: msgContent,
      type,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setNewMsg('')
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

    try {
      await fetch('/api/pro/channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msgContent, contact_id: selectedContact.id, type, metadata }),
      })
    } catch {
      // Sauvegarder en local si offline
      const key = `fixit_canal_msgs_${artisan?.id}_${selectedContact.id}`
      const existing = JSON.parse(localStorage.getItem(key) || '[]')
      localStorage.setItem(key, JSON.stringify([...existing, optimistic]))
    }
    setSending(false)
  }

  // Commande vocale
  const startVoice = () => {
    if (!voiceSupported) return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.continuous = false
    recognition.interimResults = false
    recognitionRef.current = recognition

    recognition.onstart = () => { setIsRecording(true); setVoiceStatus('recording') }
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setVoiceStatus('processing')

      // Détecter commandes vocales métier
      const lower = transcript.toLowerCase()
      let processedContent = transcript
      let type = 'voice'
      let metadata: any = { original: transcript }

      if (lower.includes('bâtiment') || lower.includes('batiment') || lower.includes('résidence') || lower.includes('immeuble')) {
        type = 'voice_location'
        const batMatch = transcript.match(/bâtiment\s+([A-Za-z0-9]+)/i) || transcript.match(/batiment\s+([A-Za-z0-9]+)/i)
        const numMatch = transcript.match(/numéro\s+([0-9]+)/i) || transcript.match(/numero\s+([0-9]+)/i)
        const aptMatch = transcript.match(/appartement\s+([A-Za-z0-9]+)/i) || transcript.match(/apt\.?\s+([A-Za-z0-9]+)/i)
        metadata = {
          original: transcript,
          batiment: batMatch?.[1],
          numero: numMatch?.[1],
          appartement: aptMatch?.[1],
          isLocation: true,
        }
        processedContent = `📍 Position : ${transcript}`
      } else if (lower.includes('terminé') || lower.includes('termine') || lower.includes('fini') || lower.includes('intervention terminée')) {
        type = 'voice_status'
        metadata = { original: transcript, status: 'completed' }
        processedContent = `✅ Intervention terminée : ${transcript}`
      } else if (lower.includes('problème') || lower.includes('urgence') || lower.includes('alerte')) {
        type = 'voice_alert'
        metadata = { original: transcript, priority: 'high' }
        processedContent = `🚨 Alerte : ${transcript}`
      } else if (lower.includes('devis') || lower.includes('montant') || lower.includes('euros') || lower.includes('€')) {
        type = 'voice_devis'
        metadata = { original: transcript }
        processedContent = `💰 Devis vocal : ${transcript}`
      }

      setNewMsg(processedContent)
      setIsRecording(false)
      setVoiceStatus('idle')

      if (type !== 'text' && type !== 'voice') {
        setTimeout(() => sendMessage(processedContent, type, metadata), 500)
      }
    }
    recognition.onerror = () => { setIsRecording(false); setVoiceStatus('idle') }
    recognition.onend = () => { setIsRecording(false); setVoiceStatus('idle') }
    recognition.start()
  }

  const stopVoice = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
    setVoiceStatus('idle')
  }

  // Ajouter contact
  const handleAddContact = () => {
    if (!contactForm.nom.trim()) return
    const c: CanalContact = {
      id: contactForm.identifiant || Date.now().toString(),
      nom: contactForm.nom,
      role: contactForm.role,
      lastSeen: new Date().toISOString(),
    }
    saveContacts([...contacts, c])
    setShowAddContact(false)
    setContactForm({ nom: '', role: 'Artisan', identifiant: '' })
    setSelectedContact(c)
  }

  const MSG_TYPE_ICONS: Record<string, string> = {
    text: '', voice: '🎤 ', voice_location: '📍 ', voice_status: '✅ ', voice_alert: '🚨 ', voice_devis: '💰 ', file: '📎 ', photo: '🖼️ ', rapport: '📋 ', devis: '📄 ',
  }

  const ROLE_COLORS: Record<string, string> = {
    artisan: 'bg-amber-100 text-amber-800', pro_societe: 'bg-blue-100 text-blue-800', pro_conciergerie: 'bg-purple-100 text-purple-800', pro_gestionnaire: 'bg-green-100 text-green-800',
  }

  return (
    <div className="animate-fadeIn h-full flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <div className="bg-white px-6 lg:px-10 py-5 border-b-2 border-[#FFC107] shadow-sm flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold">📡 Canal Pro</h1>
          <p className="text-sm text-gray-500">Communication directe gestionnaire ↔ artisan</p>
        </div>
        <button onClick={() => setShowAddContact(true)} className="bg-[#FFC107] text-gray-900 px-4 py-2 rounded-xl font-semibold text-sm hover:bg-[#FFD54F] transition">+ Contact</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Liste contacts ── */}
        <div className="w-[240px] lg:w-[280px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="p-3 border-b">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contacts</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {contacts.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-4xl mb-3">📡</div>
                <p className="text-sm text-gray-500 mb-3">Aucun contact</p>
                <button onClick={() => setShowAddContact(true)} className="text-xs text-[#FFC107] font-semibold hover:underline">+ Ajouter un contact</button>
              </div>
            ) : (
              contacts.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedContact(c)}
                  className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition border-b border-gray-100 ${selectedContact?.id === c.id ? 'bg-amber-50 border-l-4 border-l-[#FFC107]' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {c.nom.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{c.nom}</div>
                    <div className="text-xs text-gray-500">{c.role}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Zone chat ── */}
        <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
          {!selectedContact ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-xl font-bold mb-2 text-gray-700">Sélectionnez un contact</h3>
                <p className="text-gray-500 mb-4">Choisissez un artisan ou technicien pour démarrer la conversation</p>
                {voiceSupported && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-xs mx-auto">
                    <p className="text-sm text-amber-700 font-semibold">🎤 Commandes vocales disponibles</p>
                    <p className="text-xs text-amber-600 mt-1">Dites &quot;Bâtiment A, numéro 6&quot; pour envoyer votre position, &quot;Intervention terminée&quot; pour le statut, etc.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Header contact */}
              <div className="bg-white border-b border-gray-200 px-5 py-4 flex items-center gap-3 flex-shrink-0 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-white font-bold">
                  {selectedContact.nom.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold">{selectedContact.nom}</div>
                  <div className="text-xs text-gray-500">{selectedContact.role} · Canal direct</div>
                </div>
                <div className="ml-auto flex gap-2">
                  {voiceSupported && !isRecording && (
                    <button onClick={startVoice} className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-200 transition">🎤 Vocal</button>
                  )}
                  {isRecording && (
                    <button onClick={stopVoice} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-semibold animate-pulse hover:bg-red-200 transition">⏹ Stop</button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgLoading ? (
                  <div className="text-center py-10 text-gray-500">Chargement...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="text-4xl mb-3">💬</div>
                    <p className="text-gray-500 text-sm">Démarrez la conversation</p>
                    {voiceSupported && (
                      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-sm mx-auto text-left">
                        <p className="text-sm font-bold text-amber-800 mb-2">🎤 Exemples de commandes vocales :</p>
                        <ul className="text-xs text-amber-700 space-y-1">
                          <li>• <em>&quot;Bâtiment B, numéro 12, Madame Dupont&quot;</em> → localisation automatique</li>
                          <li>• <em>&quot;Intervention terminée, fuite réparée&quot;</em> → statut terminé</li>
                          <li>• <em>&quot;Urgence, dégât des eaux au 3ème&quot;</em> → alerte priorité haute</li>
                          <li>• <em>&quot;Devis 450 euros pour remplacement robinet&quot;</em> → message devis</li>
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.sender_id === (artisan?.user_id || artisan?.id)
                    const icon = MSG_TYPE_ICONS[msg.type] || ''
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${isMe ? 'bg-[#FFC107] text-gray-900 rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200'}`}>
                          {!isMe && (
                            <div className="text-xs font-bold text-gray-500 mb-1">{msg.sender_name}
                              {msg.sender_role && <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${ROLE_COLORS[msg.sender_role] || 'bg-gray-100 text-gray-600'}`}>{msg.sender_role}</span>}
                            </div>
                          )}
                          <p className="text-sm leading-relaxed">{icon}{msg.content}</p>
                          {msg.metadata && msg.type === 'voice_location' && (() => {
                            try {
                              const meta = JSON.parse(msg.metadata)
                              if (meta.isLocation && (meta.batiment || meta.numero)) {
                                return (
                                  <div className="mt-2 bg-white/30 rounded-lg p-2 text-xs">
                                    {meta.batiment && <span className="mr-2">🏢 Bât {meta.batiment}</span>}
                                    {meta.numero && <span className="mr-2">🚪 N°{meta.numero}</span>}
                                    {meta.appartement && <span>🏠 Apt {meta.appartement}</span>}
                                  </div>
                                )
                              }
                            } catch { return null }
                            return null
                          })()}
                          <div className={`text-[10px] mt-1 ${isMe ? 'text-gray-700' : 'text-gray-500'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            {msg.read_at && isMe && ' · Lu'}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Statut vocal */}
              {voiceStatus === 'recording' && (
                <div className="mx-4 mb-2 bg-red-50 border border-red-200 rounded-xl p-3 text-center text-sm text-red-700 animate-pulse">
                  🔴 Enregistrement en cours... Parlez maintenant
                </div>
              )}
              {voiceStatus === 'processing' && (
                <div className="mx-4 mb-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-center text-sm text-blue-700">
                  ⚙️ Traitement de la commande vocale...
                </div>
              )}

              {/* Zone saisie */}
              <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
                <div className="flex gap-2 items-end">
                  <div className="flex gap-2">
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={e => setAttachFile(e.target.files?.[0] || null)} />
                    <button onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition" title="Joindre un fichier">📎</button>
                    {voiceSupported && (
                      <button
                        onMouseDown={startVoice}
                        onTouchStart={startVoice}
                        className={`p-2 rounded-lg transition ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-500 hover:text-gray-600 hover:bg-gray-100'}`}
                        title="Commande vocale"
                      >🎤</button>
                    )}
                  </div>
                  <div className="flex-1">
                    {attachFile && (
                      <div className="mb-2 bg-blue-50 rounded-lg px-3 py-1.5 text-xs text-blue-700 flex justify-between items-center">
                        <span>📎 {attachFile.name}</span>
                        <button onClick={() => setAttachFile(null)} className="text-blue-400 hover:text-blue-600">✕</button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMsg}
                        onChange={e => setNewMsg(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                        placeholder={isRecording ? '🔴 Enregistrement vocal...' : 'Tapez un message...'}
                        disabled={isRecording}
                        className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#FFC107] outline-none text-sm"
                      />
                      <button
                        onClick={() => sendMessage()}
                        disabled={sending || (!newMsg.trim() && !attachFile)}
                        className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-50"
                      >Envoyer</button>
                    </div>
                  </div>
                </div>
                {/* Actions rapides vocales */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button onClick={() => sendMessage('📍 En route vers le chantier', 'voice_status')} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full font-medium transition">🚗 En route</button>
                  <button onClick={() => sendMessage('✅ Arrivé sur place', 'voice_status')} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full font-medium transition">📍 Arrivé</button>
                  <button onClick={() => sendMessage('✅ Intervention terminée', 'voice_status', { status: 'completed' })} className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-full font-medium transition">✅ Terminé</button>
                  <button onClick={() => sendMessage('🚨 Problème détecté, besoin d\'assistance', 'voice_alert', { priority: 'high' })} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-full font-medium transition">🚨 Alerte</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal ajout contact */}
      {showAddContact && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📡 Ajouter un contact</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Nom / Société *</label>
                <input value={contactForm.nom} onChange={e => setContactForm({...contactForm, nom: e.target.value})} placeholder="Jean Dupont Plomberie" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#FFC107] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Rôle</label>
                <select value={contactForm.role} onChange={e => setContactForm({...contactForm, role: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#FFC107] outline-none">
                  {['Artisan', 'Technicien', 'Sous-traitant', 'Fournisseur', 'Gestionnaire', 'Syndic', 'Autre'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Identifiant utilisateur (optionnel)</label>
                <input value={contactForm.identifiant} onChange={e => setContactForm({...contactForm, identifiant: e.target.value})} placeholder="ID Supabase ou email" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#FFC107] outline-none" />
                <p className="text-xs text-gray-500 mt-1">Si l&apos;artisan est inscrit sur Vitfix, renseignez son ID pour la messagerie temps réel</p>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowAddContact(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleAddContact} className="flex-1 py-2.5 bg-[#FFC107] text-gray-900 rounded-xl font-semibold hover:bg-[#FFD54F] transition">Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
