'use client'

import { useState, useEffect } from 'react'
import type { Immeuble, EcheanceReglementaire, TypeEcheance } from '../types'
import { ECHEANCE_CONFIG, STATUT_ECHEANCE_CONFIG, getStatutEcheance } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'

export default function CalendrierReglementaireSection({ immeubles, userId }: { immeubles: Immeuble[]; userId?: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const ecKey = userId ? `fixit_cal_regl_${userId}` : 'fixit_cal_regl_local'
  const FAKE_ECH_IDS = ['1','2','3','4','5','6','7','8']
  const [echeances, setEcheances] = useState<EcheanceReglementaire[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(ecKey)
      if (!raw) return []
      const parsed: EcheanceReglementaire[] = JSON.parse(raw)
      // Purge des fausses échéances demo (IDs '1'-'8')
      const hasFake = parsed.some(e => FAKE_ECH_IDS.includes(String(e.id)))
      if (hasFake) { localStorage.removeItem(ecKey); return [] }
      return parsed
    } catch { return [] }
  })
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Partial<EcheanceReglementaire>>({ immeuble: '', type: 'autre', label: '', dateEcheance: '', periodicite: 1 })

  // Persister dans localStorage à chaque changement
  useEffect(() => {
    try { localStorage.setItem(ecKey, JSON.stringify(echeances)) } catch {}
  }, [echeances, ecKey])

  const filtered = echeances.filter(e => {
    const matchImm = !filterImmeuble || e.immeuble === filterImmeuble
    const statut = getStatutEcheance(e.dateEcheance)
    const matchStatut = !filterStatut || statut === filterStatut
    return matchImm && matchStatut
  }).sort((a, b) => new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime())

  const stats = {
    expire: echeances.filter(e => getStatutEcheance(e.dateEcheance) === 'expire').length,
    urgent: echeances.filter(e => getStatutEcheance(e.dateEcheance) === 'urgent').length,
    proche: echeances.filter(e => getStatutEcheance(e.dateEcheance) === 'proche').length,
    ok:     echeances.filter(e => getStatutEcheance(e.dateEcheance) === 'ok').length,
  }

  const handleAdd = () => {
    if (!form.label || !form.immeuble || !form.dateEcheance) return
    setEcheances(prev => [...prev, { ...form, id: Date.now().toString() } as EcheanceReglementaire])
    setShowModal(false)
    setForm({ immeuble: '', type: 'autre', label: '', dateEcheance: '', periodicite: 1 })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-gray-500 text-sm">{t('syndicDash.calendrier.subtitle')}</p>
        <div className="flex gap-2">
          <select value={filterImmeuble} onChange={e => setFilterImmeuble(e.target.value)} className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm bg-white focus:border-[#C9A84C] focus:outline-none">
            <option value="">{t('syndicDash.calendrier.allBuildings')}</option>
            {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
          </select>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm bg-white focus:border-[#C9A84C] focus:outline-none">
            <option value="">{t('syndicDash.calendrier.allStatuses')}</option>
            <option value="expire">🔴 {t('syndicDash.calendrier.expired')}</option>
            <option value="urgent">🟠 {t('syndicDash.calendrier.urgent')}</option>
            <option value="proche">🟡 {t('syndicDash.calendrier.close')}</option>
            <option value="ok">🟢 {t('syndicDash.calendrier.ok')}</option>
          </select>
          <button onClick={() => setShowModal(true)} className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-4 py-2 rounded-lg text-sm font-semibold transition">+ {t('syndicDash.calendrier.addBtn')}</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {([['expire', '🔴', t('syndicDash.calendrier.expiredLabel')], ['urgent', '🟠', t('syndicDash.calendrier.urgentLabel')], ['proche', '🟡', t('syndicDash.calendrier.closeLabel')], ['ok', '🟢', t('syndicDash.calendrier.okLabel')]] as [string, string, string][]).map(([key, emoji, label]) => (
          <button key={key} onClick={() => setFilterStatut(filterStatut === key ? '' : key)}
            className={`rounded-xl border-2 p-3 text-left transition hover:shadow-sm ${STATUT_ECHEANCE_CONFIG[key as keyof typeof STATUT_ECHEANCE_CONFIG].color} ${filterStatut === key ? 'ring-2 ring-[#C9A84C]' : ''}`}>
            <div className="text-xl mb-0.5">{emoji}</div>
            <div className="text-xl font-bold">{(stats as any)[key]}</div>
            <div className="text-xs">{label}</div>
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-[#F7F4EE] text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <div className="col-span-3">{t('syndicDash.calendrier.building')}</div>
          <div className="col-span-3">{t('syndicDash.calendrier.type')}</div>
          <div className="col-span-2">{t('syndicDash.calendrier.label')}</div>
          <div className="col-span-2">{t('syndicDash.calendrier.deadline')}</div>
          <div className="col-span-1">{t('syndicDash.calendrier.status')}</div>
          <div className="col-span-1"></div>
        </div>
        {filtered.map(e => {
          const statut = getStatutEcheance(e.dateEcheance)
          const sConfig = STATUT_ECHEANCE_CONFIG[statut]
          const tConfig = ECHEANCE_CONFIG[e.type]
          const daysLeft = Math.ceil((new Date(e.dateEcheance).getTime() - Date.now()) / 86400000)
          return (
            <div key={e.id} className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-50 hover:bg-[#F7F4EE] group items-center ${statut === 'expire' ? 'bg-red-50/40' : statut === 'urgent' ? 'bg-orange-50/30' : ''}`}>
              <div className="col-span-3 text-sm font-medium text-gray-800 truncate">{e.immeuble}</div>
              <div className="col-span-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${tConfig.color}`}>{tConfig.emoji} {tConfig.label}</span></div>
              <div className="col-span-2 text-sm text-gray-600 truncate">{e.label}</div>
              <div className="col-span-2">
                <p className="text-sm font-semibold text-[#0D1B2E]">{new Date(e.dateEcheance).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
                <p className="text-xs text-gray-500">{daysLeft < 0 ? `${t('syndicDash.calendrier.daysAgo')} ${Math.abs(daysLeft)}${t('syndicDash.calendrier.days')}` : `${t('syndicDash.calendrier.inDays')} ${daysLeft}${t('syndicDash.calendrier.days')}`}</p>
              </div>
              <div className="col-span-1 flex justify-center">
                <div className={`w-2.5 h-2.5 rounded-full ${sConfig.dot}`} title={sConfig.label} />
              </div>
              <div className="col-span-1 flex justify-center">
                <button
                  onClick={() => { if (window.confirm(t('syndicDash.calendrier.deleteConfirm'))) setEcheances(prev => prev.filter(x => x.id !== e.id)) }}
                  className="opacity-0 group-hover:opacity-100 transition text-gray-500 hover:text-red-500 text-sm p-1 rounded"
                  title={t('syndicDash.calendrier.deleteConfirm')}
                >🗑️</button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <div className="text-center py-10 text-gray-500 text-sm">{t('syndicDash.calendrier.noDeadline')}</div>}
      </div>

      {/* Modal ajout */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#0D1B2E] mb-4">{t('syndicDash.calendrier.addDeadline')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{t('syndicDash.calendrier.buildingLabel')}</label>
                <select value={form.immeuble} onChange={e => setForm({ ...form, immeuble: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                  <option value="">{t('syndicDash.calendrier.select')}</option>
                  {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{t('syndicDash.calendrier.typeLabel')}</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as TypeEcheance })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                  {(Object.entries(ECHEANCE_CONFIG) as [TypeEcheance, any][]).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{t('syndicDash.calendrier.labelField')}</label>
                <input type="text" value={form.label || ''} onChange={e => setForm({ ...form, label: e.target.value })} placeholder={t('syndicDash.calendrier.labelPlaceholder')} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{t('syndicDash.calendrier.deadlineDate')}</label>
                  <input type="date" value={form.dateEcheance || ''} onChange={e => setForm({ ...form, dateEcheance: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{t('syndicDash.calendrier.periodicity')}</label>
                  <input type="number" min={1} value={form.periodicite || 1} onChange={e => setForm({ ...form, periodicite: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-[#F7F4EE] transition text-sm">{t('syndicDash.calendrier.cancel')}</button>
              <button onClick={handleAdd} disabled={!form.label || !form.immeuble || !form.dateEcheance} className="flex-1 bg-[#0D1B2E] hover:bg-[#152338] text-white py-2.5 rounded-lg font-bold transition disabled:opacity-60 text-sm">{t('syndicDash.calendrier.addBtn')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
