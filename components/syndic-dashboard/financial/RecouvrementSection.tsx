'use client'

import { useState, useEffect } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import type { User } from '@supabase/supabase-js'

export default function RecouvrementSection({ user, userRole }: { user: User; userRole: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  type StageRec = 'amiable' | 'relance_1' | 'relance_2' | 'mise_en_demeure' | 'contentieux' | 'huissier' | 'regle'
  interface DossierRec {
    id: string; coproprio_nom: string; coproprio_email: string; coproprio_lot: string
    immeuble_nom: string; montant_initial: number; montant_actuel: number
    date_premiere_echeance: string; stage: StageRec
    historique: { date: string; action: string; auteur: string }[]
    notes: string; date_derniere_action: string; added_at: string
  }
  const STAGES: { key: StageRec; label: string; icon: string; color: string; action: string }[] = [
    { key: 'amiable', label: t('syndicDash.recouvrement.stageAmiable'), icon: '📞', color: 'blue', action: t('syndicDash.recouvrement.actionAmiable') },
    { key: 'relance_1', label: t('syndicDash.recouvrement.stageRelance1'), icon: '📧', color: 'amber', action: t('syndicDash.recouvrement.actionRelance1') },
    { key: 'relance_2', label: t('syndicDash.recouvrement.stageRelance2'), icon: '📨', color: 'orange', action: t('syndicDash.recouvrement.actionRelance2') },
    { key: 'mise_en_demeure', label: t('syndicDash.recouvrement.stageMiseEnDemeure'), icon: '⚖️', color: 'red', action: t('syndicDash.recouvrement.actionMiseEnDemeure') },
    { key: 'contentieux', label: t('syndicDash.recouvrement.stageContentieux'), icon: '🏛️', color: 'purple', action: t('syndicDash.recouvrement.actionContentieux') },
    { key: 'huissier', label: t('syndicDash.recouvrement.stageHuissier'), icon: '🔔', color: 'gray', action: t('syndicDash.recouvrement.actionHuissier') },
    { key: 'regle', label: t('syndicDash.recouvrement.stageRegle'), icon: '✅', color: 'green', action: t('syndicDash.recouvrement.actionRegle') },
  ]
  const STAGE_ORDER: StageRec[] = ['amiable', 'relance_1', 'relance_2', 'mise_en_demeure', 'contentieux', 'huissier', 'regle']
  const stageCls: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200', amber: 'bg-amber-100 text-amber-700 border-amber-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200', red: 'bg-red-100 text-red-700 border-red-200',
    purple: 'bg-[#F7F4EE] text-[#C9A84C] border-[#E4DDD0]', gray: 'bg-[#F7F4EE] text-gray-600 border-gray-200',
    green: 'bg-green-100 text-green-700 border-green-200',
  }

  const storageKey = `fixit_recouvrement_${user.id}`
  const [dossiers, setDossiers] = useState<DossierRec[]>([])
  const [selected, setSelected] = useState<DossierRec | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [letter, setLetter] = useState<string | null>(null)
  const [form, setForm] = useState({ coproprio_nom: '', coproprio_email: '', coproprio_lot: '', immeuble_nom: '', montant_initial: '', date_premiere_echeance: '' })
  const [copiedLetter, setCopiedLetter] = useState(false)

  useEffect(() => {
    const s = localStorage.getItem(storageKey)
    if (s) try { setDossiers(JSON.parse(s)) } catch {}
  }, [storageKey])

  const saveDossiers = (list: DossierRec[]) => { setDossiers(list); localStorage.setItem(storageKey, JSON.stringify(list)) }

  const addDossier = () => {
    if (!form.coproprio_nom || !form.montant_initial) return
    saveDossiers([...dossiers, { id: Date.now().toString(36), coproprio_nom: form.coproprio_nom, coproprio_email: form.coproprio_email, coproprio_lot: form.coproprio_lot, immeuble_nom: form.immeuble_nom, montant_initial: parseFloat(form.montant_initial), montant_actuel: parseFloat(form.montant_initial), date_premiere_echeance: form.date_premiere_echeance, stage: 'amiable', historique: [{ date: new Date().toISOString(), action: 'Dossier ouvert', auteur: 'Syndic' }], notes: '', date_derniere_action: new Date().toISOString(), added_at: new Date().toISOString() }])
    setShowAdd(false)
    setForm({ coproprio_nom: '', coproprio_email: '', coproprio_lot: '', immeuble_nom: '', montant_initial: '', date_premiere_echeance: '' })
  }

  const escalate = (id: string) => {
    const updated = dossiers.map(d => {
      if (d.id !== id) return d
      const idx = STAGE_ORDER.indexOf(d.stage)
      const next = STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 1)]
      const info = STAGES.find(s => s.key === next)!
      return { ...d, stage: next, date_derniere_action: new Date().toISOString(), historique: [...d.historique, { date: new Date().toISOString(), action: info.action, auteur: 'Syndic' }] }
    })
    saveDossiers(updated)
    if (selected?.id === id) setSelected(updated.find(d => d.id === id) || null)
  }

  const markRegle = (id: string) => {
    const updated = dossiers.map(d => d.id !== id ? d : { ...d, stage: 'regle' as StageRec, date_derniere_action: new Date().toISOString(), historique: [...d.historique, { date: new Date().toISOString(), action: 'Dossier réglé — clôture', auteur: 'Syndic' }] })
    saveDossiers(updated)
    setSelected(null)
  }

  const generateLetter = (d: DossierRec) => {
    const templates: Partial<Record<StageRec, string>> = {
      amiable: `Objet : Rappel amiable — Arriéré de charges de copropriété\n\nMonsieur/Madame ${d.coproprio_nom},\n\nNous vous contactons au sujet d'un arriéré de charges de copropriété d'un montant de ${d.montant_actuel.toFixed(2)} € relatif au lot n°${d.coproprio_lot || '?'} de la résidence ${d.immeuble_nom || '?'}.\n\nNous vous invitons à régulariser cette situation dans les meilleurs délais. Pour tout arrangement, n'hésitez pas à nous contacter.\n\nCordialement,\nLe Syndic`,
      relance_1: `Objet : 1ère Relance — Charges de copropriété impayées\n\nMonsieur/Madame ${d.coproprio_nom},\n\nMalgré notre précédent rappel amiable, votre solde débiteur de ${d.montant_actuel.toFixed(2)} € (lot n°${d.coproprio_lot || '?'} — ${d.immeuble_nom || '?'}) n'a pas été régularisé.\n\nNous vous demandons de procéder au règlement sous 15 jours. À défaut, nous serons contraints d'engager une procédure de recouvrement.\n\nCordialement,\nLe Syndic`,
      relance_2: `Objet : 2ème Relance (Recommandée) — Urgence règlement charges\n\nMonsieur/Madame ${d.coproprio_nom},\n\nEn l'absence de règlement de votre part malgré nos précédentes demandes, nous vous adressons cette seconde relance par recommandé.\n\nMontant dû : ${d.montant_actuel.toFixed(2)} € — Lot n°${d.coproprio_lot || '?'} — ${d.immeuble_nom || '?'}\n\nVous disposez de 8 jours pour régulariser. Passé ce délai, un courrier de mise en demeure vous sera adressé.\n\nCordialement,\nLe Syndic`,
      mise_en_demeure: `MISE EN DEMEURE\n\nMonsieur/Madame ${d.coproprio_nom},\n\nPar la présente, nous vous mettons en demeure de régler, dans un délai de 8 jours à compter de la réception de ce courrier, la somme de ${d.montant_actuel.toFixed(2)} € représentant vos charges de copropriété impayées (lot n°${d.coproprio_lot || '?'} — ${d.immeuble_nom || '?'}).\n\nÀ défaut de règlement dans ce délai, nous nous réservons le droit de saisir le tribunal judiciaire compétent, conformément aux articles 14-1 et 19-2 de la loi du 10 juillet 1965.\n\nFait à ______, le ${new Date().toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}\n\nLE SYNDIC\n[Signature]`,
    }
    setLetter(templates[d.stage] || `Dossier : ${d.coproprio_nom} — Lot n°${d.coproprio_lot || '?'}\nImmeuble : ${d.immeuble_nom || '?'}\nMontant : ${d.montant_actuel.toFixed(2)} €\nStade : ${STAGES.find(s => s.key === d.stage)?.label}\n\n[Adapter le courrier selon le stade actuel]`)
  }

  const actifs = dossiers.filter(d => d.stage !== 'regle')
  const regles = dossiers.filter(d => d.stage === 'regle')
  const totalEncours = actifs.reduce((s, d) => s + d.montant_actuel, 0)
  const totalRegle = regles.reduce((s, d) => s + d.montant_actuel, 0)

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0D1B2E]">💸 {t('syndicDash.recouvrement.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('syndicDash.recouvrement.subtitle')}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] transition">{t('syndicDash.recouvrement.newDossier')}</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-red-700">{totalEncours.toFixed(0)} €</p><p className="text-xs text-red-500 mt-0.5">{t('syndicDash.recouvrement.amountRecovering')}</p></div>
        <div className="bg-[#F7F4EE] border border-gray-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-gray-700">{actifs.length}</p><p className="text-xs text-gray-500 mt-0.5">{t('syndicDash.recouvrement.activeDossiers')}</p></div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-green-700">{totalRegle.toFixed(0)} €</p><p className="text-xs text-green-500 mt-0.5">{t('syndicDash.recouvrement.recovered')}</p></div>
      </div>

      {actifs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 overflow-x-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{t('syndicDash.recouvrement.escaladePipeline')}</p>
          <div className="flex gap-2 min-w-max">
            {STAGES.filter(s => s.key !== 'regle').map(stage => {
              const cnt = actifs.filter(d => d.stage === stage.key).length
              return (
                <div key={stage.key} className={`flex-1 min-w-24 rounded-xl border p-3 text-center transition ${cnt > 0 ? stageCls[stage.color] : 'bg-[#F7F4EE] border-gray-200'}`}>
                  <div className="text-lg mb-1">{stage.icon}</div>
                  <p className="text-xs font-bold">{stage.label}</p>
                  <p className={`text-xl font-bold mt-1 ${cnt > 0 ? '' : 'text-gray-500'}`}>{cnt}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {dossiers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <div className="text-5xl mb-3">💸</div>
          <h3 className="font-bold text-gray-700 mb-1">{t('syndicDash.recouvrement.noDossier')}</h3>
          <p className="text-sm text-gray-500">{t('syndicDash.recouvrement.noDossierDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {actifs.map(d => {
            const si = STAGES.find(s => s.key === d.stage)!
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:border-[#E4DDD0] transition cursor-pointer" onClick={() => setSelected(d)}>
                <div className="text-2xl flex-shrink-0">{si.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 text-sm">{d.coproprio_nom}</p>
                    {d.coproprio_lot && <span className="text-xs bg-[#F7F4EE] text-gray-500 px-2 py-0.5 rounded-full">Lot {d.coproprio_lot}</span>}
                    {d.immeuble_nom && <span className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-2 py-0.5 rounded-full border border-[#E4DDD0]">{d.immeuble_nom}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{t('syndicDash.recouvrement.since')} {new Date(d.added_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} · {t('syndicDash.recouvrement.lastAction')} {new Date(d.date_derniere_action).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-red-600 text-base">{d.montant_actuel.toFixed(2)} €</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${stageCls[si.color]}`}>{si.label}</span>
                </div>
              </div>
            )
          })}
          {regles.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-600 font-medium">✅ {regles.length} {t('syndicDash.recouvrement.dossierSettledCount')} — {totalRegle.toFixed(0)} € {t('syndicDash.recouvrement.recoveredAmount')}</summary>
              <div className="mt-2 space-y-2">
                {regles.map(d => (
                  <div key={d.id} className="bg-green-50 rounded-xl border border-green-100 p-3 flex items-center gap-3">
                    <span className="text-xl">✅</span>
                    <div className="flex-1"><p className="text-sm font-semibold text-green-800">{d.coproprio_nom}</p><p className="text-xs text-green-600">{d.immeuble_nom} · {d.montant_actuel.toFixed(2)} € {t('syndicDash.recouvrement.recoveredAmount')}</p></div>
                    <button onClick={() => saveDossiers(dossiers.filter(x => x.id !== d.id))} className="text-red-400 hover:text-red-600 text-xs p-1">🗑️</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">{t('syndicDash.recouvrement.newDossierTitle')}</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.recouvrement.coproNameLabel')}</label><input type="text" placeholder="Jean Dupont" value={form.coproprio_nom} onChange={e => setForm(f => ({ ...f, coproprio_nom: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.recouvrement.lotNumber')}</label><input type="text" placeholder="42" value={form.coproprio_lot} onChange={e => setForm(f => ({ ...f, coproprio_lot: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.recouvrement.email')}</label><input type="email" placeholder="jean.dupont@email.com" value={form.coproprio_email} onChange={e => setForm(f => ({ ...f, coproprio_email: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.recouvrement.residence')}</label><input type="text" placeholder="Résidence Les Pins" value={form.immeuble_nom} onChange={e => setForm(f => ({ ...f, immeuble_nom: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.recouvrement.amountDue')}</label><input type="number" min="0" step="0.01" placeholder="1250.00" value={form.montant_initial} onChange={e => setForm(f => ({ ...f, montant_initial: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.recouvrement.firstDueDate')}</label><input type="date" value={form.date_premiere_echeance} onChange={e => setForm(f => ({ ...f, date_premiere_echeance: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" /></div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-[#F7F4EE]">{t('syndicDash.recouvrement.cancel')}</button>
              <button onClick={addDossier} disabled={!form.coproprio_nom || !form.montant_initial} className="flex-1 px-4 py-2 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] disabled:opacity-60">{t('syndicDash.recouvrement.createDossier')}</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={ev => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">{t('syndicDash.recouvrement.dossierTitle')} — {selected.coproprio_nom}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
              {STAGES.filter(s => s.key !== 'regle').map(s => (
                <div key={s.key} className={`flex-1 min-w-14 text-center p-2 rounded-lg text-xs font-bold border transition ${selected.stage === s.key ? stageCls[s.color] : 'bg-[#F7F4EE] border-gray-200 text-gray-500'}`}>
                  <div className="text-base mb-0.5">{s.icon}</div>{s.label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-red-50 rounded-xl p-3 text-center"><p className="text-xl font-bold text-red-700">{selected.montant_actuel.toFixed(2)} €</p><p className="text-xs text-red-500">{t('syndicDash.recouvrement.amountDueLabel')}</p></div>
              <div className="bg-[#F7F4EE] rounded-xl p-3 text-center"><p className="text-sm font-bold text-gray-700">{t('syndicDash.recouvrement.lot')} {selected.coproprio_lot || 'N/A'}</p><p className="text-xs text-gray-500">{selected.immeuble_nom || 'N/D'}</p></div>
              <div className="bg-[#F7F4EE] rounded-xl p-3 text-center"><p className="text-sm font-bold text-gray-700">{new Date(selected.added_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</p><p className="text-xs text-gray-500">{t('syndicDash.recouvrement.opening')}</p></div>
            </div>
            <div className="bg-[#F7F4EE] rounded-xl p-4 mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{t('syndicDash.recouvrement.history')}</p>
              <div className="space-y-2">
                {[...selected.historique].reverse().map((h, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-[#C9A84C] rounded-full mt-1.5 flex-shrink-0" />
                    <div><p className="text-sm text-gray-700 font-medium">{h.action}</p><p className="text-xs text-gray-500">{new Date(h.date).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} · {h.auteur}</p></div>
                  </div>
                ))}
              </div>
            </div>
            {selected.stage !== 'regle' && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => generateLetter(selected)} className="flex-1 min-w-32 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">📝 {t('syndicDash.recouvrement.generateLetter')}</button>
                <button onClick={() => escalate(selected.id)} className="flex-1 min-w-32 px-4 py-2 bg-[#C9A84C] text-white rounded-xl text-sm font-semibold hover:bg-orange-700 transition">⬆️ {t('syndicDash.recouvrement.escalate')}</button>
                <button onClick={() => markRegle(selected.id)} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition">✅ {t('syndicDash.recouvrement.settled')}</button>
                <button onClick={() => { saveDossiers(dossiers.filter(d => d.id !== selected.id)); setSelected(null) }} className="px-4 py-2 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50 transition">🗑️</button>
              </div>
            )}
          </div>
        </div>
      )}

      {letter && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setLetter(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6" onClick={ev => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">📝 {t('syndicDash.recouvrement.generatedLetter')}</h3>
              <button onClick={() => setLetter(null)} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
            </div>
            <textarea readOnly value={letter} rows={14} className="w-full px-4 py-3 bg-[#F7F4EE] border border-gray-200 rounded-xl text-sm font-mono resize-none focus:outline-none" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { navigator.clipboard.writeText(letter); setCopiedLetter(true); setTimeout(() => setCopiedLetter(false), 2000) }} className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition ${copiedLetter ? 'bg-green-600 text-white' : 'bg-[#0D1B2E] text-white hover:bg-[#152338]'}`}>
                {copiedLetter ? `✓ ${t('syndicDash.recouvrement.copied')}` : `📋 ${t('syndicDash.recouvrement.copyLetter')}`}
              </button>
              {selected?.coproprio_email && (
                <a href={`mailto:${selected.coproprio_email}?subject=Charges%20de%20copropri%C3%A9t%C3%A9%20impay%C3%A9es&body=${encodeURIComponent(letter)}`} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition text-center">📧 {t('syndicDash.recouvrement.sendByEmail')}</a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
