import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>

export const ENCRYPTION_VERSION = 1

export interface DecryptedToken {
  access_token: string
  refresh_token: string
  expires_at: string
}

export interface SetTokenParams {
  syndic_id: string
  access_token: string
  refresh_token: string
  expires_at: string
}

export function getEncryptionKey(): string {
  const key = process.env.OAUTH_TOKENS_ENCRYPTION_KEY
  if (!key) {
    throw new Error('OAUTH_TOKENS_ENCRYPTION_KEY is not set')
  }
  if (key.length < 32) {
    throw new Error('OAUTH_TOKENS_ENCRYPTION_KEY must be at least 32 chars')
  }
  return key
}

async function setLocalKey(client: AnySupabaseClient): Promise<void> {
  const { error } = await client.rpc('set_config', {
    parameter: 'app.oauth_encryption_key',
    value: getEncryptionKey(),
    is_local: true,
  })
  if (error) {
    throw new Error(`set_config app.oauth_encryption_key failed: ${error.message}`)
  }
}

export async function setEncryptedToken(
  client: AnySupabaseClient,
  params: SetTokenParams,
): Promise<void> {
  await setLocalKey(client)
  const { error } = await client.rpc('set_encrypted_oauth_token', {
    p_syndic_id: params.syndic_id,
    p_access_token: params.access_token,
    p_refresh_token: params.refresh_token,
    p_expires_at: params.expires_at,
    p_encryption_version: ENCRYPTION_VERSION,
  })
  if (error) {
    throw new Error(`setEncryptedToken failed: ${error.message}`)
  }
}

export async function getDecryptedToken(
  client: AnySupabaseClient,
  syndicId: string,
): Promise<DecryptedToken | null> {
  await setLocalKey(client)
  const { data, error } = await client.rpc('get_decrypted_oauth_token', {
    p_syndic_id: syndicId,
  })
  if (error) {
    throw new Error(`getDecryptedToken failed: ${error.message}`)
  }
  if (!data || (Array.isArray(data) && data.length === 0)) return null
  const row = Array.isArray(data) ? data[0] : data
  return {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expires_at: row.expires_at,
  }
}
