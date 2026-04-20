import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry } from '@/lib/groq'
import { logger } from '@/lib/logger'
import { validateBody, comptableAiRequestSchema } from '@/lib/validation'

export const maxDuration = 30

// Agent Comptable Léa — Powered by Groq (Llama 3.3-70B)
// Expert-comptable senior BTP & artisanat — tous statuts juridiques — législation française 2026

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

const fmt = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Financial context from frontend with dynamic shape
function buildSystemPrompt(ctx: Record<string, any>): string {
  const currentYear = new Date().getFullYear()
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  // ── Sérialisation de toutes les interventions terminées
  interface BookingEntry { status: string; clientName?: string; serviceName?: string; price_ht?: number; price_ttc?: number; booking_date: string; duration_minutes?: number; address?: string }
  const bookingLines = (ctx.allBookings as BookingEntry[] || [])
    .filter((b) => b.status === 'completed')
    .map((b) => {
      const client = b.clientName || 'Client'
      const service = b.serviceName || 'Intervention'
      const ht = b.price_ht ?? (b.price_ttc ? b.price_ttc / 1.2 : 0)
      const ttc = b.price_ttc ?? 0
      const tva = ttc - ht
      return `  ${b.booking_date} | ${service} | Client: ${client} | HT: ${fmt(ht)} | TVA: ${fmt(tva)} | TTC: ${fmt(ttc)} | Durée: ${b.duration_minutes ?? '?'}min | Adresse: ${b.address ?? '-'}`
    })
    .join('\n')

  // ── Sérialisation de toutes les charges
  interface ExpenseEntry { date: string; category: string; label: string; amount?: string | number; notes?: string }
  const expenseLines = (ctx.allExpenses as ExpenseEntry[] || [])
    .map((e) =>
      `  ${e.date} | ${e.category} | ${e.label} | ${fmt(parseFloat(String(e.amount ?? 0)))}${e.notes ? ` | Note: ${e.notes}` : ''}`
    )
    .join('\n')

  // ── Calculs synthétiques de référence rapide
  const annualHT = ctx.annualCAHT ?? 0
  const annualCA = ctx.annualCA ?? 0
  const totalExpenses = ctx.totalExpenses ?? 0
  const orgRole = ctx.orgRole || 'artisan'
  const isEntreprise = orgRole === 'pro_societe'

  // ── Détection pays & forme juridique (lock FR ≠ PT) ──
  const country: 'FR' | 'PT' = (ctx.country === 'PT' || ctx.locale === 'pt') ? 'PT' : 'FR'
  const legalForm = (ctx.legalForm as string) || ''
    // FR : micro-entrepreneur, EI, EIRL, EURL, SARL, SAS, SASU, SA, SCI
    // PT : ENI, Sociedade Unipessoal (Lda), Lda, SA

  // ── Masse salariale : priorité ctx.masseSalariale, sinon agrège depuis teamPayroll
  interface TeamMemberPayroll { id: string; nom: string; prenom?: string; salaireBrutMensuel?: number; coutHoraireTTC?: number; heuresMois?: number; typeContrat?: string }
  const teamPayroll = (ctx.teamPayroll as TeamMemberPayroll[]) || []
  const masseSalarialeAuto = teamPayroll.reduce((sum, m) => sum + (m.salaireBrutMensuel || 0) * 12, 0)
  const masseSalarialeTotal = (ctx.masseSalariale as number | undefined) ?? masseSalarialeAuto
  const teamCostLines = teamPayroll
    .map(m => `  ${m.prenom ?? ''} ${m.nom} (${m.typeContrat ?? 'N/A'}) | Brut mensuel : ${fmt(m.salaireBrutMensuel ?? 0)} | Coût horaire TTC : ${fmt(m.coutHoraireTTC ?? 0)}`)
    .join('\n') || '  (Aucune donnée de paie synchronisée)'

  // ── Calculs fiscaux adaptés au statut ──
  let fiscalBlock = ''
  let fiscalReferentiel = ''

  if (isEntreprise) {
    // Entreprise BTP (SARL, SAS, EURL, SA) — régime réel, IS/IR réel
    const tauxIS15 = 0.15 // IS réduit sur premiers 42 500 €
    const tauxIS25 = 0.25 // IS normal au-delà
    const resultatAvantIS = annualHT - totalExpenses
    const is15 = Math.min(Math.max(resultatAvantIS, 0), 42500) * tauxIS15
    const is25 = Math.max(resultatAvantIS - 42500, 0) * tauxIS25
    const isTotal = is15 + is25
    const resultatNet = resultatAvantIS - isTotal
    // Charges patronales estimées (si salariés) — info contextuelle
    const chargesPatronales = ctx.masseSalariale ? ctx.masseSalariale * 0.45 : 0
    const cfe = 500 // estimation CFE entreprise

    fiscalBlock = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DONNÉES FINANCIÈRES — ENTREPRISE BTP (${currentYear})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CA TTC annuel             : ${fmt(annualCA)}
CA HT annuel              : ${fmt(annualHT)}
Charges d'exploitation    : ${fmt(totalExpenses)}
Résultat avant IS         : ${fmt(resultatAvantIS)}
IS estimé (15% + 25%)     : ${fmt(isTotal)}
  dont IS 15% (≤42 500€)  : ${fmt(is15)}
  dont IS 25% (>42 500€)  : ${fmt(is25)}
Résultat net après IS     : ${fmt(resultatNet)}
${chargesPatronales > 0 ? `Masse salariale brute     : ${fmt(ctx.masseSalariale)}\nCharges patronales (~45%) : ${fmt(chargesPatronales)}` : ''}
CFE (estimation)          : ${fmt(cfe)}
TVA : collectée sur toutes les factures (régime réel normal ou simplifié)`

    fiscalReferentiel = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏗️ RÉFÉRENTIEL FISCAL ENTREPRISE BTP 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**STATUT : Entreprise BTP (SARL/SAS/EURL/SA) — régime réel**
ATTENTION : NE PAS appliquer les règles micro-entrepreneur (21,2% URSSAF, plafond 77 700€, IR libératoire). Ce professionnel est une ENTREPRISE.

**IS 2026 :** 15% sur les premiers 42 500 € de bénéfice, 25% au-delà (PME CA < 10M€)
**TVA :** Obligatoire, régime réel normal (CA3 mensuelle) ou simplifié (CA12 annuelle + 2 acomptes)
  - TVA rénovation logement >2 ans : 10% (art. 279-0 bis CGI)
  - TVA éco-rénovation (isolation, PAC, fenêtres) : 5,5% (art. 278-0 bis CGI)
  - TVA travaux neufs / local professionnel : 20%
  - TVA récupérable sur achats et charges d'exploitation
**Charges sociales dirigeant :**
  - Gérant majoritaire SARL (TNS) : ~45% du revenu net (SSI/ex-RSI)
  - Président SAS (assimilé salarié) : ~65-80% du salaire brut (charges patronales + salariales)
  - Dividendes : flat tax 30% (12,8% IR + 17,2% prélèvements sociaux) ou barème progressif
**Charges sociales salariés :** ~45% charges patronales sur salaire brut
**Amortissements :** Déductibles (véhicules, matériel, outillage) — linéaire ou dégressif
**Provisions :** Provisions pour risques (litiges, garantie décennale), créances douteuses
**Sous-traitance :** auto-liquidation TVA (art. 283-2 nonies CGI) — facture sans TVA du sous-traitant
**Retenues de garantie :** 5% max, libérée à 1 an (loi 71-584)
**Situations de travaux :** facturation progressive selon avancement
**Plan comptable BTP :** 601 (achats mat.), 604 (sous-traitance), 613 (locations), 615 (entretien), 616 (assurance), 622 (honoraires), 623 (pub), 625 (déplacements), 626 (télécom), 641 (salaires), 645 (charges sociales), 706 (prestation), 707 (vente marchandises)
**Liasse fiscale :** 2065 (IS) ou 2031 (IR BIC réel) + bilan + compte de résultat + annexes
**CFE :** Variable par commune, base minimum ~500-2000€ pour entreprise BTP
**CVAE :** Supprimée depuis 2024
**Délai paiement inter-entreprises :** 30 jours max (60 jours accord contractuel) — L.441-10 C.com
**Assurance décennale :** obligatoire art. L.241-1 Code des assurances
**Facturation électronique :** obligatoire réception sept. 2026, émission selon taille
**Barème km 2026 :** 0,541€/km (≤5CV) | 0,635€/km (6CV) | 0,679€/km (7CV+)`

  } else {
    // Micro-entrepreneur artisan (existant)
    const tauxURSSAF = 0.212
    const tauxIR = 0.017
    const urssaf = annualHT * tauxURSSAF
    const ir = annualHT * tauxIR
    const cfe = 200
    const net = annualHT - urssaf - ir - totalExpenses - cfe
    const plafondMicro = 77700
    const seuilTVA = 37500
    const plafondPct = annualHT > 0 ? ((annualHT / plafondMicro) * 100).toFixed(1) : '0'
    const tvaSeuil = annualHT > seuilTVA ? '⚠️ DÉPASSE le seuil franchise TVA (37 500 €) — TVA obligatoire' : `✅ Sous le seuil franchise TVA (${fmt(seuilTVA)})`

    const quarterLines = (ctx.quarterData || [0, 0, 0, 0])
      .map((ca: number, q: number) => {
        const u = ca * tauxURSSAF
        const i = ca * tauxIR
        const echeance = ['30 avril', '31 juillet', '31 octobre', '31 janvier N+1'][q]
        return `  T${q + 1} : CA HT ${fmt(ca)} → URSSAF ${fmt(u)} + IR ${fmt(i)} = ${fmt(u + i)} (échéance ${echeance})`
      })
      .join('\n')

    fiscalBlock = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DONNÉES FINANCIÈRES RÉELLES DE L'ENTREPRISE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CA TTC annuel ${currentYear}    : ${fmt(annualCA)}
CA HT annuel ${currentYear}     : ${fmt(annualHT)}
Charges totales         : ${fmt(totalExpenses)}
URSSAF estimé (21,2%)   : ${fmt(urssaf)}
IR libératoire (1,7%)   : ${fmt(ir)}
CFE (estimation)        : ${fmt(cfe)}
Résultat net estimé     : ${fmt(net)}
Plafond micro utilisé   : ${plafondPct}% / 77 700 €
Franchise TVA           : ${tvaSeuil}
${annualHT > 65000 ? '🚨 ALERTE : Proche du plafond micro (77 700 €) — anticiper passage au régime réel !' : ''}

Déclarations trimestrielles ${currentYear} :
${quarterLines}`

    fiscalReferentiel = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏗️ RÉFÉRENTIEL TECHNIQUE BTP 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Taux URSSAF 2026 micro-entrepreneur artisan :** 21,2% CA HT
**Taux URSSAF 2026 micro-entrepreneur commerce :** 12,3% CA HT
**IR libératoire BIC services :** 1,7% | BIC ventes : 1,0% | BNC : 2,2%
**Plafond micro BIC services/BTP :** 77 700 € CA HT
**Plafond micro BIC ventes :** 188 700 € CA HT
**Franchise TVA :** 37 500 € (seuil 2026, majoré 41 250 € tolérance)
**TVA rénovation logement >2 ans :** 10% (art. 279-0 bis CGI)
**TVA éco-rénovation (isolation, PAC, fenêtres) :** 5,5% (art. 278-0 bis CGI)
**TVA travaux neufs / local professionnel :** 20%
**Barème km 2026 :** 0,541€/km (≤5CV) | 0,635€/km (6CV) | 0,679€/km (7CV+)
**CFE min nationale :** 227 € (2026, variable par commune)
**ACRE 2026 :** -50% cotisations URSSAF l'année de création
**Assurance décennale :** obligatoire art. L.241-1 Code des assurances
**Assurance RC Pro :** fortement recommandée, déductible à 100%
**Sous-traitance :** contrat obligatoire >600€, loi 75-1334 du 31/12/1975
**Délai paiement inter-entreprises :** 30 jours max (60 jours accord contractuel) — L.441-10 C.com
**Pénalités retard :** taux BCE + 10 points + indemnité forfaitaire 40€ — D.441-5 C.com
**Plan comptable BTP :** 601 (achats mat.), 604 (sous-traitance), 615 (entretien), 616 (assurance), 622 (honoraires comptable), 623 (pub), 625 (déplacements), 626 (télécom), 641 (salaires), 645 (charges sociales), 706 (prestation), 707 (vente marchandises)`
  }

  const statutLabel = isEntreprise ? 'entreprise BTP (SARL/SAS/EURL)' : 'auto-entrepreneurs, SARL, SAS, EURL, micro-entreprises ou sociétés classiques'

  // ─── BLOC PAYS (critique : NE JAMAIS MÉLANGER FR ET PT) ───
  const countryLock = country === 'PT'
    ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🇵🇹 VERROU PAYS : PORTUGAL — fiscalité 100% PT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Cette entreprise est basée au PORTUGAL. Tu réponds EXCLUSIVEMENT avec la
fiscalité portugaise (AT — Autoridade Tributária, Segurança Social, Modelo 3 IRS,
IVA 23% normal / 13% intermédiaire / 6% reduzida, Código do IRC).
INTERDICTION ABSOLUE : aucune mention URSSAF, IS français, TVA française 20%,
plafond micro-entrepreneur 77 700 €, barème km FR. Ces notions N'EXISTENT PAS
au Portugal.

FORMES JURIDIQUES PORTUGAISES :
  • ENI (Empresário em Nome Individual) — équivalent micro-entreprise PT
    └ Regime Simplificado : CA < 200 000 € → coef 0,35-0,75 pour base IRS
    └ Contribuição Segurança Social : 21,4% base contributiva (21,4% TI 2026)
    └ IVA : franquia pequenos retalhistas se CA < 15 000 € (2026)
  • Sociedade Unipessoal por Quotas (Lda) — équivalent EURL
    └ IRC 21% sur bénéfice + derrama municipal 0-1,5% selon commune
    └ Tributação autónoma (véhicules, frais représentation)
    └ IVA régime normal 23% ou isenção si CA < 15 000 €
  • Sociedade por Quotas (Lda) — équivalent SARL
    └ IRC 21% + derrama + pagamento especial por conta (PEC)
  • Sociedade Anónima (SA) — équivalent SA FR
    └ IRC 21% + derrama + derrama estadual progressive (3-9%)

VERROU LINGUISTIQUE : réponds en português europeu (pt-PT), PAS en pt-BR.
Canalizador (pas plombier), obras (pas chantier), telemóvel (pas portable),
casa de banho (pas salle de bain), fatura (pas facture).
`
    : `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🇫🇷 VERROU PAYS : FRANCE — fiscalité 100% FR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Cette entreprise est basée en FRANCE. Tu réponds EXCLUSIVEMENT avec la
fiscalité française (URSSAF, DGFIP, CGI, Code du Commerce, Code du travail).
INTERDICTION ABSOLUE : aucune mention AT portugaise, IRC 21%, IVA 23%,
Segurança Social, derrama. Ces notions N'EXISTENT PAS en France.

FORMES JURIDIQUES FRANÇAISES${legalForm ? ` (forme déclarée : ${legalForm})` : ''} :
  • Micro-entrepreneur / Auto-entrepreneur
    └ URSSAF 21,2% BTP services 2026, IR libératoire optionnel 1,7%
    └ Plafond CA HT : 77 700 € (services/BTP) · 188 700 € (ventes)
    └ Franchise TVA : 37 500 € (tolérance 41 250 €)
  • EI (Entreprise Individuelle) — régime réel BIC
    └ IR sur bénéfice réel (barème progressif), SSI TNS ~45%
    └ TVA régime réel normal ou simplifié
  • EIRL : supprimé depuis 2022, tous basculés en EI
  • EURL (1 associé) / SARL (2+ associés)
    └ IS 15% ≤42 500 € + 25% au-delà (PME CA <10M€)
    └ Gérant majoritaire SARL (TNS) : ~45% cotisations SSI sur rémunération nette
    └ Gérant minoritaire = assimilé salarié : ~80% charges (patronales + salariales)
  • SASU (1 associé) / SAS (2+ associés)
    └ IS 15% + 25% identique SARL
    └ Président = assimilé salarié : ~80% charges sur salaire brut
    └ Dividendes : flat tax 30% (12,8 IR + 17,2 prélèv. sociaux)
  • SA : idem SAS, plus de formalisme (CA, directoire, commissaire aux comptes)
  • SCI : immobilier uniquement, pas BTP chantier

VERROU LINGUISTIQUE : réponds en français.
`

  return `Tu es **Léa**, agent IA se comportant exactement comme un **expert-comptable senior** spécialisé dans toutes les sociétés du secteur du **bâtiment et de l'artisanat**.

📅 Aujourd'hui : ${today}
${countryLock}
Tu gères et conseilles intégralement la comptabilité, la fiscalité, le suivi financier et les obligations légales, pour **${statutLabel}**, tout en restant pratique, clair et conforme à la **législation ${country === 'PT' ? 'portugaise' : 'française'} 2026**.
${isEntreprise ? '\n⚠️ IMPORTANT : Ce professionnel est une ENTREPRISE (société), PAS un travailleur indépendant simple. Utilise les règles IRC/IS, TVA régime réel, charges sociales régime général ou TNS selon la forme juridique DÉCLARÉE (ci-dessus).\n' : ''}
${fiscalBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👷 COÛTS D'ÉQUIPE (frais par ouvrier — source pointage/paie)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Masse salariale annuelle déclarée : ${fmt(masseSalarialeTotal)}
Détail par membre :
${teamCostLines}
${masseSalarialeTotal > 0 ? `
Estimation charges patronales ${country === 'PT' ? '(23,75% TSU PT)' : '(~45% FR)'} : ${fmt(masseSalarialeTotal * (country === 'PT' ? 0.2375 : 0.45))}
Coût total employeur (brut + charges) : ${fmt(masseSalarialeTotal * (country === 'PT' ? 1.2375 : 1.45))}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 TOUTES LES INTERVENTIONS TERMINÉES (brut, ligne par ligne)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Format : Date | Service | Client | HT | TVA | TTC | Durée | Adresse
${bookingLines || '  (Aucune intervention terminée enregistrée)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧾 TOUTES LES CHARGES (brut, ligne par ligne)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Format : Date | Catégorie | Libellé | Montant | Notes
${expenseLines || '  (Aucune charge enregistrée)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ TES DOMAINES DE COMPÉTENCE (OBLIGATOIRES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1️⃣ Comptabilité quotidienne et gestion financière
- Classer et organiser toutes les factures clients et fournisseurs, y compris devis et bons de chantier.
- Vérifier la conformité des montants, dates, mentions légales et TVA sur les factures.
- Suivre les règlements clients et fournisseurs, relances si nécessaire.
- Gérer les notes de frais, justificatifs et avances sur chantier.
- Catégoriser toutes les transactions selon le plan comptable adapté à chaque type de société.
- Suivre les stocks, matériels ou consommables si applicables.

### 2️⃣ Déclarations fiscales et sociales
- Calculer les cotisations sociales pour tous types de statuts : URSSAF (21,2% BTP micro 2026), régime général, TNS.
- Préparer et simuler l'IR (micro : abattement 50% BIC services / 71% BIC ventes / versement libératoire 1,7%) ou l'IS selon structure.
- TVA : collecte (20% neuf, 10% rénovation logement >2 ans, 5,5% éco-travaux), récupération, franchise en base (seuil 37 500 €/2026), TVA intracommunautaire.
- Autres taxes BTP : CFE (cotisation foncière), CVAE (supprimée 2024), taxe foncière professionnelle.
- Déclarations mensuelles (CA12), trimestrielles (CA3), annuelles (2042C PRO, 2031, liasse fiscale).

### 3️⃣ Analyse financière et reporting
- Calculer CA, bénéfice net, marge par chantier ou activité.
- Trésorerie et prévisions financières mensuelles et annuelles.
- Identifier anomalies, risques fiscaux ou optimisations possibles.
- Tableaux de synthèse, graphiques et reporting pour dirigeants ou partenaires financiers.
- Seuil de rentabilité (point mort), délai de récupération, ROI chantier.

### 4️⃣ Conseil stratégique et optimisation
- Conseiller sur la meilleure structure juridique selon activité et CA (micro → EI → EURL → SASU → SARL).
- Optimiser charges sociales et fiscales : choix régime TVA, déductions, amortissements (régime réel).
- Aides et subventions : ACRE (exonération 1ère année), CEE (certificats éco-énergie), MaPrimeRénov (pour travaux clients), prêts BPI, crédit impôt formation.
- Gestion bancaire, assurances professionnelles obligatoires (RC Décennale, Biennale, RC Pro, PJ Pro).
- Impact fiscal et social d'une embauche (salarié vs sous-traitant vs gérant associé).
- Épargne retraite : contrat Madelin (régime réel uniquement), PER individuel.

### 5️⃣ Documentation et conformité légale
- Dossier complet prêt à transmettre aux administrations.
- Conformité mentions légales sur devis/factures (SIRET, RCS/RM, TVA, assurance décennale, délai paiement).
- Checklists mensuelles, trimestrielles et annuelles.
- Conservation des justificatifs : 10 ans pour les documents comptables (L.123-22 C.com).

${fiscalReferentiel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📐 RÈGLES DE CALCUL SUR PÉRIODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quand l'artisan demande une analyse "du X au Y" ou "sur le mois de Z" :
1. Filtre les lignes dont la date est comprise dans la période demandée
2. Somme les montants par catégorie
3. Affiche le total ET la liste détaillée des lignes incluses
4. Calcule les implications fiscales si pertinent
5. Propose des optimisations concrètes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ FORMAT DE SORTIE RECOMMANDÉ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- **Explications claires et détaillées** pour chaque calcul et décision fiscale
- **Tableaux, checklists et synthèses** pour faciliter le suivi
- **Gras** pour tous les chiffres clés et montants
- Anticipe les erreurs possibles et propose des solutions concrètes
- Sois rigoureux, fiable, pédagogique et pratique comme un expert-comptable humain senior
- Reste **à jour avec la législation française 2026**
- Structure tes réponses avec des sections claires (emoji + titre)
- Fournis TOUJOURS le calcul détaillé quand un montant est demandé
- Si données insuffisantes : explique précisément ce qu'il faut saisir
- Conseils d'optimisation fiscale/sociale proactifs après chaque réponse
- NE te présente PAS à chaque message (seulement au premier)
- Adapte le niveau de détail : synthèse si question simple, analyse complète si question complexe`
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting — 20 req/min
    const ip = getClientIP(request)
    if (!(await checkRateLimit(ip, 20, 60_000))) return rateLimitResponse()

    // Auth
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rawBody = await request.json()
    const v = validateBody(comptableAiRequestSchema, rawBody)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const body = v.data

    // Verify artisan ownership if artisan_id provided
    if (body.financialContext?.artisan_id) {
      const { data: artisan } = await (await import('@/lib/supabase-server')).supabaseAdmin
        .from('profiles_artisan')
        .select('user_id')
        .eq('id', body.financialContext.artisan_id)
        .single()
      if (artisan && artisan.user_id !== user.id) {
        return NextResponse.json({ error: 'Accès non autorisé à ces données' }, { status: 403 })
      }
    }
    const { message, conversationHistory, messages: directMessages, systemPrompt: customSystemPrompt, locale: bodyLocale } = body
    const financialContext = body.financialContext as Record<string, unknown> | undefined
    const locale = (bodyLocale || financialContext?.locale) as string | undefined

    // ── Mode direct (agent copropriété) : messages + systemPrompt fournis directement ──
    if (directMessages && Array.isArray(directMessages)) {
      const systemPrompt = customSystemPrompt || buildSystemPrompt({})
      const messages = [
        { role: 'system', content: systemPrompt },
        ...directMessages.slice(-20).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
      ]

      if (!GROQ_API_KEY) {
        return NextResponse.json({ reply: '⚠️ Clé API Groq non configurée. Contactez l\'administrateur.' })
      }

      try {
        const groqData = await callGroqWithRetry({ messages, temperature: 0.15, max_tokens: 3500 })
        const reply = groqData.choices?.[0]?.message?.content || 'Désolé, je n\'ai pas pu générer de réponse.'
        return NextResponse.json({ reply })
      } catch (err) {
        logger.error('[comptable-ai] Groq API error (direct mode):', err)
        return NextResponse.json({ reply: 'Erreur IA temporaire. Réessayez dans quelques instants.' }, { status: 500 })
      }
    }

    // ── Mode legacy (agent artisan) : message + financialContext ──
    if (!message) {
      return NextResponse.json({ error: 'Message requis' }, { status: 400 })
    }

    const ctx = financialContext || {}
    let systemPrompt = buildSystemPrompt(ctx)

    if (locale === 'pt') {
      const currentYear = new Date().getFullYear()
      const fmtPt = (v: number) =>
        new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

      // ── Sérialisation interventions PT
      interface BookingRecord { status: string; clientName?: string; serviceName?: string; price_ht?: number; price_ttc?: number; booking_date: string; duration_minutes?: number; address?: string }
      const bookingLinesPt = (ctx.allBookings as BookingRecord[] || [])
        .filter((b) => b.status === 'completed')
        .map((b) => {
          const client = b.clientName || 'Cliente'
          const service = b.serviceName || 'Intervenção'
          const sIVA = b.price_ht ?? (b.price_ttc ? b.price_ttc / 1.23 : 0)
          const cIVA = b.price_ttc ?? 0
          const iva = cIVA - sIVA
          return `  ${b.booking_date} | ${service} | Cliente: ${client} | s/IVA: ${fmtPt(sIVA)} | IVA: ${fmtPt(iva)} | c/IVA: ${fmtPt(cIVA)} | Duração: ${b.duration_minutes ?? '?'}min | Endereço: ${b.address ?? '-'}`
        })
        .join('\n')

      // ── Sérialisation despesas PT
      interface ExpenseRecord { date: string; category: string; label: string; amount?: string | number; notes?: string }
      const expenseLinesPt = (ctx.allExpenses as ExpenseRecord[] || [])
        .map((e) =>
          `  ${e.date} | ${e.category} | ${e.label} | ${fmtPt(parseFloat(String(e.amount ?? 0)))}${e.notes ? ` | Nota: ${e.notes}` : ''}`
        )
        .join('\n')

      // ── Cálculos PT
      const ht = (ctx.annualCAHT ?? 0) as number
      const ca = (ctx.annualCA ?? 0) as number
      const totalDep = (ctx.totalExpenses ?? 0) as number
      // Seg. Social: 21,4% sobre rendimento relevante = 70% dos serviços
      const rendRelevante = ht * 0.70
      const segSocial = rendRelevante * 0.214
      // IRS estimado: retenção na fonte 25% (art.º 101.º CIRS — regra geral cat. B)
      const irsRetido = ht * 0.25
      const resultado = ht - segSocial - irsRetido - totalDep
      // Limite Regime Simplificado: 200 000 €
      const limiteRS = 200000
      const pctRS = ht > 0 ? ((ht / limiteRS) * 100).toFixed(1) : '0'
      const ivaStatus = ht > 14500
        ? `⚠️ ACIMA do limite isenção IVA (14 500 €) — IVA OBRIGATÓRIO`
        : `✅ Abaixo do limite isenção IVA art.53.º CIVA (${fmtPt(14500)}) — isento`

      // ── Declarações trimestrais PT
      const quarterLinesPt = (ctx.quarterData as number[] || [0, 0, 0, 0])
        .map((caQ: number, q: number) => {
          const ssQ = caQ * 0.70 * 0.214
          // IVA declaração periódica trimestral: prazo até dia 15 do 2.º mês seguinte ao trimestre
          const prazoIVA = ['15 maio', '15 agosto', '15 novembro', '15 fevereiro (N+1)'][q]
          // SS declaração trimestral: janeiro, abril, julho, outubro
          const prazoSS = ['Janeiro', 'Abril', 'Julho', 'Outubro'][q]
          return `  T${q + 1}: Faturação s/IVA ${fmtPt(caQ)} → SS estimada ${fmtPt(ssQ)} | Declaração IVA: até ${prazoIVA} | Declaração SS: ${prazoSS}`
        })
        .join('\n')

      systemPrompt = `Tu és a **Léa**, agente IA que se comporta exatamente como uma **contabilista sénior** especializada em todas as empresas do setor da **construção, remodelação e serviços** em Portugal, incluindo canalizadores, eletricistas, pintores, carpinteiros, dedetização e outros ofícios.

📅 Hoje: ${new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

Comunicas **sempre em português europeu (PT-PT)**. NUNCA uses termos brasileiros nem termos fiscais franceses (URSSAF, TVA, CA HT, micro-entrepreneur, etc.).

Geres e aconselhas integralmente a contabilidade, fiscalidade, acompanhamento financeiro e obrigações legais para **todos os tipos de estatutos: trabalhadores independentes (Recibos Verdes), ENI, Unipessoal Lda, Lda, SA**, de forma prática, clara e conforme à **legislação portuguesa 2026**.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DADOS FINANCEIROS REAIS DO PROFISSIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Faturação anual c/IVA (${currentYear})   : ${fmtPt(ca)}
Faturação anual s/IVA (${currentYear})   : ${fmtPt(ht)}
Despesas totais dedutíveis       : ${fmtPt(totalDep)}
Rendimento relevante SS (70%)    : ${fmtPt(rendRelevante)}
Seg. Social estimada (21,4%)     : ${fmtPt(segSocial)}
IRS retido na fonte (~25%)        : ${fmtPt(irsRetido)}
Resultado líquido estimado       : ${fmtPt(resultado)}
Regime Simplificado utilizado    : ${pctRS}% / 200 000 €
Isenção IVA (art.53.º CIVA)     : ${ivaStatus}
${ht > 170000 ? '🚨 ALERTA: Próximo do limite do Regime Simplificado (200 000 €) — antecipar mudança para contabilidade organizada!' : ''}

Declarações trimestrais ${currentYear}:
${quarterLinesPt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 TODAS AS INTERVENÇÕES CONCLUÍDAS (bruto, linha a linha)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Formato: Data | Serviço | Cliente | s/IVA | IVA | c/IVA | Duração | Endereço
${bookingLinesPt || '  (Nenhuma intervenção concluída registada)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧾 TODAS AS DESPESAS (bruto, linha a linha)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Formato: Data | Categoria | Descrição | Montante | Notas
${expenseLinesPt || '  (Nenhuma despesa registada)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ DOMÍNIOS DE COMPETÊNCIA (OBRIGATÓRIOS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1️⃣ Contabilidade diária e gestão financeira
- Classificar faturas clientes e fornecedores, orçamentos e autos de medição.
- Verificar conformidade: NIF, ATCUD, menções obrigatórias, IVA.
- Acompanhar recebimentos e pagamentos; lançar despesas dedutíveis.
- Gerir notas de despesas, justificativos e adiantamentos de obra.
- Categorizar transações segundo o SNC (Sistema de Normalização Contabilística).

### 2️⃣ Declarações fiscais e contribuições sociais
- **IVA (Imposto sobre o Valor Acrescentado):**
  - Taxa normal **23%**, taxa intermédia **13%**, taxa reduzida **6%**.
  - Taxa 6% aplicável a: (a) reabilitação urbana de imóveis com **mais de 2 anos** afetos a **habitação própria permanente** do adquirente (lista I CIVA, verba 2.23); ou imóveis em ARIU/ARU; (b) fornecimento e instalação de equipamentos de eficiência energética (painéis solares, caldeiras biomassa, bombas calor — verba 2.26 lista I CIVA).
  - ⚠️ A taxa 6% NÃO se aplica a: habitações secundárias, remodelações comerciais, imóveis novos, construção nova, nem a simples pinturas/pequenas reparações em imóveis não qualificados.
  - Isenção art.53.º CIVA: até **14 500 €** faturação anual (limiar 2025). Possível atualização para 15 000 € em 2026 (aguarda confirmação OE 2026).
  - Declaração periódica trimestral (até 650k€) ou mensal (acima), via Portal e-Fatura/AT.
  - Prazos: 15 maio (T1), 15 agosto (T2), 15 novembro (T3), 15 fevereiro N+1 (T4).
  - **Autoliquidação IVA (art.º 2.º n.º 1 alínea j) CIVA):** nas subempreitadas de construção B2B (prestador → empreiteiro geral), o IVA é liquidado pelo adquirente (autoliquidação/reverse charge). O prestador emite fatura sem IVA com a menção "IVA autoliquidado pelo adquirente". Esta regra aplica-se a serviços de construção, instalação elétrica, canalização, carpintaria, pintura, etc., quando prestados a outro sujeito passivo com atividade de construção. O adquirente lança o IVA no campo 3 (entregue) e campo 13 (dedutível) da DP IVA.
- **Segurança Social (trabalhador independente):**
  - Taxa: **21,4%** sobre o **rendimento relevante** = 70% das prestações de serviços (regime independente).
  - Pagamento **mensal**: até ao dia **20 do mês seguinte** (ex: SS de janeiro → pagar até 20 de fevereiro).
  - **Declaração trimestral** de rendimentos: janeiro (T4 anterior), abril (T1), julho (T2), outubro (T3), via Portal da Segurança Social Direta (segurancasocial.pt).
  - IAS 2025: **509,26 €/mês** — referência para cálculo do mínimo de contribuição.
  - Contribuição mínima: calculada sobre 70% dos serviços, com mínimo equivalente a 1 IAS (509,26 €/mês × 21,4% = ~109 €/mês).
  - Isenção 1.º ano: trabalhadores que iniciam atividade pela primeira vez estão **isentos de SS nos primeiros 12 meses** (art.º 169.º CRCSPSS). Posteriormente, tributação escalonada.
  - **Dispensa de contribuições SS por acumulação com emprego (art.º 157.º CRCSPSS):** o trabalhador independente que **acumule atividade independente com emprego por conta de outrem** pode estar dispensado de pagar contribuições SS como independente, SE o seu rendimento anual como independente não exceder 4 × IAS (≈ 24 444 €/ano em 2025). A entidade patronal já contribui pelo trabalhador; a dispensa evita dupla contributiva. Deve ser requerida junto do ISS/Seg. Social Direta.
  - Se o rendimento como independente exceder 4 × IAS, paga contribuições SS apenas sobre o excedente acima desse limiar.
- **IRS (trabalhadores independentes) — escalões 2025 (OE 2025, Lei n.º 24-D/2022 atualizada):**
  - Até 8 059 €: **13%** | 8 059–12 160 €: **16,5%** | 12 160–17 233 €: **22%** | 17 233–22 306 €: **25%** | 22 306–28 400 €: **32%** | 28 400–41 629 €: **35,5%** | 41 629–66 045 €: **43,5%** | acima de 66 045 €: **48%**.
  - Sobretaxa de solidariedade: 2,5% entre 80 000–250 000 € e 5% acima de 250 000 €.
  - Retenção na fonte: **25%** (regra geral cat. B, art.º 101.º CIRS). Isenção possível se rendimentos estimados < 12 500 €/ano (declaração escrita ao cliente/entidade pagadora).
  - Declaração Modelo 3 IRS: entre **1 abril e 30 junho** do ano seguinte.
  - Regime Simplificado: coeficiente **0,35** sobre prestações de serviços (só 35% do rendimento é tributado). Limite: 200 000 €/ano.
  - Deduções específicas cat. B: mínimo 4 104 € ou despesas efetivas comprovadas (art.º 83.º CIRS).
  - **Mínimo de existência 2025:** 11 480 € — rendimento coletável abaixo deste valor está isento de IRS (art.º 70.º CIRS). Relevante para quem tem rendimentos baixos ou parte do ano como independente.
  - Pagamentos por conta (IRS): julho, setembro, dezembro — quando a retenção < 2/3 do imposto liquidado no ano anterior.
- **IRC (sociedades):** taxa 21% (PME: 17% até 50k€ matéria coletável). Derrama municipal até 1,5%.
- **SAF-T (PT):** obrigatório apenas para quem usa **software de faturação certificado pela AT** (Portaria 321-A/2007 e Decreto-Lei 28/2019). Quem emite faturas diretamente no **Portal e-Fatura (AT)** não tem obrigação de submeter SAF-T separado — a AT já tem acesso às faturas comunicadas. O SAF-T é exigido quando o contribuinte usa software de faturação externo certificado (ex: PHC, Primavera, Sage, etc.) e serve para exportar o ficheiro mensal de faturação para a AT.

### 3️⃣ Análise financeira e reporting
- Calcular faturação, resultado líquido, margem por obra ou serviço.
- Tesouraria e previsões mensais e anuais.
- Identificar anomalias, riscos fiscais ou otimizações.
- Ponto de equilíbrio (break-even), prazo de recuperação, ROI por obra.

### 4️⃣ Conselho estratégico e otimização
- Aconselhar sobre a melhor forma jurídica: Recibos Verdes → ENI → Unipessoal Lda → Lda.
- Otimizar encargos sociais e fiscais: deduções, amortizações (contabilidade organizada).
- **IRS Jovem (OE 2025, art.º 2.º-B CIRS):** para trabalhadores independentes com idade ≤ 35 anos, nos primeiros 10 anos de atividade, há uma isenção parcial do IRS sobre rendimentos cat. A e B: 100% no 1.º ano, 75% nos 2.º e 3.º anos, 50% nos 4.º e 5.º anos, 25% nos 6.º a 10.º anos. Limite de isenção: 55 x IAS (≈ 28 009 €/ano em 2025). Requer que o contribuinte não tenha ultrapassado 35 anos no início do benefício e não tenha auferido rendimentos nessa categoria nos 5 anos anteriores.
- Apoios e incentivos: Portugal 2030, IEFP, crédito fiscal SIFIDE, RFAI, Reabilitação Urbana.
- Seguros profissionais obrigatórios (RC Profissional, RC Obra, Acidentes de Trabalho).
- Impacto fiscal de contratação (trabalhador independente vs subordinado).
- Poupança para reforma: PPR, planos de poupança profissional.

### 5️⃣ Documentação e conformidade legal
- Menções obrigatórias em orçamentos/faturas: NIF, ATCUD, data, descrição serviço, IVA.
- Comunicação faturas à AT: via **Portal e-Fatura** (obrigatório para todos) ou SAF-T (apenas para quem usa software de faturação certificado externo).
- Checklists mensais, trimestrais e anuais.
- Conservação de documentos: **10 anos** (art.123.º CIRC / art.52.º CIVA).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏗️ REFERENCIAL TÉCNICO CONSTRUÇÃO PT 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**IVA reabilitação urbana (imóveis >30 anos habitação própria permanente ou ARIU):** 6% (art.18.º n.º1 al. a) CIVA lista I)
**IVA eficiência energética (caldeiras, isolamento, solar):** 6% (lista I CIVA)
**IVA serviços gerais construção/remodelação:** 23%
**Isenção IVA art.53.º CIVA:** ≤14 500 € faturação anual (2025); possível 15 000 € em 2026
**Autoliquidação IVA (art.º 2.º n.º 1 al. j) CIVA):** subempreitadas B2B construção → o adquirente (empreiteiro geral) liquida o IVA; o prestador emite fatura sem IVA com menção "IVA autoliquidado pelo adquirente"
**Seg. Social trabalhador independente:** 21,4% × 70% rendimento serviços | pagamento mensal até dia 20
**Isenção SS 1.º ano:** isenção total nos primeiros 12 meses de atividade (art.º 169.º CRCSPSS)
**Dispensa SS por acumulação (art.º 157.º CRCSPSS):** independente + trabalhador por conta de outrem → dispensa se rendimentos independentes ≤ 4 × IAS (≈ 24 444 €/ano)
**IRS Regime Simplificado — coeficiente serviços:** 0,35 (só 35% é tributado)
**Retenção na fonte (cat. B, art.º 101.º CIRS):** 25% (regra geral). Isenção se rendimentos estimados < 12 500 €/ano.
**IRS Jovem (art.º 2.º-B CIRS, OE 2025):** ≤ 35 anos, primeiros 10 anos atividade — isenção 100%/75%/50%/25% escalonada. Limite: 55 × IAS ≈ 28 009 €/ano.
**Mínimo de existência 2025 (art.º 70.º CIRS):** 11 480 € — rendimentos abaixo isentos de IRS.
**IAS 2025:** 509,26 €/mês — referência cálculo SS mínimo e IRS Jovem.
**Limite Regime Simplificado:** 200 000 € faturação anual
**IRC PME — taxa reduzida (até 50k€ lucro):** 17%
**IRC taxa geral:** 21%
**Derrama municipal máxima:** 1,5% do lucro tributável
**Prazo pagamento inter-empresas:** 30 dias (Lei 62/2013); juros moratórios: taxa BCE + 8%
**Prazo fatura legal:** 5 dias úteis após prestação de serviço (art.36.º CIVA)
**ATCUD:** obrigatório em todas as faturas desde 2023
**SNC — contas construção:** 31 (materiais), 61 (CMVMC), 621 (sub-empreiteiros), 622 (assistência técnica), 623 (comissões), 624 (conservação e reparação), 625 (deslocações), 626 (comunicação), 627 (publicidade), 628 (outros serviços), 636 (outros impostos), 711 (vendas), 721 (prestações de serviços)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📐 REGRAS DE CÁLCULO POR PERÍODO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quando o profissional pede análise "de X a Y" ou "do mês de Z":
1. Filtra as linhas cuja data está no período pedido
2. Soma os montantes por categoria
3. Apresenta o total E a lista detalhada das linhas incluídas
4. Calcula as implicações fiscais se pertinente
5. Propõe otimizações concretas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ FORMATO DE RESPOSTA RECOMENDADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- **Explicações claras e detalhadas** para cada cálculo e decisão fiscal
- **Tabelas, checklists e sínteses** para facilitar o acompanhamento
- **Negrito** para todos os valores-chave e montantes
- Antecipa erros possíveis e propõe soluções concretas
- Rigoroso, fiável, pedagógico e prático como um TOC sénior humano
- Mantém-se **atualizado com a legislação portuguesa 2026**
- Estrutura as respostas com secções claras (emoji + título)
- Fornece SEMPRE o cálculo detalhado quando um montante é pedido
- Se dados insuficientes: explica precisamente o que é necessário registar
- Conselhos de otimização fiscal/social proativos após cada resposta
- NÃO te apresentes em cada mensagem (apenas na primeira)
- Adapta o nível de detalhe: síntese se questão simples, análise completa se questão complexa
- NUNCA uses termos franceses: URSSAF, TVA, CA HT, micro-entrepreneur, liasse fiscale, PCG, FEC, IS français`
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []).slice(-10),
      { role: 'user', content: message },
    ]

    if (!GROQ_API_KEY) {
      return NextResponse.json({
        success: true,
        response: generateFallbackResponse(message, ctx, locale),
        fallback: true,
      })
    }

    try {
      const groqData = await callGroqWithRetry({ messages, temperature: 0.2, max_tokens: 3000 })
      let response = groqData.choices?.[0]?.message?.content || 'Je n\'ai pas pu générer une réponse. Réessayez.'
      // Ajouter disclaimer professionnel si conseil fiscal/financier
      const disclaimer = locale === 'pt'
        ? '\n\n---\n*⚠️ Informação indicativa. Consulte um contabilista certificado (TOC/ROC) para validação oficial.*'
        : '\n\n---\n*⚠️ Information indicative générée par IA. Consultez un expert-comptable agréé pour toute décision fiscale ou comptable.*'
      response += disclaimer
      return NextResponse.json({ success: true, response })
    } catch {
      return NextResponse.json({
        success: true,
        response: generateFallbackResponse(message, ctx, locale),
        fallback: true,
      })
    }

  } catch (error: unknown) {
    logger.error('[comptable-ai] Error:', error)
    return NextResponse.json({ error: 'Une erreur interne est survenue', fallback: true })
  }
}

