'use client'

import { useState, useEffect } from 'react'
import { Star } from 'lucide-react'

interface AvisSectionProps {
  artisanId: string
  locale: string
  ratingAvg?: number
  ratingCount?: number
}

export function AvisSection({ artisanId, locale, ratingAvg, ratingCount }: AvisSectionProps) {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const isPt = locale.startsWith('pt')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/reviews?artisan_id=${artisanId}&limit=5`)
        if (res.ok) {
          const data = await res.json()
          setReviews(data.reviews || [])
        }
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [artisanId])

  if (loading) return null

  const avg = ratingAvg || 5.0
  const count = ratingCount || 0

  // Distribution des étoiles pour la barre visuelle
  const distribution = [5, 4, 3, 2, 1].map(star => {
    const n = reviews.filter(r => r.rating === star).length
    return { star, count: n, pct: reviews.length > 0 ? (n / reviews.length) * 100 : (star === 5 ? 100 : 0) }
  })

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">{isPt ? 'Avaliações' : 'Avis clients'}</h2>

      {/* Header style Google : note + étoiles + distribution */}
      <div className="bg-gray-50 rounded-2xl p-6 mb-4">
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          {/* Note globale */}
          <div className="text-center flex-shrink-0">
            <div className="text-5xl font-bold text-gray-900">{avg.toFixed(1)}</div>
            <div className="flex items-center justify-center gap-0.5 mt-2">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={`w-5 h-5 ${s <= Math.round(avg) ? 'fill-[#FFC107] text-[#FFC107]' : 'text-gray-300'}`} />
              ))}
            </div>
            <div className="text-sm text-gray-500 mt-1">{count} {isPt ? 'avaliações' : 'avis'}</div>
          </div>

          {/* Barres de distribution */}
          <div className="flex-1 w-full space-y-1.5">
            {distribution.map(d => (
              <div key={d.star} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-3 text-right">{d.star}</span>
                <Star className="w-3 h-3 fill-[#FFC107] text-[#FFC107] flex-shrink-0" />
                <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#FFC107] rounded-full transition-all" style={{ width: `${d.pct}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-6">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Carousel d'avis (scroll horizontal) */}
      {reviews.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory" style={{ scrollbarWidth: 'thin' }}>
          {reviews.map((r: any) => (
            <div
              key={r.id}
              className="flex-shrink-0 w-[280px] sm:w-[320px] bg-white border border-gray-100 rounded-xl p-5 shadow-sm snap-start"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#FFC107]/10 flex items-center justify-center text-sm font-bold text-[#FFC107]">
                  {(r.client_name || 'C')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{r.client_name}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5 mb-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} className={`w-4 h-4 ${s <= r.rating ? 'fill-[#FFC107] text-[#FFC107]' : 'text-gray-200'}`} />
                ))}
              </div>
              {r.comment ? (
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{r.comment}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">{isPt ? 'Sem comentário' : 'Pas de commentaire'}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <div className="text-3xl mb-2">⭐</div>
          <p className="text-gray-500 text-sm">{isPt ? 'Ainda sem avaliações' : 'Pas encore d\'avis'}</p>
        </div>
      )}
    </div>
  )
}
