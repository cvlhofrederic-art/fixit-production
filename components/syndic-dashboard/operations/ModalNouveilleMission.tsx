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
  const isPt = locale === 'pt'
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
    type: isPt ? 'Canalização' : 'Plomberie',
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
    const artisanNom = form.artisan || (isPt ? 'o profissional' : 'le prestataire')

    // Message automatique ordre de mission
    const dateIntervStr = form.dateIntervention
      ? new Date(form.dateIntervention).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : (isPt ? 'a definir' : 'à définir')
    const localisationDetail = [
      form.batiment ? (isPt ? `Bloco ${form.batiment}` : `Bâtiment ${form.batiment}`) : null,
      form.etage ? (isPt ? `Andar ${form.etage}` : `Étage ${form.etage}`) : null,
      form.numLot ? (isPt ? `Fração ${form.numLot}` : `Appartement / Lot ${form.numLot}`) : null,
    ].filter(Boolean).join(' · ')
    const locataireDetail = form.locataire
      ? (isPt
          ? `\n👤 Residente : ${form.locataire}${form.telephoneLocataire ? ` — Telemóvel : ${form.telephoneLocataire}` : ''}`
          : `\n👤 Locataire : ${form.locataire}${form.telephoneLocataire ? ` — Tél : ${form.telephoneLocataire}` : ''}`)
      : ''
    const accesDetail = form.accesLogement
      ? (isPt ? `\n🔑 Acesso : ${form.accesLogement}` : `\n🔑 Accès : ${form.accesLogement}`)
      : ''

    const heureStr = form.heureIntervention ? (isPt ? ` às ${form.heureIntervention}` : ` à ${form.heureIntervention}`) : ''

    const msgAuto = isPt
      ? `📋 ORDEM DE MISSÃO — ${form.type}

Olá ${artisanNom},

Foi-lhe atribuída uma intervenção:

🏢 Edifício : ${nomImmeuble}${form.adresseImmeuble ? `\n📍 Morada : ${form.adresseImmeuble}` : ''}${localisationDetail ? `\n📌 ${localisationDetail}` : ''}${locataireDetail}${accesDetail}

🔧 Missão : ${form.description || form.type}
📅 Data da intervenção : ${dateIntervStr}${heureStr}
⚡ Prioridade : ${form.priorite === 'urgente' ? '🔴 URGENTE' : form.priorite === 'normale' ? '🔵 Normal' : '⚪ Planeada'}${form.montantDevis ? `\n💰 Orçamento estimado : ${Number(form.montantDevis).toLocaleString('pt-PT')} € sem IVA` : ''}

Por favor confirme a receção desta ordem de missão respondendo neste canal.`
      : `📋 ORDRE DE MISSION — ${form.type}

Bonjour ${artisanNom},

Une intervention vous est assignée :

🏢 Résidence : ${nomImmeuble}${form.adresseImmeuble ? `\n📍 Adresse : ${form.adresseImmeuble}` : ''}${localisationDetail ? `\n📌 ${localisationDetail}` : ''}${locataireDetail}${accesDetail}

🔧 Mission : ${form.description || form.type}
📅 Date d'intervention : ${dateIntervStr}${heureStr}
⚡ Priorité : ${form.priorite === 'urgente' ? '🔴 URGENTE' : form.priorite === 'normale' ? '🔵 Normale' : '⚪ Planifiée'}${form.montantDevis ? `\n💰 Budget estimé : ${Number(form.montantDevis).toLocaleString('fr-FR')} € HT` : ''}

Merci de confirmer la réception de cet ordre de mission en répondant dans ce canal.`

    const autoMsg = { auteur: isPt ? 'Gestor' : 'Gestionnaire', role: 'syndic', texte: msgAuto, date: now.toISOString() }

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
            <h3 className="text-xl font-bold text-[#0D1B2E]">📋 {isPt ? 'Nova ordem de missão' : 'Nouvel ordre de mission'}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          <div className="space-y-4">

            {/* ── Auto-remplissage depuis copropriétaire ── */}
            {coproprios.length > 0 && (
              <div className="bg-gradient-to-r from-[#F7F4EE] to-[#F7F4EE] rounded-xl border border-[#E4DDD0] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#0D1B2E]">⚡ {isPt ? 'Preenchimento automático a partir de um condómino' : 'Auto-remplissage depuis un copropriétaire'}</p>
                    <p className="text-xs text-[#0D1B2E] opacity-70 mt-0.5">{isPt ? 'Selecione um condómino para preencher automaticamente as informações' : 'Sélectionnez un copropriétaire pour pré-remplir automatiquement les infos'}</p>
                  </div>
                  <button
                    onClick={() => setShowCoproSearch(!showCoproSearch)}
                    className="text-xs bg-[#0D1B2E] hover:bg-[#152338] text-white px-3 py-1.5 rounded-lg font-semibold transition"
                  >
                    {showCoproSearch ? (isPt ? '✕ Fechar' : '✕ Fermer') : (isPt ? '🔍 Selecionar' : '🔍 Sélectionner')}
                  </button>
                </div>
                {showCoproSearch && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={coproSearch}
                      onChange={e => setCoproSearch(e.target.value)}
                      placeholder={locale === 'pt' ? 'Pesquisar por nome, fração, email…' : 'Rechercher par nom, lot, email…'}
                      className="w-full px-3 py-2 text-sm border border-[#E4DDD0] rounded-lg focus:ring-2 focus:ring-[#C9A84C] focus:outline-none bg-white"
                      autoFocus
                    />
                    <div className="mt-1 max-h-40 overflow-y-auto bg-white rounded-lg border border-[#E4DDD0] shadow-sm">
                      {filteredCopros.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-3">{locale === 'pt' ? 'Nenhum resultado' : 'Aucun résultat'}</p>
                      ) : filteredCopros.map((c: Coproprio, i: number) => (
                        <button
                          key={c.id || i}
                          onClick={() => autoFillFromCopro(c)}
                          className="w-full text-left px-3 py-2.5 hover:bg-[#F7F4EE] transition border-b border-gray-50 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">
                                {c.prenomProprietaire ? `${c.prenomProprietaire} ` : ''}{c.nomProprietaire || '—'}
                                {c.nomLocataire && <span className="text-xs text-[#C9A84C] ml-1">(loc. {c.prenomLocataire || ''} {c.nomLocataire})</span>}
                              </p>
                              <p className="text-xs text-gray-500">
                                {c.immeuble && `🏢 ${c.immeuble} · `}
                                {c.batiment && `${isPt ? 'Bloco' : 'Bât.'} ${c.batiment} · `}
                                {c.etage !== undefined && `${isPt ? 'Andar' : 'Ét.'} ${c.etage} · `}
                                {isPt ? 'Fração' : 'Lot'} {c.numeroPorte || '—'}
                              </p>
                            </div>
                            <span className="text-xs bg-[#F7F4EE] text-[#0D1B2E] border border-[#E4DDD0] px-2 py-0.5 rounded-full">{isPt ? 'Preencher →' : 'Remplir →'}</span>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">👷 {isPt ? 'Profissional / Prestador' : 'Artisan / Prestataire'}</label>
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
                  <option value="">— {isPt ? 'Por atribuir' : 'Non assigné'} —</option>
                  {artisans.filter(a => a.statut === 'actif' || a.statut === 'en_attente').map(a => (
                    <option key={a.id} value={a.nom}>{a.nom} — {a.metier}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🔧 {isPt ? 'Tipo de trabalhos' : 'Type de travaux'} <span className="text-red-500">*</span></label>
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
            <div className="bg-[#F7F4EE] rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wide">📍 {isPt ? 'Localização' : 'Localisation'}</p>
              {/* Résidence */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">{isPt ? 'Nome do edifício' : 'Nom de la résidence'}</label>
                <input
                  type="text"
                  value={immeubleInput}
                  onChange={e => { setImmeubleInput(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder={isPt ? 'Ex : Edifício As Acácias…' : 'Ex : Résidence Les Acacias…'}
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
                <label className="block text-xs font-medium text-gray-700 mb-1">{isPt ? 'Morada completa' : 'Adresse complète'}</label>
                <input type="text" value={form.adresseImmeuble} onChange={e => setForm({ ...form, adresseImmeuble: e.target.value })} placeholder={isPt ? 'Rua de Santa Catarina 100, 4000-447 Porto' : '12 rue de la Paix, 75001 Paris'} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{isPt ? 'Bloco' : 'Bâtiment'}</label>
                  <input type="text" value={form.batiment} onChange={e => setForm({ ...form, batiment: e.target.value })} placeholder="A, B, C…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{isPt ? 'Andar' : 'Étage'}</label>
                  <input type="text" value={form.etage} onChange={e => setForm({ ...form, etage: e.target.value })} placeholder={isPt ? '2, R/C…' : '2, RDC…'} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{isPt ? 'Fração' : 'Appart / Lot'}</label>
                  <input type="text" value={form.numLot} onChange={e => setForm({ ...form, numLot: e.target.value })} placeholder="12, 4B…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{isPt ? 'Residente / Ocupante' : 'Locataire / Occupant'}</label>
                  <input type="text" value={form.locataire} onChange={e => setForm({ ...form, locataire: e.target.value })} placeholder={isPt ? 'Nome (opcional)' : 'Nom (optionnel)'} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{isPt ? 'Telemóvel residente' : 'Tél. locataire'}</label>
                  <input type="tel" value={form.telephoneLocataire} onChange={e => setForm({ ...form, telephoneLocataire: e.target.value })} placeholder={isPt ? '9X XXX XX XX' : '06 XX XX XX XX'} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">🔑 {isPt ? 'Instruções de acesso' : 'Instructions d\'accès'}</label>
                <input type="text" value={form.accesLogement} onChange={e => setForm({ ...form, accesLogement: e.target.value })} placeholder={isPt ? 'Código do portão, chave do porteiro…' : 'Code portail, clé gardien…'} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white" />
              </div>
            </div>

            {/* Description + date + priorité */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📝 {isPt ? 'Descrição / Motivo' : 'Description / Motif'} <span className="text-gray-500 font-normal text-xs">{isPt ? '(opcional)' : '(optionnel)'}</span></label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none resize-none text-sm" placeholder={isPt ? 'Descreva a intervenção necessária…' : 'Décrivez l\'intervention nécessaire…'} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">📅 {isPt ? 'Data desejada' : 'Date souhaitée'}</label>
                <input type="date" value={form.dateIntervention} onChange={e => setForm({ ...form, dateIntervention: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">🕐 {isPt ? 'Hora da intervenção' : 'Heure d\'intervention'}</label>
                <input type="time" value={form.heureIntervention} onChange={e => setForm({ ...form, heureIntervention: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">⚡ {isPt ? 'Prioridade' : 'Priorité'}</label>
                <select value={form.priorite} onChange={e => setForm({ ...form, priorite: e.target.value as Mission['priorite'] })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                  <option value="urgente">{isPt ? '🔴 Urgente' : '🔴 Urgente'}</option>
                  <option value="normale">{isPt ? '🔵 Normal' : '🔵 Normale'}</option>
                  <option value="planifiee">{isPt ? '⚪ Planeada' : '⚪ Planifiée'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">💶 {isPt ? 'Orçamento € sem IVA' : 'Budget € HT'}</label>
                <input type="number" value={form.montantDevis} onChange={e => setForm({ ...form, montantDevis: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" placeholder="0" min={0} />
              </div>
            </div>

            {/* Email locataire pour notification retour */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">📧 {isPt ? 'Email do residente / solicitante' : 'Email locataire / demandeur'} <span className="text-gray-500 font-normal">{isPt ? '(para a notificação de confirmação)' : '(pour la notification de confirmation)'}</span></label>
              <input type="email" value={form.emailLocataire} onChange={e => setForm({ ...form, emailLocataire: e.target.value })} placeholder={isPt ? 'residente@email.pt' : 'locataire@email.fr'} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
            </div>

            {/* Toggle notification demandeur */}
            <div className={`rounded-xl border-2 p-3 transition ${form.notifierDemandeur ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-[#F7F4EE]'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-800">🔔 {isPt ? 'Notificar o solicitante na criação' : 'Notifier le demandeur à la création'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {form.notifierDemandeur
                      ? (isPt
                          ? 'Será enviada uma mensagem de confirmação no canal do solicitante: "Pedido tratado, o profissional intervirá no dia…"'
                          : 'Un message de confirmation sera envoyé dans le canal du demandeur : "Demande traitée, l\'artisan interviendra le…"')
                      : (isPt ? 'Sem notificação ao solicitante' : 'Pas de notification au demandeur')}
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
                <p className="text-xs text-amber-800">{isPt
                  ? <>O profissional <strong>{form.artisan || '…'}</strong> recebe automaticamente a ordem de missão completa no seu canal (localização, acesso, data, hora).</>
                  : <>L&apos;artisan <strong>{form.artisan || '…'}</strong> reçoit automatiquement l&apos;ordre de mission complet dans son canal (localisation, accès, date, heure).</>}</p>
              </div>
              {form.notifierDemandeur && (form.locataire || form.emailLocataire) && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-green-500 text-base flex-shrink-0">✅</span>
                  <p className="text-xs text-green-800">
                    {isPt
                      ? <><strong>{form.locataire || form.emailLocataire}</strong> receberá no seu canal: <em>&quot;Pedido tratado — o profissional {form.artisan || '…'} intervirá no dia {form.dateIntervention ? new Date(form.dateIntervention).toLocaleDateString('pt-PT') : '…'}{form.heureIntervention ? ` às ${form.heureIntervention}` : ''}&quot;</em></>
                      : <><strong>{form.locataire || form.emailLocataire}</strong> recevra dans son canal : <em>&quot;Demande traitée — l&apos;artisan {form.artisan || '…'} interviendra le {form.dateIntervention ? new Date(form.dateIntervention).toLocaleDateString('fr-FR') : '…'}{form.heureIntervention ? ` à ${form.heureIntervention}` : ''}&quot;</em></>}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-[#F7F4EE] transition text-sm">
              {isPt ? 'Cancelar' : 'Annuler'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 bg-[#0D1B2E] hover:bg-[#152338] text-white py-2.5 rounded-lg font-bold transition disabled:opacity-40 text-sm"
            >
              📤 {isPt ? 'Criar & abrir o canal' : 'Créer & ouvrir le canal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
