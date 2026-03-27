'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useTranslation, useLocale } from '@/lib/i18n/context'

function safeBlobUrl(file: File): string {
  const url = URL.createObjectURL(file)
  return url.startsWith('blob:') ? url : ''
}

export default function CarnetDeVisiteSection({ artisan }: { artisan: any }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const storageKey = `fixit_portfolio_${artisan?.id}`

  const PORTFOLIO_CATEGORIES = [
    t('proDash.carnet.plomberie'),
    t('proDash.carnet.electricite'),
    t('proDash.carnet.peinture'),
    t('proDash.carnet.maconnerie'),
    t('proDash.carnet.menuiserie'),
    t('proDash.carnet.carrelage'),
    t('proDash.carnet.chauffage'),
    t('proDash.carnet.toiture'),
    t('proDash.carnet.autre'),
  ]

  interface PortfolioPhoto {
    id: string
    url: string
    title: string
    category: string
    uploadedAt: string
  }

  const [photos, setPhotos] = useState<PortfolioPhoto[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState(t('proDash.carnet.autre'))
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PortfolioPhoto | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const saveToStorage = (updated: PortfolioPhoto[]) => {
    setPhotos(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const handleFileSelect = (file: File) => {
    setPendingFile(file)
    setNewTitle(file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    setShowForm(true)
  }

  const handleUpload = async () => {
    if (!pendingFile || !artisan?.id) return
    setUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const authHeaders: Record<string, string> = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      const fd = new FormData()
      fd.append('file', pendingFile)
      fd.append('bucket', 'artisan-documents')
      fd.append('folder', `portfolio/${artisan.id}`)
      const res = await fetch('/api/upload', { method: 'POST', headers: authHeaders, body: fd })
      const data = await res.json()
      if (data.url) {
        const newPhoto: PortfolioPhoto = {
          id: Date.now().toString(),
          url: data.url,
          title: newTitle || t('proDash.carnet.realisations'),
          category: newCategory,
          uploadedAt: new Date().toISOString(),
        }
        const updated = [newPhoto, ...photos]
        saveToStorage(updated)

        // Also save to profiles_artisan.portfolio_photos if possible
        try {
          await fetch('/api/upload', {
            method: 'POST',
            headers: authHeaders,
            body: (() => {
              const fd2 = new FormData()
              fd2.append('artisan_id', artisan.id)
              fd2.append('field', 'portfolio_photo')
              fd2.append('photo_url', data.url)
              fd2.append('photo_meta', JSON.stringify({ title: newTitle, category: newCategory }))
              return fd2
            })(),
          })
        } catch { /* best effort */ }
      }
      setShowForm(false)
      setPendingFile(null)
      setNewTitle('')
      setNewCategory(t('proDash.carnet.autre'))
    } catch (e) {
      console.error('Portfolio upload error:', e)
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = (id: string) => {
    saveToStorage(photos.filter(p => p.id !== id))
  }

  const categories = [t('proDash.carnet.toutes'), ...PORTFOLIO_CATEGORIES.filter(c => photos.some(p => p.category === c))]
  const [activeCategory, setActiveCategory] = useState(t('proDash.carnet.toutes'))
  const filtered = activeCategory === t('proDash.carnet.toutes') ? photos : photos.filter(p => p.category === activeCategory)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{'📸'} {t('proDash.carnet.title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('proDash.carnet.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-3xl font-black text-gray-900">{photos.length}</div>
            <div className="text-xs text-gray-500">{t('proDash.carnet.realisations')}</div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2"
          >
            {'➕'} {t('proDash.carnet.ajouterPhoto')}
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFileSelect(f)
          e.target.value = ''
        }}
      />

      {/* Upload form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-lg text-gray-900 mb-4">{'📸'} {t('proDash.carnet.nouvelleRealisation')}</h3>
            {pendingFile && (
              <div className="mb-4 rounded-xl overflow-hidden bg-gray-100 h-40 flex items-center justify-center">
                <img
                  src={safeBlobUrl(pendingFile)}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{t('proDash.carnet.titreRealisation')}</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder={t('proDash.carnet.titrePlaceholder')}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{t('proDash.carnet.categorie')}</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]"
                >
                  {PORTFOLIO_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowForm(false); setPendingFile(null) }}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 font-semibold text-sm hover:bg-gray-50 transition"
              >
                {t('proDash.carnet.annuler')}
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !newTitle.trim()}
                className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 rounded-xl py-2.5 font-bold text-sm transition disabled:opacity-50"
              >
                {uploading ? `⏳ ${t('proDash.carnet.uploadEnCours')}` : `✅ ${t('proDash.carnet.publierRealisation')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo lightbox */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <Image src={preview.url} alt={preview.title} width={800} height={600} className="w-full rounded-2xl" sizes="(max-width: 768px) 100vw, 768px" />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 rounded-b-2xl p-4">
              <div className="font-bold text-white">{preview.title}</div>
              <div className="text-sm text-gray-300">{preview.category} · {new Date(preview.uploadedAt).toLocaleDateString(dateLocale)}</div>
            </div>
            <button onClick={() => setPreview(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70">✕</button>
          </div>
        </div>
      )}

      {/* Category filter tabs */}
      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${activeCategory === cat ? 'bg-[#FFC107] text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Photo grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">{'📷'}</div>
          <div className="text-xl font-bold text-gray-700 mb-2">{t('proDash.carnet.aucuneRealisation')}</div>
          <p className="text-gray-500 mb-6">{t('proDash.carnet.ajouterPhotosConvaincre')}</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-3 rounded-xl font-bold transition-all"
          >
            {'📸'} {t('proDash.carnet.ajouterPremiereRealisation')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(photo => (
            <div key={photo.id} className="group relative bg-gray-100 rounded-2xl overflow-hidden aspect-square cursor-pointer" onClick={() => setPreview(photo)}>
              <Image src={photo.url} alt={photo.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 50vw, 25vw" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                <div className="text-white font-semibold text-sm truncate">{photo.title}</div>
                <div className="text-gray-300 text-xs">{photo.category}</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); removePhoto(photo.id) }}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 items-center justify-center text-xs hidden group-hover:flex hover:bg-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-700">
            {'💡'} {t('proDash.carnet.photosVisibles')}{' '}
            <a href={`/artisan/${artisan?.id}`} target="_blank" rel="noreferrer" className="font-bold underline">{t('proDash.carnet.profilPublic')} →</a>
          </p>
        </div>
      )}
    </div>
  )
}
