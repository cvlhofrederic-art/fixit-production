// Génération de rapports PDF côté client pour le dashboard syndic v54.
//
// jsPDF + jspdf-autotable (déjà dans le stack, optimizePackageImports). Aucune dépendance
// serveur : génération + téléchargement dans le navigateur (comme lib/rapport-pdf.ts).
// API générique réutilisée par tous les boutons « Descarregar PDF » des modules v54.

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface PdfKpi { label: string; value: string }
export interface PdfTable { caption?: string; headers: string[]; rows: (string | number)[][] }
export interface ReportSpec {
  title: string
  subtitle?: string
  periodLabel?: string
  kpis?: PdfKpi[]
  tables?: PdfTable[]
  notes?: string
}

const NAVY: [number, number, number] = [27, 42, 74]
const PANEL: [number, number, number] = [243, 244, 246]
const ALT: [number, number, number] = [247, 248, 250]
const INK: [number, number, number] = [26, 26, 26]
const MUTED: [number, number, number] = [107, 114, 128]

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } }

const today = (): string => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

/**
 * Construit et télécharge un rapport PDF (A4) depuis une spec générique :
 * bandeau titre, grille de KPIs, tables (autotable), notes, pied de page paginé.
 * Lève côté serveur (à appeler depuis un handler client). Calque l'esprit de
 * lib/rapport-pdf.ts (jsPDF, Helvetica, palette navy/gold).
 */
export function downloadReportPdf(filename: string, spec: ReportSpec): void {
  if (typeof document === 'undefined') throw new Error('Geração de PDF indisponível no servidor')

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 14
  let y = 34

  // ── Bandeau d'en-tête ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(spec.title, M, 13)
  if (spec.subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(203, 213, 225)
    doc.text(spec.subtitle, M, 19.5)
  }
  doc.setFontSize(9)
  doc.setTextColor(252, 211, 77)
  doc.text(spec.periodLabel ? `${spec.periodLabel}` : `Gerado a ${today()}`, W - M, 13, { align: 'right' })
  if (spec.periodLabel) {
    doc.setTextColor(203, 213, 225)
    doc.text(`Gerado a ${today()}`, W - M, 19.5, { align: 'right' })
  }

  // ── KPIs (grille de cartes) ──
  if (spec.kpis?.length) {
    const cols = Math.min(3, spec.kpis.length)
    const gap = 4
    const bw = (W - 2 * M - (cols - 1) * gap) / cols
    const bh = 17
    spec.kpis.forEach((k, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = M + col * (bw + gap)
      const by = y + row * (bh + gap)
      doc.setFillColor(...PANEL)
      doc.roundedRect(x, by, bw, bh, 2, 2, 'F')
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text(String(k.value), x + 4, by + 8, { maxWidth: bw - 8 })
      doc.setTextColor(...MUTED)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(k.label, x + 4, by + 13.5, { maxWidth: bw - 8 })
    })
    y += Math.ceil(spec.kpis.length / cols) * (bh + gap) + 4
  }

  // ── Tables ──
  for (const t of spec.tables ?? []) {
    if (t.caption) {
      doc.setTextColor(...NAVY)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(t.caption, M, y + 2)
      y += 6
    }
    autoTable(doc, {
      head: [t.headers],
      body: t.rows.map((r) => r.map(String)),
      startY: y,
      margin: { left: M, right: M },
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: NAVY, textColor: 255 },
      alternateRowStyles: { fillColor: ALT },
    })
    const after = (doc as DocWithTable).lastAutoTable?.finalY
    y = (after ?? y) + 8
  }

  // ── Notes ──
  if (spec.notes) {
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Observações', M, y)
    y += 6
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.text(doc.splitTextToSize(spec.notes, W - 2 * M), M, y)
  }

  // ── Pied de page paginé ──
  const H = doc.internal.pageSize.getHeight()
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Gerado por Vitfix · vitfix.io', M, H - 8)
    doc.text(`${p}/${pages}`, W - M, H - 8, { align: 'right' })
  }

  doc.save(filename)
}
