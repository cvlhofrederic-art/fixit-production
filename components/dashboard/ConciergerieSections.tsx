'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import type { Artisan } from '@/lib/types'

interface ProprieteRecord {
  id: string
  nom: string
  adresse?: string
  proprietaire?: string
  telephone?: string
  typeLogement?: string
  nombrePieces?: string
  etage?: string
  digicode?: string
  notesAcces?: string
  loyer?: string
  etatMenage: string
  createdAt?: string
}

interface AccesRecord {
  id: string
  propriete: string
  typeAcces: string
  localisation?: string
  code?: string
  responsable?: string
  notes?: string
  statut: string
  createdAt?: string
}

interface ConciergerieReservation {
  id: string
  plateforme: string
  logement: string
  client: string
  dateArrivee: string
  dateDepart: string
  montantTotal: number
  commission: number
  statut: string
  notes?: string
}

/* ══════════ PROPRIÉTÉS CONCIERGERIE SECTION ══════════ */
export function ProprietesConciergerieSection({ artisan }: { artisan: Artisan | null }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const storageKey = `fixit_proprietes_${artisan?.id}`
  const [proprietes, setProprietes] = useState<ProprieteRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nom: '', adresse: '', proprietaire: '', telephone: '', typeLogement: 'Appartement', nombrePieces: '', etage: '', digicode: '', notesAcces: '', loyer: '', etatMenage: 'Propre' })

  const handleSave = () => {
    if (!form.nom.trim()) return
    const p = { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }
    const updated = [p, ...proprietes]
    setProprietes(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ nom: '', adresse: '', proprietaire: '', telephone: '', typeLogement: 'Appartement', nombrePieces: '', etage: '', digicode: '', notesAcces: '', loyer: '', etatMenage: 'Propre' })
  }

  const ETATS = ['Propre', 'À nettoyer', 'En maintenance', 'Occupé', 'Vacant']
  const ETAT_LABELS: Record<string, string> = { 'Propre': t('proDash.conciergerie.proprietes.propre'), 'À nettoyer': t('proDash.conciergerie.proprietes.aNettoyer'), 'En maintenance': t('proDash.conciergerie.proprietes.enMaintenance'), 'Occupé': t('proDash.conciergerie.proprietes.occupe'), 'Vacant': t('proDash.conciergerie.proprietes.vacant') }
  const ETAT_COLORS: Record<string, string> = { 'Propre': 'bg-green-100 text-green-700', 'À nettoyer': 'bg-yellow-100 text-yellow-700', 'En maintenance': 'bg-orange-100 text-orange-700', 'Occupé': 'bg-blue-100 text-blue-700', 'Vacant': 'bg-gray-100 text-gray-700' }

  const updateEtat = (id: string, etat: string) => {
    const updated = proprietes.map(p => p.id === id ? { ...p, etatMenage: etat } : p)
    setProprietes(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-purple-500 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-semibold">{'🏠'} {t('proDash.conciergerie.proprietes.title')}</h1>
        <button onClick={() => setShowModal(true)} className="bg-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-purple-700 transition shadow-sm">{t('proDash.conciergerie.proprietes.nouvellePropriete')}</button>
      </div>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-purple-500">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.conciergerie.proprietes.totalProprietes')}</div>
            <div className="text-3xl font-bold text-purple-600">{proprietes.length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-500">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.conciergerie.proprietes.propresPretes')}</div>
            <div className="text-3xl font-bold text-green-600">{proprietes.filter(p => p.etatMenage === 'Propre').length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-orange-500">
            <div className="text-sm text-gray-500 mb-1">{t('proDash.conciergerie.proprietes.aTraiter')}</div>
            <div className="text-3xl font-bold text-orange-600">{proprietes.filter(p => p.etatMenage === 'À nettoyer' || p.etatMenage === 'En maintenance').length}</div>
          </div>
        </div>

        {proprietes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🏠</div>
            <h3 className="text-xl font-bold mb-2">{t('proDash.conciergerie.proprietes.aucunePropriete')}</h3>
            <p className="text-gray-500 mb-6">{t('proDash.conciergerie.proprietes.ajoutezProprietes')}</p>
            <button onClick={() => setShowModal(true)} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition">{t('proDash.conciergerie.proprietes.ajouterPropriete')}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {proprietes.map(p => (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm p-6 border-2 border-gray-100 hover:border-purple-200 transition">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{p.nom}</h3>
                    <span className="text-sm text-gray-500">{p.typeLogement} · {p.nombrePieces ? `${p.nombrePieces} ${t('proDash.conciergerie.proprietes.pieces')}` : ''}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${ETAT_COLORS[p.etatMenage] || 'bg-gray-100 text-gray-700'}`}>{ETAT_LABELS[p.etatMenage] || p.etatMenage}</span>
                </div>
                {p.adresse && <p className="text-sm text-gray-600 mb-1">📍 {p.adresse}</p>}
                {p.proprietaire && <p className="text-sm text-gray-600 mb-1">👤 {p.proprietaire}</p>}
                {p.telephone && <p className="text-sm text-gray-600 mb-1">📱 {p.telephone}</p>}
                {p.loyer && <p className="text-sm text-gray-600 mb-3">{'💰'} {t('proDash.conciergerie.proprietes.loyerLabel')} {p.loyer} {t('proDash.conciergerie.proprietes.euroMois')}</p>}
                <select value={p.etatMenage} onChange={e => updateEtat(p.id, e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:border-purple-500 outline-none mt-2">
                  {ETATS.map(e => <option key={e} value={e}>{ETAT_LABELS[e] || e}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{'🏠'} {t('proDash.conciergerie.proprietes.nouvelleProprieteModal')}</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.proprietes.nomReference')}</label>
                <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder={t('proDash.conciergerie.proprietes.nomReferencePlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.proprietes.type')}</label>
                  <select value={form.typeLogement} onChange={e => setForm({...form, typeLogement: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none">
                    {['Appartement', 'Maison', 'Studio', 'Villa', 'Loft', 'Commerce'].map(tp => <option key={tp} value={tp}>{t(`proDash.conciergerie.proprietes.${tp === 'Appartement' ? 'appartement' : tp === 'Maison' ? 'maison' : tp === 'Studio' ? 'studio' : tp === 'Villa' ? 'villa' : tp === 'Loft' ? 'loft' : 'commerce'}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.proprietes.nbPieces')}</label>
                  <input type="number" value={form.nombrePieces} onChange={e => setForm({...form, nombrePieces: e.target.value})} placeholder="3" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.proprietes.adresse')}</label>
                <input value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder={t('proDash.conciergerie.proprietes.adressePlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.proprietes.proprietaire')}</label>
                  <input value={form.proprietaire} onChange={e => setForm({...form, proprietaire: e.target.value})} placeholder={t('proDash.conciergerie.proprietes.proprietairePlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.proprietes.telephone')}</label>
                  <input value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} placeholder="06..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.proprietes.digicode')}</label>
                  <input value={form.digicode} onChange={e => setForm({...form, digicode: e.target.value})} placeholder="A1234" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.proprietes.loyer')}</label>
                  <input type="number" value={form.loyer} onChange={e => setForm({...form, loyer: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.proprietes.notesAcces')}</label>
                <textarea value={form.notesAcces} onChange={e => setForm({...form, notesAcces: e.target.value})} rows={2} placeholder={t('proDash.conciergerie.proprietes.notesAccesPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none resize-none" />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">{t('proDash.conciergerie.proprietes.annuler')}</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition">{t('proDash.conciergerie.proprietes.ajouterLaPropriete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ ACCÈS & CLÉS CONCIERGERIE SECTION ══════════ */
export function AccesConciergerieSection({ artisan }: { artisan: Artisan | null }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const storageKey = `fixit_acces_${artisan?.id}`
  const [acces, setAcces] = useState<AccesRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ propriete: '', typeAcces: 'Clé physique', localisation: '', code: '', responsable: '', notes: '', statut: 'Disponible' })

  const handleSave = () => {
    if (!form.propriete.trim()) return
    const a = { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }
    const updated = [a, ...acces]
    setAcces(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ propriete: '', typeAcces: 'Clé physique', localisation: '', code: '', responsable: '', notes: '', statut: 'Disponible' })
  }

  const STATUTS = ['Disponible', 'En prêt', 'Perdu', 'Dupliqué']
  const STATUT_LABELS: Record<string, string> = { 'Disponible': t('proDash.conciergerie.accesCles.disponible'), 'En prêt': t('proDash.conciergerie.accesCles.pret'), 'Perdu': t('proDash.conciergerie.accesCles.perdu'), 'Dupliqué': t('proDash.conciergerie.accesCles.duplique') }
  const TYPE_LABELS: Record<string, string> = { 'Clé physique': t('proDash.conciergerie.accesCles.clePhysique'), 'Digicode': t('proDash.conciergerie.accesCles.digicode'), 'Badge': t('proDash.conciergerie.accesCles.badge'), 'Application': t('proDash.conciergerie.accesCles.application'), 'Boîte à clés': t('proDash.conciergerie.accesCles.boiteACles') }
  const STATUT_COLORS: Record<string, string> = { 'Disponible': 'bg-green-100 text-green-700', 'En prêt': 'bg-yellow-100 text-yellow-700', 'Perdu': 'bg-red-100 text-red-700', 'Dupliqué': 'bg-blue-100 text-blue-700' }

  const updateStatut = (id: string, statut: string) => {
    const updated = acces.map(a => a.id === id ? { ...a, statut } : a)
    setAcces(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-purple-500 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-semibold">{'🔑'} {t('proDash.conciergerie.accesCles.title')}</h1>
        <button onClick={() => setShowModal(true)} className="bg-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-purple-700 transition shadow-sm">{t('proDash.conciergerie.accesCles.nouvelAcces')}</button>
      </div>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-green-400 text-center">
            <div className="text-2xl font-bold text-green-600">{acces.filter(a => a.statut === 'Disponible').length}</div>
            <div className="text-xs text-gray-500 mt-1">{t('proDash.conciergerie.accesCles.disponibles')}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-yellow-400 text-center">
            <div className="text-2xl font-bold text-yellow-600">{acces.filter(a => a.statut === 'En prêt').length}</div>
            <div className="text-xs text-gray-500 mt-1">{t('proDash.conciergerie.accesCles.enPret')}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-red-400 text-center">
            <div className="text-2xl font-bold text-red-600">{acces.filter(a => a.statut === 'Perdu').length}</div>
            <div className="text-xs text-gray-500 mt-1">{t('proDash.conciergerie.accesCles.perdus')}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-purple-400 text-center">
            <div className="text-2xl font-bold text-purple-600">{acces.length}</div>
            <div className="text-xs text-gray-500 mt-1">{t('proDash.conciergerie.accesCles.total')}</div>
          </div>
        </div>

        {acces.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🔑</div>
            <h3 className="text-xl font-bold mb-2">{t('proDash.conciergerie.accesCles.aucunAcces')}</h3>
            <p className="text-gray-500 mb-6">{t('proDash.conciergerie.accesCles.gerezCles')}</p>
            <button onClick={() => setShowModal(true)} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition">{t('proDash.conciergerie.accesCles.ajouterAcces')}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {acces.map(a => (
              <div key={a.id} className="bg-white rounded-2xl shadow-sm p-5 border-2 border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold">{a.propriete}</h3>
                    <span className="text-sm text-purple-600">{a.typeAcces}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUT_COLORS[a.statut] || ''}`}>{STATUT_LABELS[a.statut] || a.statut}</span>
                </div>
                {a.localisation && <p className="text-sm text-gray-600 mb-1">📍 {a.localisation}</p>}
                {a.code && <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mb-1">🔢 {a.code}</p>}
                {a.responsable && <p className="text-sm text-gray-600 mb-2">👤 {a.responsable}</p>}
                <select value={a.statut} onChange={e => updateStatut(a.id, e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold focus:border-purple-500 outline-none">
                  {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s] || s}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{'🔑'} {t('proDash.conciergerie.accesCles.nouvelAccesModal')}</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.accesCles.propriete')}</label>
                <input value={form.propriete} onChange={e => setForm({...form, propriete: e.target.value})} placeholder={t('proDash.conciergerie.accesCles.nomPropriete')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.accesCles.typeAcces')}</label>
                  <select value={form.typeAcces} onChange={e => setForm({...form, typeAcces: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none">
                    {['Clé physique', 'Digicode', 'Badge', 'Application', 'Boîte à clés'].map(ta => <option key={ta} value={ta}>{TYPE_LABELS[ta] || ta}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.accesCles.codeReference')}</label>
                  <input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="A1234 / #5" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.accesCles.localisation')}</label>
                <input value={form.localisation} onChange={e => setForm({...form, localisation: e.target.value})} placeholder={t('proDash.conciergerie.accesCles.localisationPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.accesCles.responsable')}</label>
                <input value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})} placeholder={t('proDash.conciergerie.accesCles.nomResponsable')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.conciergerie.accesCles.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder={t('proDash.conciergerie.accesCles.notesPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none resize-none" />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">{t('proDash.conciergerie.accesCles.annuler')}</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition">{t('proDash.conciergerie.accesCles.enregistrer')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ IMMEUBLES GESTIONNAIRE SECTION ══════════ */

export function ChannelManagerSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `channel_${userId}`
  interface Reservation {
    id: string; plateforme: 'airbnb' | 'booking' | 'vrbo' | 'direct' | 'abritel' | 'autre'
    logement: string; client: string; dateArrivee: string; dateDepart: string
    montantTotal: number; commission: number; statut: 'confirmée' | 'en_attente' | 'annulée'; notes: string
  }
  const [reservations, setReservations] = useState<Reservation[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [filterP, setFilterP] = useState('')
  const [form, setForm] = useState<Omit<Reservation, 'id'>>({ plateforme: 'airbnb', logement: '', client: '', dateArrivee: '', dateDepart: '', montantTotal: 0, commission: 0, statut: 'confirmée', notes: '' })

  const save = (data: Reservation[]) => { setReservations(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addResa = () => { save([...reservations, { ...form, id: Date.now().toString() }]); setShowForm(false); setForm({ plateforme: 'airbnb', logement: '', client: '', dateArrivee: '', dateDepart: '', montantTotal: 0, commission: 0, statut: 'confirmée', notes: '' }) }
  const deleteResa = (id: string) => save(reservations.filter(r => r.id !== id))

  const plateformes = ['airbnb', 'booking', 'vrbo', 'direct', 'abritel', 'autre'] as const
  const platColors: Record<string, string> = { airbnb: 'bg-pink-100 text-pink-700', booking: 'bg-blue-100 text-blue-700', vrbo: 'bg-teal-100 text-teal-700', direct: 'bg-green-100 text-green-700', abritel: 'bg-orange-100 text-orange-700', autre: 'bg-gray-100 text-gray-700' }
  const filtered = reservations.filter(r => !filterP || r.plateforme === filterP)
  const confirmed = filtered.filter(r => r.statut === 'confirmée')
  const totalCA = confirmed.reduce((s, r) => s + r.montantTotal, 0)
  const totalComm = confirmed.reduce((s, r) => s + r.commission, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'🌐'} {t('proDash.conciergerie.channelManager.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.conciergerie.channelManager.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.conciergerie.channelManager.nouvelleReservation')}</button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4"><div className="text-blue-600 text-sm font-medium">{t('proDash.conciergerie.channelManager.caTotal')}</div><div className="text-2xl font-bold text-blue-700 mt-1">{totalCA.toLocaleString(dateLocale)} €</div></div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4"><div className="text-orange-600 text-sm font-medium">{t('proDash.conciergerie.channelManager.commissions')}</div><div className="text-2xl font-bold text-orange-700 mt-1">{totalComm.toLocaleString(dateLocale)} €</div></div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4"><div className="text-green-600 text-sm font-medium">{t('proDash.conciergerie.channelManager.netPercu')}</div><div className="text-2xl font-bold text-green-700 mt-1">{(totalCA - totalComm).toLocaleString(dateLocale)} €</div></div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4"><div className="text-purple-600 text-sm font-medium">{t('proDash.conciergerie.channelManager.reservations')}</div><div className="text-2xl font-bold text-purple-700 mt-1">{confirmed.length}</div></div>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.channelManager.plateforme')}</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.plateforme} onChange={e => setForm({...form, plateforme: e.target.value as Reservation['plateforme']})}>{plateformes.map(p => <option key={p}>{p}</option>)}</select></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.channelManager.logement')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.logement} onChange={e => setForm({...form, logement: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.channelManager.client')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.channelManager.arrivee')}</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.dateArrivee} onChange={e => setForm({...form, dateArrivee: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.channelManager.depart')}</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.dateDepart} onChange={e => setForm({...form, dateDepart: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.channelManager.statut')}</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.statut} onChange={e => setForm({...form, statut: e.target.value as Reservation['statut']})}><option value="confirmée">{t('proDash.conciergerie.channelManager.confirmee')}</option><option value="en_attente">{t('proDash.conciergerie.channelManager.enAttente')}</option><option value="annulée">{t('proDash.conciergerie.channelManager.annulee')}</option></select></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.channelManager.montantTotal')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.montantTotal} onChange={e => setForm({...form, montantTotal: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.channelManager.commission')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.commission} onChange={e => setForm({...form, commission: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.channelManager.notesLabel')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addResa} disabled={!form.logement || !form.client} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.conciergerie.channelManager.ajouter')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.conciergerie.channelManager.annuler')}</button>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => setFilterP('')} className={`px-3 py-1 rounded-full text-sm font-medium ${!filterP ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{t('proDash.conciergerie.channelManager.toutes')}</button>
        {plateformes.map(p => <button key={p} onClick={() => setFilterP(p)} className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${filterP === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{p}</button>)}
      </div>
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b"><tr>{[t('proDash.conciergerie.channelManager.colPlateforme'), t('proDash.conciergerie.channelManager.colLogement'), t('proDash.conciergerie.channelManager.colClient'), t('proDash.conciergerie.channelManager.colArrivee'), t('proDash.conciergerie.channelManager.colDepart'), t('proDash.conciergerie.channelManager.colMontant'), t('proDash.conciergerie.channelManager.colCommission'), t('proDash.conciergerie.channelManager.colStatut'), ''].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-600 px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? <tr><td colSpan={9} className="text-center py-10 text-gray-500 text-sm">{t('proDash.conciergerie.channelManager.aucuneReservation')}</td></tr> : filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${platColors[r.plateforme]}`}>{r.plateforme}</span></td>
                <td className="px-4 py-3 text-sm font-medium">{r.logement}</td>
                <td className="px-4 py-3 text-sm">{r.client}</td>
                <td className="px-4 py-3 text-sm">{r.dateArrivee ? new Date(r.dateArrivee).toLocaleDateString(dateLocale) : '—'}</td>
                <td className="px-4 py-3 text-sm">{r.dateDepart ? new Date(r.dateDepart).toLocaleDateString(dateLocale) : '—'}</td>
                <td className="px-4 py-3 text-sm font-semibold">{r.montantTotal.toLocaleString(dateLocale)} €</td>
                <td className="px-4 py-3 text-sm text-orange-600">{r.commission.toLocaleString(dateLocale)} €</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.statut === 'confirmée' ? 'bg-green-100 text-green-700' : r.statut === 'en_attente' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{r.statut}</span></td>
                <td className="px-4 py-3"><button onClick={() => deleteResa(r.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONCIERGERIE — TARIFICATION DYNAMIQUE
// ══════════════════════════════════════════════
export function TarificationSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `tarif_${userId}`
  interface TarifLog { id: string; logement: string; prixBase: number; prixWeekend: number; prixSaison: Record<string, number>; menage: number; caution: number; sejMinNuits: number }
  const [tarifs, setTarifs] = useState<TarifLog[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<TarifLog | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ logement: '', prixBase: 80, prixWeekend: 120, menage: 50, caution: 300, sejMinNuits: 2 })
  const [saisonNom, setSaisonNom] = useState('')
  const [saisonPrix, setSaisonPrix] = useState(0)

  const save = (data: TarifLog[]) => { setTarifs(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const createTarif = () => {
    const tr: TarifLog = { id: Date.now().toString(), ...form, prixSaison: {} }
    save([...tarifs, tr]); setSelected(tr); setShowForm(false)
  }
  const addSaison = () => {
    if (!selected || !saisonNom) return
    const updated = { ...selected, prixSaison: { ...selected.prixSaison, [saisonNom]: saisonPrix } }
    save(tarifs.map(tr => tr.id === selected.id ? updated : tr)); setSelected(updated); setSaisonNom(''); setSaisonPrix(0)
  }
  const updateField = (id: string, field: keyof TarifLog, value: number) => {
    const upd = tarifs.map(tr => tr.id === id ? { ...tr, [field]: value } : tr)
    save(upd); const found = upd.find(tr => tr.id === id); if (found) setSelected(found)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'💰'} {t('proDash.conciergerie.tarification.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.conciergerie.tarification.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.conciergerie.tarification.ajouterLogement')}</button>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3"><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.tarification.nomLogement')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.logement} onChange={e => setForm({...form, logement: e.target.value})} placeholder={t('proDash.conciergerie.tarification.nomLogementPlaceholder')} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.tarification.prixNuitBase')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.prixBase} onChange={e => setForm({...form, prixBase: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.tarification.prixWeekend')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.prixWeekend} onChange={e => setForm({...form, prixWeekend: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.tarification.fraisMenage')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.menage} onChange={e => setForm({...form, menage: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.tarification.caution')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.caution} onChange={e => setForm({...form, caution: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.tarification.sejourMin')}</label><input type="number" min="1" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.sejMinNuits} onChange={e => setForm({...form, sejMinNuits: Number(e.target.value)})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={createTarif} disabled={!form.logement} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.conciergerie.tarification.creer')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.conciergerie.tarification.annuler')}</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-3">
          {tarifs.length === 0 ? <div className="text-center py-8 text-gray-500 text-sm">{t('proDash.conciergerie.tarification.aucunLogement')}</div> : tarifs.map(tr => (
            <div key={tr.id} onClick={() => setSelected(tr)} className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-300 ${selected?.id === tr.id ? 'border-blue-500 ring-1 ring-blue-200' : ''}`}>
              <div className="font-semibold text-sm">{tr.logement}</div>
              <div className="flex gap-3 mt-1 text-sm text-gray-600"><span>{'🌙'} {tr.prixBase}€{t('proDash.conciergerie.tarification.nuitAbrev')}</span><span>{'🎉'} {tr.prixWeekend}€ {t('proDash.conciergerie.tarification.weAbrev')}</span></div>
              <div className="text-xs text-gray-500 mt-1">{t('proDash.conciergerie.tarification.menageEuro')} {tr.menage}€ · {t('proDash.conciergerie.tarification.minNuitAbrev')} {tr.sejMinNuits} {t('proDash.conciergerie.tarification.nuits')}</div>
            </div>
          ))}
        </div>
        <div className="col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
              <h3 className="font-bold">{selected.logement}</h3>
              <div className="grid grid-cols-3 gap-4">
                {([[t('proDash.conciergerie.tarification.prixBase'), 'prixBase'], [t('proDash.conciergerie.tarification.prixWE'), 'prixWeekend'], [t('proDash.conciergerie.tarification.menage'), 'menage'], [t('proDash.conciergerie.tarification.caution'), 'caution'], [t('proDash.conciergerie.tarification.minNuits'), 'sejMinNuits']] as [string, keyof TarifLog][]).map(([label, field]) => (
                  <div key={String(field)}><label className="text-xs font-medium text-gray-600">{label}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={selected[field] as number} onChange={e => updateField(selected.id, field, Number(e.target.value))} /></div>
                ))}
              </div>
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-700 mb-3">{t('proDash.conciergerie.tarification.tarifsSaisonniers')}</h4>
                {Object.entries(selected.prixSaison).map(([s, p]) => (
                  <div key={s} className="flex justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-2"><span className="font-medium text-sm">{s}</span><span className="font-bold text-yellow-700">{p} {t('proDash.conciergerie.tarification.euroNuit')}</span></div>
                ))}
                <div className="flex gap-2 mt-2">
                  <input className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder={t('proDash.conciergerie.tarification.nomSaisonPlaceholder')} value={saisonNom} onChange={e => setSaisonNom(e.target.value)} />
                  <input type="number" className="w-24 border rounded-lg px-3 py-2 text-sm" placeholder={t('proDash.conciergerie.tarification.euroNuit')} value={saisonPrix || ''} onChange={e => setSaisonPrix(Number(e.target.value))} />
                  <button onClick={addSaison} disabled={!saisonNom} className="bg-yellow-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50">+</button>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2">{t('proDash.conciergerie.tarification.simulation7nuits')}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">{t('proDash.conciergerie.tarification.nuitsX')} {selected.prixBase}€</span><span className="font-semibold">{7 * selected.prixBase} €</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">{t('proDash.conciergerie.tarification.plusMenage')}</span><span className="font-semibold">{selected.menage} €</span></div>
                  <div className="flex justify-between font-bold"><span>{t('proDash.conciergerie.tarification.totalVoyageur')}</span><span className="text-blue-700">{7 * selected.prixBase + selected.menage} €</span></div>
                </div>
              </div>
            </div>
          ) : <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center h-64 text-gray-500"><div className="text-center"><div className="text-4xl mb-2">{'💰'}</div><p>{t('proDash.conciergerie.tarification.selectLogement')}</p></div></div>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONCIERGERIE — CHECK-IN / CHECK-OUT
// ══════════════════════════════════════════════
export function CheckinOutSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `checkinout_${userId}`
  interface Passage {
    id: string; type: 'checkin' | 'checkout'; logement: string; client: string
    date: string; heure: string; statut: 'planifié' | 'effectué' | 'annulé'
    codeAcces: string; notes: string; etat: string[]
  }
  const [passages, setPassages] = useState<Passage[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [form, setForm] = useState<Omit<Passage, 'id'>>({ type: 'checkin', logement: '', client: '', date: new Date().toISOString().split('T')[0], heure: '15:00', statut: 'planifié', codeAcces: '', notes: '', etat: [] })

  const save = (data: Passage[]) => { setPassages(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addPassage = () => { save([...passages, { ...form, id: Date.now().toString() }]); setShowForm(false) }
  const changeStatut = (id: string, statut: Passage['statut']) => save(passages.map(p => p.id === id ? { ...p, statut } : p))
  const toggleCheck = (pid: string, item: string) => save(passages.map(p => p.id === pid ? { ...p, etat: p.etat.includes(item) ? p.etat.filter(e => e !== item) : [...p.etat, item] } : p))

  const filtered = passages.filter(p => !filterDate || p.date === filterDate)
  const today = new Date().toISOString().split('T')[0]
  const etatItems = ['Ménage OK', 'Clés remises', 'Inventaire fait', 'Caution encaissée', 'Livret remis', 'Photos état']
  const etatLabels: Record<string, string> = { 'Ménage OK': t('proDash.conciergerie.checkinOut.menageOK'), 'Clés remises': t('proDash.conciergerie.checkinOut.clesRemises'), 'Inventaire fait': t('proDash.conciergerie.checkinOut.inventaireFait'), 'Caution encaissée': t('proDash.conciergerie.checkinOut.cautionEncaissee'), 'Livret remis': t('proDash.conciergerie.checkinOut.livretRemis'), 'Photos état': t('proDash.conciergerie.checkinOut.photosEtat') }
  const statutLabels: Record<string, string> = { 'planifié': t('proDash.conciergerie.checkinOut.planifie'), 'effectué': t('proDash.conciergerie.checkinOut.effectue'), 'annulé': t('proDash.conciergerie.checkinOut.annule') }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'✅'} {t('proDash.conciergerie.checkinOut.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.conciergerie.checkinOut.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.conciergerie.checkinOut.planifier')}</button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[[t('proDash.conciergerie.checkinOut.checkinsAujourdhui'), passages.filter(p => p.date === today && p.type === 'checkin').length, 'bg-blue-50 border-blue-200 text-blue-700'], [t('proDash.conciergerie.checkinOut.checkoutsAujourdhui'), passages.filter(p => p.date === today && p.type === 'checkout').length, 'bg-orange-50 border-orange-200 text-orange-700'], [t('proDash.conciergerie.checkinOut.planifies'), passages.filter(p => p.statut === 'planifié').length, 'bg-yellow-50 border-yellow-200 text-yellow-700'], [t('proDash.conciergerie.checkinOut.effectues'), passages.filter(p => p.statut === 'effectué').length, 'bg-green-50 border-green-200 text-green-700']].map(([label, val, cls]) => (
          <div key={String(label)} className={`border rounded-xl p-4 ${cls}`}><div className="text-sm font-medium">{label}</div><div className="text-2xl font-bold mt-1">{val}</div></div>
        ))}
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.checkinOut.type')}</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={e => setForm({...form, type: e.target.value as 'checkin' | 'checkout'})}><option value="checkin">{'✅'} {t('proDash.conciergerie.checkinOut.checkin')}</option><option value="checkout">{'🚪'} {t('proDash.conciergerie.checkinOut.checkout')}</option></select></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.checkinOut.logement')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.logement} onChange={e => setForm({...form, logement: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.checkinOut.client')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.checkinOut.date')}</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.checkinOut.heure')}</label><input type="time" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.heure} onChange={e => setForm({...form, heure: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.checkinOut.codeAcces')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.codeAcces} onChange={e => setForm({...form, codeAcces: e.target.value})} placeholder="1234" /></div>
            <div className="col-span-3"><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.checkinOut.notesLabel')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addPassage} disabled={!form.logement || !form.client} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.conciergerie.checkinOut.planifierBtn')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.conciergerie.checkinOut.annuler')}</button>
          </div>
        </div>
      )}
      <div className="flex gap-3 items-center">
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        <button onClick={() => setFilterDate('')} className="text-sm text-blue-600">{t('proDash.conciergerie.checkinOut.toutVoir')}</button>
      </div>
      <div className="space-y-3">
        {filtered.length === 0 ? <div className="text-center py-12 text-gray-500"><div className="text-4xl mb-2">{'🔑'}</div><p>{t('proDash.conciergerie.checkinOut.aucunPassage')}</p></div> : filtered.sort((a, b) => a.heure.localeCompare(b.heure)).map(p => (
          <div key={p.id} className={`bg-white rounded-xl border p-4 shadow-sm ${p.statut === 'effectué' ? 'opacity-70' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`text-2xl w-12 h-12 rounded-full flex items-center justify-center ${p.type === 'checkin' ? 'bg-blue-100' : 'bg-orange-100'}`}>{p.type === 'checkin' ? '✅' : '🚪'}</div>
                <div>
                  <div className="font-semibold">{p.type === 'checkin' ? t('proDash.conciergerie.checkinOut.checkin') : t('proDash.conciergerie.checkinOut.checkout')} — {p.client}</div>
                  <div className="text-sm text-gray-600">{p.logement} · {p.heure}</div>
                  {p.codeAcces && <div className="text-xs text-gray-500">{'🔐'} {t('proDash.conciergerie.checkinOut.code')} {p.codeAcces}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.statut === 'planifié' ? 'bg-yellow-100 text-yellow-700' : p.statut === 'effectué' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{statutLabels[p.statut] || p.statut}</span>
                {p.statut === 'planifié' && <button onClick={() => changeStatut(p.id, 'effectué')} className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 font-medium">{t('proDash.conciergerie.checkinOut.marquerEffectue')}</button>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {etatItems.map(item => (
                <label key={item} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={p.etat.includes(item)} onChange={() => toggleCheck(p.id, item)} className="w-3.5 h-3.5 accent-blue-600" />
                  <span className="text-xs text-gray-600">{etatLabels[item] || item}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONCIERGERIE — LIVRET D'ACCUEIL DIGITAL
// ══════════════════════════════════════════════
export function LivretAccueilSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `livret_${userId}`
  interface Livret { id: string; logement: string; wifi: string; wifiMdp: string; codeAcces: string; reglement: string; instructions: string; urgences: string; transports: string; restaurants: string; contact: string }
  const [livrets, setLivrets] = useState<Livret[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<Livret | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [newLogement, setNewLogement] = useState('')

  const emptyLivret = (logement: string): Livret => ({ id: Date.now().toString(), logement, wifi: '', wifiMdp: '', codeAcces: '', reglement: '', instructions: '', urgences: 'SAMU 15 · Police 17 · Pompiers 18 · Urgences 112', transports: '', restaurants: '', contact: '' })
  const save = (data: Livret[]) => { setLivrets(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const createLivret = () => { const l = emptyLivret(newLogement); save([...livrets, l]); setSelected(l); setShowForm(false); setNewLogement('') }
  const updateLivret = (field: keyof Livret, value: string) => {
    if (!selected) return
    const updated = { ...selected, [field]: value }
    save(livrets.map(l => l.id === selected.id ? updated : l)); setSelected(updated)
  }
  const copyLivret = (l: Livret) => {
    const text = `🏠 ${t('proDash.conciergerie.livret.bienvenue')} — ${l.logement}\n\n📶 WiFi : ${l.wifi}\n🔑 ${t('proDash.conciergerie.livret.motDePasse')} : ${l.wifiMdp}\n🔐 ${t('proDash.conciergerie.livret.codeAcces')} : ${l.codeAcces}\n\n📋 ${t('proDash.conciergerie.livret.reglement').toUpperCase()}\n${l.reglement}\n\n📖 ${t('proDash.conciergerie.livret.instructions').toUpperCase()}\n${l.instructions}\n\n🚨 ${t('proDash.conciergerie.livret.urgences').toUpperCase()}\n${l.urgences}\n\n🚌 ${t('proDash.conciergerie.livret.transports').toUpperCase()}\n${l.transports}\n\n🍽️ ${t('proDash.conciergerie.livret.restaurants').toUpperCase()}\n${l.restaurants}\n\n📞 CONTACT\n${l.contact}`
    navigator.clipboard.writeText(text).then(() => alert(t('proDash.conciergerie.livret.livretCopie')))
  }

  const fields: [string, keyof Livret, string, boolean][] = [
    [`📶 ${t('proDash.conciergerie.livret.nomWifi')}`, 'wifi', t('proDash.conciergerie.livret.placeholderWifi'), false],
    [`🔑 ${t('proDash.conciergerie.livret.mdpWifi')}`, 'wifiMdp', t('proDash.conciergerie.livret.placeholderMdp'), false],
    [`🔐 ${t('proDash.conciergerie.livret.codeAcces')}`, 'codeAcces', t('proDash.conciergerie.livret.placeholderCode'), false],
    [`📞 ${t('proDash.conciergerie.livret.contactConcierge')}`, 'contact', t('proDash.conciergerie.livret.placeholderContact'), false],
    [`📋 ${t('proDash.conciergerie.livret.reglement')}`, 'reglement', t('proDash.conciergerie.livret.placeholderReglement'), true],
    [`📖 ${t('proDash.conciergerie.livret.instructions')}`, 'instructions', t('proDash.conciergerie.livret.placeholderInstructions'), true],
    [`🚨 ${t('proDash.conciergerie.livret.urgences')}`, 'urgences', t('proDash.conciergerie.livret.placeholderUrgences'), true],
    [`🚌 ${t('proDash.conciergerie.livret.transports')}`, 'transports', t('proDash.conciergerie.livret.placeholderTransports'), true],
    [`🍽️ ${t('proDash.conciergerie.livret.restaurants')}`, 'restaurants', t('proDash.conciergerie.livret.placeholderRestaurants'), true],
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'📖'} {t('proDash.conciergerie.livret.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.conciergerie.livret.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.conciergerie.livret.creerLivret')}</button>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.livret.nomLogement')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={newLogement} onChange={e => setNewLogement(e.target.value)} placeholder={t('proDash.conciergerie.livret.nomLogementPlaceholder')} /></div>
          <div className="flex gap-3 mt-4">
            <button onClick={createLivret} disabled={!newLogement} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.conciergerie.livret.creer')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.conciergerie.livret.annuler')}</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-3">
          {livrets.length === 0 ? <div className="text-center py-8 text-gray-500 text-sm">{t('proDash.conciergerie.livret.aucunLivret')}</div> : livrets.map(l => (
            <div key={l.id} onClick={() => setSelected(l)} className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-300 ${selected?.id === l.id ? 'border-blue-500 ring-1 ring-blue-200' : ''}`}>
              <div className="font-semibold text-sm">{l.logement}</div>
              <div className="text-xs text-gray-500 mt-1">{'📶'} {l.wifi || t('proDash.conciergerie.livret.wifiNonRenseigne')}</div>
              <button onClick={e => { e.stopPropagation(); copyLivret(l) }} className="mt-2 text-xs text-blue-600 hover:text-blue-800">{'📋'} {t('proDash.conciergerie.livret.copierLivret')}</button>
            </div>
          ))}
        </div>
        <div className="col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-3">
              <h3 className="font-bold text-lg">{selected.logement}</h3>
              <div className="grid grid-cols-2 gap-4">
                {fields.filter(([,,, isTextarea]) => !isTextarea).map(([label, field, placeholder]) => (
                  <div key={String(field)}><label className="text-xs font-medium text-gray-600">{label}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={selected[field]} onChange={e => updateLivret(field, e.target.value)} placeholder={placeholder} /></div>
                ))}
              </div>
              {fields.filter(([,,, isTextarea]) => isTextarea).map(([label, field, placeholder]) => (
                <div key={String(field)}><label className="text-xs font-medium text-gray-600">{label}</label><textarea className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={2} value={selected[field]} onChange={e => updateLivret(field, e.target.value)} placeholder={placeholder} /></div>
              ))}
              <button onClick={() => copyLivret(selected)} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700">{'📋'} {t('proDash.conciergerie.livret.copierComplet')}</button>
            </div>
          ) : <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center h-64 text-gray-500"><div className="text-center"><div className="text-4xl mb-2">{'📖'}</div><p>{t('proDash.conciergerie.livret.selectionnerLivret')}</p></div></div>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONCIERGERIE — PLANNING MÉNAGE
// ══════════════════════════════════════════════
export function PlanningMenageSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `menage_${userId}`
  interface TacheMenage { id: string; logement: string; date: string; heure: string; prestataire: string; statut: 'à_faire' | 'en_cours' | 'fait' | 'vérifié'; type: 'arrivée' | 'départ' | 'recouche' | 'entretien'; notes: string; checklist: string[] }
  const [taches, setTaches] = useState<TacheMenage[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [form, setForm] = useState<Omit<TacheMenage, 'id' | 'checklist'>>({ logement: '', date: new Date().toISOString().split('T')[0], heure: '11:00', prestataire: '', statut: 'à_faire', type: 'départ', notes: '' })

  const save = (data: TacheMenage[]) => { setTaches(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addTache = () => { save([...taches, { ...form, id: Date.now().toString(), checklist: [] }]); setShowForm(false) }
  const toggleCheck = (tid: string, item: string) => save(taches.map(tc => tc.id === tid ? { ...tc, checklist: tc.checklist.includes(item) ? tc.checklist.filter(c => c !== item) : [...tc.checklist, item] } : tc))
  const changeStatut = (id: string, statut: TacheMenage['statut']) => save(taches.map(tc => tc.id === id ? { ...tc, statut } : tc))

  const filtered = taches.filter(tc => !filterDate || tc.date === filterDate)
  const checklistItems = ['Chambres', 'Salle de bain', 'Cuisine', 'Salon', 'Poubelles vidées', 'Linge changé', 'Serviettes propres', 'Inventaire vérifié']
  const checkLabels: Record<string, string> = { 'Chambres': t('proDash.conciergerie.planningMenage.chambres'), 'Salle de bain': t('proDash.conciergerie.planningMenage.salleDeBain'), 'Cuisine': t('proDash.conciergerie.planningMenage.cuisine'), 'Salon': t('proDash.conciergerie.planningMenage.salon'), 'Poubelles vidées': t('proDash.conciergerie.planningMenage.poubellesVidées'), 'Linge changé': t('proDash.conciergerie.planningMenage.lingeChange'), 'Serviettes propres': t('proDash.conciergerie.planningMenage.serviettesPropres'), 'Inventaire vérifié': t('proDash.conciergerie.planningMenage.inventaireVerifie') }
  const typeLabels: Record<string, string> = { 'arrivée': t('proDash.conciergerie.planningMenage.arriveeType'), 'départ': t('proDash.conciergerie.planningMenage.departType'), 'recouche': t('proDash.conciergerie.planningMenage.recoucheType'), 'entretien': t('proDash.conciergerie.planningMenage.entretienType') }
  const statLabels: Record<string, string> = { 'à_faire': t('proDash.conciergerie.planningMenage.aFaire'), 'en_cours': t('proDash.conciergerie.planningMenage.enCours'), 'fait': t('proDash.conciergerie.planningMenage.fait'), 'vérifié': t('proDash.conciergerie.planningMenage.verifie') }
  const typeColors: Record<string, string> = { arrivée: 'bg-blue-100 text-blue-700', départ: 'bg-orange-100 text-orange-700', recouche: 'bg-purple-100 text-purple-700', entretien: 'bg-gray-100 text-gray-700' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'🧹'} {t('proDash.conciergerie.planningMenage.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.conciergerie.planningMenage.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.conciergerie.planningMenage.planifierMenage')}</button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[[t('proDash.conciergerie.planningMenage.aFaire'), 'à_faire', 'bg-yellow-50 border-yellow-200 text-yellow-700'], [t('proDash.conciergerie.planningMenage.enCours'), 'en_cours', 'bg-blue-50 border-blue-200 text-blue-700'], [t('proDash.conciergerie.planningMenage.fait'), 'fait', 'bg-green-50 border-green-200 text-green-700'], [t('proDash.conciergerie.planningMenage.verifie'), 'vérifié', 'bg-purple-50 border-purple-200 text-purple-700']].map(([label, statut, cls]) => (
          <div key={String(statut)} className={`border rounded-xl p-4 ${cls}`}><div className="text-sm font-medium">{label}</div><div className="text-2xl font-bold mt-1">{taches.filter(tc => tc.statut === statut).length}</div></div>
        ))}
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.planningMenage.logement')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.logement} onChange={e => setForm({...form, logement: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.planningMenage.type')}</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={e => setForm({...form, type: e.target.value as TacheMenage['type']})}><option value="départ">{'🚪'} {t('proDash.conciergerie.planningMenage.menageDepart')}</option><option value="arrivée">{'✅'} {t('proDash.conciergerie.planningMenage.prepaArrivee')}</option><option value="recouche">{'🔄'} {t('proDash.conciergerie.planningMenage.recouche')}</option><option value="entretien">{'🧽'} {t('proDash.conciergerie.planningMenage.entretien')}</option></select></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.planningMenage.prestataire')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.prestataire} onChange={e => setForm({...form, prestataire: e.target.value})} placeholder={t('proDash.conciergerie.planningMenage.prestatairePlaceholder')} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.planningMenage.date')}</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.planningMenage.heure')}</label><input type="time" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.heure} onChange={e => setForm({...form, heure: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.conciergerie.planningMenage.notesLabel')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addTache} disabled={!form.logement} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.conciergerie.planningMenage.planifierBtn')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.conciergerie.planningMenage.annuler')}</button>
          </div>
        </div>
      )}
      <div className="flex gap-3 items-center">
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        <button onClick={() => setFilterDate('')} className="text-sm text-blue-600">{t('proDash.conciergerie.planningMenage.toutVoir')}</button>
        <span className="text-sm text-gray-500">{filtered.length} {t('proDash.conciergerie.planningMenage.taches')}</span>
      </div>
      <div className="space-y-3">
        {filtered.length === 0 ? <div className="text-center py-12 text-gray-500"><div className="text-4xl mb-2">{'🧹'}</div><p>{t('proDash.conciergerie.planningMenage.aucuneTache')}</p></div> : filtered.sort((a, b) => a.heure.localeCompare(b.heure)).map(tc => (
          <div key={tc.id} className={`bg-white rounded-xl border p-4 shadow-sm ${tc.statut === 'vérifié' ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{'🧹'}</div>
                <div>
                  <div className="flex items-center gap-2"><span className="font-semibold">{tc.logement}</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[tc.type]}`}>{typeLabels[tc.type] || tc.type}</span></div>
                  <div className="text-sm text-gray-600">{tc.heure} · {tc.prestataire || t('proDash.conciergerie.planningMenage.nonAssigne')}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tc.statut === 'à_faire' ? 'bg-yellow-100 text-yellow-700' : tc.statut === 'en_cours' ? 'bg-blue-100 text-blue-700' : tc.statut === 'fait' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>{statLabels[tc.statut] || tc.statut.replace('_', ' ')}</span>
                {tc.statut === 'à_faire' && <button onClick={() => changeStatut(tc.id, 'en_cours')} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">{t('proDash.conciergerie.planningMenage.demarrer')}</button>}
                {tc.statut === 'en_cours' && <button onClick={() => changeStatut(tc.id, 'fait')} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">{t('proDash.conciergerie.planningMenage.terminer')}</button>}
                {tc.statut === 'fait' && <button onClick={() => changeStatut(tc.id, 'vérifié')} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">{t('proDash.conciergerie.planningMenage.verifier')}</button>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {checklistItems.map(item => (
                <label key={item} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={tc.checklist.includes(item)} onChange={() => toggleCheck(tc.id, item)} className="w-3.5 h-3.5 accent-green-600" />
                  <span className={`text-xs ${tc.checklist.includes(item) ? 'text-green-600 line-through' : 'text-gray-600'}`}>{checkLabels[item] || item}</span>
                </label>
              ))}
            </div>
            <div className="mt-1 text-xs text-gray-500">{tc.checklist.length}/{checklistItems.length} {t('proDash.conciergerie.planningMenage.valides')} · {Math.round(tc.checklist.length / checklistItems.length * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONCIERGERIE — REVPAR / REPORTING
// ══════════════════════════════════════════════
export function RevPARSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY_CHANNEL = `channel_${userId}`
  const [reservations] = useState<ConciergerieReservation[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_CHANNEL) || '[]') } catch { return [] }
  })
  const [filterLogement, setFilterLogement] = useState('')
  const [filterMois, setFilterMois] = useState(new Date().toISOString().slice(0, 7))

  const logements = [...new Set(reservations.map((r: ConciergerieReservation) => r.logement).filter(Boolean))]
  const resaFiltered = reservations.filter((r: ConciergerieReservation) => {
    const inMois = !filterMois || (r.dateArrivee && r.dateArrivee.startsWith(filterMois))
    const inLog = !filterLogement || r.logement === filterLogement
    return inMois && inLog && r.statut === 'confirmée'
  })
  const getNuits = (r: ConciergerieReservation) => {
    if (!r.dateArrivee || !r.dateDepart) return 0
    return Math.max(0, (new Date(r.dateDepart).getTime() - new Date(r.dateArrivee).getTime()) / 86400000)
  }
  const totalNuits = resaFiltered.reduce((s: number, r: ConciergerieReservation) => s + getNuits(r), 0)
  const totalCA = resaFiltered.reduce((s: number, r: ConciergerieReservation) => s + (r.montantTotal || 0), 0)
  const totalCommissions = resaFiltered.reduce((s: number, r: ConciergerieReservation) => s + (r.commission || 0), 0)
  const [yr, mo] = filterMois ? filterMois.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1]
  const daysInMonth = new Date(yr, mo, 0).getDate()
  const logCount = filterLogement ? 1 : Math.max(1, logements.length)
  const totalDisponible = daysInMonth * logCount
  const tauxOccupation = totalDisponible > 0 ? Math.round((totalNuits / totalDisponible) * 100) : 0
  const revpar = totalDisponible > 0 ? Math.round(totalCA / totalDisponible) : 0
  const adr = totalNuits > 0 ? Math.round(totalCA / totalNuits) : 0

  const plateformes = ['airbnb', 'booking', 'vrbo', 'direct', 'abritel', 'autre']
  const byPlateforme = plateformes.map(p => ({
    p, count: resaFiltered.filter((r: ConciergerieReservation) => r.plateforme === p).length,
    ca: resaFiltered.filter((r: ConciergerieReservation) => r.plateforme === p).reduce((s: number, r: ConciergerieReservation) => s + (r.montantTotal || 0), 0),
    nuits: resaFiltered.filter((r: ConciergerieReservation) => r.plateforme === p).reduce((s: number, r: ConciergerieReservation) => s + getNuits(r), 0)
  })).filter(p => p.count > 0)

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">{'📈'} {t('proDash.conciergerie.revpar.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.conciergerie.revpar.subtitle')}</p></div>
      <div className="flex gap-3">
        <div><label className="text-xs font-medium text-gray-600">{t('proDash.conciergerie.revpar.mois')}</label><input type="month" className="mt-1 border rounded-lg px-3 py-2 text-sm" value={filterMois} onChange={e => setFilterMois(e.target.value)} /></div>
        <div><label className="text-xs font-medium text-gray-600">{t('proDash.conciergerie.revpar.logement')}</label><select className="mt-1 border rounded-lg px-3 py-2 text-sm" value={filterLogement} onChange={e => setFilterLogement(e.target.value)}><option value="">{t('proDash.conciergerie.revpar.tous')} ({logements.length})</option>{logements.map(l => <option key={l}>{l}</option>)}</select></div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[
          [t('proDash.conciergerie.revpar.revpar'), `${revpar} €`, t('proDash.conciergerie.revpar.revenuParNuit'), 'bg-blue-50 border-blue-200 text-blue-700'],
          [t('proDash.conciergerie.revpar.adr'), `${adr} €`, t('proDash.conciergerie.revpar.prixMoyenNuit'), 'bg-purple-50 border-purple-200 text-purple-700'],
          [t('proDash.conciergerie.revpar.tauxOccupation'), `${tauxOccupation}%`, `${totalNuits}/${totalDisponible} ${t('proDash.conciergerie.revpar.nuits')}`, 'bg-green-50 border-green-200 text-green-700'],
          [t('proDash.conciergerie.revpar.caBrut'), `${totalCA.toLocaleString(dateLocale)} €`, `${t('proDash.conciergerie.revpar.net')} ${(totalCA - totalCommissions).toLocaleString(dateLocale)} €`, 'bg-orange-50 border-orange-200 text-orange-700'],
        ].map(([label, value, sub, cls]) => (
          <div key={String(label)} className={`border rounded-xl p-5 ${cls}`}>
            <div className="text-sm font-semibold">{label}</div>
            <div className="text-3xl font-bold mt-2">{value}</div>
            <div className="text-xs mt-1 opacity-75">{sub}</div>
          </div>
        ))}
      </div>
      {byPlateforme.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{t('proDash.conciergerie.revpar.performancePlateforme')}</h3>
          <div className="space-y-3">
            {byPlateforme.map(p => {
              const pct = totalCA > 0 ? Math.round(p.ca / totalCA * 100) : 0
              return (
                <div key={p.p} className="flex items-center gap-4">
                  <div className="w-20 text-sm font-medium capitalize text-gray-700">{p.p}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5"><div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${pct}%` }}></div></div>
                  <div className="w-20 text-right text-sm font-semibold">{p.ca.toLocaleString(dateLocale)} €</div>
                  <div className="w-12 text-right text-xs text-gray-500">{p.nuits} {t('proDash.conciergerie.revpar.nuits')}</div>
                  <div className="w-8 text-right text-xs text-gray-500">{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {reservations.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="font-medium text-blue-700">{t('proDash.conciergerie.revpar.aucuneDonnee')}</p>
          <p className="text-sm text-blue-600 mt-1">{t('proDash.conciergerie.revpar.ajoutezReservations')}</p>
        </div>
      )}
    </div>
  )
}

