'use client'

import React, { useState } from 'react'
import {
  BorneInstallee,
  TypeBorne,
  TypeInfra,
  EtatBorne,
  TYPE_BORNE_CONFIG,
  ETAT_BORNE_CONFIG,
  fmtDate,
  fmtDateShort,
  cardStyle,
  btnPrimary,
  btnSecondary,
  inputStyle,
  labelStyle,
  overlayStyle,
  modalStyle,
} from './types'

interface BornesTabProps {
  bornes: BorneInstallee[]
  stats: {
    bornesIndividuelles: number
    bornesCollectives: number
  }
  onCreerBorne: (data: {
    immeuble: string
    emplacement: string
    type: TypeBorne
    puissance: string
    proprietaire: string
    typeInfra: TypeInfra
    date: string
    compteur: boolean
    pilotage: boolean
  }) => void
  onMajEtatBorne: (id: string, nouvelEtat: EtatBorne) => void
  onSupprimerBorne: (id: string) => void
}

export default function BornesTab({
  bornes,
  stats,
  onCreerBorne,
  onMajEtatBorne,
  onSupprimerBorne,
}: BornesTabProps) {
  const [showNouvelleBorne, setShowNouvelleBorne] = useState(false)
  const [selectedBorne, setSelectedBorne] = useState<BorneInstallee | null>(null)

  // Form fields
  const [fbImmeuble, setFbImmeuble] = useState('')
  const [fbEmplacement, setFbEmplacement] = useState('')
  const [fbType, setFbType] = useState<TypeBorne>('wallbox')
  const [fbPuissance, setFbPuissance] = useState('')
  const [fbProprietaire, setFbProprietaire] = useState('')
  const [fbTypeInfra, setFbTypeInfra] = useState<TypeInfra>('individuelle')
  const [fbDate, setFbDate] = useState('')
  const [fbCompteur, setFbCompteur] = useState(true)
  const [fbPilotage, setFbPilotage] = useState(true)

  const resetForm = () => {
    setFbImmeuble(''); setFbEmplacement(''); setFbType('wallbox'); setFbPuissance('')
    setFbProprietaire(''); setFbTypeInfra('individuelle'); setFbDate(''); setFbCompteur(true); setFbPilotage(true)
  }

  const handleCreer = () => {
    if (!fbImmeuble.trim() || !fbEmplacement.trim()) return
    onCreerBorne({
      immeuble: fbImmeuble.trim(),
      emplacement: fbEmplacement.trim(),
      type: fbType,
      puissance: fbPuissance,
      proprietaire: fbProprietaire.trim(),
      typeInfra: fbTypeInfra,
      date: fbDate,
      compteur: fbCompteur,
      pilotage: fbPilotage,
    })
    resetForm()
    setShowNouvelleBorne(false)
  }

  return (
    <div>
      {/* Resume infra */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ ...cardStyle, flex: 1, minWidth: 180, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>Infrastructure individuelle</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'var(--sd-navy, #0D1B2E)' }}>{stats.bornesIndividuelles}</div>
          <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>borne{stats.bornesIndividuelles > 1 ? 's' : ''} privee{stats.bornesIndividuelles > 1 ? 's' : ''}</div>
        </div>
        <div style={{ ...cardStyle, flex: 1, minWidth: 180, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>Infrastructure collective</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'var(--sd-gold, #C9A84C)' }}>{stats.bornesCollectives}</div>
          <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>borne{stats.bornesCollectives > 1 ? 's' : ''} partagee{stats.bornesCollectives > 1 ? 's' : ''}</div>
        </div>
        <div style={{ ...cardStyle, flex: 1, minWidth: 180, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>Puissance installee</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: '#6C5CE7' }}>{bornes.reduce((s, b) => s + b.puissanceKw, 0).toFixed(1)} kW</div>
          <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>max 22 kW / borne</div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setShowNouvelleBorne(true)} style={btnPrimary}>
          + Ajouter une borne
        </button>
      </div>

      {/* Bornes list */}
      {bornes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔌</div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>Aucune borne installee</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Enregistrez les bornes de recharge installees dans vos coproprietes</p>
          <button onClick={() => setShowNouvelleBorne(true)} style={{ ...btnPrimary, marginTop: 16 }}>
            + Ajouter une borne
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {bornes.map(b => {
            const typeCfg = TYPE_BORNE_CONFIG[b.type]
            const etatCfg = ETAT_BORNE_CONFIG[b.etat]

            return (
              <div
                key={b.id}
                style={{ ...cardStyle, cursor: 'pointer', transition: 'border-color 0.2s' }}
                onClick={() => setSelectedBorne(b)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{typeCfg.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>{typeCfg.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{b.puissanceKw} kW</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, background: etatCfg.bg, color: etatCfg.color, padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>
                    {etatCfg.label}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginBottom: 4 }}>
                  {b.immeubleNom}
                </div>
                <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 8 }}>
                  {b.emplacementParking}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, background: b.typeInfra === 'collective' ? '#EDE8FF' : 'var(--sd-cream, #F7F4EE)', color: b.typeInfra === 'collective' ? '#6C5CE7' : 'var(--sd-ink-2, #4A5E78)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                    {b.typeInfra === 'collective' ? 'Collective' : 'Individuelle'}
                  </span>
                  {b.compteurIndividuel && (
                    <span style={{ fontSize: 10, background: '#E6F4F2', color: '#1A7A6E', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                      Compteur individuel
                    </span>
                  )}
                  {b.pilotageEnergetique && (
                    <span style={{ fontSize: 10, background: '#E8F0FE', color: '#1967D2', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                      Pilotage energetique
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 8 }}>
                  Proprietaire : {b.proprietaire} · Installee le {fmtDateShort(b.dateInstallation)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nouvelle borne */}
      {showNouvelleBorne && (
        <div style={overlayStyle} onClick={() => setShowNouvelleBorne(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 20px' }}>
              Ajouter une borne installee
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Immeuble *</label>
                <input style={inputStyle} value={fbImmeuble} onChange={e => setFbImmeuble(e.target.value)} placeholder="Residence Les Jardins" />
              </div>
              <div>
                <label style={labelStyle}>Emplacement parking *</label>
                <input style={inputStyle} value={fbEmplacement} onChange={e => setFbEmplacement(e.target.value)} placeholder="Parking -1, place n°15" />
              </div>
              <div>
                <label style={labelStyle}>Type de borne</label>
                <select style={inputStyle} value={fbType} onChange={e => setFbType(e.target.value as TypeBorne)}>
                  {Object.entries(TYPE_BORNE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Puissance (kW, max 22)</label>
                <input style={inputStyle} type="number" step="0.1" max="22" value={fbPuissance} onChange={e => setFbPuissance(e.target.value)} placeholder="7.4" />
              </div>
              <div>
                <label style={labelStyle}>Proprietaire</label>
                <input style={inputStyle} value={fbProprietaire} onChange={e => setFbProprietaire(e.target.value)} placeholder="Nom du coproprietaire ou Copropriete" />
              </div>
              <div>
                <label style={labelStyle}>Type d&apos;infrastructure</label>
                <select style={inputStyle} value={fbTypeInfra} onChange={e => setFbTypeInfra(e.target.value as TypeInfra)}>
                  <option value="individuelle">Individuelle</option>
                  <option value="collective">Collective</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Date d&apos;installation</label>
                <input style={inputStyle} type="date" value={fbDate} onChange={e => setFbDate(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={fbCompteur} onChange={e => setFbCompteur(e.target.checked)} />
                  Compteur individuel
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={fbPilotage} onChange={e => setFbPilotage(e.target.checked)} />
                  Pilotage energetique
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowNouvelleBorne(false)} style={btnSecondary}>Annuler</button>
              <button onClick={handleCreer} style={btnPrimary}>Ajouter la borne</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detail borne */}
      {selectedBorne && (
        <div style={overlayStyle} onClick={() => setSelectedBorne(null)}>
          <div style={{ ...modalStyle, maxWidth: 550 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 28 }}>{TYPE_BORNE_CONFIG[selectedBorne.type].icon}</span>
              <div>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
                  {TYPE_BORNE_CONFIG[selectedBorne.type].label} — {selectedBorne.puissanceKw} kW
                </h3>
                <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>{selectedBorne.immeubleNom}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Emplacement', value: selectedBorne.emplacementParking },
                { label: 'Proprietaire', value: selectedBorne.proprietaire },
                { label: 'Infrastructure', value: selectedBorne.typeInfra === 'collective' ? 'Collective' : 'Individuelle' },
                { label: 'Installation', value: fmtDate(selectedBorne.dateInstallation) },
                { label: 'Compteur individuel', value: selectedBorne.compteurIndividuel ? 'Oui' : 'Non' },
                { label: 'Pilotage energetique', value: selectedBorne.pilotageEnergetique ? 'Actif' : 'Inactif' },
              ].map((info, i) => (
                <div key={i} style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{info.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginTop: 2 }}>{info.value}</div>
                </div>
              ))}
            </div>

            {selectedBorne.observations && (
              <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>
                <strong>Observations :</strong> {selectedBorne.observations}
              </div>
            )}

            {/* Changement d'etat */}
            <div style={{ borderTop: '1px solid var(--sd-border, #E4DDD0)', paddingTop: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 8 }}>Changer l&apos;etat</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(Object.entries(ETAT_BORNE_CONFIG) as [EtatBorne, typeof ETAT_BORNE_CONFIG[EtatBorne]][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => { onMajEtatBorne(selectedBorne.id, key); setSelectedBorne({ ...selectedBorne, etat: key }) }}
                    style={{
                      ...btnSecondary,
                      fontSize: 11,
                      padding: '4px 10px',
                      background: selectedBorne.etat === key ? cfg.bg : 'transparent',
                      color: cfg.color,
                      borderColor: cfg.color,
                      fontWeight: selectedBorne.etat === key ? 700 : 500,
                    }}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => { onSupprimerBorne(selectedBorne.id); setSelectedBorne(null) }} style={{ ...btnSecondary, color: '#C0392B', borderColor: '#C0392B', fontSize: 11 }}>
                Supprimer
              </button>
              <button onClick={() => setSelectedBorne(null)} style={btnSecondary}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
