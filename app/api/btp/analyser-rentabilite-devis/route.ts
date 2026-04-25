import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getRefPrix, type RefPrix } from '@/lib/ref-prix-cache'

// ── Mapping unité devis → unité ref_prix ────────────────────────────────────
const UNIT_MAP: Record<string, string> = {
  'm2': 'm²', 'm²': 'm²', 'ml': 'ml', 'm': 'm', 'm3': 'm³', 'm³': 'm³',
  'u': 'u', 'pce': 'u', 'ens': 'u', 'lot': 'u', 'pt': 'u',
  'h': 'h', 'j': 'j', 'sem': 'sem', 'mois': 'mois', 'visite': 'visite',
  'forfait': 'forfait', 'f': 'forfait', 'logement': 'logement',
  'paire': 'paire', 'nid': 'nid', 'pièce': 'pièce',
}

const itemSchema = z.object({
  description: z.string(),
  qty: z.number(),
  unit: z.string(),
  priceHT: z.number(),
  totalHT: z.number(),
})

const bodySchema = z.object({
  items: z.array(itemSchema).min(1).max(100),
  nbPersonnes: z.number().int().min(1).max(100),
  joursChantier: z.number().min(0.5).max(365),
  heuresParJour: z.number().min(1).max(14).default(8),
  corpsMetier: z.string().optional(), // slug pour matching ciblé
})

// ── Tokenize pour matching fuzzy ────────────────────────────────────────────
function tokenize(s: string): string[] {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // décompose accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3) // ignore mots courts
}

// Score de similarité = nb tokens devis trouvés dans prestation ref / nb tokens devis
function matchScore(devisDesc: string, refPresta: string): number {
  const devisTokens = tokenize(devisDesc)
  if (devisTokens.length === 0) return 0
  const refTokens = new Set(tokenize(refPresta))
  let hits = 0
  for (const t of devisTokens) if (refTokens.has(t)) hits++
  return hits / devisTokens.length
}

interface LigneAnalysee {
  description: string
  qty: number
  unit: string
  priceHT: number
  totalHT: number
  matched: boolean
  refPrestation?: string
  refPrixMoyen?: number
  refPrixMin?: number
  refPrixMax?: number
  ecartPct?: number // (priceHT - prix_moyen) / prix_moyen × 100
  verdict?: 'trop_bas' | 'ok' | 'trop_haut'
  matchScore?: number
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`btp_renta_${ip}`, 20, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let raw: unknown
  try { raw = await request.json() } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { items, nbPersonnes, joursChantier, heuresParJour, corpsMetier } = parsed.data

