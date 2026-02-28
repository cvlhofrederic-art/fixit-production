'use client'

import { useState, useEffect } from 'react'

const EMPTY_CLIENT_FORM = {
  type: 'particulier' as 'particulier' | 'professionnel',
  name: '',
  email: '',
  phone: '',
  siret: '',
  mainAddress: '',
  mainAddressLabel: 'Domicile',
  interventionAddresses: [] as { id: string; label: string; address: string }[],
  notes: '',
}

export default function ClientsSection({ artisan, bookings, services, onNewRdv, onNewDevis }: {
  artisan: any
  bookings: any[]
  services: any[]
  onNewRdv: (clientName: string) => void
  onNewDevis: (clientName: string) => void
}) {
  const manualStorageKey = `fixit_manual_clients_${artisan?.id}`

  const [authClients, setAuthClients] = useState<any[]>([])
  const [manualClients, setManualClients] = useState<any[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(`fixit_manual_clients_${artisan?.id}`) || '[]') } catch { return [] }
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'tous' | 'particuliers' | 'entreprises'>('tous')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [clientForm, setClientForm] = useState({ ...EMPTY_CLIENT_FORM })
  const [saving, setSaving] = useState(false)

  // Fetch auth clients from API
  useEffect(() => {
    if (!artisan?.id) return
    setLoading(true)
    fetch(`/api/artisan-clients?artisan_id=${artisan.id}`)
      .then(r => r.json())
      .then(data => {
        setAuthClients(data.clients || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [artisan?.id])

  // Save manual clients to localStorage
  const saveManualClients = (updated: any[]) => {
    setManualClients(updated)
    localStorage.setItem(manualStorageKey, JSON.stringify(updated))
  }

  // Merge auth + manual clients
  const allClients = [
    ...authClients,
    ...manualClients.map(c => ({ ...c, source: 'manual' })),
  ]

  const isEntreprise = (c: any) => c.type === 'professionnel' || Boolean(c.siret && c.siret.trim())

  const filtered = allClients.filter(c => {
    const searchFields = [c.name, c.email, c.phone, c.mainAddress || c.address, c.siret, c.notes]
    const matchSearch = !search || searchFields.filter(Boolean).some((v: string) => v.toLowerCase().includes(search.toLowerCase()))
    const matchTab =
      activeTab === 'tous' ||
      (activeTab === 'entreprises' && isEntreprise(c)) ||
      (activeTab === 'particuliers' && !isEntreprise(c))
    return matchSearch && matchTab
  })

  const totalCA = (c: any) => {
    const clientBookings = (c.bookings || []).filter((b: any) => b.status === 'completed')
    return clientBookings.reduce((sum: number, b: any) => sum + (b.price || b.price_ttc || 0), 0)
  }

  const lastBookingDate = (c: any) => {
    const bks = c.bookings || []
    if (bks.length === 0) return null
    const sorted = [...bks].sort((a: any, b: any) => b.date.localeCompare(a.date))
    return sorted[0].date
  }

  const particuliersCount = allClients.filter(c => !isEntreprise(c)).length
  const entreprisesCount = allClients.filter(c => isEntreprise(c)).length

  // Open modal for new client
  const openNew = () => {
    setEditingId(null)
    setClientForm({ ...EMPTY_CLIENT_FORM })
    setShowModal(true)
  }

  // Open modal for editing a manual client
  const openEdit = (c: any) => {
    setEditingId(c.id)
    setClientForm({
      type: c.type || 'particulier',
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      siret: c.siret || '',
      mainAddress: c.mainAddress || c.address || '',
      mainAddressLabel: c.mainAddressLabel || (c.type === 'professionnel' ? 'Siège social' : 'Domicile'),
      interventionAddresses: c.interventionAddresses || [],
      notes: c.notes || '',
    })
    setShowModal(true)
  }

  const addInterventionAddress = () => {
    setClientForm(prev => ({
      ...prev,
      interventionAddresses: [
        ...prev.interventionAddresses,
        { id: Date.now().toString(), label: '', address: '' },
      ],
    }))
  }

  const updateInterventionAddress = (id: string, field: 'label' | 'address', value: string) => {
    setClientForm(prev => ({
      ...prev,
      interventionAddresses: prev.interventionAddresses.map(a => a.id === id ? { ...a, [field]: value } : a),
    }))
  }

  const removeInterventionAddress = (id: string) => {
    setClientForm(prev => ({
      ...prev,
      interventionAddresses: prev.interventionAddresses.filter(a => a.id !== id),
    }))
  }

  const saveClient = () => {
    if (!clientForm.name.trim()) return
    setSaving(true)
    if (editingId) {
      const updated = manualClients.map(c => c.id === editingId ? { ...c, ...clientForm } : c)
      saveManualClients(updated)
    } else {
      const newClient = { ...clientForm, id: `manual_${Date.now()}`, bookings: [] }
      saveManualClients([newClient, ...manualClients])
    }
    setShowModal(false)
    setSaving(false)
  }

  const deleteManualClient = (id: string) => {
    if (!confirm('Supprimer ce client ?')) return
    saveManualClients(manualClients.filter(c => c.id !== id))
  }

  return (
    <div className="animate-fadeIn">
      {/* Modal — Create/Edit client */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">
                {editingId ? '✏️ Modifier le client' : '➕ Nouveau client'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Type toggle */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Type de client</label>
                <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                  {(['particulier', 'professionnel'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setClientForm(prev => ({
                        ...prev,
                        type: t,
                        mainAddressLabel: t === 'professionnel' ? 'Siège social' : 'Domicile',
                      }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${clientForm.type === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                    >
                      {t === 'particulier' ? '👤 Particulier' : '🏢 Professionnel'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {clientForm.type === 'professionnel' ? 'Raison sociale *' : 'Nom complet *'}
                </label>
                <input
                  type="text"
                  value={clientForm.name}
                  onChange={e => setClientForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={clientForm.type === 'professionnel' ? 'AJA Associés, Groupe Martin...' : 'Jean Dupont'}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]"
                />
              </div>

              {/* Phone + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={clientForm.phone}
                    onChange={e => setClientForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="06 00 00 00 00"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={clientForm.email}
                    onChange={e => setClientForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="contact@exemple.fr"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]"
                  />
                </div>
              </div>

              {/* SIRET for pro */}
              {clientForm.type === 'professionnel' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">SIRET</label>
                  <input
                    type="text"
                    value={clientForm.siret}
                    onChange={e => setClientForm(prev => ({ ...prev, siret: e.target.value }))}
                    placeholder="123 456 789 00012"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] font-mono"
                  />
                </div>
              )}

              {/* Main address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {clientForm.mainAddressLabel} <span className="text-gray-500 font-normal">(adresse principale)</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={clientForm.mainAddressLabel}
                    onChange={e => setClientForm(prev => ({ ...prev, mainAddressLabel: e.target.value }))}
                    className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] bg-white flex-shrink-0"
                  >
                    {clientForm.type === 'particulier'
                      ? ['Domicile', 'Résidence principale', 'Appartement', 'Maison', 'Autre'].map(l => <option key={l}>{l}</option>)
                      : ['Siège social', 'Bureau principal', 'Autre'].map(l => <option key={l}>{l}</option>)}
                  </select>
                  <input
                    type="text"
                    value={clientForm.mainAddress}
                    onChange={e => setClientForm(prev => ({ ...prev, mainAddress: e.target.value }))}
                    placeholder="12 rue de la Paix, 75001 Paris"
                    className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]"
                  />
                </div>
              </div>

              {/* Intervention addresses */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    📍 Lieux d'intervention
                    <span className="text-gray-500 font-normal ml-1">
                      ({clientForm.type === 'professionnel' ? 'lots, résidences, sites...' : 'autres adresses'})
                    </span>
                  </label>
                  <button
                    onClick={addInterventionAddress}
                    className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-lg hover:bg-amber-100 transition font-medium"
                  >
                    + Ajouter un lieu
                  </button>
                </div>

                {clientForm.interventionAddresses.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">
                    {clientForm.type === 'professionnel'
                      ? 'Ex: "Parc Corot" → 5 allée des Chênes, "La Sauvagère" → 12 bd Victor Hugo...'
                      : 'Ex: "Maison de vacances" → 3 rue de la Mer, 06400 Cannes'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {clientForm.interventionAddresses.map((addr) => (
                      <div key={addr.id} className="flex gap-2 items-start">
                        <input
                          type="text"
                          value={addr.label}
                          onChange={e => updateInterventionAddress(addr.id, 'label', e.target.value)}
                          placeholder={clientForm.type === 'professionnel' ? 'Ex: Parc Corot' : 'Ex: Maison vacances'}
                          className="w-36 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FFC107] flex-shrink-0"
                        />
                        <input
                          type="text"
                          value={addr.address}
                          onChange={e => updateInterventionAddress(addr.id, 'address', e.target.value)}
                          placeholder="Adresse complète..."
                          className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FFC107]"
                        />
                        <button
                          onClick={() => removeInterventionAddress(addr.id)}
                          className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 flex-shrink-0 mt-0.5"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes internes</label>
                <textarea
                  value={clientForm.notes}
                  onChange={e => setClientForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Informations utiles sur ce client..."
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] resize-none"
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border-2 border-gray-200 text-gray-600 rounded-xl py-3 font-semibold text-sm hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={saveClient}
                disabled={!clientForm.name.trim() || saving}
                className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 rounded-xl py-3 font-bold text-sm transition disabled:opacity-50"
              >
                {saving ? 'Sauvegarde...' : editingId ? '💾 Modifier' : '✅ Créer le client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-semibold">👥 Base Clients</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full text-sm font-semibold">
              {allClients.length} client{allClients.length > 1 ? 's' : ''}
            </span>
            <span className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
              👤 {particuliersCount} particulier{particuliersCount > 1 ? 's' : ''}
            </span>
            <span className="bg-purple-50 border border-purple-200 text-purple-700 px-3 py-1 rounded-full text-sm font-semibold">
              🏢 {entreprisesCount} pro
            </span>
            <button
              onClick={openNew}
              className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2"
            >
              ➕ Nouveau client
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        {/* Search + Tabs */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">🔍</span>
            <input
              type="text"
              placeholder="Rechercher par nom, email, téléphone, adresse..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FFC107] transition bg-white"
            />
          </div>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {(['tous', 'particuliers', 'entreprises'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {tab === 'tous' ? `Tous (${allClients.length})` : tab === 'particuliers' ? `👤 (${particuliersCount})` : `🏢 (${entreprisesCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-20 text-gray-500">
            <div className="text-4xl mb-4 animate-pulse">👥</div>
            <p>Chargement des clients...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              {search ? 'Aucun résultat' : 'Pas encore de clients'}
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              {search ? 'Essayez un autre terme' : 'Ajoutez vos clients manuellement ou ils apparaîtront après leurs premières réservations.'}
            </p>
            {!search && (
              <button
                onClick={openNew}
                className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-3 rounded-xl font-bold transition-all"
              >
                ➕ Créer mon premier client
              </button>
            )}
          </div>
        )}

        {/* Client cards */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(c => {
              const isExp = isEntreprise(c)
              const ca = totalCA(c)
              const lastDate = lastBookingDate(c)
              const bks = c.bookings || []
              const isExpanded = expandedId === c.id
              const isManual = c.source === 'manual'
              const hasInterventionAddresses = c.interventionAddresses && c.interventionAddresses.length > 0

              return (
                <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                  {/* Card header */}
                  <div className="p-5 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0 ${isExp ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {isExp ? '🏢' : (c.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-base">{c.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isExp ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isExp ? 'Professionnel' : 'Particulier'}
                          </span>
                          {c.source === 'auth' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Compte Fixit</span>}
                          {isManual && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Ajouté manuellement</span>}
                          {hasInterventionAddresses && (
                            <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full">
                              📍 {c.interventionAddresses.length} lieu{c.interventionAddresses.length > 1 ? 'x' : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 flex-wrap">
                          {c.phone && <span className="text-sm text-gray-500">📞 {c.phone}</span>}
                          {c.email && <span className="text-sm text-gray-500 truncate">✉️ {c.email}</span>}
                          {!c.phone && !c.email && <span className="text-sm text-gray-500 italic">Coordonnées non renseignées</span>}
                        </div>
                      </div>
                      <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="text-lg font-bold text-green-600">{ca > 0 ? `${ca.toFixed(0)} €` : '—'}</div>
                        <div className="text-xs text-gray-500">{bks.length} intervention{bks.length > 1 ? 's' : ''}</div>
                        {lastDate && <div className="text-xs text-gray-500">Dernier: {new Date(lastDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>}
                      </div>
                      <div className={`text-gray-500 text-lg transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>▾</div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-5 bg-gray-50">
                      <div className="grid sm:grid-cols-2 gap-6">
                        {/* Coordonnées + adresses */}
                        <div>
                          <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">📋 Coordonnées</h4>
                          <div className="space-y-2 text-sm">
                            {c.phone && (
                              <div className="flex gap-2">
                                <span className="text-gray-500 w-20 flex-shrink-0">Téléphone</span>
                                <a href={`tel:${c.phone}`} className="text-blue-600 hover:underline font-medium">{c.phone}</a>
                              </div>
                            )}
                            {c.email && (
                              <div className="flex gap-2">
                                <span className="text-gray-500 w-20 flex-shrink-0">Email</span>
                                <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline font-medium truncate">{c.email}</a>
                              </div>
                            )}
                            {(c.mainAddress || c.address) && (
                              <div className="flex gap-2">
                                <span className="text-gray-500 w-20 flex-shrink-0">{c.mainAddressLabel || 'Adresse'}</span>
                                <span className="text-gray-700">{c.mainAddress || c.address}</span>
                              </div>
                            )}
                            {c.siret && (
                              <div className="flex gap-2">
                                <span className="text-gray-500 w-20 flex-shrink-0">SIRET</span>
                                <span className="font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-xs">{c.siret}</span>
                              </div>
                            )}
                            {c.notes && (
                              <div className="flex gap-2">
                                <span className="text-gray-500 w-20 flex-shrink-0">Notes</span>
                                <span className="text-gray-600 italic text-xs">{c.notes}</span>
                              </div>
                            )}
                          </div>

                          {/* Intervention addresses */}
                          {hasInterventionAddresses && (
                            <div className="mt-4">
                              <h5 className="font-bold text-gray-600 text-xs uppercase tracking-wide mb-2">📍 Lieux d'intervention</h5>
                              <div className="space-y-1.5">
                                {c.interventionAddresses.map((addr: any) => (
                                  <div key={addr.id} className="flex items-start gap-2 bg-white border border-orange-100 rounded-lg px-3 py-2">
                                    <span className="font-semibold text-orange-600 text-xs flex-shrink-0 min-w-[70px]">{addr.label || 'Lieu'}</span>
                                    <span className="text-gray-600 text-xs">{addr.address}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 mt-4 flex-wrap">
                            <button onClick={() => onNewRdv(c.name)} className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-3 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm">
                              📅 RDV
                            </button>
                            <button onClick={() => onNewDevis(c.name)} className="flex-1 bg-white border-2 border-gray-200 hover:border-[#FFC107] text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold transition-all">
                              📄 Devis
                            </button>
                            {isManual && (
                              <>
                                <button onClick={() => openEdit(c)} className="bg-blue-50 border border-blue-200 text-blue-600 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-blue-100 transition">
                                  ✏️
                                </button>
                                <button onClick={() => deleteManualClient(c.id)} className="bg-red-50 border border-red-200 text-red-500 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-100 transition">
                                  🗑️
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Booking history */}
                        <div>
                          <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">🗂 Historique ({bks.length})</h4>
                          {bks.length === 0 ? (
                            <p className="text-gray-500 text-sm italic">Aucune intervention enregistrée</p>
                          ) : (
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                              {[...bks].sort((a: any, b: any) => b.date.localeCompare(a.date)).map((bk: any) => (
                                <div key={bk.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2">
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${bk.status === 'completed' ? 'bg-green-500' : bk.status === 'confirmed' ? 'bg-blue-500' : bk.status === 'cancelled' ? 'bg-red-400' : 'bg-amber-400'}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-800 truncate">{bk.service || 'Intervention'}</div>
                                    {bk.address && <div className="text-xs text-gray-500 truncate">📍 {bk.address}</div>}
                                    <div className="text-xs text-gray-500">{new Date(bk.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                  </div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${bk.status === 'completed' ? 'bg-green-100 text-green-700' : bk.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : bk.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                    {bk.status === 'completed' ? 'Terminé' : bk.status === 'confirmed' ? 'Confirmé' : bk.status === 'cancelled' ? 'Annulé' : 'En attente'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 pt-3 border-t border-gray-200 flex gap-4 text-sm">
                            <div>
                              <div className="font-bold text-green-600 text-lg">{ca > 0 ? `${ca.toFixed(0)} €` : '—'}</div>
                              <div className="text-gray-500 text-xs">CA total TTC</div>
                            </div>
                            <div>
                              <div className="font-bold text-gray-700 text-lg">{bks.length}</div>
                              <div className="text-gray-500 text-xs">Intervention{bks.length > 1 ? 's' : ''}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
