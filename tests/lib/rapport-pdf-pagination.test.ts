// tests/lib/rapport-pdf-pagination.test.ts
//
// PDF des rapports du module (lib/rapport-pdf.ts), artisan comme société BTP sans gabarit propre : rien ne passait à la
// page suivante. Au-delà de six photos liées, les cadres de signature sortaient de la page sous le pied ; une longue
// liste de travaux ou de matériaux sortait de la page 1. Maintenant, la suite passe à une nouvelle page (en-tête réduit,
// en-tête du tableau répété) et le bloc des signatures ne se coupe pas. jsPDF tourne pour de vrai, le texte est relu
// avec pdf.js ; photos simulées (chargement en échec immédiat). Données fictives.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateRapportPDF, type RapportPDFData } from '@/lib/rapport-pdf'
import { lirePdf, lu, type Texte } from '../helpers/lecture-pdf'

const sauvegardes = vi.hoisted(() => [] as Array<{ nom: string; pdf: { output: (type: 'arraybuffer') => ArrayBuffer } }>)

vi.mock('jspdf', async (original) => {
  const m = await original<typeof import('jspdf')>()
  class JsPdfEspion extends m.jsPDF {
    constructor(...args: ConstructorParameters<typeof m.jsPDF>) {
      super(...args)
      this.save = ((nom: string) => {
        sauvegardes.push({ nom, pdf: this })
        return this
      }) as unknown as InstanceType<typeof m.jsPDF>['save']
    }
  }
  return { ...m, jsPDF: JsPdfEspion, default: JsPdfEspion }
})

/** Image du navigateur simulée : le chargement échoue tout de suite (la case « photo non disponible » s'affiche). */
class ImageEnEchec {
  width = 0
  height = 0
  crossOrigin = ''
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_url: string) { setTimeout(() => this.onerror?.(), 0) }
}

let imageAvant: unknown
beforeEach(() => {
  sauvegardes.length = 0
  imageAvant = (window as unknown as { Image: unknown }).Image
  ;(window as unknown as { Image: unknown }).Image = ImageEnEchec
})
afterEach(() => {
  ;(window as unknown as { Image: unknown }).Image = imageAvant
})

const PHOTOS = Array.from({ length: 12 }, (_, i) => ({ id: `photo-${i + 1}`, url: `https://example.test/${i + 1}.jpg` }))

function rapport(surcharge: Partial<RapportPDFData> = {}): RapportPDFData {
  return {
    rapportNumber: 'RAP-2026-001', refDevisFact: '', artisanName: 'Entreprise Exemple', artisanAddress: '1 rue de l’Exemple, 13000 Marseille',
    artisanPhone: '06 00 00 00 00', artisanEmail: 'contact@example.fr', artisanSiret: '00000000000000', artisanInsurance: '',
    clientName: 'Client Exemple', clientPhone: '', clientEmail: '', clientAddress: '2 rue du Client, 13000 Marseille',
    interventionDate: '2026-11-25', startTime: '09:00', endTime: '11:00', siteAddress: '', motif: 'Reprise de fissures',
    travaux: ['Rebouchage'], materiaux: ['Enduit (2 sacs)'], observations: '', recommendations: '', status: 'termine',
    linkedPhotoIds: [], ...surcharge,
  }
}

async function pages(r: RapportPDFData, locale: string, orgRole: string): Promise<Texte[][]> {
  await generateRapportPDF(r, PHOTOS, locale, orgRole)
  expect(sauvegardes).toHaveLength(1)
  return lirePdf(new Uint8Array(sauvegardes[0].pdf.output('arraybuffer')))
}

/** Le pied (« … Page x / n ») est seul sous y = 25 ; tout le reste au-dessus du filet du pied de page. */
function dansLaPage(lues: Texte[][], mot: string) {
  lues.forEach((page, i) => {
    const pied = page.filter((m) => m.y < 25).sort((a, b) => a.x - b.x).map((m) => lu(m.str)).join(' ')
    expect(pied).toMatch(new RegExp(`${mot} ${i + 1} / ${lues.length}$`))
    for (const m of page) {
      if (m.y < 25) continue
      expect(m.y, `« ${m.str} » sous le filet du pied (page ${i + 1})`).toBeGreaterThan(40)
    }
  })
}

const texte = (lues: Texte[][]) => lues.map((p) => p.map((m) => lu(m.str)).join(' ')).join(' ')

describe('PDF des rapports du module : pagination', () => {
  it('artisan, 12 photos liées : les photos et les signatures passent aux pages suivantes, dans la page', async () => {
    const lues = await pages(rapport({ linkedPhotoIds: PHOTOS.map((p) => p.id) }), 'fr-FR', 'artisan')
    expect(lues.length).toBeGreaterThan(2)
    dansLaPage(lues, 'Page')
    const t = texte(lues)
    expect(t.match(/Photo non disponible/g)).toHaveLength(12)
    expect(t.match(/SIGNATURE CLIENT/g)).toHaveLength(1)
    // Signatures entières sur une seule page : libellé, nom et ligne de date ensemble.
    const pageSignatures = lues.findIndex((p) => p.some((m) => m.str === 'SIGNATURE CLIENT'))
    expect(lues[pageSignatures].filter((m) => m.str.startsWith('Date')).length).toBe(2)
  })

  it('longues listes de travaux et de matériaux : suite sur une nouvelle page, en-tête du tableau répété', async () => {
    const travaux = Array.from({ length: 40 }, (_, i) => `Travaux n° ${i + 1}`)
    const materiaux = Array.from({ length: 30 }, (_, i) => `Matériau n° ${i + 1} (${i + 1} u)`)
    const lues = await pages(rapport({ travaux, materiaux }), 'pt-PT', 'pro_societe')
    dansLaPage(lues, 'Página')
    const t = texte(lues)
    for (let i = 1; i <= 40; i++) expect(t).toContain(`Travaux n° ${i}`)
    for (let i = 1; i <= 30; i++) expect(t).toContain(`Matériau n° ${i}`)
    const pagesMateriaux = lues.filter((p) => p.some((m) => m.str.startsWith('Matériau n°')))
    for (const p of pagesMateriaux) expect(p.some((m) => m.str === 'DESIGNAÇÃO')).toBe(true)
  })

  it('rapport court : toujours deux pages, comme avant', async () => {
    const lues = await pages(rapport(), 'fr-FR', 'artisan')
    expect(lues).toHaveLength(2)
    dansLaPage(lues, 'Page')
  })
})