  try {
    // ── 1. Cache ref_prix en mémoire (TTL 5 min) + 3 queries DB user en parallèle ─
    const [refPrix, settingsRes, membresRes, chargesRes] = await Promise.all([
      getRefPrix(corpsMetier),
      supabaseAdmin.from('settings_btp').select('charges_patronales_pct, cout_horaire_moyen').eq('owner_id', user.id).maybeSingle(),
      supabaseAdmin.from('membres_btp').select('cout_horaire, charges_patronales_pct').eq('owner_id', user.id),
      supabaseAdmin.from('charges_fixes').select('montant, frequence').eq('owner_id', user.id),
    ])

    const settings = settingsRes.data as { charges_patronales_pct?: number; cout_horaire_moyen?: number } | null
    const membres = (membresRes.data || []) as { cout_horaire?: number; charges_patronales_pct?: number }[]
    const chargesFixes = (chargesRes.data || []) as { montant: number; frequence: string }[]

    // ── 2. Coût horaire moyen + charges patronales ───────────────────────────
    const coutHoraireMoyen = membres.length > 0
      ? membres.reduce((s, m) => s + (m.cout_horaire || 25), 0) / membres.length
      : (settings?.cout_horaire_moyen || 25)
    const chargesPatronalesPct = settings?.charges_patronales_pct
      || (membres.length > 0 ? membres.reduce((s, m) => s + (m.charges_patronales_pct || 45), 0) / membres.length : 45)

    // ── 3. Charges fixes mensuelles (normalisées) ────────────────────────────
    const chargesFixesMensuelles = chargesFixes.reduce((sum, c) => {
      const m = c.frequence === 'annuel' ? c.montant / 12
              : c.frequence === 'trimestriel' ? c.montant / 3
              : c.montant
      return sum + m
    }, 0)

    // ── 4. Analyser chaque ligne ─────────────────────────────────────────────
    const lignesAnalysees: LigneAnalysee[] = items.map(item => {
      const refUnit = UNIT_MAP[item.unit] || item.unit
      const candidates = refPrix.filter(r => r.unite === refUnit || r.unite === item.unit)
      let best: { ref: RefPrix; score: number } | null = null
      for (const r of candidates) {
        const s = matchScore(item.description, r.prestation)
        if (s >= 0.4 && (!best || s > best.score)) best = { ref: r, score: s }
      }
      if (!best) {
        return { ...item, matched: false }
      }
      const ecartPct = ((item.priceHT - best.ref.prix_moyen) / best.ref.prix_moyen) * 100
      const verdict: 'trop_bas' | 'ok' | 'trop_haut' =
        item.priceHT < best.ref.prix_min ? 'trop_bas' :
        item.priceHT > best.ref.prix_max ? 'trop_haut' : 'ok'
      return {
        ...item,
        matched: true,
        refPrestation: best.ref.prestation,
        refPrixMoyen: best.ref.prix_moyen,
        refPrixMin: best.ref.prix_min,
        refPrixMax: best.ref.prix_max,
        ecartPct: Math.round(ecartPct * 10) / 10,
        verdict,
        matchScore: Math.round(best.score * 100) / 100,
      }
    })

    // ── 5. Totaux financiers ─────────────────────────────────────────────────
    const caHT = items.reduce((s, i) => s + i.totalHT, 0)
    const heuresTotal = nbPersonnes * joursChantier * heuresParJour
    const coutMOBrut = heuresTotal * coutHoraireMoyen
    const coutChargesPatronales = coutMOBrut * (chargesPatronalesPct / 100)
    const coutMOTotal = coutMOBrut + coutChargesPatronales
    const chargesFixesProrata = chargesFixesMensuelles * (joursChantier / 30)
    const coutTotal = coutMOTotal + chargesFixesProrata
    const beneficeNet = caHT - coutTotal
    const margePct = caHT > 0 ? (beneficeNet / caHT) * 100 : 0

    // ── 6. Constat narratif ──────────────────────────────────────────────────
    const nbTropBas = lignesAnalysees.filter(l => l.verdict === 'trop_bas').length
    const nbTropHaut = lignesAnalysees.filter(l => l.verdict === 'trop_haut').length
    const nbOk = lignesAnalysees.filter(l => l.verdict === 'ok').length
    const nbMatched = lignesAnalysees.filter(l => l.matched).length
    const nbNonAnalysees = lignesAnalysees.length - nbMatched

    const niveau: 'critique' | 'attention' | 'correct' | 'excellent' =
      margePct < 10 ? 'critique' :
      margePct < 20 ? 'attention' :
      margePct < 35 ? 'correct' : 'excellent'

    const phrases: string[] = []
    if (margePct < 10) {
      phrases.push(`⚠️ Marge nette critique : ${margePct.toFixed(1)}% (objectif minimum 20%).`)
    } else if (margePct < 20) {
      phrases.push(`⚠️ Marge faible : ${margePct.toFixed(1)}%. Recommandé : viser au moins 25%.`)
    } else if (margePct < 35) {
      phrases.push(`✅ Marge correcte : ${margePct.toFixed(1)}%.`)
    } else {
      phrases.push(`💎 Marge excellente : ${margePct.toFixed(1)}%.`)
    }

    if (nbTropBas > 0) {
      phrases.push(`${nbTropBas} ligne${nbTropBas > 1 ? 's' : ''} sous-tarifée${nbTropBas > 1 ? 's' : ''} par rapport au marché.`)
    }
    if (nbTropHaut > 0) {
      phrases.push(`${nbTropHaut} ligne${nbTropHaut > 1 ? 's' : ''} au-dessus du prix marché — risque de perte du chantier.`)
    }
    if (nbNonAnalysees > 0) {
      phrases.push(`${nbNonAnalysees} ligne${nbNonAnalysees > 1 ? 's' : ''} non analysée${nbNonAnalysees > 1 ? 's' : ''} (prestation hors base).`)
    }

    if (beneficeNet < 0) {
      phrases.push(`❌ Devis non rentable : perte estimée de ${Math.abs(beneficeNet).toFixed(0)}€ sur la durée du chantier.`)
    }

    const constat = phrases.join(' ')

    return NextResponse.json({
      lignesAnalysees,
      totaux: {
        caHT: Math.round(caHT * 100) / 100,
        coutMOBrut: Math.round(coutMOBrut * 100) / 100,
        coutChargesPatronales: Math.round(coutChargesPatronales * 100) / 100,
        coutMOTotal: Math.round(coutMOTotal * 100) / 100,
        chargesFixesProrata: Math.round(chargesFixesProrata * 100) / 100,
        coutTotal: Math.round(coutTotal * 100) / 100,
        beneficeNet: Math.round(beneficeNet * 100) / 100,
        margePct: Math.round(margePct * 10) / 10,
        heuresTotal,
        coutHoraireMoyen,
        chargesPatronalesPct,
        chargesFixesMensuelles: Math.round(chargesFixesMensuelles * 100) / 100,
      },
      stats: {
        nbLignes: items.length,
        nbMatched,
        nbTropBas,
        nbOk,
        nbTropHaut,
        nbNonAnalysees,
      },
      niveau,
      constat,
    })
  } catch (err) {
    logger.error('[btp/analyser-rentabilite-devis] error', { error: err instanceof Error ? err.message : err, userId: user.id })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
