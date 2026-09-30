/** Identifiants des agents IA illustrés par une mascotte. */
export type IdAgentAvatar = 'fixy' | 'max' | 'lea' | 'alfredo' | 'tempo'

/**
 * Mascottes des agents IA. La maquette embarquait des images WebP en base64 ; elles ont été extraites
 * à l'identique dans public/images/administrateur-judiciaire/agents/ (même ordre de clés).
 */
export const AVATARS_AGENTS: Readonly<Record<IdAgentAvatar, string>> = {
  fixy: '/images/administrateur-judiciaire/agents/fixy.webp',
  max: '/images/administrateur-judiciaire/agents/max.webp',
  lea: '/images/administrateur-judiciaire/agents/lea.webp',
  alfredo: '/images/administrateur-judiciaire/agents/alfredo.webp',
  tempo: '/images/administrateur-judiciaire/agents/tempo.webp',
}
