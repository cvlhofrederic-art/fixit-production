'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useLocale } from '@/lib/i18n/context'
import {
  TYPES_ACTIVITE_FR,
  TYPES_ACTIVITE_PT,
  URL_DECLARATION_FR,
  URL_DECLARATION_PT,
} from '@/lib/declaration-sociale'
import type { PeriodeDeclaration, ResultatCotisations } from '@/lib/declaration-sociale'
import { useThemeVars } from './useThemeVars'

interface HistoriqueEntry {
  id: string
  periode_label: string
  ca_periode: number
  cotisations_estimees: number
  statut: 'declare' | 'ignore' | string
}

interface DeclarationData {
  configure: boolean
  pays: 'FR' | 'PT'
  type_activite: string
  periodicite: 'mensuelle' | 'trimestrielle'
  acre_actif: boolean
  periode: PeriodeDeclaration
  ca: { montant: number; nb_factures: number }
  source_ca: 'factures' | 'bookings'
  cotisations: ResultatCotisations
  historique: HistoriqueEntry[]
}

function formatEur(v: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}

export default function DeclarationSocialeSection() {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const isV5 = false
  const tv = useThemeVars(isV5)

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DeclarationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [marking, setMarking] = useState(false)
  const [marked, setMarked] = useState(false)

  // Onboarding form state
  const [formPays, setFormPays] = useState<'FR' | 'PT'>('FR')
  const [formTypeActivite, setFormTypeActivite] = useState('bic_services')
  const [formPeriodicite, setFormPeriodicite] = useState<'mensuelle' | 'trimestrielle'>('trimestrielle')
  const [formAcre, setFormAcre] = useState(false)
  const [formAcreDateFin, setFormAcreDateFin] = useState('')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/declaration-sociale')
      if (!res.ok) throw new Error('Erreur chargement')
      const json = await res.json()
      setData(json)
      // Sync form with existing data
      if (json.pays) setFormPays(json.pays)
      if (json.type_activite) setFormTypeActivite(json.type_activite)
      if (json.periodicite) setFormPeriodicite(json.periodicite)
      if (json.acre_actif) setFormAcre(json.acre_actif)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Configure profile ──
  const handleConfigure = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/declaration-sociale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'configurer',
          type_activite: formTypeActivite,
          periodicite: formPeriodicite,
          acre_actif: formAcre,
          acre_date_fin: formAcreDateFin || null,
        }),
      })
      if (!res.ok) throw new Error()
      await fetchData()
    } catch {
      toast.error(isPt ? 'Erro ao guardar' : 'Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // ── Mark as declared ──
  const handleMarquerDeclaree = async () => {
    if (!data) return
    setMarking(true)
    try {
      const res = await fetch('/api/declaration-sociale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'marquer_declaree',
          periode_label: data.periode.label,
          date_debut: data.periode.date_debut,
          date_fin: data.periode.date_fin,
          ca_periode: data.ca.montant,
          taux_applique: data.cotisations.taux_total,
          cotisations_estimees: data.cotisations.cotisations_estimees,
          date_limite: data.periode.date_limite,
        }),
      })
      if (!res.ok) throw new Error()
      setMarked(true)
      await fetchData()
    } catch {
      toast.error(isPt ? 'Erro ao registar' : 'Erreur d\'enregistrement')
    } finally {
      setMarking(false)
    }
  }

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="v22-card" style={{ height: 120 }}>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ height: 16, width: '60%', background: tv.border, borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
              <div style={{ height: 12, width: '80%', background: tv.border, borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
              <div style={{ height: 12, width: '40%', background: tv.border, borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="v22-alert v22-alert-red" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700 }}>{isPt ? 'Erro' : 'Erreur'}</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>{error}</div>
        <button onClick={fetchData} className="v22-btn" style={{ marginTop: 10 }}>
          {isPt ? 'Tentar novamente' : 'Réessayer'}
        </button>
      </div>
    )
  }

  if (!data) return null

  // ══════════════════════════════════════════════════
  // STATE 1: Not configured — onboarding form
  // ══════════════════════════════════════════════════
  if (!data.configure) {
    const typesActivite = formPays === 'FR' ? TYPES_ACTIVITE_FR : TYPES_ACTIVITE_PT

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title">
              {'⚙️'} {isPt ? 'Configurar perfil fiscal' : 'Configurer votre profil fiscal'}
            </div>
          </div>
          <div className="v22-card-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: tv.textMuted }}>
              {isPt
                ? 'Configure o seu regime para calcular automaticamente as suas contribuições sociais a cada período.'
                : 'Configurez votre régime pour calculer automatiquement vos cotisations sociales à chaque période.'}
            </p>

            {/* Pays */}
            <div>
              <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 6 }}>
                {isPt ? 'País' : 'Pays'}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['FR', 'PT'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => {
                      setFormPays(p)
                      setFormTypeActivite(p === 'FR' ? 'bic_services' : 'prestadores_servicos')
                      setFormPeriodicite(p === 'PT' ? 'trimestrielle' : formPeriodicite)
                    }}
                    className={`v22-btn ${formPays === p ? 'v22-btn-primary' : ''}`}
                    style={{ flex: 1, padding: '10px 16px' }}
                  >
                    {p === 'FR' ? '🇫🇷 France' : '🇵🇹 Portugal'}
                  </button>
                ))}
              </div>
            </div>

            {/* Type d'activité */}
            <div>
              <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 6 }}>
                {isPt ? 'Tipo de atividade' : 'Type d\'activité'}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {typesActivite.map(ta => (
                  <button
                    key={ta.key}
                    onClick={() => setFormTypeActivite(ta.key)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: `2px solid ${formTypeActivite === ta.key ? tv.primary : tv.border}`,
                      background: formTypeActivite === ta.key ? tv.primaryLight : tv.surface,
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: formTypeActivite === ta.key ? 600 : 400,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{ta.label}</span>
                    {ta.recommended && (
                      <span className="v22-tag v22-tag-green" style={{ fontSize: 10 }}>
                        {isPt ? 'Recomendado' : 'Recommandé'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Périodicité (FR only) */}
            {formPays === 'FR' && (
              <div>
                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 6 }}>
                  Périodicité de déclaration
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['mensuelle', 'trimestrielle'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setFormPeriodicite(p)}
                      className={`v22-btn ${formPeriodicite === p ? 'v22-btn-primary' : ''}`}
                      style={{ flex: 1, padding: '10px 16px', textTransform: 'capitalize' }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ACRE (FR only) */}
            {formPays === 'FR' && (
              <div style={{ padding: 14, borderRadius: 8, border: `1px solid ${tv.border}`, background: tv.bg }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formAcre}
                    onChange={e => setFormAcre(e.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>ACRE (Aide aux Créateurs)</div>
                    <div style={{ fontSize: 12, color: tv.textMuted }}>
                      Réduction de 50% sur les cotisations la 1ère année
                    </div>
                  </div>
                </label>
                {formAcre && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 12, color: tv.textMuted }}>Date de fin ACRE</label>
                    <input
                      type="date"
                      value={formAcreDateFin}
                      onChange={e => setFormAcreDateFin(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: `1px solid ${tv.border}`,
                        fontSize: 13,
                        marginTop: 4,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleConfigure}
              disabled={saving}
              className="v22-btn v22-btn-primary"
              style={{ padding: '12px 20px', fontWeight: 700, opacity: saving ? 0.5 : 1 }}
            >
              {saving
                ? '⏳ ...'
                : isPt ? '✅ Guardar configuração' : '✅ Enregistrer la configuration'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════
  // STATE 2: Configured — main declaration view
  // ══════════════════════════════════════════════════

  const { periode, ca, cotisations, historique, pays, acre_actif } = data
  const urlDeclaration = pays === 'FR' ? URL_DECLARATION_FR : URL_DECLARATION_PT
  const alreadyDeclared = historique.some(
    (h: HistoriqueEntry) => h.periode_label === periode.label && h.statut === 'declare'
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Deadline alert ── */}
      {periode.est_en_retard && (
        <div className="v22-alert v22-alert-red" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14 }}>
          <div style={{ fontSize: 24 }}>{'🚨'}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: tv.red }}>
              {isPt ? 'Declaração em atraso!' : 'Déclaration en retard !'}
            </div>
            <div style={{ fontSize: 12, color: tv.red }}>
              {isPt
                ? `O prazo para ${periode.label} expirou há ${Math.abs(periode.jours_restants)} dias.`
                : `La date limite pour ${periode.label} est dépassée de ${Math.abs(periode.jours_restants)} jours.`}
            </div>
          </div>
        </div>
      )}

      {!periode.est_en_retard && periode.jours_restants <= 15 && !alreadyDeclared && (
        <div className="v22-alert" style={{ borderLeftColor: tv.primary, background: tv.primaryLight, display: 'flex', gap: 12, alignItems: 'center', padding: 14 }}>
          <div style={{ fontSize: 24 }}>{'⏰'}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: tv.primary }}>
              {isPt
                ? `${periode.jours_restants} dias restantes`
                : `${periode.jours_restants} jours restants`}
            </div>
            <div style={{ fontSize: 12, color: tv.textMuted }}>
              {isPt
                ? `Prazo para declarar ${periode.label}: ${new Date(periode.date_limite).toLocaleDateString('pt-PT')}`
                : `Date limite pour déclarer ${periode.label} : ${new Date(periode.date_limite).toLocaleDateString('fr-FR')}`}
            </div>
          </div>
        </div>
      )}

      {/* ── Main declaration card ── */}
      <div className="v22-card">
        <div className="v22-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="v22-card-title">
            {'📋'} {isPt ? `Declaração ${periode.label}` : `Déclaration ${periode.label}`}
          </div>
          {alreadyDeclared || marked ? (
            <span className="v22-tag v22-tag-green">{'✅'} {isPt ? 'Declarado' : 'Déclaré'}</span>
          ) : (
            <span className="v22-tag v22-tag-yellow">{isPt ? 'A declarar' : 'À déclarer'}</span>
          )}
        </div>
        <div className="v22-card-body" style={{ padding: 16 }}>
          {/* Period info */}
          <div style={{ fontSize: 12, color: tv.textMuted, marginBottom: 14 }}>
            {isPt ? 'Período' : 'Période'} : {new Date(periode.date_debut).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR')} → {new Date(periode.date_fin).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR')}
            {' | '}
            {isPt ? 'Prazo' : 'Délai'} : {new Date(periode.date_limite).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR')}
          </div>

          {/* CA + Cotisations grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 16, borderRadius: 8, background: tv.greenLight, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: tv.textMuted, marginBottom: 4 }}>
                {isPt ? 'Faturação do período' : 'CA de la période'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: tv.green }}>
                {formatEur(ca.montant)}
              </div>
              <div style={{ fontSize: 11, color: tv.textMuted, marginTop: 2 }}>
                {ca.nb_factures} {isPt ? (data.source_ca === 'factures' ? 'faturas' : 'intervenções') : (data.source_ca === 'factures' ? 'factures' : 'interventions')}
              </div>
            </div>

            <div style={{ padding: 16, borderRadius: 8, background: tv.redBg, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: tv.textMuted, marginBottom: 4 }}>
                {isPt ? 'Contribuições estimadas' : 'Cotisations estimées'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: tv.red }}>
                {formatEur(cotisations.cotisations_estimees)}
              </div>
              <div style={{ fontSize: 11, color: tv.textMuted, marginTop: 2 }}>
                {cotisations.taux_label}
              </div>
            </div>
          </div>

          {/* Detail */}
          <div style={{ padding: 12, borderRadius: 8, background: tv.bg, fontSize: 13, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: tv.textMuted }}>{isPt ? 'Cálculo' : 'Calcul'}</span>
              <span style={{ fontWeight: 600 }}>{cotisations.detail}</span>
            </div>
            {acre_actif && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: tv.textMuted }}>ACRE</span>
                <span className="v22-tag v22-tag-green" style={{ fontSize: 10 }}>-50%</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${tv.border}`, paddingTop: 6, marginTop: 6 }}>
              <span style={{ fontWeight: 700 }}>{isPt ? 'A pagar' : 'À payer'}</span>
              <span style={{ fontWeight: 700, color: tv.red }}>{formatEur(cotisations.cotisations_estimees)}</span>
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{ fontSize: 11, color: tv.textMuted, marginBottom: 16, fontStyle: 'italic' }}>
            {cotisations.disclaimer}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              href={urlDeclaration}
              target="_blank"
              rel="noopener noreferrer"
              className="v22-btn v22-btn-primary"
              style={{ flex: 1, textAlign: 'center', padding: '12px 16px', fontWeight: 700, textDecoration: 'none', minWidth: 180 }}
            >
              {'🏛️'} {isPt
                ? (pays === 'PT' ? 'Declarar na Seg. Social' : 'Declarar na URSSAF')
                : 'Déclarer sur URSSAF'}
            </a>

            {!alreadyDeclared && !marked && (
              <button
                onClick={handleMarquerDeclaree}
                disabled={marking}
                className="v22-btn"
                style={{ flex: 1, padding: '12px 16px', fontWeight: 600, opacity: marking ? 0.5 : 1, minWidth: 150 }}
              >
                {marking ? '⏳ ...' : `${'✅'} ${isPt ? 'Já declarei' : 'J\'ai déclaré'}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── ACRE info (FR) ── */}
      {pays === 'FR' && acre_actif && (
        <div className="v22-alert" style={{ borderLeftColor: tv.green, background: tv.greenLight, padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: tv.green }}>
            {'🎁'} ACRE actif — réduction 50%
          </div>
          <div style={{ fontSize: 12, color: tv.textMuted, marginTop: 4 }}>
            Vos cotisations sont réduites de moitié pendant la première année d'activité.
          </div>
        </div>
      )}

      {/* ── History table ── */}
      {historique.length > 0 && (
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title">
              {'📊'} {isPt ? 'Histórico de declarações' : 'Historique des déclarations'}
            </div>
          </div>
          <div className="v22-card-body" style={{ padding: 0 }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: `1px solid ${tv.border}` }}>
                    {isPt ? 'Período' : 'Période'}
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', borderBottom: `1px solid ${tv.border}` }}>
                    {isPt ? 'Faturação' : 'CA'}
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', borderBottom: `1px solid ${tv.border}` }}>
                    {isPt ? 'Contribuições' : 'Cotisations'}
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', borderBottom: `1px solid ${tv.border}` }}>
                    {isPt ? 'Estado' : 'Statut'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {historique.map((h: HistoriqueEntry) => (
                  <tr key={h.id}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{h.periode_label}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatEur(h.ca_periode)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: tv.red }}>
                      {formatEur(h.cotisations_estimees)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {h.statut === 'declare' ? (
                        <span className="v22-tag v22-tag-green">{'✅'} {isPt ? 'Declarado' : 'Déclaré'}</span>
                      ) : h.statut === 'ignore' ? (
                        <span className="v22-tag v22-tag-gray">{isPt ? 'Ignorado' : 'Ignoré'}</span>
                      ) : (
                        <span className="v22-tag v22-tag-yellow">{isPt ? 'A declarar' : 'À déclarer'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Config summary + modify link ── */}
      <div className="v22-card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: tv.textMuted }}>
            {pays === 'FR' ? '🇫🇷' : '🇵🇹'} {data.type_activite?.replace(/_/g, ' ')} | {data.periodicite}
            {acre_actif ? ' | ACRE' : ''}
          </div>
          <button
            onClick={() => {
              // Reset to unconfigured to show form again
              setData(prev => prev ? { ...prev, configure: false } : null)
            }}
            style={{ fontSize: 12, color: tv.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            {'✏️'} {isPt ? 'Modificar' : 'Modifier'}
          </button>
        </div>
      </div>

      {/* ── Quick links ── */}
      {pays === 'PT' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <a href="https://www.portaldasfinancas.gov.pt" target="_blank" rel="noopener noreferrer"
            className="v22-card" style={{ textAlign: 'center', padding: 16, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{'🏛️'}</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Portal das Finanças</div>
            <div style={{ fontSize: 11, color: tv.textMuted }}>IVA & IRS</div>
          </a>
          <a href="https://www.seg-social.pt" target="_blank" rel="noopener noreferrer"
            className="v22-card" style={{ textAlign: 'center', padding: 16, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{'🛡️'}</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Segurança Social</div>
            <div style={{ fontSize: 11, color: tv.textMuted }}>Contribuições SS</div>
          </a>
          <a href="https://www.e-fatura.pt" target="_blank" rel="noopener noreferrer"
            className="v22-card" style={{ textAlign: 'center', padding: 16, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{'🧾'}</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>e-Fatura</div>
            <div style={{ fontSize: 11, color: tv.textMuted }}>Faturas à AT</div>
          </a>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener noreferrer"
            className="v22-card" style={{ textAlign: 'center', padding: 16, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{'🏛️'}</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>URSSAF</div>
            <div style={{ fontSize: 11, color: tv.textMuted }}>Déclarer votre CA</div>
          </a>
          <a href="https://www.impots.gouv.fr" target="_blank" rel="noopener noreferrer"
            className="v22-card" style={{ textAlign: 'center', padding: 16, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{'📋'}</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>impots.gouv.fr</div>
            <div style={{ fontSize: 11, color: tv.textMuted }}>Déclaration de revenus</div>
          </a>
        </div>
      )}
    </div>
  )
}
