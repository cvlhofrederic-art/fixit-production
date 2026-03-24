import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// ── POST /api/client/extract-pdf ────────────────────────────────────────────
// Extraction de texte PDF côté client avec nettoyage post-extraction
// + Parser calibré pour devis Vitfix Pro

// Regex prix : gère "1 800,00 €", "800,00€", "1800.00", etc.
const PRICE_REGEX = /\d[\d\s]*[.,]\d{2}\s*€/g

function cleanExtractedText(raw: string): string {
  let text = raw
  text = text.replace(/(\w)-\n(\w)/g, '$1$2')
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  text = text.replace(/(Prix unitaire\s*HT|Quantité|Total\s*HT|Montant\s*HT|Montant\s*TTC|Taux\s*TVA|Unité)/gi, '\n$1')
  text = text.replace(/(\S)\s+(\d+\))/g, '$1\n$2')
  text = text.replace(/(Émetteur|Destinataire|Conditions|Détail|Bon pour accord)/gi, '\n\n$1')
  text = text.replace(/([a-zéèêëàâùûôîïç])\s{2,}(\d[\d\s]*[.,]\d{2}\s*€)/gi, '$1\n$2')
  text = text.replace(/[ \t]{3,}/g, '  ')
  text = text.replace(/\n{4,}/g, '\n\n\n')
  text = text.replace(/^[_\-=]{5,}$/gm, '---')
  text = text.replace(/Page\s+\d+\s+sur\s+\d+/gi, '')
  return text.trim()
}

function assessQuality(text: string): 'good' | 'mediocre' | 'poor' {
  const pricePatterns = (text.match(PRICE_REGEX) || []).length
  const lines = text.split('\n').filter(l => l.trim().length > 0).length
  const avgLineLen = text.length / Math.max(lines, 1)
  const hasKeywords = /siret|tva|ht|ttc|devis|facture/i.test(text)
  if (pricePatterns >= 3 && avgLineLen > 15 && hasKeywords) return 'good'
  if (pricePatterns >= 1 || hasKeywords) return 'mediocre'
  return 'poor'
}

// ── Parser calibré pour devis Vitfix Pro ────────────────────────────────────
// Extrait les données structurées directement depuis le texte (positions connues)
interface VitfixParsedData {
  emetteur: { nom: string; siret: string; adresse: string; telephone: string; email: string; assurance: string }
  destinataire: { nom: string; adresse: string }
  document: { type: string; numero: string; date: string; validite: string; delai: string }
  prestations: Array<{
    designation: string
    type: 'prestation' | 'description' | 'etape'
    quantite: number
    unite: string
    prix_unitaire: number
    total: number
  }>
  totaux: { soustotal_ht: number; tva_taux: number; tva_montant: number; total_ttc: number }
  acomptes: Array<{ label: string; montant: number; date: string }>
  conditions: string
  mentions: string[]
}

