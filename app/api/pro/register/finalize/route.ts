import { NextResponse, after, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getUserRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { runKycPipeline } from '@/lib/kyc-orchestrate'
import { logger } from '@/lib/logger'
import { StoragePathError, assertStoragePath, buildStoragePath } from '@/lib/security/storage-path'

// ════════════════════════════════════════════════════════════════════════════
// POST /api/pro/register/finalize
// Fin de l'inscription d'une société BTP, appelée par le formulaire société
// (app/pro/register) juste après /api/auth/create-profile.
//
// Quand la confirmation d'e-mail est active, supabase.auth.signUp ne renvoie
// pas de session : /api/upload et /api/kyc-orchestrate, qui exigent un Bearer,
// échouaient en silence (Kbis et pièce d'identité perdus, KYC jamais lancé).
// Même garde que create-profile : compte créé il y a moins de 10 minutes,
// plus le rôle pro_societe lu dans app_metadata (non forgeable).
//
// multipart/form-data : user_id, kbis? (File), identity? (File), identity_verso? (File)
// Une pièce déjà déposée n'est jamais remplacée. Le KYC tourne après la réponse.
// Le schéma de prod ne suit pas toujours les migrations : une pièce dont la
// colonne n'existe pas encore (id_document_verso_url, migration du 16/10/2026)
// est ignorée, sans dépôt orphelin ni effet sur les autres pièces.
// ════════════════════════════════════════════════════════════════════════════

const FENETRE_INSCRIPTION_MS = 10 * 60 * 1000
const TAILLE_MAX = 10 * 1024 * 1024
const BUCKET = 'artisan-documents'
const DUREE_URL_SIGNEE_S = 60 * 60 * 24 * 7 // comme /api/upload pour les documents

const PIECES = [
  { champ: 'kbis', dossier: 'kbis', colonne: 'kbis_url' },
  { champ: 'identity', dossier: 'identity', colonne: 'id_document_url' },
  { champ: 'identity_verso', dossier: 'identity-verso', colonne: 'id_document_verso_url' },
] as const

type Piece = (typeof PIECES)[number]
type TypeDocument = { mime: string; ext: string }

// Type reconnu aux premiers octets, jamais au type MIME envoyé par le navigateur.
function typeDocument(octets: Uint8Array): TypeDocument | null {
  const commencePar = (signature: number[], decalage = 0) =>
    signature.every((b, i) => octets[decalage + i] === b)
  if (commencePar([0x25, 0x50, 0x44, 0x46])) return { mime: 'application/pdf', ext: 'pdf' }
  if (commencePar([0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' }
  if (commencePar([0x89, 0x50, 0x4e, 0x47])) return { mime: 'image/png', ext: 'png' }
  if (commencePar([0x52, 0x49, 0x46, 0x46]) && commencePar([0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: 'image/webp', ext: 'webp' }
  }
  return null
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`btp_register_finalize_${ip}`, 5, 600_000))) return rateLimitResponse()

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const userId = formData.get('user_id')
  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
  }

  try {
    const { data: auth, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (authError || !auth?.user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }
    if (Date.now() - new Date(auth.user.created_at).getTime() > FENETRE_INSCRIPTION_MS) {
      return NextResponse.json({ error: "Délai d'inscription dépassé" }, { status: 403 })
    }
    if (getUserRole(auth.user) !== 'pro_societe') {
      return NextResponse.json({ error: 'Réservé aux sociétés BTP' }, { status: 403 })
    }

    // Pièces envoyées : contrôlées avant tout dépôt
    const fichiers: Array<Piece & { contenu: ArrayBuffer; type: TypeDocument }> = []
    for (const piece of PIECES) {
      const valeur = formData.get(piece.champ)
      if (valeur === null) continue
      if (typeof valeur === 'string' || valeur.size === 0) {
        return NextResponse.json({ error: 'Fichier invalide' }, { status: 400 })
      }
      if (valeur.size > TAILLE_MAX) {
        return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 })
      }
      const contenu = await valeur.arrayBuffer()
      const type = typeDocument(new Uint8Array(contenu.slice(0, 12)))
      if (!type) {
        return NextResponse.json({ error: 'Format non supporté. Utilisez PDF, JPG ou PNG.' }, { status: 400 })
      }
      fichiers.push({ ...piece, contenu, type })
    }

    // '*' : renvoie les colonnes existantes, sans échouer sur une colonne absente
    const { data: profil, error: profilError } = await supabaseAdmin
      .from('profiles_artisan')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (profilError) {
      logger.error('[btp-register-finalize] profile fetch error:', profilError)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
    if (!profil) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    }

    const documents = { kbis: false, identity: false, identity_verso: false }
    const urls: Partial<Record<Piece['colonne'], string>> = {}
    let depotEchoue = false
    for (const f of fichiers) {
      if (!(f.colonne in profil)) {
        logger.warn('[btp-register-finalize] colonne absente, pièce ignorée', { colonne: f.colonne })
        continue
      }
      if (profil[f.colonne]) continue // pièce déjà déposée : jamais remplacée
      // Dossier = compte vérifié ci-dessus (jamais le corps), nom généré, extension de la liste blanche
      // (type reconnu aux octets) : {user}/{pièce}/{uuid}.{ext}, segments vérifiés par buildStoragePath.
      const chemin = buildStoragePath(userId, f.dossier, `${crypto.randomUUID()}.${f.type.ext}`)
      const { data: depot, error: depotError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(chemin, f.contenu, { contentType: f.type.mime, upsert: false })
      if (depotError || !depot) {
        logger.error('[btp-register-finalize] storage upload error:', depotError)
        depotEchoue = true
        continue
      }
      // Chemin renvoyé par Storage revérifié (défense en profondeur) avant l'URL signée.
      const cheminDepose = assertStoragePath(depot.path, userId)
      const { data: signee } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(cheminDepose, DUREE_URL_SIGNEE_S)
      urls[f.colonne] = signee?.signedUrl || supabaseAdmin.storage.from(BUCKET).getPublicUrl(cheminDepose).data.publicUrl
      documents[f.champ] = true
    }

    if (Object.keys(urls).length > 0) {
      const { error: majError } = await supabaseAdmin
        .from('profiles_artisan')
        .update(urls)
        .eq('id', profil.id)
      if (majError) {
        logger.error('[btp-register-finalize] profile update error:', majError)
        depotEchoue = true
        documents.kbis = false
        documents.identity = false
        documents.identity_verso = false
      }
    }

    lancerKyc(profil.id, userId)

    if (depotEchoue) {
      return NextResponse.json({ error: "Erreur lors de l'envoi des pièces", documents }, { status: 500 })
    }
    return NextResponse.json({ ok: true, documents })
  } catch (err: unknown) {
    if (err instanceof StoragePathError) {
      logger.warn('[btp-register-finalize] chemin de stockage refusé')
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
    }
    logger.error('[btp-register-finalize] exception:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// KYC anti-fraude après l'envoi de la réponse (after() s'appuie sur
// ctx.waitUntil du Worker) : l'inscription n'attend pas l'OCR.
function lancerKyc(profilId: string, userId: string): void {
  try {
    after(async () => {
      try {
        const issue = await runKycPipeline(profilId, userId)
        if (!issue.ok) logger.warn('[btp-register-finalize] KYC non lancé', { profilId, status: issue.status })
      } catch (err: unknown) {
        logger.error('[btp-register-finalize] KYC error:', err)
      }
    })
  } catch (err: unknown) {
    logger.warn('[btp-register-finalize] after() indisponible, KYC non lancé', {
      profilId,
      erreur: err instanceof Error ? err.message : String(err),
    })
  }
}
