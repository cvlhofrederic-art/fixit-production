'use client'

import { X } from 'lucide-react'
import {
  groupServicesByCategory,
  getSmartPrice,
  parseServiceTag,
  cleanServiceDesc,
  getServiceEstimate,
  getServiceEmoji,
  UNIT_LABELS,
} from '@/lib/artisan-profile-utils'

interface ServicesGridProps {
  services: any[]
  selectedServices: any[]
  setSelectedServices: React.Dispatch<React.SetStateAction<any[]>>
  serviceQuantities: Record<string, string>
  setServiceQuantities: React.Dispatch<React.SetStateAction<Record<string, string>>>
  showEstimateModal: boolean
  setShowEstimateModal: React.Dispatch<React.SetStateAction<boolean>>
  locale: string
  isPt: boolean
  dateFmtLocale: string
  connectedUser: any
  setSelectedService: React.Dispatch<React.SetStateAction<any>>
  setSelectedDate: React.Dispatch<React.SetStateAction<Date | null>>
  setSelectedSlot: React.Dispatch<React.SetStateAction<string | null>>
  setBookingForm: React.Dispatch<React.SetStateAction<{ name: string; email: string; phone: string; address: string; notes: string; cgu: boolean }>>
  setStep: React.Dispatch<React.SetStateAction<'profile' | 'motif' | 'calendar'>>
  t: (fr: string, pt: string) => string
}

