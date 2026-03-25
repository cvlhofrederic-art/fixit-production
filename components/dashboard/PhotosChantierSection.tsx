'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { toast } from 'sonner'

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
    } catch (e) { console.error('Error loading photos:', e); toast.error('Erreur lors du chargement des photos') }
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
    } catch (e) { console.error('Error assigning photo:', e); toast.error('Erreur lors de l\'attribution de la photo') }
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
    } catch (e) { console.error('Error deleting photo:', e); toast.error('Erreur lors de la suppression') }
  }

  const activeBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending' || b.status === 'completed')

  return (
    <div>
      {/* Page header */}
      <div className="v22-page-header">
        <div style={{ flex: 1 }}>
          <div className="v22-page-title">{'📸'} {t('proDash.photos.title')}</div>
          <div className="v22-page-sub">{photos.length} photos · {activeBookings.length} {t('proDash.photos.chantier')}</div>
        </div>
        <button className="v22-btn v22-btn-primary v22-btn-sm" onClick={() => {/* upload trigger if needed */}}>
          + {t('proDash.photos.ajouterPhotos') || 'Ajouter photos'}
        </button>
      </div>

      {/* Fullscreen lightbox */}
      {fullscreen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
            zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}
          onClick={() => setFullscreen(null)}
        >
          <Image src={fullscreen} alt="Photo" width={1200} height={800} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }} sizes="100vw" />
          <button
            onClick={() => setFullscreen(null)}
            style={{
              position: 'absolute', top: 16, right: 16, color: '#fff', fontSize: 20,
              background: 'rgba(0,0,0,0.5)', borderRadius: '50%', width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer'
            }}
          >✕</button>
        </div>
      )}

      <div style={{ padding: '20px 24px' }}>
        {/* Filter buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          <button
            onClick={() => setFilter('all')}
            className={`v22-btn v22-btn-sm ${filter === 'all' ? 'v22-btn-primary' : ''}`}
          >
            {t('proDash.photos.toutes')}
          </button>
          <button
            onClick={() => setFilter('unassigned')}
            className={`v22-btn v22-btn-sm ${filter === 'unassigned' ? 'v22-btn-primary' : ''}`}
          >
            {'📌'} {t('proDash.photos.nonAssociees')}
          </button>
          {activeBookings.slice(0, 5).map(b => (
            <button
              key={b.id}
              onClick={() => setFilter(b.id)}
              className={`v22-btn v22-btn-sm ${filter === b.id ? 'v22-btn-primary' : ''}`}
            >
              {b.services?.name || 'RDV'} — {b.booking_date}
            </button>
          ))}
        </div>

        {/* Info alert */}
        <div className="v22-alert v22-alert-amber" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 14 }}>{'ℹ️'}</span>
          <div style={{ fontSize: 11 }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>{t('proDash.photos.commentCaMarche')}</strong>
            <span>1. {t('proDash.photos.etape1')}</span><br/>
            <span>2. {t('proDash.photos.etape2')}</span><br/>
            <span>3. {t('proDash.photos.etape3')}</span><br/>
            <span>4. {t('proDash.photos.etape4')}</span>
          </div>
        </div>

        {/* Photos grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--v22-text-muted)', fontSize: 12 }}>
            {t('proDash.photos.chargement')}
          </div>
        ) : photos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{'📸'}</div>
            <div style={{ color: 'var(--v22-text-mid)', fontWeight: 500, fontSize: 13 }}>{t('proDash.photos.aucunePhoto')}</div>
            <div style={{ color: 'var(--v22-text-muted)', fontSize: 11, marginTop: 4 }}>{t('proDash.photos.prendrePhotos')}</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12
          }}>
            {photos.map((photo: any) => {
              const booking = bookings.find(b => b.id === photo.booking_id)
              return (
                <div key={photo.id} className="v22-card" style={{ overflow: 'hidden', padding: 0 }}>
                  {/* Thumbnail */}
                  <div style={{ position: 'relative' }}>
                    <img
                      src={photo.url}
                      alt={photo.label || t('proDash.photos.title')}
                      style={{ width: '100%', height: 120, objectFit: 'cover', cursor: 'pointer', display: 'block' }}
                      onClick={() => setFullscreen(photo.url)}
                    />
                    {/* GPS badge */}
                    {photo.lat && photo.lng && (
                      <span className="v22-ref" style={{
                        position: 'absolute', top: 6, left: 6,
                        background: 'rgba(0,0,0,0.6)', color: '#fff',
                        padding: '2px 6px', borderRadius: 3, fontSize: 10
                      }}>
                        {'📍'} {photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}
                      </span>
                    )}
                    {/* Source badge */}
                    <span className="v22-tag v22-tag-green" style={{
                      position: 'absolute', top: 6, right: 6, fontSize: 10
                    }}>
                      {'📱'} {photo.source || 'mobile'}
                    </span>
                  </div>

                  {/* Meta section */}
                  <div style={{ padding: 10 }}>
                    {/* Timestamp */}
                    <div className="v22-ref" style={{ marginBottom: 6 }}>
                      {'🕐'} {new Date(photo.taken_at).toLocaleDateString(dateLocale)} {t('proDash.common.a')} {new Date(photo.taken_at).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    {/* Booking association tag */}
                    {booking ? (
                      <div className="v22-tag v22-tag-green" style={{ display: 'block', marginBottom: 4, fontSize: 10 }}>
                        {'🔗'} {booking.services?.name || 'RDV'} — {booking.booking_date}
                      </div>
                    ) : (
                      <div className="v22-tag v22-tag-amber" style={{ display: 'block', marginBottom: 4, fontSize: 10 }}>
                        {'📌'} {t('proDash.photos.nonAssociee')}
                      </div>
                    )}

                    {/* Rapport association tag */}
                    {(() => {
                      const linkedRapport = getPhotoRapport(photo.id)
                      return linkedRapport ? (
                        <div className="v22-tag v22-tag-green" style={{ display: 'block', marginBottom: 8, fontSize: 10 }}>
                          {'📋'} {linkedRapport.rapportNumber} — {linkedRapport.clientName || t('proDash.photos.rapport')}
                        </div>
                      ) : (
                        <div className="v22-tag v22-tag-gray" style={{ display: 'block', marginBottom: 8, fontSize: 10, fontStyle: 'italic' }}>
                          {'📋'} {t('proDash.photos.aucunRapportLie')}
                        </div>
                      )
                    })()}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {assigning === photo.id ? (
                        <div style={{ width: '100%' }}>
                          <p style={{ fontSize: 10, color: 'var(--v22-text-muted)', fontWeight: 600, marginBottom: 4 }}>
                            {'🔗'} {t('proDash.photos.associerChantier')}
                          </p>
                          <select
                            className="v22-form-input"
                            style={{ width: '100%', fontSize: 11, marginBottom: 4 }}
                            defaultValue=""
                            onChange={e => assignPhoto(photo.id, e.target.value || null)}
                          >
                            <option value="">{t('proDash.photos.aucunDissocier')}</option>
                            {activeBookings.map(b => (
                              <option key={b.id} value={b.id}>{b.services?.name || 'RDV'} — {b.booking_date}</option>
                            ))}
                          </select>
                          <button onClick={() => setAssigning(null)} className="v22-btn v22-btn-sm" style={{ fontSize: 10 }}>
                            {t('proDash.clients.annuler')}
                          </button>
                        </div>
                      ) : assigningRapport === photo.id ? (
                        <div style={{ width: '100%' }}>
                          <p style={{ fontSize: 10, color: 'var(--v22-text-muted)', fontWeight: 600, marginBottom: 4 }}>
                            {'📋'} {t('proDash.photos.associerRapport')}
                          </p>
                          <select
                            className="v22-form-input"
                            style={{ width: '100%', fontSize: 11, marginBottom: 4 }}
                            defaultValue=""
                            onChange={e => linkPhotoToRapport(photo.id, e.target.value || null)}
                          >
                            <option value="">{t('proDash.photos.aucunDissocier')}</option>
                            {rapports.map((r: any) => (
                              <option key={r.id} value={r.id}>{r.rapportNumber} — {r.clientName || 'Client'} — {r.interventionDate || 'N/D'}</option>
                            ))}
                          </select>
                          {rapports.length === 0 && (
                            <p style={{ fontSize: 10, color: 'var(--v22-text-muted)', fontStyle: 'italic', marginBottom: 4 }}>
                              {t('proDash.photos.aucunRapportCree')}
                            </p>
                          )}
                          <button onClick={() => setAssigningRapport(null)} className="v22-btn v22-btn-sm" style={{ fontSize: 10 }}>
                            {t('proDash.clients.annuler')}
                          </button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => setAssigning(photo.id)} className="v22-btn v22-btn-sm" style={{ flex: 1, fontSize: 10 }}>
                            {'🔗'} {t('proDash.photos.chantier')}
                          </button>
                          <button onClick={() => setAssigningRapport(photo.id)} className="v22-btn v22-btn-sm" style={{ flex: 1, fontSize: 10 }}>
                            {'📋'} {t('proDash.photos.rapport')}
                          </button>
                          <button onClick={() => deletePhoto(photo.id)} className="v22-btn v22-btn-sm" style={{ fontSize: 10, color: 'var(--v22-red)' }}>
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
