'use client'

import { useTranslation } from '@/lib/i18n/context'

interface MotifsSectionProps {
  services: any[]
  showMotifModal: boolean
  setShowMotifModal: (v: boolean) => void
  editingMotif: any
  motifForm: {
    name: string; description: string; duration_minutes: number | ''; price_min: number | ''; price_max: number | ''; pricing_unit: string
  }
  setMotifForm: (v: any) => void
  savingMotif: boolean
  openNewMotif: () => void
  openEditMotif: (service: any) => void
  saveMotif: () => void
  toggleMotifActive: (serviceId: string, currentActive: boolean) => void
  deleteMotif: (serviceId: string) => void
  getPriceRangeLabel: (service: any) => string
  getPricingUnit: (service: any) => string
  getCleanDescription: (service: any) => string
}

export default function MotifsSection({
  services, showMotifModal, setShowMotifModal, editingMotif, motifForm, setMotifForm,
  savingMotif, openNewMotif, openEditMotif, saveMotif, toggleMotifActive, deleteMotif,
  getPriceRangeLabel, getPricingUnit, getCleanDescription,
}: MotifsSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold leading-tight">{'🔧'} {t('proDash.motifs.title')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{t('proDash.motifs.subtitle')}</p>
        </div>
        <button onClick={openNewMotif}
          className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm">
          {t('proDash.motifs.nouveauMotif')}
        </button>
      </div>
      <div className="p-6 lg:p-8">

        {/* Info box */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6">
          <p className="text-sm text-blue-800">
            <strong>{'💡'} {t('proDash.motifs.astuce')}</strong> {t('proDash.motifs.astuceTexte')}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#2C3E50] text-white">
                <th className="text-left p-4 font-semibold text-sm">{t('proDash.motifs.colMotif')}</th>
                <th className="text-left p-4 font-semibold text-sm">{t('proDash.motifs.colDuree')}</th>
                <th className="text-left p-4 font-semibold text-sm">{t('proDash.motifs.colFourchette')}</th>
                <th className="text-left p-4 font-semibold text-sm">{t('proDash.motifs.colUnite')}</th>
                <th className="text-left p-4 font-semibold text-sm">{t('proDash.motifs.colStatut')}</th>
                <th className="text-left p-4 font-semibold text-sm">{t('proDash.motifs.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="p-4">
                    <div className="font-bold">{'🌿'} {service.name}</div>
                    {getCleanDescription(service) && (
                      <div className="text-xs text-gray-500 mt-1">{getCleanDescription(service)}</div>
                    )}
                  </td>
                  <td className="p-4">{service.duration_minutes ? `${Math.floor(service.duration_minutes / 60)}h${service.duration_minutes % 60 > 0 ? String(service.duration_minutes % 60).padStart(2, '0') : '00'}` : <span className="text-gray-500 text-xs">—</span>}</td>
                  <td className="p-4 font-bold text-[#FFC107]">{getPriceRangeLabel(service)}</td>
                  <td className="p-4">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold">{getPricingUnit(service)}</span>
                  </td>
                  <td className="p-4">
                    <button onClick={() => toggleMotifActive(service.id, service.active)}
                      className={`px-3 py-1 rounded-full text-sm font-semibold cursor-pointer transition ${service.active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {service.active ? `✅ ${t('proDash.motifs.actif')}` : `⏸ ${t('proDash.motifs.inactif')}`}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button onClick={() => openEditMotif(service)} className="bg-white text-gray-600 border-2 border-gray-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-50 hover:-translate-y-0.5 transition-all text-sm">
                        {'✏️'} {t('proDash.motifs.modifier')}
                      </button>
                      <button onClick={() => deleteMotif(service.id)} className="bg-red-50 text-red-600 border-2 border-red-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-red-100 transition-all text-sm">
                        {'🗑️'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-500">
                    <div className="text-4xl mb-3">{'🔧'}</div>
                    <p className="font-semibold text-lg mb-2">{t('proDash.motifs.aucunMotif')}</p>
                    <p className="text-sm mb-4">{t('proDash.motifs.aucunMotifDesc')}</p>
                    <button onClick={openNewMotif} className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2 rounded-lg font-semibold text-sm transition">
                      {t('proDash.motifs.creerMotif')}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Motif */}
      {showMotifModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMotifModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-6">{editingMotif ? `✏️ ${t('proDash.motifs.modifierMotif')}` : `🔧 ${t('proDash.motifs.nouveauMotifTitle')}`}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.motifs.nomMotif')} *</label>
                <input type="text" value={motifForm.name} onChange={(e) => setMotifForm({...motifForm, name: e.target.value})}
                  placeholder={t('proDash.motifs.nomMotifPlaceholder')}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.motifs.description')}</label>
                <textarea value={motifForm.description} onChange={(e) => setMotifForm({...motifForm, description: e.target.value})}
                  rows={2} placeholder={t('proDash.motifs.descriptionPlaceholder')}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('proDash.motifs.dureeEstimee')} <span className="text-gray-500 font-normal">({t('proDash.motifs.dureeOptional')})</span></label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={motifForm.duration_minutes}
                    onChange={(e) => setMotifForm({...motifForm, duration_minutes: e.target.value === '' ? '' : parseInt(e.target.value)})}
                    min={5} step={5}
                    placeholder="Ex: 60"
                    className="w-32 p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none"
                  />
                  {motifForm.duration_minutes !== '' && Number(motifForm.duration_minutes) > 0 && (
                    <span className="text-gray-500 text-sm">
                      = {Math.floor(Number(motifForm.duration_minutes) / 60)}h{Number(motifForm.duration_minutes) % 60 > 0 ? String(Number(motifForm.duration_minutes) % 60).padStart(2, '0') : '00'}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">{t('proDash.motifs.uniteTarification')} *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'forfait', label: `💰 ${t('proDash.motifs.forfait')}`, desc: t('proDash.motifs.forfaitDesc') },
                    { value: 'unite', label: `🔢 ${t('proDash.motifs.unite')}`, desc: t('proDash.motifs.uniteDesc') },
                    { value: 'm2', label: `📐 ${t('proDash.motifs.m2')}`, desc: t('proDash.motifs.m2Desc') },
                    { value: 'ml', label: `📏 ${t('proDash.motifs.ml')}`, desc: t('proDash.motifs.mlDesc') },
                    { value: 'm3', label: `🧊 ${t('proDash.motifs.m3')}`, desc: t('proDash.motifs.m3Desc') },
                    { value: 'heure', label: `🕐 ${t('proDash.motifs.heure')}`, desc: t('proDash.motifs.heureDesc') },
                    { value: 'kg', label: `⚖️ ${t('proDash.motifs.kg')}`, desc: t('proDash.motifs.kgDesc') },
                    { value: 'tonne', label: `♻️ ${t('proDash.motifs.tonne')}`, desc: t('proDash.motifs.tonneDesc') },
                    { value: 'lot', label: `📦 ${t('proDash.motifs.lot')}`, desc: t('proDash.motifs.lotDesc') },
                  ].map((opt) => (
                    <button key={opt.value}
                      onClick={() => setMotifForm({...motifForm, pricing_unit: opt.value})}
                      className={`p-3 rounded-xl border-2 text-left transition ${motifForm.pricing_unit === opt.value ? 'border-[#FFC107] bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="font-semibold text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  {t('proDash.motifs.fourchettePrix')}{motifForm.pricing_unit !== 'forfait' ? ` (€${({ m2: '/m²', ml: '/ml', m3: '/m³', heure: '/h', unite: '/u', arbre: '/u', kg: '/kg', tonne: '/t', lot: '/lot' } as Record<string, string>)[motifForm.pricing_unit] || ''})` : ' (€)'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('proDash.motifs.prixMinimum')}</label>
                    <input
                      type="number"
                      value={motifForm.price_min}
                      onChange={(e) => setMotifForm({...motifForm, price_min: e.target.value === '' ? '' : parseFloat(e.target.value)})}
                      step="0.01" min="0" placeholder={t('proDash.motifs.surDevisPlaceholder')}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('proDash.motifs.prixMaximum')}</label>
                    <input
                      type="number"
                      value={motifForm.price_max}
                      onChange={(e) => setMotifForm({...motifForm, price_max: e.target.value === '' ? '' : parseFloat(e.target.value)})}
                      step="0.01" min="0" placeholder={t('proDash.motifs.surDevisPlaceholder')}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{t('proDash.motifs.surDevisNote')}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={saveMotif} disabled={!motifForm.name || savingMotif}
                  className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-lg font-semibold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  {savingMotif ? t('proDash.motifs.sauvegarde') : editingMotif ? `💾 ${t('proDash.motifs.modifier')}` : t('proDash.motifs.creerLeMotif')}
                </button>
                <button onClick={() => setShowMotifModal(false)} className="px-6 py-3 bg-white text-gray-600 border-2 border-gray-200 rounded-lg font-semibold hover:bg-gray-50 transition">
                  {t('proDash.motifs.annuler')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
