'use client'

import { useState } from 'react'
import type { Artisan, Coproprio, Mission } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'

export default function ModalNouveilleMission({
  onClose,
  onAdd,
  batimentsConnus,
  artisans,
  coproprios = [],
}: {
  onClose: () => void
  onAdd: (m: Partial<Mission> & { demandeurEmail?: string; heureIntervention?: string }) => void
  batimentsConnus: string[]
  artisans: Artisan[]
  coproprios?: Coproprio[]
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [form, setForm] = useState({
    immeuble: '',
    adresseImmeuble: '',
    batiment: '',
    etage: '',
    numLot: '',
    locataire: '',
    telephoneLocataire: '',
    emailLocataire: '',
    accesLogement: '',
    artisan: '',
    type: 'Plomberie',
    description: '',
    priorite: 'normale' as Mission['priorite'],
    dateIntervention: '',
    heureIntervention: '',
    montantDevis: '',
    notifierDemandeur: true,
  })
  const [immeubleInput, setImmeubleInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showCoproSearch, setShowCoproSearch] = useState(false)
  const [coproSearch, setCoproSearch] = useState('')

  // Autocomplete intelligent : pour les saisies courtes (<3 chars),
  // exiger une correspondance en début de mot pour éviter les faux positifs ("LA" matchant tout)
  const suggestions = (() => {
    if (immeubleInput.length === 0) return []
    const q = immeubleInput.toLowerCase().trim()
    if (q.length < 3) {
      // Court : match début de mot uniquement (word boundary)
      const wordBoundaryRegex = new RegExp(`(^|\\s|[-'/])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
      return batimentsConnus.filter(b => wordBoundaryRegex.test(b))
    }
    // 3+ chars : substring match classique, trié par pertinence (commence par > contient)
    const matches = batimentsConnus.filter(b => b.toLowerCase().includes(q))
    return matches.sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(q) ? 0 : 1
      const bStarts = b.toLowerCase().startsWith(q) ? 0 : 1
      return aStarts - bStarts
    })
  })()

  // Auto-remplissage depuis copropriétaire existant
  const filteredCopros = coproprios.filter((c: Coproprio) => {
    const q = coproSearch.toLowerCase()
    return !q || `${c.nomProprietaire || ''} ${c.prenomProprietaire || ''}`.toLowerCase().includes(q) || (c.emailProprietaire || '').toLowerCase().includes(q) || (c.numeroPorte || '').toLowerCase().includes(q) || (c.nomLocataire || '').toLowerCase().includes(q)
  }).slice(0, 8)

  const autoFillFromCopro = (copro: Coproprio) => {
    setForm(f => ({
      ...f,
      immeuble: copro.immeuble || f.immeuble,
      batiment: copro.batiment || f.batiment,
      etage: String(copro.etage || f.etage),
      numLot: copro.numeroPorte || f.numLot,
      locataire: copro.nomLocataire ? `${copro.prenomLocataire || ''} ${copro.nomLocataire}`.trim() : (copro.nomProprietaire ? `${copro.prenomProprietaire || ''} ${copro.nomProprietaire}`.trim() : f.locataire),
      telephoneLocataire: copro.telephoneLocataire || copro.telephoneProprietaire || f.telephoneLocataire,
      emailLocataire: copro.emailLocataire || copro.emailProprietaire || f.emailLocataire,
    }))
    if (copro.immeuble) setImmeubleInput(copro.immeuble)
    setShowCoproSearch(false)
    setCoproSearch('')
  }

  const canSubmit = form.type.trim().length > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    const now = new Date()
    const nomImmeuble = immeubleInput.trim() || form.immeuble || '—'
    const artisanNom = form.artisan || 'le prestataire'

    // Message automatique ordre de mission
    const dateIntervStr = form.dateIntervention
      ? new Date(form.dateIntervention).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'à définir'
    const localisationDetail = [
      form.batiment ? `Bâtiment ${form.batiment}` : null,
      form.etage ? `Étage ${form.etage}` : null,
      form.numLot ? `Appartement / Lot ${form.numLot}` : null,
    ].filter(Boolean).join(' · ')
    const locataireDetail = form.locataire
      ? `\n👤 Locataire : ${form.locataire}${form.telephoneLocataire ? ` — Tél : ${form.telephoneLocataire}` : ''}`
      : ''
    const accesDetail = form.accesLogement ? `\n🔑 Accès : ${form.accesLogement}` : ''

    const heureStr = form.heureIntervention ? ` à ${form.heureIntervention}` : ''

    const msgAuto = `📋 ORDRE DE MISSION — ${form.type}

Bonjour ${artisanNom},

Une intervention vous est assignée :

🏢 Résidence : ${nomImmeuble}${form.adresseImmeuble ? `\n📍 Adresse : ${form.adresseImmeuble}` : ''}${localisationDetail ? `\n📌 ${localisationDetail}` : ''}${locataireDetail}${accesDetail}

🔧 Mission : ${form.description || form.type}
📅 Date d'intervention : ${dateIntervStr}${heureStr}
⚡ Priorité : ${form.priorite === 'urgente' ? '🔴 URGENTE' : form.priorite === 'normale' ? '🔵 Normale' : '⚪ Planifiée'}${form.montantDevis ? `\n💰 Budget estimé : ${Number(form.montantDevis).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} € HT` : ''}

Merci de confirmer la réception de cet ordre de mission en répondant dans ce canal.`

    const autoMsg = { auteur: 'Gestionnaire', role: 'syndic', texte: msgAuto, date: now.toISOString() }

    onAdd({
      ...form,
      immeuble: nomImmeuble,
      montantDevis: form.montantDevis ? Number(form.montantDevis) : undefined,
      dateIntervention: form.dateIntervention || undefined,
      heureIntervention: form.heureIntervention || undefined,
      demandeurEmail: form.emailLocataire || undefined,
      canalMessages: [autoMsg],
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-bold text-[#0D1B2E]">📋 Nouvel ordre de mission</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          <div className="space-y-4">

            {/* ── Auto-remplissage depuis copropriétaire ── */}
            {coproprios.length > 0 && (
              <div className="bg-gradient-to-r from-[#F7F4EE] to-[#F7F4EE] rounded-xl border border-blue-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-blue-800">⚡ Auto-remplissage depuis un copropriétaire</p>
                    <p className="text-xs text-blue-600 mt-0.5">Sélectionnez un copropriétaire pour pré-remplir automatiquement les infos</p>
                  </div>
                  <button
                    onClick={() => setShowCoproSearch(!showCoproSearch)}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold transition"
                  >
                    {showCoproSearch ? '✕ Fermer' : '🔍 Sélectionner'}
                  </button>
                </div>
                {showCoproSearch && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={coproSearch}
                      onChange={e => setCoproSearch(e.target.value)}
                      placeholder="Rechercher par nom, lot, email…"
                      className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                      autoFocus
                    />
                    <div className="mt-1 max-h-40 overflow-y-auto bg-white rounded-lg border border-blue-100 shadow-sm">
                      {filteredCopros.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-3">Aucun résultat</p>
                      ) : filteredCopros.map((c: Coproprio, i: number) => (
                        <button
                          key={c.id || i}
                          onClick={() => autoFillFromCopro(c)}
                          className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition border-b border-gray-50 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">
                                {c.prenomProprietaire ? `${c.prenomProprietaire} ` : ''}{c.nomProprietaire || '—'}
                                {c.nomLocataire && <span className="text-xs text-blue-600 ml-1">(loc. {c.prenomLocataire || ''} {c.nomLocataire})</span>}
                              </p>
                              <p className="text-xs text-gray-500">
                                {c.immeuble && `🏢 ${c.immeuble} · `}
                                {c.batiment && `Bât. ${c.batiment} · `}
                                {c.etage !== undefined && `Ét. ${c.etage} · `}
                                Lot {c.numeroPorte || '—'}
                              </p>
                            </div>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Remplir →</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Prestataire + Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">👷 Artisan / Prestataire</label>
                <select
                  value={form.artisan}
                  onChange={e => {
                    const selected = artisans.find(a => a.nom === e.target.value)
                    const metierToType: Record<string, string> = {
                      'Chauffage / Climatisation': 'Chauffage / Clim',
                      'Jardinage / Espaces verts': 'Espaces verts',
                      'Multi-services': 'Autre',
                    }
                    const TYPES = locale === 'pt'
                      ? ['Canalização', 'Eletricidade', 'Serralharia', 'Pintura', 'Carpintaria', 'Alvenaria', 'Limpeza', 'Elevador', 'Climatização', 'Coberturas', 'Vidraçaria', 'Espaços verdes', 'Outro']
                      : ['Plomberie', 'Électricité', 'Serrurerie', 'Peinture', 'Menuiserie', 'Maçonnerie', 'Nettoyage', 'Ascenseur', 'Chauffage / Clim', 'Toiture', 'Vitrerie', 'Espaces verts', 'Autre']
                    let autoType = form.type
                    if (selected?.metier) {
                      const mapped = metierToType[selected.metier] || selected.metier
                      if (TYPES.includes(mapped)) autoType = mapped
                    }
                    setForm({ ...form, artisan: e.target.value, type: autoType })
                  }}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm"
                >
                  <option value="">— Non assigné —</option>
                  {artisans.filter(a => a.statut === 'actif' || a.statut === 'en_attente').map(a => (
                    <option key={a.id} value={a.nom}>{a.nom} — {a.metier}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🔧 Type de travaux <span className="text-red-500">*</span></label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm"
                >
                  {(locale === 'pt'
                    ? ['Canalização', 'Eletricidade', 'Serralharia', 'Pintura', 'Carpintaria', 'Alvenaria', 'Limpeza', 'Elevador', 'Climatização', 'Coberturas', 'Vidraçaria', 'Espaços verdes', 'Outro']
                    : ['Plomberie', 'Électricité', 'Serrurerie', 'Peinture', 'Menuiserie', 'Maçonnerie', 'Nettoyage', 'Ascenseur', 'Chauffage / Clim', 'Toiture', 'Vitrerie', 'Espaces verts', 'Autre']
                  ).map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Localisation */}
            <div className="bg-blue-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">📍 Localisation</p>
              {/* Résidence */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">Nom de la résidence</label>
                <input
                  type="text"
                  value={immeubleInput}
                  onChange={e => { setImmeubleInput(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Ex : Résidence Les Acacias…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-32 overflow-y-auto">
                    {suggestions.map(s => (
                      <button key={s} onMouseDown={() => { setImmeubleInput(s); setShowSuggestions(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F7F4EE] hover:text-[#C9A84C] transition">🏢 {s}</button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Adresse complète</label>
                <input type="text" value={form.adresseImmeuble} onChange={e => setForm({ ...form, adresseImmeuble: e.target.value })} placeholder="12 rue de la Paix, 75001 Paris" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bâtiment</label>
                  <input type="text" value={form.batiment} onChange={e => setForm({ ...form, batiment: e.target.value })} placeholder="A, B, C…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Étage</label>
                  <input type="text" value={form.etage} onChange={e => setForm({ ...form, etage: e.target.value })} placeholder="2, RDC…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Appart / Lot</label>
                  <input type="text" value={form.numLot} onChange={e => setForm({ ...form, numLot: e.target.value })} placeholder="12, 4B…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Locataire / Occupant</label>
                  <input type="text" value={form.locataire} onChange={e => setForm({ ...form, locataire: e.target.value })} placeholder="Nom (optionnel)" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tél. locataire</label>
                  <input type="tel" value={form.telephoneLocataire} onChange={e => setForm({ ...form, telephoneLocataire: e.target.value })} placeholder="06 XX XX XX XX" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">🔑 Instructions d&apos;accès</label>
                <input type="text" value={form.accesLogement} onChange={e => setForm({ ...form, accesLogement: e.target.value })} placeholder="Code portail, clé gardien…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white" />
              </div>
            </div>

            {/* Description + date + priorité */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📝 Description / Motif <span className="text-gray-500 font-normal text-xs">(optionnel)</span></label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none resize-none text-sm" placeholder="Décrivez l'intervention nécessaire…" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">📅 Date souhaitée</label>
                <input type="date" value={form.dateIntervention} onChange={e => setForm({ ...form, dateIntervention: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">🕐 Heure d&apos;intervention</label>
                <input type="time" value={form.heureIntervention} onChange={e => setForm({ ...form, heureIntervention: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">⚡ Priorité</label>
                <select value={form.priorite} onChange={e => setForm({ ...form, priorite: e.target.value as Mission['priorite'] })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                  <option value="urgente">🔴 Urgente</option>
                  <option value="normale">🔵 Normale</option>
                  <option value="planifiee">⚪ Planifiée</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">💶 Budget € HT</label>
                <input type="number" value={form.montantDevis} onChange={e => setForm({ ...form, montantDevis: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" placeholder="0" min={0} />
              </div>
            </div>

            {/* Email locataire pour notification retour */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">📧 Email locataire / demandeur <span className="text-gray-500 font-normal">(pour la notification de confirmation)</span></label>
              <input type="email" value={form.emailLocataire} onChange={e => setForm({ ...form, emailLocataire: e.target.value })} placeholder="locataire@email.fr" className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
            </div>

            {/* Toggle notification demandeur */}
            <div className={`rounded-xl border-2 p-3 transition ${form.notifierDemandeur ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-[#F7F4EE]'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-800">🔔 Notifier le demandeur à la création</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {form.notifierDemandeur
                      ? 'Un message de confirmation sera envoyé dans le canal du demandeur : "Demande traitée, l\'artisan interviendra le…"'
                      : 'Pas de notification au demandeur'}
                  </p>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, notifierDemandeur: !f.notifierDemandeur }))}
                  className={`flex-shrink-0 w-12 h-6 rounded-full transition relative ${form.notifierDemandeur ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.notifierDemandeur ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Info messages auto */}
            <div className="space-y-2">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <span className="text-amber-500 text-base flex-shrink-0">🔧</span>
                <p className="text-xs text-amber-800">L&apos;artisan <strong>{form.artisan || '…'}</strong> reçoit automatiquement l&apos;ordre de mission complet dans son canal (localisation, accès, date, heure).</p>
              </div>
              {form.notifierDemandeur && (form.locataire || form.emailLocataire) && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-green-500 text-base flex-shrink-0">✅</span>
                  <p className="text-xs text-green-800">
                    <strong>{form.locataire || form.emailLocataire}</strong> recevra dans son canal : <em>&quot;Demande traitée — l&apos;artisan {form.artisan || '…'} interviendra le {form.dateIntervention ? new Date(form.dateIntervention).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : '…'}{form.heureIntervention ? ` à ${form.heureIntervention}` : ''}&quot;</em>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-[#F7F4EE] transition text-sm">
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 bg-[#0D1B2E] hover:bg-[#152338] text-white py-2.5 rounded-lg font-bold transition disabled:opacity-40 text-sm"
            >
              📤 Créer &amp; ouvrir le canal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
