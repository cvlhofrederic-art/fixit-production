// Réponses cannées des agents IA — port byte-exact du `reply()` du mockup v8.
// Démo du design : le branchement aux vrais agents (Groq) viendra dans un lot
// ultérieur, comme côté PT (onAsk → askAgent quand le cabinet est authentifié).

const replyFor = (short: string, q: string): string => {
  const k = q.toLowerCase()
  if (k.includes('majorit'))
    return "Pour désigner le syndic en AG, la majorité de l'article 25 (majorité des voix de tous les copropriétaires) s'applique ; à défaut, un second vote à la majorité de l'article 25-1 puis 24 est possible. Le syndic judiciaire (art. 46 décret 1967) intervient justement quand l'AG, régulièrement convoquée, n'a pu réunir cette majorité."
  if (k.includes('notif') || k.includes('ordonnance'))
    return "L'ordonnance de désignation doit être notifiée à tous les copropriétaires dans le mois suivant son prononcé, dans les formes de l'article 64 du décret du 17 mars 1967."
  if (k.includes('honorair') || k.includes('taxation'))
    return "En qualité d'auxiliaire de justice, vos honoraires ne suivent pas le forfait/hors-forfait du contrat-type mais les articles 704 à 718 du CPC : un état de frais et honoraires est soumis au juge taxateur (président du TJ)."
  if (k.includes('délai') || k.includes('duree') || k.includes('durée') || k.includes('mission'))
    return "La durée de la mission est fixée par l'ordonnance, sans excéder trois ans. Vous devez convoquer l'AG élective au plus tard deux mois avant la fin de votre mission."
  return `Bonne question. En tant qu'assistant ${short}, je m'appuie sur la loi du 10 juillet 1965 et le décret du 17 mars 1967. (Réponse IA complète en cours de déploiement.)`
}

/** Réponse démo d'un agent (async pour coller à la signature `onAsk` d'AgentChatPage). */
export const agentReply = (short: string, q: string): Promise<string> => Promise.resolve(replyFor(short, q))
