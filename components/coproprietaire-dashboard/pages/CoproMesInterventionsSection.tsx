'use client'

import React, { useState } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { type CoproProfile, type SuiviIntervention, INTERVENTIONS_DEMO } from '@/lib/copro-demo-data'

interface Props {
  profile: CoproProfile
}

export default function CoproMesInterventionsSection({ profile }: Props) {
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const L = locale === 'pt'

  const [interventions, setInterventions] = useState<SuiviIntervention[]>(() => {
    if (typeof window === 'undefined') return INTERVENTIONS_DEMO
    const saved = localStorage.getItem(`fixit_interventions_copro_${profile.id}`)
    return saved ? JSON.parse(saved) : INTERVENTIONS_DEMO
  })
  const [selected, setSelected] = useState<SuiviIntervention | null>(null)
  const [noteModal, setNoteModal] = useState<SuiviIntervention | null>(null)
  const [noteVal, setNoteVal] = useState(5)
  const [noteComment, setNoteComment] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('all')

  const save = (list: SuiviIntervention[]) => {
    setInterventions(list)
    localStorage.setItem(`fixit_interventions_copro_${profile.id}`, JSON.stringify(list))
  }

  const submitNote = () => {
    if (!noteModal) return
    const updated = interventions.map(i => i.id === noteModal.id ? { ...i, note: noteVal, commentaire: noteComment } : i)
    save(updated)
    setNoteModal(null)
    setNoteComment('')
  }

  const statutCfg: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
    planifie:  { label: L ? 'Planeado' : 'Planifié',   color: 'text-blue-700',  bg: 'bg-blue-100',   emoji: '📅' },
    en_route:  { label: L ? 'A caminho' : 'En route',   color: 'text-amber-700', bg: 'bg-amber-100',  emoji: '🚗' },
    sur_place: { label: L ? 'No local' : 'Sur place',  color: 'text-[#A8842A]',bg: 'bg-[rgba(201,168,76,0.15)]', emoji: '🔧' },
    termine:   { label: L ? 'Concluído' : 'Terminé',    color: 'text-green-700', bg: 'bg-green-100',  emoji: '✅' },
    annule:    { label: L ? 'Cancelado' : 'Annulé',     color: 'text-red-700',   bg: 'bg-red-100',    emoji: '❌' },
  }

  const filtered = filterStatut === 'all' ? interventions : interventions.filter(i => i.statut === filterStatut)
  const enCours = interventions.filter(i => ['en_route', 'sur_place'].includes(i.statut))

  return (
    <div className="space-y-6">
      {/* Alerte intervention en cours */}
      {enCours.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
            <span className="font-bold text-amber-800 text-sm">{enCours.length} {L ? (enCours.length > 1 ? 'intervenções em curso' : 'intervenção em curso') : `intervention${enCours.length > 1 ? 's' : ''} en cours`}</span>
          </div>
          {enCours.map(i => (
            <div key={i.id} onClick={() => setSelected(i)} className="mt-2 bg-white border border-amber-200 rounded-xl p-3 cursor-pointer hover:bg-amber-50 transition">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-[#0D1B2E]">{i.type} — {i.artisan.split('—')[0].trim()}</div>
                  <div className="text-xs text-[#8A9BB0] mt-0.5">{i.description}</div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${statutCfg[i.statut].bg} ${statutCfg[i.statut].color}`}>
                    {statutCfg[i.statut].emoji} {statutCfg[i.statut].label}
                  </span>
                  {i.gpsEta && <div className="text-[10px] text-[#8A9BB0] mt-1">ETA : ~{i.gpsEta} min</div>}
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-[#8A9BB0] mb-1">
                  <span>{L ? 'Progresso' : 'Progression'}</span>
                  <span>{i.progression}%</span>
                </div>
                <div className="h-2 bg-[#F7F4EE] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${i.progression}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([['all', L ? 'Todas' : 'Toutes'], ['planifie', L ? '📅 Planeadas' : '📅 Planifiées'], ['en_route', L ? '🚗 A caminho' : '🚗 En route'], ['sur_place', L ? '🔧 No local' : '🔧 Sur place'], ['termine', L ? '✅ Concluídas' : '✅ Terminées']] as [string, string][]).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilterStatut(v)}
            className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
              filterStatut === v ? 'bg-[#0D1B2E] text-white border-[#C9A84C]' : 'bg-white text-[#4A5E78] border-[#E4DDD0] hover:border-[#C9A84C]'
            }`}
          >{l}</button>
        ))}
      </div>

      {/* Liste interventions */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-[#E4DDD0] p-12 text-center">
            <div className="text-5xl mb-3">🔧</div>
            <div className="text-sm text-[#4A5E78] font-medium">{L ? 'Nenhuma intervenção para este filtro' : 'Aucune intervention pour ce filtre'}</div>
          </div>
        )}
        {filtered.map(i => {
          const cfg = statutCfg[i.statut]
          return (
            <div
              key={i.id}
              onClick={() => setSelected(i)}
              className="bg-white rounded-xl border border-[#E4DDD0] p-5 shadow-sm hover:border-[#C9A84C] hover:shadow-md cursor-pointer transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.emoji} {cfg.label}</span>
                    <span className="text-xs text-[#8A9BB0]">{new Date(i.dateRdv).toLocaleDateString(dateFmtLocale)} · {i.heureRdv}</span>
                  </div>
                  <div className="font-semibold text-[#0D1B2E]">{i.type}</div>
                  <div className="text-sm text-[#8A9BB0] truncate">{i.description}</div>
                  <div className="text-xs text-[#8A9BB0] mt-1">👷 {i.artisan}</div>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  {i.note && (
                    <div className="text-sm font-bold text-amber-500">{'⭐'.repeat(i.note)}</div>
                  )}
                  {i.statut === 'termine' && !i.note && (
                    <button
                      onClick={e => { e.stopPropagation(); setNoteModal(i); setNoteVal(5); setNoteComment('') }}
                      className="text-xs bg-[#0D1B2E] hover:bg-[#152338] text-white px-3 py-1 rounded-full font-semibold transition"
                    >
                      {L ? '✍️ Avaliar' : '✍️ Noter'}
                    </button>
                  )}
                  {i.preuve && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      {L ? '✅ Prova' : '✅ Preuve'} {i.preuve.signee ? (L ? '+ assinado' : '+ signé') : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar pour interventions non terminées */}
              {!['termine', 'annule', 'planifie'].includes(i.statut) && (
                <div className="mt-3">
                  <div className="h-1.5 bg-[#F7F4EE] rounded-full overflow-hidden">
                    <div className="h-full bg-[#C9A84C] rounded-full transition-all" style={{ width: `${i.progression}%` }} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal détail intervention */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4DDD0]">
              <div>
                <h3 className="text-lg font-bold text-[#0D1B2E]">{selected.type}</h3>
                <p className="text-sm text-[#8A9BB0]">{selected.description}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-[#8A9BB0] hover:text-[#4A5E78] text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Statut */}
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${statutCfg[selected.statut].bg} ${statutCfg[selected.statut].color}`}>
                  {statutCfg[selected.statut].emoji} {statutCfg[selected.statut].label}
                </span>
                {selected.gpsEta && (
                  <span className="text-sm text-amber-600 font-semibold">🛣️ ETA ~{selected.gpsEta} {L ? 'min' : 'min'}</span>
                )}
              </div>

              {/* Artisan */}
              <div className="bg-[#F7F4EE] rounded-xl p-4">
                <div className="text-xs text-[#8A9BB0] mb-1 font-medium">{L ? 'TÉCNICO' : 'ARTISAN'}</div>
                <div className="font-semibold text-[#0D1B2E]">{selected.artisan}</div>
                <a href={`tel:${selected.artisanPhone.replace(/\s/g, '')}`} className="text-sm text-[#C9A84C] hover:text-[#A8842A] font-medium mt-1 inline-block">
                  📞 {selected.artisanPhone}
                </a>
              </div>

              {/* RDV */}
              <div className="bg-[#F7F4EE] rounded-xl p-4">
                <div className="text-xs text-[#8A9BB0] mb-1 font-medium">{L ? 'MARCAÇÃO' : 'RDV'}</div>
                <div className="font-semibold text-[#0D1B2E]">
                  {new Date(selected.dateRdv).toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} {L ? 'às' : 'à'} {selected.heureRdv}
                </div>
              </div>

              {/* GPS live */}
              {['en_route', 'sur_place'].includes(selected.statut) && selected.gpsLat && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="text-xs text-amber-700 font-bold mb-1">{L ? '📍 POSIÇÃO EM TEMPO REAL' : '📍 POSITION EN TEMPS RÉEL'}</div>
                  <div className="text-sm text-amber-800">Lat: {selected.gpsLat.toFixed(4)}, Lng: {selected.gpsLng?.toFixed(4)}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-green-700 font-medium">{L ? 'Sinal GPS ativo' : 'Signal GPS actif'}</span>
                  </div>
                </div>
              )}

              {/* Progression */}
              {selected.statut !== 'annule' && (
                <div>
                  <div className="flex justify-between text-sm text-[#4A5E78] mb-2">
                    <span className="font-medium">{L ? 'Progresso' : 'Progression'}</span>
                    <span className="font-bold">{selected.progression}%</span>
                  </div>
                  <div className="h-3 bg-[#F7F4EE] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${selected.progression}%`, backgroundColor: selected.progression === 100 ? '#10b981' : '#8b5cf6' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-[#8A9BB0] mt-1">
                    <span>{L ? 'Início' : 'Démarrage'}</span>
                    <span>{L ? 'Em curso' : 'En cours'}</span>
                    <span>{L ? 'Concluído' : 'Terminé'}</span>
                  </div>
                </div>
              )}

              {/* Preuve */}
              {selected.preuve && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-xs text-green-700 font-bold mb-2">{L ? '📸 PROVA DE INTERVENÇÃO' : '📸 PREUVE D\'INTERVENTION'}</div>
                  <div className="flex gap-4 text-sm text-green-800">
                    <span>📷 {selected.preuve.avantPhotos} {L ? (selected.preuve.avantPhotos > 1 ? 'fotos antes' : 'foto antes') : `photo${selected.preuve.avantPhotos > 1 ? 's' : ''} avant`}</span>
                    <span>📷 {selected.preuve.apresPhotos} {L ? (selected.preuve.apresPhotos > 1 ? 'fotos depois' : 'foto depois') : `photo${selected.preuve.apresPhotos > 1 ? 's' : ''} après`}</span>
                    {selected.preuve.signee && <span>{L ? '✍️ Assinado' : '✍️ Signé'}</span>}
                  </div>
                </div>
              )}

              {/* Note */}
              {selected.note && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="text-xs text-amber-700 font-bold mb-1">{L ? 'A SUA AVALIAÇÃO' : 'VOTRE AVIS'}</div>
                  <div className="text-xl">{'⭐'.repeat(selected.note)}</div>
                  {selected.commentaire && <p className="text-sm text-[#4A5E78] mt-1 italic">&ldquo;{selected.commentaire}&rdquo;</p>}
                </div>
              )}

              {/* CTA noter */}
              {selected.statut === 'termine' && !selected.note && (
                <button
                  onClick={() => { setNoteModal(selected); setSelected(null); setNoteVal(5); setNoteComment('') }}
                  className="w-full bg-[#0D1B2E] hover:bg-[#152338] text-white font-bold py-3 rounded-xl transition"
                >
                  {L ? '⭐ Avaliar esta intervenção' : '⭐ Donner mon avis sur cette intervention'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal notation */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setNoteModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-[#E4DDD0]">
              <h3 className="text-lg font-bold text-[#0D1B2E]">{L ? '⭐ Avaliar a intervenção' : '⭐ Évaluer l\'intervention'}</h3>
              <p className="text-sm text-[#8A9BB0] mt-1">{noteModal.artisan.split('—')[0].trim()} — {noteModal.type}</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Stars */}
              <div>
                <div className="text-sm font-medium text-[#4A5E78] mb-2">{L ? 'A sua nota' : 'Votre note'}</div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setNoteVal(n)}
                      className={`text-3xl transition-transform hover:scale-110 ${n <= noteVal ? 'opacity-100' : 'opacity-30'}`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
                <div className="text-sm text-[#8A9BB0] mt-1">
                  {noteVal === 1 ? (L ? 'Muito insatisfeito' : 'Très insatisfait') : noteVal === 2 ? (L ? 'Insatisfeito' : 'Insatisfait') : noteVal === 3 ? (L ? 'Razoável' : 'Correct') : noteVal === 4 ? (L ? 'Satisfeito' : 'Satisfait') : (L ? 'Muito satisfeito' : 'Très satisfait')}
                </div>
              </div>
              {/* Commentaire */}
              <div>
                <label className="text-sm font-medium text-[#4A5E78] block mb-1">{L ? 'Comentário (opcional)' : 'Commentaire (optionnel)'}</label>
                <textarea
                  value={noteComment}
                  onChange={e => setNoteComment(e.target.value)}
                  rows={3}
                  placeholder={L ? 'Descreva a sua experiência...' : 'Décrivez votre expérience...'}
                  className="w-full border border-[#E4DDD0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C] resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setNoteModal(null)} className="flex-1 border border-[#E4DDD0] text-[#4A5E78] py-2.5 rounded-xl text-sm font-medium hover:bg-[#F7F4EE] transition">
                  {L ? 'Cancelar' : 'Annuler'}
                </button>
                <button onClick={submitNote} className="flex-1 bg-[#0D1B2E] hover:bg-[#152338] text-white py-2.5 rounded-xl text-sm font-bold transition">
                  {L ? 'Enviar avaliação' : 'Envoyer l\'avis'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
