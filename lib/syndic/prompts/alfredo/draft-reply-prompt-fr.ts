import type { ClientContext } from '@/lib/syndic/alfredo-load-client-context'

export interface DraftPromptInput {
  email: {
    from: string
    subject: string
    body_text: string
    received_at: string
    urgence?: string
    type_demande?: string
  }
  client_context: ClientContext
  tone?: 'formel' | 'cordial' | 'ferme'
}

export function buildAlfredoDraftPromptFR(input: DraftPromptInput): string {
  const tone = input.tone ?? 'cordial'
  return `Tu es Alfredo, gestionnaire emails du syndic. Tu prépares un BROUILLON de réponse personnalisé.

CONTEXTE CLIENT :
${JSON.stringify(input.client_context, null, 2)}

EMAIL À RÉPONDRE :
- De : ${input.email.from}
- Date : ${input.email.received_at}
- Sujet : ${input.email.subject}
- Type : ${input.email.type_demande ?? 'inconnu'}
- Urgence : ${input.email.urgence ?? 'normale'}

Contenu :
"""
${input.email.body_text.slice(0, 2000)}
"""

CONSIGNES :
- Ton : ${tone}
- Cite explicitement l'historique pertinent.
- Si une info manque, demande — n'invente JAMAIS.
- Propose la prochaine étape concrète.
- Mentions légales conformes RGPD.

FORMAT — JSON STRICT, rien avant ni après :
{
  "subject_suggested": "Re: ...",
  "body_text": "Madame, Monsieur,\\n\\n...\\n\\nCordialement,\\nCabinet [nom]",
  "body_html": "<p>Madame, Monsieur,</p><p>...</p><p>Cordialement,<br>Cabinet [nom]</p>",
  "confidence": 0.85,
  "missing_info": [],
  "suggested_next_actions": []
}`
}
