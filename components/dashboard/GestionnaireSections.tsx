'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'

/* ========== IMMEUBLES GESTIONNAIRE SECTION ========== */
export function ImmeublesGestionnaireSection({ artisan }: { artisan: any }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const storageKey = `fixit_imm_gest_${artisan?.id}`
  const [immeubles, setImmeubles] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nom: '', adresse: '', lots: '', anneeConstruction: '', syndic: '', gestionnaire: '', typeImmeuble: t('proDash.gestionnaire.immeubles.residentiels_types'), charges: '', notes: '' })

  const handleSave = () => {
    if (!form.nom.trim()) return
    const i = { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }
    const updated = [i, ...immeubles]
    setImmeubles(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ nom: '', adresse: '', lots: '', anneeConstruction: '', syndic: '', gestionnaire: '', typeImmeuble: t('proDash.gestionnaire.immeubles.residentiels_types'), charges: '', notes: '' })
  }

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-green-500 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-semibold">{'🏢'} {t('proDash.gestionnaire.immeubles.title')}</h1>
        <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700 transition shadow-sm">{t('proDash.gestionnaire.immeubles.nouvelImmeuble')}</button>
      </div>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-500">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.gestionnaire.immeubles.immeublesGeres')}</div>
            <div className="text-3xl font-bold text-green-600">{immeubles.length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-500">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.gestionnaire.immeubles.totalLots')}</div>
            <div className="text-3xl font-bold text-blue-600">{immeubles.reduce((s, i) => s + (parseInt(i.lots) || 0), 0)}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-amber-500">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.gestionnaire.immeubles.residentiels')}</div>
            <div className="text-3xl font-bold text-amber-600">{immeubles.filter(i => i.typeImmeuble === t('proDash.gestionnaire.immeubles.residentiels_types')).length}</div>
          </div>
        </div>

        {immeubles.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">{'🏢'}</div>
            <h3 className="text-xl font-bold mb-2">{t('proDash.gestionnaire.immeubles.aucunImmeuble')}</h3>
            <p className="text-gray-500 mb-6">{t('proDash.gestionnaire.immeubles.ajoutezImmeubles')}</p>
            <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition">{t('proDash.gestionnaire.immeubles.ajouterImmeuble')}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {immeubles.map(im => (
              <div key={im.id} className="bg-white rounded-2xl shadow-sm p-6 border-2 border-gray-100 hover:border-green-200 transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{im.nom}</h3>
                    <span className="text-sm text-green-600">{im.typeImmeuble}</span>
                  </div>
                  <span className="bg-green-50 text-green-700 px-2 py-1 rounded-lg text-xs font-bold">{im.lots || 0} {t('proDash.gestionnaire.immeubles.lots')}</span>
                </div>
                {im.adresse && <p className="text-sm text-gray-600 mb-1">{'📍'} {im.adresse}</p>}
                {im.anneeConstruction && <p className="text-sm text-gray-600 mb-1">{'🏗️'} {t('proDash.gestionnaire.immeubles.construitEn')} {im.anneeConstruction}</p>}
                {im.syndic && <p className="text-sm text-gray-600 mb-1">{'🤝'} {t('proDash.gestionnaire.immeubles.syndic')} : {im.syndic}</p>}
                {im.charges && <p className="text-sm text-gray-600">{'💰'} {t('proDash.gestionnaire.immeubles.chargesParMois')} {im.charges} €/{locale === 'pt' ? 'mês' : 'mois'}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{'🏢'} {t('proDash.gestionnaire.immeubles.nouvelImmeubleModal')}</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.nomResidence')}</label>
                <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder={t('proDash.gestionnaire.immeubles.nomResidencePlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.type')}</label>
                  <select value={form.typeImmeuble} onChange={e => setForm({...form, typeImmeuble: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none">
                    {[t('proDash.gestionnaire.immeubles.residentiels_types'), t('proDash.gestionnaire.immeubles.commercial'), t('proDash.gestionnaire.immeubles.mixte'), t('proDash.gestionnaire.immeubles.bureaux')].map(tp => <option key={tp}>{tp}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.nombreLots')}</label>
                  <input type="number" value={form.lots} onChange={e => setForm({...form, lots: e.target.value})} placeholder="12" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.adresse')}</label>
                <input value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder={t('proDash.gestionnaire.immeubles.adressePlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.anneeConstruction')}</label>
                  <input type="number" value={form.anneeConstruction} onChange={e => setForm({...form, anneeConstruction: e.target.value})} placeholder="1985" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.charges')}</label>
                  <input type="number" value={form.charges} onChange={e => setForm({...form, charges: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.syndic')}</label>
                <input value={form.syndic} onChange={e => setForm({...form, syndic: e.target.value})} placeholder={t('proDash.gestionnaire.immeubles.syndicPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder={t('proDash.gestionnaire.immeubles.notesPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none resize-none" />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">{t('proDash.gestionnaire.immeubles.annuler')}</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition">{t('proDash.gestionnaire.immeubles.enregistrer')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ========== MISSIONS GESTIONNAIRE SECTION ========== */
export function MissionsGestionnaireSection({ artisan, bookings }: { artisan: any; bookings: any[] }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const storageKey = `fixit_missions_gest_${artisan?.id}`
  const [missions, setMissions] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<string>(t('proDash.gestionnaire.missions.toutes'))
  const [form, setForm] = useState({ titre: '', immeuble: '', lot: '', locataire: '', type: 'Plomberie', priorite: 'normale', description: '', artisan: '', dateIntervention: '', devis: '' })

  const handleSave = () => {
    if (!form.titre.trim() && !form.type.trim()) return
    const m = { id: Date.now().toString(), ...form, statut: t('proDash.gestionnaire.missions.enAttente'), createdAt: new Date().toISOString() }
    const updated = [m, ...missions]
    setMissions(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ titre: '', immeuble: '', lot: '', locataire: '', type: 'Plomberie', priorite: 'normale', description: '', artisan: '', dateIntervention: '', devis: '' })
  }

  const changeStatut = (id: string, statut: string) => {
    const updated = missions.map(m => m.id === id ? { ...m, statut } : m)
    setMissions(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const allLabel = t('proDash.gestionnaire.missions.toutes')
  const urgLabel = t('proDash.gestionnaire.missions.urgentes')
  const enCoursLabel = t('proDash.gestionnaire.missions.enCours')
  const termLabel = t('proDash.gestionnaire.missions.terminees')

  const filtered = filter === allLabel ? missions : filter === urgLabel ? missions.filter(m => m.priorite === 'urgente') : filter === enCoursLabel ? missions.filter(m => m.statut === enCoursLabel) : missions.filter(m => m.statut === termLabel)
  const PRIO_COLORS: Record<string, string> = { 'urgente': 'bg-red-100 text-red-700', 'haute': 'bg-orange-100 text-orange-700', 'normale': 'bg-blue-100 text-blue-700', 'basse': 'bg-gray-100 text-gray-700' }
  const STATUS_COLORS: Record<string, string> = {}
  STATUS_COLORS[t('proDash.gestionnaire.missions.enAttente')] = 'bg-orange-100 text-orange-700'
  STATUS_COLORS[enCoursLabel] = 'bg-blue-100 text-blue-700'
  STATUS_COLORS[termLabel] = 'bg-green-100 text-green-700'
  STATUS_COLORS[t('proDash.gestionnaire.missions.annulee')] = 'bg-red-100 text-red-700'

  const TYPES = locale === 'pt'
    ? ['Canalização', 'Eletricidade', 'Serralharia', 'Aquecimento', 'Climatização', 'Carpintaria', 'Vidraçaria', 'Pintura', 'Alvenaria', 'Limpeza', 'Elevador', 'Partes comuns', 'Outro']
    : ['Plomberie', 'Électricité', 'Serrurerie', 'Chauffage', 'Climatisation', 'Menuiserie', 'Vitrerie', 'Peinture', 'Maçonnerie', 'Nettoyage', 'Ascenseur', 'Parties communes', 'Autre']

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-green-500 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-semibold">{'📋'} {t('proDash.gestionnaire.missions.title')}</h1>
        <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700 transition shadow-sm">{t('proDash.gestionnaire.missions.nouvelOrdre')}</button>
      </div>
      <div className="p-6 lg:p-8">
        <div className="flex gap-2 mb-6 flex-wrap">
          {([allLabel, urgLabel, enCoursLabel, termLabel] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full font-semibold text-sm transition ${filter === f ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{f} ({f === allLabel ? missions.length : f === urgLabel ? missions.filter(m => m.priorite === 'urgente').length : f === enCoursLabel ? missions.filter(m => m.statut === enCoursLabel).length : missions.filter(m => m.statut === termLabel).length})</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">{'📋'}</div>
            <h3 className="text-xl font-bold mb-2">{t('proDash.gestionnaire.missions.aucunOrdreMission')}</h3>
            <p className="text-gray-500 mb-6">{t('proDash.gestionnaire.missions.creerPremier')}</p>
            <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition">{t('proDash.gestionnaire.missions.creerOrdre')}</button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(m => (
              <div key={m.id} className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-bold text-lg">{m.titre || m.type}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${PRIO_COLORS[m.priorite] || ''}`}>{m.priorite}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[m.statut] || ''}`}>{m.statut}</span>
                    </div>
                    {m.immeuble && <p className="text-sm text-gray-600 mb-1">{'🏢'} {m.immeuble}{m.lot ? ` — ${t('proDash.ordres.lot')} ${m.lot}` : ''}</p>}
                    {m.locataire && <p className="text-sm text-gray-600 mb-1">{'👤'} {m.locataire}</p>}
                    <p className="text-sm text-gray-600 mb-1">{'🔧'} {m.type}</p>
                    {m.artisan && <p className="text-sm text-gray-600 mb-1">{'👷'} {m.artisan}</p>}
                    {m.dateIntervention && <p className="text-sm text-gray-600 mb-1">{'📅'} {m.dateIntervention}</p>}
                    {m.description && <p className="text-sm text-gray-500 mt-2">{m.description}</p>}
                  </div>
                  <div className="min-w-[160px]">
                    <select value={m.statut} onChange={e => changeStatut(m.id, e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:border-green-500 outline-none">
                      {[t('proDash.gestionnaire.missions.enAttente'), enCoursLabel, termLabel, t('proDash.gestionnaire.missions.annulee')].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{'📋'} {t('proDash.gestionnaire.missions.nouvelOrdreMission')}</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.titre')}</label>
                <input value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} placeholder={t('proDash.gestionnaire.missions.titrePlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.type')}</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none">
                    {TYPES.map(tp => <option key={tp}>{tp}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.priorite')}</label>
                  <select value={form.priorite} onChange={e => setForm({...form, priorite: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none">
                    <option value="basse">{t('proDash.gestionnaire.missions.basse')}</option>
                    <option value="normale">{t('proDash.gestionnaire.missions.normale')}</option>
                    <option value="haute">{t('proDash.gestionnaire.missions.haute')}</option>
                    <option value="urgente">{t('proDash.gestionnaire.missions.urgente')}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.immeuble')}</label>
                  <input value={form.immeuble} onChange={e => setForm({...form, immeuble: e.target.value})} placeholder={t('proDash.gestionnaire.missions.immeublePlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.lotAppartement')}</label>
                  <input value={form.lot} onChange={e => setForm({...form, lot: e.target.value})} placeholder={t('proDash.gestionnaire.missions.lotPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.locataire')}</label>
                  <input value={form.locataire} onChange={e => setForm({...form, locataire: e.target.value})} placeholder={t('proDash.gestionnaire.missions.locatairePlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.artisanAssigne')}</label>
                  <input value={form.artisan} onChange={e => setForm({...form, artisan: e.target.value})} placeholder={t('proDash.gestionnaire.missions.artisanPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.dateInterventionSouhaitee')}</label>
                <input type="date" value={form.dateIntervention} onChange={e => setForm({...form, dateIntervention: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.description')}</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder={t('proDash.gestionnaire.missions.descriptionPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none resize-none" />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">{t('proDash.gestionnaire.missions.annuler')}</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition">{t('proDash.gestionnaire.missions.creerLOrdre')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ========== CONTRATS SECTION ========== */
export function ContratsSection({ artisan }: { artisan: any }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const storageKey = `fixit_contrats_${artisan?.id}`
  const [contrats, setContrats] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ titre: '', client: '', type: t('proDash.gestionnaire.contrats.maintenance'), dateDebut: '', dateFin: '', montant: '', periodicite: t('proDash.gestionnaire.contrats.annuel'), statut: t('proDash.gestionnaire.contrats.actif'), description: '' })

  const handleSave = () => {
    if (!form.titre.trim() && !form.client.trim()) return
    const c = { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }
    const updated = [c, ...contrats]
    setContrats(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ titre: '', client: '', type: t('proDash.gestionnaire.contrats.maintenance'), dateDebut: '', dateFin: '', montant: '', periodicite: t('proDash.gestionnaire.contrats.annuel'), statut: t('proDash.gestionnaire.contrats.actif'), description: '' })
  }

  const actifLabel = t('proDash.gestionnaire.contrats.actif')
  const expireLabel = t('proDash.gestionnaire.contrats.expireStat')
  const STATUS_COLORS: Record<string, string> = {}
  STATUS_COLORS[actifLabel] = 'bg-green-100 text-green-700'
  STATUS_COLORS[expireLabel] = 'bg-red-100 text-red-700'
  STATUS_COLORS[t('proDash.gestionnaire.contrats.enRenouvellement')] = 'bg-orange-100 text-orange-700'
  STATUS_COLORS[t('proDash.gestionnaire.contrats.suspendu')] = 'bg-gray-100 text-gray-700'

  const expirantBientot = contrats.filter(c => {
    if (!c.dateFin || c.statut !== actifLabel) return false
    const diff = (new Date(c.dateFin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff > 0 && diff <= 30
  })

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold leading-tight">{'📑'} {t('proDash.gestionnaire.contrats.title')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{t('proDash.gestionnaire.contrats.subtitle')}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-[#FFC107] text-gray-900 px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#FFD54F] transition shadow-sm">{t('proDash.gestionnaire.contrats.nouveauContrat')}</button>
      </div>
      <div className="p-6 lg:p-8">
        {expirantBientot.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 mb-6">
            <div className="font-bold text-orange-700 mb-2">{'⚠️'} {expirantBientot.length} {t('proDash.gestionnaire.contrats.contratsExpirentBientot')}</div>
            {expirantBientot.map(c => <div key={c.id} className="text-sm text-orange-600">{'•'} {c.titre || c.client} — {t('proDash.gestionnaire.contrats.expireLe')} {c.dateFin}</div>)}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.gestionnaire.contrats.actifs')}</div>
            <div className="text-3xl font-bold text-green-600">{contrats.filter(c => c.statut === actifLabel).length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-[#FFC107]">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.gestionnaire.contrats.valeurTotaleAn')}</div>
            <div className="text-3xl font-bold text-amber-600">{contrats.filter(c => c.statut === actifLabel).reduce((s, c) => s + (parseFloat(c.montant) || 0), 0).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-red-400">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.gestionnaire.contrats.expires')}</div>
            <div className="text-3xl font-bold text-red-600">{contrats.filter(c => c.statut === expireLabel).length}</div>
          </div>
        </div>

        {contrats.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">{'📑'}</div>
            <h3 className="text-xl font-bold mb-2">{t('proDash.gestionnaire.contrats.aucunContrat')}</h3>
            <p className="text-gray-500 mb-6">{t('proDash.gestionnaire.contrats.gerezContrats')}</p>
            <button onClick={() => setShowModal(true)} className="bg-[#FFC107] text-gray-900 px-6 py-3 rounded-xl font-semibold hover:bg-[#FFD54F] transition">{t('proDash.gestionnaire.contrats.creerContrat')}</button>
          </div>
        ) : (
          <div className="space-y-4">
            {contrats.map(c => (
              <div key={c.id} className="bg-white rounded-2xl shadow-sm p-6 flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg">{c.titre || c.client}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[c.statut] || ''}`}>{c.statut}</span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-bold">{c.type}</span>
                  </div>
                  {c.client && c.titre && <p className="text-sm text-gray-600 mb-1">{'👤'} {c.client}</p>}
                  {c.montant && <p className="text-sm text-gray-600 mb-1">{'💰'} {c.montant} € / {c.periodicite}</p>}
                  {(c.dateDebut || c.dateFin) && <p className="text-sm text-gray-600 mb-1">{'📅'} {c.dateDebut || '?'} → {c.dateFin || t('proDash.gestionnaire.contrats.sansLimite')}</p>}
                  {c.description && <p className="text-sm text-gray-500 mt-1">{c.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{'📑'} {t('proDash.gestionnaire.contrats.nouveauContratModal')}</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.contrats.titreContrat')}</label>
                <input value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} placeholder={t('proDash.gestionnaire.contrats.titrePlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.contrats.clientPrestataire')}</label>
                  <input value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder={t('proDash.gestionnaire.contrats.clientPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.contrats.type')}</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none">
                    {[t('proDash.gestionnaire.contrats.maintenance'), t('proDash.gestionnaire.contrats.prestation'), t('proDash.gestionnaire.contrats.location'), t('proDash.gestionnaire.contrats.assurance'), t('proDash.gestionnaire.contrats.autre')].map(tp => <option key={tp}>{tp}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.contrats.montant')}</label>
                  <input type="number" value={form.montant} onChange={e => setForm({...form, montant: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.contrats.periodicite')}</label>
                  <select value={form.periodicite} onChange={e => setForm({...form, periodicite: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none">
                    {[t('proDash.gestionnaire.contrats.mensuel'), t('proDash.gestionnaire.contrats.trimestriel'), t('proDash.gestionnaire.contrats.annuel'), t('proDash.gestionnaire.contrats.unique')].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.contrats.dateDebut')}</label>
                  <input type="date" value={form.dateDebut} onChange={e => setForm({...form, dateDebut: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.contrats.dateFin')}</label>
                  <input type="date" value={form.dateFin} onChange={e => setForm({...form, dateFin: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.contrats.description')}</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder={t('proDash.gestionnaire.contrats.descriptionPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none resize-none" />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">{t('proDash.gestionnaire.contrats.annuler')}</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-[#FFC107] text-gray-900 rounded-xl font-semibold hover:bg-[#FFD54F] transition">{t('proDash.gestionnaire.contrats.creerLeContrat')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
