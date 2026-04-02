'use client'

import React, { useState } from 'react'
import { formatDate } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ResolutionVote {
  id: string
  titre: string
  description: string
  majorite: 'art24' | 'art25' | 'art26' | 'unanimite'
  monVote?: 'pour' | 'contre' | 'abstention'
  votePour: number
  voteContre: number
  voteAbstention: number
  statut: 'ouverte' | 'cloturee'
  resultat?: 'adoptée' | 'rejetée'
}

interface AssembleeGenerale {
  id: string
  titre: string
  date: string
  lieu: string
  type: 'ordinaire' | 'extraordinaire'
  statut: 'planifiee' | 'convoquee' | 'en_cours' | 'cloturee'
  ordreDuJour: string[]
  resolutions: ResolutionVote[]
  lienVisio?: string
}

interface CoproProfile {
  id: string
  nom: string
  prenom: string
  email: string
  telephone: string
  immeuble: string
  batiment: string
  etage: string
  numLot: string
  tantiemes: number
  quotePart: number
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  t: Record<string, string>
  locale: string
  ags: AssembleeGenerale[]
  profile: CoproProfile
  majoriteLabels: Record<string, { label: string; color: string }>
  handleVote: (agId: string, resId: string, vote: 'pour' | 'contre' | 'abstention') => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CoproAssembleesSection({ t, locale, ags, profile, majoriteLabels, handleVote }: Props) {
  const [selectedAG, setSelectedAG] = useState<string | null>(null)
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  return (
    <div className="space-y-6">
      {/* Liste AG */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ags.map(ag => (
          <div
            key={ag.id}
            onClick={() => setSelectedAG(selectedAG === ag.id ? null : ag.id)}
            className={`bg-white rounded-xl border shadow-sm p-5 cursor-pointer transition ${
              selectedAG === ag.id ? 'border-[#C9A84C] ring-2 ring-[#C9A84C]' : 'border-[#E4DDD0] hover:border-[#C9A84C]'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <span className={`text-xs font-bold px-2 py-1 rounded ${
                ag.type === 'ordinaire' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {ag.type === 'ordinaire' ? t.agOrdinaire : t.agExtraordinaire}
              </span>
              <span className={`text-xs font-medium px-2 py-1 rounded ${
                ag.statut === 'cloturee' ? 'bg-[#F7F4EE] text-[#4A5E78]' :
                ag.statut === 'en_cours' ? 'bg-green-100 text-green-700' :
                ag.statut === 'convoquee' ? 'bg-[rgba(201,168,76,0.15)] text-[#A8842A]' :
                'bg-amber-100 text-amber-700'
              }`}>
                {ag.statut === 'cloturee' ? t.cloturee : ag.statut === 'en_cours' ? t.enCours : ag.statut === 'convoquee' ? t.convoquee : t.planifiee}
              </span>
            </div>
            <h3 className="text-base font-bold text-[#0D1B2E] mb-1">{ag.titre}</h3>
            <p className="text-sm text-[#4A5E78] mb-1">📅 {new Date(ag.date).toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-sm text-[#8A9BB0]">📍 {ag.lieu}</p>
            <p className="text-xs text-[#C9A84C] font-medium mt-2">{ag.resolutions.length} {t.resolutions}</p>
          </div>
        ))}
      </div>

      {/* Detail AG */}
      {selectedAG && (() => {
        const ag = ags.find(a => a.id === selectedAG)
        if (!ag) return null
        return (
          <div className="space-y-6">
            {/* Infos pratiques */}
            <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm p-5">
              <h2 className="font-bold text-[#0D1B2E] text-lg mb-4">{t.infosPratiques}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#8A9BB0] font-medium">{t.date}</p>
                  <p className="text-sm text-[#0D1B2E]">{new Date(ag.date).toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8A9BB0] font-medium">{t.lieu}</p>
                  <p className="text-sm text-[#0D1B2E]">{ag.lieu}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8A9BB0] font-medium">{t.type}</p>
                  <p className="text-sm text-[#0D1B2E] capitalize">{ag.type}</p>
                </div>
                {ag.lienVisio && (
                  <div>
                    <p className="text-xs text-[#8A9BB0] font-medium">{t.visioconference}</p>
                    <p className="text-sm text-[#C9A84C] font-medium">{t.lienDispo}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Ordre du jour */}
            <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm p-5">
              <h2 className="font-bold text-[#0D1B2E] text-lg mb-4">{t.ordreDuJour}</h2>
              <ol className="space-y-2">
                {ag.ordreDuJour.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-[rgba(201,168,76,0.15)] text-[#A8842A] rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <span className="text-sm text-[#4A5E78]">{item}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Resolutions & Votes */}
            <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm">
              <div className="px-5 py-4 border-b border-[#E4DDD0]">
                <h2 className="font-bold text-[#0D1B2E] text-lg">{t.resolutionsTitle}</h2>
                {ag.statut !== 'cloturee' && (
                  <p className="text-xs text-[#C9A84C] mt-1">Vos tantièmes : {profile.tantiemes} / 10 000 — Votez en cliquant sur votre choix</p>
                )}
              </div>
              <div className="divide-y divide-[#E4DDD0]">
                {ag.resolutions.map(res => {
                  const totalVotes = res.votePour + res.voteContre + res.voteAbstention
                  const pctPour = totalVotes > 0 ? Math.round((res.votePour / totalVotes) * 100) : 0
                  const pctContre = totalVotes > 0 ? Math.round((res.voteContre / totalVotes) * 100) : 0
                  const pctAbst = totalVotes > 0 ? Math.round((res.voteAbstention / totalVotes) * 100) : 0
                  return (
                    <div key={res.id} className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-bold text-[#0D1B2E]">{res.titre}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${majoriteLabels[res.majorite]?.color || 'bg-[#F7F4EE] text-[#4A5E78]'}`}>
                            {majoriteLabels[res.majorite]?.label}
                          </span>
                          {res.resultat && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${res.resultat === 'adoptée' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {res.resultat === 'adoptée' ? t.adoptee : t.rejetee}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-[#4A5E78] mb-3">{res.description}</p>

                      {/* Mon vote */}
                      {res.monVote && (
                        <div className="mb-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded ${
                            res.monVote === 'pour' ? 'bg-green-100 text-green-700' :
                            res.monVote === 'contre' ? 'bg-red-100 text-red-700' :
                            'bg-[#F7F4EE] text-[#4A5E78]'
                          }`}>
                            {t.monVote} {res.monVote === 'pour' ? t.votePour : res.monVote === 'contre' ? t.voteContre : t.voteAbstention}
                          </span>
                        </div>
                      )}

                      {/* Barres de resultat */}
                      {(res.statut === 'cloturee' || res.monVote) && totalVotes > 0 && (
                        <div className="space-y-1.5 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#8A9BB0] w-16">{t.pour}</span>
                            <div className="flex-1 bg-[#F7F4EE] rounded-full h-3 overflow-hidden">
                              <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${pctPour}%` }} />
                            </div>
                            <span className="text-xs font-medium text-[#4A5E78] w-10 text-right">{pctPour}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#8A9BB0] w-16">{t.contre}</span>
                            <div className="flex-1 bg-[#F7F4EE] rounded-full h-3 overflow-hidden">
                              <div className="bg-red-500 h-full rounded-full transition-all" style={{ width: `${pctContre}%` }} />
                            </div>
                            <span className="text-xs font-medium text-[#4A5E78] w-10 text-right">{pctContre}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#8A9BB0] w-16">{t.abstention}</span>
                            <div className="flex-1 bg-[#F7F4EE] rounded-full h-3 overflow-hidden">
                              <div className="bg-gray-400 h-full rounded-full transition-all" style={{ width: `${pctAbst}%` }} />
                            </div>
                            <span className="text-xs font-medium text-[#4A5E78] w-10 text-right">{pctAbst}%</span>
                          </div>
                          <p className="text-xs text-[#8A9BB0]">Total : {totalVotes.toLocaleString(dateFmtLocale)} tantièmes exprimés</p>
                        </div>
                      )}

                      {/* Boutons vote */}
                      {res.statut === 'ouverte' && !res.monVote && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleVote(ag.id, res.id, 'pour')}
                            className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 font-medium text-sm py-2.5 rounded-lg border border-green-200 transition"
                          >
                            {t.votePour}
                          </button>
                          <button
                            onClick={() => handleVote(ag.id, res.id, 'contre')}
                            className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-medium text-sm py-2.5 rounded-lg border border-red-200 transition"
                          >
                            {t.voteContre}
                          </button>
                          <button
                            onClick={() => handleVote(ag.id, res.id, 'abstention')}
                            className="flex-1 bg-[#F7F4EE] hover:bg-[#F7F4EE] text-[#4A5E78] font-medium text-sm py-2.5 rounded-lg border border-[#E4DDD0] transition"
                          >
                            {t.voteAbstention}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Contestation AG (delai 2 mois art. 42) */}
            {ag.statut === 'cloturee' && (() => {
              const agDate = new Date(ag.date)
              const deadline = new Date(agDate)
              deadline.setMonth(deadline.getMonth() + 2)
              const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / 86400000)
              const canContest = daysLeft > 0
              return (
                <div className={`rounded-xl border p-5 shadow-sm ${canContest ? 'bg-amber-50 border-amber-200' : 'bg-[#F7F4EE] border-[#E4DDD0]'}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">{canContest ? '⚖️' : '🔒'}</span>
                    <div>
                      <h3 className="font-bold text-[#0D1B2E]">Contestation de l&apos;AG</h3>
                      {canContest ? (
                        <p className="text-sm text-amber-700 mt-1">
                          ⏰ <strong>{daysLeft} jour(s) restant(s)</strong> pour contester (délai légal : 2 mois après l&apos;AG, art. 42 loi du 10/07/1965)
                        </p>
                      ) : (
                        <p className="text-sm text-[#8A9BB0] mt-1">Le délai de contestation de 2 mois est écoulé.</p>
                      )}
                    </div>
                  </div>
                  {canContest && (
                    <>
                      <div className="bg-white rounded-lg p-4 border border-amber-100 mb-3">
                        <p className="text-xs text-[#4A5E78] leading-relaxed">
                          <strong>Rappel juridique :</strong> Tout copropriétaire opposant ou défaillant peut contester une décision d&apos;AG
                          dans un délai de 2 mois à compter de la notification du PV (article 42 de la loi du 10 juillet 1965).
                          La contestation doit être faite par LRAR au syndic, puis si nécessaire devant le Tribunal judiciaire.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const template = locale === 'pt'
                            ? `[O seu nome e morada]\n\n[Nome e morada do administrador]\n\nAssunto: Impugnação de deliberação(ões) da Assembleia de ${new Date(ag.date).toLocaleDateString(dateFmtLocale)}\n\nCarta registada com aviso de receção\n\nExmo(a) Sr(a) Administrador(a),\n\nEu, [O seu nome], condómino do condomínio [nome/morada do edifício], fração n.º ${profile.numLot || '___'}, titular de ${profile.tantiemes} permilagens,\n\nPela presente, venho impugnar a(s) seguinte(s) deliberação(ões) tomada(s) na assembleia geral ${ag.type === 'ordinaire' ? 'ordinária' : 'extraordinária'} de ${new Date(ag.date).toLocaleDateString(dateFmtLocale)}:\n\n- [Especificar a(s) deliberação(ões) impugnada(s)]\n\nFundamento(s) da impugnação:\n- [Vício de forma / irregularidade na convocação / abuso de maioria / outro]\n\nNos termos do artigo 1433.º do Código Civil, solicito que tomem conhecimento da presente impugnação no prazo de 15 dias.\n\nNa falta de resposta satisfatória, reservo-me o direito de recorrer ao Tribunal competente.\n\nCom os melhores cumprimentos,\n\nFeito em [Cidade], a ${new Date().toLocaleDateString(dateFmtLocale)}\n\n[Assinatura]`
                            : `[Votre nom et adresse]\n\n[Nom et adresse du syndic]\n\nObjet : Contestation de résolution(s) adoptée(s) lors de l'AG du ${new Date(ag.date).toLocaleDateString(dateFmtLocale)}\n\nLettre recommandée avec accusé de réception\n\nMadame, Monsieur le Syndic,\n\nJe soussigné(e) [Votre nom], copropriétaire au sein de la copropriété [nom/adresse immeuble], lot n°${profile.numLot || '___'}, titulaire de ${profile.tantiemes} tantièmes,\n\nPar la présente, je conteste la/les résolution(s) suivante(s) adoptée(s) lors de l'assemblée générale ${ag.type} du ${new Date(ag.date).toLocaleDateString(dateFmtLocale)} :\n\n- [Préciser la/les résolution(s) contestée(s)]\n\nMotif(s) de la contestation :\n- [Vice de forme / irrégularité de convocation / abus de majorité / autre]\n\nConformément à l'article 42 de la loi du 10 juillet 1965, je vous mets en demeure de prendre acte de cette contestation dans un délai de 15 jours.\n\nÀ défaut de réponse satisfaisante, je me réserve le droit de saisir le Tribunal judiciaire compétent.\n\nVeuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.\n\nFait à [Ville], le ${new Date().toLocaleDateString(dateFmtLocale)}\n\n[Signature]`
                          navigator.clipboard.writeText(template).then(() => {
                            alert(locale === 'pt' ? 'Modelo de impugnação copiado!' : 'Template de mise en demeure copié dans le presse-papier !')
                          }).catch(() => {
                            const el = document.createElement('textarea')
                            el.value = template; document.body.appendChild(el); el.select()
                            document.execCommand('copy'); document.body.removeChild(el)
                            alert(locale === 'pt' ? 'Modelo copiado!' : 'Template copié !')
                          })
                        }}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold text-sm transition"
                      >
                        📋 Copier le template de mise en demeure
                      </button>
                      <p className="text-[10px] text-[#8A9BB0] text-center mt-2">
                        Deadline : {deadline.toLocaleDateString(dateFmtLocale)} · Envoi par LRAR recommandé
                      </p>
                    </>
                  )}
                </div>
              )
            })()}
          </div>
        )
      })()}
    </div>
  )
}
