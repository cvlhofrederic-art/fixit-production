'use client'

import { useState, useEffect } from 'react'
import type { Immeuble } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'

export default function EcheancesSection({ user, userRole, immeubles }: { user: any; userRole: string; immeubles: Immeuble[] }) {
  const { t } = useTranslation()
  const locale = useLocale()
  type EcheanceType = 'inspection_ascenseur' | 'ramonage' | 'controle_elec' | 'dta' | 'dtg' | 'pppt' | 'ag_annuelle' | 'verification_extincteurs' | 'controle_gaz' | 'assurance_immeuble' | 'audit_energetique' | 'revision_budget'
  interface Echeance {
    id: string; type: EcheanceType; label: string; description: string
    immeuble_id: string; immeuble_nom: string; date_echeance: string
    periodicite_ans: number; statut: 'fait' | 'a_faire'; notes: string
    date_realisation?: string; prestataire?: string; added_at: string
  }
  const TYPES: { key: EcheanceType; label: string; icon: string; desc: string; periodicite: number; obligatoire: boolean; refs: string }[] = [
    { key: 'ag_annuelle', label: 'AG annuelle', icon: '🏛️', desc: 'Assemblée Générale ordinaire annuelle', periodicite: 1, obligatoire: true, refs: 'Art. 7 Décret n°67-223 du 17/03/1967' },
    { key: 'revision_budget', label: 'Budget prévisionnel', icon: '💶', desc: 'Vote du budget en Assemblée Générale', periodicite: 1, obligatoire: true, refs: 'Art. 14-1 Loi n°65-557 du 10/07/1965' },
    { key: 'verification_extincteurs', label: 'Vérification extincteurs', icon: '🧯', desc: 'Contrôle annuel obligatoire', periodicite: 1, obligatoire: true, refs: 'Code du travail R.4227-38' },
    { key: 'assurance_immeuble', label: 'Renouvellement assurance', icon: '🛡️', desc: 'Assurance multirisque immeuble', periodicite: 1, obligatoire: true, refs: 'Loi du 13/07/1965 — Art. 9-1' },
    { key: 'controle_gaz', label: 'Contrôle installations gaz', icon: '🔌', desc: 'Révision chaudière collective + réseau gaz', periodicite: 1, obligatoire: false, refs: 'Arrêtés 02/08/1977 et 23/06/1978' },
    { key: 'ramonage', label: 'Ramonage cheminées', icon: '🔥', desc: 'Obligatoire 2x/an pour conduits collectifs', periodicite: 0.5, obligatoire: true, refs: 'Arrêté du 22/10/1969' },
    { key: 'inspection_ascenseur', label: 'Inspection ascenseur', icon: '🛗', desc: 'Contrôle obligatoire quinquennal', periodicite: 5, obligatoire: true, refs: 'Décret n°2004-964 du 09/09/2004' },
    { key: 'controle_elec', label: 'Contrôle électrique', icon: '⚡', desc: 'Parties communes — NF C 15-100', periodicite: 5, obligatoire: true, refs: 'NF C 15-100 + décret du 14/06/1969' },
    { key: 'dta', label: 'DTA (amiante)', icon: '⚠️', desc: 'Dossier Technique Amiante — vérification', periodicite: 3, obligatoire: true, refs: 'Code de la santé pub. L.1334-13' },
    { key: 'dtg', label: 'DTG', icon: '🏗️', desc: 'Diagnostic Technique Global', periodicite: 10, obligatoire: true, refs: 'Loi ALUR art. 58 — > 10 ans' },
    { key: 'pppt', label: 'Plan Pluriannuel Travaux', icon: '🔨', desc: 'PPT obligatoire pour immeubles > 15 ans', periodicite: 10, obligatoire: true, refs: 'Loi Climat & Résilience 2022' },
    { key: 'audit_energetique', label: 'Audit énergétique DPE', icon: '🌿', desc: 'DPE collectif et audit énergétique', periodicite: 10, obligatoire: false, refs: 'Loi ELAN 2018 — Décret 2021-919' },
  ]
  const storageKey = `fixit_echeances_${user.id}`
  const [echeances, setEcheances] = useState<Echeance[]>([])
  const [filterImmeuble, setFilterImmeuble] = useState('tous')
  const [filterStatut, setFilterStatut] = useState('tous')
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({ type: 'ag_annuelle' as EcheanceType, immeuble_id: '', date_echeance: '', notes: '', prestataire: '' })
  const [selectedE, setSelectedE] = useState<Echeance | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) try { setEcheances(JSON.parse(saved)) } catch {}
  }, [storageKey])

  const save = (list: Echeance[]) => { setEcheances(list); localStorage.setItem(storageKey, JSON.stringify(list)) }

  const addEcheance = () => {
    if (!formData.immeuble_id || !formData.date_echeance) return
    const typeInfo = TYPES.find(t => t.key === formData.type)!
    const imm = immeubles.find(i => i.id === formData.immeuble_id)!
    save([...echeances, { id: Date.now().toString(36), type: formData.type, label: typeInfo.label, description: typeInfo.desc, immeuble_id: formData.immeuble_id, immeuble_nom: imm.nom, date_echeance: formData.date_echeance, periodicite_ans: typeInfo.periodicite, statut: 'a_faire', notes: formData.notes, prestataire: formData.prestataire, added_at: new Date().toISOString() }])
    setShowAddModal(false)
    setFormData({ type: 'ag_annuelle', immeuble_id: '', date_echeance: '', notes: '', prestataire: '' })
  }

  const markDone = (id: string) => save(echeances.map(e => e.id === id ? { ...e, statut: 'fait' as const, date_realisation: new Date().toISOString().split('T')[0] } : e))
  const deleteE = (id: string) => save(echeances.filter(e => e.id !== id))

  const autoInit = () => {
    const newOnes: Echeance[] = []
    immeubles.forEach(imm => {
      TYPES.filter(t => t.obligatoire).forEach(t => {
        if (echeances.some(e => e.immeuble_id === imm.id && e.type === t.key)) return
        const next = new Date()
        next.setMonth(next.getMonth() + Math.floor(t.periodicite * 12))
        newOnes.push({ id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`, type: t.key, label: t.label, description: t.desc, immeuble_id: imm.id, immeuble_nom: imm.nom, date_echeance: next.toISOString().split('T')[0], periodicite_ans: t.periodicite, statut: 'a_faire', notes: '', added_at: new Date().toISOString() })
      })
    })
    if (newOnes.length > 0) save([...echeances, ...newOnes])
  }

  const getDaysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  const getColor = (e: Echeance) => {
    if (e.statut === 'fait') return 'bg-green-100 text-green-700 border-green-200'
    const d = getDaysLeft(e.date_echeance)
    if (d < 0) return 'bg-red-100 text-red-700 border-red-200'
    if (d < 30) return 'bg-orange-100 text-orange-700 border-orange-200'
    if (d < 90) return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-[#F7F4EE] text-gray-600 border-gray-200'
  }
  const getLabel = (e: Echeance) => {
    if (e.statut === 'fait') return `✓ ${t('syndicDash.echeances.completed')}`
    const d = getDaysLeft(e.date_echeance)
    if (d < 0) return `⚠ ${t('syndicDash.echeances.overdueBy')} (${Math.abs(d)}${t('syndicDash.echeances.days')})`
    if (d === 0) return `📍 ${t('syndicDash.echeances.today')}`
    return `${t('syndicDash.echeances.inDays')} ${d}${t('syndicDash.echeances.days')}`
  }

  const filtered = echeances
    .filter(e => filterImmeuble === 'tous' || e.immeuble_id === filterImmeuble)
    .filter(e => {
      if (filterStatut === 'tous') return true
      if (filterStatut === 'urgent') return e.statut !== 'fait' && getDaysLeft(e.date_echeance) < 30 && getDaysLeft(e.date_echeance) >= 0
      if (filterStatut === 'en_retard') return e.statut !== 'fait' && getDaysLeft(e.date_echeance) < 0
      if (filterStatut === 'fait') return e.statut === 'fait'
      return true
    })
    .sort((a, b) => a.statut === 'fait' && b.statut !== 'fait' ? 1 : b.statut === 'fait' && a.statut !== 'fait' ? -1 : new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime())

  const urgentC = echeances.filter(e => e.statut !== 'fait' && getDaysLeft(e.date_echeance) < 30 && getDaysLeft(e.date_echeance) >= 0).length
  const retardC = echeances.filter(e => e.statut !== 'fait' && getDaysLeft(e.date_echeance) < 0).length

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0D1B2E]">📅 {t('syndicDash.echeances.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('syndicDash.echeances.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {immeubles.length > 0 && <button onClick={autoInit} className="px-4 py-2 bg-[#F7F4EE] text-[#C9A84C] rounded-xl text-sm font-semibold hover:bg-[#F7F4EE] transition">⚡ {t('syndicDash.echeances.autoInit')}</button>}
          <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] transition">{t('syndicDash.echeances.add')}</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: t('syndicDash.echeances.total'), val: echeances.length, cls: 'bg-[#F7F4EE] border-gray-200 text-gray-800' },
          { label: t('syndicDash.echeances.overdue'), val: retardC, cls: 'bg-red-50 border-red-200 text-red-700' },
          { label: t('syndicDash.echeances.urgent30'), val: urgentC, cls: 'bg-orange-50 border-orange-200 text-orange-700' },
          { label: t('syndicDash.echeances.done'), val: echeances.filter(e => e.statut === 'fait').length, cls: 'bg-green-50 border-green-200 text-green-700' },
        ].map(k => (
          <div key={k.label} className={`border rounded-xl p-3 text-center ${k.cls}`}>
            <p className="text-2xl font-bold">{k.val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <select value={filterImmeuble} onChange={e => setFilterImmeuble(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#C9A84C]">
          <option value="tous">{t('syndicDash.echeances.allBuildings')}</option>
          {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#C9A84C]">
          <option value="tous">{t('syndicDash.echeances.allStatuses')}</option>
          <option value="en_retard">{t('syndicDash.echeances.statusOverdue')}</option>
          <option value="urgent">{t('syndicDash.echeances.statusUrgent')}</option>
          <option value="a_faire">{t('syndicDash.echeances.statusTodo')}</option>
          <option value="fait">{t('syndicDash.echeances.statusDone')}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <div className="text-5xl mb-3">📅</div>
          <h3 className="font-bold text-gray-700 mb-1">{t('syndicDash.echeances.noDeadline')}</h3>
          <p className="text-sm text-gray-500 mb-4">{t('syndicDash.echeances.noDeadlineDesc')}</p>
          {immeubles.length > 0 && <button onClick={autoInit} className="px-4 py-2 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold">⚡ {t('syndicDash.echeances.autoGenerate')}</button>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <div key={e.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:border-[#E4DDD0] transition cursor-pointer" onClick={() => setSelectedE(e)}>
              <div className="text-2xl flex-shrink-0">{TYPES.find(t => t.key === e.type)?.icon || '📋'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-800 text-sm">{e.label}</p>
                  <span className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-2 py-0.5 rounded-full border border-[#E4DDD0]">{e.immeuble_nom}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{new Date(e.date_echeance).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}{e.prestataire ? ` · ${e.prestataire}` : ''}</p>
              </div>
              <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex-shrink-0 ${getColor(e)}`}>{getLabel(e)}</div>
              <div className="flex gap-1 flex-shrink-0" onClick={ev => ev.stopPropagation()}>
                {e.statut !== 'fait' && <button onClick={() => markDone(e.id)} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200 transition">✓</button>}
                <button onClick={() => deleteE(e.id)} className="px-2 py-1.5 text-red-400 hover:text-red-600 text-xs">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">{t('syndicDash.echeances.newDeadline')}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.echeances.obligationType')}</label>
                <select value={formData.type} onChange={e => setFormData(f => ({ ...f, type: e.target.value as EcheanceType }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]">
                  {TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}{t.obligatoire ? ' *' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.echeances.building')}</label>
                <select value={formData.immeuble_id} onChange={e => setFormData(f => ({ ...f, immeuble_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]">
                  <option value="">{t('syndicDash.echeances.select')}</option>
                  {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.echeances.deadlineDate')}</label>
                <input type="date" value={formData.date_echeance} onChange={e => setFormData(f => ({ ...f, date_echeance: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.echeances.provider')}</label>
                <input type="text" placeholder={t('syndicDash.echeances.providerPlaceholder')} value={formData.prestataire} onChange={e => setFormData(f => ({ ...f, prestataire: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.echeances.notes')}</label>
                <textarea rows={2} value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C] resize-none" placeholder={t('syndicDash.echeances.notesPlaceholder')} />
              </div>
              {formData.type && <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">📖 {TYPES.find(t => t.key === formData.type)?.refs}</div>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-[#F7F4EE]">{t('syndicDash.echeances.cancel')}</button>
              <button onClick={addEcheance} disabled={!formData.immeuble_id || !formData.date_echeance} className="flex-1 px-4 py-2 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] disabled:opacity-60">{t('syndicDash.echeances.addBtn')}</button>
            </div>
          </div>
        </div>
      )}

      {selectedE && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedE(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={ev => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">{TYPES.find(t => t.key === selectedE.type)?.icon} {selectedE.label}</h3>
              <button onClick={() => setSelectedE(null)} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F7F4EE] rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">{t('syndicDash.echeances.building')}</p><p className="font-semibold">{selectedE.immeuble_nom}</p></div>
                <div className="bg-[#F7F4EE] rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">{t('syndicDash.echeances.deadline')}</p><p className="font-semibold">{new Date(selectedE.date_echeance).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</p></div>
                {selectedE.prestataire && <div className="bg-[#F7F4EE] rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">{t('syndicDash.echeances.providerLabel')}</p><p className="font-semibold">{selectedE.prestataire}</p></div>}
                {selectedE.date_realisation && <div className="bg-green-50 rounded-xl p-3"><p className="text-xs text-green-600 mb-1">{t('syndicDash.echeances.completedOn')}</p><p className="font-semibold text-green-700">{new Date(selectedE.date_realisation).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</p></div>}
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-600 mb-1 font-semibold">{t('syndicDash.echeances.legalBasis')}</p>
                <p className="text-blue-800">{TYPES.find(t => t.key === selectedE.type)?.refs}</p>
                <p className="text-blue-600 mt-1 text-xs">{selectedE.description}</p>
              </div>
              {selectedE.notes && <div className="bg-[#F7F4EE] rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">{t('syndicDash.echeances.notes')}</p><p className="text-gray-700">{selectedE.notes}</p></div>}
            </div>
            <div className="flex gap-2 mt-4">
              {selectedE.statut !== 'fait' && <button onClick={() => { markDone(selectedE.id); setSelectedE(null) }} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">✓ {t('syndicDash.echeances.markDone')}</button>}
              <button onClick={() => { deleteE(selectedE.id); setSelectedE(null) }} className="px-4 py-2 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50">🗑️</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