export function ServicesGrid({
  services,
  selectedServices,
  setSelectedServices,
  serviceQuantities,
  setServiceQuantities,
  showEstimateModal,
  setShowEstimateModal,
  locale,
  isPt,
  dateFmtLocale,
  connectedUser,
  setSelectedService,
  setSelectedDate,
  setSelectedSlot,
  setBookingForm,
  setStep,
  t,
}: ServicesGridProps) {
  return (
    <>
      {/* Services */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-2xl font-black text-dark tracking-[-0.02em]">{t('Services proposés', 'Serviços oferecidos')}</h2>
          {selectedServices.length > 0 && (
            <span className="bg-yellow text-gray-900 text-xs font-bold px-3 py-1 rounded-full">
              {selectedServices.length} {t('sélectionné', 'selecionado')}{selectedServices.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-gray-500 text-sm mb-4">
          {t('Clique em', 'Clique em')} <strong>+</strong> {t('pour combiner plusieurs services dans une même intervention', 'para combinar vários serviços na mesma intervenção')}
        </p>
        {services.length === 0 ? (
          <p className="text-gray-600">{t('Aucun service disponible pour le moment.', 'Nenhum serviço disponível de momento.')}</p>
        ) : (
          <div className="space-y-6">
            {groupServicesByCategory(services, locale).map((group) => (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{group.emoji}</span>
                  <h3 className="font-bold text-lg text-gray-800">{group.label}</h3>
                  <span className="text-xs text-gray-500 ml-1">({group.services.length})</span>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {group.services.map((service) => {
                    const priceInfo = getSmartPrice(service.name, service.price_ttc)
                    const tag = parseServiceTag(service)
                    const isInCart = selectedServices.some(s => s.id === service.id)
                    return (
                      <div
                        key={service.id}
                        className={`relative border-[1.5px] rounded-2xl p-5 transition hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 ${isInCart ? 'border-yellow bg-amber-50 shadow-md' : 'border-[#EFEFEF] hover:border-yellow'}`}
                      >
                        {/* Toggle + / check button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedServices(prev => {
                              const exists = prev.find(s => s.id === service.id)
                              if (exists) {
                                setServiceQuantities(q => { const nq = { ...q }; delete nq[service.id]; return nq })
                                return prev.filter(s => s.id !== service.id)
                              }
                              return [...prev, service]
                            })
                          }}
                          title={isInCart ? 'Retirer du panier' : 'Ajouter au panier'}
                          className={`absolute top-3 right-3 w-9 h-9 rounded-full border-2 flex items-center justify-center font-bold text-base transition z-10 ${
                            isInCart ? 'bg-yellow border-yellow text-gray-900' : 'border-gray-300 text-gray-500 hover:border-yellow hover:text-yellow bg-white'
                          }`}
                        >
                          {isInCart ? '\u2713' : '+'}
                        </button>

                        {/* Card body */}
                        <div
                          className="cursor-pointer"
                          onClick={() => {
                            setSelectedServices(prev => {
                              const exists = prev.find(s => s.id === service.id)
                              if (exists) {
                                setServiceQuantities(q => { const nq = { ...q }; delete nq[service.id]; return nq })
                                return prev.filter(s => s.id !== service.id)
                              }
                              return [...prev, service]
                            })
                          }}
                        >
                          <div className="flex items-start gap-3 mb-2 pr-10">
                            <h3 className="font-display font-bold text-base tracking-[-0.02em]">{service.name}</h3>
                          </div>
                          <p className="text-gray-600 text-sm mb-3">{cleanServiceDesc(service)}</p>
                          <div className="flex items-center justify-between">
                            {tag ? (
                              tag.min === 0 && tag.max === 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-full">{isPt ? 'Sob orçamento' : 'Sur devis'}</span>
                              ) : tag.unit === 'm2' ? (
                                <span className="text-sm font-semibold text-yellow">{tag.min} – {tag.max}€/m²</span>
                              ) : tag.unit === 'ml' ? (
                                <span className="text-sm font-semibold text-yellow">{tag.min} – {tag.max}€/ml</span>
                              ) : tag.unit === 'heure' ? (
                                <span className="text-sm font-semibold text-yellow">{tag.min} – {tag.max}€/h</span>
                              ) : (
                                <span className="text-sm font-bold text-yellow">
                                  {tag.min === tag.max ? `${tag.min}€` : `${tag.min} – ${tag.max}€`}
                                  {tag.unit === 'arbre' ? '/u' : tag.unit === 'tonne' ? '/t' : ''}
                                </span>
                              )
                            ) : (
                              <>
                                {priceInfo.type === 'devis' && <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-full">{isPt ? 'Sob orçamento' : 'Sur devis'}</span>}
                                {priceInfo.type === 'per_sqm' && <span className="text-sm font-semibold text-yellow">{priceInfo.label}</span>}
                                {priceInfo.type === 'per_ml' && <span className="text-sm font-semibold text-yellow">{priceInfo.label}</span>}
                                {priceInfo.type === 'hourly' && <span className="text-sm font-semibold text-yellow">{priceInfo.label}</span>}
                                {priceInfo.type === 'tiered' && <span className="text-sm font-semibold text-yellow">Selon hauteur</span>}
                                {priceInfo.type === 'fixed' && <span className="text-lg font-bold text-yellow">{priceInfo.label}</span>}
                              </>
                            )}
                            <span className="text-xs text-gray-500">{isInCart ? t('\u2713 Sélectionné', '\u2713 Selecionado') : t('Cliquez pour sélectionner', 'Clique para selecionar')}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Spacer pour la sticky bar en bas */}
        {selectedServices.length > 0 && (
          <div className="h-16"></div>
        )}
      </div>

      {/* Estimate Modal */}
      {showEstimateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowEstimateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold">📋 R&eacute;capitulatif de votre demande</h2>
                <button onClick={() => setShowEstimateModal(false)} className="text-gray-500 hover:text-gray-600"><X className="w-6 h-6" /></button>
              </div>

              <div className="space-y-3 mb-5">
                {selectedServices.map(svc => {
                  const tag = parseServiceTag(svc)
                  const needsQty = tag ? ['m2', 'ml', 'arbre', 'tonne', 'unite', 'm3', 'kg', 'lot'].includes(tag.unit) : false
                  const qty = serviceQuantities[svc.id] || ''
                  const { minVal, maxVal } = getServiceEstimate(svc, qty)
                  const unitLbl = tag ? (UNIT_LABELS[tag.unit] || tag.unit) : ''
                  const isDevis = tag ? (tag.min === 0 && tag.max === 0) : false
                  return (
                    <div key={svc.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-sm">{getServiceEmoji(svc.name)} {svc.name}</span>
                        <button
                          onClick={() => setSelectedServices(prev => prev.filter(s => s.id !== svc.id))}
                          className="text-red-400 hover:text-red-600 text-xs ml-2 flex-shrink-0"
                        >Retirer</button>
                      </div>
                      {needsQty && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Quantité ({unitLbl}) :</span>
                            <input
                              type="number"
                              value={qty}
                              onChange={e => setServiceQuantities(q => ({ ...q, [svc.id]: e.target.value }))}
                              placeholder={`ex: ${tag?.unit === 'arbre' ? '3' : tag?.unit === 'tonne' ? '2' : '50'}`}
                              min="1" step="1"
                              className="w-24 border-2 border-gray-200 rounded-lg px-2 py-1 text-sm focus:border-yellow focus:outline-none"
                            />
                            <span className="text-xs text-gray-500">{unitLbl}</span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1 italic">Facultatif — si vous ne savez pas, l&apos;artisan évaluera sur place</p>
                        </div>
                      )}
                      <div className="text-right mt-2">
                        {isDevis ? (
                          <span className="text-blue-600 text-sm font-semibold">{isPt ? 'Sob orçamento' : 'Sur devis'}</span>
                        ) : needsQty && !qty ? (
                          <span className="text-gray-400 text-xs">Renseignez la quantité pour une estimation</span>
                        ) : (
                          <span className="text-yellow font-bold text-sm">
                            {tag && tag.min === tag.max ? `${tag.min}€` : `${minVal} – ${maxVal}€`}
                            {tag && tag.unit !== 'forfait' && !needsQty ? `/${tag.unit === 'arbre' ? 'u' : tag.unit === 'tonne' ? 't' : tag.unit}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Total */}
              {(() => {
                let totalMin = 0, totalMax = 0, hasDevis = false, hasUnknown = false
                for (const svc of selectedServices) {
                  const tag = parseServiceTag(svc)
                  if (tag && tag.min === 0 && tag.max === 0) { hasDevis = true; continue }
                  const needsQty = tag ? ['m2', 'ml', 'arbre', 'tonne', 'unite', 'm3', 'kg', 'lot'].includes(tag.unit) : false
                  const qty = serviceQuantities[svc.id] || ''
                  if (needsQty && !qty) { hasUnknown = true; continue }
                  const { minVal, maxVal } = getServiceEstimate(svc, qty)
                  totalMin += minVal
                  totalMax += maxVal
                }
                const hasTotal = totalMin > 0 || totalMax > 0
                return (
                  <div className="bg-amber-50 border-2 border-yellow rounded-xl p-4 mb-5">
                    {hasTotal ? (
                      <>
                        <p className="text-gray-700 text-sm mb-1">
                          {hasUnknown || hasDevis ? 'Estimation partielle (sans les éléments non renseignés) :' : 'Votre intervention est estimée entre :'}
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {totalMin.toLocaleString(dateFmtLocale)} € – {totalMax.toLocaleString(dateFmtLocale)} €
                          <span className="text-sm font-normal text-gray-500 ml-2">TTC</span>
                        </p>
                        {(hasUnknown || hasDevis) && <p className="text-xs text-gray-500 mt-1">+ montants non estimés</p>}
                        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                          * Ceci est une estimation indicative. Le montant final dépendra des conditions d&apos;accès au chantier, de la complexité des travaux et d&apos;autres détails à clarifier avec l&apos;artisan. Des frais supplémentaires peuvent être appliqués.
                        </p>
                      </>
                    ) : (
                      <p className="text-gray-600 text-sm">Renseignez les quantités ci-dessus pour obtenir une estimation, ou passez directement au rendez-vous.</p>
                    )}
                  </div>
                )
              })()}

              <button
                onClick={() => {
                  setShowEstimateModal(false)
                  setSelectedService(selectedServices[0] || null)
                  setSelectedDate(null)
                  setSelectedSlot(null)
                  // Pre-fill form with connected user data
                  if (connectedUser) {
                    const meta = connectedUser.user_metadata || {}
                    const addressParts = [meta.address, meta.postal_code, meta.city].filter(Boolean)
                    setBookingForm({
                      name: meta.full_name || '',
                      email: connectedUser.email || '',
                      phone: meta.phone || '',
                      address: addressParts.join(', '),
                      notes: '',
                      cgu: false,
                    })
                  }
                  setStep('calendar')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="w-full bg-yellow hover:bg-yellow-light text-gray-900 py-3.5 rounded-xl font-bold text-lg transition"
              >
                ✅ Oui, je prends rendez-vous
              </button>
              <button onClick={() => setShowEstimateModal(false)} className="w-full text-gray-500 py-2.5 mt-2 text-sm hover:text-gray-700 transition">
                Modifier ma s&eacute;lection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky cart bar */}
      {selectedServices.length > 0 && !showEstimateModal && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900 text-white px-4 py-3 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">
                {selectedServices.length === 1 ? 'Service sélectionné' : 'Panier multi-services'}
              </p>
              <p className="font-semibold text-sm truncate">
                {selectedServices.map(s => s.name).join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowEstimateModal(true)}
                className="w-36 bg-white text-gray-900 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-100 transition text-center"
              >
                Estimation 🛒
              </button>
              <button
                onClick={() => setShowEstimateModal(true)}
                className="w-36 bg-yellow text-gray-900 px-4 py-2 rounded-lg font-bold text-sm text-center"
              >
                Prendre RDV 📅
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
