'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Immeuble } from '../types'
import { LeaAvatar } from '@/components/common/RobotAvatars'
import { useTranslation, useLocale } from '@/lib/i18n/context'

import type { User } from '@supabase/supabase-js'
export default function ComptaCoproSection({ user, userRole, immeubles }: { user: User; userRole: string; immeubles: Immeuble[] }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isPt = locale === 'pt'
  type Lot = { id: string; numero: string; proprietaire: string; tantieme: number; etage: string; surface: number }
  type AppelCharges = { id: string; periode: string; totalBudget: number; lots: string; statut: 'Brouillon' | 'Envoyé' | 'Soldé'; dateCreation: string }
  type EcritureCompta = { id: string; date: string; journal: 'BANQUE' | 'CAISSE' | 'FOURNISSEURS' | 'COPRO' | 'CHARGES'; libelle: string; debit: number; credit: number; compte: string; immeuble: string }
  type Budget = { id: string; immeuble: string; annee: number; postes: { libelle: string; budget: number; realise: number }[] }

  const uid = user?.id || 'demo'
  const [activeTab, setActiveTab] = useState<'tableau' | 'lots' | 'appels' | 'journal' | 'budget' | 'cloture' | 'rapports'>('tableau')

  // ── Lots / Tantièmes ──
  const [lots, setLots] = useState<Lot[]>(() => {
    try { return JSON.parse(localStorage.getItem(`fixit_lots_${uid}`) || '[]') } catch { return [] }
  })
  const [showLotModal, setShowLotModal] = useState(false)
  const [lotForm, setLotForm] = useState({ numero: '', proprietaire: '', tantieme: '', etage: '', surface: '' })

  // ── Appels de charges ──
  const [appels, setAppels] = useState<AppelCharges[]>(() => {
    try { return JSON.parse(localStorage.getItem(`fixit_appels_${uid}`) || '[]') } catch { return [] }
  })
  const [showAppelModal, setShowAppelModal] = useState(false)
  const [appelForm, setAppelForm] = useState({ periode: '', totalBudget: '', immeuble: '' })

  // ── Journal comptable ──
  const [ecritures, setEcritures] = useState<EcritureCompta[]>(() => {
    try { return JSON.parse(localStorage.getItem(`fixit_journal_${uid}`) || '[]') } catch { return [] }
  })
  const [showEcritureModal, setShowEcritureModal] = useState(false)
  const [ecritureForm, setEcritureForm] = useState({ date: new Date().toISOString().split('T')[0], journal: 'BANQUE', libelle: '', debit: '', credit: '', compte: '', immeuble: '' })

  // ── Budget ──
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    try { return JSON.parse(localStorage.getItem(`fixit_budgets_${uid}`) || '[]') } catch { return [] }
  })
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ immeuble: '', annee: new Date().getFullYear().toString() })
  const [budgetPostes, setBudgetPostes] = useState([
    { libelle: isPt ? 'Encargos do elevador' : "Charges d'ascenseur", budget: 0, realise: 0 },
    { libelle: isPt ? 'Manutenção partes comuns' : 'Entretien parties communes', budget: 0, realise: 0 },
    { libelle: isPt ? 'Água fria coletiva' : 'Eau froide collective', budget: 0, realise: 0 },
    { libelle: isPt ? 'Eletricidade comum' : 'Électricité communes', budget: 0, realise: 0 },
    { libelle: isPt ? 'Seguro do edifício' : 'Assurance immeuble', budget: 0, realise: 0 },
    { libelle: isPt ? 'Honorários administração' : 'Honoraires syndic', budget: 0, realise: 0 },
    { libelle: isPt ? 'Obras votadas em AG' : 'Travaux votés en AG', budget: 0, realise: 0 },
    { libelle: isPt ? 'Fundo de reserva (art. 4º DL 268/94)' : 'Fonds de travaux (art 14-2)', budget: 0, realise: 0 },
  ])

  const JOURNALS = ['BANQUE', 'CAISSE', 'FOURNISSEURS', 'COPRO', 'CHARGES']

  // Helpers save
  const saveLots = (updated: Lot[]) => { setLots(updated); localStorage.setItem(`fixit_lots_${uid}`, JSON.stringify(updated)) }
  const saveAppels = (updated: AppelCharges[]) => { setAppels(updated); localStorage.setItem(`fixit_appels_${uid}`, JSON.stringify(updated)) }
  const saveEcritures = (updated: EcritureCompta[]) => { setEcritures(updated); localStorage.setItem(`fixit_journal_${uid}`, JSON.stringify(updated)) }
  const saveBudgets = (updated: Budget[]) => { setBudgets(updated); localStorage.setItem(`fixit_budgets_${uid}`, JSON.stringify(updated)) }

  // Calculs tableau de bord
  const totalTantiemes = lots.reduce((s, l) => s + (l.tantieme || 0), 0)
  const totalDebit = ecritures.reduce((s, e) => s + (e.debit || 0), 0)
  const totalCredit = ecritures.reduce((s, e) => s + (e.credit || 0), 0)
  const solde = totalCredit - totalDebit
  const appelsEnvoyes = appels.filter(a => a.statut !== 'Brouillon').length
  const appelsSoldes = appels.filter(a => a.statut === 'Soldé').length

  // Handlers
  const handleAddLot = () => {
    if (!lotForm.numero.trim()) return
    const l: Lot = { id: Date.now().toString(), numero: lotForm.numero, proprietaire: lotForm.proprietaire, tantieme: parseFloat(lotForm.tantieme) || 0, etage: lotForm.etage, surface: parseFloat(lotForm.surface) || 0 }
    saveLots([...lots, l])
    setShowLotModal(false)
    setLotForm({ numero: '', proprietaire: '', tantieme: '', etage: '', surface: '' })
  }

  const handleAddAppel = () => {
    if (!appelForm.periode.trim()) return
    const totalBudget = parseFloat(appelForm.totalBudget) || 0
    const a: AppelCharges = { id: Date.now().toString(), periode: appelForm.periode, totalBudget, lots: `${lots.length} ${isPt ? 'frações' : 'lots'}`, statut: 'Brouillon', dateCreation: new Date().toISOString() }
    saveAppels([a, ...appels])
    setShowAppelModal(false)
    setAppelForm({ periode: '', totalBudget: '', immeuble: '' })
  }

  const handleEnvoyerAppel = (id: string) => {
    saveAppels(appels.map(a => a.id === id ? { ...a, statut: 'Envoyé' as const } : a))
  }

  const handleSolderAppel = (id: string) => {
    saveAppels(appels.map(a => a.id === id ? { ...a, statut: 'Soldé' as const } : a))
  }

  const handleAddEcriture = () => {
    if (!ecritureForm.libelle.trim()) return
    const e: EcritureCompta = {
      id: Date.now().toString(),
      date: ecritureForm.date,
      journal: ecritureForm.journal as EcritureCompta['journal'],
      libelle: ecritureForm.libelle,
      debit: parseFloat(ecritureForm.debit) || 0,
      credit: parseFloat(ecritureForm.credit) || 0,
      compte: ecritureForm.compte,
      immeuble: ecritureForm.immeuble,
    }
    saveEcritures([e, ...ecritures])
    setShowEcritureModal(false)
    setEcritureForm({ date: new Date().toISOString().split('T')[0], journal: 'BANQUE', libelle: '', debit: '', credit: '', compte: '', immeuble: '' })
  }

  const handleAddBudget = () => {
    if (!budgetForm.immeuble.trim()) return
    const b: Budget = { id: Date.now().toString(), immeuble: budgetForm.immeuble, annee: parseInt(budgetForm.annee) || new Date().getFullYear(), postes: budgetPostes }
    saveBudgets([b, ...budgets])
    setShowBudgetModal(false)
    setBudgetForm({ immeuble: '', annee: new Date().getFullYear().toString() })
    setBudgetPostes(budgetPostes.map(p => ({ ...p, budget: 0, realise: 0 })))
  }

  // Export journal CSV
  const exportJournalCSV = () => {
    const header = isPt ? 'Data,Diário,Descrição,Débito,Crédito,Conta,Edifício\n' : 'Date,Journal,Libellé,Débit,Crédit,Compte,Immeuble\n'
    const rows = ecritures.map(e => `${e.date},${e.journal},"${e.libelle}",${e.debit},${e.credit},${e.compte},${e.immeuble}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `journal_comptable_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const TABS = [
    { key: 'tableau', label: isPt ? '📊 Painel de controlo' : '📊 Tableau de bord' },
    { key: 'lots', label: isPt ? '🏠 Frações & Permilagem' : '🏠 Lots & Tantièmes' },
    { key: 'appels', label: isPt ? '📬 Chamadas de quotas' : '📬 Appels de charges' },
    { key: 'journal', label: isPt ? '📒 Diário contabilístico' : '📒 Journal comptable' },
    { key: 'budget', label: isPt ? '📋 Orçamento previsional' : '📋 Budget prévisionnel' },
    { key: 'cloture', label: isPt ? '📁 Encerramento exercício' : '📁 Clôture exercice' },
    { key: 'rapports', label: isPt ? '📄 Relatórios AG' : '📄 Rapports AG' },
  ]

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-5 border-b-2 border-orange-400 shadow-sm">
        <h1 className="text-2xl font-semibold">{isPt ? '💶 Contabilidade Condomínio' : '💶 Comptabilité Copropriété'}</h1>
        <p className="text-sm text-gray-500">{isPt ? 'Ferramentas profissionais de contabilidade para administradores de condomínios' : 'Outils professionnels de comptabilité pour syndics et gestionnaires'}</p>
      </div>

      {/* Onglets */}
      <div className="bg-white border-b overflow-x-auto">
        <div className="flex min-w-max">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)} className={`px-5 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition ${activeTab === tab.key ? 'border-orange-400 text-orange-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 lg:p-8">

        {/* ── TABLEAU DE BORD ── */}
        {activeTab === 'tableau' && (
          <div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-orange-400">
                <div className="text-sm text-gray-500 mb-1">{isPt ? 'Frações geridas' : 'Lots gérés'}</div>
                <div className="text-3xl font-bold text-[#C9A84C]">{lots.length}</div>
                <div className="text-xs text-gray-500 mt-1">{totalTantiemes.toFixed(0)} {isPt ? 'milésimos' : 'tantièmes'}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-[#C9A84C]">
                <div className="text-sm text-gray-500 mb-1">{isPt ? 'Chamadas de quotas' : 'Appels de charges'}</div>
                <div className="text-3xl font-bold text-[#0D1B2E]">{appels.length}</div>
                <div className="text-xs text-gray-500 mt-1">{appelsEnvoyes} {isPt ? 'enviadas' : 'envoyés'} · {appelsSoldes} {isPt ? 'liquidadas' : 'soldés'}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-green-400">
                <div className="text-sm text-gray-500 mb-1">{isPt ? 'Total créditos' : 'Total crédits'}</div>
                <div className="text-3xl font-bold text-green-600">{totalCredit.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>
                <div className="text-xs text-gray-500 mt-1">{isPt ? 'recebimentos' : 'encaissements'}</div>
              </div>
              <div className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${solde >= 0 ? 'border-green-400' : 'border-red-400'}`}>
                <div className="text-sm text-gray-500 mb-1">{isPt ? 'Saldo tesouraria' : 'Solde trésorerie'}</div>
                <div className={`text-3xl font-bold ${solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>{solde.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>
                <div className="text-xs text-gray-500 mt-1">{totalDebit.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} € {isPt ? 'débitos' : 'débits'}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold mb-4">{isPt ? '📬 Últimas chamadas de quotas' : '📬 Derniers appels de charges'}</h2>
                {appels.slice(0, 5).map(a => (
                  <div key={a.id} className="flex justify-between items-center py-3 border-b last:border-0">
                    <div>
                      <div className="font-semibold">{a.periode}</div>
                      <div className="text-sm text-gray-500">{a.lots} · {a.totalBudget.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${a.statut === 'Soldé' ? 'bg-green-100 text-green-700' : a.statut === 'Envoyé' ? 'bg-[#F7F4EE] text-[#C9A84C] border border-[#E4DDD0]' : 'bg-[#F7F4EE] text-gray-700'}`}>{isPt ? (a.statut === 'Soldé' ? 'Liquidada' : a.statut === 'Envoyé' ? 'Enviada' : 'Rascunho') : a.statut}</span>
                  </div>
                ))}
                {appels.length === 0 && <p className="text-gray-500 text-sm text-center py-4">{isPt ? 'Nenhuma chamada de quotas' : 'Aucun appel de charges'}</p>}
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold mb-4">{isPt ? '📒 Últimos lançamentos' : '📒 Dernières écritures'}</h2>
                {ecritures.slice(0, 5).map(e => (
                  <div key={e.id} className="flex justify-between items-center py-3 border-b last:border-0">
                    <div>
                      <div className="font-semibold text-sm">{e.libelle}</div>
                      <div className="text-xs text-gray-500">{e.date} · {e.journal}</div>
                    </div>
                    <div className="text-right">
                      {e.debit > 0 && <div className="text-red-600 font-semibold text-sm">-{e.debit.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>}
                      {e.credit > 0 && <div className="text-green-600 font-semibold text-sm">+{e.credit.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>}
                    </div>
                  </div>
                ))}
                {ecritures.length === 0 && <p className="text-gray-500 text-sm text-center py-4">{isPt ? 'Nenhum lançamento contabilístico' : 'Aucune écriture comptable'}</p>}
              </div>
            </div>

            {/* Alertes */}
            <div className="mt-6 bg-amber-50 border-2 border-amber-200 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-amber-800 mb-3">{isPt ? '⚠️ Pontos de atenção' : '⚠️ Points d\'attention'}</h2>
              <div className="space-y-2">
                {lots.length === 0 && <div className="text-sm text-amber-700">{isPt ? '• Nenhuma fração registada — comece por adicionar as frações do condomínio' : '• Aucun lot enregistré — commencez par ajouter les lots de la copropriété'}</div>}
                {appels.filter(a => a.statut === 'Brouillon').length > 0 && <div className="text-sm text-amber-700">• {appels.filter(a => a.statut === 'Brouillon').length} {isPt ? 'chamada(s) de quotas em rascunho para enviar' : 'appel(s) de charges en brouillon à envoyer'}</div>}
                {totalTantiemes > 0 && totalTantiemes !== 10000 && <div className="text-sm text-amber-700">{isPt ? `• Total milésimos : ${totalTantiemes} (deve ser 10 000 para um condomínio padrão)` : `• Total tantièmes : ${totalTantiemes} (devrait être 10 000 pour une copropriété standard)`}</div>}
                {lots.length > 0 && totalTantiemes === 10000 && appels.length > 0 && <div className="text-sm text-green-700">{isPt ? '✅ Milésimos equilibrados (10 000/10 000)' : '✅ Tantièmes équilibrés (10 000/10 000)'}</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── LOTS & TANTIÈMES ── */}
        {activeTab === 'lots' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">{isPt ? '🏠 Frações & Permilagem' : '🏠 Lots & Tantièmes'}</h2>
                <p className="text-sm text-gray-500 mt-1">{isPt ? 'Total' : 'Total'} : {totalTantiemes.toFixed(0)} / 10 000 {isPt ? 'milésimos' : 'tantièmes'} · {lots.length} {isPt ? 'frações' : 'lots'}</p>
              </div>
              <button onClick={() => setShowLotModal(true)} className="bg-[#C9A84C] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#C9A84C] transition">{isPt ? '+ Adicionar uma fração' : '+ Ajouter un lot'}</button>
            </div>

            {/* Barre de progression tantièmes */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold">{isPt ? 'Milésimos atribuídos' : 'Tantièmes attribués'}</span>
                <span className={`font-bold ${totalTantiemes === 10000 ? 'text-green-600' : 'text-[#C9A84C]'}`}>{totalTantiemes.toFixed(0)} / 10 000</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className={`h-3 rounded-full transition-all ${totalTantiemes === 10000 ? 'bg-green-500' : 'bg-orange-400'}`} style={{ width: `${Math.min((totalTantiemes / 10000) * 100, 100)}%` }} />
              </div>
            </div>

            {lots.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <div className="text-5xl mb-4">🏠</div>
                <h3 className="text-xl font-bold mb-2">{isPt ? 'Nenhuma fração' : 'Aucun lot'}</h3>
                <p className="text-gray-500 mb-6">{isPt ? 'Comece por registar as frações do seu condomínio' : 'Commencez par enregistrer les lots de votre copropriété'}</p>
                <button onClick={() => setShowLotModal(true)} className="bg-[#C9A84C] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#C9A84C] transition">{isPt ? '+ Adicionar a primeira fração' : '+ Ajouter le premier lot'}</button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[#F7F4EE] text-sm text-gray-500">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold">{isPt ? 'N° Fração' : 'N° Lot'}</th>
                      <th className="px-5 py-3 text-left font-semibold">{isPt ? 'Proprietário' : 'Propriétaire'}</th>
                      <th className="px-5 py-3 text-left font-semibold">{isPt ? 'Andar' : 'Étage'}</th>
                      <th className="px-5 py-3 text-right font-semibold">{isPt ? 'Área (m²)' : 'Surface (m²)'}</th>
                      <th className="px-5 py-3 text-right font-semibold">{isPt ? 'Milésimos' : 'Tantièmes'}</th>
                      <th className="px-5 py-3 text-right font-semibold">{isPt ? 'Quota-parte' : 'Quote-part'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((l, i) => (
                      <tr key={l.id} className={`border-t ${i % 2 === 0 ? '' : 'bg-[#F7F4EE]/50'} hover:bg-orange-50 transition`}>
                        <td className="px-5 py-3 font-bold text-orange-700">{l.numero}</td>
                        <td className="px-5 py-3">{l.proprietaire || '—'}</td>
                        <td className="px-5 py-3 text-gray-600">{l.etage || '—'}</td>
                        <td className="px-5 py-3 text-right">{l.surface || '—'}</td>
                        <td className="px-5 py-3 text-right font-semibold">{l.tantieme.toFixed(0)}</td>
                        <td className="px-5 py-3 text-right text-gray-500">{totalTantiemes > 0 ? ((l.tantieme / totalTantiemes) * 100).toFixed(2) : '0'}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-orange-50 font-bold border-t-2 border-orange-200">
                    <tr>
                      <td colSpan={4} className="px-5 py-3 text-orange-800">TOTAL ({lots.length} {isPt ? 'frações' : 'lots'})</td>
                      <td className="px-5 py-3 text-right text-orange-800">{totalTantiemes.toFixed(0)}</td>
                      <td className="px-5 py-3 text-right text-orange-800">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── APPELS DE CHARGES ── */}
        {activeTab === 'appels' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{isPt ? '📬 Chamadas de quotas' : '📬 Appels de charges'}</h2>
              <button onClick={() => setShowAppelModal(true)} className="bg-[#C9A84C] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#C9A84C] transition">{isPt ? '+ Nova chamada' : '+ Nouvel appel'}</button>
            </div>

            {appels.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <div className="text-5xl mb-4">📬</div>
                <h3 className="text-xl font-bold mb-2">{isPt ? 'Nenhuma chamada de quotas' : 'Aucun appel de charges'}</h3>
                <p className="text-gray-500 mb-4">{isPt ? 'Crie as suas chamadas de quotas trimestrais ou mensais' : 'Créez vos appels de charges trimestriels ou mensuels'}</p>
                <button onClick={() => setShowAppelModal(true)} className="bg-[#C9A84C] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#C9A84C] transition">{isPt ? '+ Criar uma chamada' : '+ Créer un appel'}</button>
              </div>
            ) : (
              <div className="space-y-4">
                {appels.map(a => {
                  const totalTantiemesLocal = lots.reduce((s, l) => s + l.tantieme, 0)
                  return (
                    <div key={a.id} className="bg-white rounded-2xl shadow-sm p-6">
                      <div className="flex flex-col md:flex-row gap-4 items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="font-bold text-lg">{a.periode}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${a.statut === 'Soldé' ? 'bg-green-100 text-green-700' : a.statut === 'Envoyé' ? 'bg-[#F7F4EE] text-[#C9A84C] border border-[#E4DDD0]' : 'bg-[#F7F4EE] text-gray-700'}`}>{isPt ? (a.statut === 'Soldé' ? 'Liquidada' : a.statut === 'Envoyé' ? 'Enviada' : 'Rascunho') : a.statut}</span>
                          </div>
                          <div className="flex gap-6 text-sm text-gray-600 mb-4">
                            <span>💰 {isPt ? 'Orçamento total' : 'Budget total'} : <strong>{a.totalBudget.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</strong></span>
                            <span>🏠 {lots.length} {isPt ? 'frações' : 'lots'}</span>
                            <span>📅 {new Date(a.dateCreation).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>
                          </div>
                          {lots.length > 0 && totalTantiemesLocal > 0 && (
                            <div className="overflow-x-auto">
                              <table className="text-xs border-collapse w-full max-w-xl">
                                <thead>
                                  <tr className="bg-[#F7F4EE]">
                                    <th className="border border-gray-200 px-2 py-1 text-left">{isPt ? 'Fração' : 'Lot'}</th>
                                    <th className="border border-gray-200 px-2 py-1 text-left">{isPt ? 'Proprietário' : 'Propriétaire'}</th>
                                    <th className="border border-gray-200 px-2 py-1 text-right">{isPt ? 'Milésimos' : 'Tantièmes'}</th>
                                    <th className="border border-gray-200 px-2 py-1 text-right font-bold text-orange-700">{isPt ? 'Quota-parte' : 'Quote-part'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lots.slice(0, 4).map(l => (
                                    <tr key={l.id}>
                                      <td className="border border-gray-200 px-2 py-1 font-bold">{l.numero}</td>
                                      <td className="border border-gray-200 px-2 py-1">{l.proprietaire || '—'}</td>
                                      <td className="border border-gray-200 px-2 py-1 text-right">{l.tantieme}</td>
                                      <td className="border border-gray-200 px-2 py-1 text-right font-bold text-orange-700">{((l.tantieme / totalTantiemesLocal) * a.totalBudget).toFixed(2)} €</td>
                                    </tr>
                                  ))}
                                  {lots.length > 4 && <tr><td colSpan={4} className="border border-gray-200 px-2 py-1 text-center text-gray-500">{isPt ? `... e mais ${lots.length - 4} frações` : `... et ${lots.length - 4} autres lots`}</td></tr>}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 min-w-[160px]">
                          {a.statut === 'Brouillon' && <button onClick={() => handleEnvoyerAppel(a.id)} className="bg-[#0D1B2E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#152338] transition">{isPt ? '📤 Enviar' : '📤 Envoyer'}</button>}
                          {a.statut === 'Envoyé' && <button onClick={() => handleSolderAppel(a.id)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-600 transition">{isPt ? '✅ Liquidar' : '✅ Solder'}</button>}
                          <button className="bg-[#F7F4EE] text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition">{isPt ? '📄 Imprimir' : '📄 Imprimer'}</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── JOURNAL COMPTABLE ── */}
        {activeTab === 'journal' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">{isPt ? '📒 Diário contabilístico' : '📒 Journal comptable'}</h2>
                <p className="text-sm text-gray-500 mt-1">{isPt ? 'Saldo' : 'Solde'} : <span className={`font-bold ${solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>{solde.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</span></p>
              </div>
              <div className="flex gap-2">
                <button onClick={exportJournalCSV} className="border-2 border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#F7F4EE] transition">{isPt ? '📥 Exportar CSV' : '📥 Export CSV'}</button>
                <button onClick={() => setShowEcritureModal(true)} className="bg-[#C9A84C] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#C9A84C] transition">{isPt ? '+ Lançamento' : '+ Écriture'}</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6 flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{totalDebit.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>
                <div className="text-xs text-gray-500 mt-1">{isPt ? 'Total débitos' : 'Total débits'}</div>
              </div>
              <div className="w-px bg-gray-200" />
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{totalCredit.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>
                <div className="text-xs text-gray-500 mt-1">{isPt ? 'Total créditos' : 'Total crédits'}</div>
              </div>
              <div className="w-px bg-gray-200" />
              <div className="text-center">
                <div className={`text-2xl font-bold ${solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>{solde.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>
                <div className="text-xs text-gray-500 mt-1">{isPt ? 'Saldo' : 'Solde'}</div>
              </div>
              <div className="w-px bg-gray-200" />
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-700">{ecritures.length}</div>
                <div className="text-xs text-gray-500 mt-1">{isPt ? 'Lançamentos' : 'Écritures'}</div>
              </div>
            </div>

            {ecritures.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <div className="text-5xl mb-4">📒</div>
                <h3 className="text-xl font-bold mb-2">{isPt ? 'Diário vazio' : 'Journal vide'}</h3>
                <p className="text-gray-500 mb-6">{isPt ? 'Comece a introduzir os seus lançamentos contabilísticos' : 'Commencez à saisir vos écritures comptables'}</p>
                <button onClick={() => setShowEcritureModal(true)} className="bg-[#C9A84C] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#C9A84C] transition">{isPt ? '+ Primeiro lançamento' : '+ Première écriture'}</button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#F7F4EE] text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">{isPt ? 'Data' : 'Date'}</th>
                      <th className="px-4 py-3 text-left">{isPt ? 'Diário' : 'Journal'}</th>
                      <th className="px-4 py-3 text-left">{isPt ? 'Descrição' : 'Libellé'}</th>
                      <th className="px-4 py-3 text-left">{isPt ? 'Conta' : 'Compte'}</th>
                      <th className="px-4 py-3 text-right">{isPt ? 'Débito' : 'Débit'}</th>
                      <th className="px-4 py-3 text-right">{isPt ? 'Crédito' : 'Crédit'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ecritures.map((e, i) => (
                      <tr key={e.id} className={`border-t hover:bg-[#F7F4EE] ${i % 2 === 0 ? '' : 'bg-[#F7F4EE]/30'}`}>
                        <td className="px-4 py-3 text-gray-600">{e.date}</td>
                        <td className="px-4 py-3"><span className="bg-[#F7F4EE] text-gray-700 px-2 py-0.5 rounded text-xs font-mono font-bold">{e.journal}</span></td>
                        <td className="px-4 py-3 font-medium">{e.libelle}</td>
                        <td className="px-4 py-3 font-mono text-gray-500 text-xs">{e.compte || '—'}</td>
                        <td className="px-4 py-3 text-right text-red-600 font-semibold">{e.debit > 0 ? e.debit.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR') + ' €' : ''}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-semibold">{e.credit > 0 ? e.credit.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR') + ' €' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── BUDGET PRÉVISIONNEL ── */}
        {activeTab === 'budget' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{isPt ? '📋 Orçamento previsional' : '📋 Budget prévisionnel'}</h2>
              <button onClick={() => setShowBudgetModal(true)} className="bg-[#C9A84C] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#C9A84C] transition">{isPt ? '+ Novo orçamento' : '+ Nouveau budget'}</button>
            </div>

            {budgets.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <div className="text-5xl mb-4">📋</div>
                <h3 className="text-xl font-bold mb-2">{isPt ? 'Nenhum orçamento' : 'Aucun budget'}</h3>
                <p className="text-gray-500 mb-6">{isPt ? 'Crie o orçamento previsional do seu condomínio' : 'Créez le budget prévisionnel de votre copropriété'}</p>
                <button onClick={() => setShowBudgetModal(true)} className="bg-[#C9A84C] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#C9A84C] transition">{isPt ? '+ Criar um orçamento' : '+ Créer un budget'}</button>
              </div>
            ) : (
              budgets.map(b => {
                const totalBudgetItem = b.postes.reduce((s, p) => s + p.budget, 0)
                const totalRealise = b.postes.reduce((s, p) => s + p.realise, 0)
                const ecart = totalBudgetItem - totalRealise
                return (
                  <div key={b.id} className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-bold">{b.immeuble}</h3>
                        <p className="text-gray-500">{isPt ? 'Exercício' : 'Exercice'} {b.annee}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">{isPt ? 'Orçamento total' : 'Budget total'}</div>
                        <div className="text-2xl font-bold text-[#C9A84C]">{totalBudgetItem.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[#F7F4EE] text-gray-500 text-xs uppercase">
                          <tr>
                            <th className="px-4 py-2 text-left">{isPt ? 'Rubrica de encargo' : 'Poste de charge'}</th>
                            <th className="px-4 py-2 text-right">{isPt ? 'Orçamento' : 'Budget'}</th>
                            <th className="px-4 py-2 text-right">{isPt ? 'Realizado' : 'Réalisé'}</th>
                            <th className="px-4 py-2 text-right">{isPt ? 'Desvio' : 'Écart'}</th>
                            <th className="px-4 py-2 text-right">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.postes.map((p, i) => {
                            const e = p.budget - p.realise
                            const pct = p.budget > 0 ? (p.realise / p.budget) * 100 : 0
                            return (
                              <tr key={i} className="border-t hover:bg-[#F7F4EE]">
                                <td className="px-4 py-2">{p.libelle}</td>
                                <td className="px-4 py-2 text-right">{p.budget.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</td>
                                <td className="px-4 py-2 text-right">{p.realise.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</td>
                                <td className={`px-4 py-2 text-right font-semibold ${e >= 0 ? 'text-green-600' : 'text-red-600'}`}>{e.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</td>
                                <td className="px-4 py-2 text-right">
                                  <div className="flex items-center gap-2 justify-end">
                                    <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                      <div className={`h-1.5 rounded-full ${pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-orange-400' : 'bg-green-400'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                    </div>
                                    <span className="text-xs">{pct.toFixed(0)}%</span>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="font-bold bg-orange-50 border-t-2 border-orange-200">
                          <tr>
                            <td className="px-4 py-3 text-orange-800">TOTAL</td>
                            <td className="px-4 py-3 text-right text-orange-800">{totalBudgetItem.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</td>
                            <td className="px-4 py-3 text-right text-orange-800">{totalRealise.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</td>
                            <td className={`px-4 py-3 text-right ${ecart >= 0 ? 'text-green-700' : 'text-red-700'}`}>{ecart.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</td>
                            <td className="px-4 py-3 text-right text-orange-800">{totalBudgetItem > 0 ? ((totalRealise / totalBudgetItem) * 100).toFixed(0) : 0}%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── CLÔTURE EXERCICE ── */}
        {activeTab === 'cloture' && (
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold mb-6">{isPt ? '📁 Encerramento de exercício' : '📁 Clôture d\'exercice'}</h2>
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <h3 className="font-bold text-lg mb-4">{isPt ? '✅ Checklist de encerramento anual' : '✅ Checklist de clôture annuelle'}</h3>
              <div className="space-y-3">
                {[
                  { label: isPt ? 'Verificação do balancete geral' : 'Vérification de la balance générale', done: ecritures.length > 0 },
                  { label: isPt ? 'Reconciliação bancária efetuada' : 'Rapprochement bancaire effectué', done: false },
                  { label: isPt ? 'Todas as chamadas de quotas liquidadas' : 'Tous les appels de charges soldés', done: appels.every(a => a.statut === 'Soldé') && appels.length > 0 },
                  { label: isPt ? 'Mapa de repartição por milésimos verificado' : 'Tableau de répartition par tantièmes vérifié', done: Math.abs(totalTantiemes - 10000) < 1 && lots.length > 0 },
                  { label: isPt ? 'Validação do orçamento previsional N+1' : 'Validation du budget prévisionnel N+1', done: budgets.some(b => b.annee === new Date().getFullYear() + 1) },
                  { label: isPt ? 'Preparação do relatório para a AG anual' : "Préparation du rapport pour l'AG annuelle", done: false },
                  { label: isPt ? 'Exportação dos documentos contabilísticos' : 'Export des pièces comptables', done: false },
                  { label: isPt ? 'Arquivo dos documentos (10 anos)' : 'Archivage des documents (10 ans)', done: false },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${item.done ? 'bg-green-50' : 'bg-[#F7F4EE]'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${item.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{item.done ? '✓' : (i + 1)}</div>
                    <span className={`text-sm ${item.done ? 'text-green-700 font-semibold' : 'text-gray-700'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-lg mb-4">{isPt ? `📊 Resumo do exercício ${new Date().getFullYear()}` : `📊 Résumé de l'exercice ${new Date().getFullYear()}`}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#F7F4EE] rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">{isPt ? 'Total encargos' : 'Total charges'}</div>
                  <div className="text-xl font-bold text-red-600">{totalDebit.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>
                </div>
                <div className="bg-[#F7F4EE] rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">{isPt ? 'Total receitas' : 'Total produits'}</div>
                  <div className="text-xl font-bold text-green-600">{totalCredit.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>
                </div>
                <div className="bg-[#F7F4EE] rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">{isPt ? 'Resultado' : 'Résultat'}</div>
                  <div className={`text-xl font-bold ${solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>{solde.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div>
                </div>
                <div className="bg-[#F7F4EE] rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">{isPt ? 'Número de frações' : 'Nombre de lots'}</div>
                  <div className="text-xl font-bold text-[#C9A84C]">{lots.length}</div>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button onClick={exportJournalCSV} className="flex-1 border-2 border-orange-300 text-orange-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-orange-50 transition text-sm">{isPt ? '📥 Exportar diário CSV' : '📥 Exporter journal CSV'}</button>
                <button className="flex-1 bg-[#C9A84C] text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-[#C9A84C] transition text-sm">{isPt ? '📄 Relatório PDF' : '📄 Rapport PDF'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ── RAPPORTS AG ── */}
        {activeTab === 'rapports' && (
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold mb-6">{isPt ? '📄 Relatórios para a Assembleia Geral' : '📄 Rapports pour l\'Assemblée Générale'}</h2>
            <div className="space-y-4">
              {[
                { titre: isPt ? 'Relatório financeiro anual' : 'Rapport financier annuel', desc: isPt ? 'Balanço contabilístico, encargos por rubrica, comparativo N/N-1' : 'Bilan comptable, charges par poste, comparatif N/N-1', icon: '💰' },
                { titre: isPt ? 'Mapa de encargos por fração' : 'État des charges par lot', desc: isPt ? 'Repartição por milésimos para cada condómino' : 'Répartition par tantièmes pour chaque copropriétaire', icon: '🏠' },
                { titre: isPt ? 'Orçamento previsional N+1' : 'Budget prévisionnel N+1', desc: isPt ? 'Propostas de orçamento para o próximo exercício' : 'Propositions de budget pour le prochain exercice', icon: '📋' },
                { titre: isPt ? 'Chamadas de quotas — resumo' : 'Appels de charges — récapitulatif', desc: isPt ? 'Todas as chamadas enviadas e o seu estado de pagamento' : 'Tous les appels envoyés et leur statut de paiement', icon: '📬' },
                { titre: isPt ? 'Fundo de reserva (art. 4º DL 268/94)' : 'Fonds de travaux (article 14-2)', desc: isPt ? 'Estado do fundo de reserva obrigatório' : 'État du fonds de réserve obligatoire', icon: '🏗️' },
                { titre: isPt ? 'Contratos em vigor' : 'Contrats en cours', desc: isPt ? 'Lista dos contratos de manutenção e prestadores' : "Liste des contrats d'entretien et prestataires", icon: '📑' },
              ].map((rapport, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm p-5 flex justify-between items-center hover:shadow-md transition">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{rapport.icon}</span>
                    <div>
                      <h3 className="font-bold">{rapport.titre}</h3>
                      <p className="text-sm text-gray-500">{rapport.desc}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button className="text-sm bg-[#F7F4EE] hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg font-semibold transition">{isPt ? '👁 Pré-visualizar' : '👁 Prévisualiser'}</button>
                    <button className="text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-2 rounded-lg font-semibold transition">📄 PDF</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Modals ── */}
      {showLotModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{isPt ? '🏠 Nova fração' : '🏠 Nouveau lot'}</h2></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{isPt ? 'N° da fração *' : 'N° de lot *'}</label>
                  <input value={lotForm.numero} onChange={e => setLotForm({...lotForm, numero: e.target.value})} placeholder="Ex: 12 ou A205" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{isPt ? 'Andar' : 'Étage'}</label>
                  <input value={lotForm.etage} onChange={e => setLotForm({...lotForm, etage: e.target.value})} placeholder={isPt ? 'R/C, 1º, 2º...' : 'RDC, 1er, 2ème...'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{isPt ? 'Proprietário' : 'Propriétaire'}</label>
                <input value={lotForm.proprietaire} onChange={e => setLotForm({...lotForm, proprietaire: e.target.value})} placeholder={isPt ? 'Nome do proprietário' : 'Nom du propriétaire'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{isPt ? 'Milésimos' : 'Tantièmes'}</label>
                  <input type="number" value={lotForm.tantieme} onChange={e => setLotForm({...lotForm, tantieme: e.target.value})} placeholder="Ex: 250" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                  <p className="text-xs text-gray-500 mt-1">{isPt ? 'Sobre 10 000 total' : 'Sur 10 000 total'}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{isPt ? 'Área (m²)' : 'Surface (m²)'}</label>
                  <input type="number" value={lotForm.surface} onChange={e => setLotForm({...lotForm, surface: e.target.value})} placeholder="45" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowLotModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button onClick={handleAddLot} className="flex-1 py-2.5 bg-[#C9A84C] text-white rounded-xl font-semibold hover:bg-[#C9A84C]">{isPt ? 'Adicionar' : 'Ajouter'}</button>
            </div>
          </div>
        </div>
      )}

      {showAppelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{isPt ? '📬 Nova chamada de quotas' : '📬 Nouvel appel de charges'}</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">{isPt ? 'Período *' : 'Période *'}</label>
                <input value={appelForm.periode} onChange={e => setAppelForm({...appelForm, periode: e.target.value})} placeholder="Ex: T1 2026, Janvier 2026..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{isPt ? 'Orçamento total (€)' : 'Budget total (€)'}</label>
                <input type="number" value={appelForm.totalBudget} onChange={e => setAppelForm({...appelForm, totalBudget: e.target.value})} placeholder="Ex: 12500" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
              </div>
              {lots.length > 0 && parseFloat(appelForm.totalBudget) > 0 && (
                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-orange-800 mb-2">{isPt ? 'Repartição automática por milésimos :' : 'Répartition automatique par tantièmes :'}</p>
                  {lots.slice(0, 3).map(l => (
                    <div key={l.id} className="flex justify-between text-sm text-orange-700">
                      <span>{isPt ? 'Fração' : 'Lot'} {l.numero} ({l.tantieme} {isPt ? 'milésimos' : 'tièmes'})</span>
                      <span className="font-bold">{((l.tantieme / Math.max(totalTantiemes, 1)) * parseFloat(appelForm.totalBudget)).toFixed(2)} €</span>
                    </div>
                  ))}
                  {lots.length > 3 && <p className="text-xs text-[#C9A84C] mt-1">{isPt ? `...e mais ${lots.length - 3} frações` : `...et ${lots.length - 3} autres lots`}</p>}
                </div>
              )}
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowAppelModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button onClick={handleAddAppel} className="flex-1 py-2.5 bg-[#C9A84C] text-white rounded-xl font-semibold hover:bg-[#C9A84C]">{isPt ? 'Criar a chamada' : 'Créer l\'appel'}</button>
            </div>
          </div>
        </div>
      )}

      {showEcritureModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{isPt ? '📒 Novo lançamento contabilístico' : '📒 Nouvelle écriture comptable'}</h2></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{isPt ? 'Data *' : 'Date *'}</label>
                  <input type="date" value={ecritureForm.date} onChange={e => setEcritureForm({...ecritureForm, date: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{isPt ? 'Diário' : 'Journal'}</label>
                  <select value={ecritureForm.journal} onChange={e => setEcritureForm({...ecritureForm, journal: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none">
                    {JOURNALS.map(j => <option key={j}>{j}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{isPt ? 'Descrição *' : 'Libellé *'}</label>
                <input value={ecritureForm.libelle} onChange={e => setEcritureForm({...ecritureForm, libelle: e.target.value})} placeholder={isPt ? 'Ex: Fatura eletricidade partes comuns' : 'Ex: Facture électricité parties communes'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{isPt ? 'Débito (€)' : 'Débit (€)'}</label>
                  <input type="number" value={ecritureForm.debit} onChange={e => setEcritureForm({...ecritureForm, debit: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{isPt ? 'Crédito (€)' : 'Crédit (€)'}</label>
                  <input type="number" value={ecritureForm.credit} onChange={e => setEcritureForm({...ecritureForm, credit: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{isPt ? 'N° conta' : 'N° compte'}</label>
                  <input value={ecritureForm.compte} onChange={e => setEcritureForm({...ecritureForm, compte: e.target.value})} placeholder="Ex: 606100" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{isPt ? 'Edifício' : 'Immeuble'}</label>
                  <input value={ecritureForm.immeuble} onChange={e => setEcritureForm({...ecritureForm, immeuble: e.target.value})} placeholder={isPt ? 'Edifício...' : 'Résidence...'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowEcritureModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button onClick={handleAddEcriture} className="flex-1 py-2.5 bg-[#C9A84C] text-white rounded-xl font-semibold hover:bg-[#C9A84C]">{isPt ? 'Registar' : 'Saisir'}</button>
            </div>
          </div>
        </div>
      )}

      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{isPt ? '📋 Novo orçamento previsional' : '📋 Nouveau budget prévisionnel'}</h2></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">{isPt ? 'Edifício / Condomínio *' : 'Immeuble / Résidence *'}</label>
                  <input value={budgetForm.immeuble} onChange={e => setBudgetForm({...budgetForm, immeuble: e.target.value})} placeholder={isPt ? 'Edifício Os Pinheiros' : 'Résidence Les Pins'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{isPt ? 'Ano' : 'Année'}</label>
                  <input type="number" value={budgetForm.annee} onChange={e => setBudgetForm({...budgetForm, annee: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
              </div>
              <h3 className="font-bold text-gray-700 mt-2">{isPt ? 'Rubricas de encargos' : 'Postes de charges'}</h3>
              {budgetPostes.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 flex-1">{p.libelle}</span>
                  <input
                    type="number"
                    value={p.budget || ''}
                    onChange={e => setBudgetPostes(budgetPostes.map((pp, ii) => ii === i ? { ...pp, budget: parseFloat(e.target.value) || 0 } : pp))}
                    placeholder={locale === 'pt' ? 'Orçamento €' : 'Budget €'}
                    className="w-28 border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:border-orange-400 outline-none text-right"
                  />
                  <span className="text-xs text-gray-500">€</span>
                </div>
              ))}
              <div className="bg-orange-50 rounded-xl p-3 flex justify-between">
                <span className="font-bold text-orange-800">{locale === 'pt' ? 'Orçamento total' : 'Total budget'}</span>
                <span className="font-bold text-[#C9A84C]">{budgetPostes.reduce((s, p) => s + p.budget, 0).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</span>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowBudgetModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button onClick={handleAddBudget} className="flex-1 py-2.5 bg-[#C9A84C] text-white rounded-xl font-semibold hover:bg-[#C9A84C]">{isPt ? 'Criar o orçamento' : 'Créer le budget'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
