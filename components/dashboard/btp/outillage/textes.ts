// Textes de l'écran Outillage et véhicules (société BTP), en français et en portugais d'Europe.

import { decalerDate, type EtatVerification, type GroupeOutil, type TypeOutil } from '@/lib/btp/outillage-regles'

const JOURS_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

/** « sexta-feira 27/11 » ou « vendredi 27/11 » (date AAAA-MM-JJ). */
export function jourEtDate(date: string, isPt: boolean): string {
  const [a, m, j] = date.split('-').map(Number)
  const jour = new Date(Date.UTC(a, m - 1, j)).getUTCDay()
  return `${(isPt ? JOURS_PT : JOURS_FR)[jour]} ${String(j).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

/** « 27/11 às 17:05 » ou « 27/11 à 17:05 » (instant ISO, heure du téléphone). */
export function dateEtHeure(instant: string, isPt: boolean): string {
  const d = new Date(instant)
  const date = d.toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: '2-digit' })
  const heure = d.toLocaleTimeString(isPt ? 'pt-PT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })
  return isPt ? `${date} às ${heure}` : `${date} à ${heure}`
}

export function libelleType(type: TypeOutil, isPt: boolean, pluriel = false): string {
  if (type === 'vehicule') return isPt ? (pluriel ? 'Viaturas' : 'Viatura') : (pluriel ? 'Véhicules' : 'Véhicule')
  return isPt ? (pluriel ? 'Ferramentas' : 'Ferramenta') : (pluriel ? 'Outils' : 'Outil')
}

export const iconeType = (type: TypeOutil) => (type === 'vehicule' ? '🚐' : '🔧')

// Catégories (28/11/2026). Icônes des premières versions d'emoji : lisibles aussi sur un vieux téléphone Android.
const GROUPES: Record<GroupeOutil, { icone: string; pt: string; fr: string }> = {
  main: { icone: '🔨', pt: 'Ferramentas de mão', fr: 'Outillage à main' },
  electroportatif: { icone: '🔌', pt: 'Ferramentas elétricas', fr: 'Outillage électroportatif' },
  echafaudage: { icone: '🏗️', pt: 'Andaimes e escadas', fr: 'Échafaudages et échelles' },
  coffrage: { icone: '🧱', pt: 'Cofragem e escoramento', fr: 'Coffrage et étaiement' },
  machines: { icone: '⚙️', pt: 'Máquinas e equipamentos', fr: 'Machines et matériel' },
  mesure: { icone: '📏', pt: 'Medição e nivelamento', fr: 'Mesure et nivellement' },
  securite: { icone: '⛑️', pt: 'Segurança e EPI', fr: 'Sécurité et EPI' },
  autre: { icone: '🔧', pt: 'Outras ferramentas', fr: 'Autres outils' },
  vehicule: { icone: '🚐', pt: 'Viaturas', fr: 'Véhicules' },
  sans: { icone: '🔧', pt: 'Sem categoria', fr: 'Sans catégorie' },
}

export const libelleGroupe = (groupe: GroupeOutil, isPt: boolean): string => (isPt ? GROUPES[groupe].pt : GROUPES[groupe].fr)
export const iconeGroupe = (groupe: GroupeOutil): string => GROUPES[groupe].icone

/** Badge d'état de la vérification d'un chantier : texte et couleur (classes v5-badge-*). */
export function badgeVerification(etat: EtatVerification, vendredi: string, isPt: boolean): { texte: string; couleur: string } {
  switch (etat) {
    case 'faite': return { texte: isPt ? 'Verificada' : 'Vérifiée', couleur: 'green' }
    case 'a_faire': return { texte: isPt ? 'A verificar hoje' : 'À vérifier aujourd’hui', couleur: 'orange' }
    case 'en_retard': return { texte: isPt ? `Em atraso (${jourEtDate(vendredi, true)})` : `En retard (${jourEtDate(vendredi, false)})`, couleur: 'red' }
    case 'sans_outils': return { texte: isPt ? 'Sem ferramentas registadas' : 'Aucun outil enregistré', couleur: 'gray' }
    default: {
      const prochain = decalerDate(vendredi, 7)
      return { texte: isPt ? `Próxima: ${jourEtDate(prochain, true)}` : `Prochaine : ${jourEtDate(prochain, false)}`, couleur: 'blue' }
    }
  }
}

/** Résumé d'une vérification : « Tudo presente » ou « 2 em falta · 1 avariada ». */
export function resumeVerification(manquants: number, enPanne: number, isPt: boolean): string {
  const parties: string[] = []
  if (manquants > 0) parties.push(isPt ? `${manquants} em falta` : `${manquants} manquant${manquants > 1 ? 's' : ''}`)
  if (enPanne > 0) parties.push(isPt ? `${enPanne} avariada${enPanne > 1 ? 's' : ''}` : `${enPanne} en panne`)
  if (parties.length === 0) return isPt ? 'Tudo presente' : 'Tout est là'
  return parties.join(' · ')
}

/** Message affiché pour un refus de /api/btp/outillage (code d'erreur de la route). */
export function messageErreurOutillage(code: string, isPt: boolean): string {
  const messages: Record<string, [string, string]> = {
    acces_refuse: ['Vous n’avez pas accès à ce module. Demandez-le à votre gérant.', 'Não tem acesso a este módulo. Peça acesso ao seu gerente.'],
    observations_requises: ['Aucun outil sur ce chantier : écrivez une remarque pour envoyer la vérification.', 'Nenhuma ferramenta nesta obra: escreva uma observação para enviar a verificação.'],
    reserve_btp: ['Module réservé aux sociétés du BTP.', 'Módulo reservado às empresas de construção.'],
    reserve_a_la_gestion: ['Seul le gérant (ou un compte en accès complet) modifie le répertoire.', 'Só o gerente (ou uma conta com acesso total) altera o inventário.'],
    chantier_non_affecte: ['Ce chantier ne vous est pas affecté (ou n’est plus en cours).', 'Esta obra não lhe está atribuída (ou já não está em curso).'],
    chantier_inconnu: ['Ce chantier n’existe plus. Rechargez la page.', 'Esta obra já não existe. Recarregue a página.'],
    outil_introuvable: ['Cet élément a déjà été retiré ou n’existe plus. Rechargez la page.', 'Este elemento já foi retirado ou já não existe. Recarregue a página.'],
    liste_changee: ['La liste de ce chantier a changé entre-temps : elle a été rechargée, vérifiez-la de nouveau.', 'A lista desta obra mudou entretanto: foi recarregada, verifique-a de novo.'],
    quantite_invalide: ['Le nombre présent dépasse la quantité prévue : indiquez l’excédent dans les remarques.', 'O número presente ultrapassa a quantidade prevista: indique o excedente nas observações.'],
    fiche_absente: ['Votre compte n’est relié à aucune fiche employé (même adresse e-mail que dans Équipes).', 'A sua conta não está ligada a nenhuma ficha de colaborador (o mesmo e-mail que em Equipas).'],
    fiche_ambigue: ['Plusieurs fiches employé portent votre adresse e-mail : prévenez votre gérant.', 'Várias fichas de colaborador têm o seu e-mail: avise o seu gerente.'],
    migration_requise: ['Disponible après la mise à jour de la base de données (migration du 26/11/2026).', 'Disponível após a atualização da base de dados (migração de 26/11/2026).'],
    migration_categorie: ['Les catégories seront disponibles après la mise à jour de la base de données (migration du 28/11/2026) : rien n’a été enregistré.', 'As categorias ficam disponíveis após a atualização da base de dados (migração de 28/11/2026): nada foi guardado.'],
    reseau: ['Pas de réseau : rien n’a été enregistré. Réessayez.', 'Sem rede: nada foi guardado. Tente novamente.'],
  }
  const message = messages[code]
  if (message) return isPt ? message[1] : message[0]
  return isPt ? 'Não foi guardado. Tente novamente.' : 'Rien n’a été enregistré. Réessayez.'
}
