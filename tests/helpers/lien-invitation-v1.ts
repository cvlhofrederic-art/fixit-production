// tests/helpers/lien-invitation-v1.ts
//
// Signature d'un lien d'invitation d'équipe au format v1 (liens envoyés avant la mise en ligne du format v2, rôle non signé),
// recalculée ici comme le faisait lib/equipe/lien-invitation.ts avant le format v2 : même clé (HKDF-SHA256 de
// SUPABASE_SERVICE_ROLE_KEY, sel « vitfix », info « invitation-equipe-v1 »), message sans le rôle. Le code de
// production ne sait plus produire ce format : il ne fait que le vérifier, jusqu'à FIN_FORMAT_V1.

import type { EspaceEquipe, InvitationSignee } from '@/lib/equipe/lien-invitation'

export async function signatureV1(espace: EspaceEquipe, inv: InvitationSignee): Promise<string> {
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
  const message = JSON.stringify(['v1', espace, inv.id, inv.equipe_id, inv.email, inv.invite_token])
  const signature = await crypto.subtle.sign('HMAC', cle, encodeur.encode(message))
  return Array.from(new Uint8Array(signature), (o) => o.toString(16).padStart(2, '0')).join('')
}
