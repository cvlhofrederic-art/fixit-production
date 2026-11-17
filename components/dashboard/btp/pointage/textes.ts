// Textes de l'écran Pointage BTP (français / portugais) partagés par ses onglets.

import {
  ECART_ALERTE_M, PRECISION_APPROXIMATIVE_M, PRECISION_MAX_PLACEMENT_M, type EcartPlacement, type RaisonSansMesure,
} from './positionSurPlace'

/** Information des employés sur ce que le pointage automatique enregistre (affichée avant l'activation). */
export function noticePointage(isPt: boolean): { titre: string; points: string[] } {
  return isPt
    ? {
        titre: 'Registo de horas: o que é registado',
        points: [
          'Apenas a obra, a hora de chegada, a hora de saída e o modo (automático ou manual).',
          'Em modo automático, a sua posição GPS e a distância à obra ficam no seu telemóvel: não são enviadas nem guardadas.',
          'O modo automático é facultativo: só funciona com esta página aberta e depois de o ativar. Pode pará-lo a qualquer momento; o registo manual tem o mesmo valor.',
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
        titre: 'Antes de ativar o registo automático',
        points: [
          'Informe previamente cada trabalhador, por escrito: finalidade (registo dos tempos de trabalho), dados registados, quem os consulta e durante quanto tempo são conservados.',
          'Peça o parecer da comissão de trabalhadores, se existir, e faça uma avaliação de impacto (AIPD).',
          'O Código do Trabalho (art. 20.º) proíbe a vigilância à distância para controlar o desempenho profissional, e a CNPD considera a geolocalização de telemóveis uma forma de vigilância à distância: em caso de dúvida, consulte o seu jurista.',
          'Os registos não podem servir para avaliar o desempenho nem para sancionar. O registo manual continua sempre disponível, com o mesmo valor.',
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

/** Compte non relié à une fiche employé (ou relié à plusieurs) : ce qu'il faut faire. */
export function messageNonRelie(rattachement: 'aucun' | 'ambigu', gerant: boolean, isPt: boolean): string {
  if (rattachement === 'ambigu') {
    return isPt
      ? 'Várias fichas de colaborador (Equipas) têm o e-mail da sua conta: peça ao seu responsável para manter só uma.'
      : 'Plusieurs fiches employé (Équipes) portent l’adresse e-mail de votre compte : demandez à votre responsable de n’en garder qu’une.'
  }
  if (gerant) {
    return isPt
      ? 'Para registar as suas próprias horas, adicione-se em Equipas com o e-mail desta conta.'
      : 'Pour pointer vous-même, ajoutez-vous dans Équipes avec l’adresse e-mail de ce compte.'
  }
  return isPt
    ? 'A sua conta não está ligada a nenhuma ficha de colaborador: peça ao seu responsável para indicar o seu e-mail na sua ficha (módulo Equipas).'
    : 'Votre compte n’est relié à aucune fiche employé : demandez à votre responsable d’indiquer votre adresse e-mail sur votre fiche (module Équipes).'
}

/** Pointage automatique non activé pour la société : texte du gérant ou de l'employé. */
export function messageAutoDesactive(gerant: boolean, isPt: boolean): string {
  if (gerant) {
    return isPt
      ? 'Desativado para a sua empresa. Pode ativá-lo no separador Atribuições; entretanto, registe o ponto manualmente.'
      : 'Désactivé pour votre société. Vous pouvez l’activer dans l’onglet Affectations ; en attendant, pointez à la main.'
  }
  return isPt
    ? 'O registo automático não foi ativado pela sua entidade empregadora: registe o ponto manualmente a partir da lista das suas obras.'
    : 'Non activé par votre employeur : pointez à la main depuis la liste de vos chantiers.'
}

/**
 * Pointage automatique en cours, téléphone hors du chantier sans heure de sortie connue (suivi coupé par une veille ou
 * une page fermée) : l'employé termine à la main ; la dernière présence vue part avec, pour son responsable.
 */
export function messageSortieSansTrace(derniereVue: number | null, isPt: boolean): string {
  if (derniereVue === null) {
    return isPt
      ? 'Já não está na obra, mas este telemóvel não sabe a que horas saiu: termine o registo manualmente.'
      : 'Vous n’êtes plus sur le chantier, mais ce téléphone ne sait pas à quelle heure vous en êtes parti : terminez le pointage à la main.'
  }
  const heure = new Date(derniereVue).toLocaleTimeString(isPt ? 'pt-PT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })
  return isPt
    ? `O acompanhamento foi interrompido (página fechada ou telemóvel em suspensão) e já não está na obra: última presença registada às ${heure}. Termine o registo manualmente; o seu responsável verá esta hora.`
    : `Le suivi a été interrompu (page fermée ou téléphone en veille) et vous n’êtes plus sur le chantier : dernière présence vue à ${heure}. Terminez le pointage à la main ; votre responsable verra cette heure.`
}

/** Bouton d'un chantier dans « Mes chantiers ». */
export function libelleBoutonChantier(surPlace: boolean, isPt: boolean): string {
  if (surPlace) return isPt ? 'No local' : 'Sur place'
  return isPt ? 'Registar aqui' : 'Pointer ici'
}

/** Message affiché pour un refus de /api/btp/pointage (code d'erreur de la route). */
export function messageErreurPointage(code: string, isPt: boolean): string {
  const messages: Record<string, [string, string]> = {
    chantier_non_affecte: ['Ce chantier ne vous est pas affecté (ou n’est plus en cours).', 'Esta obra não lhe está atribuída (ou já não está em curso).'],
    pointage_auto_desactive: ['Le pointage automatique n’est pas activé pour votre société : pointez à la main.', 'O registo automático não está ativado para a sua empresa: registe o ponto manualmente.'],
    chantier_sans_position: ['Ce chantier n’a pas de position GPS : pointez à la main.', 'Esta obra não tem posição GPS: registe o ponto manualmente.'],
    fiche_absente: ['Votre compte n’est relié à aucune fiche employé.', 'A sua conta não está ligada a nenhuma ficha de colaborador.'],
    fiche_ambigue: ['Plusieurs fiches employé portent votre adresse e-mail.', 'Várias fichas de colaborador têm o seu e-mail.'],
    aucun_pointage_en_cours: ['Aucun pointage en cours.', 'Nenhum registo em curso.'],
    pointage_different: ['Le pointage en cours n’a pas été commencé automatiquement sur ce chantier : terminez-le à la main.', 'O registo em curso não foi iniciado automaticamente nesta obra: termine-o manualmente.'],
    reserve_au_gerant: ['Réservé au gérant de la société.', 'Reservado ao gerente da empresa.'],
    confirmation_requise: ['Cochez d’abord la confirmation d’information des salariés.', 'Assinale primeiro a confirmação de informação dos trabalhadores.'],
    migration_requise: ['Disponible après la mise à jour de la base de données (migration du 16/11/2026).', 'Disponível após a atualização da base de dados (migração de 16/11/2026).'],
    reseau: ['Pas de réseau : nouvel essai automatique dans quelques secondes.', 'Sem rede: nova tentativa automática dentro de segundos.'],
  }
  const message = messages[code]
  if (message) return isPt ? message[1] : message[0]
  return isPt ? 'O registo não foi guardado. Tente novamente.' : 'Le pointage n’a pas été enregistré. Réessayez.'
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

/** Bouton du gérant qui place un chantier à la position actuelle de son téléphone (onglet Affectations). */
export function libelleBoutonPlacer(mesureEnCours: boolean, isPt: boolean): string {
  if (mesureEnCours) return isPt ? 'A medir a posição…' : 'Mesure de la position…'
  return isPt ? 'Colocar na minha posição atual' : 'Placer à ma position actuelle'
}

/** Pourquoi le chantier n'a pas pu être placé à la position du téléphone. */
export function messagePlacementImpossible(raison: RaisonSansMesure, precisionM: number | undefined, isPt: boolean): string {
  if (raison === 'indisponible') {
    return isPt
      ? 'Este navegador não fornece a posição: abra esta página no seu telemóvel, na obra.'
      : 'Ce navigateur ne donne pas la position : ouvrez cette page sur votre téléphone, sur le chantier.'
  }
  if (raison === 'refusee') {
    return isPt
      ? 'Localização recusada: autorize-a para este site nas definições do navegador e tente de novo.'
      : 'Localisation refusée : autorisez-la pour ce site dans les réglages du navigateur, puis réessayez.'
  }
  if (raison === 'introuvable') {
    return isPt
      ? 'Posição não encontrada: coloque-se no exterior, na obra, e tente de novo.'
      : 'Position introuvable : mettez-vous à l’extérieur, sur le chantier, et réessayez.'
  }
  if (raison === 'annulee') return isPt ? 'Medição interrompida.' : 'Mesure interrompue.'
  const obtenue = precisionM ?? 0
  if (obtenue >= PRECISION_APPROXIMATIVE_M) {
    // Localisation approximative accordée au navigateur (iPhone « Position exacte » coupée, Android « approximative »).
    return isPt
      ? `O telemóvel só fornece uma posição aproximada (± ${formatDistance(obtenue, true)}): autorize a localização exata para este navegador nas definições do telemóvel e tente de novo.`
      : `Le téléphone ne donne qu’une position approximative (± ${formatDistance(obtenue, false)}) : autorisez la position exacte pour ce navigateur dans les réglages du téléphone, puis réessayez.`
  }
  const arrondie = Math.round(obtenue)
  return isPt
    ? `Posição demasiado imprecisa (± ${arrondie} m; no máximo ± ${PRECISION_MAX_PLACEMENT_M} m): coloque-se a céu aberto na obra e tente de novo.`
    : `Position trop imprécise (± ${arrondie} m ; il faut ± ${PRECISION_MAX_PLACEMENT_M} m au plus) : mettez-vous à découvert sur le chantier et réessayez.`
}

/** Ligne de la confirmation qui situe la position mesurée par rapport au repère du chantier. */
function ligneEcart(ecart: EcartPlacement, isPt: boolean): string {
  const distance = formatDistance(ecart.metres, isPt)
  const parAdresse = ecart.reference === 'adresse'
  if (ecart.metres >= ECART_ALERTE_M) {
    if (isPt) return `Atenção: está a ${distance} ${parAdresse ? 'da morada da obra' : 'da posição registada da obra'}. Está mesmo nesta obra?`
    return `Attention : vous êtes à ${distance} ${parAdresse ? 'de l’adresse du chantier' : 'de la position enregistrée du chantier'}. Êtes-vous bien sur ce chantier ?`
  }
  if (isPt) return parAdresse ? `Está a ${distance} da morada da obra.` : `Fica a ${distance} da posição registada até agora.`
  return parAdresse ? `Vous êtes à ${distance} de l’adresse du chantier.` : `C’est à ${distance} de la position enregistrée jusqu’ici.`
}

/** Question posée au gérant avant de remplacer la position d'un chantier par celle de son téléphone. */
export function confirmationPlacement(titre: string, precisionM: number, ecart: EcartPlacement | null, isPt: boolean): string {
  const precision = Math.round(precisionM)
  const lignes = isPt
    ? [
      `Colocar a obra « ${titre} » na sua posição atual (precisão ± ${precision} m)?`,
      'Faça-o na obra, onde os colaboradores trabalham: o registo automático dispara à volta deste ponto.',
    ]
    : [
      `Placer le chantier « ${titre} » à votre position actuelle (précision ± ${precision} m) ?`,
      'Faites-le sur le chantier, là où les employés travaillent : le pointage automatique se déclenche autour de ce point.',
    ]
  if (ecart !== null) lignes.push(ligneEcart(ecart, isPt))
  return lignes.join('\n\n')
}

/** Question posée avant de remplacer une position existante par celle de l'adresse (« Relocaliser l'adresse »). */
export function confirmationRelocaliser(titre: string, isPt: boolean): string {
  return isPt
    ? `Substituir a posição atual da obra « ${titre} » pela da sua morada? Uma posição colocada no local seria perdida.`
    : `Remplacer la position actuelle du chantier « ${titre} » par celle de son adresse ? Une position placée sur place serait perdue.`
}

/** Annonce pour les lecteurs d'écran pendant la mesure (le bouton, désactivé, ne la dit pas). */
export function annonceMesure(titre: string, isPt: boolean): string {
  return isPt
    ? `A medir a posição da obra « ${titre} »: fique imóvel alguns segundos.`
    : `Mesure de la position du chantier « ${titre} » : restez immobile quelques secondes.`
}

/** Confirmation affichée une fois le chantier placé. */
export function messageChantierPlace(precisionM: number, isPt: boolean): string {
  const precision = Math.round(precisionM)
  return isPt ? `Posição da obra colocada aqui (± ${precision} m)` : `Position du chantier placée ici (± ${precision} m)`
}
