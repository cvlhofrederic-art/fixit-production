'use client'

import { useState, useEffect, useMemo } from 'react'

// ─── Types locaux ──────────────────────────────────────────────────────────────

type EventType = 'intervention' | 'equipement' | 'contrat' | 'pppt' | 'sinistre' | 'etat_date'

interface HistEvent {
  id: string
  date: string
  type: EventType
  titre: string
  description?: string
  statut?: string
  cout?: number
  immeuble: string
  source: string
}

// Types depuis localStorage (doivent correspondre à ce que CarnetEntretienSection sauvegarde)
interface CarnetIntervention {
  id: string; date: string; nature: string; immeuble: string; localisation?: string
  prestataire?: string; cout: number; statut: string; notes?: string
}
interface CarnetEquipement {
  id: string; type: string; marque?: string; modele?: string; immeuble: string
  dateInstallation?: string; prochaineMaintenance?: string; derniereMaintenance?: string
  etat: string; prestataire?: string
}
interface CarnetContrat {
  id: string; type: string; prestataire?: string; immeuble: string
  dateDebut?: string; dateFin?: string; montantHT: number; statut: string
}
interface PPPTData {
  id: string; immeubleNom: string; travaux: Array<{
    id: string; annee: number; categorie: string; description: string; coutHT: number; statut: string
  }>
}

// ─── Config visuelle ───────────────────────────────────────────────────────────

const TYPE_CFG: Record<EventType, { icon: string; badge: string; bg: string; label: string }> = {
  intervention: { icon: '🔧', badge: 'bg-blue-100 text-blue-700',    bg: 'bg-blue-50 border-blue-100',    label: 'Intervention'  },
  equipement:   { icon: '⚙️', badge: 'bg-purple-100 text-purple-700', bg: 'bg-purple-50 border-purple-100', label: 'Équipement'    },
  contrat:      { icon: '📄', badge: 'bg-green-100 text-green-700',   bg: 'bg-green-50 border-green-100',   label: 'Contrat'       },
  pppt:         { icon: '🏗️', badge: 'bg-amber-100 text-amber-700',   bg: 'bg-amber-50 border-amber-100',   label: 'PPPT'          },
  sinistre:     { icon: '🚨', badge: 'bg-red-100 text-red-700',       bg: 'bg-red-50 border-red-100',       label: 'Sinistre'      },
  etat_date:    { icon: '📝', badge: 'bg-gray-100 text-gray-700',     bg: 'bg-gray-50 border-gray-100',     label: 'État daté'     },
}

const formatEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const formatDate = (s: string) => {
  try {
    return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return s }
}

// ─── Composant principal ───────────────────────────────────────────────────────

