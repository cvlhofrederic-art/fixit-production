'use client'

import React, { useState } from 'react'
import { useLocale } from '@/lib/i18n/context'
import {
  DemandeIRVE,
  EtatDemande,
  TypeDemande,
  ETAT_DEMANDE_CONFIG,
  TYPE_DEMANDE_LABELS,
  MOTIFS_OPPOSITION,
  TIMELINE_STEPS,
  fmtDate,
  fmtDateShort,
  joursRestants,
  getTimelineStep,
  cardStyle,
  btnPrimary,
  btnSecondary,
  inputStyle,
  labelStyle,
  overlayStyle,
  modalStyle,
} from './types'

interface DemandesTabProps {
  demandes: DemandeIRVE[]
  stats: { urgentes: number }
  onCreerDemande: (data: {
    nom: string
    email: string
    lot: string
    date: string
    type: TypeDemande
    puissance: string
    emplacement: string
    observations: string
  }) => void
  onMajEtatDemande: (id: string, nouvelEtat: EtatDemande, extra?: Partial<DemandeIRVE>) => void
  onSupprimerDemande: (id: string) => void
}

export default function DemandesTab({
  demandes,
  stats,
  onCreerDemande,
  onMajEtatDemande,
  onSupprimerDemande,
}: DemandesTabProps) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const [showNouvelleDemande, setShowNouvelleDemande] = useState(false)
  const [selectedDemande, setSelectedDemande] = useState<DemandeIRVE | null>(null)

  // Form fields
  const [fdNom, setFdNom] = useState('')
  const [fdEmail, setFdEmail] = useState('')
  const [fdLot, setFdLot] = useState('')
  const [fdDate, setFdDate] = useState('')
  const [fdType, setFdType] = useState<TypeDemande>('individuel')
  const [fdPuissance, setFdPuissance] = useState('')
  const [fdEmplacement, setFdEmplacement] = useState('')
  const [fdObs, setFdObs] = useState('')

  // Refus form
  const [refusMotif, setRefusMotif] = useState<string>('')
  const [refusJustification, setRefusJustification] = useState('')

  const resetForm = () => {
    setFdNom(''); setFdEmail(''); setFdLot(''); setFdDate('')
    setFdType('individuel'); setFdPuissance(''); setFdEmplacement(''); setFdObs('')
  }

  const handleCreer = () => {
    if (!fdNom.trim() || !fdLot.trim()) return
    onCreerDemande({
      nom: fdNom.trim(),
      email: fdEmail.trim(),
      lot: fdLot.trim(),
      date: fdDate,
      type: fdType,
      puissance: fdPuissance,
      emplacement: fdEmplacement.trim(),
      observations: fdObs.trim(),
    })
    resetForm()
    setShowNouvelleDemande(false)
  }

  return (
    <div>
      {/* Alerte echeances */}
      {stats.urgentes > 0 && (
        <div style={{ background: '#FEF5E4', border: '1px solid #F0B429', borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#D4830A' }}>
              {stats.urgentes} {isPt ? `pedido${stats.urgentes > 1 ? 's' : ''} com prazo em menos de 15 dias` : `demande${stats.urgentes > 1 ? 's' : ''} avec echeance dans moins de 15 jours`}
            </div>
            <div style={{ fontSize: 12, color: '#8B6914', marginTop: 2 }}>
              {isPt ? 'O prazo legal de resposta é de 60 dias (DL 101-D/2020). A ausência de resposta vale como aceitação tácita.' : 'Le delai legal de reponse est de 3 mois. L\'absence de reponse vaut acceptation tacite.'}
            </div>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setShowNouvelleDemande(true)} style={btnPrimary}>
          + {isPt ? 'Novo pedido' : 'Nouvelle demande'}
        </button>
      </div>

      {/* Demandes list */}
      {demandes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>{isPt ? 'Nenhum pedido de instalação de posto' : 'Aucune demande de droit a la prise'}</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>{isPt ? 'Os condóminos podem pedir a instalação de um posto de carregamento (DL 101-D/2020)' : 'Les coproprietaires peuvent demander l\'installation d\'une borne de recharge (ordonnance 2020-71)'}</p>
          <button onClick={() => setShowNouvelleDemande(true)} style={{ ...btnPrimary, marginTop: 16 }}>
            + {isPt ? 'Registar um pedido' : 'Enregistrer une demande'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {demandes.map(d => {
            const cfg = ETAT_DEMANDE_CONFIG[d.etat]
            const jours = joursRestants(d.dateEcheance)
            const step = getTimelineStep(d)

            return (
              <div
                key={d.id}
                style={{ ...cardStyle, cursor: 'pointer', transition: 'border-color 0.2s' }}
                onClick={() => setSelectedDemande(d)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>{d.coproprietaire}</span>
                      <span style={{ fontSize: 11, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: 11, background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-ink-2, #4A5E78)', padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>
                        {TYPE_DEMANDE_LABELS[d.type]}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 6 }}>
                      {d.lot} · {d.emplacement} · {d.puissanceSouhaitee} kW
                    </div>

                    {/* Mini timeline */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10 }}>
                      {TIMELINE_STEPS.map((ts, i) => (
                        <React.Fragment key={ts.key}>
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: i <= step ? (d.etat === 'refusee' && i === 2 ? '#C0392B' : '#1A7A6E') : '#E4DDD0',
                          }} />
                          {i < TIMELINE_STEPS.length - 1 && (
                            <div style={{ flex: 1, height: 2, background: i < step ? '#1A7A6E' : '#E4DDD0', maxWidth: 40 }} />
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', flexWrap: 'wrap' }}>
                      <span>{isPt ? 'Pedido' : 'Demande'} : <strong>{fmtDateShort(d.dateDemande)}</strong></span>
                      {(d.etat === 'recue' || d.etat === 'en_cours') && (
                        <span>{isPt ? 'Prazo' : 'Echeance'} : <strong style={{ color: jours <= 7 ? '#C0392B' : jours <= 15 ? '#D4830A' : '#1A7A6E' }}>
                          {jours > 0 ? (isPt ? `${jours} dia${jours > 1 ? 's' : ''} restante${jours > 1 ? 's' : ''}` : `${jours} jour${jours > 1 ? 's' : ''} restant${jours > 1 ? 's' : ''}`) : (isPt ? 'Ultrapassado!' : 'Depassee !')}
                        </strong></span>
                      )}
                      {d.dateDecision && <span>{isPt ? 'Decisão' : 'Decision'} : <strong>{fmtDateShort(d.dateDecision)}</strong></span>}
                    </div>
                  </div>

                  {/* Right: quick actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(d.etat === 'recue' || d.etat === 'en_cours') && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); onMajEtatDemande(d.id, 'en_cours') }}
                          style={{ ...btnSecondary, fontSize: 11, padding: '4px 10px' }}
                        >
                          {isPt ? 'Instruir' : 'Instruire'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onMajEtatDemande(d.id, 'acceptee') }}
                          style={{ ...btnSecondary, fontSize: 11, padding: '4px 10px', color: '#1A7A6E', borderColor: '#1A7A6E' }}
                        >
                          {isPt ? 'Aceitar' : 'Accepter'}
                        </button>
                      </>
                    )}
                    {d.etat === 'acceptee' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onMajEtatDemande(d.id, 'installation') }}
                        style={{ ...btnSecondary, fontSize: 11, padding: '4px 10px', color: '#1967D2', borderColor: '#1967D2' }}
                      >
                        {isPt ? 'Instalação' : 'Installation'}
                      </button>
                    )}
                    {d.etat === 'installation' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onMajEtatDemande(d.id, 'terminee') }}
                        style={{ ...btnSecondary, fontSize: 11, padding: '4px 10px', color: '#1A7A6E', borderColor: '#1A7A6E' }}
                      >
                        {isPt ? 'Concluído' : 'Terminee'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nouvelle demande */}
      {showNouvelleDemande && (
        <div style={overlayStyle} onClick={() => setShowNouvelleDemande(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 20px' }}>
              {isPt ? 'Novo pedido de instalação de posto' : 'Nouvelle demande de droit a la prise'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>{isPt ? 'Condómino *' : 'Coproprietaire *'}</label>
                <input style={inputStyle} value={fdNom} onChange={e => setFdNom(e.target.value)} placeholder={isPt ? 'Nome completo' : 'Nom complet'} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" value={fdEmail} onChange={e => setFdEmail(e.target.value)} placeholder={isPt ? 'email@exemplo.pt' : 'email@exemple.fr'} />
              </div>
              <div>
                <label style={labelStyle}>{isPt ? 'Fração *' : 'Lot *'}</label>
                <input style={inputStyle} value={fdLot} onChange={e => setFdLot(e.target.value)} placeholder={isPt ? 'Fração 12 — 3º andar' : 'Lot 12 — 3eme etage'} />
              </div>
              <div>
                <label style={labelStyle}>{isPt ? 'Data do pedido' : 'Date de la demande'}</label>
                <input style={inputStyle} type="date" value={fdDate} onChange={e => setFdDate(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>{isPt ? 'Tipo' : 'Type'}</label>
                <select style={inputStyle} value={fdType} onChange={e => setFdType(e.target.value as TypeDemande)}>
                  <option value="individuel">{isPt ? 'Individual' : 'Individuel'}</option>
                  <option value="collectif">{isPt ? 'Coletivo' : 'Collectif'}</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>{isPt ? 'Potência desejada (kW)' : 'Puissance souhaitee (kW)'}</label>
                <input style={inputStyle} type="number" step="0.1" max="22" value={fdPuissance} onChange={e => setFdPuissance(e.target.value)} placeholder="7.4" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>{isPt ? 'Localização do parqueamento' : 'Emplacement parking'}</label>
                <input style={inputStyle} value={fdEmplacement} onChange={e => setFdEmplacement(e.target.value)} placeholder={isPt ? 'Garagem subterrânea -1, lugar nº23' : 'Parking souterrain -1, place n°23'} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>{isPt ? 'Observações' : 'Observations'}</label>
                <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={fdObs} onChange={e => setFdObs(e.target.value)} placeholder={isPt ? 'Notas, orçamentos, veículo...' : 'Notes, devis, vehicule...'} />
              </div>
            </div>

            <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: 12, marginTop: 16, fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
              <strong>{isPt ? 'Lembrete' : 'Rappel'} :</strong> {isPt ? 'O prazo de resposta é de 60 dias (DL 101-D/2020). O prazo será calculado automaticamente.' : 'Le delai de reponse est de 3 mois (ordonnance 2020-71). L\'echeance sera calculee automatiquement.'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowNouvelleDemande(false)} style={btnSecondary}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button onClick={handleCreer} style={btnPrimary}>{isPt ? 'Registar o pedido' : 'Enregistrer la demande'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detail demande */}
      {selectedDemande && (
        <div style={overlayStyle} onClick={() => setSelectedDemande(null)}>
          <div style={{ ...modalStyle, maxWidth: 650 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 6px' }}>
              {isPt ? 'Pedido' : 'Demande'} — {selectedDemande.coproprietaire}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 12, background: ETAT_DEMANDE_CONFIG[selectedDemande.etat].bg, color: ETAT_DEMANDE_CONFIG[selectedDemande.etat].color, padding: '2px 10px', borderRadius: 5, fontWeight: 600 }}>
                {ETAT_DEMANDE_CONFIG[selectedDemande.etat].label}
              </span>
              <span style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                {TYPE_DEMANDE_LABELS[selectedDemande.type]}
              </span>
            </div>

            {/* Timeline */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12 }}>{isPt ? 'Progresso' : 'Progression'}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {TIMELINE_STEPS.map((ts, i) => {
                  const step = getTimelineStep(selectedDemande)
                  const active = i <= step
                  const isRefused = selectedDemande.etat === 'refusee' && i === 2
                  return (
                    <div key={ts.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: '50%', border: '2px solid',
                          borderColor: active ? (isRefused ? '#C0392B' : '#1A7A6E') : '#E4DDD0',
                          background: active ? (isRefused ? '#C0392B' : '#1A7A6E') : '#fff',
                        }} />
                        {i < TIMELINE_STEPS.length - 1 && (
                          <div style={{ width: 2, height: 30, background: i < step ? '#1A7A6E' : '#E4DDD0' }} />
                        )}
                      </div>
                      <div style={{ paddingBottom: 12 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: active ? 'var(--sd-navy, #0D1B2E)' : 'var(--sd-ink-3, #8A9BB0)' }}>{ts.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{ts.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Infos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {(isPt ? [
                { label: 'Fração', value: selectedDemande.lot },
                { label: 'Localização', value: selectedDemande.emplacement },
                { label: 'Potência', value: `${selectedDemande.puissanceSouhaitee} kW` },
                { label: 'Data do pedido', value: fmtDate(selectedDemande.dateDemande) },
                { label: 'Prazo 60 dias', value: fmtDate(selectedDemande.dateEcheance) },
                { label: 'Dias restantes', value: (() => { const j = joursRestants(selectedDemande.dateEcheance); return j > 0 ? `${j} dias` : 'Prazo ultrapassado' })() },
              ] : [
                { label: 'Lot', value: selectedDemande.lot },
                { label: 'Emplacement', value: selectedDemande.emplacement },
                { label: 'Puissance', value: `${selectedDemande.puissanceSouhaitee} kW` },
                { label: 'Date demande', value: fmtDate(selectedDemande.dateDemande) },
                { label: 'Echeance 3 mois', value: fmtDate(selectedDemande.dateEcheance) },
                { label: 'Jours restants', value: (() => { const j = joursRestants(selectedDemande.dateEcheance); return j > 0 ? `${j} jours` : 'Echeance depassee' })() },
              ]).map((info, i) => (
                <div key={i} style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{info.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginTop: 2 }}>{info.value}</div>
                </div>
              ))}
            </div>

            {selectedDemande.observations && (
              <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>
                <strong>{isPt ? 'Observações' : 'Observations'} :</strong> {selectedDemande.observations}
              </div>
            )}

            {selectedDemande.motifRefus && (
              <div style={{ background: '#FDECEA', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#C0392B' }}>
                <strong>{isPt ? 'Motivo da recusa' : 'Motif de refus'} :</strong> {MOTIFS_OPPOSITION[selectedDemande.motifRefus]}
                {selectedDemande.justificationRefus && (
                  <div style={{ marginTop: 6, fontSize: 12 }}>{selectedDemande.justificationRefus}</div>
                )}
              </div>
            )}

            {/* Actions */}
            {(selectedDemande.etat === 'recue' || selectedDemande.etat === 'en_cours') && (
              <div style={{ borderTop: '1px solid var(--sd-border, #E4DDD0)', paddingTop: 16, marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12 }}>{isPt ? 'Ações' : 'Actions'}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <button onClick={() => { onMajEtatDemande(selectedDemande.id, 'acceptee'); setSelectedDemande(null) }} style={{ ...btnPrimary, background: '#1A7A6E' }}>
                    {isPt ? 'Aceitar o pedido' : 'Accepter la demande'}
                  </button>
                  <button onClick={() => { onMajEtatDemande(selectedDemande.id, 'en_cours'); setSelectedDemande(null) }} style={btnSecondary}>
                    {isPt ? 'Instruir o dossiê' : 'Instruire le dossier'}
                  </button>
                </div>

                {/* Refus */}
                <div style={{ background: '#FDECEA', borderRadius: 10, padding: 14, marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#C0392B', marginBottom: 8 }}>{isPt ? 'Recusar (motivo obrigatório)' : 'Refuser (motif obligatoire)'}</div>
                  <select
                    style={{ ...inputStyle, background: '#fff', marginBottom: 8 }}
                    value={refusMotif}
                    onChange={e => setRefusMotif(e.target.value)}
                  >
                    <option value="">{isPt ? 'Selecionar um motivo de oposição...' : 'Selectionner un motif d\'opposition...'}</option>
                    {Object.entries(MOTIFS_OPPOSITION).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <textarea
                    style={{ ...inputStyle, background: '#fff', minHeight: 60, resize: 'vertical' }}
                    value={refusJustification}
                    onChange={e => setRefusJustification(e.target.value)}
                    placeholder={isPt ? 'Justificação detalhada da recusa...' : 'Justification detaillee du refus...'}
                  />
                  <button
                    onClick={() => {
                      if (!refusMotif) return
                      onMajEtatDemande(selectedDemande.id, 'refusee', {
                        motifRefus: refusMotif as DemandeIRVE['motifRefus'],
                        justificationRefus: refusJustification.trim() || undefined,
                      })
                      setRefusMotif('')
                      setRefusJustification('')
                      setSelectedDemande(null)
                    }}
                    disabled={!refusMotif}
                    style={{ ...btnSecondary, marginTop: 8, color: '#C0392B', borderColor: '#C0392B', opacity: refusMotif ? 1 : 0.5 }}
                  >
                    {isPt ? 'Recusar o pedido' : 'Refuser la demande'}
                  </button>
                </div>
              </div>
            )}

            {/* Delete */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button onClick={() => { onSupprimerDemande(selectedDemande.id); setSelectedDemande(null) }} style={{ ...btnSecondary, color: '#C0392B', borderColor: '#C0392B', fontSize: 11 }}>
                {isPt ? 'Eliminar' : 'Supprimer'}
              </button>
              <button onClick={() => setSelectedDemande(null)} style={btnSecondary}>{isPt ? 'Fechar' : 'Fermer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
