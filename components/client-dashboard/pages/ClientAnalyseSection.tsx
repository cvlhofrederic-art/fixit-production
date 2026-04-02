'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import { FileSearch, Shield, CheckCircle, AlertTriangle, Copy, Check, X, Star, FileText, MessageSquare, ChevronRight } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

// ── Types ──

type AnalyseConformiteDetail = {
  id: string; label: string; status: 'ok' | 'partial' | 'missing' | 'na'; poids: number
}
type AnalysePrixDetail = {
  designation: string; prix: number; fourchette_min?: number; fourchette_max?: number; status: 'ok' | 'bas' | 'eleve' | 'excessif' | 'inconnu'
}
type AnalyseScores = {
  conformite: { total: number; max: number; details: AnalyseConformiteDetail[] }
  confiance: number
  prix?: { ecart_moyen_pct: number; details: AnalysePrixDetail[] }
  action_recommandee?: string
  messages_negociation?: string[]
  [key: string]: unknown
}

interface ClientAnalyseSectionProps {
  user: any // eslint-disable-line @typescript-eslint/no-explicit-any
  locale: string
  t: (key: string) => string
}

export default function ClientAnalyseSection({ user, locale, t }: ClientAnalyseSectionProps) {
  // ── Analyse Devis state ──
  const [analyseInput, setAnalyseInput] = useState('')
  const [analyseFilename, setAnalyseFilename] = useState('')
  const [analyseResult, setAnalyseResult] = useState('')
  const [analyseLoading, setAnalyseLoading] = useState(false)
  const [analyseInputMode, setAnalyseInputMode] = useState<'paste' | 'pdf'>('pdf')
  const [analyseExtracting, setAnalyseExtracting] = useState(false)
  const [analysePdfReady, setAnalysePdfReady] = useState(false)
  const [analyseHistory, setAnalyseHistory] = useState<{id?: string; date: string; filename: string; verdict: string; score_conformite?: number; score_confiance?: number; action?: string}[]>([])
  const [analyseScores, setAnalyseScores] = useState<AnalyseScores | null>(null)
  const [analyseExtracted, setAnalyseExtracted] = useState<Record<string, any> | null>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [analyseSiret, setAnalyseSiret] = useState<Record<string, any> | null>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [analyseIsVitfix, setAnalyseIsVitfix] = useState(false)
  const [analyseAccordion, setAnalyseAccordion] = useState<string | null>(null)

  return (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#FFC107] to-[#FFB300] rounded-2xl p-6 text-dark">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white/40 rounded-xl flex items-center justify-center">
                  <FileSearch className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-display font-black tracking-[-0.02em]">{t('clientDash.analyse.title')}</h2>
                  <p className="text-mid text-sm">{t('clientDash.analyse.subtitle')}</p>
                </div>
              </div>
              <div className="flex gap-4 mt-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-700" />
                  <span>{t('clientDash.analyse.marketPrice')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-green-700" />
                  <span>{t('clientDash.analyse.costBreakdown')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>{t('clientDash.analyse.scamDetection')}</span>
                </div>
              </div>
            </div>

            {/* PDF upload */}
            {!analyseResult && !analyseScores && (
              <div>
                  <div className="space-y-3">
                    {!analysePdfReady ? (
                      <label className="block border-2 border-dashed border-[#E0E0E0] rounded-2xl p-8 text-center cursor-pointer hover:border-[#FFC107] hover:bg-amber-50 transition">
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setAnalyseExtracting(true)
                            setAnalyseFilename(file.name)
                            try {
                              const { data: { session } } = await supabase.auth.getSession()
                              const fd = new FormData()
                              fd.append('file', file)
                              const res = await fetch('/api/client/extract-pdf', {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${session?.access_token}` },
                                body: fd,
                              })
                              const data = await res.json()
                              if (data.success) {
                                setAnalyseInput(data.text)
                                setAnalysePdfReady(true)
                                if (data.isVitfix) setAnalyseIsVitfix(true)
                              } else {
                                alert(data.error || t('clientDash.analyse.pdfExtractionError'))
                              }
                            } catch { alert(t('clientDash.analyse.networkError')) }
                            finally { setAnalyseExtracting(false) }
                          }}
                        />
                        {analyseExtracting ? (
                          <div>
                            <div className="text-3xl mb-2 animate-pulse">{'\u23F3'}</div>
                            <div className="font-semibold text-mid">{t('clientDash.analyse.extracting')}</div>
                            <div className="text-sm text-text-muted">{t('clientDash.analyse.readingPdf')}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-3xl mb-2">{'\uD83D\uDCC4'}</div>
                            <div className="font-semibold text-mid">{t('clientDash.analyse.clickToImport')}</div>
                            <div className="text-sm text-text-muted mt-1">{t('clientDash.analyse.pdfMaxSize')}</div>
                          </div>
                        )}
                      </label>
                    ) : (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-semibold text-sm">{t('clientDash.analyse.pdfExtracted')} : {analyseFilename}</span>
                        </div>
                        <div className="text-xs text-green-600 mt-1">{analyseInput.length} {t('clientDash.analyse.charactersExtracted')}</div>
                        {analyseIsVitfix && <div className="text-xs font-semibold text-amber-700 mt-1">{'✅ Devis Vitfix Pro détecté'}</div>}
                        <button onClick={() => { setAnalysePdfReady(false); setAnalyseInput(''); setAnalyseFilename(''); setAnalyseIsVitfix(false) }} className="text-xs text-green-600 underline mt-1">{t('clientDash.analyse.changeFile')}</button>
                      </div>
                    )}
                  </div>

                {/* Analyze button */}
                <button
                  disabled={analyseLoading || analyseInput.trim().length < 20}
                  onClick={async () => {
                    setAnalyseLoading(true)
                    setAnalyseResult('')
                    setAnalyseScores(null)
                    setAnalyseExtracted(null)
                    setAnalyseSiret(null)
                    setAnalyseAccordion(null)
                    try {
                      const { data: { session } } = await supabase.auth.getSession()
                      const res = await fetch('/api/client/analyse-devis', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${session?.access_token}`,
                        },
                        body: JSON.stringify({ content: analyseInput, filename: analyseFilename }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        setAnalyseResult(data.analysis)
                        setAnalyseScores(data.scores || null)
                        setAnalyseExtracted(data.extracted || null)
                        setAnalyseSiret(data.siret || null)
                        setAnalyseIsVitfix(data.isVitfix || false)
                        // Save to history
                        const verdict = data.scores?.action_recommandee || data.analysis.match(/Verdict.*?:\s*(.+)/)?.[1]?.trim() || ''
                        const hist = [...analyseHistory, {
                          date: new Date().toISOString(),
                          filename: analyseFilename || t('clientDash.analyse.noName'),
                          verdict,
                          score_conformite: data.scores?.conformite?.total,
                          score_confiance: data.scores?.confiance,
                          action: data.scores?.action_recommandee,
                        }].slice(-20)
                        setAnalyseHistory(hist)
                      } else {
                        alert(data.error || t('clientDash.analyse.analysisError'))
                      }
                    } catch { alert(t('clientDash.analyse.networkError')) }
                    finally { setAnalyseLoading(false) }
                  }}
                  className="w-full bg-[#FFC107] hover:bg-[#FFB300] disabled:opacity-40 text-dark font-bold py-4 rounded-xl text-sm transition flex items-center justify-center gap-2 mt-4"
                >
                  {analyseLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
                      {t('clientDash.analyse.analyzing')}
                    </>
                  ) : (
                    <>
                      <FileSearch className="w-4 h-4" />
                      {t('clientDash.analyse.analyzeButton')}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* ── Score Cards + Results ── */}
            {(analyseResult || analyseScores) && (
              <div className="space-y-4">
                {/* Score summary card */}
                {analyseScores && (
                  <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-dark text-base">Analyse du devis</h3>
                      <div className="flex items-center gap-2">
                        {analyseIsVitfix && <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{'Artisan Vitfix ✅'}</span>}
                        {analyseSiret?.verified && <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{'SIRET vérifié ✅'}</span>}
                        {analyseSiret && !analyseSiret.verified && analyseExtracted?.artisan_siret && <span className="text-xs font-semibold bg-red-100 text-red-800 px-2 py-0.5 rounded-full">{'SIRET non vérifié ❌'}</span>}
                      </div>
                    </div>

                    {/* Artisan info */}
                    {analyseExtracted?.artisan_nom && (
                      <div className="text-sm text-mid">
                        <span className="font-semibold">Artisan : </span>{analyseExtracted.artisan_nom}
                        {analyseExtracted.artisan_siret && <span className="text-text-muted ml-2">SIRET {analyseExtracted.artisan_siret}</span>}
                      </div>
                    )}

                    {/* 3 score bars */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Conformité /100 */}
                      <div className="bg-warm-gray rounded-xl p-3">
                        <div className="text-xs text-text-muted font-medium mb-1">Conformité légale</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${analyseScores.conformite.total / analyseScores.conformite.max >= 0.9 ? 'bg-green-500' : analyseScores.conformite.total / analyseScores.conformite.max >= 0.7 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${(analyseScores.conformite.total / analyseScores.conformite.max) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-dark">{analyseScores.conformite.total}/{analyseScores.conformite.max}</span>
                        </div>
                      </div>

                      {/* Prix */}
                      <div className="bg-warm-gray rounded-xl p-3">
                        <div className="text-xs text-text-muted font-medium mb-1">Niveau de prix</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${Math.abs(analyseScores.prix!.ecart_moyen_pct) <= 15 ? 'bg-green-500' : Math.abs(analyseScores.prix!.ecart_moyen_pct) <= 30 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.max(10, 100 - Math.abs(analyseScores.prix!.ecart_moyen_pct))}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold ${analyseScores.prix!.ecart_moyen_pct > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {analyseScores.prix!.ecart_moyen_pct > 0 ? '+' : ''}{analyseScores.prix!.ecart_moyen_pct}%
                          </span>
                        </div>
                      </div>

                      {/* Confiance */}
                      <div className="bg-warm-gray rounded-xl p-3">
                        <div className="text-xs text-text-muted font-medium mb-1">Confiance globale</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${analyseScores.confiance >= 80 ? 'bg-green-500' : analyseScores.confiance >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${analyseScores.confiance}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-dark">{analyseScores.confiance}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Points d'attention count */}
                    {analyseScores.conformite.details.filter((c: AnalyseConformiteDetail) => c.status === 'missing').length > 0 && (
                      <div className="text-xs text-amber-700 font-medium">
                        {'⚠️'} {analyseScores.conformite.details.filter((c: AnalyseConformiteDetail) => c.status === 'missing').length} points d{"'"}attention détectés
                      </div>
                    )}
                  </div>
                )}

                {/* 3 Action buttons */}
                {analyseScores && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {analyseScores.action_recommandee === 'valider' && (
                      <button className="py-3 px-4 rounded-xl text-sm font-bold bg-green-500 text-white hover:bg-green-600 transition flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Valider ce devis
                      </button>
                    )}
                    {(analyseScores.action_recommandee === 'negocier' || analyseScores.action_recommandee === 'valider') && (
                      <button
                        onClick={() => setAnalyseAccordion(analyseAccordion === 'negocier' ? null : 'negocier')}
                        className="py-3 px-4 rounded-xl text-sm font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 transition flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" /> Négocier ce devis
                      </button>
                    )}
                    <button
                      onClick={() => setAnalyseAccordion(analyseAccordion === 'vitfix' ? null : 'vitfix')}
                      className={`py-3 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${analyseScores.action_recommandee === 'devis_vitfix' ? 'bg-[#FFC107] text-dark hover:bg-[#FFB300]' : 'bg-warm-gray text-mid hover:bg-gray-200'}`}
                    >
                      <FileText className="w-4 h-4" /> Obtenir un devis Vitfix
                    </button>
                  </div>
                )}

                {/* Negotiation messages panel */}
                {analyseAccordion === 'negocier' && analyseScores && Array.isArray(analyseScores.messages_negociation) && analyseScores.messages_negociation.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                    <h4 className="font-bold text-sm text-amber-800">Messages de négociation suggérés</h4>
                    {analyseScores.messages_negociation.map((msg: string, i: number) => (
                      <div key={i} className="flex items-start gap-2">
                        <button
                          onClick={() => navigator.clipboard?.writeText(msg)}
                          className="flex-shrink-0 mt-0.5 text-amber-600 hover:text-amber-800"
                          title="Copier"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <p className="text-xs text-amber-800">{msg}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Vitfix quote panel */}
                {analyseAccordion === 'vitfix' && (
                  <div className="bg-amber-50 border border-[#FFC107] rounded-xl p-4">
                    <h4 className="font-bold text-sm text-dark mb-1">Recevoir jusqu{"'"}à 3 devis Vitfix</h4>
                    <p className="text-xs text-mid">Des artisans vérifiés Vitfix de ta zone te recontactent sous 48h avec des devis pour les mêmes prestations.</p>
                    <button className="mt-3 bg-[#FFC107] hover:bg-[#FFB300] text-dark font-bold py-2 px-4 rounded-lg text-xs transition">
                      Demander des devis Vitfix
                    </button>
                  </div>
                )}

                {/* Accordion: Conformité details */}
                {analyseScores && (
                  <div className="border border-[#E0E0E0] rounded-xl overflow-hidden">
                    <button onClick={() => setAnalyseAccordion(analyseAccordion === 'conformite' ? null : 'conformite')} className="w-full flex items-center justify-between px-4 py-3 bg-warm-gray hover:bg-gray-100 transition">
                      <span className="font-semibold text-sm text-dark">Conformité légale ({analyseScores.conformite.total}/{analyseScores.conformite.max})</span>
                      <ChevronRight className={`w-4 h-4 text-mid transition-transform ${analyseAccordion === 'conformite' ? 'rotate-90' : ''}`} />
                    </button>
                    {analyseAccordion === 'conformite' && (
                      <div className="px-4 py-3 space-y-1.5 bg-white">
                        {analyseScores.conformite.details.map((c: AnalyseConformiteDetail) => (
                          <div key={c.id} className="flex items-center gap-2 text-xs">
                            <span>{c.status === 'ok' ? '✅' : c.status === 'partial' ? '⚠️' : c.status === 'na' ? '➖' : '❌'}</span>
                            <span className={c.status === 'ok' ? 'text-green-700' : c.status === 'missing' ? 'text-red-600' : 'text-mid'}>{c.label}</span>
                            <span className="text-text-muted ml-auto">{c.poids} pts</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Accordion: Prix details */}
                {analyseScores?.prix && analyseScores.prix.details.length > 0 && (
                  <div className="border border-[#E0E0E0] rounded-xl overflow-hidden">
                    <button onClick={() => setAnalyseAccordion(analyseAccordion === 'prix' ? null : 'prix')} className="w-full flex items-center justify-between px-4 py-3 bg-warm-gray hover:bg-gray-100 transition">
                      <span className="font-semibold text-sm text-dark">Analyse des prix ({analyseScores.prix.ecart_moyen_pct > 0 ? '+' : ''}{analyseScores.prix.ecart_moyen_pct}% vs marché)</span>
                      <ChevronRight className={`w-4 h-4 text-mid transition-transform ${analyseAccordion === 'prix' ? 'rotate-90' : ''}`} />
                    </button>
                    {analyseAccordion === 'prix' && (
                      <div className="px-4 py-3 bg-white overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-[#E0E0E0]">
                              <th className="text-left py-1.5 font-semibold text-mid">Prestation</th>
                              <th className="text-right py-1.5 font-semibold text-mid">Prix</th>
                              <th className="text-right py-1.5 font-semibold text-mid">Marché</th>
                              <th className="text-center py-1.5 font-semibold text-mid">Verdict</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyseScores.prix!.details.map((p: AnalysePrixDetail, i: number) => (
                              <tr key={i} className="border-b border-[#E0E0E0]/50">
                                <td className="py-1.5 text-dark">{p.designation.substring(0, 40)}</td>
                                <td className="py-1.5 text-right font-medium">{p.prix}€</td>
                                <td className="py-1.5 text-right text-text-muted">{p.status === 'inconnu' ? '?' : `${p.fourchette_min}-${p.fourchette_max}€`}</td>
                                <td className="py-1.5 text-center">
                                  {p.status === 'ok' && <span className="text-green-600">{'✅'}</span>}
                                  {p.status === 'bas' && <span className="text-blue-600">{'⚠️ Bas'}</span>}
                                  {p.status === 'eleve' && <span className="text-amber-600">{'🔴 Élevé'}</span>}
                                  {p.status === 'excessif' && <span className="text-red-600">{'🔴🔴 Excessif'}</span>}
                                  {p.status === 'inconnu' && <span className="text-text-muted">{'—'}</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Accordion: SIRET verification */}
                {analyseSiret && (
                  <div className="border border-[#E0E0E0] rounded-xl overflow-hidden">
                    <button onClick={() => setAnalyseAccordion(analyseAccordion === 'siret' ? null : 'siret')} className="w-full flex items-center justify-between px-4 py-3 bg-warm-gray hover:bg-gray-100 transition">
                      <span className="font-semibold text-sm text-dark">Vérification entreprise {analyseSiret.verified ? '✅' : '❌'}</span>
                      <ChevronRight className={`w-4 h-4 text-mid transition-transform ${analyseAccordion === 'siret' ? 'rotate-90' : ''}`} />
                    </button>
                    {analyseAccordion === 'siret' && (
                      <div className="px-4 py-3 bg-white text-xs space-y-1.5">
                        {analyseSiret.verified && analyseSiret.company ? (
                          <>
                            <div><span className="font-semibold text-mid">Entreprise :</span> <span className="text-dark">{analyseSiret.company.name}</span></div>
                            <div><span className="font-semibold text-mid">SIRET :</span> <span className="text-dark">{analyseSiret.company.siret}</span></div>
                            <div><span className="font-semibold text-mid">Activité :</span> <span className="text-dark">{analyseSiret.company.nafLabel} ({analyseSiret.company.nafCode})</span></div>
                            <div><span className="font-semibold text-mid">Forme juridique :</span> <span className="text-dark">{analyseSiret.company.legalForm}</span></div>
                            <div><span className="font-semibold text-mid">Adresse :</span> <span className="text-dark">{analyseSiret.company.address}</span></div>
                            <div><span className="font-semibold text-mid">Statut :</span> <span className="text-green-600 font-semibold">Active ✅</span></div>
                            {analyseSiret.company.isArtisanActivity && <div className="text-green-600 font-semibold">{'✅ Activité artisanale confirmée'}</div>}
                            {!analyseSiret.company.isArtisanActivity && <div className="text-amber-600 font-semibold">{'⚠️ Code NAF non artisanal'}</div>}
                          </>
                        ) : (
                          <div className="text-red-600 font-semibold">
                            {analyseExtracted?.artisan_siret ? `SIRET ${analyseExtracted.artisan_siret} non trouvé ou invalide` : 'Aucun SIRET détecté dans le devis'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons row */}
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard?.writeText(analyseResult)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-warm-gray text-mid hover:bg-warm-gray/80 transition flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {t('clientDash.analyse.copy')}
                  </button>
                  <button
                    onClick={() => {
                      setAnalyseResult(''); setAnalyseInput(''); setAnalyseFilename(''); setAnalysePdfReady(false)
                      setAnalyseScores(null); setAnalyseExtracted(null); setAnalyseSiret(null); setAnalyseIsVitfix(false); setAnalyseAccordion(null)
                    }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#FFC107] text-dark hover:bg-[#FFB300] transition"
                  >
                    {t('clientDash.analyse.analyzeAnother')}
                  </button>
                </div>

                {/* Full narrative analysis */}
                {analyseResult && (
                  <div
                    className="bg-white border border-[#E0E0E0] rounded-2xl p-6 prose prose-sm max-w-none
                      [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-dark
                      [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2
                      [&_table]:w-full [&_table]:text-sm [&_table]:border-collapse [&_table]:mt-3 [&_table]:mb-3
                      [&_th]:bg-warm-gray [&_th]:border [&_th]:border-[#E0E0E0] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-mid
                      [&_td]:border [&_td]:border-[#E0E0E0] [&_td]:px-3 [&_td]:py-2
                      [&_hr]:my-4 [&_hr]:border-[#E0E0E0]
                      [&_strong]:font-bold
                      [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:space-y-1
                      [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:space-y-1
                      [&_p]:mb-2 [&_p]:leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(analyseResult) }}
                  />
                )}
              </div>
            )}

            {/* History */}
            {analyseHistory.length > 0 && !analyseResult && !analyseScores && (
              <div>
                <h3 className="text-sm font-bold text-text-muted mb-3">{t('clientDash.analyse.recentAnalyses')}</h3>
                <div className="space-y-2">
                  {analyseHistory.slice().reverse().map((h, i) => (
                    <div key={i} className="bg-white border border-[#E0E0E0] rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-dark">{h.filename}</div>
                        <div className="text-xs text-text-muted">{new Date(h.date).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {h.score_confiance !== undefined && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${h.score_confiance >= 80 ? 'bg-green-100 text-green-700' : h.score_confiance >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {h.score_confiance}%
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${h.action === 'valider' ? 'bg-green-100 text-green-700' : h.action === 'negocier' ? 'bg-amber-100 text-amber-700' : h.action === 'devis_vitfix' ? 'bg-red-100 text-red-700' : 'bg-warm-gray text-text-muted'}`}>
                          {h.action === 'valider' ? '✅ Conforme' : h.action === 'negocier' ? '⚠️ À négocier' : h.action === 'devis_vitfix' ? '🔴 Demander Vitfix' : h.verdict?.substring(0, 30) || t('clientDash.analyse.analyzed')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trust banner */}
            {!analyseResult && !analyseScores && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-amber-800 text-sm">{t('clientDash.analyse.confidential')}</div>
                    <div className="text-xs text-amber-600 mt-0.5">{t('clientDash.analyse.confidentialDesc')}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
  )
}
