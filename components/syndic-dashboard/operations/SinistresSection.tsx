'use client'

import { useState, useEffect } from 'react'
import type { Artisan } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'

export default function SinistresSection({ user, userRole, artisans = [] }: { user: any; userRole: string; artisans?: Artisan[] }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const uid = user?.id || 'demo'

  // ── Types ──
  type SinistreStatut = 'déclaré' | 'artisan_assigné' | 'en_expertise' | 'résolution' | 'indemnisé' | 'clôturé' | 'refusé'
  type SinistreEvent = { id: string; date: string; auteur: string; type: 'statut' | 'note' | 'mission' | 'assurance'; contenu: string }
  type Sinistre = {
    id: string; titre: string; immeuble: string; lot: string; type: string
    dateDeclaration: string; declarantNom: string; declarantRole: 'coproprio' | 'locataire' | 'technicien' | 'syndic'
    assureur: string; numDossier: string; emailAssureur: string
    artisanAssigne: string; missionId: string
    montantEstime: number; montantIndemnise: number
    statut: SinistreStatut; urgence: 'haute' | 'normale'
    notes: string; events: SinistreEvent[]
  }

  const PIPELINE: { key: SinistreStatut; label: string; icon: string; color: string }[] = [
    { key: 'déclaré',        label: t('syndicDash.sinistres.declared'),          icon: '🚨', color: 'bg-red-500' },
    { key: 'artisan_assigné',label: t('syndicDash.sinistres.artisanAssigned'),  icon: '🔨', color: 'bg-[#C9A84C]' },
    { key: 'en_expertise',   label: t('syndicDash.sinistres.inExpertise'),     icon: '🔍', color: 'bg-blue-500' },
    { key: 'résolution',     label: t('syndicDash.sinistres.resolution'),        icon: '🔧', color: 'bg-[#F7F4EE]0' },
    { key: 'indemnisé',      label: t('syndicDash.sinistres.indemnised'),         icon: '💰', color: 'bg-teal-500' },
    { key: 'clôturé',        label: t('syndicDash.sinistres.closed'),           icon: '✅', color: 'bg-green-500' },
  ]
  const STATUS_COLORS: Record<string, string> = {
    déclaré: 'bg-red-100 text-red-700', artisan_assigné: 'bg-orange-100 text-orange-700',
    en_expertise: 'bg-blue-100 text-blue-700', résolution: 'bg-[#F7F4EE] text-[#C9A84C]',
    indemnisé: 'bg-teal-100 text-teal-700', clôturé: 'bg-green-100 text-green-700', refusé: 'bg-[#F7F4EE] text-gray-600'
  }
  const TYPES = ['Dégât des eaux', 'Incendie', 'Vol / Cambriolage', 'Vandalisme', 'Bris de glace', 'Catastrophe naturelle', 'Effondrement', 'Infiltration', 'Bris de canalisations', 'Autre']

  // Artisans réels du cabinet (passés en props)
  const artisanNoms = artisans.map(a => a.nom).filter(Boolean)

  const emptyForm = { titre: '', immeuble: '', lot: '', type: 'Dégât des eaux', dateDeclaration: new Date().toISOString().split('T')[0], declarantNom: '', declarantRole: 'coproprio' as 'coproprio' | 'locataire' | 'technicien' | 'syndic', assureur: '', numDossier: '', emailAssureur: '', artisanAssigne: '', missionId: '', montantEstime: '', montantIndemnise: '', notes: '', urgence: 'normale' as 'haute' | 'normale' }

  const [sinistres, setSinistres] = useState<Sinistre[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_sinistres_v2_${uid}`) || '[]') } catch { return [] } })
  const [showModal, setShowModal] = useState(false)
  const [selectedSinistre, setSelectedSinistre] = useState<Sinistre | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [noteInput, setNoteInput] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('')
  const [showEmailTemplate, setShowEmailTemplate] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)

  const save = (u: Sinistre[]) => { setSinistres(u); localStorage.setItem(`fixit_sinistres_v2_${uid}`, JSON.stringify(u)) }

  const handleAdd = () => {
    if (!form.titre.trim()) return
    const now = new Date().toISOString()
    const s: Sinistre = {
      id: Date.now().toString(), ...form,
      montantEstime: parseFloat(form.montantEstime) || 0,
      montantIndemnise: parseFloat(form.montantIndemnise) || 0,
      statut: 'déclaré',
      events: [{ id: '1', date: now, auteur: 'Système', type: 'statut', contenu: `Sinistre déclaré par ${form.declarantNom || 'le gestionnaire'} — ${form.type}` }]
    }
    save([s, ...sinistres])
    setShowModal(false)
    setForm(emptyForm)
  }

  const advanceStatut = (id: string, statut: SinistreStatut, extra?: Partial<Sinistre>) => {
    const now = new Date().toISOString()
    const label = PIPELINE.find(p => p.key === statut)?.label || statut
    const updated = sinistres.map(s => s.id === id ? {
      ...s, ...extra, statut,
      events: [...(s.events || []), { id: Date.now().toString(), date: now, auteur: 'Gestionnaire', type: 'statut' as const, contenu: `Statut → ${label}` }]
    } : s)
    save(updated)
    if (selectedSinistre?.id === id) setSelectedSinistre(updated.find(s => s.id === id) || null)
  }

  const addNote = (id: string) => {
    if (!noteInput.trim()) return
    const now = new Date().toISOString()
    const updated = sinistres.map(s => s.id === id ? {
      ...s, events: [...(s.events || []), { id: Date.now().toString(), date: now, auteur: 'Gestionnaire', type: 'note' as const, contenu: noteInput.trim() }]
    } : s)
    save(updated)
    if (selectedSinistre?.id === id) setSelectedSinistre(updated.find(s => s.id === id) || null)
    setNoteInput('')
  }

  const assignArtisan = (id: string, artisan: string) => {
    const now = new Date().toISOString()
    const updated = sinistres.map(s => s.id === id ? {
      ...s, artisanAssigne: artisan, statut: 'artisan_assigné' as SinistreStatut,
      events: [...(s.events || []),
        { id: Date.now().toString(), date: now, auteur: 'Gestionnaire', type: 'mission' as const, contenu: `Artisan assigné : ${artisan}` },
        { id: (Date.now() + 1).toString(), date: now, auteur: 'Système', type: 'statut' as const, contenu: 'Statut → Artisan assigné' }
      ]
    } : s)
    save(updated)
    if (selectedSinistre?.id === id) setSelectedSinistre(updated.find(s => s.id === id) || null)
  }

  const generateEmailAssureur = (s: Sinistre) => {
    return `Objet : Déclaration de sinistre — ${s.titre} — ${s.immeuble}

Madame, Monsieur,

Nous vous contactons pour déclarer un sinistre survenu dans la copropriété que nous gérons.

📋 INFORMATIONS DU SINISTRE
• Type : ${s.type}
• Immeuble : ${s.immeuble}${s.lot ? ` — Lot/Appartement : ${s.lot}` : ''}
• Date de déclaration : ${new Date(s.dateDeclaration).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}
• Déclarant : ${s.declarantNom || 'Non précisé'} (${s.declarantRole})
• Description : ${s.titre}
${s.montantEstime > 0 ? `• Montant estimé des dégâts : ${s.montantEstime.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €` : ''}
${s.artisanAssigne ? `• Artisan intervenant : ${s.artisanAssigne}` : ''}
${s.numDossier ? `• N° dossier existant : ${s.numDossier}` : ''}

Nous restons à votre disposition pour tout complément d'information.

Cordialement,
Le Gestionnaire — Cabinet de Syndic`
  }

  const filteredSinistres = filterStatut ? sinistres.filter(s => s.statut === filterStatut) : sinistres
  const actifs = sinistres.filter(s => s.statut !== 'clôturé' && s.statut !== 'refusé')
  const urgents = sinistres.filter(s => s.urgence === 'haute' && s.statut !== 'clôturé')
  const totalEstime = sinistres.reduce((t, s) => t + s.montantEstime, 0)
  const totalIndemnise = sinistres.reduce((t, s) => t + s.montantIndemnise, 0)

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="bg-white px-6 lg:px-10 py-5 border-b-2 border-orange-400 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">🚨 {t('syndicDash.sinistres.title')}</h1>
          <p className="text-sm text-gray-500">{t('syndicDash.sinistres.subtitle')}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-[#C9A84C] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#C9A84C] shadow-sm">
          + {t('syndicDash.sinistres.newSinistre')}
        </button>
      </div>

      <div className="p-6 lg:p-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-red-400">
            <div className="text-sm text-gray-500">{t('syndicDash.sinistres.activeSinistres')}</div>
            <div className="text-3xl font-bold text-red-600">{actifs.length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-amber-400">
            <div className="text-sm text-gray-500">{t('syndicDash.sinistres.urgences')}</div>
            <div className="text-3xl font-bold text-amber-600">{urgents.length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-400">
            <div className="text-sm text-gray-500">{t('syndicDash.sinistres.estimatedAmount')}</div>
            <div className="text-2xl font-bold text-blue-600">{totalEstime.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400">
            <div className="text-sm text-gray-500">{t('syndicDash.sinistres.indemnisations')}</div>
            <div className="text-2xl font-bold text-green-600">{totalIndemnise.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>
          </div>
        </div>

        {/* Pipeline kanban view */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 overflow-x-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{t('syndicDash.sinistres.pipelineView')}</p>
          <div className="flex gap-2 min-w-max">
            {PIPELINE.map(stage => {
              const count = sinistres.filter(s => s.statut === stage.key).length
              return (
                <div
                  key={stage.key}
                  onClick={() => setFilterStatut(filterStatut === stage.key ? '' : stage.key)}
                  className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl cursor-pointer transition-all min-w-[100px] ${filterStatut === stage.key ? stage.color + ' text-white shadow-md' : 'bg-[#F7F4EE] hover:bg-[#F7F4EE] text-gray-600'}`}
                >
                  <span className="text-xl">{stage.icon}</span>
                  <span className="text-xs font-bold text-center leading-tight">{stage.label}</span>
                  <span className={`text-lg font-black ${filterStatut === stage.key ? 'text-white' : 'text-gray-800'}`}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Liste sinistres */}
        {filteredSinistres.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">🛡️</div>
            <h3 className="text-xl font-bold mb-2">{filterStatut ? t('syndicDash.sinistres.noSinistreFilter') : t('syndicDash.sinistres.noSinistre')}</h3>
            <p className="text-gray-500 mb-6">
              {filterStatut ? t('syndicDash.sinistres.noSinistreFilterDesc') : t('syndicDash.sinistres.noSinistreDesc')}
            </p>
            <button onClick={() => setShowModal(true)} className="bg-[#C9A84C] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#C9A84C]">+ {t('syndicDash.sinistres.declareSinistre')}</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSinistres.map(s => {
              const pipelineIdx = PIPELINE.findIndex(p => p.key === s.statut)
              return (
                <div
                  key={s.id}
                  className={`bg-white rounded-2xl shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-all ${s.urgence === 'haute' ? 'border-red-500' : 'border-orange-300'}`}
                  onClick={() => setSelectedSinistre(s)}
                >
                  <div className="p-4 flex flex-col md:flex-row gap-3 items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {s.urgence === 'haute' && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">🔴 {t('syndicDash.sinistres.urgent')}</span>}
                        <h3 className="font-bold text-[#0D1B2E]">{s.titre}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[s.statut] || 'bg-[#F7F4EE] text-gray-600'}`}>{s.statut.replace('_', ' ')}</span>
                        <span className="bg-[#F7F4EE] text-gray-500 text-xs px-2 py-0.5 rounded-full">{s.type}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        {s.immeuble && <span>🏢 {s.immeuble}{s.lot ? ` · Lot ${s.lot}` : ''}</span>}
                        <span>📅 {new Date(s.dateDeclaration).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>
                        {s.artisanAssigne && <span>🔨 {s.artisanAssigne}</span>}
                        {s.assureur && <span>🛡️ {s.assureur}{s.numDossier ? ` · N° ${s.numDossier}` : ''}</span>}
                        {s.montantEstime > 0 && <span>💰 {s.montantEstime.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</span>}
                      </div>
                    </div>
                    {/* Mini-pipeline */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {PIPELINE.slice(0, 5).map((stage, i) => (
                        <div key={stage.key} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${i <= pipelineIdx ? stage.color + ' text-white' : 'bg-[#F7F4EE] text-gray-500'}`}>
                          {i < pipelineIdx ? '✓' : stage.icon}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal Détails Sinistre ── */}
      {selectedSinistre && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className={`px-5 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-3`}>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  {selectedSinistre.urgence === 'haute' && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">🔴 {t('syndicDash.sinistres.urgent')}</span>}
                  <h2 className="text-lg font-bold text-[#0D1B2E]">{selectedSinistre.titre}</h2>
                </div>
                <p className="text-sm text-gray-500">{selectedSinistre.type} · {selectedSinistre.immeuble}</p>
              </div>
              <button onClick={() => setSelectedSinistre(null)} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Pipeline steps */}
              <div className="flex items-center gap-1">
                {PIPELINE.map((stage, i) => {
                  const idx = PIPELINE.findIndex(p => p.key === selectedSinistre.statut)
                  return (
                    <div key={stage.key} className="flex items-center flex-1">
                      <button
                        onClick={() => { if (i > idx) advanceStatut(selectedSinistre.id, stage.key) }}
                        className={`flex flex-col items-center flex-1 transition-all ${i <= idx ? 'opacity-100' : 'opacity-40 hover:opacity-70 cursor-pointer'}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${i < idx ? 'bg-green-500 text-white' : i === idx ? stage.color + ' text-white shadow-lg' : 'bg-[#F7F4EE] text-gray-500'}`}>
                          {i < idx ? '✓' : stage.icon}
                        </div>
                        <span className="text-[9px] mt-1 text-center font-semibold text-gray-600 leading-tight">{stage.label}</span>
                      </button>
                      {i < PIPELINE.length - 1 && <div className={`h-0.5 w-2 ${i < idx ? 'bg-green-400' : 'bg-gray-200'}`} />}
                    </div>
                  )
                })}
              </div>

              {/* Infos */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-[#F7F4EE] rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{t('syndicDash.sinistres.declarant')}</p>
                  <p className="font-semibold text-gray-800">{selectedSinistre.declarantNom || '—'}</p>
                  <p className="text-xs text-gray-500 capitalize">{selectedSinistre.declarantRole}</p>
                </div>
                <div className="bg-[#F7F4EE] rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{t('syndicDash.sinistres.insurer')}</p>
                  <p className="font-semibold text-gray-800">{selectedSinistre.assureur || '—'}</p>
                  {selectedSinistre.numDossier && <p className="text-xs text-gray-500">N° {selectedSinistre.numDossier}</p>}
                </div>
                <div className="bg-[#F7F4EE] rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{t('syndicDash.sinistres.estimatedAmount')}</p>
                  <p className="font-bold text-blue-600 text-lg">{selectedSinistre.montantEstime > 0 ? `${selectedSinistre.montantEstime.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €` : '—'}</p>
                </div>
                <div className="bg-[#F7F4EE] rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{t('syndicDash.sinistres.indemnisations')}</p>
                  <p className="font-bold text-green-600 text-lg">{selectedSinistre.montantIndemnise > 0 ? `${selectedSinistre.montantIndemnise.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €` : '—'}</p>
                </div>
              </div>

              {/* Assigner artisan */}
              {selectedSinistre.statut === 'déclaré' && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-orange-800 mb-2">🔨 {t('syndicDash.sinistres.assignArtisan')}</p>
                  <div className="flex gap-2">
                    <select
                      id="artisan-select"
                      className="flex-1 border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none"
                    >
                      <option value="">{t('syndicDash.sinistres.chooseArtisan')}</option>
                      {artisanNoms.length === 0
                        ? <option disabled>{t('syndicDash.sinistres.noArtisan')}</option>
                        : artisanNoms.map(a => <option key={a} value={a}>{a}</option>)
                      }
                    </select>
                    <button
                      onClick={() => {
                        const sel = (document.getElementById('artisan-select') as HTMLSelectElement)?.value
                        if (sel) assignArtisan(selectedSinistre.id, sel)
                      }}
                      className="bg-[#C9A84C] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#C9A84C]"
                    >
                      {t('syndicDash.sinistres.assign')}
                    </button>
                  </div>
                </div>
              )}

              {selectedSinistre.artisanAssigne && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-xl">🔨</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800">{t('syndicDash.sinistres.assignedArtisan')}</p>
                    <p className="text-sm font-semibold text-amber-900">{selectedSinistre.artisanAssigne}</p>
                  </div>
                </div>
              )}

              {/* Email assureur */}
              <div>
                <button
                  onClick={() => setShowEmailTemplate(!showEmailTemplate)}
                  className="w-full bg-blue-50 border border-blue-200 text-blue-700 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-100 transition"
                >
                  {showEmailTemplate ? `▲ ${t('syndicDash.sinistres.hideEmail')}` : `📧 ${t('syndicDash.sinistres.generateEmail')}`}
                </button>
                {showEmailTemplate && (
                  <div className="mt-2 bg-[#F7F4EE] border border-gray-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-gray-600">{t('syndicDash.sinistres.emailPrefilled')}</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generateEmailAssureur(selectedSinistre)).then(() => { setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000) })
                        }}
                        className={`text-xs font-bold px-3 py-1 rounded-lg transition ${emailCopied ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                      >
                        {emailCopied ? `✅ ${t('syndicDash.sinistres.copied')}` : t('syndicDash.sinistres.copy')}
                      </button>
                    </div>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                      {generateEmailAssureur(selectedSinistre)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Timeline événements */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📅 {t('syndicDash.sinistres.history')}</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {(selectedSinistre.events || []).map((ev, i) => (
                    <div key={ev.id} className="flex gap-3 text-sm">
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${ev.type === 'statut' ? 'bg-orange-100 text-[#C9A84C]' : ev.type === 'mission' ? 'bg-blue-100 text-blue-600' : 'bg-[#F7F4EE] text-gray-500'}`}>
                          {ev.type === 'statut' ? '→' : ev.type === 'mission' ? '🔨' : '💬'}
                        </div>
                        {i < (selectedSinistre.events?.length || 0) - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                      </div>
                      <div className="pb-2 flex-1">
                        <p className="text-gray-700 font-medium leading-snug">{ev.contenu}</p>
                        <p className="text-xs text-gray-500">{ev.auteur} · {new Date(ev.date).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ajouter note */}
              <div className="flex gap-2">
                <input
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addNote(selectedSinistre.id)}
                  placeholder={t('syndicDash.sinistres.addNotePlaceholder')}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button onClick={() => addNote(selectedSinistre.id)} className="bg-[#C9A84C] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#C9A84C]">
                  ✓
                </button>
              </div>
            </div>

            {/* Footer actions */}
            <div className="border-t border-gray-100 px-5 py-4 flex flex-wrap gap-2">
              {selectedSinistre.statut !== 'clôturé' && selectedSinistre.statut !== 'refusé' && (
                <button
                  onClick={() => advanceStatut(selectedSinistre.id, 'refusé')}
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50"
                >
                  ❌ {t('syndicDash.sinistres.markRefused')}
                </button>
              )}
              {selectedSinistre.statut !== 'clôturé' && (
                <button
                  onClick={() => advanceStatut(selectedSinistre.id, 'clôturé')}
                  className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600"
                >
                  ✅ {t('syndicDash.sinistres.closeSinistre')}
                </button>
              )}
              <button onClick={() => setSelectedSinistre(null)} className="ml-auto px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-[#F7F4EE]">
                {t('syndicDash.sinistres.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Nouveau Sinistre ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">🚨 {t('syndicDash.sinistres.declareTitle')}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.sinistres.titleLabel')}</label><input value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} placeholder={t('syndicDash.sinistres.titlePlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.sinistres.typeLabel')}</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none bg-white">{TYPES.map(tp => <option key={tp}>{tp}</option>)}</select></div>
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.sinistres.urgencyLabel')}</label><select value={form.urgence} onChange={e => setForm({...form, urgence: e.target.value as 'haute' | 'normale'})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none bg-white"><option value="normale">{t('syndicDash.sinistres.urgencyNormal')}</option><option value="haute">🔴 {t('syndicDash.sinistres.urgencyHigh')}</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.sinistres.buildingLabel')}</label><input value={form.immeuble} onChange={e => setForm({...form, immeuble: e.target.value})} placeholder={t('syndicDash.sinistres.buildingPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.sinistres.lotLabel')}</label><input value={form.lot} onChange={e => setForm({...form, lot: e.target.value})} placeholder={t('syndicDash.sinistres.lotPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.sinistres.declarantName')}</label><input value={form.declarantNom} onChange={e => setForm({...form, declarantNom: e.target.value})} placeholder="Marie Dupont" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.sinistres.declarantRole')}</label><select value={form.declarantRole} onChange={e => setForm({...form, declarantRole: e.target.value as any})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none bg-white"><option value="coproprio">{t('syndicDash.sinistres.roleCopro')}</option><option value="locataire">{t('syndicDash.sinistres.roleTenant')}</option><option value="technicien">{t('syndicDash.sinistres.roleTech')}</option><option value="syndic">{t('syndicDash.sinistres.roleSyndic')}</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.sinistres.insurerLabel')}</label><input value={form.assureur} onChange={e => setForm({...form, assureur: e.target.value})} placeholder={t('syndicDash.sinistres.insurerPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.sinistres.dossierNum')}</label><input value={form.numDossier} onChange={e => setForm({...form, numDossier: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.sinistres.insurerEmail')}</label><input type="email" value={form.emailAssureur} onChange={e => setForm({...form, emailAssureur: e.target.value})} placeholder={t('syndicDash.sinistres.insurerEmailPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.sinistres.estimatedAmountLabel')}</label><input type="number" value={form.montantEstime} onChange={e => setForm({...form, montantEstime: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.sinistres.declarationDate')}</label><input type="date" value={form.dateDeclaration} onChange={e => setForm({...form, dateDeclaration: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.sinistres.notesLabel')}</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none resize-none" /></div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">{t('syndicDash.sinistres.cancel')}</button>
              <button onClick={handleAdd} disabled={!form.titre.trim()} className="flex-1 py-2.5 bg-[#C9A84C] text-white rounded-xl font-semibold hover:bg-[#C9A84C] disabled:opacity-40">🚨 {t('syndicDash.sinistres.declare')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
