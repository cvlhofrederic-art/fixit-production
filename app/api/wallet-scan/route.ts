import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody, walletScanSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const maxDuration = 30 // 30s timeout for PDF parsing

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/wallet-scan
// Scanne un document uploadé (PDF/image) et en extrait les données clés.
// Anti-fraude : vérifie que le nom sur le document correspond à l'artisan.
// ═══════════════════════════════════════════════════════════════════════════

interface ScanResult {
  docType: string // rc_pro, decennale, kbis, urssaf, qualibat, qualigaz, rge, habilitation_elec, etc.
  confidence: number // 0-1
  extractedData: {
    // Assurance
    insurerName?: string       // ex: "BPCE IARD"
    contractNumber?: string    // ex: "113332889"
    coverage?: string          // ex: "France métropolitaine"
    insuranceType?: string     // rc_pro | decennale | both
    validFrom?: string         // ISO date
    validTo?: string           // ISO date
    // Kbis
    siret?: string
    siren?: string
    companyName?: string
    legalForm?: string
    registrationCity?: string
    // URSSAF
    urssafNumber?: string
    // Commun
    holderName?: string        // Nom sur le document
    holderAddress?: string
  }
  antiFraud: {
    nameMatch: boolean         // Nom document ≈ nom artisan
    nameOnDoc: string          // Nom trouvé sur le document
    nameOnProfile: string      // Nom du profil artisan
    siretMatch: boolean | null // SIRET correspond (null si pas applicable)
    dateValid: boolean         // Document pas expiré
    typeCorrect: boolean       // Type de document cohérent avec le slot
    suspicious: boolean        // Flag global
    reasons: string[]          // Raisons de suspicion
  }
}

