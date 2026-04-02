'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export interface FilterState {
  disponibilite: string
  typeIntervention: string
  verifiedOnly: boolean
}

export interface FilterModalProps {
  isOpen: boolean
  onClose: () => void
  filters: FilterState
  setFilters: (f: FilterState) => void
  locale: 'fr' | 'pt'
}

export function FilterModal({
  isOpen,
  onClose,
  filters,
  setFilters,
  locale,
}: FilterModalProps) {
  const [local, setLocal] = useState<FilterState>(filters)

  useEffect(() => {
    if (isOpen) setLocal(filters)
  }, [isOpen, filters])

  if (!isOpen) return null

  const dispoOptions = locale === 'pt' ? [
    { value: 'all', label: 'Todas as disponibilidades' },
    { value: 'today', label: 'Hoje' },
    { value: '3days', label: 'Nos próximos 3 dias' },
    { value: '7days', label: 'Nos próximos 7 dias' },
    { value: '14days', label: 'Nos próximos 14 dias' },
  ] : [
    { value: 'all', label: 'Toutes les disponibilités' },
    { value: 'today', label: "Aujourd'hui" },
    { value: '3days', label: 'Sous 3 jours' },
    { value: '7days', label: 'Sous 7 jours' },
    { value: '14days', label: 'Sous 14 jours' },
  ]

  const interventionOptions = locale === 'pt' ? [
    { value: 'all', label: 'Todos os tipos' },
    { value: 'urgence', label: 'Intervenção urgente' },
    { value: 'planifie', label: 'Intervenção planeada' },
  ] : [
    { value: 'all', label: 'Tous types' },
    { value: 'urgence', label: 'Intervention urgente' },
    { value: 'planifie', label: 'Intervention planifiée' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10 border-[1.5px] border-[#EFEFEF]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-black text-dark tracking-[-0.02em]">{locale === 'pt' ? 'Filtros' : 'Filtres'}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Disponibilites */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{locale === 'pt' ? 'Disponibilidades' : 'Disponibilités'}</h3>
          <div className="space-y-2">
            {dispoOptions.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition"
              >
                <input
                  type="radio"
                  name="dispo"
                  checked={local.disponibilite === opt.value}
                  onChange={() => setLocal({ ...local, disponibilite: opt.value })}
                  className="w-4 h-4 accent-[#FFC107]"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Type d'intervention */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {locale === 'pt' ? 'Tipo de intervenção' : "Type d'intervention"}
          </h3>
          <div className="space-y-2">
            {interventionOptions.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition"
              >
                <input
                  type="radio"
                  name="intervention"
                  checked={local.typeIntervention === opt.value}
                  onChange={() => setLocal({ ...local, typeIntervention: opt.value })}
                  className="w-4 h-4 accent-[#FFC107]"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Verified only */}
        <div className="mb-8">
          <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition">
            <input
              type="checkbox"
              checked={local.verifiedOnly}
              onChange={() => setLocal({ ...local, verifiedOnly: !local.verifiedOnly })}
              className="w-4 h-4 accent-[#FFC107] rounded"
            />
            <span className="text-sm font-medium">{locale === 'pt' ? 'Apenas profissionais certificados' : 'Artisans certifiés uniquement'}</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setLocal({
                disponibilite: 'all',
                typeIntervention: 'all',
                verifiedOnly: false,
              })
            }}
            className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            {locale === 'pt' ? 'Reiniciar' : 'Réinitialiser'}
          </button>
          <button
            onClick={() => {
              setFilters(local)
              onClose()
            }}
            className="flex-1 bg-yellow hover:bg-yellow-light text-dark py-2.5 rounded-xl font-semibold transition"
          >
            {locale === 'pt' ? 'Aplicar filtros' : 'Appliquer les filtres'}
          </button>
        </div>
      </div>
    </div>
  )
}
