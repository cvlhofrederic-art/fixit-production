'use client'

import { useState, useEffect } from 'react'
import { formatPrice } from '@/lib/utils'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import type { Artisan, Booking, Service, SavedDocument } from '@/lib/types'
import { useThemeVars } from './useThemeVars'
import { useBTPData } from '@/lib/hooks/use-btp-data'
import { surActivationClavier } from '@/lib/a11y/activation-clavier'
import {
  alertesChantiers, chiffresChantiers, clientsAvecDevis, finDepassee, libelleDevisBrouillon, type DocumentAccueil,
} from '@/lib/btp/accueil'
import { nomDocumentPt } from '@/lib/wallet-conformite-pt'
import { docRevenueHT } from '@/lib/stats-doc-total'
import {
  documentsPourSynthese, estAnnule, estDevisRefuse, estDevisSigne, estDocumentEmis, estDuType, estFacturePayee,
} from '@/lib/documents/liste-effective'

interface HomeSectionProps {
  artisan: Artisan
  orgRole: 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'
  bookings: Booking[]
  services: Service[]
  pendingBookings: Booking[]
  completedBookings: Booking[]
  totalRevenue: number
  firstName: string
  navigateTo: (page: string) => void
  setShowNewRdv: (v: boolean) => void
  setShowDevisForm: (v: boolean) => void
  setShowFactureForm: (v: boolean) => void
  /** Callback unifié : ouvre le form devis vide (sans pré-remplissage par un ancien devis). */
  openDevisForm: (doc?: unknown) => void
  /** Callback unifié : ouvre le form facture vide (sans pré-remplissage par un ancien doc). */
  openFactureForm: (doc?: unknown) => void
  setActivePage: (page: string) => void
  setSidebarOpen: (v: boolean) => void
  openNewMotif: () => void
  /** Devis et factures chargés par la page (navigateur + base) : source des alertes de l'accueil BTP. */
  documentsEnregistres?: ReadonlyArray<DocumentAccueil>
}

function extractClientName(booking: Booking): string {
  const notes = booking.notes || ''
  // Pattern: "Client: Name|..." or "Client: Name."
  const match = notes.match(/Client:\s*([^|.]+)/)
  if (match) return match[1].trim()
  // Fallback: use service name or generic
  return booking.client_name || booking.services?.name || 'Client'
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return '??'
}

function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1)
  const days = Math.floor((d.getTime() - oneJan.getTime()) / 86400000)
  return Math.ceil((days + oneJan.getDay() + 1) / 7)
}

function formatRelativeTime(dateStr: string, locale: string): string {
  if (!dateStr) return ''
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  // Un écart NÉGATIF arrive pour de bon : la date d'un document est saisie à la main (elle peut être à venir),
  // et `new Date('2026-11-26')` vaut minuit UTC, donc un document du jour consulté avant 1 h du matin en France
  // donne un écart négatif. Sans cette garde, l'alerte affichait « il y a -1j ».
  if (diffDays < 0) return date.toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: '2-digit' })
  if (diffDays === 0) return locale === 'pt' ? 'Hoje' : "Aujourd'hui"
  if (diffDays === 1) return locale === 'pt' ? 'Ontem' : 'Hier'
  if (diffDays < 7) return locale === 'pt' ? `${diffDays}d atrás` : `il y a ${diffDays}j`
  return date.toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: '2-digit' })
}

