// Fiche chantier BTP (components/dashboard/ChantiersBTPV2.tsx) : ce que l'enregistrement d'une fiche modifiée envoie,
// et ce que devient la position GPS du chantier quand on corrige son adresse (demande de Frédéric du 17/11/2026).
//
// Avant : la fiche renvoyait tout son formulaire, lu à son ouverture. Une fiche ouverte au bureau, puis enregistrée
// après que le gérant eut placé le chantier sur place (« Placer à ma position actuelle », onglet Affectations du
// pointage) ou changé son rayon ou ses employés, remettait les anciennes valeurs ; et corriger l'adresse effaçait
// tout de suite la position, même posée sur place.
// Maintenant : seuls les champs modifiés depuis l'ouverture partent. La position enregistrée du chantier reste pendant
// qu'on corrige l'adresse, et l'enregistrement demande s'il faut la garder. Une position calculée pendant la saisie
// (bouton GPS, devis importé) suit toujours l'adresse : elle part dès que l'adresse change.
// Tests : tests/lib/btp-fiche-chantier.test.ts et tests/components/btp-fiche-chantier-gps.test.tsx.

import { coordonneesValides } from '@/lib/btp/pointage-geo'

export interface PositionFiche {
  latitude?: number | null
  longitude?: number | null
}

export interface AdresseFiche {
  adresse?: string | null
  codePostal?: string | null
  ville?: string | null
}

/** Deux valeurs de champ égales : absent et null se valent ; listes comparées sans tenir compte de l'ordre. */
function memeValeur(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const trier = (v: unknown) => (Array.isArray(v) ? v.map(String).sort((x, y) => x.localeCompare(y)) : [])
    return JSON.stringify(trier(a)) === JSON.stringify(trier(b))
  }
  return (a ?? null) === (b ?? null)
}

/** Champs modifiés depuis l'ouverture de la fiche : seuls ceux-là partent à l'enregistrement. */
export function champsModifies<T extends object>(ouverte: T, actuelle: T): Partial<T> {
  const modifies: Partial<T> = {}
  for (const cle of Object.keys(actuelle) as Array<keyof T>) {
    if (!memeValeur(ouverte[cle], actuelle[cle])) modifies[cle] = actuelle[cle]
  }
  return modifies
}

const normaliser = (valeur: string | null | undefined) => (valeur ?? '').trim().replaceAll(/\s+/g, ' ').toLowerCase()

/** L'adresse (rue, code postal, ville) a changé depuis l'ouverture, espaces et majuscules mis à part. */
export function adresseModifiee(ouverte: AdresseFiche, actuelle: AdresseFiche): boolean {
  return normaliser(ouverte.adresse) !== normaliser(actuelle.adresse)
    || normaliser(ouverte.codePostal) !== normaliser(actuelle.codePostal)
    || normaliser(ouverte.ville) !== normaliser(actuelle.ville)
}

/** Même position, ou toutes deux absentes. */
export function memePosition(a: PositionFiche, b: PositionFiche): boolean {
  return (a.latitude ?? null) === (b.latitude ?? null) && (a.longitude ?? null) === (b.longitude ?? null)
}

/**
 * La fiche porte encore la position enregistrée du chantier : valable à l'ouverture et inchangée depuis. Sans fiche
 * ouverte (nouveau chantier), jamais.
 */
export function porteLaPositionEnregistree(ouverte: PositionFiche | null, actuelle: PositionFiche): boolean {
  return ouverte !== null && coordonneesValides(ouverte.latitude, ouverte.longitude) && memePosition(ouverte, actuelle)
}

/** À l'enregistrement : l'adresse a changé alors que la fiche porte encore la position enregistrée. */
export function questionPositionNecessaire(
  ouverte: (AdresseFiche & PositionFiche) | null,
  actuelle: AdresseFiche & PositionFiche,
): boolean {
  return ouverte !== null && porteLaPositionEnregistree(ouverte, actuelle) && adresseModifiee(ouverte, actuelle)
}

// Les boîtes de confirmation n'ont que « OK » et un second bouton, dont le libellé dépend du navigateur (« Annuler »,
// « Cancel » dans l'appli) : les textes ne le nomment pas. Fermer une boîte (Échap, Retour d'Android, toucher à côté)
// vaut ce second bouton : il ne détruit jamais rien.