export default function HistoriqueImmeubleSection({ user, userRole }: { user: { id: string }; userRole: string }) {
  const uid = user.id

  const [allEvents, setAllEvents]         = useState<HistEvent[]>([])
  const [allImmeubles, setAllImmeubles]   = useState<string[]>([])
  const [selectedImm, setSelectedImm]     = useState<string | null>(null)
  const [searchImm, setSearchImm]         = useState('')
  const [filterType, setFilterType]       = useState<string>('all')
  const [filterYear, setFilterYear]       = useState<number>(0)
  const [loadingAPI, setLoadingAPI]       = useState(false)
  const [showSearch, setShowSearch]       = useState(false)

  // ── Chargement localStorage ───────────────────────────────────────────────────

  useEffect(() => {
    const collected: HistEvent[] = []
    const immeubleSet = new Set<string>()

    // ── Carnet d'entretien (interventions) ──
    try {
      const interventions: CarnetIntervention[] = JSON.parse(localStorage.getItem(`fixit_carnet_${uid}`) || '[]')
      interventions.forEach(iv => {
        if (iv.immeuble) immeubleSet.add(iv.immeuble)
        if (iv.date) {
          collected.push({
            id: `carnet-${iv.id}`,
            date: iv.date,
            type: 'intervention',
            titre: iv.nature || 'Intervention',
            description: [iv.localisation, iv.prestataire].filter(Boolean).join(' · ') || undefined,
            statut: iv.statut,
            cout: iv.cout || 0,
            immeuble: iv.immeuble || '',
            source: 'Carnet d\'entretien',
          })
        }
      })
    } catch {}

    // ── Équipements ──
    try {
      const equipements: CarnetEquipement[] = JSON.parse(localStorage.getItem(`fixit_equipements_${uid}`) || '[]')
      equipements.forEach(eq => {
        if (eq.immeuble) immeubleSet.add(eq.immeuble)

        if (eq.dateInstallation) {
          collected.push({
            id: `eq-install-${eq.id}`,
            date: eq.dateInstallation,
            type: 'equipement',
            titre: `Installation — ${eq.type}`,
            description: [eq.marque, eq.modele, eq.prestataire ? `(${eq.prestataire})` : ''].filter(Boolean).join(' ') || undefined,
            statut: 'Installé',
            immeuble: eq.immeuble || '',
            source: 'Équipements',
          })
        }

        if (eq.derniereMaintenance) {
          collected.push({
            id: `eq-maint-${eq.id}`,
            date: eq.derniereMaintenance,
            type: 'equipement',
            titre: `Maintenance — ${eq.type}`,
            description: eq.prestataire ? `Par ${eq.prestataire}` : undefined,
            statut: 'Effectuée',
            immeuble: eq.immeuble || '',
            source: 'Équipements',
          })
        }

        if (eq.prochaineMaintenance) {
          collected.push({
            id: `eq-next-${eq.id}`,
            date: eq.prochaineMaintenance,
            type: 'equipement',
            titre: `Maintenance prévue — ${eq.type}`,
            description: eq.prestataire ? `Par ${eq.prestataire}` : undefined,
            statut: new Date(eq.prochaineMaintenance) < new Date() ? '⚠️ Due' : 'Planifiée',
            immeuble: eq.immeuble || '',
            source: 'Équipements',
          })
        }
      })
    } catch {}

    // ── Contrats ──
    try {
      const contrats: CarnetContrat[] = JSON.parse(localStorage.getItem(`fixit_contrats_${uid}`) || '[]')
      contrats.forEach(ct => {
        if (ct.immeuble) immeubleSet.add(ct.immeuble)

        if (ct.dateDebut) {
          collected.push({
            id: `ct-debut-${ct.id}`,
            date: ct.dateDebut,
            type: 'contrat',
            titre: `Contrat signé — ${ct.type}`,
            description: ct.prestataire ? `Prestataire: ${ct.prestataire}` : undefined,
            statut: ct.statut,
            cout: ct.montantHT || 0,
            immeuble: ct.immeuble || '',
            source: 'Contrats',
          })
        }

        if (ct.dateFin) {
          collected.push({
            id: `ct-fin-${ct.id}`,
            date: ct.dateFin,
            type: 'contrat',
            titre: `Expiration contrat — ${ct.type}`,
            description: ct.prestataire,
            statut: new Date(ct.dateFin) < new Date() ? 'Expiré' : 'À renouveler',
            immeuble: ct.immeuble || '',
            source: 'Contrats',
          })
        }
      })
    } catch {}

    // ── PPPT ──
    try {
      const pppts: PPPTData[] = JSON.parse(localStorage.getItem(`fixit_pppt_${uid}`) || '[]')
      pppts.forEach(p => {
        if (p.immeubleNom) immeubleSet.add(p.immeubleNom)
        p.travaux?.forEach(t => {
          collected.push({
            id: `pppt-${p.id}-${t.id}`,
            date: `${t.annee}-07-01`,
            type: 'pppt',
            titre: t.description || 'Travaux PPPT',
            description: t.categorie,
            statut: t.statut,
            cout: t.coutHT || 0,
            immeuble: p.immeubleNom || '',
            source: 'PPPT',
          })
        })
      })
    } catch {}

    setAllEvents(collected)
    setAllImmeubles(Array.from(immeubleSet).sort())
  }, [uid])

  // ── Chargement API missions (Supabase) ────────────────────────────────────────

  useEffect(() => {
    const fetchMissions = async () => {
      setLoadingAPI(true)
      try {
        const res = await fetch('/api/syndic/missions?limit=500')
        if (!res.ok) return
        const data = await res.json()
        const missions: Array<{ id: string; immeuble?: string; dateIntervention?: string; dateCreation?: string; created_at?: string; type?: string; description?: string; statut?: string; montantFacture?: number; montantDevis?: number }> = data.missions || []

        const apiEvents: HistEvent[] = []
        missions.forEach(m => {
          const immeuble = (m.immeuble || '').trim()
          if (!immeuble) return

          setAllImmeubles(prev => prev.includes(immeuble) ? prev : [...prev, immeuble].sort())

          const date = m.dateIntervention || m.dateCreation || m.created_at
          if (!date) return

          apiEvents.push({
            id: `mission-${m.id}`,
            date,
            type: 'intervention',
            titre: m.type || m.description?.slice(0, 60) || 'Intervention',
            description: m.description?.slice(0, 120),
            statut: m.statut,
            cout: m.montantFacture || m.montantDevis || 0,
            immeuble,
            source: 'Missions',
          })
        })

        setAllEvents(prev => {
          const existingIds = new Set(prev.map(e => e.id))
          return [...prev, ...apiEvents.filter(e => !existingIds.has(e.id))]
        })
      } catch {}
      setLoadingAPI(false)
    }
    fetchMissions()
  }, [])

  // ── Filtrage et tri ──────────────────────────────────────────────────────────

  const years = useMemo(() => {
    const ys = new Set<number>()
    allEvents.forEach(e => {
      try { ys.add(new Date(e.date).getFullYear()) } catch {}
    })
    return Array.from(ys).sort((a, b) => b - a).slice(0, 8)
  }, [allEvents])

  const filteredEvents = useMemo(() => {
    return allEvents
      .filter(e => {
        if (selectedImm && e.immeuble !== selectedImm) return false
        if (filterType !== 'all' && e.type !== filterType) return false
        if (filterYear) {
          try { if (new Date(e.date).getFullYear() !== filterYear) return false } catch {}
        }
        return true
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [allEvents, selectedImm, filterType, filterYear])

  const filteredImmeubles = useMemo(() =>
    allImmeubles.filter(i => !searchImm || i.toLowerCase().includes(searchImm.toLowerCase())),
    [allImmeubles, searchImm]
  )

  // Stats
  const totalCout      = filteredEvents.reduce((s, e) => s + (e.cout || 0), 0)
  const countFutur     = filteredEvents.filter(e => new Date(e.date) > new Date()).length
  const countInterv    = filteredEvents.filter(e => e.type === 'intervention').length

  // ─── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏛️ Historique Technique Immeuble</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue consolidée — interventions, équipements, contrats, PPPT</p>
        </div>
        {loadingAPI && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <span className="animate-spin">⏳</span> Chargement missions...
          </span>
        )}
      </div>

      {/* Sélection immeuble */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm font-medium text-gray-700">Immeuble</span>
          <div className="flex-1 relative">
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Rechercher un immeuble..."
              value={searchImm}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              onChange={e => setSearchImm(e.target.value)}
            />
          </div>
        </div>

        {/* Pills immeubles */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setSelectedImm(null); setSearchImm('') }}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!selectedImm ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Tous ({allImmeubles.length})
          </button>
          {filteredImmeubles.map(imm => {
            const count = allEvents.filter(e => e.immeuble === imm).length
            return (
              <button
                key={imm}
                onClick={() => { setSelectedImm(selectedImm === imm ? null : imm); setSearchImm('') }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${selectedImm === imm ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {imm} <span className="opacity-60">({count})</span>
              </button>
            )
          })}
          {allImmeubles.length === 0 && (
            <p className="text-sm text-gray-400">Aucune donnée — renseignez le Carnet d&apos;entretien ou créez des Missions.</p>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        {/* Type */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterType('all')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterType === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Tout
          </button>
          {(Object.keys(TYPE_CFG) as EventType[]).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? 'all' : type)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterType === type ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {TYPE_CFG[type].icon} {TYPE_CFG[type].label}
            </button>
          ))}
        </div>

        {/* Années */}
        <div className="flex flex-wrap gap-1.5 ml-auto">
          {years.map(y => (
            <button
              key={y}
              onClick={() => setFilterYear(filterYear === y ? 0 : y)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterYear === y ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {y}
            </button>
          ))}
          {filterYear !== 0 && (
            <button onClick={() => setFilterYear(0)} className="text-xs px-3 py-1.5 rounded-full font-medium bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors">
              Toutes années
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Événements',     value: filteredEvents.length,        color: 'text-gray-900' },
          { label: 'Interventions',  value: countInterv,                   color: 'text-blue-600' },
          { label: 'À venir',        value: countFutur,                    color: 'text-amber-600' },
          { label: 'Coût total',     value: totalCout > 0 ? formatEur(totalCout) : '—', color: 'text-gray-900' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="text-5xl mb-4">🏛️</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucun événement trouvé</h3>
          <p className="text-gray-400 text-sm">
            {selectedImm
              ? `Aucun événement pour "${selectedImm}"${filterType !== 'all' ? ` de type "${TYPE_CFG[filterType as EventType]?.label}"` : ''}${filterYear ? ` en ${filterYear}` : ''}.`
              : 'Commencez par saisir des données dans le Carnet d\'entretien, les Équipements, les Contrats ou créez des Missions.'
            }
          </p>
        </div>
      ) : (
        <div>
          {/* Titre immeuble sélectionné */}
          {selectedImm && (
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-bold text-gray-900">📍 {selectedImm}</h2>
              <span className="text-sm text-gray-400">{filteredEvents.length} événement(s){filterYear ? ` en ${filterYear}` : ''}</span>
            </div>
          )}

          {/* Groupement par année */}
          {(() => {
            const eventsByYear = filteredEvents.reduce((acc, ev) => {
              const y = new Date(ev.date).getFullYear() || 0
              if (!acc[y]) acc[y] = []
              acc[y].push(ev)
              return acc
            }, {} as Record<number, HistEvent[]>)

            const sortedYears = Object.keys(eventsByYear).map(Number).sort((a, b) => b - a)

            return sortedYears.map(year => (
              <div key={year} className="mb-8">
                {/* Séparateur année */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${year === new Date().getFullYear() ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                    {year}
                  </div>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{eventsByYear[year].length} événement(s)</span>
                </div>

                {/* Timeline */}
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-100" />
                  <div className="space-y-3">
                    {eventsByYear[year].map(ev => {
                      const cfg = TYPE_CFG[ev.type]
                      const isFuture = new Date(ev.date) > new Date()

                      return (
                        <div key={ev.id} className="relative flex gap-3 pl-1">
                          {/* Icône timeline */}
                          <div className={`relative z-10 flex-shrink-0 w-9 h-9 rounded-full border-2 flex items-center justify-center text-base ${isFuture ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                            {cfg.icon}
                          </div>

                          {/* Carte */}
                          <div className={`flex-1 border rounded-xl p-3.5 min-w-0 ${isFuture ? 'bg-blue-50/40 border-blue-100' : 'bg-white border-gray-100'}`}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
                                  {ev.statut && <span className="text-xs text-gray-400">{ev.statut}</span>}
                                  {isFuture && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">À venir</span>}
                                  {!selectedImm && ev.immeuble && (
                                    <button
                                      onClick={() => setSelectedImm(ev.immeuble)}
                                      className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                                    >
                                      📍 {ev.immeuble}
                                    </button>
                                  )}
                                </div>
                                <p className="font-semibold text-gray-900 text-sm">{ev.titre}</p>
                                {ev.description && (
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">{ev.description}</p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                  {formatDate(ev.date)} · <span className="opacity-70">{ev.source}</span>
                                </p>
                              </div>
                              {!!ev.cout && ev.cout > 0 && (
                                <span className="text-sm font-bold text-gray-900 flex-shrink-0">{formatEur(ev.cout)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))
          })()}
        </div>
      )}
    </div>
  )
}
