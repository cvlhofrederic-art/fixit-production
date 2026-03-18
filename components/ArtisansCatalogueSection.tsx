'use client'

import { useEffect, useState } from 'react'

interface Artisan {
  id: string
  nom_entreprise: string
  metier: string
  specialite: string | null
  adresse: string | null
  ville: string | null
  arrondissement: string | null
  google_note: number | null
  google_avis: number | null
  telephone_pro: string | null
  pappers_verifie: boolean | null
}

interface Props {
  city: string
  service: string
  waPhone: string  // numéro WhatsApp sans +
}

export default function ArtisansCatalogueSection({ city, service, waPhone }: Props) {
  const [artisans, setArtisans] = useState<Artisan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/artisans-catalogue?city=${encodeURIComponent(city)}&service=${encodeURIComponent(service)}&limit=8`)
      .then(r => r.json())
      .then(d => setArtisans(d.artisans || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [city, service])

  if (loading || artisans.length === 0) return null

  const waMsg = encodeURIComponent(`Bonjour VITFIX, je cherche un ${artisans[0]?.metier || 'artisan'} à ${city}. Pouvez-vous m'aider ?`)

  return (
    <section className="bg-white border-t border-border py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xl font-bold text-dark mb-1">
          Artisans disponibles à <span className="text-yellow">{city}</span>
        </h2>
        <p className="text-sm text-text-muted mb-6">
          {artisans.length} professionnels actifs et vérifiés — données officielles SIRENE
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {artisans.map((a) => (
            <div
              key={a.id}
              className="border border-border rounded-xl p-4 bg-[#FAFAF8] hover:shadow-md transition-shadow flex flex-col gap-2"
            >
              {/* En-tête */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[0.9rem] text-dark truncate">{a.nom_entreprise}</p>
                  <p className="text-xs text-text-muted mt-0.5">{a.metier}</p>
                </div>
                {a.pappers_verifie && (
                  <span className="flex-shrink-0 text-[0.7rem] bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 font-medium">
                    ✓ Vérifié
                  </span>
                )}
              </div>

              {/* Note Google */}
              {a.google_note && a.google_note > 0 ? (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-yellow">{'★'.repeat(Math.round(a.google_note))}</span>
                  <span className="text-text-muted">{a.google_note.toFixed(1)}</span>
                  {a.google_avis ? <span className="text-text-muted">({a.google_avis} avis)</span> : null}
                </div>
              ) : null}

              {/* Localisation */}
              {(a.arrondissement || a.ville) && (
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <span>📍</span>
                  <span>{a.arrondissement || a.ville}</span>
                </p>
              )}

              {/* Spécialité */}
              {a.specialite && (
                <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                  {a.specialite}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <a
            href={`https://wa.me/${waPhone}?text=${waMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] text-white rounded-full px-6 py-3 font-semibold text-sm hover:bg-[#20ba59] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Obtenir un devis via WhatsApp
          </a>
          <a
            href={`/recherche?cat=${service}&loc=${encodeURIComponent(city)}`}
            className="text-sm text-text-muted hover:text-dark underline underline-offset-2 transition-colors"
          >
            Voir tous les artisans →
          </a>
        </div>
      </div>
    </section>
  )
}