// ── Patterns de détection par type de document ──────────────────────────────
const DOC_PATTERNS = {
  rc_pro: [
    /attestation\s+d['']?assurance/i,
    /responsabilit[ée]\s+civile\s+professionnelle/i,
    /multirisque\s+professionnelle/i,
    /rc\s+pro/i,
    /assurance\s+professionnelle/i,
    /garantie.*responsabilit/i,
  ],
  decennale: [
    /assurance\s+d[ée]cennale/i,
    /garantie\s+d[ée]cennale/i,
    /responsabilit[ée].*d[ée]cennale/i,
    /dommages[\s-]ouvrage/i,
  ],
  kbis: [
    /extrait\s+kbis/i,
    /registre\s+du\s+commerce/i,
    /extrait.*immatriculation/i,
    /greffe\s+du\s+tribunal/i,
    /r[ée]pertoire\s+national\s+des\s+entreprises/i,
    /extrait\s+rne/i,
  ],
  urssaf: [
    /attestation\s+de\s+vigilance/i,
    /urssaf/i,
    /cotisations\s+sociales/i,
    /s[ée]curit[ée]\s+sociale/i,
    /attestation.*jour.*obligations/i,
  ],
  qualibat: [
    /qualibat/i,
    /qualification\s+professionnelle/i,
    /certificat\s+qualibat/i,
    /organisme\s+de\s+qualification/i,
  ],
  qualigaz: [
    /qualigaz/i,
    /certification\s+gaz/i,
    /installation.*gaz/i,
    /professionnel.*gaz.*naturel/i,
  ],
  quali_eau: [
    /quali.?eau/i,
    /qualit[ée]\s+eau/i,
    /r[ée]seau\s+d.?eau\s+potable/i,
    /l[ée]gionellose/i,
  ],
  fluides_frigorigenes: [
    /fluides?\s+frigorig[èe]nes?/i,
    /attestation\s+de\s+capacit[ée]/i,
    /manipulation.*fluide/i,
    /r[èe]glement.*f-gaz/i,
    /cat[ée]gorie\s+[IViv]{1,3}/i,
  ],
  rge: [
    /reconnu\s+garant\s+de\s+l.?environnement/i,
    /\brge\b/i,
    /certificat\s+rge/i,
    /qualit.?enr/i,
    /maprim.*r[ée]nov/i,
  ],
  carte_btp: [
    /carte\s+(?:d.?identification\s+)?(?:professionnelle\s+)?btp/i,
    /carte\s+pro\s+btp/i,
    /cibtp/i,
    /carte.*identification.*professionnel/i,
  ],
  habilitation_elec: [
    /habilitation\s+[ée]lectr/i,
    /nf\s+c\s*18[\s-]*510/i,
    /\b(?:BR|B1|B2|BC|H0|H1|H2)\b.*[ée]lectr/i,
    /titre\s+d.?habilitation/i,
  ],
  qualifelec: [
    /qualifelec/i,
    /qualification.*[ée]lectri/i,
    /certificat\s+qualifelec/i,
  ],
  irve: [
    /\birve\b/i,
    /borne.*recharge/i,
    /v[ée]hicule.*[ée]lectrique/i,
    /infrastructure.*recharge/i,
  ],
  amiante_ss4: [
    /amiante/i,
    /sous[\s-]*section\s+[34]/i,
    /\bss[34]\b/i,
    /d[ée]samiantage/i,
    /rep[ée]rage.*amiante/i,
  ],
  certiphyto: [
    /certiphyto/i,
    /certificat\s+individuel.*phyto/i,
    /produits?\s+phyto(?:sanitaire|pharmaceutique)/i,
    /phytopharmaceutique/i,
  ],
  qualipaysage: [
    /qualipaysage/i,
    /qualification.*paysag/i,
    /unep/i,
  ],
  certibiocide: [
    /certibiocide/i,
    /certificat.*biocide/i,
    /produits?\s+biocides?/i,
    /tp\s*(?:14|18|20)/i,
    /d[ée]sinfect.*biocide/i,
  ],
  nf_proprete: [
    /nf\s+(?:service\s+)?propret[ée]/i,
    /certification.*propret/i,
    /afnor.*propret/i,
  ],
  agrement_3d: [
    /agr[ée]ment.*(?:3d|d[ée]rat|d[ée]sinsect|d[ée]sinfect)/i,
    /d[ée]ratisation.*d[ée]sinsectisation/i,
    /minist[èe]re.*agriculture.*3d/i,
    /draaf/i,
  ],
  cepa: [
    /\bcepa\b/i,
    /cen\s+16636/i,
    /european\s+pest/i,
    /pest\s+management/i,
  ],
  licence_transport: [
    /licence.*transport/i,
    /lti\b/i,
    /transport\s+int[ée]rieur/i,
    /drieat|dreal/i,
    /commissionnaire.*transport/i,
  ],
  nf_demenagement: [
    /nf\s+d[ée]m[ée]nagement/i,
    /certification.*d[ée]m[ée]nag/i,
    /afnor.*d[ée]m[ée]nag/i,
  ],
  qualitoit: [
    /qualitoit/i,
    /label.*couvreur/i,
  ],
  qualipv: [
    /qualipv/i,
    /qualisol/i,
    /qualit.?enr.*photovolta/i,
    /installation.*solaire.*certifi/i,
  ],
}

// ── Extraction de dates ──────────────────────────────────────────────────────
function extractDates(text: string): { from?: string; to?: string } {
  // Pattern: "du DD/MM/YYYY au DD/MM/YYYY" ou "valable ... du ... au ..."
  const periodMatch = text.match(/du\s+(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})\s+au\s+(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})/i)
  if (periodMatch) {
    return { from: parseDate(periodMatch[1]), to: parseDate(periodMatch[2]) }
  }
  // Pattern: "valable jusqu'au DD/MM/YYYY"
  const untilMatch = text.match(/(?:jusqu['']?au|expire\s+le|valable\s+jusqu)\s+(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})/i)
  if (untilMatch) {
    return { to: parseDate(untilMatch[1]) }
  }
  // Pattern: "période du DD/MM/YYYY au DD/MM/YYYY"
  const periodeMatch = text.match(/p[ée]riode\s+du\s+(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})\s+au\s+(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})/i)
  if (periodeMatch) {
    return { from: parseDate(periodeMatch[1]), to: parseDate(periodeMatch[2]) }
  }
  return {}
}

