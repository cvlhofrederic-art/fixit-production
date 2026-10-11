/**
 * Chiffrement des identifiants de boîte IMAP rangés dans syndic_oauth_tokens.access_token.
 *
 * AES-GCM 256 (WebCrypto, disponible dans le Worker et dans Node) ; la clé est dérivée par
 * HKDF-SHA-256 du secret existant OAUTH_TOKENS_ENCRYPTION_KEY (lib/oauth/tokens.ts, ≥ 32
 * caractères, posé par `wrangler secret put`). Format rangé : « imapv1.<iv>.<chiffré> »
 * (base64url, IV aléatoire de 12 octets à chaque chiffrement). Le mot de passe n'est
 * jamais journalisé ni renvoyé au navigateur.
 */

import { getEncryptionKey } from '@/lib/oauth/tokens'

const PREFIXE = 'imapv1'
const encodeur = new TextEncoder()

function versBase64Url(octets: Uint8Array): string {
  let binaire = ''
  for (const o of octets) binaire += String.fromCharCode(o)
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function depuisBase64Url(texte: string): Uint8Array<ArrayBuffer> {
  const base64 = texte.replace(/-/g, '+').replace(/_/g, '/')
  const binaire = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  const octets = new Uint8Array(binaire.length)
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i)
  return octets
}

async function cleAes(): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', encodeur.encode(getEncryptionKey()), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: encodeur.encode('vitfix/alfredo/imap'), info: encodeur.encode('syndic_oauth_tokens.access_token') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Clé de chiffrement absente ou trop courte (configuration serveur à compléter). */
export function cleChiffrementManquante(): boolean {
  const cle = process.env.OAUTH_TOKENS_ENCRYPTION_KEY
  return !cle || cle.length < 32
}

export async function chiffrerTexte(clair: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cleAes(), encodeur.encode(clair)))
  return `${PREFIXE}.${versBase64Url(iv)}.${versBase64Url(chiffre)}`
}

/** Déchiffre une valeur produite par chiffrerTexte (erreur si altérée ou autre clé). */
export async function dechiffrerTexte(valeur: string): Promise<string> {
  const [prefixe, iv, chiffre, ...reste] = valeur.split('.')
  if (prefixe !== PREFIXE || !iv || !chiffre || reste.length > 0) {
    throw new Error('Format de secret chiffré inconnu')
  }
  const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: depuisBase64Url(iv) }, await cleAes(), depuisBase64Url(chiffre))
  return new TextDecoder().decode(clair)
}

export function estTexteChiffre(valeur: string | null | undefined): boolean {
  return typeof valeur === 'string' && valeur.startsWith(`${PREFIXE}.`)
}

/** Paramètres de connexion d'une boîte IMAP (rangés chiffrés, mot de passe compris). */
export interface IdentifiantsImap {
  hote: string
  port: number
  utilisateur: string
  motDePasse: string
}

export async function chiffrerIdentifiantsImap(id: IdentifiantsImap): Promise<string> {
  return chiffrerTexte(JSON.stringify({ v: 1, h: id.hote, p: id.port, u: id.utilisateur, m: id.motDePasse }))
}

export async function dechiffrerIdentifiantsImap(valeur: string): Promise<IdentifiantsImap> {
  const brut = JSON.parse(await dechiffrerTexte(valeur)) as Record<string, unknown>
  if (brut.v !== 1 || typeof brut.h !== 'string' || typeof brut.p !== 'number' || typeof brut.u !== 'string' || typeof brut.m !== 'string') {
    throw new Error('Identifiants IMAP illisibles')
  }
  return { hote: brut.h, port: brut.p, utilisateur: brut.u, motDePasse: brut.m }
}
