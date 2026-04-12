import { NextResponse, type NextRequest } from 'next/server'
import { callGroqWithRetry } from '@/lib/groq'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validateBody, verifyIdFormSchema } from '@/lib/validation'

export const maxDuration = 30

// Normalise un texte pour comparaison (minuscules, sans accents, sans ponctuation)
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // supprime accents
    .replace(/[^a-z0-9\s]/g, '') // supprime ponctuation
    .replace(/\s+/g, ' ')
    .trim()
}

// Vérifie si un mot apparaît dans le texte OCR (fuzzy : tolère 1 caractère d'écart)
function wordFoundInText(word: string, ocrText: string): { found: boolean; exact: boolean } {
  const normWord = normalize(word)
  const normText = normalize(ocrText)
  if (normWord.length < 2) return { found: false, exact: false }

  // Match exact
  if (normText.includes(normWord)) return { found: true, exact: true }

  // Match fuzzy : chaque mot du texte OCR
  const ocrWords = normText.split(/\s+/)
  for (const ow of ocrWords) {
    if (ow.length < 2) continue
    // Levenshtein distance <= 1 pour les mots de 4+ caractères
    if (normWord.length >= 4 && levenshtein(normWord, ow) <= 1) {
      return { found: true, exact: false }
    }
    // Sous-chaîne : le mot OCR contient le mot cherché ou inversement
    if (ow.includes(normWord) || normWord.includes(ow)) {
      if (Math.abs(ow.length - normWord.length) <= 2) return { found: true, exact: false }
    }
  }
  return { found: false, exact: false }
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
      }
    }
  }
  return matrix[b.length][a.length]
}

// Détecte des mots-clés typiques d'une pièce d'identité française
function detectIdKeywords(text: string): { isId: boolean; type: string } {
  const t = normalize(text)
  if (t.includes('carte nationale') || t.includes('carte d identite') || t.includes('republique francaise')) {
    return { isId: true, type: 'CNI' }
  }
  if (t.includes('passeport') || t.includes('passport')) {
    return { isId: true, type: 'Passeport' }
  }
  if (t.includes('titre de sejour') || t.includes('carte de sejour') || t.includes('residence permit')) {
    return { isId: true, type: 'Titre de séjour' }
  }
  if (t.includes('permis de conduire') || t.includes('driving licence')) {
    return { isId: true, type: 'Permis de conduire' }
  }
  // Heuristique : date de naissance + nom = probablement une pièce d'identité
  if ((t.includes('naissance') || t.includes('birth') || t.includes('date de')) && t.length > 50) {
    return { isId: true, type: 'Document officiel' }
  }
  return { isId: false, type: '' }
}

const ID_OCR_PROMPT = `Tu es un système OCR spécialisé dans les pièces d'identité françaises.
Extrais TOUT le texte visible sur ce document d'identité.
Inclus : noms, prénoms, dates, numéros, adresses, mentions officielles.
Retourne le texte brut extrait, sans formatage JSON.
Si le document est illisible ou n'est pas une pièce d'identité, retourne "ILLISIBLE".`

export async function POST(request: NextRequest) {
  // Rate limit: 5 requests per minute per IP (API-based, lighter than OCR)
  const ip = getClientIP(request)
  const allowed = await checkRateLimit(`verify_id_${ip}`, 5, 60_000)
  if (!allowed) return rateLimitResponse()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
    }

    const v = validateBody(verifyIdFormSchema, {
      nom: formData.get('nom'),
      prenom: formData.get('prenom'),
    })
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const expectedNom = v.data.nom
    const expectedPrenom = v.data.prenom

    // Convertir le fichier en base64 pour Groq Vision
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'
    const imageUrl = `data:${mimeType};base64,${base64}`

    // OCR via Groq Vision API
    let ocrText = ''
    let confidence = 0
    try {
      const groqData = await callGroqWithRetry({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: ID_OCR_PROMPT },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        }],
        temperature: 0.1,
        max_tokens: 2000,
      })
      ocrText = groqData.choices?.[0]?.message?.content || ''
      // Groq Vision n'a pas de score de confiance natif — on estime via la longueur du texte
      confidence = ocrText.length > 100 ? 75 : ocrText.length > 30 ? 50 : 15
      if (ocrText.trim() === 'ILLISIBLE') confidence = 5
    } catch (err) {
      logger.warn('[verify-id] Groq Vision error, returning low confidence', err)
      confidence = 0
    }

    // 1. Vérifier que c'est bien une pièce d'identité
    const idCheck = detectIdKeywords(ocrText)

    // 2. Chercher nom et prénom dans le texte OCR
    const nomResult = wordFoundInText(expectedNom, ocrText)
    const prenomResult = wordFoundInText(expectedPrenom, ocrText)

    // 3. Score de confiance
    let score = 0
    const details: string[] = []

    if (idCheck.isId) {
      score += 30
      details.push(`Document détecté : ${idCheck.type}`)
    } else {
      details.push('Type de document non reconnu automatiquement')
    }

    if (nomResult.found) {
      score += nomResult.exact ? 35 : 25
      details.push(`Nom "${expectedNom}" ${nomResult.exact ? 'trouvé (exact)' : 'trouvé (approx.)'}`)
    } else {
      details.push(`Nom "${expectedNom}" non trouvé`)
    }

    if (prenomResult.found) {
      score += prenomResult.exact ? 35 : 25
      details.push(`Prénom "${expectedPrenom}" ${prenomResult.exact ? 'trouvé (exact)' : 'trouvé (approx.)'}`)
    } else {
      details.push(`Prénom "${expectedPrenom}" non trouvé`)
    }

    // Statut final
    let status: 'verified' | 'warning' | 'failed'
    if (score >= 70) {
      status = 'verified'
    } else if (score >= 40) {
      status = 'warning'
    } else {
      status = 'failed'
    }

    return NextResponse.json({
      status,
      score,
      details,
      ocrConfidence: Math.round(confidence),
      documentType: idCheck.type || null,
      nomFound: nomResult.found,
      prenomFound: prenomResult.found,
    })

  } catch (error: unknown) {
    logger.error('[verify-id] Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la vérification' }, { status: 500 })
  }
}
