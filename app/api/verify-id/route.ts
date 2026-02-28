import { NextResponse } from 'next/server'
import Tesseract from 'tesseract.js'

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

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const expectedNom = formData.get('nom') as string | null
    const expectedPrenom = formData.get('prenom') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
    }
    if (!expectedNom || !expectedPrenom) {
      return NextResponse.json({ error: 'Nom et prénom requis' }, { status: 400 })
    }

    // Convertir le fichier en buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // OCR avec Tesseract.js — langue française
    const result = await Tesseract.recognize(buffer, 'fra', {
      logger: () => {}, // silence les logs
    })

    const ocrText = result.data.text
    const confidence = result.data.confidence

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

  } catch (error: any) {
    console.error('ID verification error:', error)
    return NextResponse.json({ error: 'Erreur lors de la vérification : ' + error.message }, { status: 500 })
  }
}