function parseVitfixDevis(text: string): VitfixParsedData | null {
  try {
    const result: VitfixParsedData = {
      emetteur: { nom: '', siret: '', adresse: '', telephone: '', email: '', assurance: '' },
      destinataire: { nom: '', adresse: '' },
      document: { type: 'devis', numero: '', date: '', validite: '', delai: '' },
      prestations: [],
      totaux: { soustotal_ht: 0, tva_taux: 0, tva_montant: 0, total_ttc: 0 },
      acomptes: [],
      conditions: '',
      mentions: [],
    }

    // Numéro de devis : DEV-YYYY-NNN
    const devMatch = text.match(/DEV-(\d{4})-(\d{3,})/i)
    if (devMatch) result.document.numero = devMatch[0]

    // SIRET
    const siretMatch = text.match(/SIRET\s*:?\s*(\d[\d\s]{12}\d)/i)
    if (siretMatch) result.emetteur.siret = siretMatch[1].replace(/\s/g, '')

    // Émetteur (entre "ÉMETTEUR" et "DESTINATAIRE")
    const emBlock = text.match(/[ÉE]METTEUR\s*\n?([\s\S]*?)(?=DESTINATAIRE|$)/i)
    if (emBlock) {
      const lines = emBlock[1].split('\n').map(l => l.trim()).filter(Boolean)
      if (lines[0]) result.emetteur.nom = lines[0]
      const addrLines = lines.filter(l => /\d{5}/.test(l) || /rue|avenue|boulevard|chemin|allée|impasse|place/i.test(l))
      if (addrLines.length) result.emetteur.adresse = addrLines.join(', ')
      const telMatch = emBlock[1].match(/(?:0[1-9][\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}|\+33[\s.]?\d[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2})/)
      if (telMatch) result.emetteur.telephone = telMatch[0].replace(/\s/g, '')
      const emailMatch = emBlock[1].match(/[\w.-]+@[\w.-]+\.\w+/)
      if (emailMatch) result.emetteur.email = emailMatch[0]
    }

    // Destinataire
    const destBlock = text.match(/DESTINATAIRE\s*\n?([\s\S]*?)(?=DATE|DÉSIGNATION|PRESTATION|$)/i)
    if (destBlock) {
      const lines = destBlock[1].split('\n').map(l => l.trim()).filter(Boolean)
      if (lines[0]) result.destinataire.nom = lines[0]
      const addrLines = lines.filter(l => /\d{5}/.test(l))
      if (addrLines.length) result.destinataire.adresse = addrLines.join(', ')
    }

    // Dates
    const dateEmMatch = text.match(/DATE\s*D['']?[ÉE]MISSION\s*:?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i)
    if (dateEmMatch) result.document.date = dateEmMatch[1]
    const validMatch = text.match(/VALIDIT[ÉE]\s*:?\s*(\d+\s*(?:jours?|mois))/i)
    if (validMatch) result.document.validite = validMatch[1]
    const delaiMatch = text.match(/D[ÉE]LAI\s*(?:D['']?EX[ÉE]CUTION)?\s*:?\s*([^\n]+)/i)
    if (delaiMatch) result.document.delai = delaiMatch[1].trim()

    // Prestations (lignes avec prix)
    // Pattern Vitfix : titre en bold suivi de description et étapes
    const lines = text.split('\n')
    let currentPrestation: string | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Ligne avec prix (QTÉ × Prix = Total)
      const priceLineMatch = line.match(/(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\w+)\s+(\d[\d\s]*[.,]\d{2})\s*€?\s+(\d[\d\s]*[.,]\d{2})\s*€/)
      if (priceLineMatch) {
        const [, designation, qty, unite, prixU, total] = priceLineMatch
        result.prestations.push({
          designation: designation.trim(),
          type: 'prestation',
          quantite: parseFloat(qty.replace(',', '.')),
          unite: unite.trim(),
          prix_unitaire: parseFloat(prixU.replace(/\s/g, '').replace(',', '.')),
          total: parseFloat(total.replace(/\s/g, '').replace(',', '.')),
        })
        currentPrestation = designation.trim()
        continue
      }

      // Étapes numérotées sous une prestation
      const etapeMatch = line.match(/^(\d+)\.\s+(.+)/)
      if (etapeMatch && currentPrestation) {
        result.prestations.push({
          designation: `${etapeMatch[1]}. ${etapeMatch[2]}`,
          type: 'etape',
          quantite: 0,
          unite: '',
          prix_unitaire: 0,
          total: 0,
        })
        continue
      }

      // Description sans prix sous une prestation
      if (currentPrestation && !line.match(/^[A-Z]{3,}/) && !line.match(/\d+[.,]\d{2}\s*€/) && line.length > 10 && line.length < 200) {
        result.prestations.push({
          designation: line,
          type: 'description',
          quantite: 0,
          unite: '',
          prix_unitaire: 0,
          total: 0,
        })
      }
    }

    // Totaux
    const totalNetMatch = text.match(/TOTAL\s*NET\s*:?\s*(\d[\d\s]*[.,]\d{2})\s*€/i)
    if (totalNetMatch) result.totaux.total_ttc = parseFloat(totalNetMatch[1].replace(/\s/g, '').replace(',', '.'))

    const soustotalMatch = text.match(/SOUS[- ]TOTAL\s*(?:HT)?\s*:?\s*(\d[\d\s]*[.,]\d{2})\s*€/i)
    if (soustotalMatch) result.totaux.soustotal_ht = parseFloat(soustotalMatch[1].replace(/\s/g, '').replace(',', '.'))

    const tvaMatch = text.match(/TVA\s*(?:non applicable|franchise)/i)
    if (tvaMatch) {
      result.totaux.tva_taux = 0
      result.totaux.tva_montant = 0
      result.mentions.push('Franchise TVA')
    } else {
      const tvaTauxMatch = text.match(/TVA\s*(\d+(?:[.,]\d+)?)\s*%/i)
      if (tvaTauxMatch) result.totaux.tva_taux = parseFloat(tvaTauxMatch[1].replace(',', '.'))
    }

    // Acomptes
    const acompteMatches = text.matchAll(/Acompte\s*\d+\s*:?\s*(\d[\d\s]*[.,]\d{2})\s*€(?:\s*(?:le|avant)\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}))?/gi)
    for (const m of acompteMatches) {
      result.acomptes.push({
        label: m[0].split(':')[0]?.trim() || 'Acompte',
        montant: parseFloat(m[1].replace(/\s/g, '').replace(',', '.')),
        date: m[2] || '',
      })
    }

    // Conditions
    const condBlock = text.match(/CONDITIONS\s*\n?([\s\S]*?)(?=BON POUR|PÉNALITÉ|ÉCHÉANCIER|$)/i)
    if (condBlock) result.conditions = condBlock[1].trim().substring(0, 500)

    // Mentions légales détectées
    if (result.emetteur.siret) result.mentions.push('SIRET')
    if (/TVA/i.test(text)) result.mentions.push('TVA')
    if (/RC\s*Pro|responsabilit[ée]\s*civile/i.test(text)) result.mentions.push('RC Pro')
    if (/d[ée]cennale/i.test(text)) result.mentions.push('Garantie décennale')
    if (/p[ée]nalit[ée]s?\s*de\s*retard/i.test(text)) result.mentions.push('Pénalités de retard')
    if (/40\s*€|indemnit[ée]\s*forfaitaire/i.test(text)) result.mentions.push('Indemnité 40€')
    if (/r[ée]tractation/i.test(text)) result.mentions.push('Droit de rétractation')
    if (/m[ée]diateur/i.test(text)) result.mentions.push('Médiateur')
    if (/entrepreneur\s*individuel|sarl|eurl|sas|sasu|auto-entrepreneur|micro/i.test(text)) result.mentions.push('Statut juridique')
    if (/Document g[ée]n[ée]r[ée] par Vitfix/i.test(text)) result.mentions.push('Vitfix Pro')

    return result
  } catch (err) {
    logger.warn('[extract-pdf] Vitfix parser error:', err)
    return null
  }
}

