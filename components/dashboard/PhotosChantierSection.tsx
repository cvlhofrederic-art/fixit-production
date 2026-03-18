'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useTranslation, useLocale } from '@/lib/i18n/context'

/* ========== PHOTOS CHANTIER ========== */
export default function PhotosChantierSection({ artisan, bookings }: { artisan: any; bookings: any[] }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  const [photos, setPhotos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unassigned' | string>('all')
  const [assigning, setAssigning] = useState<string | null>(null) // photo_id
  const [assigningRapport, setAssigningRapport] = useState<string | null>(null) // photo_id for rapport
  const [fullscreen, setFullscreen] = useState<string | null>(null)

  // Load rapports from localStorage for linking
  const [rapports, setRapports] = useState<any[]>([])
  useEffect(() => {
    if (typeof window === 'undefined' || !artisan?.id) return
    try {
      const r = JSON.parse(localStorage.getItem(`fixit_rapports_${artisan.id}`) || '[]')
      setRapports(r)
    } catch { setRapports([]) }
  }, [artisan?.id])

  // Link photo to rapport (in localStorage)
  const linkPhotoToRapport = (photoId: string, rapportId: string | null) => {
    if (!artisan?.id) return
    try {
      const storageKey = `fixit_rapports_${artisan.id}`
      const allRapports = JSON.parse(localStorage.getItem(storageKey) || '[]')
      const updated = allRapports.map((r: any) => {
        const linkedPhotos = r.linkedPhotoIds || []
        if (rapportId === r.id) {
          if (!linkedPhotos.includes(photoId)) {
            return { ...r, linkedPhotoIds: [...linkedPhotos, photoId] }
          }
        } else {
          return { ...r, linkedPhotoIds: linkedPhotos.filter((id: string) => id !== photoId) }
        }
        return r
      })
      localStorage.setItem(storageKey, JSON.stringify(updated))
      setRapports(updated)
      setAssigningRapport(null)
    } catch (e) {
      console.error('Error linking photo to rapport:', e)
    }
  }

  // Get which rapport a photo is linked to
  const getPhotoRapport = (photoId: string) => {
    return rapports.find((r: any) => (r.linkedPhotoIds || []).includes(photoId))
  }

  const loadPhotos = async () => {
    if (!artisan) return
    setLoading(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      let url = `/api/artisan-photos?artisan_id=${artisan.id}`
      if (filter === 'unassigned') url += '&unassigned=true'
      else if (filter !== 'all') url += `&booking_id=${filter}`
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      const json = await res.json()
      if (json.data) setPhotos(json.data)
    } catch (e) { console.error('Error loading photos:', e) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadPhotos() }, [artisan, filter])

  const assignPhoto = async (photoId: string, bookingId: string | null) => {
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      await fetch('/api/artisan-photos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ photo_id: photoId, booking_id: bookingId }),
      })
      setAssigning(null)
      loadPhotos()
    } catch (e) { console.error('Error assigning photo:', e) }
  }

  const deletePhoto = async (photoId: string) => {
    if (!confirm(t('proDash.photos.supprimerPhoto'))) return
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      await fetch(`/api/artisan-photos?id=${photoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      loadPhotos()
    } catch (e) { console.error('Error deleting photo:', e) }
  }

  const activeBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending' || b.status === 'completed')

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex items-center">
        <div>
          <h1 className="text-xl font-semibold leading-tight">{'📸'} {t('proDash.photos.title')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{t('proDash.photos.subtitle')}</p>
        </div>
      </div>

      {/* Fullscreen viewer */}
      {fullscreen && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setFullscreen(null)}>
          <Image src={fullscreen} alt="Photo" width={1200} height={800} className="max-w-full max-h-full object-contain rounded-lg" sizes="100vw" />
          <button onClick={() => setFullscreen(null)} className="absolute top-4 right-4 text-white text-2xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center">✕</button>
        </div>
      )}

      <div className="p-6 lg:p-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${filter === 'all' ? 'bg-[#FFC107] text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t('proDash.photos.toutes')}
          </button>
          <button onClick={() => setFilter('unassigned')} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${filter === 'unassigned' ? 'bg-[#FFC107] text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {'📌'} {t('proDash.photos.nonAssociees')}
          </button>
          {activeBookings.slice(0, 5).map(b => (
            <button key={b.id} onClick={() => setFilter(b.id)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${filter === b.id ? 'bg-[#FFC107] text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {b.services?.name || 'RDV'} — {b.booking_date}
            </button>
          ))}
        </div>

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <span className="text-xl">{'ℹ️'}</span>
          <div className="text-xs text-blue-800">
            <p className="font-semibold mb-1">{t('proDash.photos.commentCaMarche')}</p>
            <p>1. {t('proDash.photos.etape1')}</p>
            <p>2. {t('proDash.photos.etape2')}</p>
            <p>3. {t('proDash.photos.etape3')}</p>
            <p>4. {t('proDash.photos.etape4')}</p>
          </div>
        </div>

        {/* Photos grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">{t('proDash.photos.chargement')}</div>
        ) : photos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">{'📸'}</div>
            <div className="text-gray-500 font-medium">{t('proDash.photos.aucunePhoto')}</div>
            <div className="text-sm text-gray-400 mt-1">{t('proDash.photos.prendrePhotos')}</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {photos.map((photo: any) => {
              const booking = bookings.find(b => b.id === photo.booking_id)
              return (
                <div key={photo.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group relative">
                  <div className="relative">
                    <img
                      src={photo.url}
                      alt={photo.label || t('proDash.photos.title')}
                      className="w-full h-40 object-cover cursor-pointer"
                      onClick={() => setFullscreen(photo.url)}
                    />
                    {/* GPS badge */}
                    {photo.lat && photo.lng && (
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                        {'📍'} {photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}
                      </div>
                    )}
                    {/* Source badge */}
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                      {'📱'} {photo.source || 'mobile'}
                    </div>
                  </div>
                  <div className="p-3">
                    {/* Timestamp */}
                    <div className="text-xs text-gray-500 mb-1">
                      {'🕐'} {new Date(photo.taken_at).toLocaleDateString(dateLocale)} {t('proDash.common.a')} {new Date(photo.taken_at).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {/* Booking association */}
                    {booking ? (
                      <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg mb-1">
                        {'🔗'} {booking.services?.name || 'RDV'} — {booking.booking_date}
                      </div>
                    ) : (
                      <div className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-lg mb-1">
                        {'📌'} {t('proDash.photos.nonAssociee')}
                      </div>
                    )}
                    {/* Rapport association */}
                    {(() => {
                      const linkedRapport = getPhotoRapport(photo.id)
                      return linkedRapport ? (
                        <div className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-lg mb-2">
                          {'📋'} {linkedRapport.rapportNumber} — {linkedRapport.clientName || t('proDash.photos.rapport')}
                        </div>
                      ) : (
                        <div className="text-xs bg-gray-50 text-gray-400 px-2 py-1 rounded-lg mb-2 italic">
                          {'📋'} {t('proDash.photos.aucunRapportLie')}
                        </div>
                      )
                    })()}
                    {/* Actions */}
                    <div className="flex gap-1.5 flex-wrap">
                      {assigning === photo.id ? (
                        <div className="w-full">
                          <p className="text-[10px] text-gray-500 font-semibold mb-1">{'🔗'} {t('proDash.photos.associerChantier')}</p>
                          <select
                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 mb-1"
                            defaultValue=""
                            onChange={e => assignPhoto(photo.id, e.target.value || null)}
                          >
                            <option value="">{t('proDash.photos.aucunDissocier')}</option>
                            {activeBookings.map(b => (
                              <option key={b.id} value={b.id}>{b.services?.name || 'RDV'} — {b.booking_date}</option>
                            ))}
                          </select>
                          <button onClick={() => setAssigning(null)} className="text-[10px] text-gray-400 hover:text-gray-600">{t('proDash.clients.annuler')}</button>
                        </div>
                      ) : assigningRapport === photo.id ? (
                        <div className="w-full">
                          <p className="text-[10px] text-gray-500 font-semibold mb-1">{'📋'} {t('proDash.photos.associerRapport')}</p>
                          <select
                            className="w-full text-xs border border-purple-200 rounded-lg px-2 py-1.5 mb-1"
                            defaultValue=""
                            onChange={e => linkPhotoToRapport(photo.id, e.target.value || null)}
                          >
                            <option value="">{t('proDash.photos.aucunDissocier')}</option>
                            {rapports.map((r: any) => (
                              <option key={r.id} value={r.id}>{r.rapportNumber} — {r.clientName || 'Client'} — {r.interventionDate || 'N/D'}</option>
                            ))}
                          </select>
                          {rapports.length === 0 && <p className="text-[10px] text-gray-400 italic mb-1">{t('proDash.photos.aucunRapportCree')}</p>}
                          <button onClick={() => setAssigningRapport(null)} className="text-[10px] text-gray-400 hover:text-gray-600">{t('proDash.clients.annuler')}</button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => setAssigning(photo.id)} className="flex-1 text-[10px] py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition">
                            {'🔗'} {t('proDash.photos.chantier')}
                          </button>
                          <button onClick={() => setAssigningRapport(photo.id)} className="flex-1 text-[10px] py-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 font-medium transition">
                            {'📋'} {t('proDash.photos.rapport')}
                          </button>
                          <button onClick={() => deletePhoto(photo.id)} className="text-[10px] py-1.5 px-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition">
                            {'🗑️'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
