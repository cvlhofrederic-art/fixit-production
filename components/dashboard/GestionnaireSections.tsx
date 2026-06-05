'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import type { Artisan, Booking } from '@/lib/types'

interface ImmeubleItem {
  id: string; nom: string; adresse: string; lots: string; anneeConstruction: string
  syndic: string; gestionnaire: string; typeImmeuble: string; charges: string; notes: string; createdAt: string
}
interface MissionItem {
  id: string; titre: string; immeuble: string; lot: string; locataire: string; type: string
  priorite: string; description: string; artisan: string; dateIntervention: string; devis: string
  statut: string; createdAt: string
}
interface ContratItem {
  id: string; titre: string; client: string; type: string; dateDebut: string; dateFin: string
  montant: string; periodicite: string; statut: string; description: string; createdAt: string
}

/* ========== IMMEUBLES GESTIONNAIRE SECTION ========== */
export function ImmeublesGestionnaireSection({ artisan }: { artisan: Artisan }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const storageKey = `fixit_imm_gest_${artisan?.id}`
  const [immeubles, setImmeubles] = useState<ImmeubleItem[]>(() => {
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
      <div className="bg-white px-6 lg:px-5 py-6 border-b border-green-500 flex justify-between items-center">
        <h1 className="text-lg font-semibold">{'🏢'} {t('proDash.gestionnaire.immeubles.title')}</h1>
        <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-5 py-2.5 rounded font-semibold text-sm hover:bg-green-700 transition">{t('proDash.gestionnaire.immeubles.nouvelImmeuble')}</button>
      </div>
      <div className="p-4 lg:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white p-4 rounded-md border-l-2 border-green-500">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.gestionnaire.immeubles.immeublesGeres')}</div>
            <div className="text-base font-semibold text-green-600">{immeubles.length}</div>
          </div>
          <div className="bg-white p-4 rounded-md border-l-2 border-blue-500">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.gestionnaire.immeubles.totalLots')}</div>
            <div className="text-base font-semibold text-blue-600">{immeubles.reduce((s, i) => s + (parseInt(i.lots) || 0), 0)}</div>
          </div>
          <div className="bg-white p-4 rounded-md border-l-2 border-amber-500">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.gestionnaire.immeubles.residentiels')}</div>
            <div className="text-base font-semibold text-amber-600">{immeubles.filter(i => i.typeImmeuble === t('proDash.gestionnaire.immeubles.residentiels_types')).length}</div>
          </div>
        </div>

        {immeubles.length === 0 ? (
          <div className="bg-white rounded-md p-12 text-center">
            <div className="text-6xl mb-4">{'🏢'}</div>
            <h3 className="text-sm font-semibold mb-2">{t('proDash.gestionnaire.immeubles.aucunImmeuble')}</h3>
            <p className="text-gray-500 mb-4">{t('proDash.gestionnaire.immeubles.ajoutezImmeubles')}</p>
            <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-6 py-3 rounded font-semibold hover:bg-green-700 transition">{t('proDash.gestionnaire.immeubles.ajouterImmeuble')}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {immeubles.map(im => (
              <div key={im.id} className="bg-white rounded-md p-4 border border-gray-100 hover:border-green-200 transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-sm">{im.nom}</h3>
                    <span className="text-sm text-green-600">{im.typeImmeuble}</span>
                  </div>
                  <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-semibold">{im.lots || 0} {t('proDash.gestionnaire.immeubles.lots')}</span>
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
          <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b"><h2 className="text-sm font-semibold">{'🏢'} {t('proDash.gestionnaire.immeubles.nouvelImmeubleModal')}</h2></div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.nomResidence')}</label>
                <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder={t('proDash.gestionnaire.immeubles.nomResidencePlaceholder')} className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.type')}</label>
                  <select value={form.typeImmeuble} onChange={e => setForm({...form, typeImmeuble: e.target.value})} className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none">
                    {[t('proDash.gestionnaire.immeubles.residentiels_types'), t('proDash.gestionnaire.immeubles.commercial'), t('proDash.gestionnaire.immeubles.mixte'), t('proDash.gestionnaire.immeubles.bureaux')].map(tp => <option key={tp}>{tp}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.nombreLots')}</label>
                  <input type="number" value={form.lots} onChange={e => setForm({...form, lots: e.target.value})} placeholder="12" className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.adresse')}</label>
                <input value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder={t('proDash.gestionnaire.immeubles.adressePlaceholder')} className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.anneeConstruction')}</label>
                  <input type="number" value={form.anneeConstruction} onChange={e => setForm({...form, anneeConstruction: e.target.value})} placeholder="1985" className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.charges')}</label>
                  <input type="number" value={form.charges} onChange={e => setForm({...form, charges: e.target.value})} placeholder="0" className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.syndic')}</label>
                <input value={form.syndic} onChange={e => setForm({...form, syndic: e.target.value})} placeholder={t('proDash.gestionnaire.immeubles.syndicPlaceholder')} className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.immeubles.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder={t('proDash.gestionnaire.immeubles.notesPlaceholder')} className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none resize-none" />
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded font-semibold hover:bg-gray-50 transition">{t('proDash.gestionnaire.immeubles.annuler')}</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-green-600 text-white rounded font-semibold hover:bg-green-700 transition">{t('proDash.gestionnaire.immeubles.enregistrer')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ========== MISSIONS GESTIONNAIRE SECTION ========== */
export function MissionsGestionnaireSection({ artisan, bookings }: { artisan: Artisan; bookings: Booking[] }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const storageKey = `fixit_missions_gest_${artisan?.id}`
  const [missions, setMissions] = useState<MissionItem[]>(() => {
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
      <div className="bg-white px-6 lg:px-5 py-6 border-b border-green-500 flex justify-between items-center">
        <h1 className="text-lg font-semibold">{'📋'} {t('proDash.gestionnaire.missions.title')}</h1>
        <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-5 py-2.5 rounded font-semibold text-sm hover:bg-green-700 transition">{t('proDash.gestionnaire.missions.nouvelOrdre')}</button>
      </div>
      <div className="p-4 lg:p-5">
        <div className="flex gap-2 mb-4 flex-wrap">
          {([allLabel, urgLabel, enCoursLabel, termLabel] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full font-semibold text-sm transition ${filter === f ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{f} ({f === allLabel ? missions.length : f === urgLabel ? missions.filter(m => m.priorite === 'urgente').length : f === enCoursLabel ? missions.filter(m => m.statut === enCoursLabel).length : missions.filter(m => m.statut === termLabel).length})</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-md p-12 text-center">
            <div className="text-6xl mb-4">{'📋'}</div>
            <h3 className="text-sm font-semibold mb-2">{t('proDash.gestionnaire.missions.aucunOrdreMission')}</h3>
            <p className="text-gray-500 mb-4">{t('proDash.gestionnaire.missions.creerPremier')}</p>
            <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-6 py-3 rounded font-semibold hover:bg-green-700 transition">{t('proDash.gestionnaire.missions.creerOrdre')}</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(m => (
              <div key={m.id} className="bg-white rounded-md p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{m.titre || m.type}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${PRIO_COLORS[m.priorite] || ''}`}>{m.priorite}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[m.statut] || ''}`}>{m.statut}</span>
                    </div>
                    {m.immeuble && <p className="text-sm text-gray-600 mb-1">{'🏢'} {m.immeuble}{m.lot ? ` — ${t('proDash.ordres.lot')} ${m.lot}` : ''}</p>}
                    {m.locataire && <p className="text-sm text-gray-600 mb-1">{'👤'} {m.locataire}</p>}
                    <p className="text-sm text-gray-600 mb-1">{'🔧'} {m.type}</p>
                    {m.artisan && <p className="text-sm text-gray-600 mb-1">{'👷'} {m.artisan}</p>}
                    {m.dateIntervention && <p className="text-sm text-gray-600 mb-1">{'📅'} {m.dateIntervention}</p>}
                    {m.description && <p className="text-sm text-gray-500 mt-2">{m.description}</p>}
                  </div>
                  <div className="min-w-[160px]">
                    <select value={m.statut} onChange={e => changeStatut(m.id, e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-semibold focus:border-green-500 outline-none">
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
          <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b"><h2 className="text-sm font-semibold">{'📋'} {t('proDash.gestionnaire.missions.nouvelOrdreMission')}</h2></div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.titre')}</label>
                <input value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} placeholder={t('proDash.gestionnaire.missions.titrePlaceholder')} className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.type')}</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none">
                    {TYPES.map(tp => <option key={tp}>{tp}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.priorite')}</label>
                  <select value={form.priorite} onChange={e => setForm({...form, priorite: e.target.value})} className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none">
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
                  <input value={form.immeuble} onChange={e => setForm({...form, immeuble: e.target.value})} placeholder={t('proDash.gestionnaire.missions.immeublePlaceholder')} className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.lotAppartement')}</label>
                  <input value={form.lot} onChange={e => setForm({...form, lot: e.target.value})} placeholder={t('proDash.gestionnaire.missions.lotPlaceholder')} className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.locataire')}</label>
                  <input value={form.locataire} onChange={e => setForm({...form, locataire: e.target.value})} placeholder={t('proDash.gestionnaire.missions.locatairePlaceholder')} className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.artisanAssigne')}</label>
                  <input value={form.artisan} onChange={e => setForm({...form, artisan: e.target.value})} placeholder={t('proDash.gestionnaire.missions.artisanPlaceholder')} className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.dateInterventionSouhaitee')}</label>
                <input type="date" value={form.dateIntervention} onChange={e => setForm({...form, dateIntervention: e.target.value})} className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.gestionnaire.missions.description')}</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder={t('proDash.gestionnaire.missions.descriptionPlaceholder')} className="w-full border border-gray-200 rounded px-4 py-2.5 focus:border-green-500 outline-none resize-none" />
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded font-semibold hover:bg-gray-50 transition">{t('proDash.gestionnaire.missions.annuler')}</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-green-600 text-white rounded font-semibold hover:bg-green-700 transition">{t('proDash.gestionnaire.missions.creerLOrdre')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ========== CONTRATS SECTION ========== */
export function ContratsSection({ artisan }: { artisan: Artisan }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const storageKey = `fixit_contrats_${artisan?.id}`
  const [contrats, setContrats] = useState<ContratItem[]>(() => {
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

  const nbActifs = contrats.filter(c => c.statut === actifLabel).length
  const nbExpires = contrats.filter(c => c.statut === expireLabel).length
  const valeurTotale = contrats.filter(c => c.statut === actifLabel).reduce((s, c) => s + (parseFloat(c.montant) || 0), 0)

  const [tab, setTab] = useState<'all' | 'soustraitance'>('all')
  const visibleContrats = contrats
  void tab; void nbActifs; void nbExpires; void valeurTotale; void expirantBientot

  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null)
  const handleDownloadPdf = async (c: ContratItem) => {
    setPdfLoadingId(c.id)
    try {
      const { generateContratPdf } = await import('@/lib/pdf/contrat-generator')
      const pdf = await generateContratPdf({
        artisan: {
          logo_url: artisan?.logo_url || null,
          nom: artisan?.company_name || artisan?.nom || artisan?.full_name || '—',
          siret: artisan?.siret || null,
          adresse: (artisan as unknown as { company_address?: string; address?: string })?.company_address
            || (artisan as unknown as { address?: string })?.address || null,
          telephone: artisan?.phone || null,
          email: artisan?.email || null,
          insurance_name: artisan?.insurance_name || null,
          insurance_number: artisan?.insurance_number || null,
        },
        client: {
          nom: c.client || c.titre || '—',
          adresse: null,
          telephone: null,
          email: null,
          siret: null,
        },
        contrat: {
          numero: `CTR-${c.id.slice(-6).toUpperCase()}`,
          titre: c.titre || `Contrat de ${c.type || 'prestation'}`,
          type: c.type || 'Prestation',
          date_debut: c.dateDebut,
          date_fin: c.dateFin,
          montant: c.montant || '',
          periodicite: c.periodicite || '',
          statut: c.statut || 'Actif',
          description: c.description || '',
          date_emission: c.createdAt ? new Date(c.createdAt) : new Date(),
        },
      })
      pdf.save(`contrat-${c.id.slice(-6)}.pdf`)
    } catch (err) {
      console.error('Contrat PDF error:', err)
      alert(t('proDash.gestionnaire.contrats.erreurPdf') + ' : ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setPdfLoadingId(null)
    }
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Header — spec HTML lignes 1273-1276 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
        <div className="v5-pg-t" style={{ marginBottom: 0 }}>
          <h1>{t('proDash.gestionnaire.contrats.contratsTitle')}</h1>
          <p>{t('proDash.gestionnaire.contrats.contratsSubtitle')}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="v5-btn v5-btn-p"
          style={{ flexShrink: 0, marginTop: 2 }}
        >
          {t('proDash.gestionnaire.contrats.nouveauContratBtn')}
        </button>
      </div>

      {/* Filtres — spec HTML lignes 1279-1284 (Marchés + Avenants retirés) */}
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {([
          { key: 'all' as const, label: t('proDash.gestionnaire.contrats.tous') },
          { key: 'soustraitance' as const, label: t('proDash.gestionnaire.contrats.sousTraitanceFilter') },
        ]).map(opt => {
          const active = tab === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => setTab(opt.key)}
              className="v5-btn"
              style={{
                borderRadius: 20,
                fontSize: 11,
                ...(active ? { background: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' } : {}),
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Table — spec HTML lignes 1287-1313 */}
      <div className="v5-card" style={{ overflow: 'hidden', padding: 0 }}>
        <table className="v5-dt" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>{t('proDash.gestionnaire.contrats.ref')}</th>
              <th>{t('proDash.gestionnaire.contrats.typeCol')}</th>
              <th>{t('proDash.gestionnaire.contrats.parties')}</th>
              <th>{t('proDash.gestionnaire.contrats.montantCol')}</th>
              <th>{t('proDash.gestionnaire.contrats.date')}</th>
              <th>{t('proDash.gestionnaire.contrats.statut')}</th>
              <th>{t('proDash.gestionnaire.contrats.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleContrats.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '.6rem', padding: '3rem 2rem', color: '#CCC' }}>
                    <span style={{ fontSize: 36, opacity: 0.3 }}>📑</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#BBB' }}>{t('proDash.gestionnaire.contrats.aucunContratTable')}</span>
                    <span style={{ fontSize: 11, color: '#CCC', textAlign: 'center', maxWidth: 260, lineHeight: 1.6 }}>{t('proDash.gestionnaire.contrats.contratsSousTraitanceApparaitront')}</span>
                    <button onClick={() => setShowModal(true)} className="v5-btn v5-btn-p" style={{ marginTop: '.25rem', borderRadius: 20, padding: '6px 18px' }}>{t('proDash.gestionnaire.contrats.creerPremierContrat')}</button>
                  </div>
                </td>
              </tr>
            ) : (
              visibleContrats.map(c => {
                const statusColor = c.statut === actifLabel ? '#22c55e' : c.statut === expireLabel ? '#ef4444' : '#f59e0b'
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.id.slice(-6)}</td>
                    <td>{c.type}</td>
                    <td>{c.titre || c.client}</td>
                    <td>{c.montant ? `${c.montant} €` : '—'}</td>
                    <td>{c.dateDebut || '—'}</td>
                    <td><span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: statusColor + '18', color: statusColor }}>{c.statut}</span></td>
                    <td>
                      <button
                        onClick={() => handleDownloadPdf(c)}
                        disabled={pdfLoadingId === c.id}
                        className="v5-btn v5-btn-sm"
                        style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, opacity: pdfLoadingId === c.id ? 0.5 : 1 }}
                        title={t('proDash.gestionnaire.contrats.telechargerPdf')}
                      >
                        {pdfLoadingId === c.id ? '…' : '📄 PDF'}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>📑 {t('proDash.gestionnaire.contrats.nouveauContratModal')}</h2>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('proDash.gestionnaire.contrats.titreContrat')}</label>
                <input value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} placeholder={t('proDash.gestionnaire.contrats.titrePlaceholder')} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('proDash.gestionnaire.contrats.clientPrestataire')}</label>
                  <input value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder={t('proDash.gestionnaire.contrats.clientPlaceholder')} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('proDash.gestionnaire.contrats.type')}</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    {[t('proDash.gestionnaire.contrats.maintenance'), t('proDash.gestionnaire.contrats.prestation'), t('proDash.gestionnaire.contrats.location'), t('proDash.gestionnaire.contrats.assurance'), t('proDash.gestionnaire.contrats.autre')].map(tp => <option key={tp}>{tp}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('proDash.gestionnaire.contrats.montant')}</label>
                  <input type="number" value={form.montant} onChange={e => setForm({...form, montant: e.target.value})} placeholder="0" style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('proDash.gestionnaire.contrats.periodicite')}</label>
                  <select value={form.periodicite} onChange={e => setForm({...form, periodicite: e.target.value})} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    {[t('proDash.gestionnaire.contrats.mensuel'), t('proDash.gestionnaire.contrats.trimestriel'), t('proDash.gestionnaire.contrats.annuel'), t('proDash.gestionnaire.contrats.unique')].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('proDash.gestionnaire.contrats.dateDebut')}</label>
                  <input type="date" value={form.dateDebut} onChange={e => setForm({...form, dateDebut: e.target.value})} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('proDash.gestionnaire.contrats.dateFin')}</label>
                  <input type="date" value={form.dateFin} onChange={e => setForm({...form, dateFin: e.target.value})} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('proDash.gestionnaire.contrats.description')}</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder={t('proDash.gestionnaire.contrats.descriptionPlaceholder')} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 12 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px 0', border: '1px solid #d1d5db', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', background: '#fff', color: '#374151' }}>{t('proDash.gestionnaire.contrats.annuler')}</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '10px 0', background: '#FFC107', color: '#1a1a1a', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{t('proDash.gestionnaire.contrats.creerLeContrat')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
