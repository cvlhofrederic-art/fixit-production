'use client'

import { useState, useEffect, useMemo, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type EtatItem = 'bon' | 'surveiller' | 'defaillant' | 'absent' | 'na'
type StatutVisite = 'en_cours' | 'terminee' | 'envoyee'

interface ChecklistItem {
  id: string
  categorie: string
  label: string
  etat: EtatItem
  notes: string
  photoNom?: string
}

interface Visite {
  id: string
  immeuble: string
  adresse: string
  inspecteur: string
  dateVisite: string
  statut: StatutVisite
  items: ChecklistItem[]
  observations: string
  createdAt: string
  updatedAt: string
}

// ─── Checklist référence ──────────────────────────────────────────────────────

const CHECKLIST_REF: { categorie: string; icon: string; items: string[] }[] = [
  {
    categorie: 'Parties communes',
    icon: '🚪',
    items: [
      'Hall d\'entrée — propreté et éclairage',
      'Boîtes aux lettres — état et fermeture',
      'Escaliers — état des marches et rampes',
      'Couloirs — propreté et éclairage de sécurité',
      'Cave / local poubelle — propreté',
      'Local vélos — état et accessibilité',
      'Parking / sous-sol — éclairage et signalétique',
    ]
  },
  {
    categorie: 'Façades & Extérieurs',
    icon: '🏢',
    items: [
      'Façade principale — fissures, dégradations',
      'Façades latérales et arrière',
      'Toiture visible — tuiles, gouttières',
      'Espaces verts — taille, propreté',
      'Portail / clôture — fonctionnement',
      'Éclairage extérieur',
      'Trottoir devant l\'immeuble',
    ]
  },
  {
    categorie: 'Équipements techniques',
    icon: '⚙️',
    items: [
      'Ascenseur — affichage du certificat de contrôle',
      'Interphone / visiophone — fonctionnement',
      'Chaudière collective — voyants et pression',
      'VMC / ventilation — grilles propres',
      'Compteurs eau froide/chaude — lisibilité',
      'Local technique — rangement et propreté',
      'Antenne collective / fibre — état apparent',
    ]
  },
  {
    categorie: 'Sécurité incendie',
    icon: '🔥',
    items: [
      'Extincteurs — présence, date de vérification',
      'Détecteurs de fumée parties communes',
      'Éclairage de sécurité — blocs de secours',
      'Plan d\'évacuation — affichage et lisibilité',
      'Issues de secours — dégagement',
      'Colonnes sèches / montantes — bouchons présents',
      'Désenfumage — accès aux commandes',
    ]
  },
  {
    categorie: 'Accessibilité PMR',
    icon: '♿',
    items: [
      'Rampe d\'accès entrée — état',
      'Ascenseur — dimensions et signalétique PMR',
      'Stationnement PMR — marquage',
      'Revêtement sol extérieur — non glissant',
      'Interphone — hauteur réglementaire',
    ]
  },
  {
    categorie: 'Propreté & Entretien',
    icon: '🧹',
    items: [
      'Propreté générale des parties communes',
      'Absence de déchets encombrants',
      'État des peintures couloirs / cages',
      'Désinfection boîtes aux lettres',
      'Nettoyage vitres entrée',
    ]
  },
]

// ─── Config états ─────────────────────────────────────────────────────────────

const ETAT_CFG: Record<EtatItem, { label: string; icon: string; bg: string; text: string; dot: string }> = {
  bon:        { label: 'Bon état',    icon: '✅', bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-400'  },
  surveiller: { label: 'À surveiller', icon: '⚠️', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  defaillant: { label: 'Défaillant',  icon: '🔴', bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500'    },
  absent:     { label: 'Absent',      icon: '❌', bg: 'bg-gray-50',   text: 'text-gray-600',   dot: 'bg-gray-400'   },
  na:         { label: 'N/A',         icon: '—',  bg: 'bg-gray-50',   text: 'text-gray-400',   dot: 'bg-gray-200'   },
}

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function VisiteTechniqueSection({ user, userRole }: { user: { id: string }; userRole: string }) {
  const STORAGE_KEY = `fixit_visites_${user.id}`

  const [visites, setVisites]         = useState<Visite[]>([])
  const [view, setView]               = useState<'liste' | 'nouvelle' | 'detail'>('liste')
  const [selectedVisite, setSelected] = useState<Visite | null>(null)
  const [filterStatut, setFilter]     = useState<string>('all')
  const printRef                      = useRef<HTMLDivElement>(null)

  // Formulaire nouvelle visite
  const [formImmeuble, setFormImmeuble]   = useState('')
  const [formAdresse, setFormAdresse]     = useState('')
  const [formInspecteur, setFormInspecteur] = useState('')
  const [formDate, setFormDate]           = useState(new Date().toISOString().split('T')[0])
  const [formObs, setFormObs]             = useState('')
  const [items, setItems]                 = useState<ChecklistItem[]>([])

  // ── Persistance ──────────────────────────────────────────────────────────────

  useEffect(() => {
    try { setVisites(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch {}
  }, [])

  const save = (updated: Visite[]) => {
    setVisites(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  // ── Init checklist ────────────────────────────────────────────────────────────

  const initChecklist = () => {
    const all: ChecklistItem[] = []
    CHECKLIST_REF.forEach(cat => {
      cat.items.forEach(label => {
        all.push({ id: crypto.randomUUID(), categorie: cat.categorie, label, etat: 'bon', notes: '' })
      })
    })
    setItems(all)
  }

  const openNouvelle = () => {
    initChecklist()
    setFormImmeuble('')
    setFormAdresse('')
    setFormInspecteur('')
    setFormDate(new Date().toISOString().split('T')[0])
    setFormObs('')
    setView('nouvelle')
  }

  // ── Mettre à jour un item ─────────────────────────────────────────────────────

  const updateItem = (id: string, field: keyof ChecklistItem, value: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  // ── Score visite ──────────────────────────────────────────────────────────────

  const scoreVisite = (visite: Visite) => {
    const actifs = visite.items.filter(it => it.etat !== 'na')
    if (!actifs.length) return 100
    const bons = actifs.filter(it => it.etat === 'bon').length
    return Math.round((bons / actifs.length) * 100)
  }

  const scoreColor = (score: number) =>
    score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'

  // ── Sauvegarder visite ────────────────────────────────────────────────────────

  const handleSaveVisite = (statut: StatutVisite = 'terminee') => {
    if (!formImmeuble) return
    const now = new Date().toISOString()
    const newVisite: Visite = {
      id: crypto.randomUUID(),
      immeuble: formImmeuble,
      adresse: formAdresse,
      inspecteur: formInspecteur,
      dateVisite: formDate,
      statut,
      items: [...items],
      observations: formObs,
      createdAt: now,
      updatedAt: now,
    }
    const updated = [newVisite, ...visites]
    save(updated)
    setSelected(newVisite)
    setView('detail')
  }

  // ── Imprimer rapport ──────────────────────────────────────────────────────────

  const handlePrint = () => window.print()

  // ── Filtres ──────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => visites.filter(v => {
    if (filterStatut === 'all') return true
    return v.statut === filterStatut
  }), [visites, filterStatut])

  // ── Stats ─────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const items = visites.flatMap(v => v.items)
    return {
      total: visites.length,
      anomalies: items.filter(it => it.etat === 'defaillant' || it.etat === 'surveiller').length,
      critiques: items.filter(it => it.etat === 'defaillant').length,
    }
  }, [visites])

  // ─── Vue Liste ────────────────────────────────────────────────────────────────

  if (view === 'liste') return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 Visites Techniques</h1>
          <p className="text-sm text-gray-500 mt-0.5">Checklist terrain → rapport PDF pour le conseil syndical</p>
        </div>
        <button onClick={openNouvelle} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
          + Nouvelle visite
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Visites effectuées', value: stats.total,     color: 'text-gray-900' },
          { label: 'Points à surveiller', value: stats.anomalies, color: stats.anomalies > 0 ? 'text-yellow-600' : 'text-gray-900' },
          { label: 'Points défaillants',  value: stats.critiques, color: stats.critiques > 0 ? 'text-red-600 font-black' : 'text-gray-900' },
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
          { key: 'all',      label: 'Toutes' },
          { key: 'terminee', label: 'Terminées' },
          { key: 'en_cours', label: 'En cours' },
          { key: 'envoyee',  label: 'Envoyées' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`text-xs px-4 py-1.5 rounded-full font-medium transition-colors ${filterStatut === f.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucune visite enregistrée</h3>
          <p className="text-gray-400 text-sm mb-6">Commencez votre première visite technique.</p>
          <button onClick={openNouvelle} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors">+ Nouvelle visite</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(visite => {
            const score = scoreVisite(visite)
            const defaillants = visite.items.filter(it => it.etat === 'defaillant')
            const surveiller  = visite.items.filter(it => it.etat === 'surveiller')
            return (
              <div key={visite.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelected(visite); setView('detail') }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{visite.immeuble}</h3>
                    {visite.adresse && <p className="text-xs text-gray-400 truncate">{visite.adresse}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(visite.dateVisite)}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className={`text-2xl font-bold ${scoreColor(score)}`}>{score}%</p>
                    <p className="text-xs text-gray-400">conformité</p>
                  </div>
                </div>

                {/* Barre score */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                  <div className={`h-1.5 rounded-full transition-all ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-400' : 'bg-red-500'}`} style={{ width: `${score}%` }} />
                </div>

                {/* Anomalies */}
                <div className="flex gap-2 text-xs mb-3">
                  {defaillants.length > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">🔴 {defaillants.length} défaillant{defaillants.length > 1 ? 's' : ''}</span>}
                  {surveiller.length > 0 && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">⚠️ {surveiller.length} à surveiller</span>}
                  {defaillants.length === 0 && surveiller.length === 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✅ Aucune anomalie</span>}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>👷 {visite.inspecteur || 'Inspecteur non renseigné'}</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${visite.statut === 'envoyee' ? 'bg-blue-100 text-blue-700' : visite.statut === 'terminee' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {visite.statut === 'envoyee' ? '📤 Envoyée' : visite.statut === 'terminee' ? '✅ Terminée' : '⏳ En cours'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ─── Vue Nouvelle visite (Checklist) ──────────────────────────────────────────

  if (view === 'nouvelle') return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setView('liste')} className="text-gray-400 hover:text-gray-600 transition-colors text-sm">← Retour</button>
        <h1 className="text-2xl font-bold text-gray-900">📋 Nouvelle visite technique</h1>
      </div>

      {/* Infos visite */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h3 className="font-semibold text-gray-700 mb-3">📍 Informations</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Immeuble *</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Résidence les Pins" value={formImmeuble} onChange={e => setFormImmeuble(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Adresse</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="12 rue des Fleurs" value={formAdresse} onChange={e => setFormAdresse(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date</label>
            <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={formDate} onChange={e => setFormDate(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Inspecteur</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Jean Dupont — Gestionnaire Technique" value={formInspecteur} onChange={e => setFormInspecteur(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Checklist par catégorie */}
      {CHECKLIST_REF.map(cat => {
        const catItems = items.filter(it => it.categorie === cat.categorie)
        const defaillants = catItems.filter(it => it.etat === 'defaillant').length
        const surveiller = catItems.filter(it => it.etat === 'surveiller').length
        return (
          <div key={cat.categorie} className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">{cat.icon}</span>
              <h3 className="font-bold text-gray-900">{cat.categorie}</h3>
              {defaillants > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium ml-auto">{defaillants} défaillant{defaillants > 1 ? 's' : ''}</span>}
              {surveiller > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium ml-auto">{surveiller} à surveiller</span>}
            </div>

            <div className="space-y-3">
              {catItems.map(item => (
                <div key={item.id} className={`border rounded-xl p-3 transition-colors ${ETAT_CFG[item.etat].bg}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">{ETAT_CFG[item.etat].icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium mb-2 ${ETAT_CFG[item.etat].text}`}>{item.label}</p>
                      {/* Boutons état */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(Object.keys(ETAT_CFG) as EtatItem[]).map(e => (
                          <button
                            key={e}
                            onClick={() => updateItem(item.id, 'etat', e)}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${item.etat === e ? ETAT_CFG[e].bg + ' ' + ETAT_CFG[e].text + ' ring-1 ring-current font-bold' : 'bg-white/70 text-gray-500 hover:bg-white'}`}
                          >
                            {ETAT_CFG[e].icon} {ETAT_CFG[e].label}
                          </button>
                        ))}
                      </div>
                      {/* Notes */}
                      {(item.etat === 'defaillant' || item.etat === 'surveiller') && (
                        <input
                          className="w-full border border-white/60 rounded-lg px-2 py-1 text-xs bg-white/60 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="Observation, localisation précise..."
                          value={item.notes}
                          onChange={e => updateItem(item.id, 'notes', e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Observations générales */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <label className="text-sm font-semibold text-gray-700 mb-2 block">💬 Observations générales</label>
        <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={4} placeholder="Commentaires globaux, points d'attention particuliers, travaux urgents à prévoir..." value={formObs} onChange={e => setFormObs(e.target.value)} />
      </div>

      {/* Actions */}
      <div className="flex gap-3 sticky bottom-4">
        <button
          onClick={() => handleSaveVisite('terminee')}
          disabled={!formImmeuble}
          className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg"
        >
          ✅ Terminer & Générer le rapport
        </button>
        <button
          onClick={() => handleSaveVisite('en_cours')}
          disabled={!formImmeuble}
          className="px-5 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-sm"
        >
          💾 Sauvegarder
        </button>
        <button onClick={() => setView('liste')} className="px-5 py-3 bg-white border border-gray-200 text-gray-400 rounded-xl font-medium hover:bg-gray-50 transition-colors">
          Annuler
        </button>
      </div>
    </div>
  )

  // ─── Vue Détail / Rapport ─────────────────────────────────────────────────────

  if (view === 'detail' && selectedVisite) {
    const score = scoreVisite(selectedVisite)
    const anomalies = selectedVisite.items.filter(it => it.etat === 'defaillant' || it.etat === 'surveiller')

    return (
      <div className="p-6 max-w-4xl mx-auto">
        {/* Nav */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <button onClick={() => setView('liste')} className="text-gray-400 hover:text-gray-600 transition-colors text-sm">← Retour à la liste</button>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors"
            >
              🖨️ Imprimer / PDF
            </button>
            <button
              onClick={() => { save(visites.map(v => v.id === selectedVisite.id ? { ...v, statut: 'envoyee' } : v)); setSelected({ ...selectedVisite, statut: 'envoyee' }) }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              📤 Marquer envoyé au CS
            </button>
            <button
              onClick={() => { if (confirm('Supprimer cette visite ?')) { save(visites.filter(v => v.id !== selectedVisite.id)); setView('liste') } }}
              className="p-2 text-gray-300 hover:text-red-500 transition-colors"
              aria-label="Supprimer"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Rapport imprimable */}
        <div ref={printRef} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* En-tête rapport */}
          <div className="bg-gray-900 text-white px-8 py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Rapport de Visite Technique</p>
                <h1 className="text-2xl font-black">{selectedVisite.immeuble}</h1>
                {selectedVisite.adresse && <p className="text-gray-300 mt-0.5">{selectedVisite.adresse}</p>}
              </div>
              <div className="text-right">
                <p className={`text-5xl font-black ${score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{score}%</p>
                <p className="text-gray-400 text-xs">Taux de conformité</p>
              </div>
            </div>
            <div className="mt-4 flex gap-6 text-sm">
              <span>📅 {formatDate(selectedVisite.dateVisite)}</span>
              {selectedVisite.inspecteur && <span>👷 {selectedVisite.inspecteur}</span>}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selectedVisite.statut === 'envoyee' ? 'bg-blue-600' : 'bg-green-600'}`}>
                {selectedVisite.statut === 'envoyee' ? '📤 Envoyé au CS' : '✅ Terminé'}
              </span>
            </div>
          </div>

          {/* Résumé anomalies */}
          {anomalies.length > 0 && (
            <div className="px-8 py-5 border-b border-gray-100 bg-red-50">
              <h2 className="font-bold text-gray-900 mb-3">⚠️ Points d&apos;attention ({anomalies.length})</h2>
              <div className="space-y-1.5">
                {anomalies.map(item => (
                  <div key={item.id} className="flex items-start gap-2">
                    <span className="flex-shrink-0">{ETAT_CFG[item.etat].icon}</span>
                    <div>
                      <span className={`text-sm font-medium ${ETAT_CFG[item.etat].text}`}>[{item.categorie}] {item.label}</span>
                      {item.notes && <span className="text-xs text-gray-500"> — {item.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Détail par catégorie */}
          <div className="px-8 py-5">
            {CHECKLIST_REF.map(cat => {
              const catItems = selectedVisite.items.filter(it => it.categorie === cat.categorie)
              return (
                <div key={cat.categorie} className="mb-6">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                    <span>{cat.icon}</span> {cat.categorie}
                  </h3>
                  <div className="grid grid-cols-1 gap-1.5">
                    {catItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50">
                        <span className="flex-shrink-0">{ETAT_CFG[item.etat].icon}</span>
                        <span className="flex-1 text-sm text-gray-700">{item.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ETAT_CFG[item.etat].bg} ${ETAT_CFG[item.etat].text}`}>{ETAT_CFG[item.etat].label}</span>
                        {item.notes && <span className="text-xs text-gray-400 truncate max-w-32">{item.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Observations */}
            {selectedVisite.observations && (
              <div className="bg-gray-50 rounded-xl p-4 mt-4">
                <h3 className="font-bold text-gray-900 mb-2">💬 Observations générales</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedVisite.observations}</p>
              </div>
            )}

            {/* Pied de page rapport */}
            <div className="mt-8 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
              <span>Rapport généré par VITFIX — {new Date().toLocaleDateString('fr-FR')}</span>
              <span>Confidentiel — Usage interne</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