function parseDate(d: string): string {
  const parts = d.replace(/\./g, '/').split('/')
  if (parts.length !== 3) return ''
  const [day, month, year] = parts
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

// ── Extraction du numéro de contrat ──────────────────────────────────────────
function extractContractNumber(text: string): string | undefined {
  // "N° contrat : 113332889" ou "contrat n° 12345"
  const match = text.match(/(?:n[°º]\s*(?:de\s+)?contrat|contrat\s+n[°º])\s*:?\s*([A-Z0-9][\w\s-]{3,30})/i)
  if (match) return match[1].trim().split(/\s+/)[0] // Premier mot/nombre
  // "Police n° 12345"
  const policeMatch = text.match(/police\s+n[°º]\s*:?\s*([A-Z0-9][\w-]{3,20})/i)
  if (policeMatch) return policeMatch[1].trim()
  return undefined
}

// ── Extraction du nom de l'assureur ──────────────────────────────────────────
function extractInsurerName(text: string): string | undefined {
  // Noms d'assureurs courants
  const insurers = [
    'BPCE IARD', 'AXA', 'MAAF', 'MAIF', 'MATMUT', 'ALLIANZ', 'GROUPAMA',
    'MMA', 'GENERALI', 'MACIF', 'GMF', 'AVIVA', 'SMABTP', 'SMA BTP',
    'AREAS ASSURANCES', 'HELVETIA', 'ZURICH', 'QBE', 'LLOYD', 'EULER HERMES',
    'COVEA', 'AG2R', 'SWISSLIFE', 'CHUBB', 'HISCOX', 'BERKLEY',
    'GAN', 'PACIFICA', 'CRÉDIT MUTUEL', 'CREDIT AGRICOLE',
    'FIDELIDADE', 'TRANQUILIDADE', 'AGEAS', 'LUSITANIA', 'LIBERTY SEGUROS',
    'CARAVELA', 'OK TELESEGUROS', 'REAL VIDA', 'VICTORIA SEGUROS',
  ]
  const upperText = text.toUpperCase()
  for (const ins of insurers) {
    if (upperText.includes(ins.toUpperCase())) return ins
  }
  // Fallback: chercher après "atteste que" ou "Compagnie"
  const atMatch = text.match(/(?:compagnie|société|assureur)\s*:?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\s&-]{2,30})/i)
  if (atMatch) return atMatch[1].trim()
  return undefined
}

// ── Extraction SIRET ─────────────────────────────────────────────────────────
function extractSiret(text: string): string | undefined {
  const match = text.match(/SIRET\s*:?\s*(\d[\d\s]{12,16}\d)/i)
  if (match) return match[1].replace(/\s/g, '')
  // 14 chiffres consécutifs
  const raw = text.match(/\b(\d{14})\b/)
  if (raw) return raw[1]
  return undefined
}

function extractSiren(text: string): string | undefined {
  const match = text.match(/SIREN\s*:?\s*(\d[\d\s]{7,10}\d)/i)
  if (match) return match[1].replace(/\s/g, '')
  return undefined
}

