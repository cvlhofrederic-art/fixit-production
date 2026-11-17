// ── Modèles qui raisonnent avant de répondre (gpt-oss, chez Groq et Cerebras) ──
//
// Les remplaçants des modèles Llama retirés par Groq (openai/gpt-oss-120b, openai/gpt-oss-20b) et par Cerebras
// (gpt-oss-120b) raisonnent avant de répondre. Le raisonnement arrive à part (champ `reasoning`), le texte de la
// réponse reste dans `content`, mais ses jetons comptent dans `max_tokens` : un budget calibré pour Llama, sans
// raisonnement, peut s'épuiser avant la réponse (contenu vide, `finish_reason: 'length'`).
// Ce module ne dépend de rien : lib/groq et lib/cerebras l'importent tous deux.

/** Effort de raisonnement des modèles gpt-oss (valeurs admises par Groq et Cerebras). */
export type EffortRaisonnement = 'low' | 'medium' | 'high'

/**
 * Jetons ajoutés au budget de réponse demandé par la route. Avec l'effort `low`, le raisonnement d'une
 * conversation, d'un appel d'outil ou d'une extraction tient en quelques dizaines à quelques centaines de jetons, et
 * les budgets des routes dépassent déjà largement leurs réponses habituelles. Marge volontairement mesurée : l'offre
 * gratuite de Groq plafonne gpt-oss à 8 000 jetons par minute et refuse une requête trop grosse (413) ; la requête
 * passe alors au relais (lib/ai/relais.ts).
 */
export const MARGE_RAISONNEMENT = 512

/** Vrai pour un modèle qui raisonne avant de répondre (famille gpt-oss). */
export function estModeleRaisonnement(modele: string): boolean {
  return /(^|\/)gpt-oss-/i.test(modele)
}

/**
 * Budget et effort à envoyer pour `modele` : inchangés pour un modèle qui ne raisonne pas ; pour gpt-oss, budget
 * majoré de la marge et effort `low` (réponses rapides, peu de jetons) sauf demande contraire de la route.
 */
export function parametresRaisonnement(
  modele: string,
  maxTokens: number,
  effort?: EffortRaisonnement,
): { max_tokens: number; reasoning_effort?: EffortRaisonnement } {
  if (!estModeleRaisonnement(modele)) return { max_tokens: maxTokens }
  return { max_tokens: maxTokens + MARGE_RAISONNEMENT, reasoning_effort: effort ?? 'low' }
}
