'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'
import ResumeActivite from '@/components/stats/ResumeActivite'
import { docRevenueHT } from '@/lib/stats-doc-total'
import {
  documentsPourSynthese, estAnnule, estDevisSigne, estDuType, estFacturePayee, facturesDuChiffreAffaires,
} from '@/lib/documents/liste-effective'
import { useBTPData } from '@/lib/hooks/use-btp-data'

async function downloadCsv(type: 'clients' | 'bookings' | 'revenue', errorMsg = 'Erreur lors de l\'export') {
  const res = await fetch(`/api/user/export-csv?type=${type}`)
  if (!res.ok) {
    toast.error(errorMsg)
    return
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || `${type}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

/* ═══════════════════════════════════════════════════════
   Pilotage banner — monthly financial summary
   Fetches BTP rentability + charges fixes via /api/btp
   ═══════════════════════════════════════════════════════ */
interface PilotageData {
  caTotal: number
  chargesTotal: number
  netPoche: number
  margePct: number
  alertes: string[]
}

function usePilotageData() {
  const [pilotageData, setPilotageData] = useState<PilotageData | null>(null)
  const isPt = useLocale() === 'pt'

  useEffect(() => {
    async function fetchPilotage() {
      try {
        const [rentaRes, chargesRes] = await Promise.all([
          fetch('/api/btp?table=rentabilite'),
          fetch('/api/btp?table=charges_fixes'),
        ])

        if (!rentaRes.ok || !chargesRes.ok) return

        const rentaJson = await rentaRes.json() as { rentabilite?: Array<{ ca_reel?: number; benefice_net?: number; chantier_nom?: string; nom?: string }> }
        const chargesJson = await chargesRes.json() as { charges_fixes?: Array<{ montant_mensuel?: number; montant?: number }> }

        const rentabilite = rentaJson.rentabilite || []
        const chargesFixes = chargesJson.charges_fixes || []

        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()

        // Try to filter by current month if rows have a date field; fall back to all rows
        const rentaRows = rentabilite.filter((r) => {
          const d = (r as Record<string, unknown>).mois || (r as Record<string, unknown>).date || (r as Record<string, unknown>).created_at
          if (!d || typeof d !== 'string') return true // no date column — include all
          const parsed = new Date(d)
          return parsed.getMonth() === currentMonth && parsed.getFullYear() === currentYear
        })
        const rowsToUse = rentaRows.length > 0 ? rentaRows : rentabilite

        const caTotal = rowsToUse.reduce((s, r) => s + (r.ca_reel || 0), 0)
        const chargesFromView = rowsToUse.reduce((s, r) => {
          const b = r.benefice_net ?? 0
          const ca = r.ca_reel ?? 0
          return s + Math.max(ca - b, 0)
        }, 0)
        const chargesFixesMonthly = chargesFixes.reduce((s, c) => s + (c.montant_mensuel ?? c.montant ?? 0), 0)
        const chargesTotal = chargesFromView + chargesFixesMonthly
        const netPoche = caTotal - chargesTotal
        const margePct = caTotal > 0 ? (netPoche / caTotal) * 100 : 0

        const alertes: string[] = rowsToUse
          .filter((r) => (r.benefice_net ?? 0) < 0)
          .map((r) => {
            const nom = r.chantier_nom || r.nom || (isPt ? 'Obra' : 'Chantier')
            return isPt
              ? `${nom}: margem negativa (${formatPrice(r.benefice_net ?? 0)})`
              : `${nom} — marge négative (${formatPrice(r.benefice_net ?? 0)})`
          })

        setPilotageData({ caTotal, chargesTotal, netPoche, margePct, alertes })
      } catch {
        // Silent — don't show broken banner
      }
    }

    fetchPilotage()
  }, [isPt])

  return pilotageData
}

function PilotageBanner() {
  const { t } = useTranslation()
  const locale = useLocale()
  const pilotageData = usePilotageData()

  if (!pilotageData) return null

  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const monthLabel = new Date().toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-500 mb-3 capitalize">{monthLabel}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-gray-500">{t('proDash.stats.caFacture')}</div>
          <div className="text-lg font-bold">{formatPrice(pilotageData.caTotal)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">{t('proDash.stats.chargesTotales')}</div>
          <div className="text-lg font-bold text-red-600">{formatPrice(pilotageData.chargesTotal)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">{t('proDash.stats.netPoche')}</div>
          <div className="text-lg font-bold text-green-600">{formatPrice(pilotageData.netPoche)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">{t('proDash.stats.marge')}</div>
          <div className={`text-lg font-bold ${
            pilotageData.margePct > 15 ? 'text-green-600' :
            pilotageData.margePct >= 5 ? 'text-orange-500' : 'text-red-600'
          }`}>
            {pilotageData.margePct.toFixed(1)}%
          </div>
        </div>
      </div>
      {pilotageData.alertes.length > 0 && (
        <div className="mt-3 space-y-1">
          {pilotageData.alertes.map((alerte, i) => (
            <div key={i} className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
              ⚠️ {alerte}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface StatsRevenusSectionProps {
  artisan: import('@/lib/types').Artisan
  bookings: import('@/lib/types').Booking[]
  services: import('@/lib/types').Service[]
  pendingBookings: import('@/lib/types').Booking[]
  completedBookings: import('@/lib/types').Booking[]
  totalRevenue: number
  activePage: string
  orgRole?: OrgRole
  /**
   * Devis et factures du tableau de bord. Pour un salarié invité d'une société, ce sont ceux de la SOCIÉTÉ, lus par
   * le serveur : son propre stockage de navigateur ne contient que ses brouillons, et ces écrans affichaient donc
   * 0 €. Absente ou vide, les écrans lisent le stockage comme avant (lib/documents/liste-effective.ts).
   */
  savedDocuments?: readonly LocalDoc[]
}

export default function StatsRevenusSection({
  artisan, bookings, services, pendingBookings, completedBookings, totalRevenue, activePage, orgRole, savedDocuments,
}: StatsRevenusSectionProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)

  /* ═══════════════════════════════════════════
     V5 layout — pro_societe only
     ═══════════════════════════════════════════ */
  if (isV5 && activePage === 'stats') {
    return <StatsV5 bookings={bookings} totalRevenue={totalRevenue} services={services} artisan={artisan} locale={locale} orgRole={orgRole} savedDocuments={savedDocuments} />
  }
  if (isV5 && activePage === 'revenus') {
    return <RevenusV5 bookings={bookings} completedBookings={completedBookings} pendingBookings={pendingBookings} totalRevenue={totalRevenue} locale={locale} t={t} artisan={artisan} orgRole={orgRole} savedDocuments={savedDocuments} />
  }

  /* ═══════════════════════════════════════════
     V22 layout — artisan and other roles
     ═══════════════════════════════════════════ */
  if (activePage === 'stats') {
    return (
      <div>
        <PilotageBanner />
        <div className="v22-page-header">
          <div>
            <div className="v22-page-title">{'📊'} {t('proDash.stats.title')}</div>
            <div className="v22-page-sub">{t('proDash.stats.subtitle')}</div>
          </div>
        </div>
        <div style={{ padding: '20px' }}>
          <ResumeActivite />
          <div className="v22-stats">
            <div className="v22-stat">
              <div className="v22-stat-label">{t('proDash.stats.interventionsTotales')}</div>
              <div className="v22-stat-val">{bookings.length}</div>
              <div className="v22-stat-delta v22-up">{'📅'} {completedBookings.length} {t('proDash.home.terminees')}</div>
            </div>
            <div className="v22-stat v22-stat-yellow">
              <div className="v22-stat-label">{t('proDash.stats.chiffreAffaires')}</div>
              <div className="v22-stat-val">{formatPrice(totalRevenue, locale)}</div>
              <div className="v22-stat-delta">{'💰'} {bookings.length} {t('proDash.clients.interventions')}</div>
            </div>
            <div className="v22-stat">
              <div className="v22-stat-label">{t('proDash.stats.noteMoyenne')}</div>
              <div className="v22-stat-val">{artisan?.rating_avg || '5.0'}/5</div>
              <div className="v22-stat-delta v22-up">{'⭐'} {artisan?.rating_count || 0} {t('proDash.home.avis')}</div>
            </div>
            <div className="v22-stat">
              <div className="v22-stat-label">{t('proDash.stats.motifsActifs')}</div>
              <div className="v22-stat-val">{services.filter(s => s.active).length}</div>
              <div className="v22-stat-delta">{'🔧'} {services.length} {t('proDash.stats.auTotal')}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // activePage === 'revenus'
  return (
    <div>
      <PilotageBanner />
      <ExportHeader t={t} />
      <div style={{ padding: '20px' }}>
        <ResumeActivite />
        <div className="v22-stats" style={{ marginBottom: '20px' }}>
          <div className="v22-stat">
            <div className="v22-stat-label">{t('proDash.stats.totalEncaisse')}</div>
            <div className="v22-stat-val" style={{ color: tv.green }}>{formatPrice(totalRevenue, locale)}</div>
            <div className="v22-stat-delta v22-up">{completedBookings.length} {t('proDash.stats.interventionsTerminees')}</div>
          </div>
          <div className="v22-stat v22-stat-yellow">
            <div className="v22-stat-label">{t('proDash.stats.enAttenteEncaissement')}</div>
            <div className="v22-stat-val">{formatPrice(pendingBookings.reduce((s, b) => s + (b.price_ttc || 0), 0), locale)}</div>
            <div className="v22-stat-delta">{pendingBookings.length} {t('proDash.home.enAttente')}</div>
          </div>
          <div className="v22-stat">
            <div className="v22-stat-label">{t('proDash.stats.ticketMoyen')}</div>
            <div className="v22-stat-val">{formatPrice(bookings.reduce((s, b) => s + (b.price_ttc || 0), 0), locale)}</div>
            <div className="v22-stat-delta">{bookings.length} {t('proDash.clients.interventions')} {t('proDash.stats.auTotal')}</div>
          </div>
        </div>

        {bookings.length > 0 ? (
          <div className="v22-card">
            <div className="v22-card-head">
              <div className="v22-card-title">{'💰'} {t('proDash.stats.revenusTitle')}</div>
              <div className="v22-card-meta">{bookings.length} {t('proDash.clients.interventions')}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t('proDash.calendar.date')}</th>
                  <th>Service</th>
                  <th>{t('proDash.calendar.montantTTC')}</th>
                  <th>{t('proDash.motifs.colStatut')}</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>{b.booking_date}</td>
                    <td>{b.services?.name || 'Service'}</td>
                    <td>
                      <span className="v22-amount" style={{
                        color: b.status === 'completed' ? tv.green : b.status === 'pending' ? tv.primary : tv.textMuted
                      }}>
                        {b.status !== 'cancelled' ? `+${formatPrice(b.price_ttc || 0, locale)}` : '-'}
                      </span>
                    </td>
                    <td>
                      <span className={`v22-tag ${
                        b.status === 'completed' ? 'v22-tag-green' :
                        b.status === 'confirmed' ? 'v22-tag-yellow' :
                        b.status === 'pending' ? 'v22-tag-amber' :
                        'v22-tag-red'
                      }`}>
                        {b.status === 'completed' ? t('proDash.home.termine') :
                         b.status === 'confirmed' ? t('proDash.home.confirme') :
                         b.status === 'pending' ? t('proDash.home.enAttenteStat') :
                         t('proDash.home.annule')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="v22-card" style={{ padding: '40px', textAlign: 'center' }}>
            <span style={{ color: tv.textMuted, fontSize: '12px' }}>{t('proDash.home.aucuneActivite')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ExportHeader({ t }: { t: (k: string) => string }) {
  const tv = useThemeVars(false)
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const handleExport = async (type: 'clients' | 'bookings' | 'revenue') => {
    setLoading(type)
    setOpen(false)
    await downloadCsv(type, locale === 'pt' ? 'Erro ao exportar' : 'Erreur lors de l\'export')
    setLoading(null)
  }

  return (
    <div className="v22-page-header" style={{ justifyContent: 'space-between' }}>
      <div>
        <div className="v22-page-title">{'💰'} {t('proDash.stats.revenusTitle')}</div>
        <div className="v22-page-sub">{t('proDash.stats.revenusTitle')}</div>
      </div>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(!open)}
          disabled={loading !== null}
          className="v22-btn v22-btn-primary"
          style={{ opacity: loading ? 0.5 : 1 }}
        >
          {loading ? '⏳ ...' : `📊 ${t('proDash.stats.exporter')}`}
        </button>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
            <div className="v22-card" style={{
              position: 'absolute',
              right: 0,
              top: '40px',
              zIndex: 50,
              width: '220px',
              padding: '4px 0',
            }}>
              <button
                onClick={() => handleExport('clients')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 14px',
                  fontSize: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: tv.text,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = tv.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span>{'👥'}</span> {t('proDash.export.clients')}
              </button>
              <button
                onClick={() => handleExport('bookings')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 14px',
                  fontSize: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: tv.text,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = tv.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span>{'📋'}</span> {t('proDash.export.bookings')}
              </button>
              <button
                onClick={() => handleExport('revenue')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 14px',
                  fontSize: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: tv.text,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = tv.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span>{'💰'}</span> {t('proDash.export.revenue')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PageHeader({ title, subtitle, actionLabel, onAction }: { title: string; subtitle: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="v22-page-header" style={{ justifyContent: 'space-between' }}>
      <div>
        <div className="v22-page-title">{title}</div>
        <div className="v22-page-sub">{subtitle}</div>
      </div>
      <button onClick={onAction} className="v22-btn v22-btn-primary">
        {actionLabel}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   V5 sub-component — Stats for pro_societe
   Uses Supabase bookings when available, falls back to
   localStorage documents/chantiers for demo accounts.
   ═══════════════════════════════════════════════════════ */
interface LocalDoc { docType: string; docNumber?: string; docDate?: string; status?: string; total_ht_cents?: number; total_ttc_cents?: number; docTitle?: string; clientName?: string }
interface LocalExpense { amount?: string | number; date?: string; category?: string }

/**
 * Identifiant sous lequel le navigateur range les devis, factures, dépenses et chantiers lus ici :
 * **toujours `artisan.id`**, quel que soit le rôle.
 *
 * C'est la clé qu'écrivent les trois chemins du tableau de bord (`app/(commun)/pro/dashboard/page.tsx` : la fiche
 * `artisanData.id` pour un artisan, `user.id` pour un salarié invité comme pour un compte sans fiche — où `id`
 * vaut justement `user.id`), celle qu'hydrate `persistEmittedDocsToCache` depuis la base, celle qu'écrit la
 * Comptabilité pour les dépenses, et celle que lisent déjà Devis, Factures, Rapports et Rentabilité.
 *
 * Jusqu'au 26/11/2026, cet écran lisait `artisan.user_id` côté artisan — **une clé que rien n'écrit**, `id` étant
 * un `gen_random_uuid()` distinct de la référence vers `auth.users` (migration 052), et la route de création de
 * fiche n'écrivant jamais `id`. Statistiques et Revenus affichaient donc 0 pour tout artisan ayant une vraie
 * fiche, et cela depuis le **11/04/2026** (commit 38060a71, écrit pour les comptes de démonstration, où les deux
 * valeurs coïncident). L'audit du 11/11/2026 l'avait constaté sans le corriger (stockage-local-miroir-8) ;
 * Frédéric a demandé la correction le 26/11/2026.
 */
function idStockageLocal(artisan: import('@/lib/types').Artisan | undefined): string {
  return artisan?.id || ''
}

/**
 * Documents que cet écran doit prendre en compte. Une société BTP — gérant comme salarié invité — lit la liste du
 * tableau de bord, seule à porter les documents de la SOCIÉTÉ. Un artisan lit son propre stockage, désormais sous
 * la bonne clé (cf. `idStockageLocal`).
 *
 * La bascule de source reste réservée aux sociétés : règle n° 1, un fichier partagé conditionne son comportement.
 * Brancher la prop côté artisan aussi serait un changement de comportement à part — et il apporterait quelque
 * chose, contrairement à ce qu'une version de ce commentaire a prétendu : à la toute première vue de page, le
 * cache du navigateur peut être vide (navigation privée, poste neuf, cache effacé) et l'hydratation depuis la base
 * arrive après le rendu, sans recalcul puisque `documentsFournis` reste `undefined`. L'écran afficherait alors 0
 * un instant, ou durablement si le stockage est indisponible. À décider séparément.
 */
function documentsDuPerimetre(
  documents: readonly LocalDoc[] | undefined,
  orgRole?: OrgRole,
): readonly LocalDoc[] | undefined {
  return orgRole === 'pro_societe' ? documents : undefined
}

/**
 * Facture émise et non payée, pour TOUS les rôles depuis le 26/11/2026.
 *
 * Le tableau de bord recopie dans le navigateur les factures relues depuis la base avec le statut de la base
 * (lib/document-sync.ts) : « pending » y désigne la facture envoyée (« envoye »), comme dans la liste des factures.
 * La condition `orgRole === 'pro_societe'` n'avait de sens que tant qu'un artisan lisait une clé vide : maintenant
 * qu'il lit le cache hydraté depuis la base, sa facture passe de « envoye » à « pending » au premier rechargement
 * de page, et « Factures en attente » retombait à 0 € pendant que le taux de recouvrement, lui, la comptait. Deux
 * chiffres de la même carte se contredisaient selon qu'on venait d'émettre ou qu'on avait rechargé.
 */
function estFactureEnvoyee(statut: string | undefined): boolean {
  return statut === 'envoye' || statut === 'pending'
}

/**
 * Chiffres lus hors de la base : les documents, les dépenses et le nombre de chantiers.
 *
 * Les documents passent par `documentsPourSynthese` : la liste du tableau de bord si elle est arrivée (c'est le cas
 * d'un salarié invité, dont les documents sont ceux de la société et viennent du serveur), le stockage du navigateur
 * sinon. Recalculés à l'arrivée de la liste, puisqu'elle vient d'un appel réseau — l'ancienne lecture, faite une
 * seule fois dans un initialiseur de `useState`, ne l'aurait jamais vue.
 *
 * `avecBrouillons: false` : ces chiffres comptent des devis émis pour un taux de transformation. L'ancienne lecture
 * ne regardait que `fixit_documents_`, qui ne contient que les documents ÉMIS ; inclure les brouillons aurait fait
 * bouger le taux d'un artisan sans que personne l'ait demandé.
 *
 * Les dépenses et les chantiers restent lus dans le stockage : ce lot ne touche que les documents.
 */
function useLocalStats(artisanId: string, documentsFournis?: readonly LocalDoc[]) {
  const [expenses, setExpenses] = useState<LocalExpense[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`fixit_expenses_${artisanId}`)
      if (raw) setExpenses(JSON.parse(raw))
    } catch { /* navigation privée */ }
    // Les chantiers ne sont PLUS dans le navigateur : ils vivent en base (table `chantiers_btp`, lue par
    // `/api/btp?table=chantiers`). Jusqu'au 26/11/2026 cet écran lisait `chantiers_<id>` — sans le préfixe
    // `fixit_` — c'est-à-dire une clé que personne n'a jamais écrite ; et `fixit_chantiers_<id>`, la clé
    // préfixée, n'est plus écrite que par `ChantiersBTPSection`, un composant que la page ne monte plus (l'écran
    // Chantiers est `ChantiersBTPV2`, qui passe par la base) et par le seed de démonstration. Lire l'une ou
    // l'autre revenait au même : zéro. Le décompte vient donc du même endroit que l'écran Chantiers lui-même,
    // dans le composant — voir `chantiersActifs`.
  }, [artisanId])

  const docs = useMemo(
    () => documentsPourSynthese<LocalDoc>(documentsFournis, artisanId, false),
    [documentsFournis, artisanId],
  )

  return { docs, expenses }
}

function StatsV5({ bookings, totalRevenue, services, artisan, locale, orgRole, savedDocuments }: {
  bookings: import('@/lib/types').Booking[]
  totalRevenue: number
  services: import('@/lib/types').Service[]
  artisan: import('@/lib/types').Artisan
  locale: string
  orgRole?: OrgRole
  savedDocuments?: readonly LocalDoc[]
}) {
  const isPt = locale === 'pt'
  const aid = idStockageLocal(artisan)
  const { docs, expenses } = useLocalStats(aid, documentsDuPerimetre(savedDocuments, orgRole))

  // ── Chantiers actifs, lus là où les chantiers vivent : la base ─────────────
  // Même source que l'écran Chantiers (`ChantiersBTPV2`) et que l'accueil : `/api/btp?table=chantiers`, par le
  // cache partagé du hook. Cet écran cherchait `chantiers_<id>` dans le navigateur, une clé que personne n'a
  // jamais écrite ; et `fixit_chantiers_<id>`, la clé préfixée, n'est plus écrite que par un composant que la page
  // ne monte plus et par le seed de démonstration. Le repli affichait donc le nombre de DEVIS SIGNÉS sous
  // l'étiquette « Chantiers actifs ».
  //
  // Actifs = ni terminés ni annulés ; le complément plutôt qu'une liste blanche, pour qu'un statut inconnu compte
  // comme actif au lieu de disparaître. Le repli sur les devis signés ne sert plus qu'en l'absence de tout
  // chantier — le cas d'un artisan, qui n'a pas ce module.
  const idCompte = artisan?.user_id || artisan?.id || ''
  // `autoImport: false` : cet écran LIT. Le hook, par défaut, peut envoyer un POST d'import des anciennes
  // données du navigateur vers la base — une écriture déclenchée par l'ouverture d'un écran de synthèse, et
  // retentée à chaque montage si elle échoue. L'import appartient aux écrans qui gèrent les chantiers.
  const { items: chantiersBase } = useBTPData<{ statut?: string; status?: string }>({
    table: 'chantiers', artisanId: idCompte, userId: idCompte, orgRole, autoImport: false,
  })
  const chantiersActifs = useMemo(
    () => chantiersBase.filter(c => {
      const statut = String(c?.statut ?? c?.status ?? '')
      return statut !== 'Terminé' && statut !== 'Annulé'
    }).length,
    [chantiersBase],
  )

  // Merge data: prefer Supabase bookings, fall back to localStorage documents
  const hasBookings = bookings.length > 0
  // Les factures qui comptent dans un chiffre d'affaires : émises (les brouillons sont déjà hors de `docs`) et
  // NON ANNULÉES. Jusqu'au 26/11/2026 le graphe « CA mensuel » et le taux de recouvrement sommaient `factures`
  // sans filtre de statut : une facture annulée entrait donc dans le CA du mois et faisait baisser le
  // recouvrement, alors que le tableau des encaissements, juste à côté, l'écartait déjà. Deux chiffres du même
  // écran se contredisaient — invisible tant qu'un artisan lisait une clé vide.
  const devis = docs.filter(d => estDuType(d, 'devis') && !estAnnule(d))
  const factures = facturesDuChiffreAffaires(docs)
  const signedDevis = devis.filter(d => estDevisSigne(d.status))
  const paidFactures = factures.filter(d => estFacturePayee(d.status))

  // KPIs — computed from best available source
  const caTotal = hasBookings
    ? totalRevenue
    : paidFactures.reduce((s, f) => s + docRevenueHT(f), 0)
  const activeChantiers = hasBookings
    ? bookings.filter(b => b.status === 'confirmed' || b.status === 'pending').length
    // `chantiersBase.length > 0 ?` et non `chantiersActifs ||` : un décompte de ZÉRO est une réponse, pas une
    // absence de réponse. Avec le `||`, une société dont tous les chantiers sont terminés retombait dans le
    // repli et revoyait le nombre de devis signés sous l'étiquette « Chantiers actifs » — le défaut même que ce
    // correctif supprime. Idem au premier rendu, le cache du hook étant froid.
    : chantiersBase.length > 0 ? chantiersActifs : signedDevis.length
  const totalOffers = hasBookings ? bookings.length : devis.length
  const signedCount = hasBookings
    ? bookings.filter(b => b.status === 'completed').length
    : signedDevis.length
  const tauxTransformation = totalOffers > 0 ? Math.round((signedCount / totalOffers) * 100) : 0
  const panierMoyen = signedCount > 0 ? Math.round((hasBookings ? totalRevenue : signedDevis.reduce((s, d) => s + docRevenueHT(d), 0)) / signedCount) : 0

  // Monthly revenue for last 6 months
  const now = new Date()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const months: { label: string; value: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthLabel = d.toLocaleDateString(dateLocale, { month: 'short' })
    let rev = 0
    if (hasBookings) {
      rev = bookings.filter(b => {
        if (!b.booking_date) return false
        const bd = new Date(b.booking_date)
        return bd.getMonth() === d.getMonth() && bd.getFullYear() === d.getFullYear()
      }).reduce((s, b) => s + (b.price_ttc || 0), 0)
    } else {
      rev = factures.filter(f => {
        if (!f.docDate) return false
        const fd = new Date(f.docDate)
        return fd.getMonth() === d.getMonth() && fd.getFullYear() === d.getFullYear()
      }).reduce((s, f) => s + docRevenueHT(f), 0)
    }
    months.push({ label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), value: rev })
  }
  const maxMonthly = Math.max(...months.map(m => m.value), 1)

  // Pie chart data — from devis by client/project
  const pieColors = ['#FFC107', '#FF9800', '#4CAF50', '#2196F3', '#9C27B0', '#E91E63']
  const pieData: { label: string; value: number }[] = []
  if (hasBookings && services.length > 0) {
    services.filter(s => s.active).slice(0, 6).forEach(s => {
      const sRev = bookings.filter(b => b.services?.name === s.name).reduce((sum, b) => sum + (b.price_ttc || 0), 0)
      pieData.push({ label: s.name, value: sRev })
    })
  } else {
    signedDevis.slice(0, 6).forEach(d => {
      pieData.push({ label: d.docTitle?.replace(/^.*?—\s*/, '') || (isPt ? 'Obra' : 'Chantier'), value: docRevenueHT(d) })
    })
  }
  const pieTotal = pieData.reduce((s, p) => s + p.value, 0) || 1

  // Total dépenses
  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0)

  // Build conic-gradient from real data
  let gradientCss = ''
  let cumPct = 0
  pieData.forEach((p, i) => {
    const pct = Math.round((p.value / pieTotal) * 100)
    const start = cumPct
    cumPct += pct
    gradientCss += `${pieColors[i % pieColors.length]} ${start}% ${cumPct}%${i < pieData.length - 1 ? ',' : ''}`
  })
  if (!gradientCss) gradientCss = '#e0e0e0 0% 100%'

  return (
    <div className="v5-fade">
      <PilotageBanner />
      <div className="v5-pg-t"><h1>{isPt ? 'Estatísticas' : 'Statistiques'}</h1><p>{isPt ? 'Análise da atividade de construção' : 'Analyse de l\'activité BTP'}</p></div>

      {/* 4 KPIs */}
      <div className="v5-kpi-g">
        <div className="v5-kpi hl">
          <div className="v5-kpi-l">{isPt ? 'Faturação total' : 'CA facturé'}</div>
          <div className="v5-kpi-v">{formatPrice(caTotal, locale)}</div>
          <div className="v5-kpi-s">{paidFactures.length + factures.filter(f => estFactureEnvoyee(f.status)).length} {isPt ? 'faturas emitidas' : 'factures émises'}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{isPt ? 'Obras ativas' : 'Chantiers actifs'}</div>
          <div className="v5-kpi-v">{activeChantiers}</div>
          <div className="v5-kpi-s">{devis.length} {isPt ? 'orçamentos no total' : 'devis au total'}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{isPt ? 'Taxa de conversão' : 'Taux transformation'}</div>
          <div className="v5-kpi-v">{tauxTransformation}%</div>
          <div className="v5-kpi-s">{signedCount}/{totalOffers} {isPt ? 'orçamentos assinados' : 'devis signés'}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{isPt ? 'Valor médio' : 'Panier moyen'}</div>
          <div className="v5-kpi-v">{formatPrice(panierMoyen, locale)}</div>
          <div className="v5-kpi-s">{isPt ? 'por obra assinada' : 'par chantier signé'}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="v5-sg2">
        {/* Bar chart — CA mensuel 6 mois */}
        <div className="v5-card">
          <div className="v5-st">{isPt ? 'Faturação mensal (últimos 6 meses)' : 'CA mensuel — 6 derniers mois'}</div>
          <div className="ch-bar-c" style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, padding: '0 8px' }}>
            {months.map((m, i) => {
              const pct = maxMonthly > 0 ? Math.round((m.value / maxMonthly) * 100) : 0
              return (
                <div key={i} className="ch-bar-i" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="ch-bar" style={{
                    height: `${Math.max(pct, 5)}%`,
                    width: '100%',
                    maxWidth: 40,
                    background: 'var(--v5-primary-yellow)',
                    borderRadius: '3px 3px 0 0',
                    position: 'relative',
                    minHeight: 4,
                  }}>
                    <span className="ch-bar-v" style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {m.value >= 1000 ? `${Math.round(m.value / 1000)}k` : m.value > 0 ? `${m.value}` : ''}
                    </span>
                  </div>
                  <div className="ch-bar-lb" style={{ fontSize: 10, color: '#999', marginTop: 4 }}>{m.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pie chart — Répartition CA par chantier */}
        <div className="v5-card">
          <div className="v5-st">{isPt ? 'Distribuição da faturação por obra' : 'Répartition CA par chantier'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem 0' }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: `conic-gradient(${gradientCss})`,
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>
                {formatPrice(pieTotal, locale).replace(/\s/g, '')}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              {pieData.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: pieColors[i % pieColors.length], flexShrink: 0 }} />
                  <span style={{ color: '#666' }}>{p.label} — {formatPrice(p.value, locale)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dépenses + marges */}
      {totalExpenses > 0 && (
        <div className="v5-card" style={{ marginTop: 16 }}>
          <div className="v5-st">{isPt ? 'Síntese financeira' : 'Synthèse financière'}</div>
          <div style={{ display: 'flex', gap: 16, padding: '12px 0', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140, padding: '12px 16px', background: '#f0fdf4', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#666' }}>{isPt ? 'Faturação total' : 'CA facturé'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#2E7D32' }}>{formatPrice(caTotal, locale)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 140, padding: '12px 16px', background: '#fff7ed', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#666' }}>{isPt ? 'Despesas' : 'Dépenses'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#E65100' }}>{formatPrice(totalExpenses, locale)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 140, padding: '12px 16px', background: caTotal - totalExpenses > 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#666' }}>{isPt ? 'Margem bruta' : 'Marge brute'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: caTotal - totalExpenses > 0 ? '#2E7D32' : '#C62828' }}>
                {formatPrice(caTotal - totalExpenses, locale)} ({caTotal > 0 ? Math.round(((caTotal - totalExpenses) / caTotal) * 100) : 0}%)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   V5 sub-component — Revenus for pro_societe
   ═══════════════════════════════════════════════════════ */
function RevenusV5({ bookings, completedBookings, pendingBookings, totalRevenue, locale, t, artisan, orgRole, savedDocuments }: {
  bookings: import('@/lib/types').Booking[]
  completedBookings: import('@/lib/types').Booking[]
  pendingBookings: import('@/lib/types').Booking[]
  totalRevenue: number
  locale: string
  t: (k: string) => string
  artisan: import('@/lib/types').Artisan
  orgRole?: OrgRole
  savedDocuments?: readonly LocalDoc[]
}) {
  const aid = idStockageLocal(artisan)
  const { docs } = useLocalStats(aid, documentsDuPerimetre(savedDocuments, orgRole))
  const hasBookings = completedBookings.length > 0 || pendingBookings.length > 0

  // Mêmes règles que dans StatsV5 : une facture annulée n'est pas un chiffre d'affaires, et « pending » est
  // l'écriture en base de « envoye ».
  const factures = facturesDuChiffreAffaires(docs)
  const paidFactures = factures.filter(d => estFacturePayee(d.status))
  const pendingFactures = factures.filter(d => estFactureEnvoyee(d.status))

  const caYear = hasBookings ? totalRevenue : paidFactures.reduce((s, f) => s + docRevenueHT(f), 0)
  const pendingAmount = hasBookings
    ? pendingBookings.reduce((s, b) => s + (b.price_ttc || 0), 0)
    : pendingFactures.reduce((s, f) => s + docRevenueHT(f), 0)

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  let monthlyEncaissements = 0
  let monthlyCount = 0
  if (hasBookings) {
    const monthlyBk = completedBookings.filter(b => {
      if (!b.booking_date) return false
      const bd = new Date(b.booking_date)
      return bd.getMonth() === currentMonth && bd.getFullYear() === currentYear
    })
    monthlyEncaissements = monthlyBk.reduce((s, b) => s + (b.price_ttc || 0), 0)
    monthlyCount = monthlyBk.length
  } else {
    const monthlyFac = paidFactures.filter(f => {
      if (!f.docDate) return false
      const fd = new Date(f.docDate)
      return fd.getMonth() === currentMonth && fd.getFullYear() === currentYear
    })
    monthlyEncaissements = monthlyFac.reduce((s, f) => s + docRevenueHT(f), 0)
    monthlyCount = monthlyFac.length
  }

  const totalBilled = hasBookings
    ? bookings.reduce((s, b) => s + (b.price_ttc || 0), 0)
    : factures.reduce((s, f) => s + docRevenueHT(f), 0)
  const totalPaid = hasBookings ? totalRevenue : paidFactures.reduce((s, f) => s + docRevenueHT(f), 0)
  const recouvrementPct = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 100

  // Recent encaissements — from bookings or factures
  type EncRow = { date: string; client: string; chantier: string; amount: number }
  const recentRows: EncRow[] = []
  if (hasBookings) {
    completedBookings.filter(b => b.price_ttc && b.price_ttc > 0)
      .sort((a, b) => new Date(b.booking_date || '').getTime() - new Date(a.booking_date || '').getTime())
      .slice(0, 10)
      .forEach(b => recentRows.push({ date: b.booking_date || '', client: b.client_name || b.client_email || (locale === 'pt' ? 'Cliente' : 'Client'), chantier: b.services?.name || (locale === 'pt' ? 'Serviço' : 'Service'), amount: b.price_ttc || 0 }))
  } else {
    // Une facture n'est un encaissement qu'une fois PAYÉE, comme une réservation terminée ci-dessus : émise non
    // payée ou annulée, elle n'y figure pas.
    //
    // La condition de rôle a disparu le 26/11/2026, avec la correction de la clé de stockage. Côté artisan ce
    // tableau était VIDE — il lisait une clé que rien n'écrit — et le réveiller tel quel y aurait affiché toutes
    // ses factures, l'annulée et l'émise non payée comprises, en vert et précédées d'un « + », comme de l'argent
    // encaissé. Il n'y avait donc aucun comportement à préserver, seulement un affichage faux à ne pas créer.
    const encaissees = paidFactures
    encaissees.sort((a, b) => new Date(b.docDate || '').getTime() - new Date(a.docDate || '').getTime())
      .slice(0, 10)
      .forEach(f => recentRows.push({ date: f.docDate || '', client: f.clientName || (locale === 'pt' ? 'Cliente' : 'Client'), chantier: f.docTitle || (locale === 'pt' ? 'Fatura' : 'Facture'), amount: docRevenueHT(f) }))
  }

  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  return (
    <div className="v5-fade">
      <PilotageBanner />
      <div className="v5-pg-t"><h1>{t('proDash.stats.revenusTitle')}</h1><p>{t('proDash.stats.revenusSubtitle')}</p></div>

      {/* 4 KPIs */}
      <div className="v5-kpi-g">
        <div className="v5-kpi hl">
          <div className="v5-kpi-l">{t('proDash.stats.ca')} {currentYear}</div>
          <div className="v5-kpi-v">{formatPrice(caYear, locale)}</div>
          <div className="v5-kpi-s">{t('proDash.stats.cumule')}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{t('proDash.stats.encaissementsMois')} {now.toLocaleDateString(dateLocale, { month: 'long' })}</div>
          <div className="v5-kpi-v">{formatPrice(monthlyEncaissements, locale)}</div>
          <div className="v5-kpi-s">{monthlyCount} {monthlyCount > 1 ? t('proDash.stats.operations') : t('proDash.stats.operation')}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{t('proDash.stats.facturesEnAttente')}</div>
          <div className="v5-kpi-v">{formatPrice(pendingAmount, locale)}</div>
          <div className="v5-kpi-s">{hasBookings ? pendingBookings.length : pendingFactures.length} {(hasBookings ? pendingBookings.length : pendingFactures.length) > 1 ? t('proDash.stats.factures') : t('proDash.stats.facture')}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{t('proDash.stats.recouvrement')}</div>
          <div className="v5-kpi-v">{recouvrementPct}%</div>
          <div className="v5-kpi-s">{recouvrementPct >= 80 ? t('proDash.stats.bon') : recouvrementPct >= 60 ? t('proDash.stats.moyen') : t('proDash.stats.faible')}</div>
        </div>
      </div>

      {/* Encaissements récents table */}
      <div className="v5-card">
        <div className="v5-st">{t('proDash.stats.encaissementsRecents')}</div>
        <table className="v5-dt">
          <thead>
            <tr>
              <th>{t('proDash.stats.date')}</th>
              <th>{t('proDash.stats.client')}</th>
              <th>{t('proDash.stats.chantier')}</th>
              <th>{t('proDash.stats.montant')}</th>
            </tr>
          </thead>
          <tbody>
            {recentRows.length > 0 ? recentRows.map((r, i) => (
              <tr key={`v5-enc-${i}`}>
                <td>{r.date ? new Date(r.date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' }) : '-'}</td>
                <td>{r.client}</td>
                <td>{r.chantier}</td>
                <td style={{ fontWeight: 600, color: '#2E7D32' }}>+{formatPrice(r.amount, locale)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                  {t('proDash.home.aucuneActivite')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