// ── Extraction nom du titulaire ──────────────────────────────────────────────
function extractHolderName(text: string): string | undefined {
  // "M. NOM PRENOM" ou "Mme NOM PRENOM" ou "Société NOM"
  const patterns = [
    /(?:M\.|Mme|Mr\.?|Mrs\.?)\s+([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\s'-]{2,40})/,
    /(?:assuré|titulaire|souscripteur)\s*:?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\s'-]{2,40})/i,
    /atteste\s+que\s+(?:M\.|Mme|Mr\.?)\s+([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\s'-]{2,40})/i,
    /(?:dénomination|raison\s+sociale)\s*:?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\s&'-]{2,60})/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return m[1].trim()
  }
  return undefined
}

// ── Comparaison de noms (fuzzy) ──────────────────────────────────────────────
function namesMatch(docName: string, profileName: string): boolean {
  if (!docName || !profileName) return false
  const norm = (s: string) => s.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const a = norm(docName)
  const b = norm(profileName)

  // Exact match
  if (a === b) return true

  // Un contient l'autre
  if (a.includes(b) || b.includes(a)) return true

  // Tous les mots du profil sont dans le document (ordre quelconque)
  const wordsB = b.split(' ').filter(w => w.length > 1)
  const allFound = wordsB.every(w => a.includes(w))
  if (allFound && wordsB.length >= 2) return true

  // Tous les mots du document sont dans le profil
  const wordsA = a.split(' ').filter(w => w.length > 1)
  const allFoundReverse = wordsA.every(w => b.includes(w))
  if (allFoundReverse && wordsA.length >= 2) return true

  return false
}

// ── Extraction du texte depuis un PDF base64 ─────────────────────────────────
async function extractTextFromPdf(base64Data: string): Promise<string> {
  // Decode base64 to buffer
  const buffer = Buffer.from(base64Data, 'base64')

  // Simple text extraction: chercher les streams de texte dans le PDF brut
  // (fonctionne pour 90% des PDFs textuels, sans lib externe)
  const pdfStr = buffer.toString('latin1')
  const textChunks: string[] = []

  // Method 1: Extract text between BT and ET operators
  const btEtRegex = /BT\s([\s\S]*?)ET/g
  let match
  while ((match = btEtRegex.exec(pdfStr)) !== null) {
    const block = match[1]
    // Extract text from Tj and TJ operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g
    let tjMatch
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textChunks.push(tjMatch[1])
    }
    // TJ arrays: [(text1) 123 (text2)] TJ
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g
    let tjArrMatch
    while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
      const arrContent = tjArrMatch[1]
      const textParts = arrContent.match(/\(([^)]*)\)/g)
      if (textParts) {
        textParts.forEach(p => textChunks.push(p.slice(1, -1)))
      }
    }
  }

  // Method 2: Fallback — look for readable text patterns in streams
  if (textChunks.length < 3) {
    // Decompress FlateDecode streams
    const zlib = await import('zlib')
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
    let streamMatch
    while ((streamMatch = streamRegex.exec(pdfStr)) !== null) {
      try {
        const raw = Buffer.from(streamMatch[1], 'latin1')
        const decompressed = zlib.inflateSync(raw).toString('latin1')
        // Extract text from decompressed stream
        const innerBtEt = /BT\s([\s\S]*?)ET/g
        let innerMatch
        while ((innerMatch = innerBtEt.exec(decompressed)) !== null) {
          const block = innerMatch[1]
          const tjRegex2 = /\(([^)]*)\)\s*Tj/g
          let tj2
          while ((tj2 = tjRegex2.exec(block)) !== null) {
            textChunks.push(tj2[1])
          }
          const tjArr2 = /\[([^\]]*)\]\s*TJ/g
          let tja2
          while ((tja2 = tjArr2.exec(block)) !== null) {
            const parts = tja2[1].match(/\(([^)]*)\)/g)
            if (parts) parts.forEach(p => textChunks.push(p.slice(1, -1)))
          }
        }
      } catch {
        // Stream not FlateDecode, skip
      }
    }
  }

  // Decode PDF text encoding (handle octal escapes like \350 for è)
  const decoded = textChunks.map(chunk => {
    return chunk
      .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
  })

  return decoded.join(' ').replace(/\s+/g, ' ').trim()
}