export default function HomeSection({
  artisan,
  orgRole,
  bookings,
  services,
  pendingBookings,
  completedBookings,
  totalRevenue,
  firstName,
  navigateTo,
  setShowNewRdv,
  setShowDevisForm,
  setShowFactureForm,
  openDevisForm,
  openFactureForm,
  setActivePage,
  setSidebarOpen,
  openNewMotif,
  documentsEnregistres,
}: HomeSectionProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const tv = useThemeVars(true)

  const now = new Date()
  const weekNum = getWeekNumber(now)
  const monthYear = now.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })

  // Today's bookings for agenda
  const todayStr = now.toISOString().split('T')[0]
  const todayBookings = bookings.filter(b => b.booking_date === todayStr)

  // Conversion rate
  const totalReceived = pendingBookings.length + completedBookings.length
  const conversionRate = totalReceived > 0 ? Math.round((completedBookings.length / totalReceived) * 100) : 0

  // Devis from localStorage
  const [recentDevis, setRecentDevis] = useState<SavedDocument[]>([])
  const [alerts, setAlerts] = useState<Array<{ type: string; title: string; sub: string; time: string }>>([])
  const [btpAlerts, setBtpAlerts] = useState<Array<{ level: 'err' | 'warn' | 'info'; icon: string; text: string; page?: string }>>([])

  // BTP data for pro_societe — pulled from Supabase tables
  const userId = artisan?.user_id || artisan?.id || ''
  // orgRole : un chargement en échec n'est annoncé qu'au BTP pro ; l'accueil de l'artisan reste celui d'avant.
  const { items: btpChantiers } = useBTPData<{ id: string; titre: string; client: string; statut: string; budget: number; montant_facture: number; dateDebut: string; dateFin: string; adresse?: string; ville?: string; codePostal?: string; latitude?: number; longitude?: number; equipe: string; marge_prevue_pct: number; acompte_recu: number }>({ table: 'chantiers', artisanId: userId, userId, orgRole })
  const { items: btpMembres } = useBTPData<{ id: string; prenom: string; nom: string; type_compte: string; actif: boolean }>({ table: 'membres', artisanId: userId, userId, orgRole })
  const { items: btpDepenses } = useBTPData<{ id: string; amount: number; date: string; label: string; category: string }>({ table: 'depenses', artisanId: userId, userId, orgRole })
  const { items: btpSituations } = useBTPData<{ id: string; statut: string; montant_marche: number; chantier: string; travaux: any[] }>({ table: 'situations', artisanId: userId, userId, orgRole })

  // One-shot cleanup: purge fake data injected by the now-removed Démo button.
  // Demo entries have stable signatures (id prefix `demo-conv-`/`demo-devis-` for
  // convs/docs ; wallet entries with names 'RC Pro'/'KBIS'/'Décennale' and no url).
  useEffect(() => {
    if (typeof window === 'undefined' || !artisan?.id) return
    try {
      const convKey = `fixit_messagerie_convs_${artisan.id}`
      const rawConv = localStorage.getItem(convKey)
      if (rawConv) {
        const convs = JSON.parse(rawConv) as Array<{ id?: string }>
        const cleaned = convs.filter(c => !(typeof c.id === 'string' && c.id.startsWith('demo-conv-')))
        if (cleaned.length !== convs.length) localStorage.setItem(convKey, JSON.stringify(cleaned))
      }
      const docsKey = `fixit_docs_${artisan.id}`
      const rawDocs = localStorage.getItem(docsKey)
      if (rawDocs) {
        const docs = JSON.parse(rawDocs) as Array<{ id?: string }>
        const cleaned = docs.filter(d => !(typeof d.id === 'string' && d.id.startsWith('demo-devis-')))
        if (cleaned.length !== docs.length) localStorage.setItem(docsKey, JSON.stringify(cleaned))
      }
      const walletKey = `fixit_wallet_${artisan.id}`
      const rawWallet = localStorage.getItem(walletKey)
      if (rawWallet) {
        const wallet = JSON.parse(rawWallet) as Record<string, { name?: string; url?: string; uploadedAt?: string; expiryDate?: string }>
        const demoNames = new Set(['RC Pro', 'KBIS', 'Décennale'])
        const cleaned: typeof wallet = {}
        let dropped = false
        for (const [k, doc] of Object.entries(wallet)) {
          const isDemo = doc && !doc.url && !doc.uploadedAt && demoNames.has(doc.name || '')
          if (isDemo) dropped = true
          else cleaned[k] = doc
        }
        if (dropped) {
          if (Object.keys(cleaned).length === 0) localStorage.removeItem(walletKey)
          else localStorage.setItem(walletKey, JSON.stringify(cleaned))
        }
      }
    } catch { /* ignore */ }
  }, [artisan?.id])

  useEffect(() => {
    if (typeof window === 'undefined' || !artisan?.id) return
    try {
      // Les documents chargés par la page (navigateur ET base), avec repli sur le stockage pour un écran monté
      // avant la réponse du serveur. Pour un salarié invité, ce sont ceux de sa SOCIÉTÉ.
      //
      // Jusqu'au 26/11/2026 ce bloc lisait `fixit_docs_<id>` — une clé que plus aucun écran n'écrit depuis que
      // lib/btp/accueil.ts a repris les alertes. « Devis récents » et les deux alertes ci-dessous étaient donc
      // VIDES pour tout le monde, artisan comme société, et personne ne pouvait le voir : un bloc sans données
      // ressemble à un bloc sans sujet.
      //
      // Les filtres passent par les primitives partagées : ils testaient `d.type` (que la mise en forme ne pose
      // pas), le statut « payée » accentué (jamais écrit) et, pour un devis, « pending » ou « en_attente » (deux
      // statuts qui n'existent pas non plus). Même réveillé, ce bloc n'aurait rien montré de juste.
      {
        const docs = documentsPourSynthese<SavedDocument>(
          documentsEnregistres as readonly SavedDocument[] | undefined,
          artisan.id,
          true,
        )
        // Tri sur les champs que les documents portent VRAIMENT : `docDate` (posé par les formulaires et par la
        // relecture depuis la base), puis `savedAt` et `sentAt`. Jusqu'au 26/11/2026 le tri lisait `date` et
        // `created_at`, qu'aucune écriture ne pose : le comparateur rendait toujours 0, le tri était inopérant, et
        // « Devis récents » montrait le PLUS ANCIEN devis (le tri de JavaScript étant stable). Le bloc étant vide,
        // personne ne pouvait le voir.
        const quand = (d: SavedDocument) => d.docDate || d.savedAt || d.sentAt || d.date || d.created_at || ''
        // `docDate` est une JOURNÉE (« YYYY-MM-DD ») : pour deux devis du même jour — le quotidien d'une société —
        // la comparaison rend 0 et le tri, stable, laisserait le premier de la liste, c'est-à-dire le plus ancien.
        // D'où le départage par l'horodatage d'enregistrement ou d'envoi.
        const quandPrecis = (d: SavedDocument) => d.savedAt || d.sentAt || ''
        // Les brouillons sont écartés, comme pour les deux alertes plus bas : un brouillon n'est pas un devis
        // « récent » au sens de ce bloc, et le tableau de la mise en page V22 le rangerait en « Attente », ce qui
        // signifie « en attente de réponse du client ».
        const devisList = docs
          .filter((d) => estDuType(d, 'devis') && estDocumentEmis(d) && !estAnnule(d))
          .sort((a, b) => {
            const parJour = new Date(quand(b) || 0).getTime() - new Date(quand(a) || 0).getTime()
            if (parJour !== 0) return parJour
            return new Date(quandPrecis(b) || 0).getTime() - new Date(quandPrecis(a) || 0).getTime()
          })
          .slice(0, 5)
        setRecentDevis(devisList)

        // Generate alerts from data
        const alertItems: Array<{ type: string; title: string; sub: string; time: string }> = []
        // Factures émises, non annulées et non réglées.
        const unpaidInvoices = docs.filter((d) => estDuType(d, 'facture') && estDocumentEmis(d) && !estAnnule(d) && !estFacturePayee(d.status))
        unpaidInvoices.slice(0, 2).forEach((inv: SavedDocument) => {
          alertItems.push({
            type: 'red',
            title: locale === 'pt'
              ? `Fatura não paga: ${inv.client || inv.clientName || 'Cliente'}`
              : `Facture impayée — ${inv.client || inv.clientName || 'Client'}`,
            // `docNumber` d'abord : c'est la référence que les formulaires et la relecture depuis la base posent.
            // `ref` et `number` ne subsistent que sur de très anciens documents, et le montant se calcule depuis
            // les lignes — `total` et `amount` n'étaient posés par aucune écriture, donc cette ligne affichait
            // « — · 0 € » pour toute facture.
            sub: `${inv.docNumber || inv.ref || inv.number || '—'} · ${formatPrice(docRevenueHT(inv))}`,
            time: formatRelativeTime(quand(inv), locale),
          })
        })
        // Devis envoyés qui n'ont reçu ni acceptation ni refus. Un brouillon n'attend pas de réponse : il
        // n'a jamais été envoyé.
        const pendingDevis = docs.filter(
          (d) => estDuType(d, 'devis') && estDocumentEmis(d) && !estAnnule(d) && !estDevisSigne(d.status) && !estDevisRefuse(d.status),
        )
        pendingDevis.slice(0, 2).forEach((dv: SavedDocument) => {
          alertItems.push({
            type: 'amber',
            title: locale === 'pt'
              ? `Orçamento pendente: ${dv.client || dv.clientName || 'Cliente'}`
              : `Devis en attente — ${dv.client || dv.clientName || 'Client'}`,
            sub: `${dv.docNumber || dv.ref || dv.number || '—'} · ${locale === 'pt' ? 'sem resposta' : 'sans réponse'}`,
            time: formatRelativeTime(quand(dv), locale),
          })
        })
        setAlerts(alertItems)
      }
    } catch (erreur) {
      // Plus aucune lecture brute du navigateur ici : une erreur serait un défaut de calcul, pas un JSON abîmé.
      console.error('[accueil] devis récents et alertes documents non calculés', erreur)
    }
  }, [artisan?.id, locale, documentsEnregistres])

  // ── Aggregate BTP alerts from various sources (pro_societe only) ──
  useEffect(() => {
    if (typeof window === 'undefined' || !artisan?.id || orgRole !== 'pro_societe') return
    const isPt = locale === 'pt'
    const collected: Array<{ level: 'err' | 'warn' | 'info'; icon: string; text: string; page?: string }> = []

    // 1. Nouveaux messages / demandes client (conversations en cache)
    try {
      const rawConv = localStorage.getItem(`fixit_messagerie_convs_${artisan.id}`)
      if (rawConv) {
        const convs = JSON.parse(rawConv) as Array<{ unread_count?: number; other_user_name?: string; client_name?: string; participant_name?: string }>
        const unreadTotal = convs.reduce((s, c) => s + (c.unread_count || 0), 0)
        if (unreadTotal > 0) {
          const firstUnread = convs.find(c => (c.unread_count || 0) > 0)
          const name = firstUnread?.other_user_name || firstUnread?.client_name || firstUnread?.participant_name || 'client'
          collected.push({
            level: 'info',
            icon: '💬',
            text: isPt
              ? (unreadTotal === 1 ? `1 nova mensagem de ${name}` : `${unreadTotal} novas mensagens (incl. ${name})`)
              : (unreadTotal === 1 ? `1 nouveau message — ${name}` : `${unreadTotal} nouveaux messages (dont ${name})`),
            page: 'messages',
          })
        }
      }
    } catch { /* ignore */ }

    // 2. Chantiers finis (deadline dépassée) mais pas validés "Terminé" — ni annulés, et pas le dernier jour.
    // Les alertes 2, 2b, 2c et 2d se calculent sur les documents chargés par la page (lib/btp/accueil.ts) :
    // l'ancienne clé `fixit_docs_<id>` du navigateur n'est plus écrite par aucun écran.
    const now = Date.now()
    const documents = documentsEnregistres ?? []
    try {
      const alertesBtp = alertesChantiers(btpChantiers, documents, new Date(now))
      alertesBtp.enRetard.slice(0, 2).forEach(c => {
        collected.push({
          level: 'warn',
          icon: '🏁',
          text: isPt
            ? `${c.titre}: prazo excedido, validar como "Terminado"`
            : `${c.titre} — deadline dépassée, à valider "Terminé"`,
          page: 'chantiers',
        })
      })

      // 2b. Chantiers terminés mais aucune facture émise pour ce client
      // 2c. Devis en brouillon (faits mais pas envoyés)
      // 2d. Demandes client en attente de devis (booking pending sans devis pour ce client)
      alertesBtp.terminesSansFacture.slice(0, 2).forEach(c => {
        collected.push({
          level: 'err',
          icon: '🧾',
          text: isPt
            ? `${c.titre}: obra terminada, fatura não enviada (${c.client})`
            : `${c.titre} — chantier terminé, facture non envoyée (${c.client})`,
          page: 'factures',
        })
      })

      // 2c. Devis en statut brouillon (faits mais pas encore envoyés) ; sans numéro, aucune référence affichée
      alertesBtp.devisBrouillon.slice(0, 2).forEach(d => {
        collected.push({ level: 'warn', icon: '📝', text: libelleDevisBrouillon(d, isPt), page: 'devis' })
      })

      // 2d. Demandes client en attente sans aucun devis associé (par nom client)
      const devisClients = clientsAvecDevis(documents)
      const demandesSansDevis = pendingBookings.filter(b => {
        const clientKey = extractClientName(b).toLowerCase().trim()
        return clientKey && clientKey !== 'client' && !devisClients.has(clientKey)
      })
      demandesSansDevis.slice(0, 2).forEach(b => {
        const clientName = extractClientName(b)
        const service = b.services?.name || (isPt ? 'Intervenção' : 'Intervention')
        collected.push({
          level: 'info',
          icon: '📋',
          text: isPt
            ? `Orçamento a fazer: ${service} (${clientName})`
            : `Devis à faire — ${service} (${clientName})`,
          page: 'devis',
        })
      })
    } catch (erreur) {
      // Plus aucune lecture du navigateur ici : une erreur serait un défaut de calcul. Elle est journalisée, et les
      // autres alertes (messages, conformité) restent affichées au lieu de faire tomber tout l'accueil.
      console.error('[accueil BTP] alertes chantiers et documents non calculées', erreur)
    }

    // 3. Documents conformité qui expirent (< 60 jours) ou déjà expirés
    try {
      const rawWallet = localStorage.getItem(`fixit_wallet_${artisan.id}`)
      if (rawWallet) {
        const wallet = JSON.parse(rawWallet) as Record<string, { expiryDate?: string; name?: string }>
        const expiring: Array<{ key: string; name: string; days: number; expired: boolean }> = []
        Object.entries(wallet).forEach(([key, doc]) => {
          if (!doc?.expiryDate) return
          const diff = (new Date(doc.expiryDate).getTime() - now) / 86400000
          if (diff < 60) {
            expiring.push({ key, name: doc.name || key, days: Math.round(diff), expired: diff < 0 })
          }
        })
        expiring.sort((a, b) => a.days - b.days)
        expiring.slice(0, 2).forEach(d => {
          // En portugais, le nom du document de la Conformidade ; sinon (et en français) l'identifiant, comme avant.
          const label = (isPt ? nomDocumentPt(d.key) : null) ?? d.key.replace(/_/g, ' ')
          collected.push({
            level: d.expired ? 'err' : 'warn',
            icon: '📁',
            text: d.expired
              ? (isPt ? `${label}: expirou há ${Math.abs(d.days)} ${Math.abs(d.days) === 1 ? 'dia' : 'dias'}` : `${label} — expiré depuis ${Math.abs(d.days)}j`)
              : (isPt ? `${label}: expira em ${d.days} ${d.days === 1 ? 'dia' : 'dias'}` : `${label} — expire dans ${d.days}j`),
            page: 'wallet',
          })
        })
      }
    } catch { /* ignore */ }

    setBtpAlerts(collected)
  }, [artisan?.id, orgRole, btpChantiers, pendingBookings, locale, documentsEnregistres])

  // ═══════════════════════════════════════════════════════
  // V5 RENDER — pro_societe + artisan use the v5 design system
  // ═══════════════════════════════════════════════════════

  if (orgRole === 'pro_societe' || orgRole === 'artisan') {

    // === pro_societe: compute KPIs from BTP tables ===
    const isSociete = orgRole === 'pro_societe'
    const chantiersActifs = isSociete ? btpChantiers.filter(c => c.statut === 'En cours') : []
    const chantiersAttente = isSociete ? btpChantiers.filter(c => c.statut === 'En attente') : []

    // Palette Gantt — même ordre, même filtre (cf. GanttSection.tsx) pour matcher trait pour trait
    const GANTT_PALETTE = ['#42A5F5', '#66BB6A', '#FFA726', '#FFCA28', '#AB47BC', '#EF5350', '#42A5F5']
    const ganttChantiers = isSociete ? btpChantiers.filter(c => c.dateDebut && c.dateFin && c.statut !== 'Terminé') : []
    const colorForChantierId = (id: string): string => {
      const idx = ganttChantiers.findIndex(c => c.id === id)
      return idx >= 0 ? GANTT_PALETTE[idx % GANTT_PALETTE.length] : '#BDBDBD'
    }
    const computeAvancement = (debut: string, fin: string): number => {
      const s = new Date(debut).getTime(), e = new Date(fin).getTime(), n = Date.now()
      if (!debut || !fin || isNaN(s) || isNaN(e) || e <= s) return 0
      if (n <= s) return 0
      if (n >= e) return 100
      return Math.round(((n - s) / (e - s)) * 100)
    }
    // BTP : budgets convertis en nombres avant l'addition (le hook les livre en texte), chantiers annulés écartés ;
    // acomptes et marge valent null quand aucun chantier n'en porte, et s'affichent « — » (lib/btp/accueil.ts).
    const chiffresBtp = chiffresChantiers(isSociete ? btpChantiers : [])
    const totalBudget = isSociete ? chiffresBtp.caTotal : totalRevenue
    const totalAcomptes = chiffresBtp.acomptes
    const totalDepenses = isSociete ? btpDepenses.reduce((s, d) => s + (Number(d.amount) || 0), 0) : 0
    const membresActifs = btpMembres.filter(m => m.actif !== false)
    const margeMoyenne = chiffresBtp.margeMoyenne

    const urgentCount = isSociete ? chantiersAttente.length : pendingBookings.filter(b => b.notes?.toLowerCase().includes('urgent')).length

    return (
      <div className="v5-fade">
        <div className="v5-pg-t" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <h1>{locale === 'pt' ? 'Painel' : 'Tableau de bord'}</h1>
            <p>{locale === 'pt' ? `${artisan?.company_name || 'Empresa'} · Semana ${weekNum}, ${monthYear}` : <>{artisan?.company_name || 'Entreprise'} — Semaine {weekNum}, {monthYear}</>}</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="v5-btn v5-btn-p v5-btn-sm" onClick={() => { setActivePage('devis'); setSidebarOpen(false); setTimeout(() => openDevisForm(), 50) }}>+ {locale === 'pt' ? 'Novo orçamento' : 'Nouveau devis'}</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="v5-kpi-g">
          {isSociete ? (<>
            <div className="v5-kpi hl" style={{ cursor: 'pointer' }} onClick={() => navigateTo('chantiers')}>
              <div className="v5-kpi-l">{locale === 'pt' ? 'Obras ativas' : 'Chantiers actifs'}</div>
              <div className="v5-kpi-v">{chantiersActifs.length}</div>
              <div className="v5-kpi-s">{chantiersAttente.length > 0 ? `+ ${chantiersAttente.length} ${locale === 'pt' ? 'em espera' : 'en attente'}` : `${btpChantiers.length} total`}</div>
            </div>
            <div className="v5-kpi" style={{ cursor: 'pointer' }} role="button" tabIndex={0} onClick={() => navigateTo('compta_btp')} onKeyDown={surActivationClavier(() => navigateTo('compta_btp'))}>
              <div className="v5-kpi-l">{locale === 'pt' ? 'Faturação total das obras' : 'CA total chantiers'}</div>
              <div className="v5-kpi-v">{formatPrice(totalBudget)}</div>
              <div className="v5-kpi-s">{locale === 'pt' ? 'Adiantamentos:' : 'Acomptes :'} {totalAcomptes === null ? '—' : formatPrice(totalAcomptes)}</div>
            </div>
            <div className="v5-kpi" style={{ cursor: 'pointer' }} onClick={() => navigateTo('rentabilite')}>
              <div className="v5-kpi-l">{locale === 'pt' ? 'Margem média' : 'Marge moyenne'}</div>
              <div className="v5-kpi-v">{margeMoyenne === null ? '—' : `${margeMoyenne}%`}</div>
              <div className="v5-kpi-s">{locale === 'pt' ? 'Objetivo:' : 'Objectif :'} 25%</div>
            </div>
            <div className="v5-kpi" style={{ cursor: 'pointer' }} onClick={() => navigateTo('equipes')}>
              <div className="v5-kpi-l">{locale === 'pt' ? 'Colaboradores' : 'Effectif'}</div>
              <div className="v5-kpi-v">{membresActifs.length}</div>
              <div className="v5-kpi-s">{(() => {
                const chefs = membresActifs.filter(m => m.type_compte === 'chef_chantier').length
                const ouvriers = membresActifs.filter(m => m.type_compte === 'ouvrier').length
                return locale === 'pt'
                  ? `${chefs} ${chefs === 1 ? 'encarregado' : 'encarregados'} + ${ouvriers} ${ouvriers === 1 ? 'operário' : 'operários'}`
                  : `${chefs} chefs + ${ouvriers} ouvriers`
              })()}</div>
            </div>
          </>) : (<>
            <div className="v5-kpi hl" style={{ cursor: 'pointer' }} onClick={() => navigateTo('calendar')}>
              <div className="v5-kpi-l">{locale === 'pt' ? 'Pedidos pendentes' : 'Demandes en attente'}</div>
              <div className="v5-kpi-v">{pendingBookings.length}</div>
              <div className="v5-kpi-s">{urgentCount > 0 ? `→ ${urgentCount} urgentes` : (locale === 'pt' ? 'em dia' : 'à jour')}</div>
            </div>
            <div className="v5-kpi" style={{ cursor: 'pointer' }} onClick={() => navigateTo('revenus')}>
              <div className="v5-kpi-l">{locale === 'pt' ? 'Faturação mensal' : 'CA ce mois'}</div>
              <div className="v5-kpi-v">{formatPrice(totalRevenue)}</div>
              <div className="v5-kpi-s">↑ {completedBookings.length} {locale === 'pt' ? 'terminadas' : 'chantiers livrés'}</div>
            </div>
            <div className="v5-kpi" style={{ cursor: 'pointer' }} onClick={() => navigateTo('stats')}>
              <div className="v5-kpi-l">{locale === 'pt' ? 'Nota média' : 'Note moyenne'}</div>
              <div className="v5-kpi-v">{artisan?.rating_avg || '5.0'} ★</div>
              <div className="v5-kpi-s">{locale === 'pt' ? 'em' : 'sur'} {artisan?.rating_count || 0} {locale === 'pt' ? 'avaliações' : 'avis'}</div>
            </div>
            <div className="v5-kpi" style={{ cursor: 'pointer' }} onClick={() => navigateTo('stats')}>
              <div className="v5-kpi-l">{locale === 'pt' ? 'Taxa de conversão' : 'Taux conversion'}</div>
              <div className="v5-kpi-v">{conversionRate}%</div>
              <div className="v5-kpi-s">{completedBookings.length}/{totalReceived}</div>
            </div>
          </>)}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1.2fr] gap-3 mb-5">
          {/* Chantiers en cours / Demandes */}
          <div className="v5-card">
            <div className="v5-st" style={{ display: 'flex', alignItems: 'center' }}>
              {isSociete ? (locale === 'pt' ? 'Obras em curso' : 'Chantiers en cours') : (locale === 'pt' ? 'Pedidos recebidos' : 'Demandes reçues')}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#999', cursor: 'pointer' }} onClick={() => navigateTo(isSociete ? 'chantiers' : 'calendar')}>{locale === 'pt' ? 'Ver tudo →' : 'Voir tout →'}</span>
            </div>
            {isSociete ? (
              chantiersActifs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: 12, color: '#BBB' }}>{locale === 'pt' ? 'Sem obras em curso' : 'Aucun chantier en cours'}</div>
              ) : (
                <table className="v5-dt">
                  <thead><tr><th>{locale === 'pt' ? 'Obra' : 'Chantier'}</th><th>{locale === 'pt' ? 'Encarregado' : 'Chef'}</th><th>{locale === 'pt' ? 'Progresso' : 'Avancement'}</th><th>{locale === 'pt' ? 'Prazo' : 'Deadline'}</th></tr></thead>
                  <tbody>
                    {chantiersActifs.slice(0, 5).map(c => {
                      const color = colorForChantierId(c.id)
                      const avc = computeAvancement(c.dateDebut, c.dateFin)
                      // Même règle que l'alerte « deadline dépassée » : le dernier jour n'est pas un retard.
                      const isRetard = finDepassee(c.dateFin, now)
                      const deadlineLabel = c.dateFin ? new Date(c.dateFin).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' }) : '—'
                      return (
                        <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigateTo('chantiers')}>
                          <td style={{ fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isRetard ? '#C62828' : undefined }}>
                            {c.titre}{isRetard ? ' ⚠️' : ''}
                          </td>
                          <td style={{ fontSize: 11 }}>{c.equipe || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#EEE', minWidth: 60 }}>
                                <div style={{ width: `${avc}%`, height: '100%', borderRadius: 3, background: color }} />
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 600, minWidth: 28 }}>{avc}%</span>
                            </div>
                          </td>
                          <td style={{ fontSize: 11 }}>{deadlineLabel}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            ) : (
              pendingBookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: 12, color: '#BBB' }}>{locale === 'pt' ? 'Nenhum pedido pendente' : 'Aucune demande en attente'}</div>
              ) : (
                <table className="v5-dt">
                  <thead><tr><th>{locale === 'pt' ? 'Cliente' : 'Client'}</th><th>{locale === 'pt' ? 'Serviço' : 'Service'}</th><th>{locale === 'pt' ? 'Estado' : 'Statut'}</th></tr></thead>
                  <tbody>
                    {pendingBookings.slice(0, 5).map(b => {
                      const clientName = extractClientName(b)
                      const isUrgent = b.notes?.toLowerCase().includes('urgent')
                      return (
                        <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => navigateTo('calendar')}>
                          <td style={{ fontWeight: 600 }}>{clientName}</td>
                          <td>{b.services?.name || (locale === 'pt' ? 'Intervenção' : 'Intervention')}</td>
                          <td><span className={`v5-badge ${isUrgent ? 'v5-badge-red' : 'v5-badge-orange'}`}>{isUrgent ? (locale === 'pt' ? 'Urgente' : 'Urgent') : (locale === 'pt' ? 'Pendente' : 'En attente')}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            )}
          </div>

          {/* Planning semaine / Agenda */}
          <div className="v5-card">
            <div className="v5-st">{isSociete ? (locale === 'pt' ? 'Planeamento da semana' : 'Planning semaine') : (locale === 'pt' ? 'Agenda de hoje' : 'Planning semaine')}</div>
            {isSociete ? (() => {
              // Aggrège les jalons des 7 prochains jours : débuts / fins de chantiers + RDVs du calendrier
              const DAY_LABELS = locale === 'pt' ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] : ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
              const DAY_COLORS = [
                { bg: '#E3F2FD', fg: '#1565C0' },
                { bg: '#E8F5E9', fg: '#2E7D32' },
                { bg: '#FFF3E0', fg: '#E65100' },
                { bg: '#F3E5F5', fg: '#7B1FA2' },
                { bg: '#E0F7FA', fg: '#00838F' },
                { bg: '#FCE4EC', fg: '#AD1457' },
                { bg: '#FFF8E1', fg: '#F57F17' },
              ]
              const today = new Date(); today.setHours(0, 0, 0, 0)
              const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7)
              type Milestone = { date: Date; day: number; label: string; text: string }
              const items: Milestone[] = []
              btpChantiers.forEach(c => {
                if (c.dateDebut) {
                  const d = new Date(c.dateDebut); d.setHours(0, 0, 0, 0)
                  if (d >= today && d < weekEnd) items.push({ date: d, day: d.getDay(), label: DAY_LABELS[d.getDay()], text: locale === 'pt' ? `Arranque: ${c.titre}` : `Démarrage — ${c.titre}` })
                }
                if (c.dateFin) {
                  const d = new Date(c.dateFin); d.setHours(0, 0, 0, 0)
                  if (d >= today && d < weekEnd) items.push({ date: d, day: d.getDay(), label: DAY_LABELS[d.getDay()], text: locale === 'pt' ? `Entrega: ${c.titre}` : `Livraison — ${c.titre}` })
                }
              })
              bookings.forEach(b => {
                if (!b.booking_date) return
                const d = new Date(b.booking_date); d.setHours(0, 0, 0, 0)
                if (d >= today && d < weekEnd) {
                  items.push({ date: d, day: d.getDay(), label: DAY_LABELS[d.getDay()], text: locale === 'pt' ? `${b.services?.name || 'Marcação'} · ${extractClientName(b)}` : `${b.services?.name || 'RDV'} — ${extractClientName(b)}` })
                }
              })
              items.sort((a, b) => a.date.getTime() - b.date.getTime())
              if (items.length === 0) return <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: 12, color: '#BBB' }}>{locale === 'pt' ? 'Nada previsto esta semana' : 'Rien de prévu cette semaine'}</div>
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {items.slice(0, 6).map((it, i) => {
                    const c = DAY_COLORS[it.day]
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => navigateTo('gantt')}>
                        <div style={{ background: c.bg, color: c.fg, padding: '3px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{it.label}</div>
                        <div style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.text}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })() : (
              todayBookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: 12, color: '#BBB' }}>{locale === 'pt' ? 'Nada agendado para hoje' : "Rien de prévu aujourd'hui"}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {todayBookings.slice(0, 5).map(b => {
                    const clientName = extractClientName(b)
                    const dayName = new Date(b.booking_date || '').toLocaleDateString(dateLocale, { weekday: 'short' })
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => navigateTo('calendar')}>
                        <div style={{ background: '#E3F2FD', color: '#1565C0', padding: '3px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: 'capitalize' as const }}>{dayName}</div>
                        <div style={{ fontSize: 11 }}>{locale === 'pt' ? `${b.services?.name || 'Marcação'} · ${clientName}` : <>{b.services?.name || 'RDV'} — {clientName}</>}</div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </div>

          {/* Alertes BTP / Alertes */}
          <div className="v5-card">
            <div className="v5-st">{isSociete ? (locale === 'pt' ? 'Alertas de obra' : 'Alertes BTP') : (locale === 'pt' ? 'Alertas' : 'Alertes')}</div>
            {isSociete ? (
              btpAlerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: 12, color: '#BBB' }}>{locale === 'pt' ? 'Nenhum alerta' : 'Aucune alerte'}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {btpAlerts.slice(0, 6).map((a, i) => (
                    <div
                      key={i}
                      className={`v5-al ${a.level}`}
                      style={{ cursor: a.page ? 'pointer' : 'default' }}
                      onClick={() => a.page && navigateTo(a.page)}
                    >
                      {a.icon} {a.text}
                    </div>
                  ))}
                </div>
              )
            ) : (
              alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: 12, color: '#BBB' }}>{locale === 'pt' ? 'Nenhum alerta' : 'Aucune alerte'}</div>
              ) : (
                alerts.map((a, i) => (
                  <div key={i} className={`v5-al ${a.type === 'red' ? 'err' : 'warn'}`}>{a.title}</div>
                ))
              )
            )}
          </div>
        </div>

        {/* Bottom: 3 summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {isSociete ? (<>
            <div className="v5-card" style={{ textAlign: 'center', padding: '.85rem', cursor: 'pointer' }} onClick={() => navigateTo('situations')}>
              <div className="v5-st">{locale === 'pt' ? 'Autos de medição' : 'Situations de travaux'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, margin: '.4rem 0' }}>{btpSituations.length}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{btpSituations.filter(s => s.statut === 'validée' || s.statut === 'payée').length} {locale === 'pt' ? 'validadas / pagas' : 'validées / payées'}</div>
            </div>
            <div className="v5-card" style={{ textAlign: 'center', padding: '.85rem', cursor: 'pointer' }} role="button" tabIndex={0} onClick={() => navigateTo('rentabilite')} onKeyDown={surActivationClavier(() => navigateTo('rentabilite'))}>
              <div className="v5-st">{locale === 'pt' ? 'Despesas' : 'Dépenses'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, margin: '.4rem 0' }}>{btpDepenses.length}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{formatPrice(totalDepenses)} total</div>
            </div>
            <div className="v5-card" style={{ textAlign: 'center', padding: '.85rem', cursor: 'pointer' }} role="button" tabIndex={0} onClick={() => navigateTo('portail_client')} onKeyDown={surActivationClavier(() => navigateTo('portail_client'))}>
              <div className="v5-st">{locale === 'pt' ? 'Clientes' : 'Clients'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, margin: '.4rem 0' }}>{new Set(btpChantiers.map(c => c.client)).size}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{btpChantiers.length} {locale === 'pt' ? 'obras' : 'chantiers'}</div>
            </div>
          </>) : (<>
            <div className="v5-card" style={{ textAlign: 'center', padding: '.85rem' }}>
              <div className="v5-st">{locale === 'pt' ? 'Últimas avaliações' : 'Derniers avis'}</div>
              <div style={{ fontSize: 13, fontWeight: 600, margin: '.4rem 0' }}>{artisan?.rating_avg || '5.0'} / 5</div>
              <div style={{ fontSize: 11, color: '#888' }}>{artisan?.rating_count || 0} {locale === 'pt' ? 'avaliações' : 'avis'}</div>
            </div>
            <div className="v5-card" style={{ textAlign: 'center', padding: '.85rem', cursor: 'pointer' }} onClick={() => navigateTo('messages')}>
              <div className="v5-st">{locale === 'pt' ? 'Mensagens' : 'Messagerie'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, margin: '.4rem 0' }}>{pendingBookings.length}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{locale === 'pt' ? 'conversas' : 'conversations'}</div>
            </div>
            <div className="v5-card" style={{ textAlign: 'center', padding: '.85rem', cursor: 'pointer' }} onClick={() => navigateTo('devis')}>
              <div className="v5-st">{locale === 'pt' ? 'Orçamentos recentes' : 'Devis récents'}</div>
              <div style={{ fontSize: 12, fontWeight: 600, margin: '.4rem 0' }}>{recentDevis.length > 0 ? (recentDevis[0].docNumber || recentDevis[0].ref || recentDevis[0].number || '—') : '—'}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{recentDevis.length > 0 ? `${recentDevis[0].client || recentDevis[0].clientName || ''}${locale === 'pt' ? ' · ' : ' — '}${formatPrice(docRevenueHT(recentDevis[0]))}` : (locale === 'pt' ? 'Nenhum orçamento' : 'Aucun devis')}</div>
            </div>
          </>)}
        </div>

        {/* Actions rapides */}
        <div className="v5-st" style={{ marginBottom: '.5rem' }}>{t('proDash.home.actionsRapides')}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {orgRole === 'artisan' ? (<>
            <button className="v5-act-btn primary" onClick={() => { setShowNewRdv(true); navigateTo('calendar') }}><span style={{ fontSize: 18 }}>📅</span><span>{t('proDash.home.nouvelRdv')}</span></button>
            <button className="v5-act-btn" onClick={() => { setActivePage('devis'); setSidebarOpen(false); setTimeout(() => openDevisForm(), 50) }}><span style={{ fontSize: 18 }}>📄</span><span>{t('proDash.home.creerDevis')}</span></button>
            <button className="v5-act-btn" onClick={() => { setActivePage('factures'); setSidebarOpen(false); setTimeout(() => openFactureForm(), 50) }}><span style={{ fontSize: 18 }}>🧾</span><span>{t('proDash.home.nouvelleFacture')}</span></button>
            <button className="v5-act-btn" onClick={() => { openNewMotif(); navigateTo('motifs') }}><span style={{ fontSize: 18 }}>🔧</span><span>{t('proDash.home.nouveauMotif')}</span></button>
          </>) : (<>
            <button className="v5-act-btn primary" onClick={() => navigateTo('equipes')}><span style={{ fontSize: 18 }}>👷</span><span>{t('proDash.home.nouvelleEquipe')}</span></button>
            <button className="v5-act-btn" onClick={() => navigateTo('chantiers')}><span style={{ fontSize: 18 }}>🏗️</span><span>{t('proDash.home.nouveauChantier')}</span></button>
            <button className="v5-act-btn" onClick={() => { setActivePage('devis'); setSidebarOpen(false); setTimeout(() => openDevisForm(), 50) }}><span style={{ fontSize: 18 }}>📄</span><span>{t('proDash.home.creerDevis')}</span></button>
            <button className="v5-act-btn" onClick={() => { setActivePage('factures'); setSidebarOpen(false); setTimeout(() => openFactureForm(), 50) }}><span style={{ fontSize: 18 }}>💰</span><span>{t('proDash.home.nouvelleFacture')}</span></button>
          </>)}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════
  // V22 RENDER — artisan, conciergerie, gestionnaire
  // ═══════════════════════════════════════════════════════
  return (
    <div className="animate-fadeIn">
      {/* ── Page Header ── */}
      <div className="v22-page-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div className="v22-page-title">{locale === 'pt' ? 'Painel' : 'Tableau de bord'}</div>
          <div className="v22-page-sub">{locale === 'pt' ? 'Semana' : 'Semaine'} {weekNum} · {monthYear}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="v22-btn v22-btn-sm" onClick={() => navigateTo('stats')}>
            {locale === 'pt' ? 'Exportar' : 'Exporter'}
          </button>
          <button className="v22-btn v22-btn-primary v22-btn-sm" onClick={() => { setActivePage('devis'); setSidebarOpen(false); setTimeout(() => openDevisForm(), 50) }}>
            + {locale === 'pt' ? 'Novo orçamento' : 'Nouveau devis'}
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="v22-stats">
        <div className="v22-stat v22-stat-yellow" style={{ cursor: 'pointer' }} onClick={() => navigateTo('calendar')}>
          <div className="v22-stat-label">{locale === 'pt' ? 'Pedidos pendentes' : 'Demandes en attente'}</div>
          <div className="v22-stat-val">{pendingBookings.length}</div>
          <div className="v22-stat-delta">→ {pendingBookings.filter(b => b.notes?.toLowerCase().includes('urgent')).length} {locale === 'pt' ? 'urgentes' : 'urgentes'}</div>
        </div>
        <div className="v22-stat" style={{ cursor: 'pointer' }} onClick={() => navigateTo('revenus')}>
          <div className="v22-stat-label">{locale === 'pt' ? 'Faturação mensal' : 'CA ce mois'}</div>
          <div className="v22-stat-val">{formatPrice(totalRevenue)}</div>
          <div className="v22-stat-delta v22-up">↑ {completedBookings.length} {locale === 'pt' ? 'terminadas' : t('proDash.home.terminees')}</div>
        </div>
        <div className="v22-stat" style={{ cursor: 'pointer' }} onClick={() => navigateTo('stats')}>
          <div className="v22-stat-label">{locale === 'pt' ? 'Nota média' : 'Note moyenne'}</div>
          <div className="v22-stat-val">{artisan?.rating_avg || '5.0'} ★</div>
          <div className="v22-stat-delta" style={{ color: tv.textMuted }}>{locale === 'pt' ? 'em' : 'sur'} {artisan?.rating_count || 0} {locale === 'pt' ? 'avaliações' : 'avis'}</div>
        </div>
        <div className="v22-stat" style={{ cursor: 'pointer' }} onClick={() => navigateTo('stats')}>
          <div className="v22-stat-label">{locale === 'pt' ? 'Taxa de conversão' : 'Taux conversion'}</div>
          <div className="v22-stat-val">{conversionRate}%</div>
          <div className="v22-stat-delta v22-up">{completedBookings.length}/{totalReceived}</div>
        </div>
      </div>

      {/* ── Grid Main: Demandes + (Agenda + Alertes) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', marginBottom: '16px' }}>
        {/* LEFT: Demandes reçues */}
        <div className="v22-card">
          <div className="v22-card-head" style={{ display: 'flex', alignItems: 'center' }}>
            <div className="v22-card-title">{locale === 'pt' ? 'Pedidos recebidos' : 'Demandes reçues'}</div>
            <span className="v22-tag v22-tag-yellow" style={{ marginLeft: 'auto' }}>{pendingBookings.length} {locale === 'pt' ? 'pendentes' : 'en attente'}</span>
            <button className="v22-btn v22-btn-sm" style={{ marginLeft: '8px', border: 'none', background: 'none', color: tv.textMuted, cursor: 'pointer', fontSize: '11px' }} onClick={() => navigateTo('calendar')}>
              {locale === 'pt' ? 'Ver tudo →' : 'Voir tout →'}
            </button>
          </div>
          <div className="v22-card-body" style={{ padding: 0 }}>
            {pendingBookings.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: tv.textMuted }}>
                {locale === 'pt' ? 'Nenhum pedido pendente' : 'Aucune demande en attente'}
              </div>
            ) : (
              pendingBookings.slice(0, 6).map((b) => {
                const clientName = extractClientName(b)
                const initials = getInitials(clientName)
                const isUrgent = b.notes?.toLowerCase().includes('urgent')
                const desc = b.services?.name || (b as unknown as { service_name?: string }).service_name || 'Intervention'
                const time = b.booking_time?.substring(0, 5) || formatRelativeTime(b.created_at || b.booking_date || '', locale)
                return (
                  <div
                    key={b.id}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderBottom: `1px solid ${tv.border}`, cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF7')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                    onClick={() => navigateTo('calendar')}
                  >
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: tv.primaryLight, border: `1px solid ${tv.primaryBorder}`, color: '#7A6000', fontSize: '10px', fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '12px', color: tv.text }}>{clientName}</div>
                      <div style={{ fontSize: '11px', color: tv.textMuted, marginTop: '1px' }}>{desc}{b.address ? ` · ${b.address}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      <span className="v22-ref">{time}</span>
                      <span className={`v22-tag ${isUrgent ? 'v22-tag-red' : 'v22-tag-amber'}`}>{isUrgent ? (locale === 'pt' ? 'Urgente' : 'Urgente') : (locale === 'pt' ? 'Pendente' : 'En attente')}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT: Agenda + Alertes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Agenda du jour */}
          <div className="v22-card">
            <div className="v22-card-head" style={{ display: 'flex', alignItems: 'center' }}>
              <div className="v22-card-title">{locale === 'pt' ? 'Agenda de hoje' : 'Agenda du jour'}</div>
              <button className="v22-btn v22-btn-sm" style={{ marginLeft: 'auto', border: 'none', background: 'none', color: tv.textMuted, cursor: 'pointer', fontSize: '11px' }} onClick={() => navigateTo('calendar')}>
                {locale === 'pt' ? 'Ver tudo →' : 'Voir tout →'}
              </button>
            </div>
            <div className="v22-card-body">
              {todayBookings.length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: '12px', color: tv.textMuted, padding: '12px 0' }}>
                  {locale === 'pt' ? 'Nada agendado para hoje' : "Rien de prévu aujourd'hui"}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: tv.textMuted, marginBottom: '6px' }}>
                    {locale === 'pt' ? 'Hoje' : "Aujourd'hui"} — {now.toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                  {todayBookings.slice(0, 4).map((b, i) => {
                    const clientName = extractClientName(b)
                    const isCompleted = b.status === 'completed'
                    return (
                      <div
                        key={b.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '2px',
                          borderLeft: `2px solid ${isCompleted ? tv.green : tv.primary}`,
                          background: isCompleted ? tv.greenLight : tv.primaryLight,
                          marginBottom: '4px', cursor: 'pointer',
                        }}
                        onClick={() => navigateTo('calendar')}
                      >
                        <span className="v22-ref">{b.booking_time?.substring(0, 5) || '—'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: '12px', color: tv.text }}>{b.services?.name || 'RDV'} — {clientName}</div>
                          <div style={{ fontSize: '11px', color: tv.textMuted }}>{b.address || ''}{ (b as unknown as { duration?: string | number }).duration ? ` · ${(b as unknown as { duration?: string | number }).duration}` : ''}</div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>

          {/* Alertes */}
          <div className="v22-card">
            <div className="v22-card-head">
              <div className="v22-card-title">{locale === 'pt' ? 'Alertas' : 'Alertes'}</div>
              <div className="v22-card-meta">{alerts.length} {locale === 'pt' ? 'ativas' : 'actives'}</div>
            </div>
            <div style={{ padding: '10px' }}>
              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: '12px', color: tv.textMuted, padding: '8px 0' }}>
                  {locale === 'pt' ? 'Nenhum alerta' : 'Aucune alerte'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {alerts.map((a, i) => (
                    <div key={i} className={`v22-alert v22-alert-${a.type}`}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: '12px', color: tv.text }}>{a.title}</div>
                        <div className="v22-ref" style={{ marginTop: '2px' }}>{a.sub}</div>
                      </div>
                      <div className="v22-ref" style={{ flexShrink: 0 }}>{a.time}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Grid 3: Avis + Messagerie + Devis récents ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {/* Derniers avis */}
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title">{locale === 'pt' ? 'Últimas avaliações' : 'Derniers avis'}</div>
            <div className="v22-card-meta">{artisan?.rating_avg || '5.0'} / 5</div>
          </div>
          <div className="v22-card-body" style={{ padding: 0 }}>
            {/* Placeholder: no avis data in props */}
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: tv.textMuted }}>
              {locale === 'pt' ? 'Nenhuma avaliação ainda' : 'Aucun avis pour le moment'}
            </div>
          </div>
        </div>

        {/* Messagerie */}
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title">{locale === 'pt' ? 'Mensagens' : 'Messagerie'}</div>
            <div className="v22-card-meta" style={{ color: tv.red }}>
              {/* Placeholder count */}
            </div>
          </div>
          <div className="v22-card-body" style={{ padding: 0 }}>
            {pendingBookings.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: tv.textMuted }}>
                {locale === 'pt' ? 'Nenhuma mensagem' : 'Aucun message'}
              </div>
            ) : (
              pendingBookings.slice(0, 4).map((b) => {
                const clientName = extractClientName(b)
                const initials = getInitials(clientName)
                return (
                  <div
                    key={b.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: `1px solid ${tv.border}`, cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF7')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                    onClick={() => navigateTo('messages')}
                  >
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: tv.primaryLight, border: `1px solid ${tv.primaryBorder}`, color: '#7A6000', fontSize: '9px', fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '12px', color: tv.text }}>{clientName}</div>
                      <div style={{ fontSize: '11px', color: tv.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.services?.name || (locale === 'pt' ? 'Nova mensagem...' : 'Nouveau message...')}
                      </div>
                    </div>
                    <span className="v22-ref" style={{ flexShrink: 0 }}>
                      {b.booking_time?.substring(0, 5) || formatRelativeTime(b.created_at || '', locale)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Devis récents */}
        <div className="v22-card">
          <div className="v22-card-head" style={{ display: 'flex', alignItems: 'center' }}>
            <div className="v22-card-title">{locale === 'pt' ? 'Orçamentos recentes' : 'Devis récents'}</div>
            <button className="v22-btn v22-btn-sm" style={{ marginLeft: 'auto', border: 'none', background: 'none', color: tv.textMuted, cursor: 'pointer', fontSize: '11px' }} onClick={() => navigateTo('devis')}>
              {locale === 'pt' ? 'Ver tudo →' : 'Voir tout →'}
            </button>
          </div>
          <div className="v22-card-body" style={{ padding: 0 }}>
            {recentDevis.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: tv.textMuted }}>
                {locale === 'pt' ? 'Nenhum orçamento' : 'Aucun devis'}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: tv.textMuted, textAlign: 'left', borderBottom: `1px solid ${tv.border}` }}>{locale === 'pt' ? 'Réf.' : 'Réf.'}</th>
                    <th style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: tv.textMuted, textAlign: 'left', borderBottom: `1px solid ${tv.border}` }}>Client</th>
                    <th style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: tv.textMuted, textAlign: 'right', borderBottom: `1px solid ${tv.border}` }}>{locale === 'pt' ? 'Valor' : 'Montant'}</th>
                    <th style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: tv.textMuted, textAlign: 'left', borderBottom: `1px solid ${tv.border}` }}>{locale === 'pt' ? 'Estado' : 'Statut'}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDevis.map((d, i) => {
                    // Les statuts réels, par les primitives partagées. Ce bloc cherchait « accepted » et
                    // « accepté » accentué, « rejected » et « refusé » : il ignorait donc « accepte », « signe »,
                    // « signed » et « refuse », c'est-à-dire presque tout ce que le dépôt écrit. Tout devis
                    // s'affichait « Attente ».
                    const gagne = estDevisSigne(d.status)
                    const refuse = estDevisRefuse(d.status)
                    const statusClass = gagne ? 'v22-tag-green' : refuse ? 'v22-tag-red' : 'v22-tag-amber'
                    const statusLabel = gagne
                      ? (locale === 'pt' ? 'Aceite' : 'Accepté')
                      : refuse
                        ? (locale === 'pt' ? 'Recusado' : 'Refusé')
                        : (locale === 'pt' ? 'Pendente' : 'Attente')
                    return (
                      <tr
                        key={d.id || i}
                        style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={e => { e.currentTarget.querySelectorAll('td').forEach(td => (td as HTMLElement).style.background = '#FAFAF7') }}
                        onMouseLeave={e => { e.currentTarget.querySelectorAll('td').forEach(td => (td as HTMLElement).style.background = '') }}
                        onClick={() => navigateTo('devis')}
                      >
                        <td style={{ padding: '6px 8px', borderBottom: `1px solid ${tv.border}`, fontSize: '12px' }}><span className="v22-ref">{d.docNumber || d.ref || d.number || `${i + 1}`}</span></td>
                        <td style={{ padding: '6px 8px', borderBottom: `1px solid ${tv.border}`, fontSize: '12px', fontWeight: 500 }}>{d.client || d.clientName || '—'}</td>
                        <td style={{ padding: '6px 8px', borderBottom: `1px solid ${tv.border}`, fontSize: '12px', textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{formatPrice(docRevenueHT(d))}</td>
                        <td style={{ padding: '6px 8px', borderBottom: `1px solid ${tv.border}`, fontSize: '12px' }}><span className={`v22-tag ${statusClass}`}>{statusLabel}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Actions (kept, role-based) ── */}
      <div className="v22-card" style={{ marginTop: '16px' }}>
        <div className="v22-card-head"><div className="v22-card-title">{t('proDash.home.actionsRapides')}</div></div>
        <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {orgRole === 'pro_conciergerie' && <>
          <QuickAction icon="🏠" label={t('proDash.home.nouvellePropriete')} onClick={() => navigateTo('proprietes')} textColor={tv.text} />
          <QuickAction icon="📅" label={t('proDash.home.planifierVisite')} onClick={() => { setShowNewRdv(true); navigateTo('calendar') }} textColor={tv.text} />
          <QuickAction icon="📄" label={t('proDash.home.creerDevis')} onClick={() => { setActivePage('devis'); setSidebarOpen(false); setTimeout(() => openDevisForm(), 50) }} textColor={tv.text} />
          <QuickAction icon="🔑" label={t('proDash.home.gererAcces')} onClick={() => navigateTo('acces')} textColor={tv.text} />
        </>}
        {orgRole === 'pro_gestionnaire' && <>
          <QuickAction icon="📋" label={t('proDash.home.ordreDeMission')} onClick={() => navigateTo('missions')} textColor={tv.text} />
          <QuickAction icon="🏢" label={t('proDash.home.gererImmeuble')} onClick={() => navigateTo('immeubles')} textColor={tv.text} />
          <QuickAction icon="📄" label={t('proDash.home.creerDevis')} onClick={() => { setActivePage('devis'); setSidebarOpen(false); setTimeout(() => openDevisForm(), 50) }} textColor={tv.text} />
          <QuickAction icon="🧾" label={t('proDash.home.nouvelleFacture')} onClick={() => { setActivePage('factures'); setSidebarOpen(false); setTimeout(() => openFactureForm(), 50) }} textColor={tv.text} />
        </>}
        </div>
      </div>
    </div>
  )
}

function QuickAction({ icon, label, onClick, textColor }: { icon: string; label: string; onClick: () => void; textColor: string }) {
  return (
    <div onClick={onClick}
      className="v22-card cursor-pointer text-center hover:shadow-md transition-shadow"
      style={{ padding: '16px 10px' }}>
      <div style={{ fontSize: '24px', marginBottom: '6px' }}>{icon}</div>
      <div style={{ fontSize: '12px', fontWeight: 500, color: textColor }}>{label}</div>
    </div>
  )
}
