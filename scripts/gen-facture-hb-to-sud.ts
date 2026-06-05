/**
 * Script Node — Génère la facture H.B SOLUTION (SAS) → SUD TRAVAUX (SAS)
 * Total HT/TTC : 43 995,41 € — Autoliquidation BTP sous-traitance (art. 283,
 * 2 nonies du CGI).
 *
 * Utilise le générateur **V3 BTP** (lib/pdf/devis-pdf-v3.ts) car HB SOLUTION
 * est une SAS (V2 force la mention "Entrepreneur individuel — Loi 2022-172",
 * trompeuse pour une SAS). V3 nécessite un environnement DOM, on stubbe le
 * minimum nécessaire en Node.
 *
 * Aligné ligne par ligne sur le relevé bancaire SUD TRAVAUX (19 sorties
 * vers H.B Solution du 16/03 au 31/03/2026, libellés "facture aix",
 * "facture roubaix", "facture chartreux", "facture nice", "facture lodi",
 * "facture rue de Toulon"…).
 *
 * Usage : npx tsx scripts/gen-facture-hb-to-sud.ts
 */

// ─── Stubs DOM minimal (V3 utilise document/URL/Blob/window pour le download)
// ─── On les neutralise pour que la génération aille jusqu'au retour du buffer.
const fakeElement: any = {
  href: '',
  download: '',
  style: {},
  click() {},
  appendChild() {},
  removeChild() {},
  setAttribute() {},
}
const g: any = globalThis as any
if (!g.document) {
  g.document = {
    createElement: () => ({ ...fakeElement }),
    body: { appendChild() {}, removeChild() {} },
  }
}
if (!g.window) {
  g.window = {
    open: () => null,
    location: { reload() {} },
    // jsPDF (lib AtobBtoa.js) fait `window.atob.bind(window)` au chargement.
    atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
  }
}
if (!g.atob) g.atob = g.window.atob
if (!g.btoa) g.btoa = g.window.btoa
if (!g.URL) g.URL = {} as any
g.URL.createObjectURL = () => 'blob:stub'
g.URL.revokeObjectURL = () => {}
if (!g.Blob) {
  g.Blob = class { constructor(_p: unknown[], _o?: unknown) {} } as any
}
if (!g.navigator) g.navigator = { userAgent: 'node' } as any
if (!g.sessionStorage) {
  const store = new Map<string, string>()
  g.sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
  } as any
}
if (!g.localStorage) {
  const lstore = new Map<string, string>()
  g.localStorage = {
    getItem: (k: string) => lstore.get(k) ?? null,
    setItem: (k: string, v: string) => { lstore.set(k, String(v)) },
    removeItem: (k: string) => { lstore.delete(k) },
    clear: () => lstore.clear(),
  } as any
}

import { readFileSync, writeFileSync } from 'fs'
import { generateDevisPdfV3 } from '../lib/pdf/devis-pdf-v3'

// ─── i18n FR : on charge le vrai dictionnaire locales/fr.json ──────────
const FR_LOCALE: Record<string, unknown> = JSON.parse(
  readFileSync('/Users/elgato_fofo/Desktop/fixit-production/locales/fr.json', 'utf8'),
)
function tFr(key: string): string {
  const parts = key.split('.')
  let cur: unknown = FR_LOCALE
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null) return key
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : key
}
import type { PdfV3Input } from '../lib/pdf/devis-pdf-v3'
import type { ProductLine } from '../lib/devis-types'