// ── Détection Vitfix ────────────────────────────────────────────────────────
function isVitfixDocument(text: string): boolean {
  if (text.includes('[VITFIX-DEVIS-METADATA]')) return true
  if (/DEV-\d{4}-\d{3,}/.test(text)) return true
  // Signature structurelle : ÉMETTEUR + DESTINATAIRE + bandeau + TOTAL NET
  const hasStructure = /[ÉE]METTEUR/i.test(text) && /DESTINATAIRE/i.test(text) && /TOTAL\s*NET/i.test(text)
  const hasVitfixSignature = /Document g[ée]n[ée]r[ée] par Vitfix/i.test(text)
  return hasStructure && hasVitfixSignature
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const ok = await checkRateLimit(`extract-pdf-client:${ip}`, 10, 60_000)
  if (!ok) return rateLimitResponse()

  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Fichier trop volumineux (max 20 Mo)' }, { status: 400 })

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) return NextResponse.json({ error: 'Format non supporté. Utilisez un fichier PDF.' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length < 5 || buffer.slice(0, 4).toString('ascii') !== '%PDF') {
      return NextResponse.json({ error: 'Le fichier ne semble pas être un PDF valide.', isCorrupt: true }, { status: 422 })
    }

    const { extractText } = await import('unpdf')
    let text = ''
    let numPages = 0

    try {
      const uint8 = new Uint8Array(buffer)
      const result = await extractText(uint8, { mergePages: true })
      text = result.text || ''
      numPages = result.totalPages || 0
    } catch (parseErr: any) {
      const errMsg = (parseErr?.message || '').toLowerCase()
      if (errMsg.includes('password') || errMsg.includes('encrypted')) {
        return NextResponse.json({ error: 'Ce PDF est protégé par un mot de passe.', isPasswordProtected: true }, { status: 422 })
      }
      if (errMsg.includes('invalid') || errMsg.includes('corrupt')) {
        return NextResponse.json({ error: 'Le fichier PDF semble corrompu.', isCorrupt: true }, { status: 422 })
      }
      return NextResponse.json({ error: 'Impossible d\'extraire le texte. Essayez de coller le texte manuellement.', isScanned: true }, { status: 422 })
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'Ce PDF ne contient pas de texte. Collez le texte manuellement.', isScanned: true }, { status: 422 })
    }

    const cleaned = cleanExtractedText(text)
    const isVitfix = isVitfixDocument(cleaned)

    // Si Vitfix : parser calibré en plus du texte brut
    let vitfixData: VitfixParsedData | null = null
    if (isVitfix) {
      vitfixData = parseVitfixDevis(cleaned)
    }

    const quality = isVitfix ? 'good' : assessQuality(cleaned)

    return NextResponse.json({
      success: true,
      text: cleaned,
      pages: numPages,
      filename: file.name,
      chars: cleaned.length,
      quality,
      isVitfix,
      vitfixData, // null si pas Vitfix, sinon données structurées
    })
  } catch (err: any) {
    logger.error('[EXTRACT-PDF-CLIENT] Error:', err?.message || err)
    return NextResponse.json({ error: 'Erreur inattendue. Réessayez.' }, { status: 500 })
  }
}
