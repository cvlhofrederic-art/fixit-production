// Générateur PDF des rapports syndic v54 (Relatório Mensal / Gestão).
//
// SÉPARÉ du PDF artisan/BTP (lib/pdf/devis-generator-v2.ts, devis-pdf-v3.ts) — RÈGLE #1 :
// ce fichier ne touche JAMAIS au pipeline devis/facture artisan. Il reproduit fidèlement
// l'aperçu déjà affiché à l'écran (« Pré-visualização do relatório ») dans un PDF A4 —
// aucune nouvelle décision de design : couleurs = tokens v54, structure = preview existant.
//
// pdf-lib est importé DYNAMIQUEMENT (lazy) pour ne pas l'embarquer dans le bundle principal.
// Police Helvetica (WinAnsi) : couvre les accents portugais (ã ç õ á é í ó). Les espaces
// fines insécables produites par Intl.NumberFormat('pt-PT') (U+202F) ne sont PAS dans WinAnsi
// → normalisées en espace ordinaire par safe() pour éviter une exception d'encodage.

export interface ReportRow {
  /** Titre de la ligne (ex. « Edifício Aurora — Manutenção corrente »). */
  label: string
  /** Sous-ligne grise (ex. « Bruno Tavares · 12/04/2026 »). */
  sub: string
  /** Montant aligné à droite (ex. « 1 250,00 € »). */
  montante: string
}

export interface ReportStat {
  value: string
  label: string
  tone: 'gold' | 'sage'
}

export interface ReportModel {
  docTitle: string
  periodLabel: string
  geradoA: string
  stats: ReportStat[]
  sectionTitle: string
  rows: ReportRow[]
  legal: string
}

/** Normalise les caractères non encodables en WinAnsi (surtout U+202F/U+00A0 des nombres pt-PT). */
export function safe(s: string): string {
  return String(s ?? '')
    .replace(/[\u202F\u2009\u00A0]/g, ' ') // espaces fines/insecables (Intl pt-PT) -> espace ordinaire
    .replace(/[\u2018\u2019]/g, "'") // guillemets simples typographiques
    .replace(/[\u201C\u201D]/g, '"') // guillemets doubles typographiques
}

/** Rend le PDF du rapport (Uint8Array). Pur : aucune dépendance DOM. */
export async function renderReportPdf(model: ReportModel): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const hex = (h: string) => {
    const n = parseInt(h.slice(1), 16)
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
  }
  const C = {
    navy900: hex('#0B1828'), navy500: hex('#2A4663'), navy300: hex('#5A6B7D'), navy200: hex('#7D8A99'),
    gold700: hex('#846838'), gold500: hex('#C9A574'), gold50: hex('#F8F2E6'),
    sage50: hex('#ECF2EC'), ink: hex('#1A1A1A'), line: hex('#E7E9EC'), white: rgb(1, 1, 1),
  }

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const A4: [number, number] = [595.28, 841.89]
  const M = 48
  const HEAD = 96

  let page = doc.addPage(A4)
  const { width, height } = page.getSize()
  let y = 0

  const T = (s: string, x: number, yy: number, size: number, f = font, color = C.ink) =>
    page.drawText(safe(s), { x, y: yy, size, font: f, color })
  const TR = (s: string, xr: number, yy: number, size: number, f = font, color = C.ink) => {
    const w = f.widthOfTextAtSize(safe(s), size)
    page.drawText(safe(s), { x: xr - w, y: yy, size, font: f, color })
  }
  const TC = (s: string, cx: number, yy: number, size: number, f = font, color = C.ink) => {
    const w = f.widthOfTextAtSize(safe(s), size)
    page.drawText(safe(s), { x: cx - w / 2, y: yy, size, font: f, color })
  }
  const hr = (yy: number, thick = 0.5) => page.drawLine({ start: { x: M, y: yy }, end: { x: width - M, y: yy }, thickness: thick, color: C.line })

  // ── En-tête (bandeau navy) — page 1 uniquement ──
  page.drawRectangle({ x: 0, y: height - HEAD, width, height: HEAD, color: C.navy900 })
  T(model.docTitle.toUpperCase(), M, height - 42, 10.5, bold, C.gold500)
  TR(model.periodLabel, width - M, height - 60, 25, bold, C.white)
  TR(`Gerado a ${model.geradoA}`, width - M, height - 78, 9, font, C.navy200)
  y = height - HEAD - 30

  // ── Cartes de statistiques ──
  const n = Math.max(model.stats.length, 1)
  const gap = 12
  const boxW = (width - 2 * M - gap * (n - 1)) / n
  const boxH = 62
  model.stats.forEach((s, i) => {
    const x = M + i * (boxW + gap)
    page.drawRectangle({ x, y: y - boxH, width: boxW, height: boxH, color: s.tone === 'sage' ? C.sage50 : C.gold50, borderColor: C.line, borderWidth: 0.5 })
    TC(s.value, x + boxW / 2, y - 30, 21, bold, C.ink)
    TC(s.label, x + boxW / 2, y - 48, 8, font, C.navy500)
  })
  y -= boxH + 34

  // ── Section liste ──
  T(model.sectionTitle, M, y, 15, bold, C.ink)
  y -= 10
  hr(y)
  y -= 22

  const ensure = (need: number) => {
    if (y - need < M + 40) {
      page = doc.addPage(A4)
      y = height - M
    }
  }

  if (model.rows.length === 0) {
    T('Nenhuma intervenção neste período.', M, y, 10, font, C.navy300)
    y -= 18
  } else {
    for (const r of model.rows) {
      ensure(34)
      T(r.label, M, y, 11, bold, C.ink)
      TR(r.montante, width - M, y, 11, bold, C.ink)
      y -= 14
      T(r.sub, M, y, 9, font, C.navy300)
      y -= 12
      hr(y, 0.4)
      y -= 12
    }
  }

  // ── Pied de page légal (dernière page) ──
  hr(M + 14)
  T(model.legal, M, M, 7.5, font, C.navy300)

  return await doc.save()
}

/** Génère et déclenche le téléchargement côté navigateur. Lève côté serveur. */
export async function downloadReportPdf(model: ReportModel, filename: string): Promise<void> {
  if (typeof document === 'undefined') throw new Error('Téléchargement PDF indisponible côté serveur')
  const bytes = await renderReportPdf(model)
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
