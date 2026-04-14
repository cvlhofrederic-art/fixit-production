'use client'

import { useState, useEffect, useRef } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'

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

export default function CanalProSection({ artisan, orgRole }: { artisan: import('@/lib/types').Artisan; orgRole: string }) {
  const locale = useLocale()
  void orgRole
  const tv = useThemeVars(true)
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
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
    } finally {
      setMsgLoading(false)
    }
  }

  // Polling messages toutes les 5s
  useEffect(() => {
    if (!selectedContact) return
    loadMessages(selectedContact)
    pollRef.current = setInterval(() => loadMessages(selectedContact), 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [selectedContact?.id])

  // Envoyer message texte
  const sendMessage = async (content?: string, type = 'text', metadata?: Record<string, unknown>) => {
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
    } finally {
      setSending(false)
    }
  }

  // Commande vocale
  const startVoice = () => {
    if (!voiceSupported) return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = locale === 'pt' ? 'pt-PT' : 'fr-FR'
    recognition.continuous = false
    recognition.interimResults = false
    recognitionRef.current = recognition

    recognition.onstart = () => { setIsRecording(true); setVoiceStatus('recording') }
    recognition.onresult = (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => {
      const transcript = event.results[0][0].transcript
      setVoiceStatus('processing')

      // Détecter commandes vocales métier
      const lower = transcript.toLowerCase()
      let processedContent = transcript
      let type = 'voice'
      let metadata: Record<string, unknown> = { original: transcript }

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

  const ROLE_TAG_CLASS: Record<string, string> = {
    artisan: 'v5-badge v5-badge-amber', pro_societe: 'v5-badge v5-badge-gray', pro_conciergerie: 'v5-badge v5-badge-gray', pro_gestionnaire: 'v5-badge v5-badge-green',
  }

  return (
    <div className="v5-fade" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 120px)' }}>
      {/* Page header */}
      <div className="v5-pg-t" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>📡 Canal Pro</h1>
          <p>Communication directe gestionnaire ↔ artisan</p>
        </div>
        <button onClick={() => setShowAddContact(true)} className="v5-btn v5-btn-p">+ Contact</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ── Liste contacts ── */}
        <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', background: tv.surface, borderRight: `1px solid ${tv.border}` }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${tv.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: tv.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contacts</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {contacts.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
                <p style={{ fontSize: 12, color: tv.textMuted, marginBottom: 12 }}>Aucun contact</p>
                <button onClick={() => setShowAddContact(true)} className="v5-btn v5-btn-sm">+ Ajouter un contact</button>
              </div>
            ) : (
              contacts.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedContact(c)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer',
                    borderBottom: `1px solid ${tv.border}`,
                    background: selectedContact?.id === c.id ? tv.primaryLight : 'transparent',
                    borderLeft: selectedContact?.id === c.id ? `3px solid ${tv.primary}` : '3px solid transparent',
                  }}
                >
                  <div className="v22-chat-avatar">
                    {c.nom.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: tv.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</div>
                    <div style={{ fontSize: 11, color: tv.textMuted }}>{c.role}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Zone chat ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: tv.bg, minWidth: 0 }}>
          {!selectedContact ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: tv.text }}>Sélectionnez un contact</h3>
                <p style={{ color: tv.textMuted, fontSize: 12, marginBottom: 16 }}>Choisissez un artisan ou technicien pour démarrer la conversation</p>
                {voiceSupported && (
                  <div className="v5-card" style={{ maxWidth: 320, margin: '0 auto' }}>
                    <p style={{ fontSize: 12, fontWeight: 600 }}>🎤 Commandes vocales disponibles</p>
                    <p style={{ fontSize: 11, marginTop: 4 }}>Dites &quot;Bâtiment A, numéro 6&quot; pour envoyer votre position, &quot;Intervention terminée&quot; pour le statut, etc.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Header contact */}
              <div style={{ background: tv.surface, borderBottom: `1px solid ${tv.border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div className="v22-chat-avatar" style={{ background: tv.primary }}>
                  {selectedContact.nom.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: tv.text }}>{selectedContact.nom}</div>
                  <div style={{ fontSize: 11, color: tv.textMuted }}>{selectedContact.role} · Canal direct</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {voiceSupported && !isRecording && (
                    <button onClick={startVoice} className="v5-btn v5-btn-sm">🎤 Vocal</button>
                  )}
                  {isRecording && (
                    <button onClick={stopVoice} className="v5-btn v5-btn-sm">⏹ Stop</button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {msgLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: tv.textMuted, fontSize: 12 }}>Chargement...</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
                    <p style={{ color: tv.textMuted, fontSize: 12 }}>Démarrez la conversation</p>
                    {voiceSupported && (
                      <div className="v5-card" style={{ marginTop: 16, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto', textAlign: 'left' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>🎤 Exemples de commandes vocales :</p>
                        <ul style={{ fontSize: 11, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                      <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                        <div className={isMe ? 'v22-chat-bubble v22-chat-bubble-user' : 'v22-chat-bubble v22-chat-bubble-assistant'} style={{ maxWidth: '75%' }}>
                          {!isMe && (
                            <div style={{ fontSize: 10, fontWeight: 600, color: tv.textMuted, marginBottom: 4 }}>
                              {msg.sender_name}
                              {msg.sender_role && <span className={ROLE_TAG_CLASS[msg.sender_role] || 'v22-tag v22-tag-gray'} style={{ marginLeft: 6, fontSize: 9 }}>{msg.sender_role}</span>}
                            </div>
                          )}
                          <p style={{ fontSize: 12, lineHeight: 1.6, margin: 0 }}>{icon}{msg.content}</p>
                          {msg.metadata && msg.type === 'voice_location' && (() => {
                            try {
                              const meta = JSON.parse(msg.metadata)
                              if (meta.isLocation && (meta.batiment || meta.numero)) {
                                return (
                                  <div style={{ marginTop: 6, background: 'rgba(255,255,255,0.3)', borderRadius: 3, padding: 6, fontSize: 11 }}>
                                    {meta.batiment && <span style={{ marginRight: 8 }}>🏢 Bât {meta.batiment}</span>}
                                    {meta.numero && <span style={{ marginRight: 8 }}>🚪 N°{meta.numero}</span>}
                                    {meta.appartement && <span>🏠 Apt {meta.appartement}</span>}
                                  </div>
                                )
                              }
                            } catch { return null }
                            return null
                          })()}
                          <div style={{ fontSize: 10, marginTop: 4, color: isMe ? 'rgba(0,0,0,0.5)' : tv.textMuted }}>
                            {new Date(msg.created_at).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })}
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
                <div className="v5-card" style={{ margin: '0 14px 8px' }}>
                  🔴 Enregistrement en cours... Parlez maintenant
                </div>
              )}
              {voiceStatus === 'processing' && (
                <div className="v5-card" style={{ margin: '0 14px 8px' }}>
                  ⚙️ Traitement de la commande vocale...
                </div>
              )}

              {/* Zone saisie */}
              <div style={{ background: tv.surface, borderTop: `1px solid ${tv.border}`, padding: 14, flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept="image/*,.pdf,.doc,.docx" onChange={e => setAttachFile(e.target.files?.[0] || null)} />
                    <button onClick={() => fileInputRef.current?.click()} className="v5-btn v5-btn-sm" title="Joindre un fichier">📎</button>
                    {voiceSupported && (
                      <button
                        onMouseDown={startVoice}
                        onTouchStart={startVoice}
                        className={`v5-btn v5-btn-sm ${isRecording ? 'animate-pulse' : ''}`}
                        title="Commande vocale"
                      >🎤</button>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    {attachFile && (
                      <div style={{ marginBottom: 6, background: tv.primaryLight, borderRadius: 3, padding: '4px 10px', fontSize: 11, color: tv.primary, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>📎 {attachFile.name}</span>
                        <button onClick={() => setAttachFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tv.primary, fontSize: 12 }}>✕</button>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        value={newMsg}
                        onChange={e => setNewMsg(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                        placeholder={isRecording ? '🔴 Enregistrement vocal...' : 'Tapez un message...'}
                        disabled={isRecording}
                        className="v5-fi"
                        style={{ flex: 1 }}
                      />
                      <button
                        onClick={() => sendMessage()}
                        disabled={sending || (!newMsg.trim() && !attachFile)}
                        className="v5-btn v5-btn-p"
                        style={{ opacity: (sending || (!newMsg.trim() && !attachFile)) ? 0.5 : 1 }}
                      >{sending ? 'Envoi...' : 'Envoyer'}</button>
                    </div>
                  </div>
                </div>
                {/* Actions rapides vocales */}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => sendMessage('📍 En route vers le chantier', 'voice_status')} disabled={sending} className="v5-badge v5-badge-gray" style={{ cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1 }}>🚗 En route</button>
                  <button onClick={() => sendMessage('✅ Arrivé sur place', 'voice_status')} disabled={sending} className="v5-badge v5-badge-gray" style={{ cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1 }}>📍 Arrivé</button>
                  <button onClick={() => sendMessage('✅ Intervention terminée', 'voice_status', { status: 'completed' })} disabled={sending} className="v5-badge v5-badge-green" style={{ cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1 }}>✅ Terminé</button>
                  <button onClick={() => sendMessage('🚨 Problème détecté, besoin d\'assistance', 'voice_alert', { priority: 'high' })} disabled={sending} className="v5-badge v5-badge-red" style={{ cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1 }}>🚨 Alerte</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal ajout contact */}
      {showAddContact && (
        <div className="v5-modal-ov">
          <div className="v5-modal" style={{ width: '100%', maxWidth: 420 }}>
            <div className="v5-modal-h">
              <div className="v5-modal-t">📡 Ajouter un contact</div>
              <button onClick={() => setShowAddContact(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px' }}>
              <div className="v5-fg">
                <label className="v5-fl">Nom / Société *</label>
                <input value={contactForm.nom} onChange={e => setContactForm({...contactForm, nom: e.target.value})} placeholder="Jean Dupont Plomberie" className="v5-fi" />
              </div>
              <div className="v5-fg">
                <label className="v5-fl">Rôle</label>
                <select value={contactForm.role} onChange={e => setContactForm({...contactForm, role: e.target.value})} className="v5-fi">
                  {['Artisan', 'Technicien', 'Sous-traitant', 'Fournisseur', 'Gestionnaire', 'Syndic', 'Autre'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="v5-fg">
                <label className="v5-fl">Identifiant utilisateur (optionnel)</label>
                <input value={contactForm.identifiant} onChange={e => setContactForm({...contactForm, identifiant: e.target.value})} placeholder="ID Supabase ou email" className="v5-fi" />
                <p style={{ fontSize: 11, color: tv.textMuted, marginTop: 4 }}>Si l&apos;artisan est inscrit sur Vitfix, renseignez son ID pour la messagerie temps réel</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '0 16px 16px' }}>
              <button onClick={() => setShowAddContact(false)} className="v5-btn" style={{ flex: 1 }}>Annuler</button>
              <button onClick={handleAddContact} className="v5-btn v5-btn-p" style={{ flex: 1 }}>Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