// ─── Lignes alignées sur le relevé bancaire (19 opérations, 43 995,41 €) ──
// Format : [titre court, détail prestation (corps d'état précis), montant HT]
const rawLines: Array<[string, string, number]> = [
  [
    '16/03/2026 — Placoplâtre + peinture, appartement Aix-en-Provence',
    "Dépose ancien revêtement mural. Reprise placoplâtre BA13 sur cloisons existantes (séjour + 2 chambres, ≈ 35 m²). Bandes à joints, enduit de finition, ponçage. Peinture acrylique mate blanc cassé, 2 couches sur murs et plafonds.",
    2_900,
  ],
  [
    '17/03/2026 — Peinture séjour + couloir',
    "Préparation supports (lessivage, rebouchage micro-fissures, ponçage). Sous-couche d'accrochage. Peinture acrylique satinée murs (≈ 28 m²) + peinture plafond mate (≈ 18 m²), 2 couches.",
    2_000,
  ],
  [
    '18/03/2026 — Doublage placo + isolation, chantier Roubaix',
    "Pose ossature métallique fourrures + appuis intermédiaires. Isolation thermique laine de verre 100 mm (mur extérieur, ≈ 35 m²). Doublage placoplâtre BA13 vissé. Bandes à joints, enduit, finition prête à peindre.",
    3_000,
  ],
  [
    '18/03/2026 — Carrelage sol + faïence salle de bain',
    "Préparation support (ragréage autolissant). Pose carrelage grès cérame 60×60 sur sol (≈ 10 m²) avec joint époxy. Pose faïence murale grand format sur 3 murs SDB (≈ 18 m²). Plinthes assorties.",
    4_000,
  ],
  [
    '19/03/2026 — Peinture pièce technique + reprises couloir',
    "Reprise enduit sur fissures couloir. Sous-couche universelle. Peinture acrylique blanche 2 couches plafond + murs pièce technique (≈ 9 m²). Raccords peinture couloir.",
    1_000,
  ],
  [
    '19/03/2026 — Démolition cloison non porteuse',
    "Dépose huisseries existantes. Démolition cloison plâtrière non porteuse (≈ 6 m²). Évacuation gravats en benne agréée. Reprise au sol (ragréage zone démolie) en attente finitions ultérieures.",
    2_000,
  ],
  [
    '20/03/2026 — Pose parquet contrecollé séjour',
    "Préparation sol (nettoyage, mise à niveau ponctuelle). Pose sous-couche acoustique 3 mm. Pose parquet contrecollé chêne 14 mm flottant clipsé (≈ 18 m²). Pose plinthes assorties + finition seuils.",
    1_500,
  ],
  [
    '21/03/2026 — Menuiserie intérieure',
    "Dépose bloc-porte existant. Fourniture et pose bloc-porte alvéolaire prépeint (huisserie + vantail) avec quincaillerie. Pose jambages et plinthes raccord. Finition peinture prête.",
    1_000,
  ],
  [
    '21/03/2026 — Plomberie cuisine + raccordements',
    "Dépose ancien évier + robinetterie. Reprise alimentation eau froide/chaude PER, évacuation PVC. Pose évier inox 2 bacs + mitigeur. Raccordement lave-vaisselle (eau + évac). Tests étanchéité.",
    2_900,
  ],
  [
    '22/03/2026 — Faux-plafond placo cuisine',
    "Pose ossature métallique (suspentes + fourrures). Plaques placoplâtre BA13 vissées (cuisine ≈ 12 m²). Bandes à joints, enduit garnissant + finition. Réservations pour spots LED.",
    2_000,
  ],
  [
    '24/03/2026 — Peinture WC + reprises enduit',
    "Reprise enduit garnissant zones abîmées. Ponçage. Sous-couche. Peinture acrylique satinée hydrofuge (WC ≈ 4 m²), 2 couches murs + plafond. Pose plinthes assorties.",
    1_000,
  ],
  [
    '25/03/2026 — Pose cuisine équipée',
    "Pose meubles bas et hauts cuisine équipée fournis par le client (linéaire ≈ 3,2 ml). Réglages portes et tiroirs. Pose plan de travail (stratifié), découpe évier + plaque. Raccordements simples.",
    1_000,
  ],
  [
    '26/03/2026 — Cage d\'escalier Les Chartreux (Marseille 4e)',
    "Reprise enduit sur fissures palier R+1. Ponçage. Sous-couche d'accrochage. Peinture acrylique mate murs + plafond (≈ 11 m²), 2 couches teinte ton pierre.",
    1_000,
  ],
  [
    '27/03/2026 — Rénovation chambre + dressing, appartement Nice',
    "Création cloison placo BA13 sur ossature métallique 70 mm + isolant phonique laine de roche (≈ 8 m²). Mise aux normes électriques NF C 15-100 sur la pièce (8 prises + 4 points lumineux + tableau divisionnaire). Reprise peinture complète murs + plafond après travaux (≈ 30 m²).",
    5_000,
  ],
  [
    '27/03/2026 — Reprise peinture Bd Lodi (Marseille 5e)',
    "Reprise ponctuelle peinture entrée suite traces (≈ 4 m²). Sous-couche + peinture acrylique satinée raccord teinte existante. Reprise plinthes peintes.",
    500,
  ],
  [
    '28/03/2026 — Reprise placo + bandes',
    "Reprise plafond placo BA13 zone humidité ancienne (≈ 4 m²). Découpe, remplacement plaque, bandes à joints, enduit garnissant + finition, ponçage. Préparation prête à peindre.",
    500,
  ],
  [
    '29/03/2026 — Carrelage cuisine + faïence crédence',
    "Préparation support (ragréage). Pose carrelage grès cérame imitation pierre sur sol cuisine (≈ 12 m²) avec joint hydrofuge. Pose faïence crédence métro blanc (≈ 6 m²) avec joints époxy.",
    2_600,
  ],
  [
    '31/03/2026 — Rénovation SDB complète, rue de Toulon (Marseille 6e)',
    "Dépose existant complet (ancienne douche, vasque, WC, carrelage). Reprise plomberie (alimentation PER + évac PVC). Étanchéité SEL sous carrelage. Pose carrelage grès cérame sol (≈ 6 m²) + faïence murs (≈ 18 m²). Fourniture/pose douche à l'italienne (receveur + paroi verre + colonne mitigeur thermostatique). Pose meuble vasque suspendu + miroir LED + WC suspendu avec bâti-support et plaque de commande.",
    7_000,
  ],
  [
    '31/03/2026 — Peinture complète T2 Nice + reprises placo',
    "Reprises placoplâtre (bandes + enduit) sur 2 zones abîmées. Préparation supports complète (lessivage, rebouchage, ponçage). Sous-couche universelle. Peinture acrylique mate plafonds (≈ 38 m²) + satinée murs (≈ 95 m²), 2 couches teinte blanc cassé. Reprise peinture plinthes et chambranles.",
    3_095.41,
  ],
]

