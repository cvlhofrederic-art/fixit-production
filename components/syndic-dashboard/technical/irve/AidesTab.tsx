'use client'

import React, { useState, useMemo } from 'react'
import {
  fmtEur,
  cardStyle,
  inputStyle,
  labelStyle,
} from './types'

export default function AidesTab() {
  // Simulator state
  const [simNbBornes, setSimNbBornes] = useState('')
  const [simCoutEstime, setSimCoutEstime] = useState('')
  const [simNbPlaces, setSimNbPlaces] = useState('')

  // Checklist state
  const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>({
    copropriete: false,
    parking: false,
    devis_installateur: false,
    installateur_irve: false,
    ag_vote: false,
    compteur_individuel: false,
    pilotage_energetique: false,
  })

  // Simulator results
  const simulerAide = useMemo(() => {
    const nb = parseInt(simNbBornes) || 0
    const cout = parseFloat(simCoutEstime) || 0
    const places = parseInt(simNbPlaces) || 0
    if (!nb || !cout) return null

    const coutHT = cout / 1.055 // TVA 5.5% inversee
    const primeAdvenir = Math.min(coutHT * 0.50, places <= 100 ? 8000 : 15000)
    const tvaEconomisee = cout - (cout / 1.20 * 1.055) // Difference TVA 20% vs 5.5%
    const creditImpot = Math.min(cout * 0.75, nb * 500) // max 500 EUR par borne, fin 2025
    const totalAides = primeAdvenir + tvaEconomisee + creditImpot
    const resteACharge = Math.max(0, cout - totalAides)

    return { primeAdvenir, tvaEconomisee, creditImpot, totalAides, resteACharge, coutHT }
  }, [simNbBornes, simCoutEstime, simNbPlaces])

  return (
    <div>
      {/* Cartes aides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, marginBottom: 30 }}>
        {/* Prime ADVENIR */}
        <div style={{ ...cardStyle, borderTop: '4px solid #1A7A6E' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 24 }}>🏷️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>Prime ADVENIR</div>
              <div style={{ fontSize: 11, color: '#1A7A6E', fontWeight: 600 }}>Programme national · Prolonge jusqu&apos;en 2027</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5, marginBottom: 10 }}>
            Prise en charge de 50% HT des couts d&apos;infrastructure collective de recharge en copropriete.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
              <strong>Plafond :</strong> 8 000 EUR pour les coproprietes de 100 places ou moins
            </div>
            <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
              <strong>Plafond :</strong> 15 000 EUR pour les coproprietes de plus de 100 places
            </div>
            <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
              <strong>Condition :</strong> Installateur qualifie IRVE obligatoire
            </div>
          </div>
        </div>

        {/* Credit d'impot CIBRE */}
        <div style={{ ...cardStyle, borderTop: '4px solid #6C5CE7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 24 }}>💳</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>Credit d&apos;impot CIBRE</div>
              <div style={{ fontSize: 11, color: '#6C5CE7', fontWeight: 600 }}>Particuliers · Jusqu&apos;au 31/12/2025</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5, marginBottom: 10 }}>
            Credit d&apos;impot couvrant 75% des couts d&apos;acquisition et d&apos;installation d&apos;une borne de recharge.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
              <strong>Montant max :</strong> 500 EUR par borne (par personne, par residence)
            </div>
            <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
              <strong>Condition :</strong> Residence principale ou secondaire, installation par professionnel
            </div>
          </div>
        </div>

        {/* TVA reduite */}
        <div style={{ ...cardStyle, borderTop: '4px solid #D4830A' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 24 }}>📉</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>TVA reduite 5,5%</div>
              <div style={{ fontSize: 11, color: '#D4830A', fontWeight: 600 }}>Applicable sans limite de date</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5, marginBottom: 10 }}>
            TVA au taux reduit de 5,5% applicable au materiel et a la main d&apos;oeuvre pour l&apos;installation de bornes de recharge dans les logements de plus de 2 ans.
          </div>
          <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
            <strong>Economie :</strong> 14,5 points de TVA par rapport au taux normal (20%)
          </div>
        </div>

        {/* Aides locales */}
        <div style={{ ...cardStyle, borderTop: '4px solid var(--sd-gold, #C9A84C)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 24 }}>🏛️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>Aides locales</div>
              <div style={{ fontSize: 11, color: 'var(--sd-gold, #C9A84C)', fontWeight: 600 }}>Collectivites, metropoles, regions</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5, marginBottom: 10 }}>
            De nombreuses collectivites territoriales proposent des aides complementaires : subventions directes, accompagnement technique, ou aides au pre-equipement.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
              <strong>Exemples :</strong> Metropoles, departements, regions
            </div>
            <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
              <strong>Conseil :</strong> Consulter votre ADIL ou l&apos;espace info-energie local
            </div>
          </div>
        </div>
      </div>

      {/* Checklist eligibilite */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 16px' }}>
          Checklist d&apos;eligibilite aux aides
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {[
            { key: 'copropriete', label: 'La copropriete est constituee (syndicat de coproprietaires)' },
            { key: 'parking', label: 'Parking couvert ou exterieur disponible' },
            { key: 'devis_installateur', label: 'Devis d\'un installateur qualifie IRVE obtenu' },
            { key: 'installateur_irve', label: 'L\'installateur est certifie IRVE (mention QUALIFELEC / AFNOR)' },
            { key: 'ag_vote', label: 'Vote en AG effectue (si infrastructure collective)' },
            { key: 'compteur_individuel', label: 'Compteur individuel ou sous-comptage prevu' },
            { key: 'pilotage_energetique', label: 'Systeme de pilotage energetique integre' },
          ].map(item => (
            <label
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                background: checklistItems[item.key] ? '#E6F4F2' : 'var(--sd-cream, #F7F4EE)',
                cursor: 'pointer',
                fontSize: 13,
                color: checklistItems[item.key] ? '#1A7A6E' : 'var(--sd-ink-2, #4A5E78)',
                transition: 'background 0.2s',
              }}
            >
              <input
                type="checkbox"
                checked={checklistItems[item.key] || false}
                onChange={e => setChecklistItems(prev => ({ ...prev, [item.key]: e.target.checked }))}
                style={{ marginTop: 2 }}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        {Object.values(checklistItems).every(Boolean) && (
          <div style={{ background: '#E6F4F2', borderRadius: 8, padding: 12, marginTop: 14, fontSize: 13, color: '#1A7A6E', fontWeight: 600 }}>
            Tous les criteres sont remplis ! Votre copropriete est eligible aux principales aides IRVE.
          </div>
        )}
      </div>

      {/* Simulateur d'aide */}
      <div style={{ ...cardStyle, borderTop: '4px solid var(--sd-gold, #C9A84C)' }}>
        <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 4px' }}>
          Simulateur d&apos;aides IRVE
        </h3>
        <p style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 16 }}>
          Estimation indicative des aides disponibles pour votre projet de recharge en copropriete
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Nombre de bornes</label>
            <input
              style={inputStyle}
              type="number"
              min="1"
              value={simNbBornes}
              onChange={e => setSimNbBornes(e.target.value)}
              placeholder="6"
            />
          </div>
          <div>
            <label style={labelStyle}>Cout total estime TTC (EUR)</label>
            <input
              style={inputStyle}
              type="number"
              min="0"
              value={simCoutEstime}
              onChange={e => setSimCoutEstime(e.target.value)}
              placeholder="15000"
            />
          </div>
          <div>
            <label style={labelStyle}>Nombre de places parking</label>
            <input
              style={inputStyle}
              type="number"
              min="1"
              value={simNbPlaces}
              onChange={e => setSimNbPlaces(e.target.value)}
              placeholder="50"
            />
          </div>
        </div>

        {simulerAide && (
          <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 14 }}>
              Estimation des aides
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#fff', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#1A7A6E', fontWeight: 600 }}>Prime ADVENIR (50% HT)</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: '#1A7A6E', marginTop: 4 }}>
                  {fmtEur(simulerAide.primeAdvenir)}
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6C5CE7', fontWeight: 600 }}>Credit d&apos;impot CIBRE</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: '#6C5CE7', marginTop: 4 }}>
                  {fmtEur(simulerAide.creditImpot)}
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#D4830A', fontWeight: 600 }}>Economie TVA (5,5% vs 20%)</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: '#D4830A', marginTop: 4 }}>
                  {fmtEur(simulerAide.tvaEconomisee)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160, background: '#E6F4F2', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#1A7A6E', fontWeight: 700 }}>Total des aides estimees</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: '#1A7A6E', marginTop: 4 }}>
                  {fmtEur(simulerAide.totalAides)}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 160, background: '#fff', border: '2px solid var(--sd-navy, #0D1B2E)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--sd-navy, #0D1B2E)', fontWeight: 700 }}>Reste a charge estime</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: 'var(--sd-navy, #0D1B2E)', marginTop: 4 }}>
                  {fmtEur(simulerAide.resteACharge)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', fontStyle: 'italic' }}>
              * Estimation indicative basee sur les baremes en vigueur. Le montant reel depend de l&apos;eligibilite effective et des conditions specifiques de chaque dispositif. Le credit d&apos;impot CIBRE prend fin au 31/12/2025.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
