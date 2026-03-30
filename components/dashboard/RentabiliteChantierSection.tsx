'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════════
// RENTABILITÉ CHANTIER — Module PRO BTP
// Affiche la rentabilité réelle de chaque chantier en croisant :
// - Situations de travaux (revenus)
// - Pointage employés × coût horaire (main d'œuvre)
// - Dépenses (matériaux, frais annexes)
// - Devis/factures validés
// ═══════════════════════════════════════════════════════════════════════════════

// ── Types internes (miroir des données localStorage) ─────────────────────────

interface Chantier {
  id: string; titre: string; client: string; adresse: string
  dateDebut: string; dateFin: string; budget: string
  statut: 'En attente' | 'En cours' | 'Terminé' | 'Annulé'
  description: string; equipe: string; createdAt: string
}

interface Pointage {
  id: string; employe: string; poste: string; chantier: string
  date: string; heureArrivee: string; heureDepart: string
  pauseMinutes: number; heuresTravaillees: number; notes: string
}

interface Membre {
  id: string; prenom: string; nom: string; telephone: string; email: string
  typeCompte: string; rolePerso: string; equipeId: string; createdAt: string
}

interface Expense {
  id: string; label: string; amount: string | number
  category: string; date: string; notes: string
  chantierId?: string; chantier?: string
}

interface Situation {
  id: string; chantier: string; client: string; numero: number; date: string
  montantMarche: number
  travaux: { poste: string; quantite: number; unite: string; prixUnit: number; avancement: number }[]
  statut: string
}

interface SavedDoc {
  id: string; type: string; clientName?: string; totalTTC?: number; totalHT?: number
  status?: string; created_at?: string; chantier?: string
}

// ── Données agrégées par chantier ────────────────────────────────────────────

interface ChantierFinancials {
  chantier: Chantier
  // Revenus
  caFacture: number        // Total facturé (situations validées/payées)
  caDevis: number          // Total devis validés
  caTotal: number          // max(caFacture, caDevis) = CA réel
  // Coûts
  coutMainOeuvre: number   // heures × coût horaire
  coutMateriaux: number    // dépenses catégorie matériel
  coutAutres: number       // transport, outillage, assurance, etc.
  coutTotal: number
  // Résultat
  beneficeNet: number
  margePercent: number
  // Durée
  joursPrevu: number
  joursReel: number
  // KPIs
  beneficeParJour: number
  projectionMensuelle: number
  seuilRentabiliteJours: number
  // Score
  score: number            // /10
  badge: 'rentable' | 'moyen' | 'a_risque'
  badgeColor: string
  // Détails
  heuresTotal: number
  nbOuvriers: number
}

// ── Constantes ───────────────────────────────────────────────────────────────

const DEFAULT_COUT_HORAIRE = 25 // €/h par défaut si non configuré
const MOIS_JOURS_OUVRES = 22

const EXPENSE_CATEGORIES_MATERIAUX = ['materiel', 'materiaux']
const EXPENSE_CATEGORIES_AUTRES = ['transport', 'outillage', 'assurance', 'formation', 'logiciel', 'telephone', 'comptable', 'publicite', 'bureau', 'autre', 'carburant', 'location']

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0
  const d1 = new Date(a), d2 = new Date(b)
  return Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / 86_400_000))
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
}

function fmtPct(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %'
}

function calcScore(marge: number, joursPrevu: number, joursReel: number, benefice: number): number {
  if (benefice <= 0) return Math.max(0, 2 + marge / 10) // 0-2 si perte
  let s = 5 // base
  // Marge bonus: +1 par 5% de marge (max +3)
  s += Math.min(3, Math.floor(marge / 5))
  // Délai bonus: +1 si dans les temps, -1 si dépassement >20%
  if (joursPrevu > 0) {
    const ratio = joursReel / joursPrevu
    if (ratio <= 1) s += 1
    else if (ratio > 1.2) s -= 1
  }
  // Bénéfice bonus: +1 si > 5000€
  if (benefice > 5000) s += 1
  return Math.max(0, Math.min(10, Math.round(s * 10) / 10))
}

