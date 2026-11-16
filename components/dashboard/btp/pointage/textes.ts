// Textes de l'écran Pointage BTP (français / portugais) partagés par ses onglets.

/** Information des employés sur ce que le pointage automatique enregistre (affichée avant l'activation). */
export function noticePointage(isPt: boolean): { titre: string; points: string[] } {
  return isPt
    ? {
        titre: 'Marcação de horas: o que é registado',
        points: [
          'Apenas a obra, a hora de chegada, a hora de saída e o modo (automático ou manual).',
          'Em modo automático, a sua posição GPS e a distância à obra ficam no seu telemóvel: não são enviadas nem guardadas.',
          'O modo automático é facultativo: só funciona com esta página aberta e depois de o ativar. Pode pará-lo a qualquer momento; a marcação manual tem o mesmo valor.',
          'Estas informações são visíveis pela sua entidade empregadora, para o registo do seu tempo de trabalho.',
        ],
      }
    : {
        titre: 'Pointage : ce qui est enregistré',
        points: [
          'Seulement le chantier, l’heure d’arrivée, l’heure de départ et le mode (automatique ou à la main).',
          'En mode automatique, votre position GPS et la distance au chantier restent sur votre téléphone : elles ne sont ni envoyées ni conservées.',
          'Le mode automatique est facultatif : il ne fonctionne que page ouverte, une fois que vous l’avez activé. Vous pouvez l’arrêter à tout moment ; le pointage à la main a la même valeur.',
          'Ces informations sont visibles par votre employeur, pour le décompte de votre temps de travail.',
        ],
      }
}

/**
 * Rappel au gérant avant d'activer le pointage automatique (recherche du 16/11/2026 sur les sources officielles :
 * Conseil d'État 15/12/2017 n° 403776, Code du travail L.1222-4 et L.2312-38, CNIL ; Código do Trabalho art. 20,
 * CNPD délibération 7680/2014 et liste des traitements soumis à analyse d'impact).
 */
export function rappelActivation(isPt: boolean): { titre: string; points: string[]; confirmation: string } {
  return isPt
    ? {
        titre: 'Antes de ativar a marcação automática',
        points: [
          'Informe previamente cada trabalhador, por escrito: finalidade (registo dos tempos de trabalho), dados registados, quem os consulta e durante quanto tempo são conservados.',
          'Peça o parecer da comissão de trabalhadores, se existir, e faça uma avaliação de impacto (AIPD).',
          'O Código do Trabalho (art. 20.º) proíbe a vigilância à distância para controlar o desempenho profissional, e a CNPD considera a geolocalização de telemóveis uma forma de vigilância à distância: em caso de dúvida, consulte o seu jurista.',
          'Os registos não podem servir para avaliar o desempenho nem para sancionar. A marcação manual continua sempre disponível, com o mesmo valor.',
        ],
        confirmation: 'Informei os meus trabalhadores e cumpri as formalidades acima.',
      }
    : {
        titre: 'Avant d’activer le pointage automatique',
        points: [
          'Informez au préalable chaque salarié, par écrit : finalité (décompte du temps de travail), données enregistrées, qui les consulte et combien de temps elles sont conservées.',
          'Consultez le CSE s’il y en a un (entreprise de 50 salariés et plus) et réalisez une analyse d’impact (AIPD).',
          'La jurisprudence n’admet le contrôle du temps de travail par géolocalisation que si aucun autre moyen ne le permet : le pointage automatique reste une aide facultative pour le salarié, le pointage à la main a toujours la même valeur.',
          'Les pointages ne doivent servir ni à mesurer la performance ni à sanctionner.',
        ],
        confirmation: 'J’ai informé mes salariés et accompli les formalités ci-dessus.',
      }
}

/** Message affiché pour un refus de /api/btp/pointage (code d'erreur de la route). */
export function messageErreurPointage(code: string, isPt: boolean): string {
  const messages: Record<string, [string, string]> = {
    chantier_non_affecte: ['Ce chantier ne vous est pas affecté (ou n’est plus en cours).', 'Esta obra não lhe está atribuída (ou já não está em curso).'],
    pointage_auto_desactive: ['Le pointage automatique n’est pas activé pour votre société : pointez à la main.', 'A marcação automática não está ativada para a sua empresa: marque manualmente.'],
    chantier_sans_position: ['Ce chantier n’a pas de position GPS : pointez à la main.', 'Esta obra não tem posição GPS: marque manualmente.'],
    fiche_absente: ['Votre compte n’est relié à aucune fiche employé.', 'A sua conta não está ligada a nenhuma ficha de colaborador.'],
    fiche_ambigue: ['Plusieurs fiches employé portent votre adresse e-mail.', 'Várias fichas de colaborador têm o seu e-mail.'],
    aucun_pointage_en_cours: ['Aucun pointage en cours.', 'Nenhuma marcação em curso.'],
    reseau: ['Pas de réseau : nouvel essai automatique dans quelques secondes.', 'Sem rede: nova tentativa automática dentro de segundos.'],
  }
  const message = messages[code]
  if (message) return isPt ? message[1] : message[0]
  return isPt ? 'A marcação não foi registada. Tente novamente.' : 'Le pointage n’a pas été enregistré. Réessayez.'
}

/** Durée en heures décimales → « 7 h 30 ». */
export function formatHeures(heures: number): string {
  const minutes = Math.max(0, Math.round(heures * 60))
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

/** Distance lisible : « 350 m » ou « 1,2 km ». */
export function formatDistance(metres: number, isPt: boolean): string {
  if (metres < 1000) return `${Math.round(metres)} m`
  return `${(metres / 1000).toLocaleString(isPt ? 'pt-PT' : 'fr-FR', { maximumFractionDigits: 1 })} km`
}
