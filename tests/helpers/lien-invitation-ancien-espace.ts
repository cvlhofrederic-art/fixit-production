// tests/helpers/lien-invitation-ancien-espace.ts
//
// Signature d'un lien d'invitation d'un gestionnaire telle que la calculait lib/equipe/lien-invitation.ts AVANT le
// renommage du produit en « Vitfix Signal » (décision du 26/11/2026) : même clé (HKDF-SHA256 de
// SUPABASE_SERVICE_ROLE_KEY, sel « vitfix », info « invitation-equipe-v1 »), message v2 dont l'espace est l'ancien nom
// et le rôle celui des gestionnaires. Le code de production ne sait plus produire ce lien : il ne fait que le vérifier
// (lib/vitfixsignal/ancien-nom.ts, bloc D). Le vecteur figé de tests/lib/vitfixsignal-ancien-nom.test.ts, produit par
// le code d'avant, vérifie cette aide elle-même.

export interface InvitationAncienEspace { id: string; email: string; invite_token: string; equipe_id: string }

const ESPACE_D_AVANT = 'aj_signalement'
const ROLE_DES_GESTIONNAIRES = 'gestionnaire_signalement'

/** Signature (64 hex) d'une invitation émise sous l'ancien nom d'espace. */
export async function signatureAncienEspace(inv: InvitationAncienEspace): Promise<string> {
  const encodeur = new TextEncoder()
  const base = await crypto.subtle.importKey(
    'raw', encodeur.encode(process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''), 'HKDF', false, ['deriveKey'],
  )
  const cle = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: encodeur.encode('vitfix'), info: encodeur.encode('invitation-equipe-v1') },
    base,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign'],
  )
  const message = JSON.stringify(['v2', ESPACE_D_AVANT, inv.id, inv.equipe_id, inv.email, inv.invite_token, ROLE_DES_GESTIONNAIRES])
  const signature = await crypto.subtle.sign('HMAC', cle, encodeur.encode(message))
  return Array.from(new Uint8Array(signature), (o) => o.toString(16).padStart(2, '0')).join('')
}

/** Jeton du lien (`<jeton de la ligne>.<signature>`) d'une invitation émise sous l'ancien nom d'espace. */
export async function jetonAncienEspace(inv: InvitationAncienEspace): Promise<string> {
  return `${inv.invite_token}.${await signatureAncienEspace(inv)}`
}
