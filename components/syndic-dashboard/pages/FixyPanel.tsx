'use client'

import React from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { safeMarkdownToHTML } from '@/lib/sanitize'

interface IaAction {
  type: string
  artisan?: string
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
  [key: string]: unknown
}

interface IaMessage {
  role: 'user' | 'assistant'
  content: string
  action?: IaAction
  actionStatus?: 'pending' | 'confirmed' | 'cancelled' | 'error'
}

interface FixyPanelProps {
  user: { id: string } | null
  fixyPanelOpen: boolean
  setFixyPanelOpen: (open: boolean) => void
  iaMessages: IaMessage[]
  setIaMessages: (msgs: IaMessage[]) => void
  iaInput: string
  setIaInput: (v: string) => void
  iaLoading: boolean
  iaPendingAction: { action: IaAction; iaToken: string } | null
  iaEndRef: React.RefObject<HTMLDivElement>
  iaVoiceActive: boolean
  iaVoiceSupported: boolean
  iaSpeechEnabled: boolean
  iaSpeaking: boolean
  iaVoiceDuration: number
  iaVoiceInterim: string
  iaVoiceHelp: boolean
  setIaVoiceHelp: (v: boolean) => void
  iaVoiceConfidence: number
  sendIaMessage: (override?: string) => void
  handleConfirmIaAction: () => void
  handleCancelIaAction: () => void
  speakResponse: (text: string) => void
  startVoiceRecognition: () => void
  toggleSpeechEnabled: () => void
  stopVoiceRecognition: () => void
}

export default function FixyPanel({
  user,
  fixyPanelOpen,
  setFixyPanelOpen,
  iaMessages,
  setIaMessages,
  iaInput,
  setIaInput,
  iaLoading,
  iaPendingAction,
  iaEndRef,
  iaVoiceActive,
  iaVoiceSupported,
  iaSpeechEnabled,
  iaSpeaking,
  iaVoiceDuration,
  iaVoiceInterim,
  iaVoiceHelp,
  setIaVoiceHelp,
  iaVoiceConfidence,
  sendIaMessage,
  handleConfirmIaAction,
  handleCancelIaAction,
  speakResponse,
  startVoiceRecognition,
  toggleSpeechEnabled,
  stopVoiceRecognition,
}: FixyPanelProps) {
  const { t } = useTranslation()
  const locale = useLocale()

  if (!user) return null

  const fixySvg = (
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
  )

  return (
    <>
      {/* Floating trigger button */}
      {!fixyPanelOpen && (
        <button
          onClick={() => setFixyPanelOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#FFC107] hover:bg-[#FFD54F] rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
          title={locale === 'pt' ? 'Abrir Fixy — Assistente de Ação' : 'Ouvrir Fixy — Assistant d\'Action'}
        >
          {fixySvg}
          {iaPendingAction && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white" />
          )}
        </button>
      )}

      {/* Panel */}
      {fixyPanelOpen && (
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
                <button onClick={stopVoiceRecognition} className="flex-shrink-0 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-2 py-1 rounded-lg transition">⏹</button>
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
                <button onClick={() => setIaVoiceHelp(!iaVoiceHelp)} className="text-xs text-amber-600 hover:text-amber-800 transition flex-shrink-0 ml-2" title={locale === 'pt' ? 'Ajuda vocal' : 'Aide vocale'}>❓</button>
              )}
            </div>
          </div>

        </div>
      )}
    </>
  )
}