const lines: ProductLine[] = rawLines.map(([description, lineDetail, amount], i) => ({
  id: i + 1,
  description,
  lineDetail,
  qty: 1,
  unit: 'f',
  priceHT: amount,
  tvaRate: 0, // autoliquidation = pas de TVA collectée par le sous-traitant
  totalHT: amount,
}))

const totalHT = lines.reduce((s, l) => s + l.totalHT, 0)
if (Math.abs(totalHT - 43_995.41) > 0.01) {
  throw new Error(`Total ${totalHT.toFixed(2)}€ != 43 995,41€ attendus`)
}

async function main() {
  // Helvetica (ISO-8859-1) ne supporte pas U+202F (NARROW NO-BREAK SPACE)
  // qu'Intl utilise comme séparateur de milliers et avant le €.
  // jsPDF rend U+202F en glyphe parasite ("/"). On force un U+00A0 (NBSP).
  const fmtEUR = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
      .format(n)
      .replace(/ /g, ' ')

  const input: PdfV3Input = {
    locale: 'fr',
    localeFormats: {
      currencyFormat: fmtEUR,
      taxLabel: 'TVA',
    },
    t: tFr,

    // Document
    docType: 'facture',
    docNumber: 'FACT-HBS-2026-001',
    docTitle: 'Travaux BTP en sous-traitance — Chantiers multi-sites mars 2026',
    docDate: '2026-03-31',
    docValidity: 30,
    prestationDate: '2026-03-31',
    executionDelay: 'Prestations exécutées du 16/03/2026 au 31/03/2026',
    factureSubType: 'standard',

    // Émetteur — H.B SOLUTION (SAS)
    companyStatus: 'SAS',
    companyName: 'H.B SOLUTION',
    companySiret: '941 761 967 00012',
    companyAddress: 'Kinnova Group — 115 Rue Claude Nicolas Ledoux, 13290 Aix-en-Provence',
    companyRCS: '941 761 967 R.C.S. Aix-en-Provence',
    companyCapital: '1 000',
    companyPhone: '—',
    companyEmail: '—',
    companyAPE: '4120A',
    tvaEnabled: true,
    tvaNumber: 'FR87 941 761 967',
    tvaIntraPreneur: 'FR45 951 819 010', // TVA intra du preneur (SUD TRAVAUX) — obligatoire en autoliquidation
    regimeTva: 'autoliquidation_btp',
    marchePrincipalRef: undefined,
    maitreOuvrageFinal:
      'SUD TRAVAUX (SAS) — Kinnova Group, 115 Rue Claude Nicolas Ledoux, 13290 Aix-en-Provence',
    insuranceName: 'À compléter par H.B SOLUTION',
    insuranceNumber: 'À compléter',
    insuranceCoverage: 'France métropolitaine',
    insuranceType: 'both',
    decennaleEligibility: 'always',
    mediatorName: '',
    mediatorUrl: '',
    isHorsEtablissement: false,

    // Destinataire — SUD TRAVAUX (SAS)
    clientName: 'SUD TRAVAUX (SAS)',
    clientEmail: '',
    clientAddress: 'Kinnova Group — 115 Rue Claude Nicolas Ledoux, 13290 Aix-en-Provence',
    clientPhone: '',
    clientSiret: '951 819 010 00012',
    clientType: 'professionnel',
    interventionAddress:
      'Chantiers multi-sites mars 2026 — Aix-en-Provence, Marseille (Les Chartreux, Bd Lodi, rue de Toulon), Nice, Roubaix',
    interventionBatiment: '',
    interventionEtage: '',
    interventionEspacesCommuns: '',
    interventionExterieur: '',

    // Payment
    paymentMode: 'Virement bancaire',
    paymentDue: 'Comptant à réception',
    paymentCondition: 'Comptant — règlement constaté par 19 virements du 16/03 au 31/03/2026',
    discount: 'Aucun escompte accordé pour paiement anticipé',
    penaltyRate: '3 × taux d\'intérêt légal en vigueur',
    recoveryFee: '40 €',
    iban: '',
    bic: '',

    // Lines & totals
    lines,
    subtotalHT: totalHT,
    totalTTC: totalHT, // autoliquidation → TTC = HT (TVA non collectée)
    tvaBreakdown: [], // pas de TVA collectée
    autoliquidationBTP: true,

    // Acomptes — non applicables (paiement déjà reçu en 19 virements)
    acomptesEnabled: false,
    acomptes: [],

    // Notes & signature
    notes:
      'Sous-traitance BTP exécutée par H.B SOLUTION pour le compte de SUD TRAVAUX ' +
      'sur les chantiers ci-dessus en mars 2026. Conformément à l\'article 283-2 nonies ' +
      'du CGI, la TVA n\'est pas collectée par le sous-traitant : elle est autoliquidée ' +
      'par le donneur d\'ordre. Règlements constatés par virement bancaire entre le ' +
      '16/03/2026 et le 31/03/2026 (19 opérations, total 43 995,41 €).',
    sourceDevisRef: null,
    signatureData: null,

    // Attachments
    attachedRapport: null,
    selectedPhotos: [],

    // Artisan stub (pas de logo)
    artisan: null,

    // PT fiscal (FR ici)
    ptFiscalData: null,

    // Helpers stubs
    svgToImageDataUrl: async () => '',
    fetchFreshLogo: async () => null,

    // Action : on capture le buffer retourné, peu importe ce que fait le download
    action: 'download',
  }

  console.log('Génération PDF facture H.B SOLUTION (SAS) → SUD TRAVAUX (SAS) via V3 BTP…')
  console.log(`  19 lignes — total HT/TTC = ${totalHT.toFixed(2).replace('.', ',')} €`)
  console.log(`  Régime TVA : autoliquidation BTP sous-traitance`)

  const result = (await generateDevisPdfV3(input)) as { filename: string; pdfArrayBuffer?: ArrayBuffer }
  if (!result.pdfArrayBuffer) {
    throw new Error('Aucun buffer PDF retourné par V3')
  }
  const outPath = '/Users/elgato_fofo/Downloads/Facture_HB-SOLUTION_to_SUD-TRAVAUX_43995-41EUR.pdf'
  writeFileSync(outPath, Buffer.from(result.pdfArrayBuffer))
  console.log(`✅ ${outPath} (${(result.pdfArrayBuffer.byteLength / 1024).toFixed(1)} KB)`)
}

main().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})
