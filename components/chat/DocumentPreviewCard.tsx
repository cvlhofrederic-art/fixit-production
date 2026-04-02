'use client'

import type { Dispatch, SetStateAction } from 'react'

type DocumentPreview = {
  type: 'devis' | 'facture' | 'rapport'
  clientName: string
  address?: string
  time?: string
  service?: string
  amount?: string
  status: string
  data: Record<string, unknown>
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  action?: {
    type: 'create_rdv' | 'create_devis' | 'create_facture' | 'info'
    data?: Record<string, unknown>
    confirmed?: boolean
  }
  actionsExecuted?: Array<{ tool: string; result: string; detail: string }>
  pendingConfirmation?: { tool: string; params: Record<string, unknown>; description: string; confirm_token: string }
  documentPreview?: DocumentPreview
}

interface DocumentPreviewCardProps {
  msg: Message
  artisanId: string
  onCreateDevis: (data: Record<string, unknown>) => void
  onNavigate: (page: string) => void
  setMessages: Dispatch<SetStateAction<Message[]>>
  addMessage: (role: 'user' | 'assistant', content: string, action?: Message['action']) => Message
}

export default function DocumentPreviewCard({
  msg,
  artisanId,
  onCreateDevis,
  onNavigate,
  setMessages,
  addMessage,
}: DocumentPreviewCardProps) {
  const preview = msg.documentPreview
  if (!preview) return null

  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden" style={{ maxWidth: 300 }}>
      <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #f0f0f0' }}>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
          {preview.type === 'devis' ? '📋' : preview.type === 'facture' ? '🧾' : '📄'}
          {preview.type === 'devis' ? 'DEVIS' : preview.type === 'facture' ? 'FACTURE' : 'RAPPORT'}
          {preview.clientName && ` — ${preview.clientName}`}
        </div>
        {preview.address && (
          <div className="text-[10px] text-gray-500 mt-0.5">📍 {preview.address}</div>
        )}
        {preview.time && (
          <div className="text-[10px] text-gray-500 mt-0.5">🕐 {preview.time}</div>
        )}
        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
          {preview.service && <span>🔧 {preview.service}</span>}
          {preview.amount && <span>💶 {preview.amount}</span>}
        </div>
        <div className="mt-1">
          <span className="inline-block px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-medium">
            {preview.status}
          </span>
        </div>
      </div>
      <div className="flex flex-col">
        {preview.status === 'Brouillon' && (
          <div className="flex">
            <button
              onClick={() => {
                if (preview.type === 'rapport') {
                  // Save rapport to localStorage
                  const rapportData = {
                    id: `rapport_${Date.now()}`,
                    ...preview.data,
                    clientName: preview.clientName,
                    address: preview.address,
                    motif: preview.service,
                    createdAt: new Date().toISOString(),
                    status: (preview.data.status as string) || 'termine',
                    linkedDevisId: null,
                    linkedFactureId: null,
                  }
                  const key = `fixit_rapports_${artisanId}`
                  const existing = JSON.parse(localStorage.getItem(key) || '[]')
                  existing.push(rapportData)
                  localStorage.setItem(key, JSON.stringify(existing))
                  setMessages(prev => prev.map(m =>
                    m.id === msg.id && m.documentPreview
                      ? { ...m, documentPreview: { ...m.documentPreview!, status: 'Confirmé' } }
                      : m
                  ))
                  addMessage('assistant', `✅ **Rapport sauvegardé !** Client : ${preview.clientName || 'N/A'}. Retrouvez-le dans vos rapports.`)
                } else {
                  // Devis/Facture: passer à l'étape "envoyer ou garder ?"
                  setMessages(prev => prev.map(m =>
                    m.id === msg.id && m.documentPreview
                      ? { ...m, documentPreview: { ...m.documentPreview!, status: 'Confirmé' } }
                      : m
                  ))
                  addMessage('assistant', `Voulez-vous envoyer ce ${preview.type} au client maintenant ?`)
                }
              }}
              className="flex-1 py-2 text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition text-center"
              style={{ borderRight: '1px solid #f0f0f0' }}
            >
              ✅ Confirmer
            </button>
            <button
              onClick={() => {
                if (preview.type === 'rapport') {
                  onNavigate('rapports')
                } else {
                  onCreateDevis(preview.data)
                }
                setMessages(prev => prev.map(m =>
                  m.id === msg.id && m.documentPreview
                    ? { ...m, documentPreview: { ...m.documentPreview!, status: 'En modification' } }
                    : m
                ))
              }}
              className="flex-1 py-2 text-[11px] font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 transition text-center"
            >
              ✏️ Modifier
            </button>
          </div>
        )}
        {preview.status === 'Confirmé' && preview.type === 'rapport' && (
          <div className="flex flex-col">
            <div className="px-3 py-1.5 text-[10px] text-gray-500 text-center" style={{ borderBottom: '1px solid #f0f0f0' }}>
              Joindre ce rapport à un document ?
            </div>
            <div className="flex">
              <button
                onClick={() => {
                  const clientName = preview.clientName || ''
                  const docsKey = `fixit_documents_${artisanId}`
                  try {
                    const allDocs: Array<{ id: string; docType?: string; clientName?: string; service?: string; totalTTC?: number; date?: string; createdAt?: string; [k: string]: unknown }> = JSON.parse(localStorage.getItem(docsKey) || '[]')
                    const devisList = allDocs
                      .filter(d => (!d.docType || d.docType === 'devis') && d.clientName && clientName && d.clientName.toLowerCase().includes(clientName.toLowerCase()))
                      .sort((a, b) => new Date(b.createdAt || b.date || '').getTime() - new Date(a.createdAt || a.date || '').getTime())
                      .slice(0, 5)
                    if (devisList.length === 0) {
                      addMessage('assistant', `Aucun devis trouvé pour **${clientName}**. Voulez-vous continuer sans joindre ?`)
                      setMessages(prev => prev.map(m =>
                        m.id === msg.id && m.documentPreview
                          ? { ...m, documentPreview: { ...m.documentPreview!, status: 'Envoi?' } }
                          : m
                      ))
                      return
                    }
                    const listText = devisList.map((d, i) => {
                      const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : (d.date || '')
                      return `**${i + 1}.** Devis — ${d.clientName} — ${d.service || 'Service'} — ${d.totalTTC ?? '—'}€ — ${dateStr}`
                    }).join('\n')
                    addMessage('assistant', `📋 **Devis trouvés pour ${clientName} :**\n\n${listText}\n\nRépondez avec le numéro du devis à lier (ex: 1, 2…)`)
                    sessionStorage.setItem('fixit_pending_rapport_link', JSON.stringify({ type: 'devis', rapportMsgId: msg.id, docs: devisList }))
                    setMessages(prev => prev.map(m =>
                      m.id === msg.id && m.documentPreview
                        ? { ...m, documentPreview: { ...m.documentPreview!, status: 'Sélection devis…' } }
                        : m
                    ))
                  } catch {
                    addMessage('assistant', 'Erreur lors de la lecture des devis.')
                  }
                }}
                className="flex-1 py-2 text-[10px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition text-center"
                style={{ borderRight: '1px solid #f0f0f0' }}
              >
                📋 Joindre à un devis
              </button>
              <button
                onClick={() => {
                  const clientName = preview.clientName || ''
                  const docsKey = `fixit_documents_${artisanId}`
                  try {
                    const allDocs: Array<{ id: string; docType?: string; clientName?: string; service?: string; totalTTC?: number; date?: string; createdAt?: string; [k: string]: unknown }> = JSON.parse(localStorage.getItem(docsKey) || '[]')
                    const factureList = allDocs
                      .filter(d => d.docType === 'facture' && d.clientName && clientName && d.clientName.toLowerCase().includes(clientName.toLowerCase()))
                      .sort((a, b) => new Date(b.createdAt || b.date || '').getTime() - new Date(a.createdAt || a.date || '').getTime())
                      .slice(0, 5)
                    if (factureList.length === 0) {
                      addMessage('assistant', `Aucune facture trouvée pour **${clientName}**. Voulez-vous continuer sans joindre ?`)
                      setMessages(prev => prev.map(m =>
                        m.id === msg.id && m.documentPreview
                          ? { ...m, documentPreview: { ...m.documentPreview!, status: 'Envoi?' } }
                          : m
                      ))
                      return
                    }
                    const listText = factureList.map((d, i) => {
                      const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : (d.date || '')
                      return `**${i + 1}.** Facture — ${d.clientName} — ${d.service || 'Service'} — ${d.totalTTC ?? '—'}€ — ${dateStr}`
                    }).join('\n')
                    addMessage('assistant', `🧾 **Factures trouvées pour ${clientName} :**\n\n${listText}\n\nRépondez avec le numéro de la facture à lier (ex: 1, 2…)`)
                    sessionStorage.setItem('fixit_pending_rapport_link', JSON.stringify({ type: 'facture', rapportMsgId: msg.id, docs: factureList }))
                    setMessages(prev => prev.map(m =>
                      m.id === msg.id && m.documentPreview
                        ? { ...m, documentPreview: { ...m.documentPreview!, status: 'Sélection facture…' } }
                        : m
                    ))
                  } catch {
                    addMessage('assistant', 'Erreur lors de la lecture des factures.')
                  }
                }}
                className="flex-1 py-2 text-[10px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition text-center"
                style={{ borderRight: '1px solid #f0f0f0' }}
              >
                🧾 Joindre à une facture
              </button>
              <button
                onClick={() => {
                  setMessages(prev => prev.map(m =>
                    m.id === msg.id && m.documentPreview
                      ? { ...m, documentPreview: { ...m.documentPreview!, status: 'Envoi?' } }
                      : m
                  ))
                  addMessage('assistant', 'Voulez-vous envoyer ce rapport au client maintenant ?')
                }}
                className="flex-1 py-2 text-[10px] font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 transition text-center"
              >
                ⏭️ Continuer
              </button>
            </div>
          </div>
        )}
        {(preview.status === 'Sélection devis…' || preview.status === 'Sélection facture…') && (
          <div className="py-2 text-center text-[10px] text-gray-400">
            {preview.status === 'Sélection devis…' ? '📋 Sélection en cours…' : '🧾 Sélection en cours…'}
          </div>
        )}
        {(preview.status === 'Confirmé' && preview.type !== 'rapport') || preview.status === 'Envoi?' ? (
          <div className="flex">
            <button
              onClick={() => {
                onCreateDevis({ ...preview.data, autoSendToClient: true })
                setMessages(prev => prev.map(m =>
                  m.id === msg.id && m.documentPreview
                    ? { ...m, documentPreview: { ...m.documentPreview!, status: 'Envoyé' } }
                    : m
                ))
                addMessage('assistant', `✅ **${preview.type === 'devis' ? 'Devis' : preview.type === 'facture' ? 'Facture' : 'Rapport'} envoyé à ${preview.clientName || 'votre client'} via la messagerie !**`)
              }}
              className="flex-1 py-2 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition text-center"
              style={{ borderRight: '1px solid #f0f0f0' }}
            >
              📤 Oui, envoyer au client
            </button>
            <button
              onClick={() => {
                onCreateDevis(preview.data)
                setMessages(prev => prev.map(m =>
                  m.id === msg.id && m.documentPreview
                    ? { ...m, documentPreview: { ...m.documentPreview!, status: 'Sauvegardé' } }
                    : m
                ))
                const docLabel = preview.type === 'devis' ? 'devis' : preview.type === 'facture' ? 'factures' : 'rapports'
                addMessage('assistant', `📁 **Ajouté à vos ${docLabel}.** Vous pourrez l'envoyer quand vous le souhaitez.`)
              }}
              className="flex-1 py-2 text-[11px] font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 transition text-center"
            >
              📁 Non, garder
            </button>
          </div>
        ) : null}
        {(preview.status === 'Envoyé' || preview.status === 'Sauvegardé' || preview.status === 'En modification') && (
          <div className="py-2 text-center text-[10px] text-gray-400">
            {preview.status === 'Envoyé' ? '📤 Envoyé' : preview.status === 'Sauvegardé' ? '📁 Sauvegardé' : '✏️ En modification'}
          </div>
        )}
      </div>
    </div>
  )
}
