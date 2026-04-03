'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  DemandeIRVE,
  BorneInstallee,
  EtatDemande,
  EtatBorne,
  TypeDemande,
  DEMO_DEMANDES,
  DEMO_BORNES,
  REGLEMENTATION_CARDS,
  FAQ_DATA,
  addMonths,
  joursRestants,
  cardStyle,
} from './irve/types'
import DemandesTab from './irve/DemandesTab'
import BornesTab from './irve/BornesTab'
import AidesTab from './irve/AidesTab'
import type { User } from '@supabase/supabase-js'

export default function IRVESection({ user, userRole }: { user: User; userRole: string }) {
  type TabKey = 'demandes' | 'bornes' | 'reglementation' | 'aides'
  const [activeTab, setActiveTab] = useState<TabKey>('demandes')

  // ── Data
  const [demandes, setDemandes] = useState<DemandeIRVE[]>([])
  const [bornes, setBornes] = useState<BorneInstallee[]>([])

  // ── FAQ
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null)

  // ── Storage
  const STORAGE_KEY = `fixit_irve_fr_${user.id}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.demandes) setDemandes(data.demandes)
        if (data.bornes) setBornes(data.bornes)
      } else {
        setDemandes(DEMO_DEMANDES)
        setBornes(DEMO_BORNES)
      }
    } catch {
      setDemandes(DEMO_DEMANDES)
      setBornes(DEMO_BORNES)
    }
  }, [])

  useEffect(() => {
    if (demandes.length || bornes.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ demandes, bornes }))
    }
  }, [demandes, bornes])

  // ── Stats
  const stats = useMemo(() => {
    const totalDemandes = demandes.length
    const enAttente = demandes.filter(d => d.etat === 'recue' || d.etat === 'en_cours').length
    const acceptees = demandes.filter(d => d.etat === 'acceptee' || d.etat === 'installation' || d.etat === 'terminee').length
    const refusees = demandes.filter(d => d.etat === 'refusee').length
    const bornesActives = bornes.filter(b => b.etat === 'active').length
    const puissanceTotale = bornes.filter(b => b.etat === 'active').reduce((s, b) => s + b.puissanceKw, 0)
    const bornesCollectives = bornes.filter(b => b.typeInfra === 'collective').length
    const bornesIndividuelles = bornes.filter(b => b.typeInfra === 'individuelle').length

    const urgentes = demandes.filter(d => {
      if (d.etat !== 'recue' && d.etat !== 'en_cours') return false
      return joursRestants(d.dateEcheance) <= 15
    }).length

    return { totalDemandes, enAttente, acceptees, refusees, bornesActives, puissanceTotale, bornesCollectives, bornesIndividuelles, urgentes }
  }, [demandes, bornes])

  // ── CRUD Demandes
  const creerDemande = (data: {
    nom: string; email: string; lot: string; date: string;
    type: TypeDemande; puissance: string; emplacement: string; observations: string
  }) => {
    const dateD = data.date || new Date().toISOString().split('T')[0]
    const nouvelle: DemandeIRVE = {
      id: crypto.randomUUID(),
      coproprietaire: data.nom,
      email: data.email || undefined,
      lot: data.lot,
      dateDemande: dateD,
      dateEcheance: addMonths(dateD, 3),
      type: data.type,
      puissanceSouhaitee: parseFloat(data.puissance) || 7.4,
      emplacement: data.emplacement,
      etat: 'recue',
      observations: data.observations || undefined,
      createdAt: new Date().toISOString(),
    }
    setDemandes(prev => [nouvelle, ...prev])
  }

  const majEtatDemande = (id: string, nouvelEtat: EtatDemande, extra?: Partial<DemandeIRVE>) => {
    setDemandes(prev => prev.map(d =>
      d.id === id
        ? {
            ...d,
            etat: nouvelEtat,
            dateDecision: (nouvelEtat === 'acceptee' || nouvelEtat === 'refusee') ? new Date().toISOString().split('T')[0] : d.dateDecision,
            ...extra,
          }
        : d
    ))
  }

  const supprimerDemande = (id: string) => {
    setDemandes(prev => prev.filter(d => d.id !== id))
  }

  // ── CRUD Bornes
  const creerBorne = (data: {
    immeuble: string; emplacement: string; type: import('./irve/types').TypeBorne;
    puissance: string; proprietaire: string; typeInfra: import('./irve/types').TypeInfra;
    date: string; compteur: boolean; pilotage: boolean
  }) => {
    const nouvelle: BorneInstallee = {
      id: crypto.randomUUID(),
      immeubleNom: data.immeuble,
      emplacementParking: data.emplacement,
      type: data.type,
      puissanceKw: Math.min(parseFloat(data.puissance) || 7.4, 22),
      proprietaire: data.proprietaire || 'Copropriete',
      typeInfra: data.typeInfra,
      dateInstallation: data.date || new Date().toISOString().split('T')[0],
      compteurIndividuel: data.compteur,
      etat: 'active',
      pilotageEnergetique: data.pilotage,
    }
    setBornes(prev => [nouvelle, ...prev])
  }

  const majEtatBorne = (id: string, nouvelEtat: EtatBorne) => {
    setBornes(prev => prev.map(b => b.id === id ? { ...b, etat: nouvelEtat } : b))
  }

  const supprimerBorne = (id: string) => {
    setBornes(prev => prev.filter(b => b.id !== id))
  }

  // ─── Tabs ─────────────────────────────────────────────────────────────────

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'demandes',       label: 'Demandes droit a la prise', icon: '📋' },
    { key: 'bornes',         label: 'Bornes installees',         icon: '🔌' },
    { key: 'reglementation', label: 'Reglementation',            icon: '⚖️' },
    { key: 'aides',          label: 'Aides financieres',         icon: '💰' },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
            ⚡ IRVE — Recharge Vehicules Electriques
          </h2>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
            Infrastructure de recharge en copropriete · Ordonnance 2020-71 · Decret 2020-1720
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { icon: '📋', label: 'Demandes en attente', value: stats.enAttente, color: '#D4830A' },
          { icon: '✅', label: 'Acceptees', value: stats.acceptees, color: '#1A7A6E' },
          { icon: '❌', label: 'Refusees', value: stats.refusees, color: '#C0392B' },
          { icon: '🔌', label: 'Bornes actives', value: stats.bornesActives, color: 'var(--sd-navy, #0D1B2E)' },
          { icon: '⚡', label: 'Puissance totale', value: `${stats.puissanceTotale.toFixed(1)} kW`, color: '#6C5CE7' },
          { icon: '🚨', label: 'Echeances proches', value: stats.urgentes, color: stats.urgentes > 0 ? '#C0392B' : '#1A7A6E' },
        ].map((s, i) => (
          <div key={i} style={{ ...cardStyle, padding: 14 }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '2px solid var(--sd-border, #E4DDD0)', paddingBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: activeTab === tab.key ? 'var(--sd-navy, #0D1B2E)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--sd-ink-2, #4A5E78)',
              border: activeTab === tab.key ? 'none' : '1px solid var(--sd-border, #E4DDD0)',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1 — DEMANDES */}
      {activeTab === 'demandes' && (
        <DemandesTab
          demandes={demandes}
          stats={{ urgentes: stats.urgentes }}
          onCreerDemande={creerDemande}
          onMajEtatDemande={majEtatDemande}
          onSupprimerDemande={supprimerDemande}
        />
      )}

      {/* TAB 2 — BORNES */}
      {activeTab === 'bornes' && (
        <BornesTab
          bornes={bornes}
          stats={{ bornesIndividuelles: stats.bornesIndividuelles, bornesCollectives: stats.bornesCollectives }}
          onCreerBorne={creerBorne}
          onMajEtatBorne={majEtatBorne}
          onSupprimerBorne={supprimerBorne}
        />
      )}

      {/* TAB 3 — REGLEMENTATION */}
      {activeTab === 'reglementation' && (
        <div>
          {/* Cartes reglementaires */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14, marginBottom: 30 }}>
            {REGLEMENTATION_CARDS.map((card, i) => (
              <div key={i} style={{ ...cardStyle, borderLeft: '4px solid var(--sd-gold, #C9A84C)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 24 }}>{card.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>{card.titre}</div>
                    <div style={{ fontSize: 11, color: 'var(--sd-gold, #C9A84C)', fontWeight: 600 }}>{card.ref}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', fontStyle: 'italic', marginBottom: 6 }}>{card.date}</div>
                <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5 }}>
                  {card.description}
                </div>
              </div>
            ))}
          </div>

          {/* FAQ Accordion */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>
              Questions frequentes
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FAQ_DATA.map((faq, i) => (
                <div key={i} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === i ? null : i)}
                    style={{
                      width: '100%',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--sd-navy, #0D1B2E)' }}>{faq.question}</span>
                    <span style={{ fontSize: 18, color: 'var(--sd-ink-3, #8A9BB0)', transform: expandedFAQ === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      ▼
                    </span>
                  </button>
                  {expandedFAQ === i && (
                    <div style={{ padding: '0 18px 14px', fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.6 }}>
                      {faq.reponse}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4 — AIDES */}
      {activeTab === 'aides' && <AidesTab />}
    </div>
  )
}
