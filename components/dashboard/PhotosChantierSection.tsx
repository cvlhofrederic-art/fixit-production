'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'
import { toast } from 'sonner'

/* ========== PHOTOS CHANTIER ========== */

interface PhotoItem {
  id: string; url?: string; storage_path?: string; booking_id?: string | null; created_at?: string
  label?: string; lat?: number; lng?: number; source?: string; taken_at?: string
}
interface RapportItem { id: string; titre?: string; rapportNumber?: string; clientName?: string; interventionDate?: string; linkedPhotoIds?: string[] }

export default function PhotosChantierSection({ artisan, bookings, orgRole }: { artisan: import('@/lib/types').Artisan; bookings: import('@/lib/types').Booking[]; orgRole?: string }) {
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unassigned' | string>('all')
  const [assigning, setAssigning] = useState<string | null>(null) // photo_id
  const [assigningRapport, setAssigningRapport] = useState<string | null>(null) // photo_id for rapport
  const [fullscreen, setFullscreen] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load rapports from localStorage for linking
  const [rapports, setRapports] = useState<RapportItem[]>([])
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
      const updated = allRapports.map((r: RapportItem) => {
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
    return rapports.find((r: RapportItem) => (r.linkedPhotoIds || []).includes(photoId))
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

  const handleUploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0 || !artisan) return
    setUploading(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      let successCount = 0
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('artisan_id', artisan.id)
        formData.append('source', 'desktop')
        formData.append('taken_at', new Date().toISOString())
        const res = await fetch('/api/artisan-photos', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        })
        if (res.ok) successCount++
      }
      if (successCount > 0) {
        toast.success(`${successCount} photo(s) ajoutee(s)`)
        loadPhotos()
      }
      if (successCount < files.length) {
        toast.error(`${files.length - successCount} photo(s) en erreur`)
      }
    } catch (e) {
      console.error('Upload error:', e)
      toast.error('Erreur lors de l\'upload')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const activeBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending' || b.status === 'completed')

  return (
    <div>
      {/* Page header */}
      <div className={isV5 ? "v5-pg-t" : "v22-page-header"}>
        <div>
          {isV5 ? <h1>{'📸'} {t('proDash.photos.title')}</h1> : <div className="v22-page-title">{'📸'} {t('proDash.photos.title')}</div>}
          {isV5 ? <p>{photos.length} photos · {activeBookings.length} {t('proDash.photos.chantier')}</p> : <div className="v22-page-sub">{photos.length} photos · {activeBookings.length} {t('proDash.photos.chantier')}</div>}
        </div>
        <button className={isV5 ? "v5-btn v5-btn-p" : "v22-btn v22-btn-action"} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? '...' : '+'} {t('proDash.photos.ajouterPhotos') || 'Ajouter photos'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleUploadPhotos(e.target.files)}
        />
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
            className={isV5 ? `v5-btn v5-btn-sm ${filter === 'all' ? 'v5-btn-p' : ''}` : `v22-btn v22-btn-sm ${filter === 'all' ? 'v22-btn-primary' : ''}`}
          >
            {t('proDash.photos.toutes')}
          </button>
          <button
            onClick={() => setFilter('unassigned')}
            className={isV5 ? `v5-btn v5-btn-sm ${filter === 'unassigned' ? 'v5-btn-p' : ''}` : `v22-btn v22-btn-sm ${filter === 'unassigned' ? 'v22-btn-primary' : ''}`}
          >
            {'📌'} {t('proDash.photos.nonAssociees')}
          </button>
          {activeBookings.slice(0, 5).map(b => (
            <button
              key={b.id}
              onClick={() => setFilter(b.id)}
              className={isV5 ? `v5-btn v5-btn-sm ${filter === b.id ? 'v5-btn-p' : ''}` : `v22-btn v22-btn-sm ${filter === b.id ? 'v22-btn-primary' : ''}`}
            >
              {b.services?.name || 'RDV'} — {b.booking_date}
            </button>
          ))}
        </div>

        {/* Info alert */}
        <div className={isV5 ? "v5-al warn" : "v22-alert v22-alert-amber"} style={{ marginBottom: 16 }}>
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
          <div style={{ textAlign: 'center', padding: '48px 0', color: tv.textMuted, fontSize: 12 }}>
            {t('proDash.photos.chargement')}
          </div>
        ) : photos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.4 }}>{'📸'}</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: 'var(--v5-text-primary, #1a1a1a)' }}>{t('proDash.photos.aucunePhoto')}</div>
            <div style={{ color: '#999', fontSize: 12, marginBottom: 20 }}>{t('proDash.photos.prendrePhotos')}</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12
          }}>
            {photos.map((photo: PhotoItem) => {
              const booking = bookings.find(b => b.id === photo.booking_id)
              return (
                <div key={photo.id} className={isV5 ? "v5-card" : "v22-card"} style={{ overflow: 'hidden', padding: 0 }}>
                  {/* Thumbnail */}
                  <div style={{ position: 'relative' }}>
                    <img
                      src={photo.url}
                      alt={photo.label || t('proDash.photos.title')}
                      style={{ width: '100%', height: 120, objectFit: 'cover', cursor: 'pointer', display: 'block' }}
                      onClick={() => setFullscreen(photo.url ?? null)}
                    />
                    {/* GPS badge */}
                    {photo.lat && photo.lng && (
                      <span className={isV5 ? "v5-gal-dt" : "v22-ref"} style={{
                        position: 'absolute', top: 6, left: 6,
                        background: 'rgba(0,0,0,0.6)', color: '#fff',
                        padding: '2px 6px', borderRadius: 3, fontSize: 10
                      }}>
                        {'📍'} {photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}
                      </span>
                    )}
                    {/* Source badge */}
                    <span className={isV5 ? "v5-badge v5-badge-green" : "v22-tag v22-tag-green"} style={{
                      position: 'absolute', top: 6, right: 6, fontSize: 10
                    }}>
                      {'📱'} {photo.source || 'mobile'}
                    </span>
                  </div>

                  {/* Meta section */}
                  <div style={{ padding: 10 }}>
                    {/* Timestamp */}
                    <div className={isV5 ? "v5-gal-dt" : "v22-ref"} style={{ marginBottom: 6 }}>
                      {'🕐'} {photo.taken_at ? new Date(photo.taken_at).toLocaleDateString(dateLocale) : ''} {t('proDash.common.a')} {photo.taken_at ? new Date(photo.taken_at).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>

                    {/* Booking association tag */}
                    {booking ? (
                      <div className={isV5 ? "v5-badge v5-badge-green" : "v22-tag v22-tag-green"} style={{ display: 'block', marginBottom: 4, fontSize: 10 }}>
                        {'🔗'} {booking.services?.name || 'RDV'} — {booking.booking_date}
                      </div>
                    ) : (
                      <div className={isV5 ? "v5-badge v5-badge-yellow" : "v22-tag v22-tag-amber"} style={{ display: 'block', marginBottom: 4, fontSize: 10 }}>
                        {'📌'} {t('proDash.photos.nonAssociee')}
                      </div>
                    )}

                    {/* Rapport association tag */}
                    {(() => {
                      const linkedRapport = getPhotoRapport(photo.id)
                      return linkedRapport ? (
                        <div className={isV5 ? "v5-badge v5-badge-green" : "v22-tag v22-tag-green"} style={{ display: 'block', marginBottom: 8, fontSize: 10 }}>
                          {'📋'} {linkedRapport.rapportNumber} — {linkedRapport.clientName || t('proDash.photos.rapport')}
                        </div>
                      ) : (
                        <div className={isV5 ? "v5-badge v5-badge-gray" : "v22-tag v22-tag-gray"} style={{ display: 'block', marginBottom: 8, fontSize: 10, fontStyle: 'italic' }}>
                          {'📋'} {t('proDash.photos.aucunRapportLie')}
                        </div>
                      )
                    })()}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {assigning === photo.id ? (
                        <div style={{ width: '100%' }}>
                          <p style={{ fontSize: 10, color: tv.textMuted, fontWeight: 600, marginBottom: 4 }}>
                            {'🔗'} {t('proDash.photos.associerChantier')}
                          </p>
                          <select
                            className={isV5 ? "v5-fi" : "v22-form-input"}
                            style={{ width: '100%', fontSize: 11, marginBottom: 4 }}
                            defaultValue=""
                            onChange={e => assignPhoto(photo.id, e.target.value || null)}
                          >
                            <option value="">{t('proDash.photos.aucunDissocier')}</option>
                            {activeBookings.map(b => (
                              <option key={b.id} value={b.id}>{b.services?.name || 'RDV'} — {b.booking_date}</option>
                            ))}
                          </select>
                          <button onClick={() => setAssigning(null)} className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"} style={{ fontSize: 10 }}>
                            {t('proDash.clients.annuler')}
                          </button>
                        </div>
                      ) : assigningRapport === photo.id ? (
                        <div style={{ width: '100%' }}>
                          <p style={{ fontSize: 10, color: tv.textMuted, fontWeight: 600, marginBottom: 4 }}>
                            {'📋'} {t('proDash.photos.associerRapport')}
                          </p>
                          <select
                            className={isV5 ? "v5-fi" : "v22-form-input"}
                            style={{ width: '100%', fontSize: 11, marginBottom: 4 }}
                            defaultValue=""
                            onChange={e => linkPhotoToRapport(photo.id, e.target.value || null)}
                          >
                            <option value="">{t('proDash.photos.aucunDissocier')}</option>
                            {rapports.map((r: RapportItem) => (
                              <option key={r.id} value={r.id}>{r.rapportNumber} — {r.clientName || 'Client'} — {r.interventionDate || 'N/D'}</option>
                            ))}
                          </select>
                          {rapports.length === 0 && (
                            <p style={{ fontSize: 10, color: tv.textMuted, fontStyle: 'italic', marginBottom: 4 }}>
                              {t('proDash.photos.aucunRapportCree')}
                            </p>
                          )}
                          <button onClick={() => setAssigningRapport(null)} className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"} style={{ fontSize: 10 }}>
                            {t('proDash.clients.annuler')}
                          </button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => setAssigning(photo.id)} className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"} style={{ flex: 1, fontSize: 10 }}>
                            {'🔗'} {t('proDash.photos.chantier')}
                          </button>
                          <button onClick={() => setAssigningRapport(photo.id)} className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"} style={{ flex: 1, fontSize: 10 }}>
                            {'📋'} {t('proDash.photos.rapport')}
                          </button>
                          <button onClick={() => deletePhoto(photo.id)} className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"} style={{ fontSize: 10, color: tv.red }}>
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
