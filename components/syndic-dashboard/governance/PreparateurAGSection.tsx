'use client'

import { useState, useEffect } from 'react'
import type { Immeuble } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'

export default function PreparateurAGSection({ user, userRole, immeubles }: { user: any; userRole: string; immeubles: Immeuble[] }) {
  const { t } = useTranslation()
  const locale = useLocale()
  type AGStep = 'infos' | 'ordre_du_jour' | 'documents' | 'convocation' | 'export'
  type AGStatut = 'brouillon' | 'convocations_envoyees' | 'termine'
  interface AGResolution { id: string; type: 'ordinaire' | 'majorite_renforcee' | 'double_majorite'; titre: string; description: string; obligatoire: boolean }
  interface AGProject { id: string; immeuble_id: string; date_ag: string; heure_ag: string; lieu: string; type_ag: 'ordinaire' | 'extraordinaire'; resolutions: AGResolution[]; notes_president: string; created_at: string; statut: AGStatut }

  const RESOLUTIONS_STD: AGResolution[] = [
    { id: 'approbation_comptes', type: 'ordinaire', titre: "Approbation des comptes de l'exercice", description: 'Vote à la majorité simple — art. 24 loi 1965', obligatoire: true },
    { id: 'budget_previsionnel', type: 'ordinaire', titre: 'Vote du budget prévisionnel', description: 'Budget exercice suivant — art. 14-1 loi 1965', obligatoire: true },
    { id: 'fonds_travaux', type: 'ordinaire', titre: 'Cotisation fonds de travaux', description: '5% min du budget prévisionnel — loi ALUR', obligatoire: true },
    { id: 'designation_syndic', type: 'majorite_renforcee', titre: 'Désignation/renouvellement du syndic', description: 'Contrat de syndic — art. 25 loi 1965', obligatoire: false },
    { id: 'conseil_syndical', type: 'ordinaire', titre: 'Élection du conseil syndical', description: 'Membres du CS — art. 21 loi 1965', obligatoire: false },
    { id: 'travaux_pc', type: 'majorite_renforcee', titre: 'Autorisation travaux parties communes', description: 'Majorité art. 25 ou art. 26 selon travaux', obligatoire: false },
    { id: 'contrats_entretien', type: 'ordinaire', titre: 'Renouvellement contrats entretien', description: 'Ascenseur, espaces verts, nettoyage...', obligatoire: false },
    { id: 'assurance', type: 'ordinaire', titre: "Renouvellement contrat d'assurance", description: 'Assurance multirisque immeuble', obligatoire: false },
    { id: 'divers', type: 'ordinaire', titre: 'Questions diverses', description: 'Points remontés par le CS ou copropriétaires', obligatoire: false },
  ]

  const STEPS_NAV: { key: AGStep; label: string; icon: string }[] = [
    { key: 'infos', label: t('syndicDash.preparateurAG.stepInfos'), icon: '📋' },
    { key: 'ordre_du_jour', label: t('syndicDash.preparateurAG.stepAgenda'), icon: '📝' },
    { key: 'documents', label: t('syndicDash.preparateurAG.stepDocuments'), icon: '📁' },
    { key: 'convocation', label: t('syndicDash.preparateurAG.stepConvocation'), icon: '📧' },
    { key: 'export', label: t('syndicDash.preparateurAG.stepExport'), icon: '✅' },
  ]

  const DOCS_CHECKLIST = [
    { doc: "Comptes de l'exercice précédent", obligatoire: true, note: 'Bilan + compte de résultat signé par le syndic' },
    { doc: 'Budget prévisionnel détaillé', obligatoire: true, note: 'Détail par poste de charge' },
    { doc: 'Relevé des charges individuelles', obligatoire: true, note: 'Par lot — répartition tantièmes' },
    { doc: "État de la dette de la copropriété", obligatoire: true, note: 'Impayés, provisions et créances' },
    { doc: 'Formulaire de pouvoir (mandataire)', obligatoire: true, note: 'Pour mandater un représentant en AG' },
    { doc: 'Projet de contrat syndic', obligatoire: false, note: 'Si renouvellement syndic à l\'ordre du jour' },
    { doc: 'Note d\'information travaux', obligatoire: false, note: 'Descriptif et devis si travaux à voter' },
    { doc: 'Devis comparatifs (3 minimum)', obligatoire: false, note: 'Obligatoires si vote travaux > seuil' },
  ]

  const storageKey = `fixit_ag_projects_${user.id}`
  const [projects, setProjects] = useState<AGProject[]>([])
  const [current, setCurrent] = useState<AGProject | null>(null)
  const [step, setStep] = useState<AGStep>('infos')
  const [convocation, setConvocation] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const s = localStorage.getItem(storageKey)
    if (s) try { setProjects(JSON.parse(s)) } catch {}
  }, [storageKey])

  const saveProjects = (list: AGProject[]) => { setProjects(list); localStorage.setItem(storageKey, JSON.stringify(list)) }

  const updateCurrent = (p: AGProject) => {
    setCurrent(p)
    const updated = projects.find(x => x.id === p.id) ? projects.map(x => x.id === p.id ? p : x) : [...projects, p]
    saveProjects(updated)
  }

  const createNew = () => {
    const p: AGProject = { id: Date.now().toString(36), immeuble_id: immeubles[0]?.id || '', date_ag: '', heure_ag: '18:00', lieu: '', type_ag: 'ordinaire', resolutions: RESOLUTIONS_STD.filter(r => r.obligatoire), notes_president: '', created_at: new Date().toISOString(), statut: 'brouillon' }
    setCurrent(p)
    setStep('infos')
  }

  const toggleRes = (res: AGResolution) => {
    if (!current) return
    const exists = current.resolutions.find(r => r.id === res.id)
    updateCurrent({ ...current, resolutions: exists ? current.resolutions.filter(r => r.id !== res.id) : [...current.resolutions, res] })
  }

  const genConvocation = () => {
    if (!current) return
    const imm = immeubles.find(i => i.id === current.immeuble_id)
    const dateAG = current.date_ag ? new Date(current.date_ag).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '[DATE À DÉFINIR]'
    const dateEnvoi = current.date_ag ? new Date(new Date(current.date_ag).getTime() - 21 * 86400000).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : '[21 jours avant AG]'
    const typeLabel: Record<string, string> = { ordinaire: 'Art. 24 — majorité simple', majorite_renforcee: 'Art. 25 — majorité renforcée', double_majorite: 'Art. 26 — double majorité' }
    const odj = current.resolutions.map((r, i) => `  ${i + 1}. ${r.titre}\n     → ${r.description}\n     → Vote : ${typeLabel[r.type] || r.type}`).join('\n\n')
    const conv = `CONVOCATION À L'ASSEMBLÉE GÉNÉRALE ${current.type_ag === 'extraordinaire' ? 'EXTRAORDINAIRE' : 'ORDINAIRE'}\n\nRésidence : ${imm?.nom || '[NOM RÉSIDENCE]'}\n${imm?.adresse || '[ADRESSE]'}\n\nDate d'envoi de la convocation : ${dateEnvoi}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nMadame, Monsieur,\n\nNous avons l'honneur de vous convoquer à l'Assemblée Générale ${current.type_ag === 'extraordinaire' ? 'Extraordinaire' : 'Ordinaire'} des copropriétaires qui se tiendra :\n\n  📅 Le : ${dateAG}\n  🕐 À : ${current.heure_ag || '[HEURE]'}\n  📍 Au : ${current.lieu || '[LIEU À DÉFINIR]'}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nORDRE DU JOUR\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${odj}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nLes pièces justificatives (comptes, budget, contrats) sont tenues à votre disposition au cabinet syndic. Vous pouvez vous faire représenter par un mandataire de votre choix (formulaire de pouvoir ci-joint).\n\nVeuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.\n\nLe Syndic\nDate : ${new Date().toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚠️  Document généré par Fixit — À adapter selon les spécificités de la copropriété\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    setConvocation(conv)
  }

  const typeClsRes: Record<string, string> = { ordinaire: 'bg-blue-50 text-blue-600 border-blue-200', majorite_renforcee: 'bg-orange-50 text-[#C9A84C] border-orange-200', double_majorite: 'bg-red-50 text-red-600 border-red-200' }
  const typeLabels: Record<string, string> = { ordinaire: 'Art. 24', majorite_renforcee: 'Art. 25', double_majorite: 'Art. 26' }

  if (!current) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0D1B2E]">📝 {t('syndicDash.preparateurAG.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('syndicDash.preparateurAG.subtitle')}</p>
          </div>
          <button onClick={createNew} className="px-4 py-2 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] transition">{t('syndicDash.preparateurAG.newAG')}</button>
        </div>
        {projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <div className="text-5xl mb-3">🏛️</div>
            <h3 className="font-bold text-gray-700 mb-1">{t('syndicDash.preparateurAG.noAGPrepared')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('syndicDash.preparateurAG.noAGPreparedDesc')}</p>
            <button onClick={createNew} className="px-4 py-2 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] transition">{t('syndicDash.preparateurAG.startPreparation')}</button>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map(p => {
              const imm = immeubles.find(i => i.id === p.immeuble_id)
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:border-[#E4DDD0] transition cursor-pointer" onClick={() => { setCurrent(p); setStep('infos') }}>
                  <div className="text-2xl">🏛️</div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">AG {p.type_ag === 'extraordinaire' ? t('syndicDash.preparateurAG.extraordinaire') : t('syndicDash.preparateurAG.ordinaire')} — {imm?.nom || t('syndicDash.preparateurAG.undefinedBuilding')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.date_ag ? new Date(p.date_ag).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : t('syndicDash.preparateurAG.undefinedDate')} · {p.resolutions.length} {t('syndicDash.preparateurAG.resolutions')}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold flex-shrink-0 ${p.statut === 'termine' ? 'bg-green-100 text-green-700' : p.statut === 'convocations_envoyees' ? 'bg-blue-100 text-blue-700' : 'bg-[#F7F4EE] text-gray-500'}`}>
                    {p.statut === 'termine' ? `✅ ${t('syndicDash.preparateurAG.completed')}` : p.statut === 'convocations_envoyees' ? `📧 ${t('syndicDash.preparateurAG.convoked')}` : `✏️ ${t('syndicDash.preparateurAG.draft')}`}
                  </span>
                  <button onClick={ev => { ev.stopPropagation(); saveProjects(projects.filter(x => x.id !== p.id)) }} className="text-red-400 hover:text-red-600 text-sm p-1 flex-shrink-0">🗑️</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const imm = immeubles.find(i => i.id === current.immeuble_id)
  const stepIdx = STEPS_NAV.findIndex(s => s.key === step)

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => { setCurrent(null); setConvocation('') }} className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition">{t('syndicDash.preparateurAG.backToList')}</button>

      <div className="bg-gradient-to-r from-[#0D1B2E] to-[#152338] rounded-2xl p-5 mb-4 text-white">
        <h2 className="font-bold text-lg mb-1">📝 AG {current.type_ag === 'extraordinaire' ? t('syndicDash.preparateurAG.extraordinaire') : t('syndicDash.preparateurAG.ordinaire')} — {imm?.nom || t('syndicDash.preparateurAG.building')}</h2>
        <p className="text-[#C9A84C] text-sm">{current.date_ag ? new Date(current.date_ag).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : t('syndicDash.preparateurAG.dateToDefine')} · {current.lieu || t('syndicDash.preparateurAG.locationToDefine')}</p>
        <div className="flex gap-1 mt-3">
          {STEPS_NAV.map((s, i) => (
            <button key={s.key} onClick={() => setStep(s.key)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${step === s.key ? 'bg-white text-[#C9A84C]' : i < stepIdx ? 'bg-[#C9A84C] text-white' : 'bg-[#152338]/50 text-[#C9A84C]'}`}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {step === 'infos' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800">{t('syndicDash.preparateurAG.generalInfo')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.preparateurAG.buildingLabel')}</label>
                <select value={current.immeuble_id} onChange={e => updateCurrent({ ...current, immeuble_id: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]">
                  {immeubles.length === 0 ? <option value="">{t('syndicDash.preparateurAG.noBuilding')}</option> : immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.preparateurAG.agType')}</label>
                <select value={current.type_ag} onChange={e => updateCurrent({ ...current, type_ag: e.target.value as 'ordinaire' | 'extraordinaire' })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]">
                  <option value="ordinaire">{t('syndicDash.preparateurAG.typeOrdinaireAnnual')}</option>
                  <option value="extraordinaire">{t('syndicDash.preparateurAG.typeExtraordinaire')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.preparateurAG.agDate')}</label>
                <input type="date" value={current.date_ag} onChange={e => updateCurrent({ ...current, date_ag: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.preparateurAG.time')}</label>
                <input type="time" value={current.heure_ag} onChange={e => updateCurrent({ ...current, heure_ag: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.preparateurAG.locationLabel')}</label>
                <input type="text" placeholder={t('syndicDash.preparateurAG.locationPlaceholder')} value={current.lieu} onChange={e => updateCurrent({ ...current, lieu: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" />
              </div>
            </div>
            {current.date_ag && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
                📧 {t('syndicDash.preparateurAG.convocationsDeadline')} : <strong>{new Date(new Date(current.date_ag).getTime() - 21 * 86400000).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</strong> {t('syndicDash.preparateurAG.convocationsLegal')}
              </div>
            )}
            <button onClick={() => setStep('ordre_du_jour')} className="w-full py-2.5 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] transition">{t('syndicDash.preparateurAG.nextAgenda')}</button>
          </div>
        )}

        {step === 'ordre_du_jour' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800">{t('syndicDash.preparateurAG.agendaTitle')} ({current.resolutions.length} {t('syndicDash.preparateurAG.resolutions')})</h3>
            <div className="space-y-2">
              {RESOLUTIONS_STD.map(res => {
                const sel = !!current.resolutions.find(r => r.id === res.id)
                return (
                  <div key={res.id} onClick={() => !res.obligatoire && toggleRes(res)} className={`rounded-xl border p-3 flex items-start gap-3 transition ${sel ? 'border-[#C9A84C] bg-[#F7F4EE]' : 'border-gray-200 bg-white'} ${!res.obligatoire ? 'cursor-pointer hover:border-[#E4DDD0]' : ''}`}>
                    <div className={`w-5 h-5 rounded mt-0.5 flex-shrink-0 border-2 flex items-center justify-center ${sel ? 'bg-[#0D1B2E] border-[#C9A84C]' : 'border-gray-300'}`}>
                      {sel && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{res.titre}</p>
                        {res.obligatoire && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200">{t('syndicDash.preparateurAG.obligatoire')}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${typeClsRes[res.type]}`}>{typeLabels[res.type]}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{res.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('infos')} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-[#F7F4EE]">{t('syndicDash.preparateurAG.back')}</button>
              <button onClick={() => setStep('documents')} className="flex-1 py-2.5 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] transition">{t('syndicDash.preparateurAG.nextDocuments')}</button>
            </div>
          </div>
        )}

        {step === 'documents' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800">{t('syndicDash.preparateurAG.docsChecklist')}</h3>
            <p className="text-sm text-gray-500">{t('syndicDash.preparateurAG.docsLegal')}</p>
            <div className="space-y-2">
              {DOCS_CHECKLIST.map((item, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${item.obligatoire ? 'bg-blue-50 border-blue-200' : 'bg-[#F7F4EE] border-gray-200'}`}>
                  <div className={`w-5 h-5 rounded-full mt-0.5 flex-shrink-0 border-2 flex items-center justify-center ${item.obligatoire ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                    {item.obligatoire && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.doc} {item.obligatoire && <span className="text-xs text-blue-600 font-medium">{t('syndicDash.preparateurAG.docsObligatoire')}</span>}</p>
                    <p className="text-xs text-gray-500">{item.note}</p>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.preparateurAG.notesPresident')}</label>
              <textarea rows={3} value={current.notes_president} onChange={e => updateCurrent({ ...current, notes_president: e.target.value })} placeholder={t('syndicDash.preparateurAG.notesPlaceholder')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C] resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('ordre_du_jour')} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-[#F7F4EE]">{t('syndicDash.preparateurAG.back')}</button>
              <button onClick={() => setStep('convocation')} className="flex-1 py-2.5 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] transition">{t('syndicDash.preparateurAG.nextConvocation')}</button>
            </div>
          </div>
        )}

        {step === 'convocation' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800">{t('syndicDash.preparateurAG.genConvocationTitle')}</h3>
            {!convocation ? (
              <div className="bg-gradient-to-br from-[#F7F4EE] to-[#F7F4EE] border border-[#E4DDD0] rounded-2xl p-8 text-center">
                <div className="text-5xl mb-3">📧</div>
                <h4 className="font-bold text-[#0D1B2E] mb-1">{t('syndicDash.preparateurAG.convocationReady')}</h4>
                <p className="text-sm text-[#C9A84C] mb-4">{current.resolutions.length} {t('syndicDash.preparateurAG.convocationDesc')}</p>
                <button onClick={genConvocation} className="px-6 py-3 bg-[#0D1B2E] text-white rounded-xl font-semibold hover:bg-[#152338] transition text-sm">📄 {t('syndicDash.preparateurAG.generateConvocation')}</button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">{t('syndicDash.preparateurAG.convocationPreview')}</p>
                  <div className="flex gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(convocation); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${copied ? 'bg-green-100 text-green-700' : 'bg-[#F7F4EE] text-[#C9A84C] hover:bg-[#F7F4EE]'}`}>{copied ? `✓ ${t('syndicDash.preparateurAG.copied')}` : `📋 ${t('syndicDash.preparateurAG.copy')}`}</button>
                    <button onClick={() => setConvocation('')} className="text-xs px-3 py-1.5 rounded-lg text-gray-500 border border-gray-200 hover:bg-[#F7F4EE]">↩ {t('syndicDash.preparateurAG.regenerate')}</button>
                  </div>
                </div>
                <textarea readOnly value={convocation} rows={18} className="w-full px-4 py-3 bg-[#F7F4EE] border border-gray-200 rounded-xl text-xs font-mono resize-none focus:outline-none" />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep('documents')} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-[#F7F4EE]">{t('syndicDash.preparateurAG.back')}</button>
              <button onClick={() => { updateCurrent({ ...current, statut: 'convocations_envoyees' }); setStep('export') }} className="flex-1 py-2.5 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] transition">{t('syndicDash.preparateurAG.nextExport')}</button>
            </div>
          </div>
        )}

        {step === 'export' && (
          <div className="space-y-4 text-center">
            <div className="text-6xl mb-2">✅</div>
            <h3 className="font-bold text-gray-800 text-xl">{t('syndicDash.preparateurAG.agReady')}</h3>
            <p className="text-gray-500 text-sm">{t('syndicDash.preparateurAG.agReadyDesc')}</p>
            <div className="grid grid-cols-3 gap-3 text-left mt-4">
              <div className="bg-[#F7F4EE] rounded-xl p-3 text-center"><p className="text-2xl font-bold text-gray-800">{current.resolutions.length}</p><p className="text-xs text-gray-500">{t('syndicDash.preparateurAG.resolutionsCount')}</p></div>
              <div className="bg-[#F7F4EE] rounded-xl p-3 text-center"><p className="text-lg font-bold text-gray-800">{current.date_ag ? new Date(current.date_ag).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'short' }) : 'N/A'}</p><p className="text-xs text-gray-500">{t('syndicDash.preparateurAG.dateAG')}</p></div>
              <div className="bg-[#F7F4EE] rounded-xl p-3 text-center"><p className="text-lg font-bold text-gray-800">{current.heure_ag}</p><p className="text-xs text-gray-500">{t('syndicDash.preparateurAG.hour')}</p></div>
            </div>
            <div className="flex gap-2 flex-wrap justify-center mt-4">
              <button onClick={() => { genConvocation(); setStep('convocation') }} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">📋 {t('syndicDash.preparateurAG.viewConvocation')}</button>
              <button onClick={() => { updateCurrent({ ...current, statut: 'termine' }); setCurrent(null) }} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition">✅ {t('syndicDash.preparateurAG.markCompleted')}</button>
              <button onClick={() => setCurrent(null)} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-[#F7F4EE]">{t('syndicDash.preparateurAG.backToListBtn')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