function scoreBadge(score: number): { badge: 'rentable' | 'moyen' | 'a_risque'; color: string } {
  if (score >= 7) return { badge: 'rentable', color: '#22c55e' }
  if (score >= 4) return { badge: 'moyen', color: '#f59e0b' }
  return { badge: 'a_risque', color: '#ef4444' }
}

const BADGE_LABELS: Record<string, { fr: string; pt: string }> = {
  rentable: { fr: '✅ Rentable', pt: '✅ Rentável' },
  moyen: { fr: '⚠️ Moyen', pt: '⚠️ Médio' },
  a_risque: { fr: '🔴 À risque', pt: '🔴 Em risco' },
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function RentabiliteChantierSection({ artisan }: { artisan: any }) {
  const isPt = typeof document !== 'undefined' && document.cookie.includes('locale=pt')
  const t = (fr: string, pt: string) => isPt ? pt : fr

  // ── Config coût horaire par type de poste ──────────────────────────────────
  const [coutsHoraires, setCoutsHoraires] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(`fixit_couts_horaires_${artisan?.id}`)
      return saved ? JSON.parse(saved) : {
        ouvrier: 22, chef_chantier: 30, conducteur_travaux: 40, secretaire: 20, gerant: 45,
      }
    } catch { return { ouvrier: 22, chef_chantier: 30, conducteur_travaux: 40, secretaire: 20, gerant: 45 } }
  })

  const saveCoutsHoraires = (c: Record<string, number>) => {
    setCoutsHoraires(c)
    localStorage.setItem(`fixit_couts_horaires_${artisan?.id}`, JSON.stringify(c))
  }

  // ── Chargement des données ─────────────────────────────────────────────────
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [pointages, setPointages] = useState<Pointage[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [situations, setSituations] = useState<Situation[]>([])
  const [documents, setDocuments] = useState<SavedDoc[]>([])

  useEffect(() => {
    if (!artisan?.id) return
    const load = (key: string) => {
      try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
    }
    // Fetch from Supabase API first, fallback to localStorage
    async function fetchData() {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data: sess } = await supabase.auth.getSession()
        const authH: Record<string, string> = sess?.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}
        const [chRes, mbRes, dpRes, ptRes] = await Promise.all([
          fetch('/api/btp?table=chantiers', { headers: authH }),
          fetch('/api/btp?table=membres', { headers: authH }),
          fetch('/api/btp?table=depenses', { headers: authH }),
          fetch('/api/btp?table=pointages', { headers: authH }),
        ])
        const ch = chRes.ok ? await chRes.json() : null
        const mb = mbRes.ok ? await mbRes.json() : null
        const dp = dpRes.ok ? await dpRes.json() : null
        const pt = ptRes.ok ? await ptRes.json() : null
        if (ch?.chantiers?.length) setChantiers(ch.chantiers.map((c: any) => ({
          id: c.id, titre: c.titre || c.title || '', client: c.client || '',
          adresse: c.adresse || c.address || '', dateDebut: c.date_debut || c.dateDebut || '',
          dateFin: c.date_fin || c.dateFin || '', budget: String(c.budget || '0'),
          statut: c.statut || c.status || 'En cours', description: c.description || '',
          equipe: c.equipe || '', createdAt: c.created_at || '',
        })))
        else setChantiers(load(`fixit_chantiers_${artisan.id}`))
        if (mb?.membres?.length) setMembres(mb.membres.map((m: any) => ({
          id: m.id, prenom: m.prenom || '', nom: m.nom || '', telephone: m.telephone || '',
          email: m.email || '', typeCompte: m.type_compte || m.typeCompte || 'ouvrier',
          rolePerso: m.role_perso || m.rolePerso || '', equipeId: m.equipe_id || '', createdAt: m.created_at || '',
        })))
        else setMembres(load(`fixit_membres_${artisan.id}`))
        if (dp?.depenses?.length) setExpenses(dp.depenses.map((d: any) => ({
          id: d.id, label: d.label || '', amount: d.amount || 0, category: d.category || '',
          date: d.date || '', notes: d.notes || '', chantierId: d.chantier_id || '',
        })))
        else setExpenses(load(`fixit_expenses_${artisan.id}`))
        if (pt?.pointages?.length) setPointages(pt.pointages.map((p: any) => ({
          id: p.id, employe: p.employe || '', poste: p.poste || '', chantier: p.chantier || p.chantier_id || '',
          date: p.date || '', heureArrivee: p.heure_arrivee || '', heureDepart: p.heure_depart || '',
          pauseMinutes: p.pause_minutes || 0, heuresTravaillees: p.heures_travaillees || 0, notes: p.notes || '',
        })))
        else setPointages(load(`pointage_${artisan.id}`))
      } catch {
        // Fallback total localStorage
        setChantiers(load(`fixit_chantiers_${artisan.id}`))
        setPointages(load(`pointage_${artisan.id}`))
        setMembres(load(`fixit_membres_${artisan.id}`))
        setExpenses(load(`fixit_expenses_${artisan.id}`))
      }
      // Situations et documents restent en localStorage (pas de table Supabase dédiée)
      setSituations(load(`situations_${artisan.id}`))
      setDocuments(load(`fixit_documents_${artisan.id}`))
    }
    fetchData()
  }, [artisan?.id])

  // ── Sélection chantier + simulateur ────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [simJoursExtra, setSimJoursExtra] = useState(0)
  const [simOuvriersExtra, setSimOuvriersExtra] = useState(0)
  const [simCoutExtra, setSimCoutExtra] = useState(0)

  const resetSim = () => { setSimJoursExtra(0); setSimOuvriersExtra(0); setSimCoutExtra(0) }

  // ── Calcul financier par chantier ──────────────────────────────────────────
  const financials: ChantierFinancials[] = useMemo(() => {
    return chantiers
      .filter(ch => ch.statut !== 'Annulé')
      .map(ch => {
        const titre = ch.titre.toLowerCase().trim()

        // Revenue: situations de travaux
        const sitsCh = situations.filter(s => s.chantier.toLowerCase().trim() === titre)
        const caFacture = sitsCh
          .filter(s => s.statut === 'validée' || s.statut === 'payée')
          .reduce((sum, s) => sum + s.travaux.reduce((t, p) => t + (p.quantite * p.prixUnit * p.avancement / 100), 0), 0)

        // Revenue: devis/factures liés au client
        const clientLower = ch.client.toLowerCase().trim()
        const docsClient = documents.filter(d =>
          d.clientName?.toLowerCase().trim() === clientLower && (d.type === 'facture' || d.status === 'signé')
        )
        const caDevis = docsClient.reduce((sum, d) => sum + (d.totalHT || d.totalTTC || 0), 0)

        const caTotal = Math.max(caFacture, caDevis, parseFloat(ch.budget) || 0)

        // Coût main d'œuvre : pointage × coût horaire
        const pointCh = pointages.filter(p => p.chantier.toLowerCase().trim() === titre)
        const heuresTotal = pointCh.reduce((sum, p) => sum + (p.heuresTravaillees || 0), 0)

        // Map employé → type de poste → coût horaire
        const membreMap = new Map(membres.map(m => [`${m.prenom} ${m.nom}`.toLowerCase(), m.typeCompte]))
        const coutMainOeuvre = pointCh.reduce((sum, p) => {
          const type = membreMap.get(p.employe.toLowerCase()) || 'ouvrier'
          const tarif = coutsHoraires[type] || DEFAULT_COUT_HORAIRE
          return sum + (p.heuresTravaillees || 0) * tarif
        }, 0)

        const ouvriersUniques = new Set(pointCh.map(p => p.employe)).size

        // Dépenses matériaux
        const expCh = expenses.filter(e =>
          e.chantierId === ch.id ||
          e.chantier?.toLowerCase().trim() === titre ||
          (e.notes && e.notes.toLowerCase().includes(titre))
        )
        const coutMateriaux = expCh
          .filter(e => EXPENSE_CATEGORIES_MATERIAUX.includes(e.category))
          .reduce((sum, e) => sum + (typeof e.amount === 'string' ? parseFloat(e.amount) || 0 : e.amount), 0)

        const coutAutres = expCh
          .filter(e => EXPENSE_CATEGORIES_AUTRES.includes(e.category) || e.category === 'mainoeuvre')
          .reduce((sum, e) => sum + (typeof e.amount === 'string' ? parseFloat(e.amount) || 0 : e.amount), 0)

        const coutTotal = coutMainOeuvre + coutMateriaux + coutAutres

        // Durée
        const joursPrevu = daysBetween(ch.dateDebut, ch.dateFin)
        const endDate = ch.statut === 'Terminé' ? ch.dateFin : today()
        const joursReel = daysBetween(ch.dateDebut, endDate)

        // Résultat
        const beneficeNet = caTotal - coutTotal
        const margePercent = caTotal > 0 ? (beneficeNet / caTotal) * 100 : 0
        const beneficeParJour = joursReel > 0 ? beneficeNet / joursReel : 0
        const projectionMensuelle = beneficeParJour * MOIS_JOURS_OUVRES

        // Seuil de rentabilité: combien de jours pour couvrir les coûts fixes
        const coutParJour = joursReel > 0 ? coutTotal / joursReel : 0
        const revenuParJour = joursReel > 0 ? caTotal / joursReel : 0
        const seuilRentabiliteJours = revenuParJour > coutParJour
          ? Math.ceil(coutTotal / (revenuParJour - coutParJour))
          : Infinity

        // Score
        const score = calcScore(margePercent, joursPrevu, joursReel, beneficeNet)
        const { badge, color: badgeColor } = scoreBadge(score)

        return {
          chantier: ch, caFacture, caDevis, caTotal,
          coutMainOeuvre, coutMateriaux, coutAutres, coutTotal,
          beneficeNet, margePercent, joursPrevu, joursReel,
          beneficeParJour, projectionMensuelle, seuilRentabiliteJours,
          score, badge, badgeColor, heuresTotal, nbOuvriers: ouvriersUniques,
        }
      })
      .sort((a, b) => b.beneficeNet - a.beneficeNet)
  }, [chantiers, pointages, membres, expenses, situations, documents, coutsHoraires])

  const selected = financials.find(f => f.chantier.id === selectedId) || null

  // Simulateur : applique les ajustements
  const simulated = useMemo(() => {
    if (!selected) return null
    const extraCoutJours = simJoursExtra * (selected.joursReel > 0 ? selected.coutTotal / selected.joursReel : 0)
    const extraCoutOuvriers = simOuvriersExtra * (coutsHoraires.ouvrier || DEFAULT_COUT_HORAIRE) * 8 * (selected.joursReel + simJoursExtra)
    const newCoutTotal = selected.coutTotal + extraCoutJours + extraCoutOuvriers + simCoutExtra
    const newBenefice = selected.caTotal - newCoutTotal
    const newMarge = selected.caTotal > 0 ? (newBenefice / selected.caTotal) * 100 : 0
    const newJours = selected.joursReel + simJoursExtra
    const newBenefParJour = newJours > 0 ? newBenefice / newJours : 0
    const newScore = calcScore(newMarge, selected.joursPrevu, newJours, newBenefice)
    const { badge: newBadge, color: newBadgeColor } = scoreBadge(newScore)
    return { coutTotal: newCoutTotal, benefice: newBenefice, marge: newMarge, jours: newJours, benefParJour: newBenefParJour, score: newScore, badge: newBadge, badgeColor: newBadgeColor }
  }, [selected, simJoursExtra, simOuvriersExtra, simCoutExtra, coutsHoraires])

  // ── Totaux globaux ─────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const ca = financials.reduce((s, f) => s + f.caTotal, 0)
    const cout = financials.reduce((s, f) => s + f.coutTotal, 0)
    const benef = ca - cout
    const marge = ca > 0 ? (benef / ca) * 100 : 0
    const rentables = financials.filter(f => f.badge === 'rentable').length
    const risque = financials.filter(f => f.badge === 'a_risque').length
    return { ca, cout, benef, marge, rentables, risque, total: financials.length }
  }, [financials])

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Header + bouton config */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            💰 {t('Rentabilité Chantier', 'Rentabilidade da Obra')}
          </h2>
          <p style={{ color: '#6b7280', marginTop: 6, marginBottom: 0, fontSize: 14 }}>
            {t(
              'Comprenez en 5 secondes si vos chantiers vous rapportent de l\'argent',
              'Perceba em 5 segundos se as suas obras lhe dão lucro'
            )}
          </p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          style={{ padding: '6px 14px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          ⚙️ {t('Coûts horaires', 'Custos por hora')}
        </button>
      </div>

      {showConfig && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>
            {t('Coût horaire par type de poste (€/h)', 'Custo por hora por tipo de posto (€/h)')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {Object.entries({ ouvrier: t('Ouvrier', 'Operário'), chef_chantier: t('Chef de chantier', 'Encarregado'), conducteur_travaux: t('Conducteur', 'Diretor de obra'), secretaire: t('Secrétaire', 'Secretária'), gerant: t('Gérant', 'Gerente') }).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 13, color: '#374151', minWidth: 100 }}>{label}</label>
                <input
                  type="number" min={0} max={200}
                  value={coutsHoraires[key] || 0}
                  onChange={e => saveCoutsHoraires({ ...coutsHoraires, [key]: parseFloat(e.target.value) || 0 })}
                  style={{ width: 70, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, textAlign: 'right' }}
                />
                <span style={{ fontSize: 12, color: '#9ca3af' }}>€/h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AUCUN CHANTIER ────────────────────────────────────────────────── */}
      {chantiers.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', background: '#f9fafb', borderRadius: 12 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏗️</div>
          <p style={{ color: '#6b7280', fontWeight: 500, fontSize: 15, margin: 0, textAlign: 'center' }}>
            {t('Créez vos chantiers dans la section "Chantiers" pour voir leur rentabilité.', 'Crie as suas obras na secção "Obras" para ver a rentabilidade.')}
          </p>
        </div>
      )}

      {/* ── KPI GLOBAUX ───────────────────────────────────────────────────── */}
      {financials.length > 0 && !selectedId && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
            <KpiCard label={t('CA Total', 'Volume Total')} value={`${fmt(totals.ca)} €`} sub={`${totals.total} ${t('chantiers', 'obras')}`} color="#1e40af" />
            <KpiCard label={t('Bénéfice Net', 'Lucro Líquido')} value={`${fmt(totals.benef)} €`} sub={fmtPct(totals.marge)} color={totals.benef >= 0 ? '#22c55e' : '#ef4444'} />
            <KpiCard label={t('Rentables', 'Rentáveis')} value={`${totals.rentables}/${totals.total}`} sub={totals.risque > 0 ? `${totals.risque} ${t('à risque', 'em risco')}` : t('Tous ok', 'Todos ok')} color={totals.risque > 0 ? '#f59e0b' : '#22c55e'} />
            <KpiCard label={t('Marge moyenne', 'Margem média')} value={fmtPct(totals.marge)} color={totals.marge >= 15 ? '#22c55e' : totals.marge >= 5 ? '#f59e0b' : '#ef4444'} />
          </div>

          {/* ── LISTE DES CHANTIERS ──────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {financials.map(f => (
              <button
                key={f.chantier.id}
                onClick={() => { setSelectedId(f.chantier.id); resetSim() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                  borderLeft: `4px solid ${f.badgeColor}`, cursor: 'pointer',
                  textAlign: 'left', width: '100%',
                }}
              >
                {/* Score */}
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', background: f.badgeColor + '18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 18, color: f.badgeColor, flexShrink: 0,
                }}>
                  {f.score}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{f.chantier.titre}</div>
                  <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                    📍 {f.chantier.adresse || f.chantier.client} · {f.chantier.statut}
                    {f.joursReel > 0 && ` · ${f.joursReel}j`}
                  </div>
                </div>

                {/* Résultat */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: f.beneficeNet >= 0 ? '#22c55e' : '#ef4444' }}>
                    {f.beneficeNet >= 0 ? '+' : ''}{fmt(f.beneficeNet)} €
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {fmtPct(f.margePercent)} · {fmt(f.caTotal)} € CA
                  </div>
                </div>

                {/* Badge */}
                <span style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: f.badgeColor + '18', color: f.badgeColor, whiteSpace: 'nowrap',
                }}>
                  {BADGE_LABELS[f.badge]?.[isPt ? 'pt' : 'fr']}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── VUE DÉTAILLÉE D'UN CHANTIER ─────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {selected && (
        <div>
          {/* Retour */}
          <button
            onClick={() => { setSelectedId(null); resetSim() }}
            style={{ padding: '6px 14px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13, marginBottom: 16 }}
          >
            ← {t('Retour aux chantiers', 'Voltar às obras')}
          </button>

          {/* En-tête chantier */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>{selected.chantier.titre}</h3>
              <div style={{ color: '#6b7280', fontSize: 13 }}>
                {selected.chantier.client} · 📍 {selected.chantier.adresse}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: selected.badgeColor + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 22, color: selected.badgeColor,
              }}>
                {selected.score}
              </div>
              <span style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700,
                background: selected.badgeColor + '18', color: selected.badgeColor,
              }}>
                {BADGE_LABELS[selected.badge]?.[isPt ? 'pt' : 'fr']}
              </span>
            </div>
          </div>

          {/* ── 4 KPI CARDS ──────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            <KpiCard
              label={t('Bénéfice net', 'Lucro líquido')}
              value={`${selected.beneficeNet >= 0 ? '+' : ''}${fmt(selected.beneficeNet)} €`}
              sub={`${fmtPct(selected.margePercent)} ${t('de marge', 'de margem')}`}
              color={selected.beneficeNet >= 0 ? '#22c55e' : '#ef4444'}
              big
            />
            <KpiCard
              label={t('Durée chantier', 'Duração da obra')}
              value={`${selected.joursReel}j / ${selected.joursPrevu}j`}
              sub={selected.joursReel > selected.joursPrevu
                ? `⚠️ +${selected.joursReel - selected.joursPrevu}j ${t('de retard', 'de atraso')}`
                : `✅ ${t('Dans les temps', 'Dentro do prazo')}`}
              color={selected.joursReel <= selected.joursPrevu ? '#22c55e' : '#f59e0b'}
            />
            <KpiCard
              label={t('Bénéfice / jour', 'Lucro / dia')}
              value={`${fmt(selected.beneficeParJour)} €`}
              sub={t('par jour ouvré', 'por dia útil')}
              color={selected.beneficeParJour >= 0 ? '#1e40af' : '#ef4444'}
            />
            <KpiCard
              label={t('Projection mensuelle', 'Projeção mensal')}
              value={`${fmt(selected.projectionMensuelle)} €`}
              sub={`${MOIS_JOURS_OUVRES}j ${t('ouvrés/mois', 'úteis/mês')}`}
              color={selected.projectionMensuelle >= 0 ? '#1e40af' : '#ef4444'}
            />
          </div>

          {/* ── TABLEAU CENTRAL SIMPLIFIÉ ─────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={thStyle}>{t('Élément', 'Elemento')}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{t('Montant', 'Montante')}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>%</th>
                </tr>
              </thead>
              <tbody>
                <tr style={trStyle}>
                  <td style={tdStyle}>💰 {t('Chiffre d\'affaires', 'Volume de negócios')}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>{fmt(selected.caTotal)} €</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#9ca3af' }}>100%</td>
                </tr>
                <tr style={trStyle}>
                  <td style={tdStyle}>👷 {t('Main d\'œuvre', 'Mão de obra')} <span style={{ color: '#9ca3af', fontSize: 11 }}>({fmt(selected.heuresTotal)}h · {selected.nbOuvriers} {t('pers.', 'pess.')})</span></td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#ef4444' }}>- {fmt(selected.coutMainOeuvre)} €</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#9ca3af' }}>{selected.caTotal > 0 ? fmtPct(selected.coutMainOeuvre / selected.caTotal * 100) : '—'}</td>
                </tr>
                <tr style={trStyle}>
                  <td style={tdStyle}>🧱 {t('Matériaux', 'Materiais')}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#ef4444' }}>- {fmt(selected.coutMateriaux)} €</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#9ca3af' }}>{selected.caTotal > 0 ? fmtPct(selected.coutMateriaux / selected.caTotal * 100) : '—'}</td>
                </tr>
                <tr style={trStyle}>
                  <td style={tdStyle}>🚛 {t('Autres frais', 'Outros custos')}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#ef4444' }}>- {fmt(selected.coutAutres)} €</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#9ca3af' }}>{selected.caTotal > 0 ? fmtPct(selected.coutAutres / selected.caTotal * 100) : '—'}</td>
                </tr>
                <tr style={{ background: selected.beneficeNet >= 0 ? '#f0fdf4' : '#fef2f2', fontWeight: 700 }}>
                  <td style={{ ...tdStyle, fontSize: 15 }}>{selected.beneficeNet >= 0 ? '✅' : '🔴'} {t('BÉNÉFICE NET', 'LUCRO LÍQUIDO')}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontSize: 16, color: selected.beneficeNet >= 0 ? '#22c55e' : '#ef4444' }}>
                    {selected.beneficeNet >= 0 ? '+' : ''}{fmt(selected.beneficeNet)} €
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: selected.beneficeNet >= 0 ? '#22c55e' : '#ef4444' }}>
                    {fmtPct(selected.margePercent)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── SEUIL DE RENTABILITÉ ─────────────────────────────────────── */}
          {selected.seuilRentabiliteJours !== Infinity && (
            <div style={{
              background: selected.joursReel >= selected.seuilRentabiliteJours ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${selected.joursReel >= selected.seuilRentabiliteJours ? '#bbf7d0' : '#fde68a'}`,
              borderRadius: 10, padding: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ fontSize: 28 }}>{selected.joursReel >= selected.seuilRentabiliteJours ? '✅' : '⏳'}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {t('Seuil de rentabilité', 'Limiar de rentabilidade')} : {selected.seuilRentabiliteJours} {t('jours', 'dias')}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {selected.joursReel >= selected.seuilRentabiliteJours
                    ? t(`Atteint au jour ${selected.seuilRentabiliteJours} — vous êtes en zone de profit`, `Atingido no dia ${selected.seuilRentabiliteJours} — está em zona de lucro`)
                    : t(`Encore ${selected.seuilRentabiliteJours - selected.joursReel} jours avant d'être rentable`, `Ainda ${selected.seuilRentabiliteJours - selected.joursReel} dias para ser rentável`)}
                </div>
              </div>
            </div>
          )}

          {/* ── BARRE DE PROGRESSION VISUELLE ────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
              {t('Répartition des coûts', 'Distribuição de custos')}
            </div>
            <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', background: '#f3f4f6' }}>
              {selected.coutTotal > 0 ? (
                <>
                  <div style={{ width: `${(selected.coutMainOeuvre / selected.coutTotal) * 100}%`, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600, minWidth: 30 }}>
                    👷 {Math.round((selected.coutMainOeuvre / selected.coutTotal) * 100)}%
                  </div>
                  <div style={{ width: `${(selected.coutMateriaux / selected.coutTotal) * 100}%`, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600, minWidth: 30 }}>
                    🧱 {Math.round((selected.coutMateriaux / selected.coutTotal) * 100)}%
                  </div>
                  <div style={{ width: `${(selected.coutAutres / selected.coutTotal) * 100}%`, background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600, minWidth: 30 }}>
                    🚛 {Math.round((selected.coutAutres / selected.coutTotal) * 100)}%
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12 }}>
                  {t('Aucun coût enregistré', 'Nenhum custo registado')}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: '#6b7280' }}>
              <span>🔵 {t('Main d\'œuvre', 'Mão de obra')}</span>
              <span>🟡 {t('Matériaux', 'Materiais')}</span>
              <span>🟣 {t('Autres', 'Outros')}</span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* ── SIMULATEUR ────────────────────────────────────────────────── */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              🎮 {t('Simulateur "Et si..."', 'Simulador "E se..."')}
            </div>
            <p style={{ color: '#6b7280', fontSize: 12, marginTop: 0, marginBottom: 16 }}>
              {t('Testez l\'impact de changements sur votre rentabilité', 'Teste o impacto de mudanças na sua rentabilidade')}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={simLabelStyle}>{t('Jours supplémentaires', 'Dias adicionais')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="range" min={0} max={30} value={simJoursExtra} onChange={e => setSimJoursExtra(parseInt(e.target.value))} style={{ flex: 1 }} />
                  <span style={simValStyle}>+{simJoursExtra}j</span>
                </div>
              </div>
              <div>
                <label style={simLabelStyle}>{t('Ouvriers en plus', 'Operários adicionais')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="range" min={0} max={10} value={simOuvriersExtra} onChange={e => setSimOuvriersExtra(parseInt(e.target.value))} style={{ flex: 1 }} />
                  <span style={simValStyle}>+{simOuvriersExtra}</span>
                </div>
              </div>
              <div>
                <label style={simLabelStyle}>{t('Coût imprévu (€)', 'Custo extra (€)')}</label>
                <input
                  type="number" min={0} value={simCoutExtra}
                  onChange={e => setSimCoutExtra(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 13 }}
                />
              </div>
            </div>

            {/* Résultat simulé */}
            {simulated && (simJoursExtra > 0 || simOuvriersExtra > 0 || simCoutExtra > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, background: '#fff', borderRadius: 10, padding: 14 }}>
                <SimResult
                  label={t('Bénéfice', 'Lucro')}
                  before={`${fmt(selected.beneficeNet)} €`}
                  after={`${fmt(simulated.benefice)} €`}
                  isGood={simulated.benefice >= selected.beneficeNet}
                />
                <SimResult
                  label={t('Marge', 'Margem')}
                  before={fmtPct(selected.margePercent)}
                  after={fmtPct(simulated.marge)}
                  isGood={simulated.marge >= selected.margePercent}
                />
                <SimResult
                  label={t('Bénéf/jour', 'Lucro/dia')}
                  before={`${fmt(selected.beneficeParJour)} €`}
                  after={`${fmt(simulated.benefParJour)} €`}
                  isGood={simulated.benefParJour >= selected.beneficeParJour}
                />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Score</div>
                  <div style={{ fontWeight: 800, fontSize: 22, color: simulated.badgeColor }}>{simulated.score}</div>
                  <div style={{ fontSize: 11, color: simulated.badgeColor, fontWeight: 600 }}>
                    {BADGE_LABELS[simulated.badge]?.[isPt ? 'pt' : 'fr']}
                  </div>
                </div>
              </div>
            )}

            {(simJoursExtra > 0 || simOuvriersExtra > 0 || simCoutExtra > 0) && (
              <button onClick={resetSim} style={{ marginTop: 10, padding: '6px 12px', background: 'none', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#1e40af' }}>
                ↺ {t('Réinitialiser', 'Reiniciar')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function KpiCard({ label, value, sub, color, big }: { label: string; value: string; sub?: string; color: string; big?: boolean }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: big ? '18px 20px' : '14px 16px',
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: big ? 24 : 20, fontWeight: 800, color, lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SimResult({ label, before, after, isGood }: { label: string; before: string; after: string; isGood: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' }}>{before}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: isGood ? '#22c55e' : '#ef4444' }}>
        {isGood ? '↑' : '↓'} {after}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280',
  borderBottom: '1px solid #e5e7eb',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
}

const trStyle: React.CSSProperties = {
  borderBottom: '1px solid #f3f4f6',
}

const simLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6,
}

const simValStyle: React.CSSProperties = {
  minWidth: 40, textAlign: 'center', fontWeight: 700, fontSize: 14, color: '#1e40af',
}