// ═══════════════════════════════════════════════════════════════════════════
// POST handler
// ═══════════════════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`wallet_scan_${ip}`, 10, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request as any)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const body = await request.json()
    const v = validateBody(walletScanSchema, body)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const { fileBase64, fileName, docKey, artisanId } = v.data

    // Vérifier que l'artisan appartient au user
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id, company_name, siret, siren, user_id')
      .eq('id', artisanId)
      .single()

    if (!artisan || artisan.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // ── Extraire le texte du document ──────────────────────────────────────
    let extractedText = ''
    const isPdf = fileName.toLowerCase().endsWith('.pdf') || fileBase64.startsWith('JVBER')

    if (isPdf) {
      extractedText = await extractTextFromPdf(fileBase64)
    } else {
      // Pour les images : pas d'OCR natif disponible, on retourne un résultat partiel
      return NextResponse.json({
        scan: {
          docType: 'unknown',
          confidence: 0,
          extractedData: {},
          antiFraud: {
            nameMatch: false,
            nameOnDoc: '',
            nameOnProfile: artisan.company_name,
            siretMatch: null,
            dateValid: true,
            typeCorrect: false,
            suspicious: false,
            reasons: ['Format image — vérification manuelle recommandée. Uploadez le PDF original pour un scan complet.'],
          },
        } as ScanResult,
        text_length: 0,
      })
    }

    if (extractedText.length < 20) {
      return NextResponse.json({
        scan: {
          docType: 'unknown',
          confidence: 0,
          extractedData: {},
          antiFraud: {
            nameMatch: false,
            nameOnDoc: '',
            nameOnProfile: artisan.company_name,
            siretMatch: null,
            dateValid: true,
            typeCorrect: false,
            suspicious: false,
            reasons: ['Document illisible ou protégé — vérification manuelle requise'],
          },
        } as ScanResult,
        text_length: extractedText.length,
      })
    }

    // ── Détecter le type de document ────────────────────────────────────────
    let detectedType: ScanResult['docType'] = 'unknown'
    let maxScore = 0
    for (const [type, patterns] of Object.entries(DOC_PATTERNS)) {
      let score = 0
      for (const p of patterns) {
        if (p.test(extractedText)) score++
      }
      if (score > maxScore) {
        maxScore = score
        detectedType = type as ScanResult['docType']
      }
    }
    const confidence = Math.min(maxScore / 3, 1) // 3 patterns matchés = confiance max

    // ── Extraire les données ────────────────────────────────────────────────
    const dates = extractDates(extractedText)
    const holderName = extractHolderName(extractedText)
    const siret = extractSiret(extractedText)
    const siren = extractSiren(extractedText)
    const insurerName = (detectedType === 'rc_pro' || detectedType === 'decennale')
      ? extractInsurerName(extractedText) : undefined
    const contractNumber = (detectedType === 'rc_pro' || detectedType === 'decennale')
      ? extractContractNumber(extractedText) : undefined

    const extractedData: ScanResult['extractedData'] = {
      holderName,
      validFrom: dates.from,
      validTo: dates.to,
      siret,
      siren,
      insurerName,
      contractNumber,
      coverage: extractedText.toLowerCase().includes('métropolitaine') ? 'France métropolitaine'
        : extractedText.toLowerCase().includes('continental') ? 'Portugal Continental'
        : undefined,
    }

    // ── Anti-fraude ─────────────────────────────────────────────────────────
    const reasons: string[] = []

    // 1. Vérification du nom
    const nameMatch = namesMatch(holderName || '', artisan.company_name || '')
    if (holderName && !nameMatch) {
      reasons.push(`Nom sur le document "${holderName}" ne correspond pas au profil "${artisan.company_name}"`)
    }

    // 2. Vérification SIRET
    let siretMatch: boolean | null = null
    if (siret && artisan.siret) {
      const cleanDocSiret = siret.replace(/\s/g, '')
      const cleanArtSiret = artisan.siret.replace(/\s/g, '')
      siretMatch = cleanDocSiret === cleanArtSiret
      if (!siretMatch) {
        // Vérifier si le SIREN (9 premiers chiffres) correspond au moins
        if (cleanDocSiret.substring(0, 9) === cleanArtSiret.substring(0, 9)) {
          siretMatch = true // Même SIREN, SIRET différent (établissement secondaire OK)
        } else {
          reasons.push(`SIRET sur le document (${cleanDocSiret}) ne correspond pas au profil (${cleanArtSiret})`)
        }
      }
    }

    // 3. Vérification date de validité
    let dateValid = true
    if (dates.to) {
      const expiry = new Date(dates.to)
      if (expiry < new Date()) {
        dateValid = false
        reasons.push(`Document expiré le ${expiry.toLocaleDateString('fr-FR')}`)
      }
    }

    // 4. Vérification type de document vs slot
    const typeMapping: Record<string, string[]> = {
      'rc_pro': ['rc_pro', 'decennale'],
      'decennale': ['decennale', 'rc_pro'],
      'decennale_paysage': ['decennale', 'rc_pro'],
      'kbis': ['kbis'],
      'urssaf': ['urssaf'],
      'qualibat': ['qualibat'],
      'qualibat_rge': ['qualibat', 'rge'],
      'qualigaz': ['qualigaz'],
      'quali_eau': ['quali_eau'],
      'fluides_frigorigenes': ['fluides_frigorigenes'],
      'rge': ['rge', 'qualibat', 'qualifelec', 'qualipv'],
      'rge_qualifelec': ['rge', 'qualifelec'],
      'carte_btp': ['carte_btp'],
      'habilitation_elec': ['habilitation_elec'],
      'qualifelec': ['qualifelec'],
      'irve': ['irve', 'qualifelec'],
      'amiante_ss4': ['amiante_ss4'],
      'certiphyto': ['certiphyto'],
      'certiphyto_nuisibles': ['certiphyto'],
      'qualipaysage': ['qualipaysage'],
      'labels_ecocert_paysage': ['qualipaysage'],
      'certibiocide': ['certibiocide'],
      'certibiocide_nuisibles': ['certibiocide'],
      'nf_proprete': ['nf_proprete'],
      'agrement_3d': ['agrement_3d'],
      'cepa': ['cepa'],
      'licence_transport': ['licence_transport'],
      'nf_demenagement': ['nf_demenagement'],
      'qualitoit': ['qualitoit'],
      'qualipv': ['qualipv'],
    }
    const expectedTypes = typeMapping[docKey] || []
    const typeCorrect = expectedTypes.length === 0 || expectedTypes.includes(detectedType)
    if (!typeCorrect && detectedType !== 'unknown') {
      reasons.push(`Type de document détecté "${detectedType}" ne correspond pas au slot "${docKey}"`)
    }

    const suspicious = reasons.length > 0 && (
      (!nameMatch && !!holderName) || // Nom ne correspond pas
      (siretMatch === false) || // SIRET ne correspond pas
      (!typeCorrect && confidence > 0.3) // Mauvais type de document avec bonne confiance
    )

    const antiFraud: ScanResult['antiFraud'] = {
      nameMatch,
      nameOnDoc: holderName || '(non détecté)',
      nameOnProfile: artisan.company_name || '',
      siretMatch,
      dateValid,
      typeCorrect,
      suspicious,
      reasons,
    }

    const scanResult: ScanResult = {
      docType: detectedType,
      confidence,
      extractedData,
      antiFraud,
    }

    // ── Sauvegarder les données d'assurance si RC Pro/Décennale ───────────
    if ((detectedType === 'rc_pro' || detectedType === 'decennale' || docKey === 'rc_pro' || docKey === 'decennale' || docKey === 'decennale_paysage') && !suspicious) {
      const updateData: Record<string, any> = {
        insurance_scan_data: scanResult,
        insurance_verified: !suspicious && nameMatch,
      }
      if (insurerName) updateData.insurance_name = insurerName
      if (contractNumber) updateData.insurance_number = contractNumber
      if (extractedData.coverage) updateData.insurance_coverage = extractedData.coverage
      if (dates.to) updateData.insurance_expiry = dates.to
      if (detectedType === 'rc_pro') updateData.insurance_type = 'rc_pro'
      if (detectedType === 'decennale') updateData.insurance_type = 'decennale'

      await supabaseAdmin
        .from('profiles_artisan')
        .update(updateData)
        .eq('id', artisanId)
    }

    return NextResponse.json({
      scan: scanResult,
      text_length: extractedText.length,
    })

  } catch (e: any) {
    console.error('[wallet-scan] Error:', e.message)
    return NextResponse.json({ error: 'Erreur lors du scan', details: e.message }, { status: 500 })
  }
}
