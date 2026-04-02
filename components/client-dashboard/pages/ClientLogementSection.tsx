'use client'

import { useState } from 'react'
import { Shield, Copy, Filter, CheckCircle, Calendar, MapPin, AlertTriangle, ChevronRight } from 'lucide-react'
import LocaleLink from '@/components/common/LocaleLink'
import { type CILEntry } from '@/lib/cil-utils'

interface ClientLogementSectionProps {
  cilEntries: CILEntry[]
  cilHealthScore: number
  locale: string
  t: (key: string) => string
  exportCIL: () => void
  getCategoryInfo: (cat: CILEntry['category']) => { label: string; icon: string; color: string }
  formatPrice: (n: number, locale?: string) => string
}

export default function ClientLogementSection({
  cilEntries,
  cilHealthScore,
  locale,
  t,
  exportCIL,
  getCategoryInfo,
  formatPrice,
}: ClientLogementSectionProps) {
  const [cilFilter, setCilFilter] = useState<'all' | 'plomberie' | 'electricite' | 'chauffage' | 'serrurerie' | 'autre'>('all')
  const [showCilDetail, setShowCilDetail] = useState<CILEntry | null>(null)

  const filteredCilEntries = cilFilter === 'all'
    ? cilEntries
    : cilEntries.filter(e => e.category === cilFilter)

  return (
          <div className="space-y-6">
            {/* Health Score Header */}
            <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${
                    cilHealthScore >= 75 ? 'bg-green-100 text-green-700' :
                    cilHealthScore >= 50 ? 'bg-amber-100 text-amber-700' :
                    cilHealthScore >= 25 ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {cilHealthScore}%
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-black tracking-[-0.02em] text-dark flex items-center gap-2">
                      <Shield className="w-5 h-5 text-[#FFC107]" />
                      {t('clientDash.logement.healthTitle')}
                    </h2>
                    <p className="text-sm text-text-muted mt-0.5">
                      {cilEntries.length} {cilEntries.length > 1 ? t('clientDash.logement.interventionsCountPlural') : t('clientDash.logement.interventionsCount')} {cilEntries.length > 1 ? t('clientDash.logement.registeredPlural') : t('clientDash.logement.registered')}
                      {' '}&bull;{' '}{t('clientDash.logement.legalObligation')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={exportCIL}
                  disabled={cilEntries.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 bg-warm-gray hover:bg-warm-gray/80 text-mid rounded-xl font-semibold text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Copy className="w-4 h-4" />
                  {t('clientDash.logement.exportCIL')}
                </button>
              </div>

              {/* Health score bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
                  <span>{t('clientDash.logement.globalHealthScore')}</span>
                  <span className={`font-semibold ${
                    cilHealthScore >= 75 ? 'text-green-600' :
                    cilHealthScore >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {cilHealthScore >= 75 ? t('clientDash.logement.goodCondition') :
                     cilHealthScore >= 50 ? t('clientDash.logement.attentionRequired') :
                     cilHealthScore >= 25 ? t('clientDash.logement.maintenanceNeeded') : t('clientDash.logement.noData')}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      cilHealthScore >= 75 ? 'bg-green-500' :
                      cilHealthScore >= 50 ? 'bg-amber-500' :
                      cilHealthScore >= 25 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${cilHealthScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Category filter chips */}
            {cilEntries.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-text-muted" />
                {([
                  { key: 'all' as const, label: t('clientDash.logement.filterAll') },
                  { key: 'plomberie' as const, label: t('clientDash.logement.filterPlomberie') },
                  { key: 'electricite' as const, label: t('clientDash.logement.filterElectricite') },
                  { key: 'chauffage' as const, label: t('clientDash.logement.filterChauffage') },
                  { key: 'serrurerie' as const, label: t('clientDash.logement.filterSerrurerie') },
                  { key: 'autre' as const, label: t('clientDash.logement.filterAutre') },
                ]).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setCilFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      cilFilter === f.key
                        ? 'bg-[#FFC107] text-dark shadow-sm'
                        : 'bg-white text-text-muted hover:bg-warm-gray border border-[#E0E0E0]'
                    }`}
                  >
                    {f.label}
                    {f.key !== 'all' && ` (${cilEntries.filter(e => e.category === f.key).length})`}
                  </button>
                ))}
              </div>
            )}

            {/* Timeline entries */}
            {filteredCilEntries.length === 0 ? (
              <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-12 text-center">
                <div className="text-5xl mb-4">{'\uD83C\uDFE0'}</div>
                <h3 className="text-lg font-display font-bold text-dark mb-2">
                  {cilEntries.length === 0 ? t('clientDash.logement.noInterventions') : t('clientDash.logement.noCategoryInterventions')}
                </h3>
                <p className="text-text-muted mb-4 max-w-md mx-auto">
                  {cilEntries.length === 0
                    ? t('clientDash.logement.autoFillDesc')
                    : t('clientDash.logement.tryOtherFilter')
                  }
                </p>
                {cilEntries.length === 0 && (
                  <LocaleLink
                    href="/recherche"
                    className="inline-block bg-[#FFC107] hover:bg-[#FFD54F] text-dark px-8 py-3 rounded-lg font-semibold transition"
                  >
                    {t('clientDash.logement.bookIntervention')}
                  </LocaleLink>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCilEntries.map((entry, idx) => {
                  const catInfo = getCategoryInfo(entry.category)
                  const now = new Date()
                  const warrantyActive = entry.warranty ? new Date(entry.warranty.endDate) > now : false
                  const maintenanceOverdue = entry.nextMaintenance ? new Date(entry.nextMaintenance) < now : false

                  return (
                    <button
                      key={entry.id}
                      onClick={() => setShowCilDetail(entry)}
                      className="w-full text-left bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-5 hover:shadow-lg transition group"
                    >
                      <div className="flex items-start gap-4">
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${catInfo.color}`}>
                            {catInfo.icon}
                          </div>
                          {idx < filteredCilEntries.length - 1 && (
                            <div className="w-0.5 h-8 bg-gray-200 mt-2" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-dark truncate">{entry.serviceName}</h4>
                            <span className="text-sm font-semibold text-[#FFC107] flex-shrink-0">{formatPrice(entry.priceTTC, locale)}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-text-muted">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(entry.date).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="truncate">{entry.artisanName}</span>
                          </div>

                          {/* Status badges */}
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {/* Proof badge */}
                            {entry.hasProof ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[11px] font-medium border border-green-200">
                                <CheckCircle className="w-3 h-3" /> {t('clientDash.logement.proof')}
                                {entry.proofPhotosCount > 0 && <span>({entry.proofPhotosCount} {t('clientDash.logement.photos')})</span>}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warm-gray text-text-muted rounded-full text-[11px] font-medium border border-[#E0E0E0]">
                                {t('clientDash.logement.noProof')}
                              </span>
                            )}
                            {/* Signature */}
                            {entry.hasSignature && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[11px] font-medium border border-blue-200">
                                {'\u270D\uFE0F'} {t('clientDash.logement.signedBadge')}
                              </span>
                            )}
                            {/* GPS */}
                            {entry.hasGPS && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[11px] font-medium border border-purple-200">
                                <MapPin className="w-3 h-3" /> GPS
                              </span>
                            )}
                            {/* Warranty */}
                            {warrantyActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-medium border border-emerald-200">
                                <Shield className="w-3 h-3" /> {t('clientDash.logement.underWarranty')}
                              </span>
                            ) : entry.warranty ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[11px] font-medium border border-red-200">
                                <AlertTriangle className="w-3 h-3" /> {t('clientDash.logement.warrantyExpired')}
                              </span>
                            ) : null}
                            {/* Maintenance overdue */}
                            {maintenanceOverdue && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[11px] font-medium border border-amber-200">
                                <AlertTriangle className="w-3 h-3" /> {t('clientDash.logement.maintenanceOverdue')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#FFC107] transition flex-shrink-0 mt-1" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Summary stats */}
            {cilEntries.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] text-center">
                  <div className="text-2xl font-bold text-dark">{cilEntries.length}</div>
                  <div className="text-xs text-text-muted mt-1">{t('clientDash.logement.interventions')}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] text-center">
                  <div className="text-2xl font-bold text-green-600">{cilEntries.filter(e => e.hasProof).length}</div>
                  <div className="text-xs text-text-muted mt-1">{t('clientDash.logement.withProof')}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] text-center">
                  <div className="text-2xl font-bold text-emerald-600">
                    {cilEntries.filter(e => e.warranty && new Date(e.warranty.endDate) > new Date()).length}
                  </div>
                  <div className="text-xs text-text-muted mt-1">{t('clientDash.logement.underWarranty')}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] text-center">
                  <div className="text-2xl font-bold text-[#FFC107]">{formatPrice(cilEntries.reduce((sum, e) => sum + e.priceTTC, 0), locale)}</div>
                  <div className="text-xs text-text-muted mt-1">{t('clientDash.logement.totalSpent')}</div>
                </div>
              </div>
            )}
          </div>
  )
}
