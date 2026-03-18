'use client'

import { useState, useEffect, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type NiveauUrgence = 'critique' | 'urgente' | 'importante'
type StatutUrgence = 'signale' | 'artisan_contacte' | 'artisan_en_route' | 'en_cours' | 'resolu'

interface UrgenceEvent {
  date: string
  action: string
  par?: string
}

interface Urgence {
  id: string
  immeuble: string
  localisation: string        // ex: "Couloir 3e étage, lot 12"
  typeUrgence: string
  description: string
  signalePar: string
  telephone: string
  niveau: NiveauUrgence
  statut: StatutUrgence
  artisanId?: string
  artisanNom?: string
  artisanTelephone?: string
  timeline: UrgenceEvent[]
  createdAt: string
  updatedAt: string
  resolvedAt?: string
}

interface Artisan {
  id: string
  nom: string
  prenom?: string
  metier: string
  telephone: string
  statut: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPES_URGENCE = [
  { key: 'inondation',     label: 'Inondation / Dégât des eaux',    icon: '💧', metiers: ['Plombier', 'plombier', 'plomberie'] },
  { key: 'electricite',   label: 'Panne électrique / Court-circuit', icon: '⚡', metiers: ['Électricien', 'electricien', 'électricité'] },
  { key: 'ascenseur',     label: 'Panne ascenseur',                  icon: '🛗', metiers: ['Ascensoriste', 'ascenseur', 'Maintenance'] },
  { key: 'incendie',      label: 'Incendie / Fumée',                 icon: '🔥', metiers: ['Pompier', 'Sécurité incendie'] },
  { key: 'gaz',           label: 'Fuite de gaz',                     icon: '💨', metiers: ['Plombier', 'plombier', 'Chauffagiste'] },
  { key: 'serrurerie',    label: 'Porte bloquée / Serrurerie',       icon: '🔐', metiers: ['Serrurier', 'serrurier'] },
  { key: 'chaudiere',     label: 'Panne chaudière / Chauffage',      icon: '🌡️', metiers: ['Chauffagiste', 'chauffage', 'Plombier'] },
  { key: 'toiture',       label: 'Toiture / Infiltration',           icon: '🏚️', metiers: ['Couvreur', 'couvreur', 'Toiture'] },
  { key: 'structure',     label: 'Problème structurel / Fissure',    icon: '🏗️', metiers: ['Maçon', 'maçon', 'Entreprise générale'] },
  { key: 'autre',         label: 'Autre urgence',                    icon: '🚨', metiers: [] },
]

const NIVEAUX: Record<NiveauUrgence, { label: string; badge: string; dot: string; bg: string }> = {
  critique:   { label: 'CRITIQUE',   badge: 'bg-red-100 text-red-700 border-red-300',       dot: 'bg-red-500',    bg: 'bg-red-50 border-red-200'    },
  urgente:    { label: 'URGENTE',    badge: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-orange-500', bg: 'bg-orange-50 border-orange-200' },
  importante: { label: 'IMPORTANTE', badge: 'bg-yellow-100 text-yellow-700 border-yellow-300', dot: 'bg-yellow-400', bg: 'bg-yellow-50 border-yellow-200' },
}

const STATUTS: Record<StatutUrgence, { label: string; icon: string; color: string }> = {
  signale:           { label: 'Signalé',              icon: '📣', color: 'text-red-600'    },
  artisan_contacte:  { label: 'Artisan contacté',     icon: '📞', color: 'text-orange-600' },
  artisan_en_route:  { label: 'Artisan en route',     icon: '🚗', color: 'text-blue-600'   },
  en_cours:          { label: 'Intervention en cours', icon: '🔧', color: 'text-purple-600' },
  resolu:            { label: 'Résolu',                icon: '✅', color: 'text-green-600'  },
}

const PIPELINE: StatutUrgence[] = ['signale', 'artisan_contacte', 'artisan_en_route', 'en_cours', 'resolu']

const formatTime = (s: string) => {
  try {
    const d = new Date(s)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' ' +
           d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch { return s }
}

const dureeDepuis = (s: string) => {
  const diff = Date.now() - new Date(s).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 24) return `${Math.floor(h / 24)}j`
  if (h > 0)  return `${h}h${m > 0 ? m + 'm' : ''}`
  return `${m}min`
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function UrgencesSection({
  user,
  userRole,
  artisans = [],
}: {
  user: { id: string }
  userRole: string
  artisans?: Artisan[]
}) {
  const STORAGE_KEY = `fixit_urgences_${user.id}`

  const [urgences, setUrgences]         = useState<Urgence[]>([])
  const [showModal, setShowModal]        = useState(false)
  const [selectedUrgence, setSelected]  = useState<Urgence | null>(null)
  const [filterStatut, setFilterStatut] = useState<string>('actif')

  // Formulaire
  const [form, setForm] = useState<Partial<Urgence>>({
    niveau: 'urgente',
    typeUrgence: '',
  })
  const [searchArtisan, setSearchArtisan] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Persistance ──────────────────────────────────────────────────────────────

  useEffect(() => {
    try { setUrgences(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch {}
  }, [])

  const save = (updated: Urgence[]) => {
    setUrgences(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  // ── Artisans filtrés par type d'urgence ─────────────────────────────────────

  const artisansSuggeres = useMemo(() => {
    const typeConfig = TYPES_URGENCE.find(t => t.key === form.typeUrgence)
    if (!typeConfig || !typeConfig.metiers.length) return artisans.filter(a => a.statut === 'actif')

    const sorted = [...artisans].sort((a, b) => {
      const aMatch = typeConfig.metiers.some(m => a.metier?.toLowerCase().includes(m.toLowerCase()))
      const bMatch = typeConfig.metiers.some(m => b.metier?.toLowerCase().includes(m.toLowerCase()))
      if (aMatch && !bMatch) return -1
      if (!aMatch && bMatch) return 1
      return 0
    })
    return sorted.filter(a => a.statut === 'actif')
  }, [artisans, form.typeUrgence])

  const artisansFiltres = useMemo(() => {
    if (!searchArtisan) return artisansSuggeres
    return artisansSuggeres.filter(a =>
      `${a.nom} ${a.prenom || ''} ${a.metier}`.toLowerCase().includes(searchArtisan.toLowerCase())
    )
  }, [artisansSuggeres, searchArtisan])

  // ── Créer urgence ────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.immeuble || !form.typeUrgence || !form.description) return
    setSaving(true)
    const now = new Date().toISOString()
    const typeLabel = TYPES_URGENCE.find(t => t.key === form.typeUrgence)?.label || form.typeUrgence || ''

    const timeline: UrgenceEvent[] = [
      { date: now, action: `Urgence signalée — ${typeLabel}`, par: form.signalePar || 'Syndic' }
    ]

    const artisan = artisans.find(a => a.id === form.artisanId)
    if (artisan) {
      timeline.push({ date: now, action: `Artisan contacté — ${artisan.nom}${artisan.prenom ? ' ' + artisan.prenom : ''}`, par: 'Système VITFIX' })
    }

    const newUrgence: Urgence = {
      id: crypto.randomUUID(),
      immeuble: form.immeuble!,
      localisation: form.localisation || '',
      typeUrgence: form.typeUrgence!,
      description: form.description!,
      signalePar: form.signalePar || '',
      telephone: form.telephone || '',
      niveau: form.niveau || 'urgente',
      statut: artisan ? 'artisan_contacte' : 'signale',
      artisanId: artisan?.id,
      artisanNom: artisan ? `${artisan.nom}${artisan.prenom ? ' ' + artisan.prenom : ''}` : undefined,
      artisanTelephone: artisan?.telephone,
      timeline,
      createdAt: now,
      updatedAt: now,
    }

    save([newUrgence, ...urgences])
    setShowModal(false)
    setForm({ niveau: 'urgente', typeUrgence: '' })
    setSearchArtisan('')
    setSelected(newUrgence)
    setSaving(false)
  }

  // ── Avancer le statut ────────────────────────────────────────────────────────

  const avancerStatut = (urgence: Urgence) => {
    const idx = PIPELINE.indexOf(urgence.statut)
    if (idx >= PIPELINE.length - 1) return
    const nextStatut = PIPELINE[idx + 1]
    const now = new Date().toISOString()
    const updated: Urgence = {
      ...urgence,
      statut: nextStatut,
      updatedAt: now,
      resolvedAt: nextStatut === 'resolu' ? now : undefined,
      timeline: [
        ...urgence.timeline,
        { date: now, action: STATUTS[nextStatut].label, par: 'Syndic' }
      ]
    }
    const newList = urgences.map(u => u.id === urgence.id ? updated : u)
    save(newList)
    if (selectedUrgence?.id === urgence.id) setSelected(updated)
  }

  const assignerArtisan = (urgence: Urgence, artisan: Artisan) => {
    const now = new Date().toISOString()
    const nom = `${artisan.nom}${artisan.prenom ? ' ' + artisan.prenom : ''}`
    const updated: Urgence = {
      ...urgence,
      artisanId: artisan.id,
      artisanNom: nom,
      artisanTelephone: artisan.telephone,
      statut: 'artisan_contacte',
      updatedAt: now,
      timeline: [...urgence.timeline, { date: now, action: `Artisan assigné — ${nom}`, par: 'Syndic' }]
    }
    const newList = urgences.map(u => u.id === urgence.id ? updated : u)
    save(newList)
    if (selectedUrgence?.id === urgence.id) setSelected(updated)
  }

  // ── Filtres ──────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => urgences.filter(u => {
    if (filterStatut === 'actif') return u.statut !== 'resolu'
    if (filterStatut === 'resolu') return u.statut === 'resolu'
    return true
  }), [urgences, filterStatut])

  const actives = urgences.filter(u => u.statut !== 'resolu')
  const critiques = urgences.filter(u => u.statut !== 'resolu' && u.niveau === 'critique')

  // ─── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🚨 Urgences Techniques</h1>
          <p className="text-sm text-gray-500 mt-0.5">Dispatch immédiat vers l&apos;artisan VITFIX disponible</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-sm shadow-red-200 animate-pulse"
        >
          🚨 Déclarer une urgence
        </button>
      </div>

      {/* Alerte critique */}
      {critiques.length > 0 && (
        <div className="mb-4 bg-red-600 text-white rounded-xl p-4 flex items-center gap-3 shadow-lg">
          <span className="text-2xl animate-bounce">🔴</span>
          <div>
            <p className="font-bold">{critiques.length} urgence{critiques.length > 1 ? 's' : ''} CRITIQUE{critiques.length > 1 ? 'S' : ''} en cours</p>
            <p className="text-red-100 text-sm">{critiques.map(u => u.immeuble).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Urgences actives',  value: actives.length,                                     color: actives.length > 0 ? 'text-red-600' : 'text-gray-900' },
          { label: 'Critiques',         value: critiques.length,                                    color: critiques.length > 0 ? 'text-red-700 font-black' : 'text-gray-900' },
          { label: 'Artisan assigné',   value: actives.filter(u => u.artisanId).length,             color: 'text-green-600' },
          { label: 'Résolues (total)',  value: urgences.filter(u => u.statut === 'resolu').length,  color: 'text-gray-900' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'actif',  label: `En cours (${actives.length})` },
          { key: 'resolu', label: `Résolues` },
          { key: 'all',    label: 'Toutes' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatut(f.key)}
            className={`text-xs px-4 py-1.5 rounded-full font-medium transition-colors ${filterStatut === f.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste urgences */}
      {filtered.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucune urgence en cours</h3>
          <p className="text-gray-400 text-sm">Tout est calme. Utilisez le bouton rouge pour déclarer une urgence.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(urgence => {
            const typeConfig   = TYPES_URGENCE.find(t => t.key === urgence.typeUrgence)
            const niveauConfig = NIVEAUX[urgence.niveau]
            const statutConfig = STATUTS[urgence.statut]
            const statutIdx    = PIPELINE.indexOf(urgence.statut)
            const pct          = Math.round((statutIdx / (PIPELINE.length - 1)) * 100)

            return (
              <div
                key={urgence.id}
                className={`border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all ${niveauConfig.bg} ${selectedUrgence?.id === urgence.id ? 'ring-2 ring-blue-400' : ''}`}
                onClick={() => setSelected(u => u?.id === urgence.id ? null : urgence)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0">{typeConfig?.icon || '🚨'}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${niveauConfig.badge}`}>
                          {niveauConfig.label}
                        </span>
                        <span className={`text-xs font-medium ${statutConfig.color}`}>
                          {statutConfig.icon} {statutConfig.label}
                        </span>
                        <span className="text-xs text-gray-400">{dureeDepuis(urgence.createdAt)}</span>
                      </div>
                      <p className="font-bold text-gray-900 text-sm">{typeConfig?.label || urgence.typeUrgence}</p>
                      <p className="text-xs text-gray-600 truncate">📍 {urgence.immeuble}{urgence.localisation ? ` · ${urgence.localisation}` : ''}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{urgence.description}</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    {urgence.artisanNom ? (
                      <div className="bg-white/60 rounded-lg px-2 py-1.5 text-xs">
                        <p className="font-semibold text-gray-900">🔧 {urgence.artisanNom}</p>
                        {urgence.artisanTelephone && (
                          <a href={`tel:${urgence.artisanTelephone}`} onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline">
                            {urgence.artisanTelephone}
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs bg-white/60 text-orange-600 px-2 py-1 rounded-lg font-medium">Sans artisan</span>
                    )}
                  </div>
                </div>

                {/* Barre de progression */}
                {urgence.statut !== 'resolu' && (
                  <div className="mt-3">
                    <div className="flex justify-between mb-1">
                      {PIPELINE.map((s, i) => (
                        <span key={s} className={`text-[10px] font-medium ${i <= statutIdx ? STATUTS[s].color : 'text-gray-300'}`}>
                          {STATUTS[s].icon}
                        </span>
                      ))}
                    </div>
                    <div className="w-full bg-white/50 rounded-full h-1.5">
                      <div className="bg-current h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, color: urgence.niveau === 'critique' ? '#ef4444' : urgence.niveau === 'urgente' ? '#f97316' : '#eab308' }} />
                    </div>
                  </div>
                )}

                {/* Détail étendu */}
                {selectedUrgence?.id === urgence.id && (
                  <div className="mt-4 pt-4 border-t border-white/40 space-y-4" onClick={e => e.stopPropagation()}>

                    {/* Info signalement */}
                    {(urgence.signalePar || urgence.telephone) && (
                      <div className="grid grid-cols-2 gap-3 bg-white/50 rounded-xl p-3">
                        {urgence.signalePar && <div><p className="text-xs text-gray-400">Signalé par</p><p className="text-sm font-semibold">{urgence.signalePar}</p></div>}
                        {urgence.telephone && <div><p className="text-xs text-gray-400">Téléphone</p><a href={`tel:${urgence.telephone}`} className="text-sm font-semibold text-blue-600">{urgence.telephone}</a></div>}
                      </div>
                    )}

                    {/* Assigner artisan si pas encore fait */}
                    {!urgence.artisanId && artisans.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">🔧 Assigner un artisan VITFIX</p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {artisansSuggeres.slice(0, 6).map(a => {
                            const isMatch = TYPES_URGENCE.find(t => t.key === urgence.typeUrgence)?.metiers.some(m => a.metier?.toLowerCase().includes(m.toLowerCase()))
                            return (
                              <button
                                key={a.id}
                                onClick={() => assignerArtisan(urgence, a)}
                                className="w-full flex items-center gap-3 bg-white/70 hover:bg-white rounded-xl px-3 py-2 transition-colors text-left"
                              >
                                <span className="text-lg">{isMatch ? '⭐' : '👷'}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900">{a.nom}{a.prenom ? ` ${a.prenom}` : ''}</p>
                                  <p className="text-xs text-gray-500">{a.metier}</p>
                                </div>
                                {isMatch && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Recommandé</span>}
                                <a href={`tel:${a.telephone}`} onClick={e => e.stopPropagation()} className="text-blue-600 text-xs hover:underline">{a.telephone}</a>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Avancer le statut */}
                    {urgence.statut !== 'resolu' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => avancerStatut(urgence)}
                          className="flex-1 bg-white/70 hover:bg-white text-gray-800 font-semibold py-2 rounded-xl text-sm transition-colors"
                        >
                          ➡️ {STATUTS[PIPELINE[PIPELINE.indexOf(urgence.statut) + 1]]?.label}
                        </button>
                        <button
                          onClick={() => {
                            const u = { ...urgence, statut: 'resolu' as StatutUrgence, resolvedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), timeline: [...urgence.timeline, { date: new Date().toISOString(), action: 'Résolu', par: 'Syndic' }] }
                            save(urgences.map(x => x.id === u.id ? u : x))
                            setSelected(null)
                          }}
                          className="bg-green-600 text-white font-semibold py-2 px-4 rounded-xl text-sm hover:bg-green-700 transition-colors"
                        >
                          ✅ Marquer résolu
                        </button>
                      </div>
                    )}

                    {/* Timeline */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historique</p>
                      <div className="space-y-1.5">
                        {[...urgence.timeline].reverse().map((ev, i) => (
                          <div key={i} className="flex gap-2 text-xs">
                            <span className="text-gray-400 flex-shrink-0 w-32">{formatTime(ev.date)}</span>
                            <span className="text-gray-700">{ev.action}</span>
                            {ev.par && <span className="text-gray-400">· {ev.par}</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Supprimer */}
                    <button
                      onClick={() => { save(urgences.filter(u => u.id !== urgence.id)); setSelected(null) }}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      aria-label="Supprimer cette urgence"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal déclaration urgence ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-red-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
              <h2 className="text-lg font-bold">🚨 Déclarer une urgence</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-red-500 transition-colors" aria-label="Fermer">✕</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Type urgence */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block font-semibold uppercase tracking-wide">Type d&apos;urgence *</label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES_URGENCE.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setForm({ ...form, typeUrgence: t.key })}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-colors border ${form.typeUrgence === t.key ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                    >
                      <span className="text-lg">{t.icon}</span>
                      <span className="truncate">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Niveau */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block font-semibold uppercase tracking-wide">Niveau d&apos;urgence *</label>
                <div className="flex gap-2">
                  {(Object.entries(NIVEAUX) as [NiveauUrgence, typeof NIVEAUX[NiveauUrgence]][]).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setForm({ ...form, niveau: k })}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${form.niveau === k ? v.badge.replace('bg-', 'bg-').replace('100', '200') + ' ring-2 ring-current' : v.badge + ' opacity-60'}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${v.dot} inline-block mr-1.5`} />{v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Immeuble & localisation */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Immeuble *</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="Résidence les Pins"
                    value={form.immeuble || ''}
                    onChange={e => setForm({ ...form, immeuble: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Localisation précise</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="Couloir 3e étage, lot 12, cave B..."
                    value={form.localisation || ''}
                    onChange={e => setForm({ ...form, localisation: e.target.value })}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description *</label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  rows={3}
                  placeholder="Décrivez précisément la situation..."
                  value={form.description || ''}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {/* Signalé par */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Signalé par</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="M. Dupont"
                    value={form.signalePar || ''}
                    onChange={e => setForm({ ...form, signalePar: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Téléphone</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="06 12 34 56 78"
                    value={form.telephone || ''}
                    onChange={e => setForm({ ...form, telephone: e.target.value })}
                  />
                </div>
              </div>

              {/* Sélection artisan */}
              {artisans.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 mb-2 block font-semibold uppercase tracking-wide">
                    🔧 Artisan VITFIX {form.typeUrgence ? '— recommandés en tête' : ''}
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="Rechercher un artisan..."
                    value={searchArtisan}
                    onChange={e => setSearchArtisan(e.target.value)}
                  />
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    <button
                      onClick={() => setForm({ ...form, artisanId: undefined })}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${!form.artisanId ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                    >
                      <span>—</span> Assigner plus tard
                    </button>
                    {artisansFiltres.map(a => {
                      const isMatch = form.typeUrgence && TYPES_URGENCE.find(t => t.key === form.typeUrgence)?.metiers.some(m => a.metier?.toLowerCase().includes(m.toLowerCase()))
                      return (
                        <button
                          key={a.id}
                          onClick={() => setForm({ ...form, artisanId: a.id })}
                          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${form.artisanId === a.id ? 'bg-red-600 text-white' : 'bg-gray-50 hover:bg-gray-100'}`}
                        >
                          <span>{isMatch ? '⭐' : '👷'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{a.nom}{a.prenom ? ` ${a.prenom}` : ''}</p>
                            <p className={`text-xs ${form.artisanId === a.id ? 'text-red-100' : 'text-gray-400'}`}>{a.metier} · {a.telephone}</p>
                          </div>
                          {isMatch && form.artisanId !== a.id && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">✓ Match</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Bouton créer */}
              <button
                onClick={handleCreate}
                disabled={!form.immeuble || !form.typeUrgence || !form.description || saving}
                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Création...' : '🚨 Déclarer l\'urgence' + (form.artisanId ? ' & Contacter l\'artisan' : '')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