// ─── Fallback sans Groq ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Financial context from frontend with dynamic shape
function generateFallbackResponse(message: string, ctx: Record<string, any>, locale: string = 'fr'): string {
  const msgLower = message.toLowerCase()
  const ht = ctx.annualCAHT || 0
  const totalExpenses = ctx.totalExpenses || 0

  // ─── Portuguese fiscal responses ───────────────────────────────────
  if (locale === 'pt') {
    const segSocial = ht * 0.70 * 0.214  // Taxa SS trabalhador independente PT 2026 (sobre rendimento relevante 70%)
    const irs = ht * 0.25                 // IRS retido na fonte 25% (art.º 101.º CIRS, cat. B)
    const net = ht - segSocial - irs - totalExpenses

    if (msgLower.includes('segurança social') || msgLower.includes('seg. social') || msgLower.includes('cotização') || msgLower.includes('contribui')) {
      return `💳 **Contribuições Segurança Social 2026 (Portugal)**\n\nFaturação anual s/IVA: **${fmt(ht)}**\nRendimento relevante (70%): **${fmt(ht * 0.70)}**\nTaxa SS (trabalhador independente): **21,4%**\n\n**Total SS estimado: ${fmt(segSocial)}**\n\n💡 **Atenção:** As contribuições são calculadas sobre o rendimento relevante (70% das prestações de serviços). Pagamento **mensal até ao dia 20** do mês seguinte. Declaração trimestral via Portal da Segurança Social Direta (jan/abr/jul/out).\n\n*⚠️ Valores indicativos. Consulte um TOC/ROC para validação oficial.*`
    }

    if (msgLower.includes('irs') || msgLower.includes('retenção') || msgLower.includes('retenç')) {
      return `📊 **IRS — Trabalhadores Independentes (Portugal 2026)**\n\nRendimento estimado: **${fmt(ht)}**\nRetenção na fonte (art.º 101.º CIRS): **25%**\nIRS estimado retido: **${fmt(irs)}**\n\n💡 **Isenção de retenção:** possível se rendimentos estimados < 12 500 €/ano (declaração escrita ao cliente/entidade pagadora).\n\n**Taxas IRS 2025 (escalões — Regime Simplificado, coef. 0,35):**\n- Até 8 059 €: 13%\n- 8 059 – 12 160 €: 16,5%\n- 12 160 – 17 233 €: 22%\n- 17 233 – 22 306 €: 25%\n- 22 306 – 28 400 €: 32%\n- 28 400 – 41 629 €: 35,5%\n- 41 629 – 66 045 €: 43,5%\n- Acima de 66 045 €: 48%\n\n💡 Declare na **Declaração Mod. 3 IRS** (1 abril – 30 junho). No Regime Simplificado só 35% do rendimento de serviços é tributado (coeficiente 0,35).\n\n*⚠️ Consulte um TOC para confirmação.*`
    }

    if (msgLower.includes('iva') || msgLower.includes('taxa')) {
      const limiteIVA = 14500
      const status = ht > limiteIVA ? `⚠️ **ACIMA do limite** de isenção IVA (${fmt(limiteIVA)}) — deve liquidar IVA` : `✅ Abaixo do limite de isenção IVA (${fmt(limiteIVA)}) — isento art. 53.º CIVA`
      return `💶 **IVA Portugal 2026**\n\n${status}\n\nTaxas aplicáveis:\n- **23%** taxa normal (maioria dos serviços de construção/remodelação)\n- **13%** taxa intermédia (restauração, alojamento)\n- **6%** taxa reduzida:\n  • Reabilitação de imóveis **> 2 anos** afetos a **habitação própria permanente** (verba 2.23 lista I CIVA)\n  • Imóveis em ARIU/ARU (Área de Reabilitação Urbana)\n  • Equipamentos de eficiência energética (solar, bombas calor, isolamento — verba 2.26)\n  ⚠️ Não se aplica a habitações secundárias, imóveis novos ou obras comerciais\n- **Autoliquidação IVA:** nas subempreitadas B2B (art.º 2.º n.º 1 al. j) CIVA), o empreiteiro geral liquida o IVA\n\n💡 Declaração periódica: trimestral (até 650k€) ou mensal. Submissão via **Portal e-Fatura / AT**.\n\n*⚠️ Consulte o CIVA (art. 53.º e ss.) e um TOC.*`
    }

    if (msgLower.includes('resultado') || msgLower.includes('net') || msgLower.includes('lucro') || msgLower.includes('bénéfice')) {
      return `📊 **Resultado líquido estimado ${new Date().getFullYear()}**\n\nFaturação líquida (s/IVA): **${fmt(ht)}**\n− Despesas dedutíveis: **${fmt(totalExpenses)}**\n− Seg. Social (~21,4%): **${fmt(segSocial)}**\n− IRS retido (est. 15%): **${fmt(irs)}**\n\n**= Resultado líquido: ${fmt(net)}**\n\n💡 Margem líquida: ${ht > 0 ? ((net / ht) * 100).toFixed(1) : 0}%. Referência construção PT: 12-22%.\n\n*⚠️ Informação indicativa. Consulte um TOC/ROC.*`
    }

    if (msgLower.includes('estatuto') || msgLower.includes('estrutura') || msgLower.includes('juridic')) {
      return `🏢 **Formas jurídicas — Artesãos Portugal**\n\n| Forma | Faturação máx. | Contribuições | Complexidade |\n|---|---|---|---|\n| **Recibos Verdes** | 200 000 € | SS 21,4% + IRS | Simples |\n| **ENI** | Ilimitado | SS + IRS real | Moderada |\n| **Unipessoal Lda** | Ilimitado | SS + IRC 21% | Moderada |\n| **Lda/SA** | Ilimitado | SS + IRC + dists. | Complexa |\n\n💡 **Recomendação:** Recibos verdes até ~80k€. Acima → ENI ou Unipessoal Lda para otimizar IRC vs IRS.\n\n*⚠️ Consulte um advogado/TOC para a sua situação específica.*`
    }

    return `🤖 **Léa — Contabilista IA BTP Portugal 2026**\n\nPosso ajudá-lo com:\n\n**📊 Cálculos financeiros**\n- Resultado líquido, margens por obra, tesouraria\n- IVA, IRS, Segurança Social por período\n\n**⚖️ Fiscalidade & Declarações**\n- Declaração Mod. 3 IRS, Declaração Periódica IVA\n- Contribuições Segurança Social (trimestral)\n- e-Fatura, SAF-T, ATCUD\n\n**🏢 Conselho estratégico**\n- Escolha de forma jurídica\n- Otimização de encargos\n- Apoios: Portugal 2030, IEFP, Reabilitação Urbana\n\n**📋 Conformidade legal**\n- Menções obrigatórias orçamentos/faturas\n- Checklists mensais/trimestrais\n\nColoque a sua questão!`
  }
  // ─── End PT branch ───────────────────────────────────────────────────────

  const isEntrepriseFB = ctx.orgRole === 'pro_societe'

  // Calculs adaptés au statut
  let urssaf: number, ir: number, net: number
  if (isEntrepriseFB) {
    const resultat = ht - totalExpenses
    const is15 = Math.min(Math.max(resultat, 0), 42500) * 0.15
    const is25 = Math.max(resultat - 42500, 0) * 0.25
    urssaf = 0 // pas d'URSSAF micro pour une entreprise
    ir = is15 + is25 // IS au lieu d'IR
    net = resultat - ir - 500
  } else {
    const tauxURSSAF = 0.212
    const tauxIR = 0.017
    urssaf = ht * tauxURSSAF
    ir = ht * tauxIR
    net = ht - urssaf - ir - totalExpenses - 200
  }

  interface FbExpenseRecord { category: string; date: string; label: string; amount?: string | number }
  if (msgLower.includes('matériau') || msgLower.includes('matériaux') || msgLower.includes('matière')) {
    const matLines = (ctx.allExpenses as FbExpenseRecord[] || []).filter((e) => e.category === 'materiel')
    const total = matLines.reduce((s: number, e) => s + parseFloat(String(e.amount || 0)), 0)
    const lines = matLines.map((e) => `- ${e.date} : ${e.label} → **${fmt(parseFloat(String(e.amount || 0)))}**`).join('\n')
    return `🔧 **Dépenses matériaux**\n\n**Total : ${fmt(total)}**\n\n${lines || '(Aucune dépense matériaux enregistrée)'}\n\n💡 **Optimisation :** Ces charges sont déductibles à 100% (compte 601). Conservez toutes les factures fournisseurs (10 ans). En régime réel, la TVA est récupérable.`
  }

  if (msgLower.includes('transport') || msgLower.includes('carburant') || msgLower.includes('km')) {
    const lines = (ctx.allExpenses as FbExpenseRecord[] || []).filter((e) => e.category === 'transport')
    const total = lines.reduce((s: number, e) => s + parseFloat(String(e.amount || 0)), 0)
    return `🚗 **Dépenses transport**\n\n**Total : ${fmt(total)}**\n\n${lines.map((e) => `- ${e.date} : ${e.label} → **${fmt(parseFloat(String(e.amount || 0)))}**`).join('\n') || '(Aucune dépense transport)'}\n\n💡 **Barème km 2026 :** 0,541€/km (≤5CV) | 0,635€/km (6CV) | 0,679€/km (7CV+). Notez chaque trajet professionnel avec date, départ, arrivée et motif.`
  }

  if (msgLower.includes('urssaf') || msgLower.includes('cotisation') || msgLower.includes('charges sociales')) {
    if (isEntrepriseFB) {
      return `💳 **Charges sociales — Entreprise BTP 2026**\n\nEn tant qu'entreprise (SARL/SAS), les cotisations ne se calculent PAS sur le CA mais sur la rémunération du dirigeant et les salaires.\n\n**Gérant majoritaire SARL (TNS) :** ~45% du revenu net\n**Président SAS (assimilé salarié) :** ~65-80% du salaire brut\n**Salariés :** ~45% charges patronales sur salaire brut\n\n💡 Pas de plafond micro-entrepreneur. L'entreprise paie l'IS sur le bénéfice (15% ≤ 42 500€, 25% au-delà).`
    }
    const quarters = (ctx.quarterData as number[] || [0, 0, 0, 0])
    return `💳 **Cotisations URSSAF 2026**\n\nCA HT annuel : **${fmt(ht)}**\nTaux artisan BTP : **21,2%**\n\n**Total URSSAF : ${fmt(urssaf)}**\n\nDétail par trimestre :\n${quarters.map((ca: number, q: number) => `  T${q + 1} : CA ${fmt(ca)} → URSSAF **${fmt(ca * 0.212)}** + IR **${fmt(ca * 0.017)}**`).join('\n')}\n\n💡 **Rappel :** Déclaration et paiement sur autoentrepreneur.urssaf.fr. ACRE = -50% l'année de création.`
  }

  if (msgLower.includes('bénéfice') || msgLower.includes('net') || msgLower.includes('résultat')) {
    if (isEntrepriseFB) {
      const resultat = ht - totalExpenses
      return `📊 **Résultat net estimé ${new Date().getFullYear()} — Entreprise BTP**\n\nCA HT : **${fmt(ht)}**\n− Charges d'exploitation : **${fmt(totalExpenses)}**\n= Résultat avant IS : **${fmt(resultat)}**\n− IS (15% ≤ 42 500€ + 25% au-delà) : **${fmt(ir)}**\n− CFE (estimation) : **500 €**\n\n**= Résultat net après IS : ${fmt(net)}**\n\n💡 Marge nette : ${ht > 0 ? ((net / ht) * 100).toFixed(1) : 0}%. Standard entreprise BTP : 5-15%. Optimisez via amortissements, provisions, et rémunération dirigeant.`
    }
    return `📊 **Résultat net estimé ${new Date().getFullYear()}**\n\nCA HT : **${fmt(ht)}**\n− Charges déductibles : **${fmt(totalExpenses)}**\n− URSSAF (21,2%) : **${fmt(urssaf)}**\n− IR libératoire (1,7%) : **${fmt(ir)}**\n− CFE (estimation) : **200 €**\n\n**= Résultat net : ${fmt(net)}**\n\n💡 **Conseil :** Marge nette de ${ht > 0 ? ((net / ht) * 100).toFixed(1) : 0}%. Standard BTP artisan : 15-25%. En dessous de 15% → revoir tarifs ou charges.`
  }

  if (msgLower.includes('tva') || msgLower.includes('taxe')) {
    if (isEntrepriseFB) {
      return `💶 **TVA Entreprise BTP 2026**\n\nEn tant qu'entreprise (SARL/SAS/EURL), vous êtes **obligatoirement assujettie à la TVA** — régime réel normal (CA3 mensuelle) ou simplifié (CA12 annuelle + 2 acomptes).\n\nTaux applicables :\n- **10%** : Travaux rénovation logement >2 ans (art. 279-0 bis CGI)\n- **5,5%** : Éco-rénovation (isolation, PAC, fenêtres RE2020) — art. 278-0 bis CGI\n- **20%** : Construction neuve, locaux professionnels\n\n💡 **TVA récupérable** sur tous vos achats et charges d'exploitation. Sous-traitance : auto-liquidation obligatoire (art. 283-2 nonies CGI).`
    }
    const seuilTVA = 37500
    const etat = ht > seuilTVA ? `⚠️ **DÉPASSEMENT** du seuil franchise TVA (${fmt(seuilTVA)}) — vous DEVEZ facturer la TVA` : `✅ Sous le seuil franchise TVA (${fmt(seuilTVA)}) — TVA non applicable (art. 293B CGI)`
    return `💶 **TVA BTP 2026**\n\n${etat}\n\nTaux applicables :\n- **10%** : Travaux rénovation logement >2 ans (art. 279-0 bis CGI)\n- **5,5%** : Éco-rénovation (isolation, PAC, fenêtres RE2020) — art. 278-0 bis CGI\n- **20%** : Construction neuve, locaux professionnels\n\n💡 Seuil franchise 2026 : **37 500 €** (majoré 41 250 € tolérance).`
  }

  if (msgLower.includes('structure') || msgLower.includes('statut') || msgLower.includes('juridique')) {
    return `🏢 **Choix de structure juridique BTP**\n\n| Statut | CA max | Cotisations | Complexité |\n|---|---|---|---|\n| **Micro-entrepreneur** | 77 700 € | 21,2% CA | Très simple |\n| **EI régime réel** | Illimité | TNS ~45% bénéfice | Simple |\n| **EURL/SASU** | Illimité | TNS ou assimilé salarié | Modérée |\n| **SARL/SAS** | Illimité | Selon rémunération | Complexe |\n\n💡 **Recommandation :** Micro jusqu'à 60-65k€ CA. Au-delà → EURL ou SASU pour optimiser charges et crédibilité clients pro.`
  }

  return `🤖 **Léa — Expert-comptable IA BTP 2026**\n\nJe peux vous aider sur :\n\n**📊 Calculs financiers**\n- Résultat net, marges par chantier, trésorerie\n- URSSAF, IR, TVA sur toute période\n\n**⚖️ Fiscalité & Déclarations**\n- Simulation IR / IS selon statut\n- Préparation déclarations trimestrielles\n- Franchise TVA et seuils 2026\n\n**🏢 Conseil stratégique**\n- Choix de structure juridique\n- Optimisation charges sociales\n- Aides : ACRE, CEE, MaPrimeRénov\n\n**📋 Conformité légale**\n- Mentions obligatoires devis/factures\n- Checklists mensuelles/trimestrielles\n\nPosez votre question !`
}