/** 1re question à l'enregistrement d'une fiche dont l'adresse a changé : OK garde la position. */
export function questionGarderPosition(titre: string, isPt: boolean): string {
  if (isPt) {
    return `A morada da obra « ${titre} » mudou.\n\n`
      + 'Manter a posição GPS atual? Pode ter sido colocada na obra para a marcação automática.\n\n'
      + 'OK: manter a posição (morada corrigida).\n'
      + 'Outro botão: retirá-la ou voltar à ficha (segue-se uma segunda pergunta).'
  }
  return `L’adresse du chantier « ${titre} » a changé.\n\n`
    + 'Garder sa position GPS actuelle ? Elle a peut-être été placée sur le chantier pour le pointage automatique.\n\n'
    + 'OK : garder la position (adresse corrigée).\n'
    + 'L’autre bouton : la retirer, ou revenir à la fiche (une seconde question suit).'
}

/** 2e question, après refus de la 1re : seul OK retire la position ; l'autre bouton revient à la fiche, rien n'est enregistré. */
/** Le second moyen de poser la position, sur place, et où le trouver. */
export function placerSurPlace(isPt: boolean): string {
  return isPt
    ? '« Colocar na minha posição atual » (ecrã Registo de horas, separador Atribuições)'
    : '« Placer à ma position actuelle » (écran Pointage équipes, onglet Affectations)'
}

export function questionRetirerPosition(titre: string, isPt: boolean): string {
  if (isPt) {
    return `Retirar a posição GPS da obra « ${titre} » (a obra mudou de sítio)?\n\n`
      + `OK: retirá-la e guardar; volte a calculá-la com o botão GPS da ficha, ou na obra com ${placerSurPlace(true)}.\n`
      + 'Outro botão: voltar à ficha sem guardar nada.'
  }
  return `Retirer la position GPS du chantier « ${titre} » (le chantier a changé d’endroit) ?\n\n`
    + `OK : la retirer et enregistrer ; recalculez-la ensuite avec le bouton GPS de la fiche, ou sur place avec ${placerSurPlace(false)}.\n`
    + 'L’autre bouton : revenir à la fiche sans rien enregistrer.'
}

/**
 * Aide de la case « Alerte météo par notification » (26/11/2026) : qui est prévenu, comment, et quand pour un chantier
 * pas encore commencé (règle chantierSuiviLe, lib/btp/alerte-meteo.ts ; le téléphone d'un salarié ne reçoit que ses
 * chantiers en cours).
 */
export function aideAlerteMeteo(isPt: boolean): string {
  return isPt
    ? 'Para uma obra exposta ao tempo (betão, telhado, fachada…): na véspera de chuva, geada, vento forte ou calor, os trabalhadores atribuídos recebem uma notificação na aplicação Vitfix Pro e um e-mail. Obra « Pendente »: só o e-mail, na véspera do dia de início.'
    : 'Pour un chantier exposé aux intempéries (béton, toiture, façade…) : la veille de la pluie, du gel, du vent fort ou de la chaleur, les salariés affectés reçoivent une notification sur l’appli Vitfix Pro et un e-mail. Chantier « En attente » : l’e-mail seulement, la veille du jour de début.'
}

/** Case cochée sur une fiche sans position GPS : l'alerte ne peut pas partir. */
export function noteAlerteSansPosition(isPt: boolean): string {
  return isPt
    ? `É necessária a posição GPS da obra para o alerta: use o botão GPS acima ou, na obra, ${placerSurPlace(true)}.`
    : `L’alerte a besoin de la position GPS du chantier : utilisez le bouton GPS ci-dessus ou, sur place, ${placerSurPlace(false)}.`
}

/** Bouton GPS de la fiche, adresse trop vague alors que la fiche porte la position enregistrée : on la garde. */
export function avertissementPositionGardee(isPt: boolean): string {
  return isPt
    ? 'Morada pouco precisa para o GPS: a posição atual da obra é mantida. Indique o número, a rua e o código postal.'
    : 'Adresse trop vague pour le GPS : la position actuelle du chantier est gardée. Indiquez le numéro, la rue et le code postal.'
}
