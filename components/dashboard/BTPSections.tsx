'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'

/* ══════════ ÉQUIPES BTP SECTION ══════════ */
export function EquipesBTPSection({ artisan }: { artisan: any }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const storageKey = `fixit_equipes_${artisan?.id}`
  const [equipes, setEquipes] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nom: '', chef: '', metier: '', membres: '', telephone: '', disponible: true })

  const handleSave = () => {
    if (!form.nom.trim()) return
    const newEquipe = { id: Date.now().toString(), ...form, membres: parseInt(form.membres) || 1, createdAt: new Date().toISOString() }
    const updated = [...equipes, newEquipe]
    setEquipes(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ nom: '', chef: '', metier: '', membres: '', telephone: '', disponible: true })
  }

  const handleDelete = (id: string) => {
    if (!confirm(t('proDash.btp.equipes.supprimerEquipe'))) return
    const updated = equipes.filter(e => e.id !== id)
    setEquipes(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const toggleDispo = (id: string) => {
    const updated = equipes.map(e => e.id === id ? { ...e, disponible: !e.disponible } : e)
    setEquipes(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const METIERS = locale === 'pt'
    ? ['Alvenaria', 'Canalização', 'Eletricidade', 'Carpintaria', 'Pintura', 'Azulejo', 'Carpintaria estrutural', 'Coberturas', 'Isolamento', 'Demolição', 'Infraestruturas', 'Impermeabilização', 'Serralharia', 'Climatização', 'Multi-ofícios']
    : ['Maçonnerie', 'Plomberie', 'Électricité', 'Menuiserie', 'Peinture', 'Carrelage', 'Charpente', 'Couverture', 'Isolation', 'Démolition', 'VRD', 'Étanchéité', 'Serrurerie', 'Climatisation', 'Multi-corps']

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-blue-500 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-semibold">{'👷'} {t('proDash.btp.equipes.title')}</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition shadow-sm">{t('proDash.btp.equipes.nouvelleEquipe')}</button>
      </div>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-500">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.btp.equipes.equipesActives')}</div>
            <div className="text-3xl font-bold text-blue-600">{equipes.length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-500">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.btp.equipes.disponible')}</div>
            <div className="text-3xl font-bold text-green-600">{equipes.filter(e => e.disponible).length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-orange-500">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.btp.equipes.membresTotaux')}</div>
            <div className="text-3xl font-bold text-orange-600">{equipes.reduce((s, e) => s + (e.membres || 1), 0)}</div>
          </div>
        </div>

        {equipes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">👷</div>
            <h3 className="text-xl font-bold mb-2">{t('proDash.btp.equipes.aucuneEquipe')}</h3>
            <p className="text-gray-500 mb-6">{t('proDash.btp.equipes.ajoutezEquipes')}</p>
            <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition">{t('proDash.btp.equipes.ajouterEquipe')}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {equipes.map(eq => (
              <div key={eq.id} className={`bg-white rounded-2xl shadow-sm p-6 border-2 ${eq.disponible ? 'border-green-200' : 'border-orange-200'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{eq.nom}</h3>
                    <span className="text-sm text-blue-600 font-medium">{eq.metier}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${eq.disponible ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {eq.disponible ? `✅ ${t('proDash.btp.equipes.disponible')}` : `🔒 ${t('proDash.btp.equipes.indisponible')}`}
                  </span>
                </div>
                {eq.chef && <p className="text-sm text-gray-600 mb-1">{'👤'} {t('proDash.btp.equipes.chef')} : <strong>{eq.chef}</strong></p>}
                {eq.telephone && <p className="text-sm text-gray-600 mb-1">{'📱'} {eq.telephone}</p>}
                <p className="text-sm text-gray-600 mb-4">{'👥'} {eq.membres} {t('proDash.btp.equipes.membres')}</p>
                <div className="flex gap-2">
                  <button onClick={() => toggleDispo(eq.id)} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${eq.disponible ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                    {eq.disponible ? t('proDash.btp.equipes.marquerOccupee') : t('proDash.btp.equipes.marquerDisponible')}
                  </button>
                  <button onClick={() => handleDelete(eq.id)} className="px-3 py-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition text-sm">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{'👷'} {t('proDash.btp.equipes.nouvelleEquipeModal')}</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.btp.equipes.nomEquipe')}</label>
                <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder={t('proDash.btp.equipes.nomEquipePlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.btp.equipes.corpsMetier')}</label>
                <select value={form.metier} onChange={e => setForm({...form, metier: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none">
                  <option value="">{t('proDash.btp.equipes.choisir')}</option>
                  {METIERS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.btp.equipes.chefEquipe')}</label>
                <input value={form.chef} onChange={e => setForm({...form, chef: e.target.value})} placeholder={t('proDash.btp.equipes.prenomNom')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.btp.equipes.telephoneChef')}</label>
                  <input value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} placeholder="06..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.btp.equipes.nbMembres')}</label>
                  <input type="number" min="1" value={form.membres} onChange={e => setForm({...form, membres: e.target.value})} placeholder="1" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">{t('proDash.btp.equipes.annuler')}</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition">{t('proDash.btp.equipes.creerEquipe')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ CHANTIERS BTP SECTION ══════════ */
export function ChantiersBTPSection({ artisan, bookings }: { artisan: any; bookings: any[] }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const storageKey = `fixit_chantiers_${artisan?.id}`
  const [chantiers, setChantiers] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'Tous' | 'En cours' | 'Terminés' | 'En attente'>('Tous')
  const [form, setForm] = useState({ titre: '', client: '', adresse: '', dateDebut: '', dateFin: '', budget: '', statut: 'En attente', description: '', equipe: '' })

  const handleSave = () => {
    if (!form.titre.trim()) return
    const c = { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }
    const updated = [c, ...chantiers]
    setChantiers(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ titre: '', client: '', adresse: '', dateDebut: '', dateFin: '', budget: '', statut: 'En attente', description: '', equipe: '' })
  }

  const changeStatut = (id: string, statut: string) => {
    const updated = chantiers.map(c => c.id === id ? { ...c, statut } : c)
    setChantiers(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const filtered = filter === 'Tous' ? chantiers : chantiers.filter(c => c.statut === filter)
  const STATUS_COLORS: Record<string, string> = { 'En cours': 'bg-blue-100 text-blue-700', 'Terminé': 'bg-green-100 text-green-700', 'En attente': 'bg-orange-100 text-orange-700', 'Annulé': 'bg-red-100 text-red-700' }

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-blue-500 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-semibold">{'📋'} {t('proDash.btp.chantiers.title')}</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition shadow-sm">{t('proDash.btp.chantiers.nouveauChantier')}</button>
      </div>
      <div className="p-6 lg:p-8">
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['Tous', 'En cours', 'En attente', 'Terminés'] as const).map(f => {
            const labels: Record<string, string> = { 'Tous': t('proDash.btp.chantiers.tous'), 'En cours': t('proDash.btp.chantiers.enCours'), 'En attente': t('proDash.btp.chantiers.enAttente'), 'Terminés': t('proDash.btp.chantiers.termines') }
            return (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full font-semibold text-sm transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{labels[f]} {f === 'Tous' ? `(${chantiers.length})` : `(${chantiers.filter(c => c.statut === (f === 'Terminés' ? 'Terminé' : f)).length})`}</button>
          )})}

        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🏗️</div>
            <h3 className="text-xl font-bold mb-2">{t('proDash.btp.chantiers.aucunChantier')}</h3>
            <p className="text-gray-500 mb-6">{t('proDash.btp.chantiers.creerPremierChantier')}</p>
            <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition">{t('proDash.btp.chantiers.creerChantier')}</button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(c => (
              <div key={c.id} className="bg-white rounded-2xl shadow-sm p-6 flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-lg">{c.titre}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[c.statut] || 'bg-gray-100 text-gray-700'}`}>{c.statut}</span>
                  </div>
                  {c.client && <p className="text-sm text-gray-600 mb-1">👤 {c.client}</p>}
                  {c.adresse && <p className="text-sm text-gray-600 mb-1">📍 {c.adresse}</p>}
                  {(c.dateDebut || c.dateFin) && <p className="text-sm text-gray-600 mb-1">📅 {c.dateDebut || '?'} → {c.dateFin || '?'}</p>}
                  {c.budget && <p className="text-sm text-gray-600 mb-1">{'💰'} {t('proDash.btp.chantiers.budgetTotal')} : {c.budget} €</p>}
                  {c.description && <p className="text-sm text-gray-500 mt-2">{c.description}</p>}
                </div>
                <div className="flex flex-col gap-2 min-w-[160px]">
                  <select value={c.statut} onChange={e => changeStatut(c.id, e.target.value)} className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:border-blue-500 outline-none">
                    {['En attente', 'En cours', 'Terminé', 'Annulé'].map(s => { const sl: Record<string, string> = { 'En attente': t('proDash.btp.chantiers.enAttente'), 'En cours': t('proDash.btp.chantiers.enCours'), 'Terminé': t('proDash.btp.chantiers.termine'), 'Annulé': t('proDash.btp.chantiers.annule') }; return <option key={s} value={s}>{sl[s]}</option> })}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{'📋'} {t('proDash.btp.chantiers.nouveauChantierModal')}</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.btp.chantiers.titreChantier')}</label>
                <input value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} placeholder={t('proDash.btp.chantiers.titrePlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.btp.chantiers.client')}</label>
                  <input value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder={t('proDash.btp.chantiers.nomClient')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.btp.chantiers.budgetEuros')}</label>
                  <input type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.btp.chantiers.adresse')}</label>
                <input value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder={t('proDash.btp.chantiers.adresseChantier')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.btp.chantiers.dateDebut')}</label>
                  <input type="date" value={form.dateDebut} onChange={e => setForm({...form, dateDebut: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.btp.chantiers.dateFin')}</label>
                  <input type="date" value={form.dateFin} onChange={e => setForm({...form, dateFin: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.btp.chantiers.description')}</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder={t('proDash.btp.chantiers.descriptionPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none resize-none" />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">{t('proDash.btp.chantiers.annuler')}</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition">{t('proDash.btp.chantiers.creerLeChantier')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — PLANNING GANTT
// ══════════════════════════════════════════════
export function GanttSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `gantt_${userId}`
  interface Tache {
    id: string; nom: string; chantier: string; responsable: string
    debut: string; fin: string; avancement: number
    statut: 'planifié' | 'en_cours' | 'terminé' | 'en_retard'; couleur: string
  }
  const [taches, setTaches] = useState<Tache[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nom: '', chantier: '', responsable: '', debut: '', fin: '', avancement: 0, statut: 'planifié' as const, couleur: '#3B82F6' })

  const save = (data: Tache[]) => { setTaches(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addTache = () => { save([...taches, { ...form, id: Date.now().toString() }]); setShowForm(false); setForm({ nom: '', chantier: '', responsable: '', debut: '', fin: '', avancement: 0, statut: 'planifié', couleur: '#3B82F6' }) }
  const updateAvancement = (id: string, val: number) => save(taches.map(tc => tc.id === id ? { ...tc, avancement: val, statut: val === 100 ? 'terminé' : val > 0 ? 'en_cours' : 'planifié' } : tc))
  const deleteTache = (id: string) => save(taches.filter(tc => tc.id !== id))

  const allDates = taches.flatMap(t => [new Date(t.debut), new Date(t.fin)]).filter(d => !isNaN(d.getTime()))
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date(Date.now() + 30 * 86400000)
  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / 86400000)
  const getBar = (t: Tache) => {
    const start = Math.max(0, (new Date(t.debut).getTime() - minDate.getTime()) / 86400000)
    const duration = Math.max(1, (new Date(t.fin).getTime() - new Date(t.debut).getTime()) / 86400000)
    return { left: `${(start / totalDays) * 100}%`, width: `${(duration / totalDays) * 100}%` }
  }
  const statColors: Record<string, string> = { planifié: 'bg-gray-400', en_cours: 'bg-blue-500', terminé: 'bg-green-500', en_retard: 'bg-red-500' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'📅'} {t('proDash.btp.gantt.title')}</h2><p className="text-gray-500 text-sm mt-1">{taches.length} {t('proDash.btp.gantt.tachesPlanifiees')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.btp.gantt.ajouterTache')}</button>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">{t('proDash.btp.gantt.nouvelleTache')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.gantt.nom')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder={t('proDash.btp.gantt.nomPlaceholder')} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.gantt.chantier')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} placeholder={t('proDash.btp.gantt.chantierPlaceholder')} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.gantt.responsable')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.gantt.couleur')}</label><input type="color" className="mt-1 w-full border rounded-lg px-3 py-2 h-9" value={form.couleur} onChange={e => setForm({...form, couleur: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.gantt.debut')}</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.debut} onChange={e => setForm({...form, debut: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.gantt.fin')}</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.fin} onChange={e => setForm({...form, fin: e.target.value})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addTache} disabled={!form.nom || !form.debut || !form.fin} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.btp.gantt.ajouter')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.btp.gantt.annuler')}</button>
          </div>
        </div>
      )}
      {taches.length === 0 ? (
        <div className="text-center py-16 text-gray-500"><div className="text-5xl mb-3">{'📅'}</div><p className="font-medium">{t('proDash.btp.gantt.aucuneTache')}</p></div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {[t('proDash.btp.gantt.colTache'), t('proDash.btp.gantt.colChantier'), t('proDash.btp.gantt.colStatut'), t('proDash.btp.gantt.colPlanning'), t('proDash.btp.gantt.colAvancement'), ''].map(h => <th key={h || '_'} className="text-left text-xs font-semibold text-gray-600 px-4 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {taches.map(tc => {
                  const bar = getBar(tc)
                  const statLabels: Record<string, string> = { planifié: t('proDash.btp.gantt.planifie'), en_cours: t('proDash.btp.gantt.enCours'), terminé: t('proDash.btp.gantt.termine'), en_retard: t('proDash.btp.gantt.enRetard') }
                  return (
                    <tr key={tc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="font-medium text-sm">{tc.nom}</div><div className="text-xs text-gray-500">{tc.responsable}</div></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{tc.chantier}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${statColors[tc.statut]}`}>{statLabels[tc.statut] || tc.statut}</span></td>
                      <td className="px-4 py-3 min-w-[200px]">
                        <div className="relative h-6 bg-gray-100 rounded">
                          <div className="absolute top-1 h-4 rounded opacity-80" style={{ left: bar.left, width: bar.width, backgroundColor: tc.couleur }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                          <span>{tc.debut ? new Date(tc.debut).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' }) : ''}</span>
                          <span>{tc.fin ? new Date(tc.fin).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' }) : ''}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 w-40">
                        <div className="flex items-center gap-2">
                          <input type="range" min="0" max="100" value={tc.avancement} onChange={e => updateAvancement(tc.id, Number(e.target.value))} className="flex-1 h-1.5 accent-blue-600" />
                          <span className="text-xs font-medium w-8">{tc.avancement}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><button onClick={() => deleteTache(tc.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-4">
        {(['planifié', 'en_cours', 'terminé', 'en_retard'] as const).map(s => {
          const statLabels: Record<string, string> = { planifié: t('proDash.btp.gantt.planifie'), en_cours: t('proDash.btp.gantt.enCours'), terminé: t('proDash.btp.gantt.termine'), en_retard: t('proDash.btp.gantt.enRetard') }
          return (
          <div key={s} className="bg-white rounded-xl border p-4 text-center">
            <div className="text-2xl font-bold">{taches.filter(tc => tc.statut === s).length}</div>
            <div className="text-sm text-gray-500 capitalize">{statLabels[s]}</div>
          </div>
        )})}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — SITUATIONS DE TRAVAUX
// ══════════════════════════════════════════════
export function SituationsTravaux({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `situations_${userId}`
  interface Poste { poste: string; quantite: number; unite: string; prixUnit: number; avancement: number }
  interface Situation {
    id: string; chantier: string; client: string; numero: number; date: string
    montantMarche: number; travaux: Poste[]; statut: 'brouillon' | 'envoyée' | 'validée' | 'payée'
  }
  const [situations, setSituations] = useState<Situation[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<Situation | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ chantier: '', client: '', montantMarche: 0 })
  const [newPoste, setNewPoste] = useState<Poste>({ poste: '', quantite: 0, unite: 'u', prixUnit: 0, avancement: 0 })

  const save = (data: Situation[]) => { setSituations(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const createSit = () => {
    const numero = situations.filter(s => s.chantier === form.chantier).length + 1
    const s: Situation = { id: Date.now().toString(), ...form, numero, date: new Date().toISOString().split('T')[0], travaux: [], statut: 'brouillon' }
    save([...situations, s]); setSelected(s); setShowForm(false)
  }
  const addPoste = () => {
    if (!selected) return
    const updated = { ...selected, travaux: [...selected.travaux, { ...newPoste }] }
    save(situations.map(s => s.id === selected.id ? updated : s)); setSelected(updated)
    setNewPoste({ poste: '', quantite: 0, unite: 'u', prixUnit: 0, avancement: 0 })
  }
  const getTotal = (s: Situation) => s.travaux.reduce((sum, t) => sum + t.quantite * t.prixUnit * (t.avancement / 100), 0)
  const changeStatut = (id: string, statut: Situation['statut']) => {
    const upd = situations.map(s => s.id === id ? { ...s, statut } : s)
    save(upd); if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut } : null)
  }
  const statColors: Record<string, string> = { brouillon: 'bg-gray-100 text-gray-700', envoyée: 'bg-blue-100 text-blue-700', validée: 'bg-yellow-100 text-yellow-700', payée: 'bg-green-100 text-green-700' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'📊'} {t('proDash.btp.situations.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.btp.situations.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.btp.situations.nouvelleSituation')}</button>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.situations.chantier')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.situations.client')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.situations.montantMarche')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={createSit} disabled={!form.chantier || !form.client} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.btp.situations.creer')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.btp.situations.annuler')}</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-3">
          {situations.length === 0 ? <div className="text-center py-8 text-gray-500 text-sm">{t('proDash.btp.situations.aucuneSituation')}</div> : situations.map(s => {
            const sitStatLabels: Record<string, string> = { brouillon: t('proDash.btp.situations.brouillon'), envoyée: t('proDash.btp.situations.envoyee'), validée: t('proDash.btp.situations.validee'), payée: t('proDash.btp.situations.payee') }
            return (
            <div key={s.id} onClick={() => setSelected(s)} className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-300 ${selected?.id === s.id ? 'border-blue-500 ring-1 ring-blue-200' : ''}`}>
              <div className="flex justify-between mb-1"><span className="font-semibold text-sm">{t('proDash.btp.situations.situation')} n°{s.numero}</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statColors[s.statut]}`}>{sitStatLabels[s.statut] || s.statut}</span></div>
              <div className="text-sm text-gray-600">{s.chantier}</div>
              <div className="text-xs text-gray-500">{s.client}</div>
              <div className="text-sm font-bold text-blue-700 mt-1">{getTotal(s).toLocaleString(dateLocale)} €</div>
            </div>
          )})}
        </div>
        <div className="col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">{t('proDash.btp.situations.situation')} n°{selected.numero} — {selected.chantier}</h3>
                <div className="flex gap-2">
                  {(['brouillon', 'envoyée', 'validée', 'payée'] as const).map(s => (
                    <button key={s} onClick={() => changeStatut(selected.id, s)} className={`px-2 py-1 rounded text-xs font-medium border ${selected.statut === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <table className="w-full text-sm border rounded-lg overflow-hidden mb-4">
                <thead className="bg-gray-50"><tr>{[t('proDash.btp.situations.colPoste'), t('proDash.btp.situations.colQte'), t('proDash.btp.situations.colUnite'), t('proDash.btp.situations.colPU'), t('proDash.btp.situations.colAvt'), t('proDash.btp.situations.colMontant')].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {selected.travaux.map((tr, i) => (
                    <tr key={i}><td className="px-3 py-2">{tr.poste}</td><td className="px-3 py-2">{tr.quantite}</td><td className="px-3 py-2">{tr.unite}</td><td className="px-3 py-2">{tr.prixUnit.toLocaleString(dateLocale)}</td><td className="px-3 py-2">{tr.avancement}%</td><td className="px-3 py-2 font-semibold">{(tr.quantite * tr.prixUnit * tr.avancement / 100).toLocaleString(dateLocale)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr className="bg-blue-50 font-bold"><td colSpan={5} className="px-3 py-2 text-right">{t('proDash.btp.situations.total')}</td><td className="px-3 py-2 text-blue-700">{getTotal(selected).toLocaleString(dateLocale)} €</td></tr></tfoot>
              </table>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-5 gap-2 mb-2">
                  <input className="col-span-2 border rounded px-2 py-1.5 text-sm" placeholder={t('proDash.btp.situations.postePlaceholder')} value={newPoste.poste} onChange={e => setNewPoste({...newPoste, poste: e.target.value})} />
                  <input type="number" className="border rounded px-2 py-1.5 text-sm" placeholder={t('proDash.btp.situations.qtePlaceholder')} value={newPoste.quantite || ''} onChange={e => setNewPoste({...newPoste, quantite: Number(e.target.value)})} />
                  <select className="border rounded px-2 py-1.5 text-sm" value={newPoste.unite} onChange={e => setNewPoste({...newPoste, unite: e.target.value})}>{['u', 'm²', 'm³', 'ml', 'kg', 'h', 'forfait'].map(u => <option key={u}>{u}</option>)}</select>
                  <input type="number" className="border rounded px-2 py-1.5 text-sm" placeholder={t('proDash.btp.situations.puPlaceholder')} value={newPoste.prixUnit || ''} onChange={e => setNewPoste({...newPoste, prixUnit: Number(e.target.value)})} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1"><span className="text-sm text-gray-600">{t('proDash.btp.situations.avancement')}</span><input type="range" min="0" max="100" value={newPoste.avancement} onChange={e => setNewPoste({...newPoste, avancement: Number(e.target.value)})} className="flex-1 accent-blue-600" /><span className="text-sm w-8">{newPoste.avancement}%</span></div>
                  <button onClick={addPoste} disabled={!newPoste.poste} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50">{t('proDash.btp.situations.ajouter')}</button>
                </div>
              </div>
            </div>
          ) : <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center h-64 text-gray-500"><div className="text-center"><div className="text-4xl mb-2">{'📊'}</div><p>{t('proDash.btp.situations.selectionnerSituation')}</p></div></div>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — RETENUES DE GARANTIE
// ══════════════════════════════════════════════
export function RetenuesGarantieSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `retenues_${userId}`
  interface Retenue {
    id: string; chantier: string; client: string; montantMarche: number; tauxRetenue: number
    montantRetenu: number; dateFinTravaux: string; dateLiberation?: string
    statut: 'active' | 'mainlevée_demandée' | 'libérée'; caution: boolean
  }
  const [retenues, setRetenues] = useState<Retenue[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ chantier: '', client: '', montantMarche: 0, tauxRetenue: 5, dateFinTravaux: '', caution: false })

  const save = (data: Retenue[]) => { setRetenues(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addRetenue = () => {
    save([...retenues, { id: Date.now().toString(), ...form, montantRetenu: form.montantMarche * form.tauxRetenue / 100, statut: 'active' }])
    setShowForm(false); setForm({ chantier: '', client: '', montantMarche: 0, tauxRetenue: 5, dateFinTravaux: '', caution: false })
  }
  const changeStatut = (id: string, statut: Retenue['statut']) => save(retenues.map(r => r.id === id ? { ...r, statut, dateLiberation: statut === 'libérée' ? new Date().toISOString().split('T')[0] : r.dateLiberation } : r))

  const totalRetenu = retenues.filter(r => r.statut === 'active').reduce((s, r) => s + r.montantRetenu, 0)
  const totalLibéré = retenues.filter(r => r.statut === 'libérée').reduce((s, r) => s + r.montantRetenu, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'🔒'} {t('proDash.btp.retenues.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.btp.retenues.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.btp.retenues.nouvelleRetenue')}</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4"><div className="text-orange-600 text-sm font-medium">{t('proDash.btp.retenues.retenuEnAttente')}</div><div className="text-2xl font-bold text-orange-700 mt-1">{totalRetenu.toLocaleString(dateLocale)} €</div></div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4"><div className="text-green-600 text-sm font-medium">{t('proDash.btp.retenues.libere')}</div><div className="text-2xl font-bold text-green-700 mt-1">{totalLibéré.toLocaleString(dateLocale)} €</div></div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4"><div className="text-blue-600 text-sm font-medium">{t('proDash.btp.retenues.chantiersConcernes')}</div><div className="text-2xl font-bold text-blue-700 mt-1">{retenues.length}</div></div>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-4">{t('proDash.btp.retenues.nouvelleRetenueGarantie')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.retenues.chantier')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.retenues.client')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.retenues.montantMarcheHT')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.retenues.tauxRetenue')}</label><input type="number" min="1" max="10" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.tauxRetenue} onChange={e => setForm({...form, tauxRetenue: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.retenues.finTravaux')}</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.dateFinTravaux} onChange={e => setForm({...form, dateFinTravaux: e.target.value})} /></div>
            <div className="flex items-center gap-2 mt-6"><input type="checkbox" id="caution_ret" checked={form.caution} onChange={e => setForm({...form, caution: e.target.checked})} className="w-4 h-4" /><label htmlFor="caution_ret" className="text-sm text-gray-700">{t('proDash.btp.retenues.cautionBancaire')}</label></div>
          </div>
          {form.montantMarche > 0 && <div className="mt-3 bg-blue-50 rounded-lg p-3 text-sm text-blue-700">{'💡'} {t('proDash.btp.retenues.montantRetenuInfo')} <strong>{(form.montantMarche * form.tauxRetenue / 100).toLocaleString(dateLocale)} €</strong></div>}
          <div className="flex gap-3 mt-4">
            <button onClick={addRetenue} disabled={!form.chantier || !form.client} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.btp.retenues.enregistrer')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.btp.retenues.annuler')}</button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b"><tr>{[t('proDash.btp.retenues.colChantier'), t('proDash.btp.retenues.colClient'), t('proDash.btp.retenues.colMarcheHT'), t('proDash.btp.retenues.colRetenu'), t('proDash.btp.retenues.colFinTravaux'), t('proDash.btp.retenues.colStatut'), t('proDash.btp.retenues.colActions')].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-600 px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {retenues.length === 0 ? <tr><td colSpan={7} className="text-center py-10 text-gray-500 text-sm">{t('proDash.btp.retenues.aucuneRetenue')}</td></tr> : retenues.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-sm">{r.chantier}</td>
                <td className="px-4 py-3 text-sm">{r.client}</td>
                <td className="px-4 py-3 text-sm">{r.montantMarche.toLocaleString(dateLocale)} €</td>
                <td className="px-4 py-3 text-sm font-semibold text-orange-700">{r.montantRetenu.toLocaleString(dateLocale)} €</td>
                <td className="px-4 py-3 text-sm">{r.dateFinTravaux ? new Date(r.dateFinTravaux).toLocaleDateString(dateLocale) : '—'}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.statut === 'active' ? 'bg-orange-100 text-orange-700' : r.statut === 'mainlevée_demandée' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{r.statut}</span></td>
                <td className="px-4 py-3">
                  {r.statut === 'active' && <button onClick={() => changeStatut(r.id, 'mainlevée_demandée')} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100">{t('proDash.btp.retenues.demanderMainlevee')}</button>}
                  {r.statut === 'mainlevée_demandée' && <button onClick={() => changeStatut(r.id, 'libérée')} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100">{t('proDash.btp.retenues.liberer')}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — POINTAGE ÉQUIPES
// ══════════════════════════════════════════════
export function PointageEquipesSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `pointage_${userId}`
  interface Pointage {
    id: string; employe: string; poste: string; chantier: string; date: string
    heureArrivee: string; heureDepart: string; pauseMinutes: number; heuresTravaillees: number; notes: string
  }
  const [pointages, setPointages] = useState<Pointage[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterEmploye, setFilterEmploye] = useState('')
  const [form, setForm] = useState({ employe: '', poste: '', chantier: '', date: new Date().toISOString().split('T')[0], heureArrivee: '08:00', heureDepart: '17:00', pauseMinutes: 60, notes: '' })

  const save = (data: Pointage[]) => { setPointages(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const calcH = (a: string, d: string, p: number) => {
    const [ah, am] = a.split(':').map(Number); const [dh, dm] = d.split(':').map(Number)
    return Math.max(0, ((dh * 60 + dm) - (ah * 60 + am) - p) / 60)
  }
  const addPointage = () => {
    save([...pointages, { id: Date.now().toString(), ...form, heuresTravaillees: Math.round(calcH(form.heureArrivee, form.heureDepart, form.pauseMinutes) * 100) / 100 }])
    setShowForm(false)
  }
  const deleteP = (id: string) => save(pointages.filter(p => p.id !== id))
  const employes = [...new Set(pointages.map(p => p.employe))].filter(Boolean)
  const filtered = pointages.filter(p => (!filterDate || p.date === filterDate) && (!filterEmploye || p.employe === filterEmploye))
  const totalH = filtered.reduce((s, p) => s + p.heuresTravaillees, 0)
  const heuresByEmp = employes.map(e => ({ employe: e, heures: pointages.filter(p => p.employe === e).reduce((s, p) => s + p.heuresTravaillees, 0), jours: new Set(pointages.filter(p => p.employe === e).map(p => p.date)).size }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'⏱️'} {t('proDash.btp.pointage.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.btp.pointage.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.btp.pointage.pointer')}</button>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.employe')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.employe} onChange={e => setForm({...form, employe: e.target.value})} placeholder={t('proDash.btp.pointage.employePlaceholder')} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.poste')}</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.poste} onChange={e => setForm({...form, poste: e.target.value})}><option value="">{t('proDash.btp.pointage.selectionner')}</option>{[{k:'chefChantier'},{k:'macon'},{k:'electricien'},{k:'plombier'},{k:'charpentier'},{k:'peintre'},{k:'manoeuvre'}].map(p => <option key={p.k} value={t(`proDash.btp.pointage.${p.k}`)}>{t(`proDash.btp.pointage.${p.k}`)}</option>)}</select></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.chantier')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.date')}</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.arrivee')}</label><input type="time" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.heureArrivee} onChange={e => setForm({...form, heureArrivee: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.depart')}</label><input type="time" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.heureDepart} onChange={e => setForm({...form, heureDepart: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.pauseMin')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.pauseMinutes} onChange={e => setForm({...form, pauseMinutes: Number(e.target.value)})} /></div>
            <div className="col-span-2"><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.notes')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <div className="mt-3 bg-blue-50 rounded-lg p-3 text-sm text-blue-700">{'⏱️'} {t('proDash.btp.pointage.heures')} <strong>{calcH(form.heureArrivee, form.heureDepart, form.pauseMinutes).toFixed(2)}h</strong></div>
          <div className="flex gap-3 mt-4">
            <button onClick={addPointage} disabled={!form.employe} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.btp.pointage.enregistrer')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.btp.pointage.annuler')}</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-3 bg-white rounded-xl border shadow-sm p-4">
          <div className="flex gap-3 mb-4">
            <div><label className="text-xs font-medium text-gray-600">{t('proDash.btp.pointage.date')}</label><input type="date" className="mt-1 border rounded-lg px-3 py-2 text-sm" value={filterDate} onChange={e => setFilterDate(e.target.value)} /></div>
            <div><label className="text-xs font-medium text-gray-600">{t('proDash.btp.pointage.employe').replace(' *', '')}</label><select className="mt-1 border rounded-lg px-3 py-2 text-sm" value={filterEmploye} onChange={e => setFilterEmploye(e.target.value)}><option value="">{t('proDash.btp.pointage.tous')}</option>{employes.map(e => <option key={e}>{e}</option>)}</select></div>
            <div className="flex items-end"><span className="text-sm text-gray-600 pb-2">{filtered.length} {t('proDash.btp.pointage.pointages')} — <strong>{totalH.toFixed(1)}h</strong></span></div>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b"><tr>{[t('proDash.btp.pointage.colEmploye'), t('proDash.btp.pointage.colPoste'), t('proDash.btp.pointage.colChantier'), t('proDash.btp.pointage.colDate'), t('proDash.btp.pointage.colArrivee'), t('proDash.btp.pointage.colDepart'), t('proDash.btp.pointage.colHeures'), ''].map(h => <th key={h || '_'} className="text-left text-xs font-semibold text-gray-600 pb-2">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? <tr><td colSpan={8} className="py-8 text-center text-gray-500 text-sm">{t('proDash.btp.pointage.aucunPointage')}</td></tr> : filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="py-2 font-medium">{p.employe}</td><td className="py-2 text-gray-600">{p.poste}</td><td className="py-2 text-gray-600">{p.chantier}</td>
                  <td className="py-2">{new Date(p.date).toLocaleDateString(dateLocale, { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                  <td className="py-2">{p.heureArrivee}</td><td className="py-2">{p.heureDepart}</td>
                  <td className="py-2 font-semibold text-blue-700">{p.heuresTravaillees}h</td>
                  <td className="py-2"><button onClick={() => deleteP(p.id)} className="text-red-400 hover:text-red-600">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">{t('proDash.btp.pointage.recapEmployes')}</h4>
          {heuresByEmp.length === 0 ? <p className="text-xs text-gray-500">{t('proDash.btp.pointage.aucuneDonnee')}</p> : heuresByEmp.map(e => (
            <div key={e.employe} className="flex items-center justify-between py-2 border-b last:border-0">
              <div><div className="text-sm font-medium">{e.employe}</div><div className="text-xs text-gray-500">{e.jours} {t('proDash.btp.pointage.jours')}</div></div>
              <div className="text-sm font-bold text-blue-700">{e.heures.toFixed(1)}h</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — SOUS-TRAITANCE DC4
// ══════════════════════════════════════════════
export function SousTraitanceDC4Section({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `dc4_${userId}`
  interface SousTraitant {
    id: string; entreprise: string; siret: string; responsable: string; email: string
    telephone: string; adresse: string; chantier: string; lot: string
    montantMarche: number; tauxTVA: number; statut: 'en_attente' | 'agréé' | 'refusé'; dateAgrement?: string; dc4Genere: boolean
  }
  const [soustraitants, setSoustraitants] = useState<SousTraitant[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ entreprise: '', siret: '', responsable: '', email: '', telephone: '', adresse: '', chantier: '', lot: '', montantMarche: 0, tauxTVA: 20 })

  const save = (data: SousTraitant[]) => { setSoustraitants(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addST = () => {
    save([...soustraitants, { id: Date.now().toString(), ...form, statut: 'en_attente', dc4Genere: false }])
    setShowForm(false); setForm({ entreprise: '', siret: '', responsable: '', email: '', telephone: '', adresse: '', chantier: '', lot: '', montantMarche: 0, tauxTVA: 20 })
  }
  const agréer = (id: string) => save(soustraitants.map(s => s.id === id ? { ...s, statut: 'agréé', dateAgrement: new Date().toISOString().split('T')[0] } : s))
  const genererDC4 = (st: SousTraitant) => {
    const content = `DC4 — ACTE SPÉCIAL DE SOUS-TRAITANCE\n\nChantier : ${st.chantier}\nLot : ${st.lot}\nSous-traitant : ${st.entreprise}\nSIRET : ${st.siret}\nReprésentant : ${st.responsable}\n\nMontant HT : ${st.montantMarche.toLocaleString(dateLocale)} €\nTVA : ${st.tauxTVA}%\nMontant TTC : ${(st.montantMarche * (1 + st.tauxTVA / 100)).toLocaleString(dateLocale)} €\nDate agrément : ${st.dateAgrement || '—'}\n\nSignature maître d'ouvrage : _______________\nSignature entreprise principale : _______________\nSignature sous-traitant : _______________`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `DC4_${st.entreprise}.txt`; a.click()
    URL.revokeObjectURL(url)
    save(soustraitants.map(s => s.id === st.id ? { ...s, dc4Genere: true } : s))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'🤝'} {t('proDash.btp.sousTraitance.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.btp.sousTraitance.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.btp.sousTraitance.ajouterSousTraitant')}</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"><div className="text-yellow-700 text-sm font-medium">{t('proDash.btp.sousTraitance.enAttente')}</div><div className="text-2xl font-bold text-yellow-700 mt-1">{soustraitants.filter(s => s.statut === 'en_attente').length}</div></div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4"><div className="text-green-700 text-sm font-medium">{t('proDash.btp.sousTraitance.agrees')}</div><div className="text-2xl font-bold text-green-700 mt-1">{soustraitants.filter(s => s.statut === 'agréé').length}</div></div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4"><div className="text-blue-700 text-sm font-medium">{t('proDash.btp.sousTraitance.dc4Generes')}</div><div className="text-2xl font-bold text-blue-700 mt-1">{soustraitants.filter(s => s.dc4Genere).length}</div></div>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            {([[t('proDash.btp.sousTraitance.entreprise'), 'entreprise', 'text'], [t('proDash.btp.sousTraitance.siret'), 'siret', 'text'], [t('proDash.btp.sousTraitance.responsable'), 'responsable', 'text'], [t('proDash.btp.sousTraitance.email'), 'email', 'email'], [t('proDash.btp.sousTraitance.telephone'), 'telephone', 'tel'], [t('proDash.btp.sousTraitance.adresse'), 'adresse', 'text'], [t('proDash.btp.sousTraitance.chantier'), 'chantier', 'text'], [t('proDash.btp.sousTraitance.lot'), 'lot', 'text']] as [string, string, string][]).map(([label, key, type]) => (
              <div key={key}><label className="text-sm font-medium text-gray-700">{label}</label><input type={type} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={(form as Record<string, string | number>)[key] as string} onChange={e => setForm({...form, [key]: e.target.value})} /></div>
            ))}
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.sousTraitance.montantHT')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.sousTraitance.tva')}</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.tauxTVA} onChange={e => setForm({...form, tauxTVA: Number(e.target.value)})}>{[20, 10, 5.5, 0].map(tv => <option key={tv} value={tv}>{tv}%</option>)}</select></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addST} disabled={!form.entreprise} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.btp.sousTraitance.ajouter')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.btp.sousTraitance.annuler')}</button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b"><tr>{[t('proDash.btp.sousTraitance.colEntreprise'), t('proDash.btp.sousTraitance.colChantierLot'), t('proDash.btp.sousTraitance.colMontantHT'), t('proDash.btp.sousTraitance.colStatut'), t('proDash.btp.sousTraitance.colDC4'), t('proDash.btp.sousTraitance.colActions')].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-600 px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {soustraitants.length === 0 ? <tr><td colSpan={6} className="text-center py-10 text-gray-500 text-sm">{t('proDash.btp.sousTraitance.aucunSousTraitant')}</td></tr> : soustraitants.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3"><div className="font-medium text-sm">{s.entreprise}</div><div className="text-xs text-gray-500">{s.siret}</div></td>
                <td className="px-4 py-3 text-sm"><div>{s.chantier}</div><div className="text-xs text-gray-500">{s.lot}</div></td>
                <td className="px-4 py-3 text-sm font-semibold">{s.montantMarche.toLocaleString(dateLocale)} €</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.statut === 'en_attente' ? 'bg-yellow-100 text-yellow-700' : s.statut === 'agréé' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{s.statut}</span></td>
                <td className="px-4 py-3 text-center">{s.dc4Genere ? '✅' : '—'}</td>
                <td className="px-4 py-3">
                  {s.statut === 'en_attente' && <button onClick={() => agréer(s.id)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 mr-1">{t('proDash.btp.sousTraitance.agreer')}</button>}
                  {s.statut === 'agréé' && <button onClick={() => genererDC4(s)} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100">{t('proDash.btp.sousTraitance.genererDC4')}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — DPGF / APPELS D'OFFRES
// ══════════════════════════════════════════════
export function DPGFSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `dpgf_${userId}`
  interface Lot { numero: string; designation: string; montantHT: number }
  interface AppelOffre { id: string; titre: string; client: string; dateRemise: string; montantEstime: number; statut: 'en_cours' | 'soumis' | 'gagné' | 'perdu'; lots: Lot[] }
  const [appels, setAppels] = useState<AppelOffre[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<AppelOffre | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titre: '', client: '', dateRemise: '', montantEstime: 0 })
  const [newLot, setNewLot] = useState<Lot>({ numero: '', designation: '', montantHT: 0 })

  const save = (data: AppelOffre[]) => { setAppels(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const createAppel = () => {
    const a: AppelOffre = { id: Date.now().toString(), ...form, statut: 'en_cours', lots: [] }
    save([...appels, a]); setSelected(a); setShowForm(false)
  }
  const addLot = () => {
    if (!selected) return
    const updated = { ...selected, lots: [...selected.lots, { ...newLot }] }
    save(appels.map(a => a.id === selected.id ? updated : a)); setSelected(updated)
    setNewLot({ numero: '', designation: '', montantHT: 0 })
  }
  const getTotal = (a: AppelOffre) => a.lots.reduce((s, l) => s + l.montantHT, 0)
  const changeStatut = (id: string, statut: AppelOffre['statut']) => {
    const upd = appels.map(a => a.id === id ? { ...a, statut } : a)
    save(upd); if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut } : null)
  }
  const exportDPGF = (a: AppelOffre) => {
    const rows = a.lots.map(l => `LOT ${l.numero} — ${l.designation.padEnd(40)} ${l.montantHT.toLocaleString(dateLocale)} € HT`).join('\n')
    const content = `DPGF — ${a.titre}\nClient : ${a.client}\nDate remise : ${a.dateRemise ? new Date(a.dateRemise).toLocaleDateString(dateLocale) : ''}\n\n${rows}\n\nTOTAL HT : ${getTotal(a).toLocaleString(dateLocale)} €\nTVA 20% : ${(getTotal(a) * 0.2).toLocaleString(dateLocale)} €\nTOTAL TTC : ${(getTotal(a) * 1.2).toLocaleString(dateLocale)} €`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `DPGF_${a.titre.replace(/\s+/g, '_')}.txt`; link.click()
    URL.revokeObjectURL(url)
  }
  const statColors: Record<string, string> = { en_cours: 'bg-blue-100 text-blue-700', soumis: 'bg-yellow-100 text-yellow-700', gagné: 'bg-green-100 text-green-700', perdu: 'bg-red-100 text-red-700' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'📋'} {t('proDash.btp.dpgf.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.btp.dpgf.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.btp.dpgf.nouvelAppel')}</button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {(['en_cours', 'soumis', 'gagné', 'perdu'] as const).map(s => {
          const dpgfStatLabels: Record<string, string> = { en_cours: t('proDash.btp.dpgf.enCours'), soumis: t('proDash.btp.dpgf.soumis'), gagné: t('proDash.btp.dpgf.gagne'), perdu: t('proDash.btp.dpgf.perdu') }
          return (
          <div key={s} className={`border rounded-xl p-4 ${statColors[s].replace('text-', 'border-').replace('-700', '-200')}`}>
            <div className="text-sm font-medium text-gray-600 capitalize">{dpgfStatLabels[s]}</div>
            <div className="text-2xl font-bold mt-1">{appels.filter(a => a.statut === s).length}</div>
          </div>
        )})}
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.dpgf.titre')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.dpgf.clientMaitreOuvrage')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.dpgf.dateRemise')}</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.dateRemise} onChange={e => setForm({...form, dateRemise: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.dpgf.montantEstime')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.montantEstime} onChange={e => setForm({...form, montantEstime: Number(e.target.value)})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={createAppel} disabled={!form.titre} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.btp.dpgf.creer')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.btp.dpgf.annuler')}</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-3">
          {appels.length === 0 ? <div className="text-center py-8 text-gray-500 text-sm">{t('proDash.btp.dpgf.aucunAppel')}</div> : appels.map(a => (
            <div key={a.id} onClick={() => setSelected(a)} className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-300 ${selected?.id === a.id ? 'border-blue-500 ring-1 ring-blue-200' : ''}`}>
              <div className="flex items-center justify-between mb-1"><span className="font-semibold text-sm truncate">{a.titre}</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2 ${statColors[a.statut]}`}>{a.statut}</span></div>
              <div className="text-xs text-gray-500">{a.client}</div>
              <div className="text-sm font-bold text-blue-700 mt-1">{getTotal(a).toLocaleString(dateLocale)} € {t('proDash.common.ht')}</div>
            </div>
          ))}
        </div>
        <div className="col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">{selected.titre}</h3>
                <div className="flex gap-2">
                  <button onClick={() => exportDPGF(selected)} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200">{'⬇️'} {t('proDash.btp.dpgf.export')}</button>
                  {(['en_cours', 'soumis', 'gagné', 'perdu'] as const).map(s => (
                    <button key={s} onClick={() => changeStatut(selected.id, s)} className={`px-2 py-1 rounded text-xs font-medium border ${selected.statut === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <table className="w-full text-sm border rounded-lg overflow-hidden mb-4">
                <thead className="bg-gray-50"><tr>{[t('proDash.btp.dpgf.colNumeroLot'), t('proDash.btp.dpgf.colDesignation'), t('proDash.btp.dpgf.colMontantHT')].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>)}</tr></thead>
                <tbody className="divide-y">{selected.lots.map((l, i) => <tr key={i}><td className="px-3 py-2 font-medium">{l.numero}</td><td className="px-3 py-2">{l.designation}</td><td className="px-3 py-2 font-semibold">{l.montantHT.toLocaleString(dateLocale)}</td></tr>)}</tbody>
                <tfoot>
                  <tr className="bg-blue-50 font-bold"><td colSpan={2} className="px-3 py-2 text-right">{t('proDash.btp.dpgf.totalHT')}</td><td className="px-3 py-2 text-blue-700">{getTotal(selected).toLocaleString(dateLocale)} €</td></tr>
                  <tr className="bg-blue-100 font-bold"><td colSpan={2} className="px-3 py-2 text-right">{t('proDash.btp.dpgf.totalTTC')}</td><td className="px-3 py-2 text-blue-800">{(getTotal(selected) * 1.2).toLocaleString(dateLocale)} €</td></tr>
                </tfoot>
              </table>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex gap-2">
                  <input className="w-16 border rounded px-2 py-1.5 text-sm" placeholder={t('proDash.btp.dpgf.numLotPlaceholder')} value={newLot.numero} onChange={e => setNewLot({...newLot, numero: e.target.value})} />
                  <input className="flex-1 border rounded px-2 py-1.5 text-sm" placeholder={t('proDash.btp.dpgf.designationPlaceholder')} value={newLot.designation} onChange={e => setNewLot({...newLot, designation: e.target.value})} />
                  <input type="number" className="w-28 border rounded px-2 py-1.5 text-sm" placeholder={t('proDash.btp.dpgf.montantPlaceholder')} value={newLot.montantHT || ''} onChange={e => setNewLot({...newLot, montantHT: Number(e.target.value)})} />
                  <button onClick={addLot} disabled={!newLot.designation} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">+</button>
                </div>
              </div>
            </div>
          ) : <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center h-64 text-gray-500"><div className="text-center"><div className="text-4xl mb-2">{'📋'}</div><p>{t('proDash.btp.dpgf.selectionnerAppel')}</p></div></div>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONCIERGERIE — CHANNEL MANAGER
// ══════════════════════════════════════════════

