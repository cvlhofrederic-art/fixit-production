// lib/syndic/max-reponse-generale.ts
//
// Max (agent juridique du syndic) quand la base juridique Vitfix ne contient aucun texte sur la question
// (« corpus gap ») : plutôt qu'un refus sec, une réponse générale de Claude Sonnet 5.5, présentée comme telle
// (bandeau « à vérifier », aucune citation de la base). Claude uniquement : pas de secours Llama pour une
// réponse juridique sans source. Sans clé Anthropic ou en cas d'échec : null, la route garde son refus.

import { callClaudeWithRetry, hasAnthropicKey } from '@/lib/claude'
import { logger } from '@/lib/logger'

type Langue = 'fr' | 'pt'

const PROMPTS: Record<Langue, string> = {
  fr: `Tu es Max, expert juridique en droit français de la copropriété, assistant d'un syndic professionnel dans le logiciel Vitfix.
La base documentaire de Vitfix ne contient aucun texte sur la question posée : réponds à partir de tes connaissances générales du droit de la copropriété (loi n° 65-557 du 10 juillet 1965, décret n° 67-223 du 17 mars 1967, et textes liés).
Règles :
- Réponse prudente et opérationnelle, en français, 6 à 15 lignes, Markdown léger (gras, listes courtes).
- Cite un article seulement si tu es certain de sa référence ; sinon décris la règle sans numéro.
- Indique ce qui doit être vérifié (texte en vigueur, règlement de copropriété, jurisprudence récente, situation précise).
- Si la question sort du droit de la copropriété ou de l'immobilier, dis-le simplement.`,
  pt: `És o Max, especialista jurídico em direito português da propriedade horizontal, assistente de uma administração de condomínios no software Vitfix.
A base documental da Vitfix não contém nenhum texto sobre a pergunta: responde com base nos teus conhecimentos gerais (Código Civil, artigos 1414.º e seguintes, Decreto-Lei n.º 268/94 e legislação conexa).
Regras:
- Resposta prudente e operacional, em português europeu, 6 a 15 linhas, Markdown simples (negrito, listas curtas).
- Cita um artigo apenas se tiveres a certeza da referência; caso contrário descreve a regra sem número.
- Indica o que deve ser verificado (texto em vigor, regulamento do condomínio, jurisprudência recente, situação concreta).
- Se a pergunta sair do âmbito da propriedade horizontal ou do imobiliário, di-lo simplesmente.`,
}

/** Bandeau ajouté par le serveur (pas par le modèle) devant la réponse générale. */
export const BANDEAU_REPONSE_GENERALE: Record<Langue, string> = {
  fr: 'ℹ️ *Réponse générale de Max : aucun texte de la base juridique Vitfix ne couvre précisément cette question. À vérifier avant toute décision.*',
  pt: 'ℹ️ *Resposta geral do Max: nenhum texto da base jurídica Vitfix cobre exatamente esta pergunta. A verificar antes de qualquer decisão.*',
}

export async function reponseGeneraleMax(
  message: string,
  historique: Array<{ role: string; content: string }>,
  langue: Langue,
): Promise<{ texte: string; modele: string | null } | null> {
  if (!(await hasAnthropicKey())) return null
  try {
    const reponse = await callClaudeWithRetry(
      {
        messages: [{ role: 'system', content: PROMPTS[langue] }, ...historique, { role: 'user', content: message }],
        max_tokens: 1500,
      },
      { effort: 'medium', disableGroqFallback: true },
    )
    const texte = reponse.choices?.[0]?.message?.content?.trim()
    if (!texte) return null
    return { texte: `${BANDEAU_REPONSE_GENERALE[langue]}\n\n${texte}`, modele: reponse.model ?? null }
  } catch (err) {
    // Échec de Claude : la route renvoie son refus standard (aucune réponse juridique sans source par Llama).
    logger.warn('[max-ai] réponse générale indisponible', { erreur: err instanceof Error ? err.message.slice(0, 200) : String(err) })
    return null
  }
}
